# ELK as-code (provider elasticstack)

Configura lo stack Elastic GIA' AVVIATO (`docker-compose.monitoring.yml`) in
modo ripetibile, invece che a mano da Kibana. L'host non e' provisionato da
Terraform: e' una macchina dedicata, preparata dagli script in `provisioning/`.
Questo modulo agisce solo sull'API dello stack.

## Cosa gestisce

- Utente `filebeat_writer`, con cui Filebeat scrive in produzione: privilegi di
  scrittura sui log e di gestione di template e ciclo di vita, nient'altro. La
  password viene da `secrets/filebeat_writer_password`, letta sia da
  `fleet-bootstrap.sh` sia da Filebeat.
- ILM policy `game-logs-retention`: rollover giornaliero o a 5 GB per shard,
  cancellazione dopo `log_retention` (30 giorni). La durata supera quella
  dell'esercizio di proposito: i dati devono arrivare interi all'esportazione
  finale.
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

In produzione la copia in chiaro necessaria a Terraform vive in
`secrets/dashboard_users.tfvars.json`, a modo `0400`, e viene prodotta da
`provisioning/bin/configure-dashboard-users.py`. Non e' un Docker secret e non
viene montata nei servizi: entra soltanto nel contenitore Terraform effimero
durante il bootstrap. Va inclusa nella custodia off-host dei segreti, mai negli
export destinati alle dashboard.

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

# 4. Solo in sviluppo: aggiorna filebeat.yml con l'utente dedicato
#    username: filebeat_writer / password: quella scelta in tfvars.
#    In produzione Filebeat usa gia' filebeat_writer dal proprio secret.
docker restart filebeat
```

## Verificato su uno stack reale

Applicato su uno stack Swarm completo (Elasticsearch e Kibana 8.19.19, provider
elasticstack 0.16.3), a partire da volumi vuoti.

| Punto | Esito |
|---|---|
| Creazione di Space, ruoli e utenze in un solo apply | superata |
| Utenza della platea tecnica presente su Elasticsearch con il ruolo atteso | superata |
| Campo temporale delle data view | `@timestamp`, come dichiarato |
| Stato collocato fuori dalla copia di lavoro | superata |
| Ciclo export, versionamento e reimportazione via Terraform | superato |
| Campi di migrazione presenti su ogni riga dell'export | 11 righe su 11 |

Restano non verificati su un apply reale la tenuta del ruolo divulgativo fra i
due Space e gli identificativi delle funzionalita' Kibana: richiedono un accesso
con una credenziale per platea, che si prova solo con entrambe configurate.

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
- **Stato del cluster: non osservabile con le integrazioni installate.** Le
  policy Fleet dichiarano `fleet_server`, `apm`, `system` e `docker`. Nessuna di
  queste indicizza la salute del cluster, quindi una regola su quel tema
  interrogherebbe indici che non esistono, e una regola senza dati non fallisce:
  resta silenziosa per sempre. Servirebbe aggiungere l'integrazione
  `elasticsearch` alla policy infrastrutturale, che e' una decisione di
  architettura e non una regola in piu': porta un agente che interroga il
  cluster con credenziali proprie e consuma parte di un budget di memoria gia'
  stretto.

  Non e' pero' un buco: lo stato del cluster e' gia' sorvegliato da
  `stack-heartbeat.sh`, che lo interroga direttamente e recapita sulla classe
  `observability`. La differenza e' dove vive il controllo, non se esiste — e la
  collocazione attuale e' quella piu' robusta, perche' un controllo che vive
  fuori da Elasticsearch continua a funzionare quando e' Elasticsearch a
  guastarsi.
- **La regola di sicurezza copre l'applicazione, non il perimetro.** Aggrega i
  due eventi strutturati che il backend emette sul tema — quota per sessione
  superata e prova di lavoro richiesta — i cui nomi di campo vengono dal codice
  e non da un'ipotesi sull'ingestione. Gli allarmi di CrowdSec restano fuori:
  arrivano come testo nei log dei container, e distinguerli richiede
  l'instradamento per dataset che oggi non c'e'. Quando ci sara', e' la seconda
  sorgente naturale della stessa classe.
- Le soglie di `latency_threshold_ms`, `error_rate_threshold` e
  `security_events_threshold` sono segnaposto fino al load test: sono tarate per
  non allarmare su un servizio sano, non per cogliere un degrado reale. Quella
  sulla sicurezza in particolare va tenuta sopra il rumore di un'apertura al
  pubblico, dove la prova di lavoro viene richiesta di continuo dall'uso
  legittimo.
- Gli identificativi delle funzionalita' in `funzionalita_disattivate_*`
  dipendono dalla versione di Kibana: confrontarli con `GET /api/features`
  sull'istanza in uso. Un identificativo errato lascia visibile una voce di menu
  che il ruolo comunque non autorizza.
