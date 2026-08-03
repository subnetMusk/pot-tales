# Stack Elastic su Docker Swarm

Configurazione dello stack Elastic per `docker stack deploy`, con gli script
usati per misurarne il comportamento di avvio, riavvio e recupero.

`docker stack deploy` non supporta `depends_on`, quindi l'ordine di avvio non
puo' essere dichiarato: i servizi partono in parallelo e quelli le cui
dipendenze non sono pronte escono in errore finche' non lo diventano. Questi
script verificano che la convergenza avvenga senza intervento manuale.

## Contenuto

| File | Descrizione |
|---|---|
| `stack.yml` | Lo stack: setup come `replicated-job`, es01, kibana, filebeat |
| `config/setup-certs.sh` | Genera CA e certificati, imposta la password di `kibana_system` |
| `config/kibana.yml` | Configurazione di Kibana, distribuita come `config` |
| `config/filebeat.yml` | Configurazione di Filebeat |
| `config/*-entrypoint.sh` | Entrypoint che leggono i secret da `/run/secrets` |
| `gate.sh` | Cicli di avvio a freddo e di riavvio, con misura dei tempi |
| `autoheal-test.sh` | Verifica la rischedulazione di un task che diventa unhealthy |
| `rollback-test.sh` | Verifica il rollback automatico di un aggiornamento fallito |
| `fault-drill.sh` | Inietta un guasto casuale per esercitazioni di diagnosi |
| `crowdsec-test/` | Verifica separata del bouncer CrowdSec con Traefik |

`secrets/` e `runs/` sono generati e non versionati.

## Esecuzione

```bash
./gate.sh 5 cold
```

Il primo avvio inizializza Swarm sul nodo locale se non gia' attivo. Per
disattivarlo:

```bash
docker swarm leave --force
```

La modalita' `warm` conserva i volumi tra i cicli e verifica il riavvio con
dati gia' presenti.

## Perimetro

Lo stack copre `setup`, `es01`, `kibana` e `filebeat`, cioe' la catena che nel
file Compose si regge su `depends_on`.

Non include `fleet-server`, `apm-agent` e `infra-agent`: il loro avvio richiede
enrollment token generati in Kibana, che questo stack non produce. Il loro
comportamento sotto Swarm resta quindi non verificato.

## Vincoli dell'orchestratore

| Vincolo | Soluzione adottata |
|---|---|
| `depends_on` non supportato | riavvio automatico fino a dipendenza pronta |
| `env_file` non supportato | `configs` per i parametri, `secrets` per le credenziali |
| `container_name` non tradotto | il nome del servizio funge da nome DNS |
| bind mount relativi non tradotti | i file di configurazione diventano `configs` |
| `mem_limit` | `deploy.resources.limits` e `reservations` |
| secret montati 0444 | `uid`, `gid` e `mode: 0400` espliciti |

`ulimits` viene invece tradotto correttamente nella specifica del servizio, per
cui `bootstrap.memory_lock` resta applicabile.

## Gestione dei secret

- **Elasticsearch** supporta il suffisso `_FILE`: `ELASTIC_PASSWORD_FILE` legge
  direttamente da `/run/secrets` senza passare dall'ambiente.
- **Kibana** e **Filebeat** non lo supportano. Per entrambi un entrypoint
  esporta il valore in una variabile d'ambiente, dove resta leggibile in
  `/proc/<pid>/environ`. L'alternativa che evita il passaggio dall'ambiente e'
  la keystore dei rispettivi componenti.

Le variabili esportate da un entrypoint esistono solo nel processo principale:
healthcheck e comandi eseguiti con `docker exec` non le vedono e devono
rileggere il secret autonomamente.

## Misure raccolte

Ambiente: Docker 29.5.3, 24 vCPU, 7,7 GB di memoria disponibile al daemon.

### Avvio a freddo, volumi vuoti

| Ciclo | Tempo a tutti healthy | setup | es01 | kibana | filebeat |
|---|---|---|---|---|---|
| 1 | 49s | 1 | 1 | 1 | 2 |
| 2 | 49s | 1 | 1 | 1 | 2 |
| 3 | 42s | 1 | 1 | 1 | 1 |
| 4 | 47s | 1 | 1 | 1 | 2 |
| 5 | 47s | 1 | 1 | 1 | 2 |

I valori numerici sono i task creati per servizio: 1 indica nessun riavvio.
Nessun intervento manuale in alcun ciclo.

Su questo hardware `es01` non viene mai riavviato: il setup completa la
generazione dei certificati in circa 18 secondi, mentre il task di `es01` resta
in stato `Starting` fino a circa 16 secondi e avvia il processo subito dopo. Il
margine e' di pochi secondi e dipende dalle prestazioni della macchina.

### Avvio con ordine invertito

`SETUP_DELAY` ritarda la generazione dei certificati, così che es01, kibana e
filebeat partano per primi e debbano essere rischedulati.

```bash
SETUP_DELAY=90 ./gate.sh 2 cold
```

| Ciclo | Tempo | setup | es01 | kibana | filebeat |
|---|---|---|---|---|---|
| 1 | 140s | 1 | 5 | 5 | 5 |
| 2 | 147s | 1 | 5 | 5 | 5 |

Quattro riavvii per servizio, convergenza in entrambi i cicli senza intervento.
Il job `setup` resta a un solo task anche in questa condizione.

### Riavvio con volumi popolati

Tempi: 47, 48, 47, 46, 47 secondi. Un solo task per servizio.

Verifica l'idempotenza del setup: a volumi popolati il job salta la generazione
di CA e certificati e passa direttamente all'attesa di Elasticsearch. Se non
fosse idempotente, ogni riavvio rigenererebbe la CA e i certificati esistenti
non sarebbero piu' validi.

Questa modalita' non copre il riavvio del demone Docker o della macchina.

### Rischedulazione su stato unhealthy

Un container reso unhealthy senza terminare il processo viene ucciso e
rischedulato da Swarm dopo circa 30 secondi.

### Rollback automatico

Un aggiornamento che impedisce l'avvio del servizio porta lo stato a
`rollback_completed` in circa 24 secondi; il servizio torna healthy dopo altri
29. `rollback-test.sh` verifica entrambe le condizioni, poiche' il ripristino
della specifica senza il ritorno in servizio non costituisce un recupero.

## Esercitazione di diagnosi

`fault-drill.sh` inietta uno di quattro guasti senza indicare quale:

```bash
./fault-drill.sh            # inietta un guasto
./fault-drill.sh --reveal   # mostra quale
./fault-drill.sh --reset    # ripristina
```

I quattro guasti si manifestano in modo diverso — servizio assente, container
terminato e ricreato, riavvio ripetuto da configurazione, processo terminato
dal cgroup — e lasciano tracce distinte in `docker service ps` e
`docker service logs`.
