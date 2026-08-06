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
    index               = [var.logs_index_pattern]
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
        message  = "Tasso di errori del backend sopra ${var.error_rate_threshold} in 5 minuti"
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
    index               = [var.logs_index_pattern]
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
        message  = "Nessun log ricevuto negli ultimi 15 minuti: pipeline di ingestione ferma"
      }]
    })
  }
}
