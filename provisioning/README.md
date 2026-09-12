# Provisioning dell'host

Configurazione del sistema operativo su cui gira lo stack: separazione dei
filesystem, persistenza dei log e raccolta diagnostica.

## Perche' filesystem separati

Log e dati dei container crescono senza un limite naturale. Se condividono il
filesystem di sistema, il loro riempimento rende la macchina non gestibile:
non si scrive piu' nulla, incluso quanto servirebbe a capire cosa e' successo.

Elasticsearch aggiunge una soglia propria: al 95% di occupazione del disco
impone agli indici il blocco in sola lettura, e rimuoverlo richiede un
intervento manuale.

La separazione limita entrambi gli effetti a un volume che puo' riempirsi
senza portare giu' il sistema.

## Layout

| Volume | Punto di mount | Contenuto |
|---|---|---|
| sistema | `/` | Sistema operativo |
| `var` | `/var` | Journal persistente |
| `docker` | `/srv/docker` | Immagini, container, volumi con nome (MongoDB compreso), log dei container |
| `elastic` | `/srv/data/elastic` | Indici di Elasticsearch |
| `diagnostics` | `/srv/diagnostics` | Pacchetti diagnostici raccolti allo spegnimento |
| `backup` | `/srv/backup` | Archivi portabili della copia notturna |
| `export` | `/srv/export` | Archivi di esportazione, serviti su `/export` |

Il resto del volume group resta non allocato: e' lo spazio degli snapshot.

**Gli indici hanno un volume proprio.** Sono telemetria, deliberatamente non
protetta, e crescono con il traffico: sul volume dei dati Docker il loro
riempimento porterebbe giu' MongoDB. Il volume `esdata01` dello stack e' un
bind su questa directory (`ES_DATA_DIR` in `/etc/stack-deploy.env`), che
l'immagine di Elasticsearch scrive come uid 1000 e gid 0. La proprieta' va
assegnata con il volume montato, prima del primo deploy:

```bash
sudo chown 1000:0 /srv/data/elastic
sudo chmod 2770 /srv/data/elastic
```

`stack-deploy.sh` verifica esistenza e proprieta' prima di applicare lo stack e
si ferma con un messaggio se non corrispondono: senza, Elasticsearch non
scriverebbe e resterebbe in riavvio ciclico. Il controllo coglie anche un
volume non montato, perche' la directory sottostante resta di root.

**MongoDB resta sul volume `docker`.** Lo snapshot LVM copre un volume solo: con
MongoDB su un volume separato, la copia primaria dei dati non ricostruibili non
lo comprenderebbe.

**Creazione dei volumi.** Con un layout definito in fase di installazione i
volumi esistono gia' e `bin/setup-volumes.sh` **non va eseguito**: presuppone il
volume group `ubuntu-vg`, crea volumi con nomi e dimensioni propri e li
formatta. Serve solo su una macchina consegnata con il volume group quasi vuoto.

```bash
sudo ./bin/setup-volumes.sh            # mostra i comandi
sudo ./bin/setup-volumes.sh --apply    # li esegue
```

Lo script verifica che il volume group abbia spazio non allocato prima di
procedere. Un'installazione che assegna tutto lo spazio al volume di sistema
richiede di ridurre un filesystem in uso per essere corretta, quindi la
verifica va fatta prima di installare qualunque cosa.

## File di configurazione

| File | Destinazione |
|---|---|
| `docker/daemon.json` | `/etc/docker/daemon.json` |
| `systemd/journald.conf.d/10-persistent.conf` | `/etc/systemd/journald.conf.d/` |
| `systemd/diagnostic-bundle.service` | `/etc/systemd/system/` |
| `systemd/stack-deploy.service` | `/etc/systemd/system/` |
| `systemd/fleet-bootstrap.service` | `/etc/systemd/system/` |
| `systemd/stack-heartbeat.service`, `.timer` | `/etc/systemd/system/` |
| `systemd/alert-notifier.service`, `.timer` | `/etc/systemd/system/` |
| `systemd/data-export.service` | `/etc/systemd/system/` |
| `systemd/backup-nightly.service`, `.timer` | `/etc/systemd/system/` |
| `systemd/traefik-logrotate.service`, `.timer` | `/etc/systemd/system/` |
| `systemd/nic-offload@.service` | `/etc/systemd/system/`, istanziata sull'interfaccia |
| `systemd/docker-user-rules@.service` | `/etc/systemd/system/`, istanziata sull'interfaccia |
| `logrotate/traefik-access.conf` | `/etc/logrotate.traefik.conf` |
| `bin/*.sh`, `bin/*.py` | `/usr/local/bin/` |
| `systemd/stack-surveillance.env.example` | `/etc/stack-surveillance.env`, compilato e a `0600` |
| `systemd/stack-deploy.env.example` | `/etc/stack-deploy.env`, compilato e a `0600` |
| `systemd/stack-data.env.example` | `/etc/stack-data.env`, compilato e a `0600` |

