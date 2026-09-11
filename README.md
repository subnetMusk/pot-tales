# Progetti Innovativi, piattaforma gioco HTML5

Gioco HTML5 singleplayer (Phaser 3 + TypeScript/Vite) con backend Go, persistenza
MongoDB/Redis e osservabilità Elastic (Elasticsearch, Kibana, APM, Fleet, Filebeat).
In sviluppo gira su Docker Compose con Traefik come reverse proxy; in produzione gira
su Docker Swarm a partire da `deploy/stack.yml`.

Tutti i comandi del progetto passano dal Makefile. `make help` ne stampa l'elenco,
generato dai target stessi, quindi non può divergere da ciò che esiste davvero.

## Avvio rapido

```bash
cp .env.example .env      # compilare i valori
make dev-up               # applicazione
make monitoring-up        # facoltativo: stack Elastic
```

Il dettaglio, i vincoli sulle variabili e gli URL locali sono in
[docs/SVILUPPO.md](docs/SVILUPPO.md).

## Dove sta cosa

| Documento | Quando si legge |
|---|---|
| [docs/SVILUPPO.md](docs/SVILUPPO.md) | per lavorare in locale: avvio, variabili, routing, verifica |
| [docs/ARCHITETTURA.md](docs/ARCHITETTURA.md) | com'è fatto il sistema, le rotte HTTP, l'osservabilità e le fragilità note |
| [docs/ESERCIZIO.md](docs/ESERCIZIO.md) | in produzione: procedure dei momenti pianificati e intervento a guasto avvenuto |

Ogni directory che contiene qualcosa di non ovvio ha il proprio README accanto al
codice, non qui: [`provisioning/`](provisioning/README.md) per l'host e i dati,
[`terraform/`](terraform/README.md) e [`terraform/elk/`](terraform/elk/README.md) per
l'osservabilità come codice, [`secrets/`](secrets/README.md) per i segreti,
[`scripts/`](scripts/README.md) per gli script di automazione.

## File dello stack

| File | Ambiente | Comando |
|---|---|---|
| `docker-compose.dev.yml` | sviluppo, applicazione | `make dev-up` |
| `docker-compose.monitoring.yml` | sviluppo, Elastic | `make monitoring-up` |
| `docker-compose.security.yml` | sviluppo, overlay CrowdSec | `make security-up` |
| `deploy/stack.yml` | produzione, Docker Swarm | `make stack-deploy` |

> `docker-compose.prod.yml` è un residuo dell'era Node e non è allineato allo stack
> attuale. La produzione è `deploy/stack.yml`.

## Requisiti

- Docker 20.10+ con Compose v2. In produzione lo swarm serve, ma non va inizializzato
  a mano: lo fa lo script di deploy se sul nodo non esiste.
- Almeno 4 GB di RAM liberi se si avvia anche Elastic.
- Go 1.26+ e Node 24+ servono solo per compilare fuori dai container. I target di
  verifica girano in immagini ancorate per digest e non richiedono toolchain sull'host.

## Verifica

```bash
make verify-fast   # formattazione, analisi statica, build, test, lint di compose e stack
make verify        # aggiunge Terraform, workflow, test di integrazione, copertura, segreti
make runtime-check # avvia gli artefatti costruiti e li interroga davvero
```

I test di integrazione girano su MongoDB e Redis veri e stanno dietro il tag di
compilazione `integration`: senza, ogni esecuzione della suite dipenderebbe da due
servizi esterni e un guasto di ambiente sarebbe indistinguibile da una regressione.
