# ============================================================
# Regole di alerting e canale di notifica
# ------------------------------------------------------------
# Definite come risorse versionate cosi' da essere ricreabili su una
# istanza Kibana vuota senza configurazione manuale.
#
# Kibana non dispone di un connettore Telegram nativo: si usa il
# connettore webhook generico verso la Bot API.
# ============================================================

resource "elasticstack_kibana_action_connector" "telegram" {
  name              = "telegram-degrado"
  connector_type_id = ".webhook"

  # L'URL contiene il token del bot ed e' quindi un valore sensibile.
  config = jsonencode({
    url     = var.telegram_webhook_url
    method  = "post"
    hasAuth = false
    headers = {
      "Content-Type" = "application/json"
    }
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
    id    = elasticstack_kibana_action_connector.telegram.connector_id
    group = "query matched"
    params = jsonencode({
      body = jsonencode({
        chat_id = var.telegram_chat_id
        text    = "[DEGRADO] Backend: tasso di errori sopra ${var.error_rate_threshold} in 5 minuti."
      })
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
    id    = elasticstack_kibana_action_connector.telegram.connector_id
    group = "query matched"
    params = jsonencode({
      body = jsonencode({
        chat_id = var.telegram_chat_id
        text    = "[CRITICO] Nessun log ricevuto negli ultimi 15 minuti: la pipeline di ingestione e' ferma."
      })
    })
  }
}