```bash
sudo install -m 0644 docker/daemon.json /etc/docker/daemon.json
sudo install -m 0644 -D systemd/journald.conf.d/10-persistent.conf \
     /etc/systemd/journald.conf.d/10-persistent.conf
sudo install -m 0644 systemd/*.service systemd/*.timer /etc/systemd/system/
sudo install -m 0755 bin/*.sh bin/*.py /usr/local/bin/
sudo install -m 0644 logrotate/traefik-access.conf /etc/logrotate.traefik.conf

sudo systemctl restart systemd-journald
sudo systemctl daemon-reload
sudo systemctl enable diagnostic-bundle.service
sudo systemctl enable stack-deploy.service fleet-bootstrap.service
sudo systemctl enable --now stack-heartbeat.timer alert-notifier.timer \
     backup-nightly.timer traefik-logrotate.timer
sudo systemctl restart docker
```

`data-export.service` non viene abilitata: non ha timer e non deve partire da
sola, la avvia l'operatore.

## Rete dell'host

Due unita' template, parametrizzate sul nome dell'interfaccia pubblica
(`ip -br link`). I comandi di installazione sopra copiano unita' e script; le
istanze si abilitano a mano, perche' il nome dell'interfaccia dipende dalla
macchina.

**Nessuna delle due e' ancora stata provata sulla macchina di esercizio.** Sono
verificate la sintassi delle unita' (`systemd-analyze verify`) e l'applicazione
delle regole in un contenitore, non l'effetto sulla scheda ne' sul traffico
reale: le verifiche indicate sotto fanno parte dell'installazione.

**Segmentazione in hardware.** `nic-offload@.service` disattiva TSO e GSO. Serve
sulle schede Intel con driver `e1000e`, come la I219-LM, soggette sotto carico a
blocchi della coda di trasmissione (`Detected Hardware Unit Hang`); su altre
schede non va abilitata.

```bash
ethtool -i <interfaccia> | grep '^driver'      # atteso: e1000e
sudo systemctl enable --now nic-offload@<interfaccia>.service
ethtool -k <interfaccia> | grep -E '^(tcp-segmentation-offload|generic-segmentation-offload):'
```

Atteso: entrambe le voci a `off`, anche dopo un riavvio. Durante il load test
`dmesg | grep -i 'hardware unit hang'` deve restare vuoto.

**Firewall dei container.** Docker scavalca ufw: il traffico diretto alle porte
pubblicate viene tradotto e inoltrato, e non attraversa `INPUT`, dove vivono le
regole di ufw. `docker-user-rules@.service` riempie la catena `DOCKER-USER`: in
ingresso dall'interfaccia pubblica raggiungono i contenitori solo le porte 80 e
443 e le risposte alle connessioni stabilite, per IPv4 e IPv6. Il firewall
dell'host resta ufw (`docs/ESERCIZIO.md`, sezione 3). La catena esiste solo con
Docker installato, quindi l'unita' si abilita dopo il demone:

```bash
sudo systemctl enable --now docker-user-rules@<interfaccia>.service
sudo iptables -S DOCKER-USER
sudo ip6tables -S DOCKER-USER
```

Verifica con una porta di prova, interrogata da un'altra rete:

```bash
sudo docker run --rm -d --name prova-firewall -p 8080:80 nginx:alpine
curl -m 5 http://<indirizzo-pubblico>:8080/     # dall'esterno: deve andare in timeout
sudo docker stop prova-firewall
```

## Avvio non presidiato

Il primo giorno di apertura al pubblico non e' presidiato: tutto cio' che
richiede una persona per partire va considerato non funzionante quel giorno. La
macchina deve quindi portare in servizio lo stack da sola dopo un riavvio.

