# Scripts

Automazioni per sviluppo, monitoring e manutenzione. Vanno eseguiti dalla root
del progetto (es. `./scripts/dev-reinstall.sh`). Usano l'unico file `.env` in root.

## Sviluppo

| Script | Cosa fa |
|---|---|
| `dev-reinstall.sh` | Rebuild "clean-slate": reinstalla dipendenze e ricostruisce i container dev. |
| `dev-rebuild.sh` | Rebuild piu' leggero dei container dev (senza reinstallare tutto). |
| `update_frontend.sh` | Reinstalla le dipendenze del frontend e ne rifa' la build. |
| `update_sandbox.sh` | Aggiorna gli asset/deps del sandbox. |

## Monitoring (ELK)

| Script | Cosa fa |
|---|---|
| `start-monitoring.sh` | Avvia lo stack `docker-compose.monitoring.yml` (richiede le reti create dallo stack dev). |
| `stop-monitoring.sh` | Ferma il monitoring lasciando attiva l'app. |

## Database

| Script | Cosa fa |
|---|---|
| `check-mongodb.sh` | Controllo rapido dello stato di MongoDB. |
| `fix-mongodb.sh` | Riparazione di un MongoDB corrotto. |

## Bootstrap del monitoring

| Script | Cosa fa |
|---|---|
| `fleet-bootstrap.sh` | Inizializza Fleet, applica la configurazione Terraform e scrive gli enrollment token letti dagli agenti: in sviluppo nei file `.env.fleet.*`, in produzione sul volume `${STACK_NAME}_fleettokens`. |

Gli agenti Elastic si registrano presentando un enrollment token, che esiste
solo dopo che Kibana ha inizializzato Fleet e sono state create le policy: su
un'installazione vuota non e' noto in anticipo e non puo' essere scritto a mano
nella configurazione. Lo script esegue le fasi nell'ordine necessario ed e'
idempotente, quindi puo' essere eseguito a ogni avvio.

```bash
docker compose -f docker-compose.monitoring.yml up -d setup es01 kibana
./scripts/fleet-bootstrap.sh
docker compose -f docker-compose.monitoring.yml up -d
```

I file generati non sono versionati. In loro assenza gli agenti non si
registrano e vengono riavviati, mentre il resto dello stack resta funzionante.

## Manutenzione e verifica

| Script | Cosa fa |
|---|---|
| `cleanup.sh` | Pulizia centralizzata: `--dev`, `--production`, `--soft`, `--full` (vedi sotto). |
| `check-persistent-config.sh` | Verifica presenza/integrita' di config e dati persistenti. |

## Produzione

Il deploy di produzione e' `provisioning/bin/stack-deploy.sh`, eseguito da
`stack-deploy.service`; in produzione `fleet-bootstrap.sh` e' eseguito da
`fleet-bootstrap.service`. Procedura in
[provisioning/README.md](../provisioning/README.md). Il banco di prova per
Docker Swarm resta in [swarm-prototype/](../swarm-prototype/).

## Utility asset (Python)

| Script | Cosa fa |
|---|---|
| `aseprite-converter.py` | Esporta/converte asset creati in Aseprite. |
| `json_structure.py` | Utility di sviluppo per ispezionare struttura di cartelle/JSON. |

## Pulizia e reinstallazione

`cleanup.sh` e' il punto unico: sostituisce i vecchi `clean_build.sh` e
`production-cleanup.sh`.

| Modo | Effetto |
|---|---|
| `--soft` | solo cache e artefatti di build |
| `--dev` | pulizia completa dell'ambiente di sviluppo (predefinito) |
| `--production` | pulizia selettiva, preserva le configurazioni |
| `--full` | cancella tutto, **compresi i dati** |

Prima di procedere copia in `backups/config-<marca-temporale>/` le configurazioni
critiche: `.env`, configurazione Kibana e Filebeat. Le dashboard non sono fra queste
perche' non ne hanno bisogno: l'export e' versionato nel repository e reimportato da
Terraform, quindi ricrearle su un'istanza vuota non richiede un backup a parte.

`dev-reinstall.sh` ricostruisce l'ambiente da zero: pulizia con `cleanup.sh --dev`,
reinstallazione delle dipendenze, ricostruzione delle immagini, avvio e verifica.

Le dashboard si gestiscono dal Makefile — `dashboards-export`, `dashboards-list`,
`dashboards-import` — e il vincolo di compatibilita' fra versioni di Kibana e' in
[../terraform/elk/dashboards/README.md](../terraform/elk/dashboards/README.md).

## Note

- Il proxy e' Traefik (config in `docker/traefik/`), il log shipping e' Filebeat,
  gli Elastic Agent sono gestiti da Fleet.
- Le configurazioni (Traefik, Kibana, Filebeat, Redis) sono versionate nel repo;
  lo stato runtime dell'ELK vive nei named volume Docker (`esdata01`, `kibanadata`,
  `certs`, `fleetserverdata`).
