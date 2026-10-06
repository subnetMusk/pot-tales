# Provisioning dell'host

Configurazione del sistema operativo su cui gira lo stack: separazione dei
filesystem, persistenza dei log e raccolta diagnostica.

I comandi di questa guida partono dalla directory `provisioning/` del repository,
salvo dove indicato. Il percorso operativo predefinito è `/srv/progetti_innovativi`.

```bash
cd /srv/progetti_innovativi/provisioning
```

Servono Ubuntu LTS, accesso amministrativo, Docker Engine con supporto Swarm,
Bash, Python 3, `apache2-utils` (per `htpasswd`), LVM2, `smartmontools`,
`ethtool`, `iptables`, `logrotate`, `curl` e `openssl`. Verificare mount e
accesso ai registry prima dell’installazione. La sequenza di accettazione è nel
[runbook](../docs/ESERCIZIO.md#momenti-pianificati).

## Separazione dei filesystem

Log e dati dei container crescono senza un limite naturale. Se condividono il
filesystem di sistema, possono esaurire lo spazio per log e operazioni dell'host.

Elasticsearch aggiunge una soglia propria: al 95% di occupazione del disco
blocca le scritture degli indici coinvolti. Il blocco viene rimosso
automaticamente quando l'occupazione scende sotto la soglia alta (90% per
default). Vedi le [soglie di Elasticsearch 8.19](https://www.elastic.co/guide/en/elasticsearch/reference/8.19/modules-cluster.html#disk-based-shard-allocation).

La separazione limita entrambi gli effetti a un volume che può riempirsi
senza portare giù il sistema.

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

Il resto del volume group resta non allocato: è lo spazio degli snapshot.

Gli indici Elasticsearch stanno su un volume separato per impedire che la loro
crescita esaurisca lo spazio di MongoDB. Si conservano tramite export. Il volume `esdata01` dello stack è un
bind su questa directory (`ES_DATA_DIR` in `/etc/stack-deploy.env`), che
l'immagine di Elasticsearch scrive come uid 1000 e gid 0. La proprietà va
assegnata con il volume montato, prima del primo deploy:

```bash
sudo chown 1000:0 /srv/data/elastic
sudo chmod 2770 /srv/data/elastic
```

`stack-deploy.sh` verifica esistenza e proprietà prima di applicare lo stack e
si ferma con un messaggio se non corrispondono: senza, Elasticsearch non
scriverebbe e resterebbe in riavvio ciclico. Il controllo coglie anche un
volume non montato, perché la directory sottostante resta di root.

**MongoDB resta sul volume `docker`.** Lo snapshot LVM copre un volume solo: con
MongoDB su un volume separato, la copia primaria dei dati non ricostruibili non
lo comprenderebbe.

**Creazione dei volumi.** Con un layout definito in fase di installazione i
volumi esistono già e `bin/setup-volumes.sh` **non va eseguito**: presuppone il
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
sudo systemctl enable --now diagnostic-bundle.service
sudo systemctl enable stack-deploy.service fleet-bootstrap.service
sudo systemctl enable stack-heartbeat.timer alert-notifier.timer \
     backup-nightly.timer traefik-logrotate.timer
sudo systemctl restart docker
```

I timer vengono abilitati al boot ma non avviati in questo passo. Prima del
primo riavvio installare e compilare i tre file di ambiente della tabella:

```bash
for nome in stack-deploy stack-surveillance stack-data; do
  # Prima installazione: non sovrascrivere una configurazione esistente.
  sudo test -e "/etc/$nome.env" || sudo install -m 0600 -o root -g root \
    "systemd/$nome.env.example" "/etc/$nome.env"
  sudo "${EDITOR:-vi}" "/etc/$nome.env"
done
```

Allineare nome dello stack, percorsi, volumi e credenziali; `EXPORT_DEST` deve
coincidere nei file dati e deploy. Configurare i check esterni e avviare i timer
solo dopo il deploy e la verifica del client persistente, come indicato sotto.

`data-export.service` non viene abilitata: non ha timer e non deve partire da
sola, la avvia l'operatore.

### Controllo completo su richiesta

`stack-checkup.sh` raccoglie in un solo comando le verifiche da fare dopo ogni rilascio
e alla vigilia di una giornata di apertura:

- unità systemd e timer;
- repliche dei servizi e immagini in esecuzione confrontate con `/etc/stack-deploy.env`;
- `/health`, redirect HTTP, accessi protetti, HSTS, emittente e scadenza del certificato;
- occupazione dei volumi e degli snapshot, spazio per il prossimo snapshot;
- esito della copia notturna, con verifica delle somme dell'ultimo dump;
- contatori SMART confrontati per seriale;
- la verifica end-to-end `ci/stack-verify.sh`.

Impostare `SMART_RIFERIMENTI` in `/etc/stack-data.env` con i seriali e i
contatori rilevati all’accettazione (`"SERIALE_A=0 SERIALE_B=0"`, sostituendo
i valori): i default dello script non si applicano a una macchina nuova.

È in sola lettura e non ha timer: la sorveglianza continua resta al battito e a
Healthchecks. L'uscita è 1 se almeno un controllo è in guasto.

```bash
sudo stack-checkup.sh            # completo, circa un minuto
sudo stack-checkup.sh --rapido   # senza ci/stack-verify.sh
```

## Rete dell'host

Due unità template, parametrizzate sul nome dell'interfaccia pubblica
(`ip -br link`). I comandi di installazione sopra copiano unità e script; le
istanze si abilitano a mano, perché il nome dell'interfaccia dipende dalla
macchina.

Verificare entrambe le unità sull'hardware e dalla rete esterna durante
l'installazione. La verifica della sintassi e delle regole in un contenitore
non prova l'effetto sulla scheda o sul traffico reale.

**Segmentazione in hardware.** `nic-offload@.service` disattiva TSO e GSO. Serve
sulle schede Intel con driver `e1000e`, come la I219-LM, soggette sotto carico a
blocchi della coda di trasmissione (`Detected Hardware Unit Hang`); su altre
schede non va abilitata.

```bash
ethtool -i '<interfaccia>' | grep '^driver'      # atteso: e1000e
sudo systemctl enable --now 'nic-offload@<interfaccia>.service'
ethtool -k '<interfaccia>' | grep -E '^(tcp-segmentation-offload|generic-segmentation-offload):'
```

Atteso: entrambe le voci a `off`, anche dopo un riavvio. Durante il load test
`dmesg | grep -i 'hardware unit hang'` deve restare vuoto.

**Firewall dei container.** Docker scavalca ufw: il traffico diretto alle porte
pubblicate viene tradotto e inoltrato, e non attraversa `INPUT`, dove vivono le
regole di ufw. `docker-user-rules@.service` riempie la catena `DOCKER-USER`: in
ingresso dall'interfaccia pubblica raggiungono i contenitori solo le porte 80 e
443 e le risposte alle connessioni stabilite, per IPv4 e IPv6. Il firewall
dell'host resta ufw ([Prerequisiti dell’host](../docs/ESERCIZIO.md#3-prerequisiti-dellhost)). La catena esiste solo con
Docker installato, quindi l'unità si abilita dopo il demone:

```bash
sudo systemctl enable --now 'docker-user-rules@<interfaccia>.service'
sudo iptables -S DOCKER-USER
sudo ip6tables -S DOCKER-USER
```

Verifica con una porta di prova, interrogata da un'altra rete:

```bash
sudo docker run --rm -d --name prova-firewall -p 8080:80 nginx:alpine
curl -m 5 'http://<indirizzo-pubblico>:8080/'     # dall'esterno: deve andare in timeout
sudo docker stop prova-firewall
```

## Avvio non presidiato

La macchina deve portare in servizio lo stack senza intervento dopo un riavvio,
anche durante le finestre non presidiate.

Tre passaggi, in ordine di dipendenza.

```bash
# 1. Secret. Idempotente: quelli già presenti non vengono toccati, perché
#    rigenerarli invaliderebbe le credenziali con cui i servizi si sono
#    registrati. Il comando segnala separatamente le credenziali dashboard.
sudo ./bin/generate-secrets.sh /srv/progetti_innovativi/secrets

# 1b. Prima installazione: crea gli htpasswd e la fonte root-only di Terraform.
#     Se gli htpasswd esistono già, chiede le password e le verifica senza
#     modificarli: serve a ricostruire la fonte mancante in modo sicuro.
sudo ./bin/configure-dashboard-users.py /srv/progetti_innovativi/secrets

# 2. Parametri del deploy: hostname, recapito per il certificato, immagini
#    riferite per digest.
sudo "${EDITOR:-vi}" /etc/stack-deploy.env

# 3. Da qui in poi il riavvio della macchina basta.
sudo systemctl start stack-deploy.service
```

`stack-deploy.service` applica `deploy/stack.yml` a ogni avvio. Il comando è
idempotente, quindi rieseguirlo su uno stack già in servizio aggiorna soltanto
ciò che è cambiato.

`start` vale per il primo avvio. Per riapplicare lo stack in seguito, dopo una
modifica a `/etc/stack-deploy.env` o al repository, il comando è
`sudo systemctl restart stack-deploy.service`: l'unità è `oneshot` con
`RemainAfterExit`, quindi dopo il primo deploy resta attiva, e su un'unità
attiva `start` non esegue nulla senza segnalarlo. Lo stesso vale per
`fleet-bootstrap.service`, che il riavvio del deploy riesegue da sé.

Lo swarm non va inizializzato a mano: lo script lo fa da sé se sul nodo non ne
esiste ancora uno. Non lo fa negli altri stati, perché `pending` e `locked`
descrivono uno swarm che esiste ed è in corso di ripristino, e inizializzarne
uno nuovo sopra scarterebbe servizi e secret già registrati: lì lo script
esce con errore e l'unità riprova. Su una macchina con più indirizzi il
demone non ne sceglie uno da solo, e va indicato `SWARM_ADVERTISE_ADDR`.

Lo script rifiuta di procedere se un'immagine non è ancorata per digest, se
un file di secret è assente o vuoto, oppure se manca
`secrets/dashboard_users.tfvars.json`. Quest'ultimo è la fonte root-only da
cui Terraform crea in Elasticsearch le stesse utenze presenti negli htpasswd:
senza, il bordo accetterebbe le credenziali ma Kibana le rifiuterebbe.

`fleet-bootstrap.service` segue e registra le policy, riprovando finché Kibana
non risponde. Gli agenti vengono rischedulati finché il token della loro policy
non compare sul volume condiviso.

Il deploy accoda il bootstrap anche a ogni esito positivo (`ExecStartPost`).
Senza, un deploy riuscito al secondo tentativo lascerebbe il bootstrap scartato
dal primo per dipendenza fallita: stack in servizio, ma utenze, policy e
dashboard non aggiornate e nessun errore visibile. Due `restart` ravvicinati
possono fallire con `update out of sequence`, perché il primo sta ancora
aggiornando i servizi: l'unità riprova da sola dopo 20 secondi, ma conviene
attendere l'esito del primo.

## Sorveglianza

Le regole Kibana scrivono su un indice letto da `alert-notifier.sh`.
`stack-heartbeat.sh` verifica applicazione, risorse e dipendenze prima di
inviare il battito al servizio esterno. Il controllo esterno rileva anche
l'assenza della macchina; la [vista di architettura](../docs/ARCHITETTURA.md#sorveglianza-esterna)
spiega la separazione fra battiti e relay.

### Configurazione

Il file contiene credenziali e non è versionato. Il repository ne porta solo il
modello:

```bash
sudo "${EDITOR:-vi}" /etc/stack-surveillance.env
```

Le due unità leggono endpoint e credenziali del cluster dallo stesso file.

Il battito legge anche `/etc/stack-deploy.env`, e solo per il nome pubblico:
interroga `/health` attraverso il proxy come un visitatore, con
`curl --resolve <APP_HOST>:443:127.0.0.1`. Un controllo su `localhost`
misurerebbe il proxy e non l'applicazione: l'entrypoint in chiaro reindirizza
qualunque richiesta, i router rispondono solo al nome pubblico e con `sniStrict`
un handshake per altri nomi viene rifiutato. Il certificato non viene
verificato, per non fallire con quello dell'autorità di prova: la sua validità
è il controllo `tls-pubblico`.

La cadenza del battito deve restare più breve del periodo atteso configurato
sul servizio esterno. Con `OnUnitActiveSec=5min` il periodo va impostato a
cinque minuti e la tolleranza a quindici, così che due battiti persi non
producano un allarme mentre un'assenza prolungata lo produce.

Al primo avvio, in assenza del marcatore, il recapito parte dall'istante
corrente: un indice già popolato produrrebbe altrimenti una raffica di
notifiche su eventi conclusi.

### Gli otto check da creare sul pannello

Creare gli otto check sul pannello prima di avviare i timer. Un ping verso
uno slug inesistente riceve 404 e non crea il check.

| Slug | Schedule | Tolleranza | Chi lo alimenta |
|---|---|---|---|
| `stack-liveness` | 5 minuti | 15 minuti | battito, a ogni esecuzione riuscita |
| `host-resources` | 365 giorni | 1 ora | battito e regola sull'occupazione del disco |
| `observability` | 365 giorni | 1 ora | battito e regola sull'assenza di ingestione |
| `app-degradation` | 365 giorni | 1 ora | regole su tasso di errori e latenza |
| `security` | 365 giorni | 1 ora | regola sull'attività anomala dell'applicazione |
| `alert-relay` | 10 minuti | 20 minuti | battito del notificatore |
| `tls-pubblico` | 365 giorni | 1 ora | controllo della catena e della scadenza TLS |
| `backup-nightly` | calendario | 1 ora | copia notturna, vedi sotto |

I cinque relay hanno periodo di un anno perché non devono scendere da soli:
li porta in guasto solo un segnale esplicito, e li riarma il documento di
rientro. I due battiti e la copia notturna hanno invece una cadenza attesa, ed
è su quella che il servizio esterno allarma per silenzio.

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
un'ora copre l'attesa dell'archivio su un dataset cresciuto più del previsto
senza rendere il check inutile.

L'endpoint è `<base>/<chiave>/backup-nightly`, con `HC_PING_KEY` letta da
`/etc/stack-surveillance.env`. Lo script invia il segnale di inizio per
misurare la durata dell'esecuzione.

Vale qui quanto detto per il battito: **l'URL di ping è una credenziale**. Chi
la possiede può inviare esiti falsi e tenere spenta la sorveglianza su una
copia che non viene più prodotta.

### Attivazione e verifica dei timer

Dopo il deploy, verificare che `${STACK_NAME}_surveillance-client` abbia una
replica attiva sul manager e che gli otto check ricevano i ping di prova.
Il client persistente viene usato dagli script tramite `docker exec`.

```bash
sudo bash -c '. /etc/stack-deploy.env; : "${STACK_NAME:=pi}"; docker service ps "${STACK_NAME}_surveillance-client" --no-trunc'
sudo systemctl start stack-heartbeat.timer alert-notifier.timer \
     backup-nightly.timer traefik-logrotate.timer
sudo systemctl list-timers 'stack-heartbeat*' 'alert-notifier*' 'backup-nightly*' 'traefik-logrotate*'
```

Provare segnale e rientro con il [drill delle notifiche](../docs/ESERCIZIO.md#controlli-esterni-e-notifiche).
Verificare anche il riavvio della macchina prima di lasciarla non presidiata.

## Dati: esportazione, copia, ripristino

Esportazione, copia di sicurezza e ripristino conservano i dati dell'evento
e permettono di recuperare il servizio.

| Meccanismo | Risponde a | Comando |
|---|---|---|
| Esportazione | i dati devono sopravvivere alla macchina | `data-export.sh` |
| Copia di sicurezza | i dati devono sopravvivere a un guasto | `data-backup.sh` |
| Ripristino | il servizio deve tornare su | `data-restore.sh` |

### Esportazione

Formati degli archivi:

| Sorgente | Formato | Perché |
|---|---|---|
| Elasticsearch | NDJSON compresso, uno per indice | conserva i campi annidati senza perdite, si rilegge da uno strumento di analisi o reindicizzando altrove |
| MongoDB | archivio nativo di `mongodump` | unico formato che riporta in vita lo stato di gioco con i tipi originali |

CSV e Parquet si possono derivare dall'NDJSON fuori dalla macchina.

Lo scorrimento degli indici usa **point-in-time e `search_after`**. Il
point-in-time congela l'insieme dei segmenti al momento dell'apertura, quindi
il risultato resta coerente mentre l'indice continua a ricevere documenti, che
è la condizione normale quando l'esportazione parte durante un'apertura al
pubblico.

I flussi di dati sono risolti negli indici che li compongono. È il caso di
tutto ciò che raccoglie Elastic Agent: quegli indici si chiamano `.ds-...` e
sono nascosti, e una risoluzione che non li raggiunga produrrebbe
un'esportazione vuota senza segnalare alcun errore. I file corrispondenti
vengono scritti **senza il punto iniziale**, altrimenti un `scp <dir>/*` al
momento del prelievo li salterebbe in silenzio portandosi via tutto tranne gli
archivi più grandi.

La procedura per avviare l'esportazione e prelevare gli archivi è nel
[runbook](../docs/ESERCIZIO.md#esportazione-dei-dati).

L'esportazione è disponibile anche durante le
finestre di apertura al pubblico. Scorrere l'intero dataset compete per cache e
banda di disco con la stessa Elasticsearch che sta ricevendo la telemetria,
quindi: esecuzione singola protetta da lock, priorità di CPU e di I/O ridotte,
scorrimento a lotti con pausa fra l'uno e l'altro.

Su Elasticsearch la leva che conta è **la cadenza dei lotti**, non la quota di
CPU del client: il lavoro pesante lo fa il cluster leggendo i segmenti. Le
priorità dichiarate nell'unità governano lo script, non il lavoro, perché lo
scorrimento avviene dentro contenitori che appartengono al cgroup del demone
Docker. Il freno effettivo è quindi espresso dallo script, con `LOTTO`,
`PAUSA`, `CPU_QUOTA` e la lettura sequenziale di `mongodump`.

Il servizio web consente soltanto il prelievo autenticato; la produzione degli
archivi resta un'operazione dell'host.

`EXPORT_DEST` deve valere lo stesso in `/etc/stack-data.env`, che governa la
scrittura, e in `/etc/stack-deploy.env`, che governa il montaggio. Se divergono,
l'esportazione scrive in un posto e il prelievo serve una directory vuota senza
segnalare nulla.

### Copia di sicurezza

Due meccanismi con ruoli distinti.

**Snapshot LVM, primario.** Cattura in un istante l'intero volume che ospita i
dati Docker, quindi MongoDB e gli altri volumi con nome, senza fermare le
scritture. Gli indici di Elasticsearch stanno su un volume proprio e non sono
compresi: ciò che di essi deve sopravvivere passa dall'esportazione.
Con il journaling attivo e file dati e journal sullo stesso volume,
uno snapshot a livello di volume cattura dati e journal come unità singola e
al ripristino MongoDB rigioca il journal: **`fsyncLock` non serve** e non viene
eseguito, perché bloccherebbe le scritture per tutta la durata della copia.

Su un'istanza standalone
`mongodump` non ha consistenza point-in-time fra collezioni, perché `--oplog`
richiede un replica set. Un dump preso durante le scritture può contenere una
sessione senza il relativo stato di gioco.

Lo snapshot richiede **spazio non allocato nel volume group**. Se tutto lo
spazio è assegnato ai volumi, lo script segnala un guasto e non crea lo snapshot.
Uno snapshot che esaurisce il proprio spazio copy-on-write viene invalidato
dal kernel, resta elencato e non
è più ripristinabile. Verificare l'occupazione con `lvs`.

**`mongodump`, portabile.** Destinato al prelievo manuale a evento concluso: si
rilegge su un'altra macchina e su un'altra installazione, cosa che uno snapshot
non consente. È l'unico dei due che costituisce un off-host reale, e dipende
dalla presenza di una persona.

Le copie locali non coprono la perdita della macchina. Prelevare gli archivi
portabili e gli export a fine giornata, come descritto in
[Chiusura di una giornata](../docs/ESERCIZIO.md#9-chiusura-di-una-giornata).

### Ripristino

La sequenza operativa è in [Recupero dei dati](../docs/ESERCIZIO.md#recupero-dei-dati):
prima conservare lo stato corrente, poi scegliere fra ripristino da archivio
e ricreazione a vuoto. Queste due operazioni sono alternative.

Su Swarm `data-restore.sh` ferma e ripristina le repliche del backend; con
repliche attive verifica gli indici TTL. Fuori da Swarm questi controlli sono
a carico dell’operatore, come indicato nel runbook.
Un ripristino fallito lascia il backend fermo; leggere l'esito prima di
proseguire. Preparare `/etc/stack-data.env` con stack, volume, database e
destinazioni corretti prima di ogni drill o recupero.

### Verifica

I drill avviano MongoDB ed Elasticsearch su una rete dedicata per verificare
esportazione, backup e ripristino.

```bash
make -C .. export-drill    # esporta e rilegge quanto esportato
make -C .. backup-drill    # archivio portabile e forma degli endpoint di recapito
make -C .. restore-drill   # cronometra le tre strade
```

Le prove contano i documenti per indice,
verificano che gli identificatori siano distinti (uno scorrimento sbagliato
produrrebbe ripetizioni che il solo conteggio non distingue) e rileggono
l'archivio di MongoDB reinserendolo in una base dati separata, indice di
ritenzione compreso.

La prova automatica non copre lo **snapshot LVM**, che richiede un volume group
con spazio non allocato, né il **certificato dell'autorità privata** del cluster.
Per LVM verifica soltanto che l'assenza del supporto sia segnalata come guasto.

## Cosa copre e cosa no

Il journal persistente consente di rileggere dopo un riavvio gli eventi già
scritti su disco, incluse le terminazioni per memoria. Un arresto improvviso
può perdere gli ultimi messaggi; un panic del kernel non garantisce che il
relativo messaggio sia stato scritto nel journal.

La raccolta diagnostica allo spegnimento copre soltanto gli arresti ordinati:
riavvii pianificati, `systemctl reboot`, riavvii avviati da un aggiornamento
automatico. Interruzione di alimentazione, panic e reset hardware non lasciano
il tempo di eseguire nulla.

Il journal è la fonte continua dei log. Il pacchetto diagnostico aggiunge
lo stato raccolto durante uno spegnimento ordinato.

Allo spegnimento systemd concede 90 secondi alla raccolta. Ogni comando ha un
tempo massimo (`DIAGNOSTIC_CMD_TIMEOUT`, 10 secondi) dentro un budget
complessivo (`DIAGNOSTIC_BUDGET`, 70 secondi): un comando bloccato non consuma
più tutto il margine, e `collector.err` annota quali comandi sono scaduti o
sono stati saltati. Un pacchetto con quel file vuoto è completo.

## Verifica

```bash
# Il journal sopravvive al riavvio
journalctl --list-boots

# Rotazione dei log dei container attiva
docker info --format '{{.LoggingDriver}}'
ls -la /srv/docker/containers/*/  | grep json.log

# La raccolta funziona anche fuori dallo spegnimento
sudo bash -c '. /etc/stack-deploy.env; export STACK_NAME; DIAGNOSTIC_DEST=/tmp/diag-test /usr/local/bin/diagnostic-bundle.sh'
ls -la /tmp/diag-test/
```

## Nota su live-restore

`live-restore` mantiene i container in esecuzione durante un riavvio del demone,
ma non è compatibile con i servizi in swarm mode e non è quindi impostato in
`daemon.json`. In swarm mode la continuità è data dalla rischedulazione dei
task.