Tre passaggi, in ordine di dipendenza.

```bash
# 1. Secret. Idempotente: quelli gia' presenti non vengono toccati, perche'
#    rigenerarli invaliderebbe le credenziali con cui i servizi si sono
#    registrati. Il comando segnala separatamente le credenziali dashboard.
sudo ./bin/generate-secrets.sh /srv/progetti_innovativi/secrets

# 1b. Prima installazione: crea gli htpasswd e la fonte root-only di Terraform.
#     Se gli htpasswd esistono gia', chiede le password e le verifica senza
#     modificarli: serve a ricostruire la fonte mancante in modo sicuro.
sudo ./bin/configure-dashboard-users.py /srv/progetti_innovativi/secrets

# 2. Parametri del deploy: hostname, recapito per il certificato, immagini
#    riferite per digest.
sudo "${EDITOR:-vi}" /etc/stack-deploy.env

# 3. Da qui in poi il riavvio della macchina basta.
sudo systemctl start stack-deploy.service
```

`stack-deploy.service` applica `deploy/stack.yml` a ogni avvio. Il comando e'
idempotente, quindi rieseguirlo su uno stack gia' in servizio aggiorna soltanto
cio' che e' cambiato: il file dello stack resta la sola descrizione di cio' che
deve girare.

`start` vale per il primo avvio. Per riapplicare lo stack in seguito, dopo una
modifica a `/etc/stack-deploy.env` o al repository, il comando e'
`sudo systemctl restart stack-deploy.service`: l'unita' e' `oneshot` con
`RemainAfterExit`, quindi dopo il primo deploy resta attiva, e su un'unita'
attiva `start` non esegue nulla senza segnalarlo. Lo stesso vale per
`fleet-bootstrap.service`, che il riavvio del deploy riesegue da se'.

Lo swarm non va inizializzato a mano: lo script lo fa da se' se sul nodo non ne
esiste ancora uno. Non lo fa negli altri stati, perche' `pending` e `locked`
descrivono uno swarm che esiste ed e' in corso di ripristino, e inizializzarne
uno nuovo sopra scarterebbe servizi e secret gia' registrati: li' lo script
esce con errore e l'unita' riprova. Su una macchina con piu' indirizzi il
demone non ne sceglie uno da solo, e va indicato `SWARM_ADVERTISE_ADDR`.

Lo script rifiuta di procedere se un'immagine non e' ancorata per digest, se
un file di secret e' assente o vuoto, oppure se manca
`secrets/dashboard_users.tfvars.json`. Quest'ultimo e' la fonte root-only da
cui Terraform crea in Elasticsearch le stesse utenze presenti negli htpasswd:
senza, il bordo accetterebbe le credenziali ma Kibana le rifiuterebbe. Questi
controlli servono a far
fallire il deploy prima di iniziare, invece di lasciare lo stack applicato a
meta'.

`fleet-bootstrap.service` segue e registra le policy, riprovando finche' Kibana
non risponde. Non serve attendere: gli agenti escono e vengono rischedulati
finche' il token che li riguarda non compare sul volume condiviso, quindi lo
stack converge da solo con un solo deploy.

## Sorveglianza

Due percorsi distinti, perche' i due modi di guastarsi non sono osservabili
allo stesso modo.

**Degrado con macchina viva.** Le regole di Kibana depositano gli allarmi su un
indice: con licenza basic gli unici connettori disponibili sono `.index` e
`.server-log`, quindi la consegna verso l'esterno non e' compito delle regole.
`alert-notifier.sh` legge l'indice e recapita. Gira sulla macchina osservata, e
va bene: un allarme di degrado presuppone per definizione una macchina che
risponde.

**Macchina irraggiungibile o stack fermo.** `stack-heartbeat.sh` invia un
battito a un servizio esterno **solo se i controlli locali passano**. Un
battito inviato incondizionatamente dimostrerebbe che il timer funziona, non
che il servizio funziona. Il servizio esterno allarma sul silenzio, che e'
l'unico segnale possibile quando la macchina non e' in grado di parlare.

Quando i controlli falliscono con la macchina ancora viva, lo script non si
limita a tacere: segnala il guasto e allega l'elenco dei controlli falliti, che
resta leggibile nella cronologia del servizio. E' il primo indizio disponibile
senza accedere alla macchina.

