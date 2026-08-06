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
| `docker` | `/srv/docker` | Immagini, container, volumi, log dei container |
| `diagnostics` | `/srv/diagnostics` | Pacchetti diagnostici raccolti allo spegnimento |
| sistema | `/` | Sistema operativo, journal persistente |

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
| `systemd/stack-heartbeat.service`, `.timer` | `/etc/systemd/system/` |
| `systemd/alert-notifier.service`, `.timer` | `/etc/systemd/system/` |
| `bin/*.sh` | `/usr/local/bin/` |
| `systemd/stack-surveillance.env.example` | `/etc/stack-surveillance.env`, compilato e a `0600` |

```bash
sudo install -m 0644 docker/daemon.json /etc/docker/daemon.json
sudo install -m 0644 -D systemd/journald.conf.d/10-persistent.conf \
     /etc/systemd/journald.conf.d/10-persistent.conf
sudo install -m 0644 systemd/*.service systemd/*.timer /etc/systemd/system/
sudo install -m 0755 bin/diagnostic-bundle.sh bin/stack-heartbeat.sh \
     bin/alert-notifier.sh /usr/local/bin/

sudo systemctl restart systemd-journald
sudo systemctl daemon-reload
sudo systemctl enable diagnostic-bundle.service
sudo systemctl enable --now stack-heartbeat.timer alert-notifier.timer
sudo systemctl restart docker
```

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

La cadenza del battito deve restare piu' breve del periodo atteso configurato
sul servizio esterno. Con `OnUnitActiveSec=5min` il periodo va impostato a
cinque minuti e la tolleranza a quindici, cosi' che due battiti persi non
producano un allarme mentre un'assenza prolungata lo produce.

Al primo avvio, in assenza del marcatore, il recapito parte dall'istante
corrente: un indice gia' popolato produrrebbe altrimenti una raffica di
notifiche su eventi conclusi.

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
