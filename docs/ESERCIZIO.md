# Esercizio

Come si gestisce il servizio in produzione. Due modi di leggere, secondo il momento:

- **[Momenti pianificati](#momenti-pianificati)** — accettazione della macchina,
  installazione, primo deploy, passaggio in produzione, apertura al pubblico,
  dismissione. Si legge prima, quando il guasto lo si sta prevenendo.
- **[Intervento per sintomo](#intervento-per-sintomo)** — a guasto avvenuto. Organizzato
  per cio' che si osserva, non per componente: chi interviene vede un guasto, non sa
  ancora quale pezzo lo ha causato.

Scritto per essere usato da chi non lo ha scritto. Dove un passo puo' essere sbagliato in
modo non reversibile, il motivo e' accanto: senza, la tentazione di saltarlo e' forte
proprio quando si ha fretta.

I comandi si eseguono dalla radice del repository sulla macchina, salvo dove indicato.
`STACK_NAME` vale `pi` se non diversamente configurato in `/etc/stack-deploy.env`.

**Regola che vale ovunque.** Un comando che finisce in `grep`, `head` o `tail` nasconde
il codice di uscita del comando vero. Se serve sapere se e' andato a buon fine, va
catturato prima della pipe.

---

# Momenti pianificati

## 1. Accettazione della macchina

Prima di installare qualunque cosa. È l'unico momento in cui rifiutare la macchina non
costa nulla.

1. **Stato dei dischi.**
   ```
   smartctl -a /dev/nvme0n1
   smartctl -a /dev/nvme1n1
   ```
   Guardare `Percentage Used`, `Data Units Written` e `Media and Data Integrity Errors`.
   Un'unità molto usurata non è guasta e non verrà sostituita, ma è quella che cederà
   per prima durante l'esercizio.
2. **Annotare** indirizzo IPv4, eventuale prefisso IPv6, e credenziali di gestione.
3. **Verificare l'uscita verso internet** dai registry che servono: Docker Hub, registry
   Elastic, GHCR, autorità di certificazione. Un filtro in uscita si manifesta come pull
   che fallisce a metà installazione, non come errore di rete.

Uscita: hardware accettato, indirizzi noti, nessun record DNS ancora creato.

---

## 2. Installazione del sistema

**È la fase irreversibile.** Il layout dei dischi si decide qui: correggerlo dopo
significa ridurre un filesystem in uso.

1. Sistema di ripristino, chiave SSH autorizzata, accesso.
2. Installazione con il layout previsto (`provisioning/README.md`, "Layout"): volume di
   sistema al minimo, volumi distinti per dati Docker, indici di Elasticsearch,
   diagnostica, copie ed esportazioni, **spazio abbondante non allocato nel volume
   group**.
3. Nessuna partizione di swap.

**Perché lo spazio non allocato non è prudenza generica.** Lo snapshot LVM è il
meccanismo di copia primario e richiede extent liberi nel volume group. Allocare tutto
significa restare senza il meccanismo su cui è costruita la continuità dei dati, e
accorgersene quando serve usarlo.

**Perché gli indici hanno un volume proprio.** I dati di sessione sono irrecuperabili,
gli indici sono telemetria deliberatamente non protetta. Se condividono un filesystem,
il riempimento del secondo porta giù il primo. MongoDB resta invece sul volume dei dati
Docker: lo snapshot LVM copre un volume solo, e con MongoDB altrove la copia primaria
dei dati non ricostruibili non lo comprenderebbe.

Verifica prima di proseguire:
```
vgs
lsblk -f
findmnt
```

---

## 3. Prerequisiti dell'host

1. Utente amministrativo nominale, SSH a sola chiave, login root disabilitato,
   autenticazione con password disabilitata.
2. `vm.max_map_count` **almeno** 262144, il minimo di Elasticsearch. Ubuntu 24.04 lo
   imposta già a 1048576 con un file in `/usr/lib/sysctl.d/`: si rende esplicito il
   valore in uso **senza abbassarlo**, perché i file in `/etc/sysctl.d/` sono applicati
   dopo, e scriverne uno più basso lo ridurrebbe.
   ```
   sysctl vm.max_map_count
   echo 'vm.max_map_count=1048576' | sudo tee /etc/sysctl.d/60-elasticsearch.conf
   ```
   **Verificare che sopravviva al riavvio**, non solo all'applicazione a caldo: senza,
   Elasticsearch non parte.
3. Firewall host-level, default deny in ingresso, aperte 22, 80 e 443.

   **Docker scavalca ufw.** I pacchetti diretti alle porte pubblicate non attraversano
   `INPUT`, dove vivono le regole ufw: un `default deny` che sembra funzionare non
   protegge nulla di ciò che Docker pubblica. Le regole vanno in `DOCKER-USER`.
4. Docker Engine con `daemon.json` da `provisioning/docker/`, che dichiara `data-root`
   sul volume dedicato. **Il montaggio deve esistere prima della prima partenza del
   demone**, o le immagini finiscono sul filesystem di sistema.
5. Aggiornamenti di sicurezza automatici, **senza riavvio automatico**.
6. Orologio sincronizzato: log con orario sbagliato sono inutilizzabili proprio nella
   diagnosi a posteriori.
7. Journal persistente con i tetti in `provisioning/systemd/journald.conf.d/`.

---

## 4. Primo deploy

Da eseguire con l'autorità di certificazione di prova e HSTS spento. Le ragioni sono al
punto 6.

1. Prelievo del repository, generazione dei segreti.
2. Directory degli indici `/srv/data/elastic` a `1000:0`, modo `2770`, con il volume
   montato (`provisioning/README.md`, "Layout"). Il deploy si ferma se non lo è.
3. `/etc/stack-deploy.env` compilato: hostname, recapito per l'autorità, digest delle
   immagini. **Le immagini vanno riferite per digest**, non per tag: lo stesso comando
   eseguito a distanza di tempo porterebbe in servizio contenuto diverso senza che nulla
   lo segnali.
4. `ACME_CA_SERVER` puntata alla directory di prova, `HSTS_MAX_AGE=0`.
5. `/etc/stack-surveillance.env` compilato, con `TLS_HOST` ancora **vuoto**: il controllo
   del certificato va acceso quando c'è un certificato vero da controllare.
6. Deploy.

### Verifica a stack acceso

È la categoria di controllo che in questo progetto ha trovato più difetti. Non va
compressa perché le fasi precedenti sono andate lisce, e va rifatta dopo ogni modifica
allo stack. Le voci segnate sono state verificate sulla macchina di produzione il
12 settembre 2026.

- Tutti i servizi in esecuzione, nessuno in riavvio ciclico — *verificato*
- Le dashboard rispondono sul percorso dedicato, dietro autenticazione — *verificato*
- **L'indirizzo di provenienza arriva corretto al backend.** Le porte sono pubblicate in
  `mode: host` proprio per questo: se arrivasse quello della rete interna, quote e
  rilevamento vedrebbero tutto il traffico come un unico host
- **I fatti di partita atterrano sull'indice separato** e non nella destinazione
  predefinita di Filebeat. Se sbagliano indice, la vista divulgativa resta vuota e
  l'unico modo di darle dei dati sarebbe darle anche i log di sistema — *verificato*
- Un riavvio della macchina: lo stack deve tornare su da solo, senza interventi —
  *verificato*: stack e bootstrap ripartiti da soli, certificato non riemesso,
  pacchetto diagnostico prodotto allo spegnimento

Dopo ogni rilascio, `sudo stack-checkup.sh` ripete in un colpo solo i controlli sulla
macchina e la verifica end-to-end (vedi `provisioning/README.md`).

---

## 5. Sorveglianza esterna

Da completare prima che la macchina resti non presidiata.

1. Verificare che gli otto check esistano con gli slug attesi, e mandare **un ping
   manuale a ciascuno**: valida in un colpo solo gli slug, la chiave di ping e l'uscita
   di rete verso il servizio.
2. **Riattivare le notifiche su `stack-liveness`**, disattivate finché lo stack non era
   in servizio. È l'unico dead man's switch sul servizio: silenziato, si perde la
   copertura del caso "macchina che non risponde", che è esattamente ciò per cui esiste.
3. Provare il percorso di notifica fino al telefono. Con un solo canale, se il bot viene
   revocato o la chat cancellata i check cambiano stato e nessuno lo viene a sapere.
   Da rifare dopo ogni modifica alle integrazioni.
4. Dimensionare il grace period di `backup-nightly` sulla durata reale della copia, non
   sul jitter del timer.

**Stato al 13 settembre 2026:** passi 1-3 eseguiti con `healthchecks-drill.sh` (8 check
su 8, segnale e rientro con HTTP 200, notifiche ricevute su Telegram); le notifiche di
`stack-liveness` risultano attive. La copia notturna dura pochi secondi: l'ora di
tolleranza di `backup-nightly` basta. Il canale email è assegnato ai check accanto a
Telegram. Lo schedule di `backup-nightly` è in `Europe/Rome`: il 13 settembre era rimasto
in UTC e il check è andato in allarme con la copia riuscita.

---

## 6. Passaggio in produzione

Il rischio da evitare non è l'avviso di certificato, che è transitorio. È la
**combinazione fra HSTS e un certificato rotto**, che il visitatore non può aggirare e
che dura quanto la durata dichiarata.

Nell'ordine, senza saltare passaggi:

| # | Passo | HSTS | Autorità |
|---|---|---|---|
| 1 | Catena completa funzionante | spento | prova |
| 2 | Cancellare il file di stato ACME dal volume | spento | — |
| 3 | Passare alla produzione e riemettere | spento | produzione |
| 4 | Verifica esterna della catena, da rete diversa e da telefono | spento | produzione |
| 5 | Solo a verifica superata: `HSTS_MAX_AGE=86400` | acceso | produzione |
| 6 | Accendere `TLS_HOST` nella sorveglianza | acceso | produzione |

**Stato al 13 settembre 2026:** passi 1-4 completati. Certificato dell'autorità di
produzione emesso e servito; la verifica esterna è superata da rete mobile e con SSL
Labs (voto A, catena senza problemi, solo TLS 1.2 e 1.3).

**Passo 5 non eseguito, per scelta.** L'esercizio dura due fine settimana di due giorni e
la macchina viene dismessa a fine settembre: il guadagno di HSTS su una finestra così
breve non giustifica il rischio di rendere il sito irraggiungibile per un errore
all'ultimo momento. Il redirect da HTTP a HTTPS e il cookie di sessione `Secure` coprono
già il caso principale. `HSTS_MAX_AGE` resta `0`.

Il passo 6 si esegue comunque: il controllo del certificato non dipende da HSTS.

**Il passo 2 non è facoltativo.** Il volume ACME sopravvive alla ridistribuzione: senza
cancellarlo, il certificato di prova resta in cache e continua a essere servito mentre
tutto sembra a posto.

**`stsPreload` resta `false` e il dominio non va mai sottoposto alla lista di
precaricamento.** È l'unica variante del problema che sopravvive alla dismissione della
macchina: l'inserimento è compilato nei binari dei browser e la rimozione richiede mesi.

**Tutto il collaudo contro la directory di prova.** L'autorità di produzione limita per
settimana i certificati con lo stesso insieme di nomi: pochi tentativi con configurazione
sbagliata e il dominio resta senza certificato valido per giorni.

Il materiale con il codice QR si stampa **dopo** il passo 4, mai prima.

---

## 7. Vigilia di una giornata di apertura

Trenta minuti, il giorno prima. Serve a non scoprire un problema mentre la sala si
riempie. `sudo stack-checkup.sh` copre i punti 2, 3 e l'integrità della copia del punto
6; gli altri restano a mano.

1. Stato dei check: tutti verdi, nessuno in ritardo.
2. Spazio libero sui volumi. La soglia da guardare è **85%**: Elasticsearch smette di
   allocare shard, e al 95% impone agli indici il blocco in sola lettura, che si rimuove
   solo a mano.
3. **Contatori SMART dei dischi, per seriale.** Il nome del dispositivo non è stabile:
   fra il sistema di ripristino e quello installato `nvme0n1` e `nvme1n1` risultano
   invertiti, e possono cambiare fra un kernel e l'altro. Si legge il seriale di ogni
   disco e il contatore si confronta con quello del proprio seriale.
   ```bash
   for d in /dev/nvme?n1; do printf '%s %s\n' "$d" "$(sudo smartctl -i "$d" | awk -F': *' '/Serial Number/ {print $2}')"; sudo smartctl -A "$d" | grep -E 'Media and Data|Error Information|^Temperature:'; done
   ```
   | Seriale | Disco | `Media and Data Integrity Errors` | Soglia di avviso della temperatura |
   |---|---|---|---|
   | `Y67S105STUHV` | Toshiba THNSN5512GPU7 | 0 | 78 °C |
   | `S3W8NB0K413381` | Samsung PM981 | 3 | 81 °C |

   Un contatore più alto del riferimento significa errori di integrità nuovi: si chiede
   la sostituzione del disco indicando il seriale. `Error Information Log Entries` non è
   un criterio: sul Samsung cresce con i comandi che il disco non supporta, compresi
   quelli di `smartctl`.
4. Il gioco si completa da una postazione, dall'inizio alla fine.
5. Il sito risponde da rete cellulare, non solo dalla rete locale: è il percorso reale di
   chi arriva dal QR.
6. Copia dei dati presa e **verificata leggibile**, non solo prodotta.
7. Nessuna modifica alla configurazione da qui in avanti. Se una serve davvero, va fatta
   ora e non domani.

---

## 8. Durante l'apertura

L'obiettivo dichiarato è **zero interventi manuali**. Ciò che segue è osservazione, non
manutenzione.

- Non ridistribuire lo stack. Un aggiornamento di configurazione riavvia i servizi che la
  montano, e lo fa nel momento peggiore.
- Un allarme si affronta con [l'intervento per sintomo](#intervento-per-sintomo).
- **Se MongoDB si corrompe: copiare prima lo stato da parte, e solo dopo tentare il
  recupero.** Ricreare il database a vuoto è la strada più rapida per tornare operativi
  ed è l'ultima da scegliere, perché distrugge l'unica copia rimasta di un evento non
  ripetibile.
- Nessuno script di manutenzione deve contenere `--volumes`. `docker stack rm` non tocca
  i volumi nominati; `docker compose down -v` li distrugge. È la differenza fra un
  riavvio e una perdita di dati, e la si sbaglia sotto pressione.

---

## 9. Chiusura di una giornata

1. Esportazione dei dati e **prelievo fuori dalla macchina**. È l'unico off-host reale
   che non dipende da infrastruttura, e copre esattamente le finestre che contano.
2. Verificare che l'archivio prelevato si apra e contenga quanto atteso. Una copia mai
   riletta non è una copia.
3. Annotare quanto è durata l'esportazione: serve a dimensionare il grace period e a
   sapere quanto tempo richiede quando servirà davvero.

---

## 10. Dismissione

1. Esportazione finale, prelievo, **verifica di leggibilità prima di distruggere
   qualunque cosa**.
2. Confronto fra ciò che è stato prelevato e ciò che serve per le conclusioni: quante
   partite, quanto lunghe, dove si sono fermate, quanti sono arrivati dal QR senza
   giocare. Se manca qualcosa, questo è l'ultimo momento in cui esiste ancora.
3. Distruzione dei dati sulla macchina e dismissione.
4. Revoca delle credenziali che restano valide altrove: chiave di ping della
   sorveglianza, credenziali del registrar, accessi al fornitore.
5. Decidere consapevolmente cosa fare del dominio: compare su materiale stampato, e
   lasciarlo scadere senza deciderlo è comunque una decisione.

---

---

# Intervento per sintomo

## Primi trenta secondi

Prima di qualsiasi ipotesi, questi tre controlli in quest'ordine.

```bash
sudo bash -c '. /etc/stack-deploy.env; docker stack services "$STACK_NAME"; docker stack ps "$STACK_NAME" --no-trunc --filter desired-state=running'
h=$(sudo sed -n 's/^APP_HOST=//p' /etc/stack-deploy.env)
curl -sk -o /dev/null -w '%{http_code}\n' --resolve "$h:443:127.0.0.1" "https://$h/health"
journalctl -u stack-deploy.service -u fleet-bootstrap.service -n 50 --no-pager
```

La richiesta di salute passa dal proxy sul nome pubblico, risolto sulla macchina
stessa: con `sniStrict` attivo un handshake per `localhost` viene rifiutato, e
l'entrypoint in chiaro reindirizza ogni richiesta. `-k` perche' qui interessa che il
backend risponda, non il certificato, che ha un controllo proprio.

Lo stato dei servizi distingue subito le due situazioni che richiedono risposte
opposte: **repliche a zero** significa che l'orchestratore non riesce a piazzare
o avviare un task, e la causa e' nella sua motivazione di rifiuto; **repliche a
uno ma servizio che non risponde** significa che il processo gira e il problema
e' dentro, quindi si guardano i log.

Se serve una raccolta completa da portare via prima di toccare altro:

```bash
sudo bash -c '. /etc/stack-deploy.env; export STACK_NAME; /usr/local/bin/diagnostic-bundle.sh'    # scrive in /srv/diagnostics
```

---

## Il sito non risponde

**1. Lo stack e' su?**

```bash
docker stack ls
sudo bash -c '. /etc/stack-deploy.env; docker stack services "$STACK_NAME"; docker stack ps "$STACK_NAME" --no-trunc --filter desired-state=running'
```

Se lo stack non c'e', riapplicalo. E' idempotente e non tocca i volumi:

```bash
sudo systemctl restart stack-deploy.service
journalctl -u stack-deploy.service -n 50 --no-pager
```

`restart` e non `start`: l'unita' e' `oneshot` con `RemainAfterExit`, quindi dopo
il primo avvio resta attiva, e su un'unita' attiva `start` non esegue nulla senza
segnalarlo. `start` vale solo per il primo avvio. Il riavvio riesegue anche
`fleet-bootstrap.service`, che dipende da questa unita' ed e' idempotente, anche
quando il deploy riesce solo al tentativo automatico successivo. Non lanciare un
secondo `restart` prima che il primo abbia finito: fallisce con `update out of
sequence` e l'unita' riprova dopo 20 secondi.

Il deploy si rifiuta di partire se un'immagine non e' ancorata per digest o se
un file di secret e' vuoto. Sono i due messaggi piu' probabili: l'errore arriva
**prima** di applicare meta' stack, quindi lo stato non e' mai a meta'.

**2. Il proxy e' su ma il resto no?**

```bash
docker service ps ${STACK_NAME}_proxy --no-trunc
docker service logs ${STACK_NAME}_proxy --tail 100
```

Con `proxy` a `1/1` e i backend a zero, il sito risponde ma con errori del
proxy: il guasto e' a valle, non al bordo.

**3. Un servizio resta a `0/1`.**

```bash
docker service ps ${STACK_NAME}_<servizio> --no-trunc --format '{{.CurrentState}} | {{.Error}}'
```

La colonna dell'errore dice la causa senza bisogno di leggere i log. I rifiuti
piu' comuni sono un montaggio la cui sorgente non esiste sull'host e un limite
di memoria insufficiente per il processo.

**4. Riavvio mirato di un servizio.** Non rimuovere lo stack: forza la
riprogrammazione del solo servizio interessato.

```bash
docker service update --force ${STACK_NAME}_<servizio>
```

---

## Le dashboard sono vuote o irraggiungibili

**Credenziale rifiutata di continuo (richiesta che non si chiude).** E' il
sintomo del disallineamento fra il bordo e Kibana: il bordo accetta la
credenziale e la lascia passare, Kibana non la conosce e la respinge. Le utenze
devono esistere su entrambi i lati con la **stessa password**.

```bash
cut -d: -f1 secrets/dashboard_users_esercizio secrets/dashboard_users_evento
sudo systemctl restart fleet-bootstrap.service   # ricrea le utenze via Terraform
```

Gli elenchi htpasswd contengono impronte e non password: il disallineamento non
e' rilevabile confrontando i file, si verifica solo tentando un accesso reale.

**Dashboard raggiungibili ma senza dati.** Nell'ordine: il cluster e'
interrogabile, l'ingestione e' viva, la data view corrisponde a indici che
esistono davvero.

```bash
sudo bash -c '. /etc/stack-deploy.env; export APP_HOST STACK_NAME; ./ci/stack-verify.sh'
```

**Gli agenti non risultano registrati.** Il bootstrap e' idempotente e si puo'
rieseguire a ogni avvio. Come per il deploy, `restart` e non `start`: anche questa
unita' e' `oneshot` con `RemainAfterExit`, e una volta attiva `start` non la
riesegue.

```bash
sudo systemctl restart fleet-bootstrap.service
journalctl -u fleet-bootstrap.service -n 80 --no-pager
```

Gli agenti escono e vengono rischedulati finche' il token non compare sul volume
condiviso: lo stack converge da solo, non serve un avvio in due fasi.

---

## Il disco si riempie

Il battito segnala l'occupazione oltre l'**85%** su ciascun punto di mount
sorvegliato, con la classe `host-resources`.

```bash
df -h / /var /srv/docker /srv/data/elastic /srv/backup /srv/export /srv/diagnostics
docker system df
lvs                      # occupazione copy-on-write degli snapshot
```

Uno snapshot LVM che esaurisce il proprio spazio copy-on-write viene invalidato
dal kernel: **resta elencato e non e' piu' ripristinabile**. Se ne trovi uno in
quello stato, va rimosso, e la copia che rappresentava non esiste piu'.

Recupero rapido, dal meno al piu' invasivo:

```bash
docker image prune -f            # livelli non referenziati
journalctl --vacuum-size=200M    # journal persistente
```

La ritenzione degli indici e' governata dalla configurazione dello stack e si
applica da sola: non cancellare indici a mano durante l'esercizio, perche' il
recupero e' modesto e la perdita e' definitiva.

**Il volume degli indici si estende a caldo.** Il volume group tiene non
allocati circa 165 GB, di cui gli snapshot ne usano al piu' 48: con
`/srv/data/elastic` oltre l'85% la risposta e' estenderlo, non ridurre la
ritenzione.

```bash
sudo lvextend -r -L +40G vg0/elastic   # -r estende anche il filesystem
df -h /srv/data/elastic
```

---

## Pressione di memoria

Il battito segnala memoria disponibile sotto il **15%**, swap in uso oltre il
**50%**, e ogni terminazione per esaurimento di memoria avvenuta dall'ultimo
controllo.

```bash
free -h
docker stats --no-stream
grep oom_kill /proc/vmstat
```

Le terminazioni sono contate come **variazione** e non come valore assoluto:
vengono segnalate anche se al momento del controllo la memoria e' gia' tornata
disponibile, perche' il fatto e' avvenuto comunque.

Ogni servizio ha un tetto dichiarato. Un servizio terminato ripetutamente per
memoria ha un tetto troppo basso per il proprio carico, non un guasto: alzarlo
richiede di verificare che il totale resti dentro la memoria della macchina.

---

## Nessun allarme da troppo tempo

Sospetta il percorso di notifica prima di concludere che va tutto bene.

Due battiti allarmano sul silenzio: quello del servizio, a cinque minuti, e quello
del recapito allarmi, a dieci. I relay hanno periodo di un anno e non scendono mai
da soli, solo su un segnale esplicito — quindi un relay morto e uno che non ha nulla
da segnalare sono indistinguibili, ed e' il motivo per cui il recapito ha un battito
proprio.

```bash
systemctl list-timers 'stack-heartbeat*' 'alert-notifier*' 'backup-nightly*'
journalctl -u stack-heartbeat.service -n 30 --no-pager
journalctl -u alert-notifier.service -n 30 --no-pager
```

Il battito parte **solo se i controlli locali passano**. Un timer attivo e un
battito assente non sono in contraddizione: significa che un controllo locale
sta fallendo, e lo script allega l'elenco di quali.

Le otto destinazioni sono separate perche' le notifiche dipendono dalla
transizione di stato: su una destinazione unica, un secondo guasto che arriva
mentre il primo e' ancora aperto non produrrebbe alcuna notifica.

| Check | Tipo | Che cosa rappresenta |
|---|---|---|
| `stack-liveness` | battito, 5 min | il servizio risponde e sa servire |
| `alert-relay` | battito, 10 min | il recapito degli allarmi e' vivo |
| `app-degradation` | relay | tasso di errori, latenza |
| `host-resources` | relay | memoria, swap, disco, terminazioni |
| `observability` | relay | cluster interrogabile, ingestione viva |
| `security` | relay | attivita' anomala oltre soglia |
| `tls-pubblico` | relay | certificato del nome pubblico verificabile |
| `backup-nightly` | calendario | copia notturna eseguita |

---

## Recupero dei dati

**Leggere questa sezione prima di eseguirla.** Le tre strade sono state
cronometrate su basi dati reali, e il risultato e' controintuitivo.

| Strada | Tempo misurato | Che cosa fa |
|---|---|---|
| Messa in sicurezza | 2.709 ms | copia lo stato corrente da parte, cosi' com'e' |
| Ripristino da copia | 1.135 ms | rilegge un archivio `mongodump` |
| Ricreazione a vuoto | 1.342 ms | riparte da zero, piu' il riavvio del backend |

**La messa in sicurezza e' la piu' lenta delle tre.** Sotto pressione l'istinto
dice il contrario — mettere da parte sembra rapido, ripristinare sembra lento —
e non lo e': la copia attraversa i file sul filesystem, mentre il ripristino
legge un archivio compresso e denso. Il passo 1 non e' gratuito e va messo in
conto nel tempo totale.

Resta comunque **sempre il primo passo**: una ricreazione affrettata distrugge
l'unica copia rimasta.

```bash
sudo data-restore.sh --metti-in-sicurezza
sudo data-restore.sh --ripristina /srv/backup/mongodump/<stamp>/mongo/game_db.archive.gz
sudo data-restore.sh --ricrea
```

Le cifre assolute crescono in modo diverso: la messa in sicurezza cresce con
l'occupazione su disco, il ripristino con il numero di documenti.

**Prelievo degli archivi.** Il percorso di consegna e' `/export`, protetto
dall'elenco della platea tecnica e senza elenco della directory: il nome
dell'archivio si legge dal manifesto dell'esportazione.

```bash
curl -u <utente> --output esportazione.ndjson.gz \
  https://<hostname>/export/<marca-temporale>/elastic/<nome>.ndjson.gz
```

---

## Cambiare un secret

I file in `secrets/` si modificano sulla macchina, poi si riapplica lo stack con
`sudo systemctl restart stack-deploy.service`. Il nome di ogni secret porta
l'impronta del contenuto: un file cambiato diventa un secret nuovo, e vengono
aggiornati solo i servizi che lo montano. Non tutti i valori pero' vivono solo nel
file.

| Secret | Come si cambia |
|---|---|
| `dashboard_users*` | con `sudo provisioning/bin/configure-dashboard-users.py secrets`: aggiorna o verifica gli htpasswd e genera `dashboard_users.tfvars.json`; poi si rieseguono deploy e bootstrap |
| `redis_password` | nel file: Redis ricostruisce le utenze all'avvio, il backend l'indirizzo, e lo stesso deploy riavvia entrambi |
| `apm_secret_token`, `filebeat_writer_password` | nel file, poi `sudo systemctl restart fleet-bootstrap.service`, che porta lo stesso valore nella policy Fleet o nell'utenza di Elasticsearch |
| `kibana_system_password` | nel file: il job `setup` monta lo stesso secret e viene rieseguito a ogni deploy, quindi reimposta la password in Elasticsearch; Kibana, aggiornato dallo stesso deploy, si autentica appena la password e' impostata |
| `crowdsec_bouncer_key` | prima si rimuove il bouncer (`cscli bouncers delete key_traefik` nel contenitore di crowdsec), poi si cambia il file: il motore registra la chiave all'avvio solo se il bouncer non esiste gia' |
| `elastic_password`, `mongo_root_password` | prima nel servizio, poi nel file: Elasticsearch e MongoDB leggono il file solo alla prima inizializzazione |
| `kibana_encryption_key` | non si cambia: cifra i saved object esistenti, che con una chiave nuova diventano illeggibili |
| `gameplay_id_salt` | non si cambia durante l'esercizio: le partite in corso cambierebbero identificativo |
| `pow_secret` | nel file: smettono di valere solo le sfide a prova di lavoro gia' emesse, che durano 5 minuti |

---

## Da non fare

- **Non rimuovere lo stack** per riparare un singolo servizio. `docker service
  update --force` riprogramma quello che serve senza fermare il resto.
- **Non cancellare i volumi** insieme allo stack. `sudo docker stack rm pi` li
  lascia intatti di proposito; rimuoverli e' irreversibile e i dati di una finestra di
  esercizio non sono ricostruibili.
- **Non ricreare a vuoto** prima di aver messo in sicurezza lo stato corrotto.
- **Non abbassare i limiti di memoria** per far entrare un servizio in piu':
  sposta il guasto invece di risolverlo, e lo sposta su un componente diverso da
  quello che stavi guardando.
- **Non allegare lo stato di Terraform** a una segnalazione: contiene in chiaro
  tutti i valori dichiarati sensibili, password delle utenze comprese.

---

---

## Riferimenti

| Dove | Che cosa contiene |
|---|---|
| [ARCHITETTURA.md](ARCHITETTURA.md) | com'e' fatto il sistema e perche' |
| [SVILUPPO.md](SVILUPPO.md) | avvio in locale |
| `make help` | elenco completo dei comandi, generato dai target |
| `provisioning/README.md` | installazione, unita' systemd, sorveglianza, dati |
| `terraform/README.md` | stato di Terraform: dove risiede, come si ricostruisce |
| `terraform/elk/README.md` | Space, ruoli, utenze, dashboard versionate |
| `/srv/diagnostics` | raccolte diagnostiche, prodotte anche allo spegnimento |