### Un check per classe di guasto

Le notifiche del servizio esterno sono legate alla transizione di stato: un
secondo segnale di guasto, mentre il check e' gia' in guasto, non produce alcuna
notifica. Su una destinazione unica due guasti distinti collassano in un solo
messaggio, e del secondo non resta traccia utile.

Le classi sono quindi separate, e ciascuna transita per conto suo.

| Check | Sorgente | Che cosa rappresenta |
|---|---|---|
| `stack-liveness` | battito | il servizio risponde e sa servire |
| `app-degradation` | regole Kibana | tasso di errori, latenza |
| `host-resources` | controlli locali | memoria, swap, disco, terminazioni per memoria |
| `observability` | controlli locali e regole | cluster interrogabile, ingestione viva |
| `security` | regole Kibana | attivita' anomala oltre soglia |

I quattro relay hanno periodo di un anno: non scendono mai da soli, solo su un
segnale esplicito. Il battito e' invece un dead man's switch a cinque minuti, ed
e' l'unico che allarma sul silenzio.

Gli endpoint si costruiscono da una chiave di progetto e dallo slug del check,
`<base>/<chiave>/<slug>`, quindi la configurazione contiene un segreto solo
invece di cinque URL da tenere allineate.

Il livello di gravita' sceglie l'endpoint. `info` usa il suffisso di
registrazione, che conserva l'evento senza cambiare stato ne' notificare: e' il
livello dei fatti che vanno tenuti ma non svegliano nessuno, come i tentativi di
intrusione sotto soglia, che su un indirizzo pubblico sono rumore continuo.
`warning` e `critical` portano il check in guasto. Un documento di rientro
riporta il check in stato sano e lo riarma per l'allarme successivo.

I ping sui relay partono **solo sulle transizioni**. Lo storico di un check e'
limitato a cento eventi: un ping a ogni esecuzione lo riempirebbe di rumore
facendo scorrere via proprio gli allarmi.

L'alternativa era un bot dedicato interrogato direttamente dal notificatore.
Costava un secondo segreto da custodire e ruotare, e un secondo percorso da
verificare, in cambio di una distinzione fra i tipi di guasto che la separazione
in classi gia' fornisce.

### Configurazione

Il file contiene credenziali e non e' versionato. Il repository ne porta solo il
modello:

```bash
sudo install -m 0600 -o root -g root \
     systemd/stack-surveillance.env.example /etc/stack-surveillance.env
sudo "${EDITOR:-vi}" /etc/stack-surveillance.env
```

Un file unico per entrambe le unita': usano lo stesso endpoint e le stesse
credenziali del cluster, e tenerli separati esporrebbe al caso in cui una
rotazione ne aggiorna uno e dimentica l'altro.

Il battito legge anche `/etc/stack-deploy.env`, e solo per il nome pubblico:
interroga `/health` attraverso il proxy come un visitatore, con
`curl --resolve <APP_HOST>:443:127.0.0.1`. Un controllo su `localhost`
misurerebbe il proxy e non l'applicazione: l'entrypoint in chiaro reindirizza
qualunque richiesta, i router rispondono solo al nome pubblico e con `sniStrict`
un handshake per altri nomi viene rifiutato. Il certificato non viene
verificato, per non fallire con quello dell'autorita' di prova: la sua validita'
e' il controllo `tls-pubblico`.

La cadenza del battito deve restare piu' breve del periodo atteso configurato
sul servizio esterno. Con `OnUnitActiveSec=5min` il periodo va impostato a
cinque minuti e la tolleranza a quindici, cosi' che due battiti persi non
producano un allarme mentre un'assenza prolungata lo produce.

Al primo avvio, in assenza del marcatore, il recapito parte dall'istante
corrente: un indice gia' popolato produrrebbe altrimenti una raffica di
notifiche su eventi conclusi.

## Dati: esportazione, copia, ripristino

Lo stato per giocatore nasce da eventi pubblici non ripetibili. E' piccolo e di
breve durata, ma **non ricostruibile**: non esiste modo di rifarlo se va perso.
Ne discendono tre meccanismi distinti, che rispondono a domande diverse e non
si sostituiscono a vicenda.

