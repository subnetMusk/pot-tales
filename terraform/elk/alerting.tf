# ============================================================
# Regole di alerting e canale di notifica
# ------------------------------------------------------------
# Definite come risorse versionate cosi' da essere ricreabili su una
# istanza Kibana vuota senza configurazione manuale.
#
# Con licenza basic gli unici connettori abilitati sono `.index` e
# `.server-log`; webhook, email e i connettori verso servizi esterni
# richiedono almeno gold. Verificato interrogando
# /api/actions/connector_types sull'istanza in uso.
#
# Le regole scrivono quindi su un indice dedicato, e la consegna verso
# l'esterno e' compito del processo di notifica che gira fuori dalla
# macchina. Non e' un ripiego: quel processo serve comunque, perche' un
# notificatore che vive sulla stessa macchina che sta monitorando tace
# proprio quando la macchina non risponde.
#
# Ogni documento dichiara due campi che il notificatore usa per instradare:
#
#   check    classe di guasto a cui l'allarme appartiene. Le notifiche del
#            servizio esterno sono legate alla transizione di stato: su una
#            destinazione unica, un allarme che arriva mentre la precedente
#            e' ancora in guasto non produrrebbe alcuna notifica.
#   status   `alert` porta la classe in guasto, `recovered` la riarma. Senza
#            l'azione di rientro una classe resterebbe in guasto per sempre
#            dopo il primo allarme, e il secondo passerebbe in silenzio.
# ============================================================

resource "elasticstack_kibana_action_connector" "alert_index" {
  name              = "alert-index"
  connector_type_id = ".index"

  config = jsonencode({
    index              = var.alert_index
    refresh            = true
    executionTimeField = "@timestamp"
  })
}

# ---------- Tasso di errori del backend ----------

resource "elasticstack_kibana_alerting_rule" "error_rate" {
  name         = "Backend: tasso di errori"
  consumer     = "alerts"
  rule_type_id = ".es-query"
  interval     = "1m"
  enabled      = true
  notify_when  = "onActionGroupChange"
  tags         = ["backend", "degrado"]

  params = jsonencode({
    searchType          = "esQuery"
    index               = var.logs_index_pattern
    timeField           = "@timestamp"
    timeWindowSize      = 5
    timeWindowUnit      = "m"
    threshold           = [var.error_rate_threshold]
    thresholdComparator = ">"
    size                = 0
    esQuery = jsonencode({
      query = {
        bool = {
          filter = [
            { term = { "log.level" = "error" } }
          ]
        }
      }
    })
  })

  actions {
    id    = elasticstack_kibana_action_connector.alert_index.connector_id
    group = "query matched"
    params = jsonencode({
      documents = [{
        severity = "warning"
        rule     = "backend_error_rate"
        check    = "app-degradation"
        status   = "alert"
        message  = "Tasso di errori del backend sopra ${var.error_rate_threshold} in 5 minuti"
      }]
    })
  }

  actions {
    id    = elasticstack_kibana_action_connector.alert_index.connector_id
    group = "recovered"
    params = jsonencode({
      documents = [{
        severity = "info"
        rule     = "backend_error_rate"
        check    = "app-degradation"
        status   = "recovered"
        message  = "Tasso di errori del backend rientrato sotto ${var.error_rate_threshold}"
      }]
    })
  }
}

# ---------- Assenza di ingestione ----------
#
# Se la pipeline di log si interrompe, le altre regole smettono di
# valutare dati nuovi e non producono allarmi. Questa regola rileva la
# condizione osservando l'assenza di documenti nella finestra.

