# ELK as-code (provider elasticstack)

Configura lo stack Elastic GIA' AVVIATO (`docker-compose.monitoring.yml`) in
modo ripetibile, invece che a mano da Kibana. L'host non e' provisionato da
Terraform: e' una macchina virtuale fornita da terzi, preparata dagli script in
`provisioning/`. Questo modulo agisce solo sull'API dello stack.

## Cosa gestisce

- Utente `filebeat_writer` con privilegi minimi (sostituisce il superuser
  `elastic` in `docker/volumes/filebeat/filebeat.yml`).
- ILM policy `game-logs-retention` (rollover giornaliero, delete dopo 14 giorni).
- Fleet: agent policy `apm-policy` (con integration APM: host, RUM, secret token)
  e `infra-policy` (integration system + docker).
- Enrollment token generati per policy, esposti come output: sostituiscono i
  placeholder di `FLEET_ENROLLMENT_TOKEN_*` nel `.env`.
- Space `esercizio` e `evento`, con i rispettivi ruoli in sola lettura, data
  view e utenze di consultazione (`spaces.tf`).
- Reimportazione degli export delle dashboard versionati in
  [dashboards/](dashboards/README.md) (`dashboards.tf`).

## Le due platee

Le dashboard servono due pubblici con esigenze opposte: la vista di esercizio,
tecnica e non distribuibile, e la vista divulgativa sull'andamento dell'evento,
che si condivide con leggerezza. Sono due Space distinti, ognuno con un ruolo in
sola lettura limitato a una data view.

La separazione e' affidata al **ruolo**, non allo Space: nascondere
funzionalita' a livello di Space rende l'interfaccia piu' leggibile, ma la
documentazione Elastic dichiara che il controllo di visibilita' delle
funzionalita' non e' una misura di sicurezza. I ruoli sono scritti perche'
reggano da soli.

### Corrispondenza fra utenze Terraform ed elenchi htpasswd

E' il punto in cui i due lati si incontrano, e va tenuto allineato a mano.

I router in `deploy/config/dynamic/` verificano la credenziale con basicAuth e
**non rimuovono** l'intestazione di autorizzazione: la stessa credenziale
prosegue verso Kibana e vi autentica l'utente. La credenziale del visitatore
**e'** la sua credenziale Kibana.

Ne segue che ogni voce di `utenze_esercizio` e `utenze_evento` deve avere la
riga corrispondente nel file htpasswd della propria platea, con la stessa
password:

| Variabile Terraform | File htpasswd                       |
| ------------------- | ----------------------------------- |
| `utenze_esercizio`  | `secrets/dashboard_users_esercizio` |
| `utenze_evento`     | `secrets/dashboard_users_evento`    |
| entrambe            | `secrets/dashboard_users`           |

Il terzo file copre le risorse comuni ai due Space e deve contenere l'unione
delle due platee.

Un nome presente solo nell'htpasswd supera il bordo e viene respinto da Kibana:
l'utente vede una richiesta di credenziali che non si chiude mai. Un nome
presente solo in Terraform non supera il bordo. Il disallineamento non e'
rilevabile da questo modulo, perche' i file htpasswd contengono impronte e non
password.

### Confine fra le due platee

Con licenza basic la sicurezza a livello di documento e di campo non e'
disponibile: non esiste modo di concedere un sottoinsieme di documenti dentro un
indice condiviso. Il confine e' quindi **sull'indice**, e `indici_esercizio` e
`indici_evento` non devono intersecarsi. Se si sovrappongono, la platea
divulgativa legge anche i log tecnici e nessun'altra parte della configurazione
lo impedisce.

## Uso

```bash
# 1. Avvia lo stack monitoring e attendi che Kibana sia healthy
./scripts/start-monitoring.sh

# 2. Applica la configurazione
cd terraform/elk
cp terraform.tfvars.example terraform.tfvars   # compila i valori
terraform init -backend-config=path=/var/lib/pi-terraform/elk/terraform.tfstate
terraform apply

# 3. Copia i token negli enrollment del .env e riavvia gli agent
terraform output -raw fleet_enrollment_token_apm     # -> FLEET_ENROLLMENT_TOKEN_APM
terraform output -raw fleet_enrollment_token_infra   # -> FLEET_ENROLLMENT_TOKEN_INFRA
docker compose -f docker-compose.monitoring.yml up -d apm-agent infra-agent

# 4. Aggiorna filebeat.yml con l'utente dedicato
#    username: filebeat_writer / password: quella scelta in tfvars
docker restart filebeat
```

## Note e limiti

- STARTER non ancora applicato a uno stack reale: alla prima esecuzione
  verificare con `terraform plan` che gli schemi (in particolare l'input della
  integration APM, che varia con la versione del package) combacino con la
  versione del provider/stack. Allineare `apm_package_version` a `STACK_VERSION`.
- In dev Elasticsearch non pubblica la porta sull'host: per fare apply da fuori
  Docker, pubblica temporaneamente `9200` su `es01` o esegui Terraform in un
  container attaccato a `internal_net`.
- Lo stato Terraform contiene in chiaro password, token ed enrollment token.
  Dove risiede, cosa comporta perderlo e come si ricostruisce: [../README.md](../README.md).
- Il fleet-server usa ancora il token bootstrap del compose: la gestione
  completa del fleet-server via Terraform e' uno step successivo.
- Mancano le regole di alerting su latenza, stato del cluster, watermark del
  disco e sicurezza. Dipendono dai nomi dei campi dopo l'ingestione reale, e una
  regola che interroga un campo inesistente non fallisce: resta silenziosa. Vanno
  scritte con i dati davanti, verificando prima il campo su Discover.
- Gli identificativi delle funzionalita' in `funzionalita_disattivate_*`
  dipendono dalla versione di Kibana: confrontarli con `GET /api/features`
  sull'istanza in uso. Un identificativo errato lascia visibile una voce di menu
  che il ruolo comunque non autorizza.