| Meccanismo | Risponde a | Comando |
|---|---|---|
| Esportazione | i dati devono sopravvivere alla macchina | `data-export.sh` |
| Copia di sicurezza | i dati devono sopravvivere a un guasto | `data-backup.sh` |
| Ripristino | il servizio deve tornare su | `data-restore.sh` |

### Esportazione

Contenuto integrale in due formati, scelti per due esigenze diverse.

| Sorgente | Formato | Perche' |
|---|---|---|
| Elasticsearch | NDJSON compresso, uno per indice | conserva i campi annidati senza perdite, si rilegge da uno strumento di analisi o reindicizzando altrove |
| MongoDB | archivio nativo di `mongodump` | unico formato che riporta in vita lo stato di gioco con i tipi originali |

CSV e Parquet non vengono prodotti: sono derivabili dall'NDJSON a posteriori,
fuori dalla macchina, e aggiungerli qui sarebbe una dipendenza in piu' nella
catena che produce l'unica copia esistente.

Lo scorrimento degli indici usa **point-in-time e `search_after`**. Il
point-in-time congela l'insieme dei segmenti al momento dell'apertura, quindi
il risultato resta coerente mentre l'indice continua a ricevere documenti, che
e' la condizione normale quando l'esportazione parte durante un'apertura al
pubblico.

I flussi di dati sono risolti negli indici che li compongono. E' il caso di
tutto cio' che raccoglie Elastic Agent: quegli indici si chiamano `.ds-...` e
sono nascosti, e una risoluzione che non li raggiunga produrrebbe
un'esportazione vuota senza segnalare alcun errore. I file corrispondenti
vengono scritti **senza il punto iniziale**, altrimenti un `scp <dir>/*` al
momento del prelievo li salterebbe in silenzio portandosi via tutto tranne gli
archivi piu' grandi.

**L'attivazione non passa dal web.** Un'unita' `oneshot` avviata dall'operatore
produce gli archivi. Esporre un percorso HTTP che avvia un processo sulla
macchina sarebbe la superficie piu' pericolosa dell'intero sistema, e non
compra nulla che una connessione di amministrazione non dia gia'.

```bash
sudo systemctl start data-export.service
journalctl -u data-export.service -f
```

**Il freno.** L'esportazione resta possibile in qualsiasi momento, incluse le
finestre di apertura al pubblico. Scorrere l'intero dataset compete per cache e
banda di disco con la stessa Elasticsearch che sta ricevendo la telemetria,
quindi: esecuzione singola protetta da lock, priorita' di CPU e di I/O ridotte,
scorrimento a lotti con pausa fra l'uno e l'altro.

Su Elasticsearch la leva che conta e' **la cadenza dei lotti**, non la quota di
CPU del client: il lavoro pesante lo fa il cluster leggendo i segmenti. Le
priorita' dichiarate nell'unita' governano lo script, non il lavoro, perche' lo
scorrimento avviene dentro contenitori che appartengono al cgroup del demone
Docker. Il freno effettivo e' quindi espresso dallo script, con `LOTTO`,
`PAUSA`, `CPU_QUOTA` e la lettura sequenziale di `mongodump`.

**Prelievo dal bordo.** Gli archivi finiscono in `EXPORT_DEST` (`/srv/export`
per impostazione predefinita) e sono serviti su `/export` dal servizio `export`
dello stack: un nginx che monta quella directory **in sola lettura**, rifiuta i
metodi diversi da `GET` e `HEAD`, non elenca la directory e non espone alcun
percorso che avvii la produzione di un archivio. Il percorso di generazione e
quello di consegna restano separati.

L'accesso e' protetto dall'elenco `secrets/dashboard_users_esercizio`, lo stesso
della platea tecnica: gli archivi contengono i dati che quella platea gia'
consulta nelle dashboard di esercizio.

Non essendoci elenco, il nome dell'archivio va letto dal manifesto
dell'esportazione: la radice risponde `404` anche a chi si e' autenticato.

```bash
curl -u operatore --output esportazione.ndjson.gz \
  https://<hostname>/export/<marca-temporale>/elastic/<nome>.ndjson.gz
```

`EXPORT_DEST` deve valere lo stesso in `/etc/stack-data.env`, che governa la
scrittura, e in `/etc/stack-deploy.env`, che governa il montaggio. Se divergono,
l'esportazione scrive in un posto e il prelievo serve una directory vuota senza
segnalare nulla.

### Copia di sicurezza

