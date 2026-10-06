# Monitoring locale

Configurare Fleet, APM e dashboard sullo stack Compose di sviluppo. Eseguire
la procedura dalla radice del repository, con Docker Compose 2.24.0+ e
l'applicazione avviata tramite `make dev-up`. Usare dati e credenziali di prova.
La produzione segue il [provisioning](../provisioning/README.md#avvio-non-presidiato).

`make monitoring-up` avvia i servizi, ma non inizializza Fleet né crea i token.
Il bootstrap automatico `scripts/fleet-bootstrap.sh` richiede attualmente il
secret `/run/secrets/elastic_password` dentro Elasticsearch: è montato dallo
stack Swarm e manca in Compose. In locale seguire i passi manuali sotto.

## 1. Preparare rete e API

Kibana è raggiungibile dall'host su `http://kibana.localhost` tramite Traefik.
Elasticsearch non pubblica `9200`; `internal_net` non ha uscita internet e
non permette al container Terraform di scaricare i provider. Collegare
Elasticsearch a `proxy_net` solo durante l'apply, senza pubblicare porte:

```bash
docker compose -f docker-compose.monitoring.yml up -d setup es01 kibana
docker compose -f docker-compose.monitoring.yml ps setup es01 kibana
# Attendere che es01 e kibana siano healthy prima di continuare.
docker network connect proxy_net es01
```

Se `es01` è già collegato a `proxy_net`, non ripetere `network connect`.
Questa connessione dura fino alla rimozione del container e si elimina alla
fine della procedura. Le API viste da Terraform sono `https://es01:9200` e
`http://kibana:5601`, senza il base path `/osservabilita` di produzione.

Inizializzare Fleet, autenticandosi con la password `ELASTIC_PASSWORD` del
`.env`. Con il solo nome utente `curl` chiede la password senza salvarla nella
cronologia:

```bash
curl --fail --silent --show-error --user elastic \
  --header 'kbn-xsrf: true' --request POST \
  http://kibana.localhost/api/fleet/setup
```

## 2. Preparare variabili e stato Terraform

```bash
umask 077
cp terraform/elk/terraform.tfvars.example terraform/elk/terraform.tfvars
chmod 600 terraform/elk/terraform.tfvars
"${EDITOR:-vi}" terraform/elk/terraform.tfvars
```

Compilare il file con:

| Variabile | Valore locale |
|---|---|
| `elastic_password` | lo stesso valore di `ELASTIC_PASSWORD` nel `.env` |
| `filebeat_password` | password locale dedicata per `filebeat_writer` |
| `apm_secret_token` | lo stesso valore di `APM_SECRET_TOKEN` nel `.env` |
| `elasticsearch_endpoint` | `https://es01:9200` |
| `kibana_endpoint` | `http://kibana:5601` |
| `apm_server_url` | `http://apm.localhost` |
| `insecure_tls` | `true`, solo per i certificati di sviluppo |
| `kibana_version` | lo stesso valore di `STACK_VERSION` nel `.env` |
| `utenze_esercizio`, `utenze_evento` | mappe nome/password per provare i due ruoli; usare nomi distinti |

Il proxy locale non applica gli htpasswd di produzione: le mappe creano le
utenze Kibana per provare i ruoli, senza configurare il bordo di produzione.
Il file contiene password ed è escluso da Git. Non eseguire il `.env` con
`source`: è un file Compose con interpolazioni e valori che non sono sintassi shell.

Conservare lo stato fuori dal checkout, con una directory leggibile soltanto
dall'operatore. Il container usa `/stato` come destinazione del backend:

```bash
TF_STATE_DIR="$HOME/.local/state/pot-tales/terraform/elk"
mkdir -p "$TF_STATE_DIR"
chmod 700 "$TF_STATE_DIR"

# Immagine fissata al digest usato dal Makefile.
tf_locale() {
  docker run --rm -i --network proxy_net \
    -v "$PWD/terraform/elk:/tf" -w /tf \
    -v "$TF_STATE_DIR:/stato" \
    hashicorp/terraform:1.9@sha256:18f9986038bbaf02cf49db9c09261c778161c51dcc7fb7e355ae8938459428cd "$@"
}
tf_locale init -input=false -reconfigure -backend-config=path=/stato/terraform.tfstate
tf_locale plan
tf_locale apply
```

Leggere il piano prima di confermare l'apply. Per Git Bash su Windows,
prefissare `docker run` con `MSYS_NO_PATHCONV=1`. Stato e piani contengono
segreti: valgono le [regole di custodia](../terraform/README.md#dove-non-deve-finire).

## 3. Scrivere i token e avviare gli agenti

Nella stessa shell, dopo un apply riuscito, scrivere un file per agente. Questi
sono i nomi e le variabili letti dagli `env_file` di Compose:

```bash
(
  set -e
  umask 077
  policy_id=$(tf_locale output -raw fleet_server_policy_id)
  server_token=$(tf_locale output -raw fleet_enrollment_token_server)
  apm_token=$(tf_locale output -raw fleet_enrollment_token_apm)
  infra_token=$(tf_locale output -raw fleet_enrollment_token_infra)
  test -n "$policy_id" && test -n "$server_token" && test -n "$apm_token" && test -n "$infra_token"
  printf 'FLEET_SERVER_POLICY_ID=%s\nFLEET_ENROLLMENT_TOKEN=%s\n' \
    "$policy_id" "$server_token" > .env.fleet.server
  printf 'FLEET_ENROLLMENT_TOKEN=%s\n' "$apm_token" > .env.fleet.apm
  printf 'FLEET_ENROLLMENT_TOKEN=%s\n' "$infra_token" > .env.fleet.infra
  chmod 600 .env.fleet.server .env.fleet.apm .env.fleet.infra
)
docker compose -f docker-compose.monitoring.yml up -d
```

I file sono esclusi da Git. Dopo una rigenerazione dei token ripetere `up -d`:
Compose ricrea i servizi la cui configurazione è cambiata. Non copiare i token
nei segnaposto `FLEET_ENROLLMENT_TOKEN_*` del `.env`.

Per usare l'utente dedicato anche con Filebeat, impostare nel `.env`
`ELASTICSEARCH_USERNAME=filebeat_writer` e `ELASTICSEARCH_PASSWORD` uguale a
`filebeat_password`, poi rieseguire `up -d filebeat` con lo stesso file Compose.

## 4. Verificare e chiudere l'accesso temporaneo

- In Kibana, Fleet deve mostrare gli agenti registrati e le policy assegnate.
- I due Space devono contenere le dashboard versionate; provare un login per
  platea e verificare che quella evento non legga log tecnici, metriche o tracce.
- APM deve ricevere una transazione di prova con lo stesso secret token del backend.
- Leggere i log dei servizi se restano unhealthy o in riavvio; lo stato healthy
  di Elasticsearch e Kibana non prova che tutti gli agenti siano configurati.

**Limite del Compose corrente:** la policy Docker di Terraform interroga
`tcp://socket-proxy:2375`, ma lo stack locale non dichiara `socket-proxy`.
Le metriche Docker richiedono un adattamento locale della policy o il servizio
proxy equivalente a quello di produzione. Non interpretare pannelli Docker
vuoti come assenza di guasti. La verifica completa delle metriche e della
sorveglianza host va eseguita sullo stack Swarm di prova.

Dopo l'apply e la scrittura dei token, eliminare l'accesso temporaneo:

```bash
docker network disconnect proxy_net es01
```

Per applicare modifiche al modulo o reimportare le dashboard ripetere la
connessione temporanea, `tf_locale init`, `plan` e `apply` con lo stesso stato.
Il ciclo di [export delle dashboard](../terraform/elk/dashboards/README.md#ciclo)
usa in locale `KIBANA_URL=http://kibana.localhost`.