resource "elasticstack_kibana_alerting_rule" "ingest_fermo" {
  name         = "Osservabilita': ingestione ferma"
  consumer     = "alerts"
  rule_type_id = ".es-query"
  interval     = "5m"
  enabled      = true
  notify_when  = "onActionGroupChange"
  tags         = ["osservabilita", "critico"]

  params = jsonencode({
    searchType          = "esQuery"
    index               = var.logs_index_pattern
    timeField           = "@timestamp"
    timeWindowSize      = 15
    timeWindowUnit      = "m"
    threshold           = [1]
    thresholdComparator = "<"
    size                = 0
    esQuery             = jsonencode({ query = { match_all = {} } })
  })

  actions {
    id    = elasticstack_kibana_action_connector.alert_index.connector_id
    group = "query matched"
    params = jsonencode({
      documents = [{
        severity = "critical"
        rule     = "ingest_stalled"
        check    = "observability"
        status   = "alert"
        message  = "Nessun log ricevuto negli ultimi 15 minuti: pipeline di ingestione ferma"
      }]
    })
  }

  actions {
    id    = elasticstack_kibana_action_connector.alert_index.connector_id
    group = "recovered"
    params = jsonencode({
      documents = [{
        severity = "info"
        rule     = "ingest_stalled"
        check    = "observability"
        status   = "recovered"
        message  = "Ingestione dei log ripresa"
      }]
    })
  }
}

# ---------- Latenza delle transazioni ----------
#
# Il tasso di errori vede solo i guasti dichiarati. Un servizio che risponde
# lentamente non produce alcun errore e resta invisibile a quella regola, pur
# essendo indistinguibile da un guasto per chi sta giocando.
#
# La media si calcola su `traces-apm-*`, che contiene transazioni e span. Solo
# le transazioni portano `transaction.duration.us`: i documenti che non lo
# hanno sono ignorati dall'aggregazione, quindi non serve filtrarli e non
# esiste il rischio di una regola che filtra su un campo sbagliato e tace.
#
# La soglia e' in millisecondi per leggibilita' e viene convertita: APM registra
# le durate in microsecondi.

resource "elasticstack_kibana_alerting_rule" "latenza" {
  name         = "Backend: latenza delle transazioni"
  consumer     = "alerts"
  rule_type_id = ".index-threshold"
  interval     = "1m"
  enabled      = true
  notify_when  = "onActionGroupChange"
  tags         = ["backend", "degrado"]

  params = jsonencode({
    index               = [var.traces_index_pattern]
    timeField           = "@timestamp"
    aggType             = "avg"
    aggField            = "transaction.duration.us"
    groupBy             = "all"
    timeWindowSize      = 5
    timeWindowUnit      = "m"
    thresholdComparator = ">"
    threshold           = [var.latency_threshold_ms * 1000]
  })

  actions {
    id    = elasticstack_kibana_action_connector.alert_index.connector_id
    group = "threshold met"
    params = jsonencode({
      documents = [{
        severity = "warning"
        rule     = "transaction_latency"
        check    = "app-degradation"
        status   = "alert"
        message  = "Latenza media delle transazioni sopra ${var.latency_threshold_ms} ms in 5 minuti"
      }]
    })
  }

  actions {
    id    = elasticstack_kibana_action_connector.alert_index.connector_id
    group = "recovered"
    params = jsonencode({
      documents = [{
        severity = "info"
        rule     = "transaction_latency"
        check    = "app-degradation"
        status   = "recovered"
        message  = "Latenza media delle transazioni rientrata sotto ${var.latency_threshold_ms} ms"
      }]
    })
  }
}

# ---------- Occupazione del disco ----------
#
# Duplica deliberatamente il controllo locale del battito, e non e' ridondanza
# inutile: i due percorsi si guastano in modo indipendente. Il battito tace
# quando la macchina non parla, questa regola tace quando l'ingestione si ferma.
# Un disco che si riempie e' esattamente la condizione che puo' produrre l'uno o
# l'altro silenzio, quindi vale la pena osservarla da entrambi i lati.
#
# Il raggruppamento e' per punto di mount: sapere *quale* filesystem si sta
# riempiendo e' meta' della diagnosi, e su questa macchina i dati Docker e il
# sistema stanno su volumi separati proprio perche' si riempiano separatamente.