Due meccanismi con ruoli distinti.

**Snapshot LVM, primario.** Cattura in un istante l'intero volume che ospita i
dati Docker, quindi MongoDB e gli altri volumi con nome, senza fermare le
scritture. Gli indici di Elasticsearch stanno su un volume proprio e non sono
compresi: cio' che di essi deve sopravvivere passa dall'esportazione.
Con il journaling attivo e file dati e journal sullo stesso volume,
uno snapshot a livello di volume cattura dati e journal come unita' singola e
al ripristino MongoDB rigioca il journal: **`fsyncLock` non serve** e non viene
eseguito, perche' bloccherebbe le scritture per tutta la durata della copia,
che e' esattamente cio' che si vuole evitare durante un'apertura.

Il motivo per cui lo snapshot precede `mongodump`: su un'istanza standalone
`mongodump` non ha consistenza point-in-time fra collezioni, perche' `--oplog`
richiede un replica set. Un dump preso durante le scritture puo' contenere una
sessione senza il relativo stato di gioco.

Lo snapshot richiede **spazio non allocato nel volume group**. Se tutto lo
spazio e' assegnato ai volumi, lo snapshot non e' creabile e la copia primaria
semplicemente non esiste: lo script lo dichiara
come guasto invece di proseguire in silenzio. Uno snapshot che esaurisce il
proprio spazio copy-on-write viene invalidato dal kernel, resta elencato e non
e' piu' ripristinabile, quindi `lvs` va letto e non presunto.

**`mongodump`, portabile.** Destinato al prelievo manuale a evento concluso: si
rilegge su un'altra macchina e su un'altra installazione, cosa che uno snapshot
non consente. E' l'unico dei due che costituisce un off-host reale, e dipende
dalla presenza di una persona.

Nessuno dei due copre la perdita della macchina. Un server dedicato non ha
snapshot del fornitore: la copertura e' il prelievo dell'archivio portabile e
delle esportazioni fuori dalla macchina, a fine giornata (`docs/ESERCIZIO.md`,
sezione 9). Nulla dipende da uno spazio remoto: se in seguito se ne aggiungera'
uno, la sincronizzazione sara' un passo in piu' dopo l'archivio, non un
prerequisito.

### I sei check da creare sul pannello

Nessun check viene creato da qui: l'accesso al pannello e' dell'operatore. Un
ping verso uno slug inesistente riceve 404 e **non crea nulla**, quindi un check
mancante non e' un check verde, e' un segnale che non arriva da nessuna parte.

| Slug | Schedule | Tolleranza | Chi lo alimenta |
|---|---|---|---|
| `stack-liveness` | 5 minuti | 15 minuti | battito, a ogni esecuzione riuscita |
| `host-resources` | 365 giorni | 1 ora | battito e regola sull'occupazione del disco |
| `observability` | 365 giorni | 1 ora | battito e regola sull'assenza di ingestione |
| `app-degradation` | 365 giorni | 1 ora | regole su tasso di errori e latenza |
| `security` | 365 giorni | 1 ora | regola sull'attivita' anomala dell'applicazione |
| `backup-nightly` | calendario | 1 ora | copia notturna, vedi sotto |

I quattro relay hanno periodo di un anno perche' non devono scendere da soli:
li porta in guasto solo un segnale esplicito, e li riarma il documento di
rientro. Solo il battito e la copia notturna hanno una cadenza attesa, ed e' su
quella che il servizio esterno allarma per silenzio.

### Check `backup-nightly`

Il timer esegue la copia alle 03:30. Questi sono i valori da impostare.

| Campo | Valore |
|---|---|
| Slug | `backup-nightly` |
| Tipo di schedule | calendario (cron) |
| Espressione | `30 3 * * *` |
| Fuso orario | `Europe/Rome` |
| Tolleranza | 1 ora |

Lo schedule del check e quello del timer devono indicare lo stesso orario e lo
stesso fuso, altrimenti il check allarmerebbe per un ritardo che non esiste:
verificare con `timedatectl` che l'host sia su `Europe/Rome`. La tolleranza di
un'ora copre l'attesa dell'archivio su un dataset cresciuto piu' del previsto
senza rendere il check inutile.

