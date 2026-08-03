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
| `kibana-dashboard-manager.sh` | Export/import delle dashboard Kibana. |

## Database

| Script | Cosa fa |
|---|---|
| `check-mongodb.sh` | Controllo rapido dello stato di MongoDB. |
| `fix-mongodb.sh` | Riparazione di un MongoDB corrotto. |

## Bootstrap del monitoring

| Script | Cosa fa |
|---|---|
| `fleet-bootstrap.sh` | Inizializza Fleet, applica la configurazione Terraform e genera i file `.env.fleet.*` con gli enrollment token letti dagli agenti. |

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
| `cleanup.sh` | Pulizia centralizzata: `--dev`, `--production`, `--soft`, `--full` (vedi [CLEANUP_SYSTEM.md](CLEANUP_SYSTEM.md)). |
| `check-persistent-config.sh` | Verifica presenza/integrita' di config e dati persistenti. |

## Produzione

Nessuno script di deploy disponibile. La procedura sara' definita insieme allo
stack di produzione; una configurazione per Docker Swarm si trova in
[swarm-prototype/](../swarm-prototype/).

## Utility asset (Python)

| Script | Cosa fa |
|---|---|
| `aseprite-converter.py` | Esporta/converte asset creati in Aseprite. |
| `json_structure.py` | Utility di sviluppo per ispezionare struttura di cartelle/JSON. |

## Note

- Il proxy e' Traefik (config in `docker/traefik/`), il log shipping e' Filebeat,
  gli Elastic Agent sono gestiti da Fleet. Riferimenti a NGINX Proxy Manager,
  Fluent Bit o modalita' standalone in doc/script piu' vecchi sono superati.
- Le configurazioni (Traefik, Kibana, Filebeat, Redis) sono versionate nel repo;
  lo stato runtime dell'ELK vive nei named volume Docker (`esdata01`, `kibanadata`,
  `certs`, `fleetserverdata`).