resource "elasticstack_kibana_alerting_rule" "disco" {
  name         = "Host: occupazione del disco"
  consumer     = "alerts"
  rule_type_id = ".index-threshold"
  interval     = "5m"
  enabled      = true
  notify_when  = "onActionGroupChange"
  tags         = ["host", "risorse"]

  params = jsonencode({
    index               = [var.filesystem_index_pattern]
    timeField           = "@timestamp"
    aggType             = "max"
    aggField            = "system.filesystem.used.pct"
    groupBy             = "top"
    termField           = "system.filesystem.mount_point"
    termSize            = 10
    timeWindowSize      = 10
    timeWindowUnit      = "m"
    thresholdComparator = ">"
    # La metrica e' una frazione fra 0 e 1, la soglia e' espressa in percentuale.
    threshold = [var.disk_watermark_pct / 100]
  })

  actions {
    id    = elasticstack_kibana_action_connector.alert_index.connector_id
    group = "threshold met"
    params = jsonencode({
      documents = [{
        severity = "warning"
        rule     = "disk_watermark"
        check    = "host-resources"
        status   = "alert"
        message  = "Punto di mount {{context.group}} oltre il ${var.disk_watermark_pct}% di occupazione"
      }]
    })
  }

  actions {
    id    = elasticstack_kibana_action_connector.alert_index.connector_id
    group = "recovered"
    params = jsonencode({
      documents = [{
        severity = "info"
        rule     = "disk_watermark"
        check    = "host-resources"
        status   = "recovered"
        message  = "Punto di mount {{context.group}} rientrato sotto il ${var.disk_watermark_pct}%"
      }]
    })
  }
}

# ---------- Attivita' anomala dell'applicazione ----------
#
# E' la classe `security`, che fino a qui non aveva alcun produttore: il check
# corrispondente sul servizio di sorveglianza restava senza un solo ping, e
# cinque check verdi facevano credere sorvegliato anche cio' che non lo era.
#
# La regola aggrega i due eventi che il backend emette quando qualcuno insiste
# oltre il lecito: il superamento della quota per sessione e la richiesta di una
# prova di lavoro sulla creazione. Sono gli unici due segnali strutturati che
# l'applicazione produce sul tema, e i nomi dei campi vengono dal codice
# (`event.category` ed `event.action`, che `logWithCategory` scrive su ogni
# riga) invece che da un'ipotesi sull'ingestione.
#
# `session_create_pow_accepted` e' deliberatamente escluso: e' il percorso di
# successo, cioe' qualcuno che ha risolto la prova ed e' entrato. Contarlo
# significherebbe allarmare sull'uso legittimo sotto carico, che durante
# un'apertura al pubblico e' la condizione normale.
#
# Il perimetro non e' coperto da qui. CrowdSec osserva gli access log e produce
# allarmi senza decisioni, ma i suoi eventi arrivano come testo nei log dei
# container: distinguerli richiede un instradamento per dataset che oggi non
# c'e'. Quando ci sara', e' la seconda sorgente naturale di questa classe.

resource "elasticstack_kibana_alerting_rule" "sicurezza" {
  name         = "Applicazione: attivita' anomala"
  consumer     = "alerts"
  rule_type_id = ".es-query"
  interval     = "5m"
  enabled      = true
  notify_when  = "onActionGroupChange"
  tags         = ["sicurezza", "contenimento"]

  params = jsonencode({
    searchType          = "esQuery"
    index               = var.logs_index_pattern
    timeField           = "@timestamp"
    timeWindowSize      = 10
    timeWindowUnit      = "m"
    threshold           = [var.security_events_threshold]
    thresholdComparator = ">"
    size                = 0
    esQuery = jsonencode({
      query = {
        bool = {
          filter = [
            { term = { "event.category" = "security" } },
            { terms = { "event.action" = ["session_quota_exceeded", "session_create_pow_required"] } }
          ]
        }
      }
    })
  })

  actions {
    id    = elasticstack_kibana_action_connector.alert_index.connector_id
    group = "query matched"
    params = jsonencode({
      documents = [{
        severity = "warning"
        rule     = "app_abuse"
        check    = "security"
        status   = "alert"
        message  = "Oltre ${var.security_events_threshold} eventi di contenimento in 10 minuti: quota per sessione superata o prova di lavoro richiesta"
      }]
    })
  }

  actions {
    id    = elasticstack_kibana_action_connector.alert_index.connector_id
    group = "recovered"
    params = jsonencode({
      documents = [{
        severity = "info"
        rule     = "app_abuse"
        check    = "security"
        status   = "recovered"
        message  = "Eventi di contenimento rientrati sotto ${var.security_events_threshold} in 10 minuti"
      }]
    })
  }
}