L'endpoint si costruisce come gli altri, `<base>/<chiave>/backup-nightly`, con
la stessa `HC_PING_KEY` gia' presente in `/etc/stack-surveillance.env`: un
secondo file la duplicherebbe, e una rotazione che ne aggiorna uno solo
lascerebbe un percorso muto senza che nulla lo segnali. Lo script manda il
suffisso di inizio prima di cominciare, cosi' il servizio misura la durata
dell'esecuzione e non solo la sua avvenuta conclusione.

Vale qui quanto detto per il battito: **l'URL di ping e' una credenziale**. Chi
la possiede puo' inviare esiti falsi e tenere spenta la sorveglianza su una
copia che non viene piu' prodotta.

### Ripristino

Quando la base dati si corrompe durante un'apertura, due obiettivi entrano in
conflitto: rimettere in piedi il servizio e salvare i dati. Le strade sono tre
e l'ordine non e' negoziabile.

```bash
# 1. Sempre per prima. Opera sul volume e non sul processo, quindi funziona
#    anche quando mongod non parte piu'.
sudo data-restore.sh --metti-in-sicurezza

# 2. Recupera i dati fino al momento della copia.
sudo data-restore.sh --ripristina /srv/backup/mongodump/<stamp>/mongo/game_db.archive.gz

# 3. Ultima scelta: la piu' rapida per tornare operativi, e distrugge cio' che
#    non e' stato messo al sicuro al passo 1.
sudo data-restore.sh --ricrea
```

Lo svuotamento porta via anche gli indici, che il backend crea all'avvio: dopo
una ricreazione il servizio applicativo va riavviato, altrimenti i documenti
nuovi nascerebbero senza indice di ritenzione e nulla lo segnalerebbe.

I tre tempi vanno misurati **prima** di doverli confrontare sotto pressione.
`make restore-drill` li misura su basi dati locali seminate con documenti nella
forma che il backend scrive davvero.

### Verifica

I tre percorsi si provano su MongoDB ed Elasticsearch veri, avviati per
l'occasione su una rete dedicata. Un'esportazione mai riletta e un ripristino
mai eseguito sono ipotesi, non procedure.

```bash
make export-drill    # esporta e rilegge quanto esportato
make backup-drill    # archivio portabile e forma degli endpoint di recapito
make restore-drill   # cronometra le tre strade
```

Le prove non si fermano alla presenza dei file: contano i documenti per indice,
verificano che gli identificatori siano distinti — uno scorrimento sbagliato
produrrebbe ripetizioni che il solo conteggio non distingue — e rileggono
l'archivio di MongoDB reinserendolo in una base dati separata, indice di
ritenzione compreso.

Restano fuori dalla prova automatica due cose, per ragioni di ambiente e non di
disegno: lo **snapshot LVM**, che richiede un volume group con spazio non
allocato, e il **certificato dell'autorita' privata** del cluster. Della prima
la prova copre il comportamento in assenza di LVM, che deve essere un guasto
dichiarato e non un successo silenzioso.

## Cosa copre e cosa no

Il journal persistente registra gli eventi mentre accadono, quindi sopravvive a
qualunque tipo di arresto: al riavvio contiene le terminazioni per esaurimento
di memoria e i panic del kernel.

La raccolta diagnostica allo spegnimento copre soltanto gli arresti ordinati:
riavvii pianificati, `systemctl reboot`, riavvii avviati da un aggiornamento
automatico. Interruzione di alimentazione, panic e reset hardware non lasciano
il tempo di eseguire nulla.

Ne segue che la fonte primaria e' la scrittura continua, non la raccolta finale.
Il pacchetto diagnostico aggiunge contesto aggregato quando c'e' il tempo di
produrlo, e non sostituisce il journal.

## Verifica

```bash
# Il journal sopravvive al riavvio
journalctl --list-boots

# Rotazione dei log dei container attiva
docker info --format '{{.LoggingDriver}}'
ls -la /srv/docker/containers/*/  | grep json.log

# La raccolta funziona anche fuori dallo spegnimento
sudo DIAGNOSTIC_DEST=/tmp/diag-test /usr/local/bin/diagnostic-bundle.sh
ls -la /tmp/diag-test/
```

## Nota su live-restore

`live-restore` mantiene i container in esecuzione durante un riavvio del demone,
ma non e' compatibile con i servizi in swarm mode e non e' quindi impostato in
`daemon.json`. In swarm mode la continuita' e' data dalla rischedulazione dei
task.
