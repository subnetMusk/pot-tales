# Scripts

Automazioni per sviluppo, monitoring e manutenzione. Gli script vanno eseguiti dalla root
del progetto (es. `./scripts/dev-reinstall.sh`). Le automazioni Compose usano
il `.env` della root; il bootstrap di produzione legge file di secret separati.

## Sviluppo

| Script | Cosa fa |
|---|---|
| `dev-reinstall.sh` | Rebuild "clean-slate": reinstalla dipendenze e ricostruisce i container dev. |
| `dev-rebuild.sh` | Rebuild più leggero dei container dev (senza reinstallare tutto). |
| `update_frontend.sh` | Ricompila il frontend con le dipendenze già installate, corregge i percorsi degli asset e copia la build nel container frontend attivo; se è fermo, ne ricostruisce l’immagine. |
| `update_sandbox.sh` | Ricompila frontend e sandbox, aggiorna i riferimenti in `sandbox/dist/index.html`; non riavvia Compose. |

## Monitoring (ELK)

| Script | Cosa fa |
|---|---|
| `start-monitoring.sh` | Avvia lo stack `docker-compose.monitoring.yml` (richiede le reti create dallo stack dev). |
| `stop-monitoring.sh` | Ferma il monitoring lasciando attiva l'app. |

## Database

| Script | Cosa fa |
|---|---|
| `check-mongodb.sh` | Controllo rapido dello stato di MongoDB. |
| `fix-mongodb.sh` | Strumento legacy e distruttivo per il solo sviluppo: può ricreare i dati. Non è la procedura di ripristino di produzione. |

## Bootstrap del monitoring

| Script | Cosa fa |
|---|---|
| `fleet-bootstrap.sh` | Inizializza Fleet, applica la configurazione Terraform e scrive gli enrollment token sul volume `${STACK_NAME}_fleettokens` in produzione. Il sink su file `.env.fleet.*` esiste, ma il percorso Compose richiede i prerequisiti mancanti descritti sotto. |

In produzione lo script è eseguito da `fleet-bootstrap.service`: legge le
credenziali dai file di secret, usa la rete `${STACK_NAME}_elastic` e mantiene
lo stato Terraform in `/var/lib/pi-terraform/elk`. Il bootstrap è ripetibile
e verifica la presenza delle dashboard dopo l’apply.

**Il percorso automatico attuale richiede l'ambiente Swarm:** la fase di
aggiornamento delle mappature legge `/run/secrets/elastic_password` dentro
Elasticsearch. Compose non monta questo secret e non pubblica Kibana su
`localhost:5601`. Per lo sviluppo usare la
[procedura locale manuale](../docs/MONITORING_LOCALE.md), che specifica reti,
endpoint, stato e file `.env.fleet.*`. I token non vanno copiati nel `.env`.

## Manutenzione e verifica

| Script | Cosa fa |
|---|---|
| `cleanup.sh` | Pulizia centralizzata: `--dev`, `--production`, `--soft`, `--full` (vedi sotto). |
| `check-persistent-config.sh` | Verifica presenza/integrità di config e dati persistenti. |

## Produzione

Il deploy di produzione è `provisioning/bin/stack-deploy.sh`, eseguito da
`stack-deploy.service`; in produzione `fleet-bootstrap.sh` è eseguito da
`fleet-bootstrap.service`. Procedura in
[provisioning/README.md](../provisioning/README.md). Il banco di prova storico per
Docker Swarm resta in [swarm-prototype/](../swarm-prototype/).

## Utility asset (Python)

| Script | Cosa fa |
|---|---|
| `aseprite-converter.py` | Esporta/converte asset creati in Aseprite. |
| `json_structure.py` | Utility di sviluppo per ispezionare struttura di cartelle/JSON. |

## Pulizia e reinstallazione

**Questi comandi operano sull'ambiente di sviluppo e sul demone Docker corrente.**
Prima di eseguirli controllare `docker context show` e le modifiche locali.
Il nome legacy `--production` non indica una procedura per lo stack Swarm.

| Modo | Effetto reale |
|---|---|
| `--soft` | rimuove `dist`, `node_modules` e **`package-lock.json`** in frontend, server e sandbox, più `server/tmp/main`; esegue `docker system prune -f` e `docker builder prune --force` sul demone corrente |
| `--dev` (predefinito) | salva alcune configurazioni, esegue `docker compose down --volumes --remove-orphans`, `docker system prune -af --volumes` e pulizia completa della cache builder; elimina gli artefatti e i lockfile come `--soft` |
| `--production` | esegue `docker compose down`, salva alcune configurazioni ed elimina i dati e log di sviluppo nelle directory MongoDB e `docker/volumes/logs/esdata`; preserva la directory Kibana |
| `--full` | dopo conferma `DELETE_ALL`, esegue la pulizia Docker e degli artefatti, poi elimina le directory sotto `docker/volumes/` tranne `kibana`, anche quando contengono file versionati |

I prune possono eliminare risorse inutilizzate di **altri progetti** sullo
stesso demone. Il comando `docker compose down` non specifica `-f`: con i soli
file Compose nominati del repository può non trovare lo stack, e lo script
ignora l’errore. Non presumere che fermi l'ambiente dev prima della pulizia.

Il backup in `backups/config-<marca-temporale>/` viene eseguito da `--dev`,
`--production` e `--full`: copia `.env` se presente, la configurazione Kibana
e gli eventuali vecchi export `.ndjson` in `docker/volumes/kibana/data`.
Non salva i database, lo stato Fleet o la configurazione Filebeat.
Gli export correnti delle dashboard sono versionati in `terraform/elk/dashboards/`.

La rimozione dei lockfile cambia la risoluzione delle dipendenze alla prossima
installazione: verificare il diff e ripristinare i file versionati se la
modifica non è intenzionale. Per fermare lo sviluppo mantenendo i dati usare
`make dev-down` e `make monitoring-down`.

`dev-reinstall.sh` ricostruisce l'ambiente da zero: pulizia con `cleanup.sh --dev`,
reinstallazione delle dipendenze, ricostruzione delle immagini, avvio e verifica.

Per export, elenco e import delle dashboard, con i relativi prerequisiti,
consultare il [ciclo delle dashboard](../terraform/elk/dashboards/README.md#ciclo).

## Note

- Il proxy è Traefik (config in `docker/traefik/`), il log shipping è Filebeat,
  gli Elastic Agent sono gestiti da Fleet.
- Le configurazioni (Traefik, Kibana, Filebeat, Redis) sono versionate nel repo;
  lo stato runtime dell'ELK vive nei named volume Docker (`esdata01`, `kibanadata`,
  `certs`, `fleetserverdata`).
