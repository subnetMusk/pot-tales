# ELK as-code (provider elasticstack)

Configura via API uno stack Elastic già avviato: Compose in sviluppo, Swarm
in produzione. Il bootstrap automatico tramite `scripts/fleet-bootstrap.sh`
segue il percorso di produzione; l’applicazione locale è descritta sotto. L'host non è provisionato da
Terraform: è una macchina dedicata, preparata dagli script in `provisioning/`.
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
- Fleet: agent policy `fleet-server-policy` (integration `fleet_server`),
  `apm-policy` (con integration APM: host, RUM, secret token) e `infra-policy`
  (integration system + docker).
- Enrollment token generati per policy, esposti come output: in sviluppo
  si scrivono nei file `.env.fleet.server`, `.env.fleet.apm` e `.env.fleet.infra`; in
  produzione `fleet-bootstrap.sh` li scrive sul volume `${STACK_NAME}_fleettokens`.
- Space `esercizio` e `evento`, con i rispettivi ruoli in sola lettura, data
  view e utenze di consultazione (`spaces.tf`).
- Reimportazione degli export delle dashboard versionati in
  [dashboards/](dashboards/README.md) (`dashboards.tf`).

## Le due platee

Le dashboard servono due pubblici con esigenze opposte: la vista di esercizio,
tecnica e non distribuibile, e la vista divulgativa sull'andamento dell'evento,
destinata alla condivisione. Sono due Space distinti, ognuno con un ruolo in
sola lettura limitato a una data view.

Entrambe le platee possono usare Discover entro il proprio confine di indice:
quella tecnica per diagnosticare log, metriche e tracce; quella evento per
consultare i soli fatti di gioco pseudonimizzati dietro gli aggregati.

La separazione è affidata al **ruolo**, non allo Space: nascondere
funzionalità a livello di Space rende l'interfaccia più leggibile, ma la
documentazione Elastic dichiara che il controllo di visibilità delle
funzionalità non è una misura di sicurezza. I ruoli sono scritti perché
reggano da soli.

### Corrispondenza fra utenze Terraform ed elenchi htpasswd

Il bordo Traefik e Kibana devono verificare la stessa credenziale. Lo
strumento `configure-dashboard-users.py` produce i file di configurazione
coerenti per entrambi.

I router in `deploy/config/dynamic/` verificano la credenziale con basicAuth e
**non rimuovono** l'intestazione di autorizzazione: la stessa credenziale
prosegue verso Kibana e vi autentica l'utente. La credenziale del visitatore
**è** la sua credenziale Kibana.

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
`provisioning/bin/configure-dashboard-users.py`. Non è un Docker secret e non
viene montata nei servizi: entra soltanto nel contenitore Terraform effimero
durante il bootstrap. Va inclusa nella custodia off-host dei segreti, mai negli
export destinati alle dashboard.

Il terzo file copre le risorse comuni ai due Space e deve contenere l'unione
delle due platee.

Un nome presente solo nell'htpasswd supera il bordo e viene respinto da Kibana:
l'utente vede una richiesta di credenziali che non si chiude mai. Un nome
presente solo in Terraform non supera il bordo. Il disallineamento non è
rilevabile da questo modulo, perché i file htpasswd contengono impronte e non
password.

### Confine fra le due platee

Con licenza basic la sicurezza a livello di documento e di campo non è
disponibile: non esiste modo di concedere un sottoinsieme di documenti dentro un
indice condiviso. Il confine è quindi **sull’indice**: `indici_evento`
deve comprendere soltanto i fatti di gioco (`logs-gioco.partita-*`), senza log
tecnici, metriche o tracce. `indici_esercizio` comprende anche i fatti di gioco
attraverso `logs-*`: questa sovrapposizione è intenzionale e consente la diagnosi
tecnica. È l’ampliamento di `indici_evento` ai dataset tecnici che violerebbe
il confine fra le platee.

## Applicazione della configurazione

- **Produzione:** [installazione e bootstrap systemd](../../provisioning/README.md#avvio-non-presidiato).
  `fleet-bootstrap.sh` applica l’intero modulo e scrive i token sul volume
  `${STACK_NAME}_fleettokens`; per rieseguirlo usare
  `sudo systemctl restart fleet-bootstrap.service`.
- **Sviluppo:** [bootstrap locale manuale](../../docs/MONITORING_LOCALE.md).
  Elasticsearch e Kibana non pubblicano le rispettive porte sull’host;
  Terraform richiede rete ed endpoint espliciti. I token letti da Compose
  vivono nei tre file `.env.fleet.*`, non nel `.env`.

Dopo l’apply verificare login per entrambe le platee, accesso ai soli indici
assegnati, data view con `@timestamp` e tutte le dashboard attese. La presenza
delle risorse Terraform non prova la correttezza degli accessi reali.

## Note e limiti

- A ogni aggiornamento dello stack verificare con `terraform plan` che gli
  schemi (in particolare l'input della integration APM, che varia con la
  versione del package) combacino con la versione del provider/stack. Allineare
  `apm_package_version` a `STACK_VERSION`.
- In sviluppo la rete `internal_net` non ha uscita internet. La procedura locale
  usa `proxy_net` per scaricare i provider e raggiungere le API, collegandovi
  temporaneamente Elasticsearch senza pubblicare porte sull’host.
- Lo stato Terraform contiene in chiaro password, token ed enrollment token.
  Dove risiede, cosa comporta perderlo e come si ricostruisce: [../README.md](../README.md).
- **Stato del cluster: non osservabile con le integrazioni installate.** Le
  policy Fleet dichiarano `fleet_server`, `apm`, `system` e `docker`. Nessuna di
  queste indicizza la salute del cluster, quindi una regola su quel tema
  interrogherebbe indici che non esistono, e una regola senza dati non fallisce:
  resta silenziosa per sempre. Servirebbe aggiungere l'integrazione
  `elasticsearch` alla policy infrastrutturale, che è una decisione di
  architettura e non una regola in più: porta un agente che interroga il
  cluster con credenziali proprie e consuma parte di un budget di memoria già
  stretto.

  Il controllo resta coperto: lo stato del cluster è già sorvegliato da
  `stack-heartbeat.sh`, che lo interroga direttamente e recapita sulla classe
  `observability`. Il controllo vive
  fuori da Elasticsearch e può segnalarne un guasto mentre l’host risponde.
- **La regola di sicurezza copre l'applicazione, non il perimetro.** Aggrega i
  due eventi strutturati che il backend emette sul tema (quota per sessione
  superata e prova di lavoro richiesta), i cui nomi di campo vengono dal codice
  e non da un'ipotesi sull'ingestione. Gli allarmi di CrowdSec restano fuori:
  arrivano come testo nei log dei container, e distinguerli richiede un
  instradamento per dataset che riguarda soltanto i fatti di partita.
  Esteso a CrowdSec, sarebbe la seconda sorgente naturale della stessa classe.
- Le soglie di `latency_threshold_ms`, `error_rate_threshold` e
  `security_events_threshold` sono segnaposto fino al load test: sono tarate per
  non allarmare su un servizio sano, non per cogliere un degrado reale. Quella
  sulla sicurezza in particolare va tenuta sopra il rumore di un'apertura al
  pubblico, dove la prova di lavoro viene richiesta di continuo dall'uso
  legittimo.
- Gli identificativi delle funzionalità in `funzionalita_disattivate_*`
  dipendono dalla versione di Kibana: confrontarli con `GET /api/features`
  sull'istanza in uso. Un identificativo errato lascia visibile una voce di menu
  che il ruolo comunque non autorizza.
