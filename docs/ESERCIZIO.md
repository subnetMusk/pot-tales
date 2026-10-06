# Esercizio

**Stato:** servizio offline, riattivabile. Le procedure descrivono il prodotto corrente.

Procedure per l'operatore del servizio in produzione:

- **[Momenti pianificati](#momenti-pianificati)**; accettazione della macchina,
  installazione, primo deploy, passaggio in produzione, apertura al pubblico,
  dismissione. Controlli da eseguire prima di ogni apertura.
- **[Intervento per sintomo](#intervento-per-sintomo)**; diagnosi e recupero a partire dal sintomo osservato.
- **[Verifiche esterne](#verifiche-esterne-e-superficie-pubblica)**: percorsi pubblici,
  dashboard, esportazione e prova delle notifiche.

I comandi si eseguono dalla radice del repository sulla macchina, salvo dove indicato.
I comandi che usano il nome dello stack leggono `/etc/stack-deploy.env` in una
shell dedicata e applicano il valore predefinito `pi`: non richiedono variabili
lasciate da un comando precedente.

**Esito dei comandi.** Un comando che finisce in `grep`, `head` o `tail` nasconde
il codice di uscita del comando vero. Se serve sapere se è andato a buon fine, va
catturato prima della pipe.

---


## Rimessa in esercizio

Queste procedure valgono per un nuovo evento, con dati e credenziali nuovi.

1. Preparare una macchina Ubuntu LTS con Docker Swarm e filesystem separati,
   seguendo il [provisioning](../provisioning/README.md). Come indicazione iniziale:
   4 vCPU, 16 GB di RAM e circa 150 GB SSD per lo stack completo; dimensionare
   il solo livello applicativo separatamente (2 vCPU e 4-8 GB sono un punto di partenza).
2. Configurare `APP_HOST`, DNS, contatto ACME e TLS. Il dominio pot-tales.it
   richiede un nuovo record A prima di tornare raggiungibile.
3. Generare segreti nuovi con `generate-secrets.sh`, configurare utenti delle
   dashboard e completare il bootstrap Fleet. Non ripristinare dati del vecchio evento.
4. Ricostruire e scansionare le immagini, registrare i digest in
   `/etc/stack-deploy.env`. Il job GHCR resta abilitato sui push autorizzati;
   Dependabot resta sospeso. Dopo una rinomina del repository, usare il percorso e i digest prodotti
   dalla pipeline per la revisione da distribuire.
5. Installare tutti gli script di `provisioning/bin/`, incluso `es-curl.sh`.
   Configurare `STACK_NAME`, `ES_CURL_SERVICE` e gli otto check Healthchecks
   in `/etc/stack-surveillance.env`. Il client persistente dello stack deve
   essere in esecuzione sul manager prima di attivare i timer.
6. Rivedere la configurazione: chiusura inattività a 15 minuti, tracing backend
   con `restart`, sonda MongoDB a 60 secondi e registry Filebeat persistente.
7. Su una macchina di prova eseguire `ci/stack-verify.sh`, il drill Healthchecks
   e i drill di backup e ripristino. Verificare in APM nomi delle rotte e
   campionamento; rileggere log campione dopo un riavvio Filebeat.
8. Aggiornare contatti e informativa `/privacy`, verificare licenze dei materiali
   per l'esposizione pubblica e aprire al pubblico soltanto dopo la prova generale.

La verifica locale degli artefatti non sostituisce questa prova dello stack
completo, delle credenziali reali, del dominio e dei recapiti.

## Momenti pianificati

### 1. Accettazione della macchina

Verificare hardware e accessi prima di installare il sistema.

1. **Stato dei dischi.**
   ```
   smartctl -a /dev/nvme0n1
   smartctl -a /dev/nvme1n1
   ```
   Guardare `Percentage Used`, `Data Units Written` e `Media and Data Integrity Errors`.
   Registrare usura ed errori per seriale e concordare con il fornitore la
   sostituzione di unità non adatte al carico previsto.
2. **Annotare** indirizzo IPv4, eventuale prefisso IPv6, e credenziali di gestione.
3. **Verificare l'uscita verso internet** dai registry che servono: Docker Hub, registry
   Elastic, GHCR, autorità di certificazione. Un filtro in uscita si manifesta come pull
   che fallisce a metà installazione, non come errore di rete.

Uscita: hardware accettato, indirizzi noti, nessun record DNS ancora creato.

---

### 2. Installazione del sistema

**È la fase irreversibile.** Il layout dei dischi si decide qui: correggerlo dopo
significa ridurre un filesystem in uso.

1. Sistema di ripristino, chiave SSH autorizzata, accesso.
2. Installazione con il layout previsto ([Layout del provisioning](../provisioning/README.md#layout)): volume di
   sistema al minimo, volumi distinti per dati Docker, indici di Elasticsearch,
   diagnostica, copie ed esportazioni, **spazio abbondante non allocato nel volume
   group**.
3. Nessuna partizione di swap.

Riservare extent liberi nel volume group per gli snapshot LVM, usati dalla
copia di sicurezza primaria.

Tenere gli indici Elasticsearch su un volume separato per impedire che la loro
crescita esaurisca lo spazio di MongoDB. MongoDB resta sul volume Docker
compreso nello snapshot LVM; gli indici si conservano tramite export.

Verifica prima di proseguire:
```
vgs
lsblk -f
findmnt
```

---

### 3. Prerequisiti dell'host

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
   `INPUT`, dove vivono le regole ufw. Filtrare le porte pubblicate con `DOCKER-USER`.
4. Docker Engine con `daemon.json` da `provisioning/docker/`, che dichiara `data-root`
   sul volume dedicato. **Il montaggio deve esistere prima della prima partenza del
   demone**, o le immagini finiscono sul filesystem di sistema.
5. Aggiornamenti di sicurezza automatici, **senza riavvio automatico**.
6. Orologio sincronizzato per correlare log e metriche.
7. Journal persistente con i tetti in `provisioning/systemd/journald.conf.d/`.

---

### 4. Primo deploy

Da eseguire con l'autorità di certificazione di prova e HSTS spento. Le ragioni sono al
punto 6.

1. Prelievo del repository, generazione dei segreti.
2. Directory degli indici `/srv/data/elastic` a `1000:0`, modo `2770`, con il volume
   montato ([Layout del provisioning](../provisioning/README.md#layout)). Il deploy si ferma se non lo è.
3. `/etc/stack-deploy.env` compilato: hostname, recapito per l'autorità, digest delle
   immagini. **Le immagini vanno riferite per digest**, non per tag: lo stesso comando
   eseguito a distanza di tempo porterebbe in servizio contenuto diverso senza che nulla
   lo segnali.
4. `ACME_CA_SERVER` puntata alla directory di prova, `HSTS_MAX_AGE=0`.
5. `/etc/stack-surveillance.env` compilato, con `TLS_HOST` ancora **vuoto**: il controllo
   del certificato va acceso quando c'è un certificato vero da controllare.
6. Deploy.

#### Verifica a stack acceso

Ripetere i controlli dopo ogni modifica allo stack e registrarne l'esito:

- Tutti i servizi raggiungono il numero di repliche previsto, senza riavvii ciclici.
- Le dashboard rispondono dietro autenticazione; ciascuna credenziale resta entro
  lo Space e gli indici assegnati.
- Il backend riceve l'indirizzo del client, con porte pubblicate in `mode: host`.
- I fatti di partita arrivano su `logs-gioco.partita-*`, separati dai log tecnici.
- Dopo un riavvio lo stack e il bootstrap ripartono; lo stato ACME è conservato
  e la raccolta diagnostica dello spegnimento è disponibile.

Dopo ogni rilascio, `sudo stack-checkup.sh` esegue i controlli sulla
macchina e la verifica end-to-end (vedi [provisioning](../provisioning/README.md)).

---

### 5. Sorveglianza esterna

Da completare prima che la macchina resti non presidiata.

1. Verificare che gli otto check esistano con gli slug attesi, e mandare **un ping
   manuale a ciascuno** per verificare gli slug, la chiave di ping e l'uscita
   di rete verso il servizio.
2. **Attivare le notifiche su `stack-liveness`** per ricevere un allarme
   quando il servizio non invia più battiti.
3. Provare il percorso di notifica fino al telefono. Con un solo canale, se il bot viene
   revocato o la chat cancellata i check cambiano stato e nessuno lo viene a sapere.
   Da rifare dopo ogni modifica alle integrazioni.
4. Dimensionare il grace period di `backup-nightly` sulla durata reale della copia, non
   sul jitter del timer.

Eseguire il [drill delle notifiche](#controlli-esterni-e-notifiche) e verificare
segnale e rientro su ciascun check. Configurare almeno due canali di recapito
indipendenti. Allineare calendario, fuso orario e tolleranza di `backup-nightly`
alla [configurazione del provisioning](../provisioning/README.md#check-backup-nightly).

---

### 6. Passaggio in produzione

Con HSTS attivo un certificato non valido impedisce l’accesso al sito senza
possibilità di aggirare l’errore nel browser, per la durata dichiarata.

Nell'ordine, senza saltare passaggi:

| # | Passo | HSTS | Autorità |
|---|---|---|---|
| 1 | Catena completa funzionante | spento | prova |
| 2 | Cancellare il file di stato ACME dal volume | spento |; |
| 3 | Passare alla produzione e riemettere | spento | produzione |
| 4 | Verifica esterna della catena, da rete diversa e da telefono | spento | produzione |
| 5 | Solo a verifica superata: `HSTS_MAX_AGE=86400` | acceso | produzione |
| 6 | Accendere `TLS_HOST` nella sorveglianza | acceso | produzione |

Il passo 5 richiede una decisione sulla durata dell'evento e sulla gestione del
dominio dopo la chiusura. Il modello mantiene HSTS spento; abilitarlo soltanto
dopo la verifica del certificato e registrare il valore scelto. Eseguire il
passo 6 anche se HSTS resta spento.

Il volume ACME sopravvive alla ridistribuzione: rimuovere lo stato di prova
prima della nuova emissione, per evitare di continuare a servire il certificato
di staging.

**`stsPreload` resta `false` e il dominio non va mai sottoposto alla lista di
precaricamento.** È l'unica variante del problema che sopravvive alla dismissione della
macchina: l'inserimento è compilato nei binari dei browser e la rimozione richiede mesi.

**Tutto il collaudo contro la directory di prova.** L'autorità di produzione limita per
settimana i certificati con lo stesso insieme di nomi: pochi tentativi con configurazione
sbagliata e il dominio resta senza certificato valido per giorni.

Il materiale con il codice QR si stampa **dopo** il passo 4, mai prima.

---

### 7. Vigilia di una giornata di apertura

- Predisporre e segnalare postazioni desktop accanto al QR: il gioco richiede un computer.
- Usare un QR con provenienza, per esempio `?src=<evento>`.
- Provare avvii contemporanei sul NAT della sala: i limiti sono tarati per una
  platea condivisa (burst 100), non per singolo utente.
- Misurare sulla rete della sede i byte trasferiti per giocatore nei primi
  due minuti e il tempo
  prima che il gioco diventi utilizzabile; ripetere dopo ogni build.
- Conservare solo gli asset necessari nella build e valutare audio compresso con gli autori.


Eseguire i controlli il giorno prima di ogni apertura. `sudo stack-checkup.sh`
copre i punti 2, 3 e l’integrità della copia del punto 6; gli altri restano manuali.

1. Stato dei check: tutti verdi, nessuno in ritardo.
2. Spazio libero sui volumi. Le soglie predefinite di Elasticsearch sono **85%** per limitare
   nuove allocazioni, **90%** per tentare la riallocazione e **95%** per bloccare
   le scritture degli indici coinvolti. Il blocco viene rimosso automaticamente
   quando l’occupazione scende sotto la soglia alta (90%). Su un nodo singolo
   non esiste un altro nodo verso cui spostare gli shard. Vedi le
   [soglie di allocazione di Elasticsearch 8.19](https://www.elastic.co/guide/en/elasticsearch/reference/8.19/modules-cluster.html#disk-based-shard-allocation).
3. **Contatori SMART dei dischi, per seriale.** Il nome del dispositivo non è stabile:
   `nvme0n1` e `nvme1n1` possono cambiare fra avvii o kernel. Confrontare
   i contatori associati allo stesso seriale.
   ```bash
   for d in /dev/nvme?n1; do printf '%s %s\n' "$d" "$(sudo smartctl -i "$d" | awk -F': *' '/Serial Number/ {print $2}')"; sudo smartctl -A "$d" | grep -E 'Media and Data|Error Information|^Temperature:'; done
   ```
   Registrare per ciascun seriale i contatori all'accettazione e impostare
   `SMART_RIFERIMENTI` in `/etc/stack-data.env` per il confronto automatico.
   Confrontarli prima di ogni apertura. Un aumento di `Media and Data Integrity
   Errors` richiede indagine sul disco; verificare le soglie di temperatura del
   produttore. `Error Information Log Entries` può includere comandi non
   supportati e va interpretato insieme al log degli errori.

4. Il gioco si completa da una postazione, dall'inizio alla fine.
5. Il sito risponde da rete cellulare, non solo dalla rete locale: è il percorso reale di
   chi arriva dal QR.
6. Copia dei dati presa e **verificata leggibile**, non solo prodotta.
7. Completare le modifiche alla configurazione e ripetere i controlli prima dell'apertura.

---

### 8. Durante l'apertura

- Non ridistribuire lo stack. Un aggiornamento di configurazione riavvia i servizi che la
  montano.
- Un allarme si affronta con [l'intervento per sintomo](#intervento-per-sintomo).
- **Se MongoDB si corrompe: copiare prima lo stato da parte, e solo dopo tentare il
  recupero.** La ricreazione a vuoto perde i dati
  dell’evento ed è l’ultima scelta: seguire [Recupero dei dati](#recupero-dei-dati).
- Non usare gli script di pulizia dello sviluppo durante l’esercizio: i
  [modi di cleanup](../scripts/README.md#pulizia-e-reinstallazione) possono
  eliminare dati e risorse di altri progetti. Evitare `--volumes` nelle operazioni
  ordinarie di produzione. `docker stack rm` non tocca
  i volumi nominati; `docker compose down -v` li distrugge.

---

### 9. Chiusura di una giornata

1. Esportare i dati e **prelevarli fuori dalla macchina**: è la copia fuori host
   prevista per ogni giornata di apertura.
2. Verificare che l'archivio prelevato si apra e contenga quanto atteso.
3. Registrare la durata dell'esportazione per pianificare le chiusure successive.

---

### 10. Dismissione

1. Esportazione finale, prelievo, **verifica di leggibilità prima di distruggere
   qualunque cosa**.
2. Confronto fra ciò che è stato prelevato e ciò che serve per le conclusioni: quante
   partite, quanto lunghe, dove si sono fermate, quanti sono arrivati dal QR senza
   giocare. Completare la raccolta prima di cancellare i dati.
3. Distruzione dei dati sulla macchina e dismissione.
4. Revoca delle credenziali che restano valide altrove: chiave di ping della
   sorveglianza, credenziali del registrar, accessi al fornitore.
5. Stabilire se mantenere il dominio, rinnovarlo o impostare un redirect
   per i collegamenti presenti sul materiale stampato.

---

## Intervento per sintomo

### Primi trenta secondi

Eseguire questi tre controlli nell’ordine indicato.

```bash
sudo bash -c '. /etc/stack-deploy.env; : "${STACK_NAME:=pi}"; docker stack services "$STACK_NAME"; docker stack ps "$STACK_NAME" --no-trunc --filter desired-state=running'
sudo bash -c '. /etc/stack-deploy.env; curl -sk -o /dev/null -w "%{http_code}\n" --resolve "$APP_HOST:443:127.0.0.1" "https://$APP_HOST/health"'
journalctl -u stack-deploy.service -u fleet-bootstrap.service -n 50 --no-pager
```

La richiesta di salute passa dal proxy sul nome pubblico, risolto sulla macchina
stessa: con `sniStrict` attivo un handshake per `localhost` viene rifiutato, e
l'entrypoint in chiaro reindirizza ogni richiesta. `-k` perché qui interessa che il
backend risponda, non il certificato, che ha un controllo proprio.

Lo stato dei servizi orienta la diagnosi:

- **Repliche disponibili a zero con almeno una replica richiesta**: task non
  avviato o non schedulato; leggere la motivazione in `docker service ps`.
- **Repliche a uno ma servizio che non risponde**: controllare i log del processo.

Se serve una raccolta completa da portare via prima di toccare altro:

```bash
sudo bash -c '. /etc/stack-deploy.env; : "${STACK_NAME:=pi}"; export STACK_NAME; /usr/local/bin/diagnostic-bundle.sh'    # scrive in /srv/diagnostics
```

---

### Il sito non risponde

**1. Lo stack è su?**

```bash
docker stack ls
sudo bash -c '. /etc/stack-deploy.env; : "${STACK_NAME:=pi}"; docker stack services "$STACK_NAME"; docker stack ps "$STACK_NAME" --no-trunc --filter desired-state=running'
```

Se lo stack non c'è, riapplicalo. È idempotente e non tocca i volumi:

```bash
sudo systemctl restart stack-deploy.service
journalctl -u stack-deploy.service -n 50 --no-pager
```

`restart` e non `start`: l'unità è `oneshot` con `RemainAfterExit`, quindi dopo
il primo avvio resta attiva, e su un'unità attiva `start` non esegue nulla senza
segnalarlo. `start` vale solo per il primo avvio. Il riavvio riesegue anche
`fleet-bootstrap.service`, che dipende da questa unità ed è idempotente, anche
quando il deploy riesce solo al tentativo automatico successivo. Non lanciare un
secondo `restart` prima che il primo abbia finito: fallisce con `update out of
sequence` e l'unità riprova dopo 20 secondi.

Il deploy rifiuta immagini senza digest e secret assenti o vuoti prima
dell’applicazione dello stack. Dopo l’avvio, verificare comunque la convergenza
dei servizi: un errore successivo può lasciare un aggiornamento incompleto.

**2. Il proxy è su ma il resto no?**

```bash
sudo bash -c '. /etc/stack-deploy.env; : "${STACK_NAME:=pi}"; docker service ps "${STACK_NAME}_proxy" --no-trunc'
sudo bash -c '. /etc/stack-deploy.env; : "${STACK_NAME:=pi}"; docker service logs "${STACK_NAME}_proxy" --tail 100'
```

Con `proxy` a `1/1` e nessuna replica backend disponibile, il proxy può
rispondere con errori del servizio a valle.

**3. Un servizio resta a `0/1`.**

```bash
sudo bash -c '. /etc/stack-deploy.env; : "${STACK_NAME:=pi}"; docker service ps "${STACK_NAME}_$1" --no-trunc' _ '<servizio>'
```

La colonna dell'errore dice la causa senza bisogno di leggere i log. I rifiuti
più comuni sono un montaggio la cui sorgente non esiste sull'host e un limite
di memoria insufficiente per il processo.

**4. Riavvio mirato di un servizio.** Non rimuovere lo stack: forza la
riprogrammazione del solo servizio interessato.

```bash
sudo bash -c '. /etc/stack-deploy.env; : "${STACK_NAME:=pi}"; docker service update --force "${STACK_NAME}_$1"' _ '<servizio>'
```

---

### Le dashboard sono vuote o irraggiungibili

**Credenziale rifiutata di continuo (richiesta che non si chiude).** È il
sintomo del disallineamento fra il bordo e Kibana: il bordo accetta la
credenziale e la lascia passare, Kibana non la conosce e la respinge. Le utenze
devono esistere su entrambi i lati con la **stessa password**.

```bash
sudo cut -d: -f1 secrets/dashboard_users_esercizio secrets/dashboard_users_evento
sudo systemctl restart fleet-bootstrap.service   # ricrea le utenze via Terraform
```

Gli elenchi htpasswd contengono impronte e non password: il disallineamento non
è rilevabile confrontando i file, si verifica solo tentando un accesso reale.

**Dashboard raggiungibili ma senza dati.** Nell'ordine: il cluster è
interrogabile, l'ingestione è viva, la data view corrisponde a indici che
esistono.

```bash
sudo bash -c '. /etc/stack-deploy.env; : "${STACK_NAME:=pi}"; export APP_HOST STACK_NAME; ./ci/stack-verify.sh'
```

**Gli agenti non risultano registrati.** Il bootstrap è idempotente e si può
rieseguire a ogni avvio. Come per il deploy, `restart` e non `start`: anche questa
unità è `oneshot` con `RemainAfterExit`, e una volta attiva `start` non la
riesegue.

```bash
sudo systemctl restart fleet-bootstrap.service
journalctl -u fleet-bootstrap.service -n 80 --no-pager
```

Gli agenti escono e vengono rischedulati finché il token non compare sul volume
condiviso.

---

### Il disco si riempie

Il battito segnala l'occupazione oltre l'**85%** su ciascun punto di mount
sorvegliato, con la classe `host-resources`.

```bash
df -h / /var /srv/docker /srv/data/elastic /srv/backup /srv/export /srv/diagnostics
docker system df
lvs                      # occupazione copy-on-write degli snapshot
```

Uno snapshot LVM che esaurisce il proprio spazio copy-on-write viene invalidato
dal kernel: **resta elencato e non è più ripristinabile**. Se ne trovi uno in
quello stato, va rimosso, e la copia che rappresentava non esiste più.

Recupero rapido, dal meno al più invasivo:

```bash
docker image prune -f            # livelli non referenziati
journalctl --vacuum-size=200M    # journal persistente
```

La ritenzione degli indici è governata dalla configurazione dello stack e si
applica da sola: non cancellare indici a mano durante l'esercizio, perché il
recupero è modesto e la perdita è definitiva.

**Estensione del volume degli indici.** Verificare il volume logico che ospita
`/srv/data/elastic` e lo spazio libero nel relativo volume group. Riservare
prima lo spazio per gli snapshot previsti da `SNAP_SIZE` e `SNAP_KEEP` in
`/etc/stack-data.env`. Dimensionare l'incremento sul carico osservato.

```bash
findmnt -no SOURCE,FSTYPE /srv/data/elastic
sudo vgs -o vg_name,vg_free
sudo lvs -o vg_name,lv_name,lv_size,data_percent
# Dopo aver verificato percorso, spazio e supporto del filesystem:
sudo lvextend -r -L '+<incremento>' '/dev/<volume-group>/<volume-elastic>'
df -h /srv/data/elastic
```

---

### Pressione di memoria

Il battito segnala memoria disponibile sotto il **15%**, swap in uso oltre il
**50%**, e ogni terminazione per esaurimento di memoria avvenuta dall'ultimo
controllo.

```bash
free -h
docker stats --no-stream
grep oom_kill /proc/vmstat
```

Le terminazioni sono contate come **variazione** e non come valore assoluto:
vengono segnalate anche se al momento del controllo la memoria è già tornata
disponibile.

Per un servizio terminato ripetutamente per memoria, verificare consumo e limite
configurato. Prima di alzare il limite, controllare che il totale resti entro
la memoria disponibile sulla macchina.

---

### Nessun allarme da troppo tempo

Verificare il percorso di notifica anche in assenza di guasti segnalati.

Due battiti allarmano sul silenzio: quello del servizio, a cinque minuti, e quello
del recapito allarmi, a dieci. I relay hanno periodo di un anno e non scendono mai
da soli, solo su un segnale esplicito. Quindi un relay morto e uno che non ha nulla
da segnalare sono indistinguibili, ed è il motivo per cui il recapito ha un battito
proprio.

```bash
systemctl list-timers 'stack-heartbeat*' 'alert-notifier*' 'backup-nightly*'
journalctl -u stack-heartbeat.service -n 30 --no-pager
journalctl -u alert-notifier.service -n 30 --no-pager
```

Il battito parte solo se i controlli locali passano. Se il timer è attivo ma
il battito manca, leggere nei log l'elenco dei controlli falliti.

Per gli slug, le cadenze e le tolleranze consultare la tabella
[degli otto check](../provisioning/README.md#gli-otto-check-da-creare-sul-pannello).
Per provare segnale e rientro usare il [drill delle notifiche](#controlli-esterni-e-notifiche).

---

### Recupero dei dati

**Il ripristino sostituisce le collezioni presenti nell’archivio; la ricreazione
elimina l’intero database.** Verificare
`STACK_NAME`, `MONGO_VOLUME` e `MONGO_DB` in `/etc/stack-data.env` prima di procedere.
Lo script richiede conferma per entrambe le operazioni distruttive.

#### 1. Mettere in sicurezza lo stato corrente

```bash
sudo data-restore.sh --metti-in-sicurezza
```

Eseguire questo passo prima di ogni tentativo di recupero, anche se `mongod`
non parte. Conservare l'archivio e il percorso restituito. La copia legge il
volume senza fermare le scritture: è materiale da conservare per la diagnosi,
non una garanzia di backup consistente con MongoDB ancora attivo. Se fallisce,
fermarsi e preservare il volume prima di un'operazione distruttiva.

#### 2. Scegliere una sola operazione

**A. Ripristinare una copia leggibile**, verificando prima somme, data e perdita
di dati accettabile rispetto all'ultima copia:

```bash
sudo data-restore.sh --ripristina '/srv/backup/mongodump/<marca-temporale>/mongo/game_db.archive.gz'
```

Lo script ferma le repliche del backend, esegue `mongorestore --drop`, ripristina
le repliche precedenti e verifica gli indici TTL di `sessions` e `game_states`.
Se il ripristino fallisce, lascia il backend fermo per evitare nuove scritture.

**B. Ricreare a vuoto**, solo se il recupero da copia non è praticabile e la
perdita dei dati è stata accettata:

```bash
sudo data-restore.sh --ricrea
```

Su Swarm, con repliche backend precedenti maggiori di zero, lo script elimina
il database e ripristina quelle repliche, poi verifica gli indici TTL ricreati
dal backend. **Non eseguire B dopo un ripristino riuscito:**
cancellerebbe i dati appena recuperati. Fuori da Swarm il riavvio e la verifica TTL sono manuali; dopo la ricreazione
lo script stampa un avviso. Con backend già a zero repliche non verifica i TTL:
riattivare il servizio e controllare gli indici prima di riaprire.

#### 3. Verificare e fermarsi

Controllare l'esito del comando, `/health`, le repliche del backend e una
partita di prova. Se il comando o la verifica falliscono, leggere i log e
conservare la copia di sicurezza: non passare automaticamente alla ricreazione.
Misurare i tempi su una macchina di prova prima dell'evento con
`make restore-drill`; dipendono da dimensione dei dati e ambiente.

Gli export si producono e si prelevano con la [procedura dedicata](#esportazione-dei-dati).

---

### Cambiare un secret

I file in `secrets/` si modificano sulla macchina, poi si riapplica lo stack con
`sudo systemctl restart stack-deploy.service`. Il nome di ogni secret porta
l'impronta del contenuto: un file cambiato diventa un secret nuovo, e vengono
aggiornati solo i servizi che lo montano. Non tutti i valori però vivono solo nel
file.

| Secret | Come si cambia |
|---|---|
| `dashboard_users*` | con `sudo provisioning/bin/configure-dashboard-users.py secrets`: crea gli htpasswd mancanti o verifica le password di quelli esistenti e genera `dashboard_users.tfvars.json`. Per ruotare una password, sostituire prima la voce bcrypt con `sudo htpasswd -B <file-della-platea> <utente>` (password richiesta senza eco), poi usare lo strumento per riallineare la fonte e l’elenco comune; rieseguire deploy e bootstrap |
| `redis_password` | nel file: Redis ricostruisce le utenze all'avvio, il backend l'indirizzo, e lo stesso deploy riavvia entrambi |
| `apm_secret_token`, `filebeat_writer_password` | nel file, poi `sudo systemctl restart fleet-bootstrap.service`, che porta lo stesso valore nella policy Fleet o nell'utenza di Elasticsearch |
| `kibana_system_password` | nel file: il job `setup` monta lo stesso secret e viene rieseguito a ogni deploy, quindi reimposta la password in Elasticsearch; Kibana, aggiornato dallo stesso deploy, si autentica appena la password è impostata |
| `crowdsec_bouncer_key` | prima si rimuove il bouncer (`cscli bouncers delete key_traefik` nel contenitore di crowdsec), poi si cambia il file: il motore registra la chiave all'avvio solo se il bouncer non esiste già |
| `elastic_password`, `mongo_root_password` | prima nel servizio, poi nel file: Elasticsearch e MongoDB leggono il file solo alla prima inizializzazione |
| `kibana_encryption_key` | non si cambia: cifra i saved object esistenti, che con una chiave nuova diventano illeggibili |
| `gameplay_id_salt` | non si cambia durante l'esercizio: le partite in corso cambierebbero identificativo |
| `pow_secret` | nel file: smettono di valere solo le sfide a prova di lavoro già emesse, che durano 5 minuti |

---

### Da non fare

- **Non rimuovere lo stack** per riparare un singolo servizio. `docker service
  update --force` riprogramma quello che serve senza fermare il resto.
- **Non cancellare i volumi** insieme allo stack. `sudo docker stack rm pi` li
  lascia intatti; rimuoverli è irreversibile e i dati di una finestra di
  esercizio non sono ricostruibili.
- **Non ricreare a vuoto** prima di aver messo in sicurezza lo stato corrotto.
- **Non abbassare i limiti di memoria** senza misurare il consumo dei servizi
  e verificare il margine disponibile per ciascuno.
- **Non allegare lo stato di Terraform** a una segnalazione: contiene in chiaro
  tutti i valori dichiarati sensibili, password delle utenze comprese.

---

## Verifiche esterne e superficie pubblica

Gli indirizzi seguenti si usano dopo aver configurato `APP_HOST` e riattivato il servizio.

### Superficie pubblica

| Funzione | Indirizzo | Esito atteso |
|---|---|---|
| Home e ingresso al gioco | `https://<APP_HOST>/` | pagina bilingue, link “Gioca ora” e galleria |
| Gioco | `https://<APP_HOST>/play` | scelta privacy, poi caricamento del gioco su desktop |
| Salute applicativa | `https://<APP_HOST>/health` | HTTP 200 e JSON con `server`, `mongodb` e `redis` a `true` |
| Informativa privacy | `https://<APP_HOST>/privacy` | pagina statica in italiano e inglese |
| Accessibilità | `https://<APP_HOST>/accessibility` | dichiarazione e contatti del progetto |
| Indicizzazione | `https://<APP_HOST>/robots.txt` e `https://<APP_HOST>/sitemap.xml` | file testuali |

Verifica rapida, esclusivamente in lettura:

```bash
curl --fail --silent --show-error 'https://<APP_HOST>/health'
curl --fail --head 'https://<APP_HOST>/robots.txt'
curl --fail --head 'https://<APP_HOST>/sitemap.xml'
```

### Dashboard

Le dashboard sono in sola lettura e separate per pubblico. L’autenticazione è
HTTP Basic; la stessa credenziale viene poi verificata da Kibana e può accedere
soltanto allo Space assegnato.

#### Esercizio

- [Servizio e funnel](https://<APP_HOST>/osservabilita/s/esercizio/app/dashboards#/view/esercizio-servizio-funnel): richieste e codici HTTP, latenza APM, telemetria RUM, log ed errori applicativi, funnel di gioco.
- [Salute e risorse](https://<APP_HOST>/osservabilita/s/esercizio/app/dashboards#/view/esercizio-salute-risorse): allarmi, CPU e memoria di host e container, filesystem ed esiti degli healthcheck Docker.
- [Latenza ed errori](https://<APP_HOST>/osservabilita/s/esercizio/app/dashboards#/view/esercizio-latenza-errori): latenza media e massima nel tempo, confronto fra transazioni ed errori per azione, dataset e intervallo.

La platea di esercizio dispone anche di **Discover** per consultare i documenti
tecnici non aggregati quando un pannello non basta a spiegare un’anomalia.

#### Evento

- [Andamento dell’evento](https://<APP_HOST>/osservabilita/s/evento/app/dashboards#/view/evento-andamento): partite iniziate (`game_started`), concluse e azzerate, durata mediana, andamento nel tempo, motivi di conclusione, scene finali, checkpoint raggiunti per partita, percorso dei giocatori per tappa e classi di dispositivo.
- [Impatto dell’evento](https://<APP_HOST>/osservabilita/s/evento/app/dashboards#/view/evento-impatto): partite totali, sessioni create, partite iniziate e completate, partite con RUM, tempo mediano di gioco, tasso di completamento e tempo per finire il gioco.

Il numero di documenti del data stream non coincide con il numero di partite:
ogni documento è un fatto (creazione, checkpoint, cambio scena o conclusione).
Con la telemetria facoltativa un click su **Play** produce tre fatti iniziali: una
`sessione_iniziata`, un `checkpoint_raggiunto` per `game_started` e una
`partita_avviata`; se il browser aveva già una sessione, prima registra una
`partita_azzerata` sulla partita precedente. I riquadri “Partite totali”, “Sessioni create”, “Partite
iniziate” e “Partite completate” filtrano invece il singolo evento corrispondente e
devono crescere di una sola unità per partita. “Partite iniziate” ha la stessa
definizione (`game_started`) nelle due dashboard.

Lo Space evento offre anche **Discover** sui soli fatti di gioco, per consultare
i documenti non aggregati. Non espone log tecnici, indirizzi, cookie o token di sessione.
Solo “Partite totali” conta tutte le partite avviate, anche senza consenso: è un
conteggio anonimo, senza identificativo di partita né dispositivo. Tutti gli altri dati
esistono soltanto per le partite per cui il visitatore ha scelto la telemetria
facoltativa. Considerare il consenso quando si confrontano i totali.

#### Credenziali

Le credenziali della platea tecnica proteggono anche il prelievo degli export.
Per creazione, allineamento e custodia dei file consultare il
[modulo Elastic](../terraform/elk/README.md#corrispondenza-fra-utenze-terraform-ed-elenchi-htpasswd).
Per la rotazione seguire [Cambiare un secret](#cambiare-un-secret).

### Esportazione dei dati

L'operatore avvia l'export dalla macchina:

```bash
sudo systemctl start data-export.service
sudo journalctl -u data-export.service -n 80 --no-pager
```

Ogni esecuzione crea `/srv/export/<marca-temporale>/` con:

- `MANIFEST.txt`, sorgenti, conteggi, tempi ed esito;
- `SHA256SUMS`, somme per verificare l’integrità dopo il trasferimento;
- `elastic/*.ndjson.gz`, documenti Elastic completi;
- `mongo/game_db.archive.gz`, stato nativo ripristinabile con `mongorestore`.

Il servizio web consente soltanto `GET` e `HEAD`, non elenca directory e non
può avviare nuove esportazioni. Il nome esatto del file si legge dal manifesto.
Il prelievo usa la stessa credenziale della dashboard di esercizio:

```bash
curl --fail --user '<utente-esercizio>' \
  --output dati.ndjson.gz \
  'https://<APP_HOST>/export/<marca-temporale>/elastic/<nome>.ndjson.gz'
```

Con il solo nome utente `curl` chiede la password senza mostrarla e senza
lasciarla nella cronologia della shell; funziona allo stesso modo in bash e zsh.

La radice `/export` risponde `404`, anche dopo
l’autenticazione: l’assenza di directory listing evita di esporre struttura e
cadenza degli archivi.

### Controlli esterni e notifiche

Slug, schedule e tolleranze sono definiti nel
[provisioning](../provisioning/README.md#gli-otto-check-da-creare-sul-pannello).
I battiti allarmano sul silenzio; i relay segnalano la transizione di guasto e
il rientro. La copia notturna segue il calendario dell'host.

I recapiti sono in `/etc/stack-surveillance.env`, root-only. La chiave di ping
equivale a tutti gli endpoint e non deve comparire in documentazione, shell
history o log. Un test controllato invia prima `/fail` e poi il rientro al
medesimo check; non modifica DNS, challenge ACME, certificati o HSTS.

Il ciclo completo, con messaggi `x/8` e rientro di sicurezza anche in caso di
interruzione, è disponibile sulla macchina:

```bash
cd /srv/progetti_innovativi
sudo FORCE=1 ./provisioning/bin/healthchecks-drill.sh
```

### Diagnostica dalla macchina

Questi comandi sono in sola lettura e non costruiscono immagini:

```bash
cd /srv/progetti_innovativi
sudo bash -c '. /etc/stack-deploy.env; : "${STACK_NAME:=pi}"; docker stack services "$STACK_NAME"; docker stack ps "$STACK_NAME" --no-trunc --filter desired-state=running'
sudo systemctl status stack-heartbeat.timer alert-notifier.timer \
  backup-nightly.timer traefik-logrotate.timer
sudo journalctl -u stack-heartbeat.service -u alert-notifier.service --since today
sudo journalctl -u backup-nightly.service --since today
```

La verifica end-to-end completa, sulla macchina di produzione che non richiede
`make`, è:

```bash
cd /srv/progetti_innovativi
sudo bash -c '. /etc/stack-deploy.env; : "${STACK_NAME:=pi}"; export APP_HOST STACK_NAME; ./ci/stack-verify.sh'
```

Eseguita come root, legge la prima utenza tecnica dalla fonte root-only senza
stampare la password. Altrove richiede `DASHBOARD_USER` e `DASHBOARD_PASSWORD`
nell’ambiente; non vanno mai passate come argomenti o scritte nella cronologia.

## Riferimenti

| Dove | Che cosa contiene |
|---|---|
| [ARCHITETTURA.md](ARCHITETTURA.md) | com'è fatto il sistema e perché |
| [SVILUPPO.md](SVILUPPO.md) | avvio in locale |
| `make help` | elenco completo dei comandi, generato dai target |
| [provisioning/README.md](../provisioning/README.md) | installazione, unità systemd, sorveglianza, dati |
| [terraform/README.md](../terraform/README.md) | stato di Terraform: dove risiede, come si ricostruisce |
| [terraform/elk/README.md](../terraform/elk/README.md) | Space, ruoli, utenze, dashboard versionate |
| `/srv/diagnostics` | raccolte diagnostiche, prodotte anche allo spegnimento |
