# Runbook

Procedure di intervento sul servizio in esercizio. Organizzato per **sintomo
osservabile**, non per componente: chi interviene vede un guasto, non sa ancora
quale pezzo lo ha causato.

Scritto per essere usato da chi non lo ha scritto. Ogni voce riporta il comando
che diagnostica e quello che ripara, senza presupporre di ricordare a memoria
nomi di rete, di volume o di servizio.

Tutti i comandi si eseguono dalla radice del repository sulla macchina, salvo
dove indicato. `STACK_NAME` vale `pi` se non diversamente configurato in
`/etc/stack-deploy.env`.

---

## Primi trenta secondi

Prima di qualsiasi ipotesi, questi tre comandi in quest'ordine.

```bash
make stack-status      # servizi, repliche, task non in esecuzione
curl -sk -o /dev/null -w '%{http_code}\n' https://localhost/health
journalctl -u stack-deploy.service -u fleet-bootstrap.service -n 50 --no-pager
```

`make stack-status` distingue subito le due situazioni che richiedono risposte
opposte: **repliche a zero** significa che l'orchestratore non riesce a piazzare
o avviare un task, e la causa e' nella sua motivazione di rifiuto; **repliche a
uno ma servizio che non risponde** significa che il processo gira e il problema
e' dentro, quindi si guardano i log.

Se serve una raccolta completa da portare via prima di toccare altro:

```bash
sudo /usr/local/bin/diagnostic-bundle.sh    # scrive in /srv/diagnostics
```

---

## Il sito non risponde

**1. Lo stack e' su?**

```bash
docker stack ls
make stack-status
```

Se lo stack non c'e', riapplicalo. E' idempotente e non tocca i volumi:

```bash
sudo systemctl start stack-deploy.service
journalctl -u stack-deploy.service -n 50 --no-pager
```

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
sudo systemctl start fleet-bootstrap.service   # ricrea le utenze via Terraform
```

Gli elenchi htpasswd contengono impronte e non password: il disallineamento non
e' rilevabile confrontando i file, si verifica solo tentando un accesso reale.

**Dashboard raggiungibili ma senza dati.** Nell'ordine: il cluster e'
interrogabile, l'ingestione e' viva, la data view corrisponde a indici che
esistono davvero.

```bash
make stack-verify        # controlli end-to-end, si ferma al primo che cede
```

**Gli agenti non risultano registrati.** Il bootstrap e' idempotente e si puo'
rieseguire a ogni avvio.

```bash
sudo systemctl start fleet-bootstrap.service
journalctl -u fleet-bootstrap.service -n 80 --no-pager
```

Gli agenti escono e vengono rischedulati finche' il token non compare sul volume
condiviso: lo stack converge da solo, non serve un avvio in due fasi.

---

## Il disco si riempie

Il battito segnala l'occupazione oltre l'**85%** su ciascun punto di mount
sorvegliato, con la classe `host-resources`.

```bash
df -h /srv/docker /srv/diagnostics /
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

Il battito e' un dead man's switch a **cinque minuti**: e' l'unico controllo che
allarma sul silenzio. I quattro relay per classe hanno periodo di un anno e non
scendono mai da soli, solo su un segnale esplicito.

```bash
systemctl list-timers 'stack-heartbeat*' 'alert-notifier*' 'backup-nightly*'
journalctl -u stack-heartbeat.service -n 30 --no-pager
journalctl -u alert-notifier.service -n 30 --no-pager
```

Il battito parte **solo se i controlli locali passano**. Un timer attivo e un
battito assente non sono in contraddizione: significa che un controllo locale
sta fallendo, e lo script allega l'elenco di quali.

Le cinque classi di guasto sono separate perche' le notifiche dipendono dalla
transizione di stato: su una destinazione unica, un secondo guasto che arriva
mentre il primo e' ancora aperto non produrrebbe alcuna notifica.

| Classe | Sorgente | Che cosa rappresenta |
|---|---|---|
| `stack-liveness` | battito | il servizio risponde e sa servire |
| `app-degradation` | regole Kibana | tasso di errori, latenza |
| `host-resources` | controlli locali | memoria, swap, disco, terminazioni |
| `observability` | controlli locali e regole | cluster interrogabile, ingestione viva |
| `security` | regole Kibana | attivita' anomala oltre soglia |

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
make data-restore MODO=sicurezza
make data-restore MODO=ripristino ARCHIVIO=/srv/backup/<archivio>
make data-restore MODO=ricreazione
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

## Da non fare

- **Non rimuovere lo stack** per riparare un singolo servizio. `docker service
  update --force` riprogramma quello che serve senza fermare il resto.
- **Non cancellare i volumi** insieme allo stack. `make stack-remove` li lascia
  intatti di proposito; rimuoverli e' irreversibile e i dati di una finestra di
  esercizio non sono ricostruibili.
- **Non ricreare a vuoto** prima di aver messo in sicurezza lo stato corrotto.
- **Non abbassare i limiti di memoria** per far entrare un servizio in piu':
  sposta il guasto invece di risolverlo, e lo sposta su un componente diverso da
  quello che stavi guardando.
- **Non allegare lo stato di Terraform** a una segnalazione: contiene in chiaro
  tutti i valori dichiarati sensibili, password delle utenze comprese.

---

## Riferimenti

| Dove | Che cosa contiene |
|---|---|
| `make help` | elenco completo dei comandi, generato dai target |
| `provisioning/README.md` | installazione, unita' systemd, sorveglianza, dati |
| `terraform/README.md` | stato di Terraform: dove risiede, come si ricostruisce |
| `terraform/elk/README.md` | Space, ruoli, utenze, dashboard versionate |
| `/srv/diagnostics` | raccolte diagnostiche, prodotte anche allo spegnimento |
