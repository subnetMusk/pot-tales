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
| `bin/diagnostic-bundle.sh` | `/usr/local/bin/` |

```bash
sudo install -m 0644 docker/daemon.json /etc/docker/daemon.json
sudo install -m 0644 -D systemd/journald.conf.d/10-persistent.conf \
     /etc/systemd/journald.conf.d/10-persistent.conf
sudo install -m 0644 systemd/diagnostic-bundle.service /etc/systemd/system/
sudo install -m 0755 bin/diagnostic-bundle.sh /usr/local/bin/

sudo systemctl restart systemd-journald
sudo systemctl daemon-reload
sudo systemctl enable diagnostic-bundle.service
sudo systemctl restart docker
```

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
