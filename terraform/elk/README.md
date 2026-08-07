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

## Uso

```bash
# 1. Avvia lo stack monitoring e attendi che Kibana sia healthy
./scripts/start-monitoring.sh

# 2. Applica la configurazione
cd terraform/elk
cp terraform.tfvars.example terraform.tfvars   # compila i valori
terraform init
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
- Lo stato Terraform contiene segreti (password, token): non versionarlo; per
  il team usare un backend remoto cifrato.
- Il fleet-server usa ancora il token bootstrap del compose: la gestione
  completa del fleet-server via Terraform e' uno step successivo.
