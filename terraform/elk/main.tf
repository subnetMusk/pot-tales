# ============================================================
# Configurazione dello stack Elastic via Terraform
# ------------------------------------------------------------
# Gestisce come risorse versionate:
#  - utenza dedicata per Filebeat, con privilegi minimi
#  - policy Fleet ed enrollment token, generati anziche' fissati
#  - politica di retention dei log (ILM)
# ============================================================

# ---------- Utente dedicato per Filebeat ----------

resource "elasticstack_elasticsearch_security_role" "filebeat_writer" {
  name    = "filebeat_writer"
  cluster = ["monitor", "read_ilm", "read_pipeline"]

  indices {
    names      = ["filebeat-*", "logs-*"]
    privileges = ["auto_configure", "create_doc", "create_index", "view_index_metadata"]
  }
}

resource "elasticstack_elasticsearch_security_user" "filebeat" {
  username = "filebeat_writer"
  password = var.filebeat_password
  roles    = [elasticstack_elasticsearch_security_role.filebeat_writer.name]
}

# ---------- Retention log (ILM) ----------

resource "elasticstack_elasticsearch_index_lifecycle" "logs" {
  name = "game-logs-retention"

  hot {
    min_age = "0ms"
    rollover {
      max_age                = "1d"
      max_primary_shard_size = "5gb"
    }
  }

  delete {
    min_age = var.log_retention
    delete {}
  }
}

# ---------- Fleet: destinazione dei dati ----------
#
# Senza questa risorsa gli agenti usano la destinazione predefinita di Kibana,
# che punta a localhost: dentro un container quell'indirizzo e' il container
# stesso, quindi la connessione a Elasticsearch fallisce. E' una configurazione
# che va dichiarata, non ereditata.

resource "elasticstack_fleet_output" "default" {
  name                 = "elasticsearch-interno"
  type                 = "elasticsearch"
  hosts                = [var.fleet_output_host]
  default_integrations = true
  default_monitoring   = true

  config_yaml = yamlencode({
    "ssl.certificate_authorities" = [var.fleet_output_ca]
  })
}

# ---------- Fleet: policy del Fleet Server ----------
#
# Dichiarata qui con un identificativo esplicito invece di dipendere dalla
# policy che Kibana crea automaticamente: l'identificativo e' cosi' noto prima
# dell'avvio e puo' essere passato all'agente che assume il ruolo di server.

resource "elasticstack_fleet_agent_policy" "fleet_server" {
  name            = "fleet-server-policy"
  policy_id       = "fleet-server-policy"
  namespace       = "default"
  description     = "Policy dell'agente che esegue il Fleet Server"
  monitor_logs    = true
  monitor_metrics = true
}

resource "elasticstack_fleet_integration" "fleet_server" {
  name    = "fleet_server"
  version = var.fleet_server_package_version
}

resource "elasticstack_fleet_integration_policy" "fleet_server" {
  name                = "fleet-server"
  namespace           = "default"
  agent_policy_id     = elasticstack_fleet_agent_policy.fleet_server.policy_id
  integration_name    = elasticstack_fleet_integration.fleet_server.name
  integration_version = elasticstack_fleet_integration.fleet_server.version
}

# ---------- Fleet: policy APM ----------

resource "elasticstack_fleet_agent_policy" "apm" {
  name            = "apm-policy"
  namespace       = "default"
  description     = "Policy per l'agent che esegue il server APM"
  monitor_logs    = true
  monitor_metrics = true
}

resource "elasticstack_fleet_integration" "apm" {
  name    = "apm"
  version = var.apm_package_version
}

resource "elasticstack_fleet_integration_policy" "apm" {
  name                = "apm-server"
  namespace           = "default"
  agent_policy_id     = elasticstack_fleet_agent_policy.apm.policy_id
  integration_name    = elasticstack_fleet_integration.apm.name
  integration_version = elasticstack_fleet_integration.apm.version

  # Dal provider 0.16 il blocco `input { input_id = ... }` e' sostituito dalla
  # mappa `inputs`.
  inputs = {
    "apmserver-apm" = {
      vars = jsonencode({
        host         = "0.0.0.0:8200"
        url          = var.apm_server_url
        secret_token = var.apm_secret_token
        enable_rum   = true
        # Queste chiavi provengono dalla specifica del package APM esposta da
        # Kibana. Le variabili d'ambiente del container non modificano una
        # configurazione distribuita da Fleet.
        tls_enabled     = true
        tls_certificate = "/usr/share/elastic-agent/certs/apm-agent/apm-agent.crt"
        tls_key         = "/usr/share/elastic-agent/certs/apm-agent/apm-agent.key"
      })
    }
  }
}

# ---------- Fleet: policy Infra (system + docker) ----------

resource "elasticstack_fleet_agent_policy" "infra" {
  name            = "infra-policy"
  namespace       = "default"
  description     = "Policy per il monitoraggio host e container"
  monitor_logs    = true
  monitor_metrics = true
}

resource "elasticstack_fleet_integration" "system" {
  name    = "system"
  version = var.system_package_version
}

resource "elasticstack_fleet_integration_policy" "system" {
  name                = "system-metrics"
  namespace           = "default"
  agent_policy_id     = elasticstack_fleet_agent_policy.infra.policy_id
  integration_name    = elasticstack_fleet_integration.system.name
  integration_version = elasticstack_fleet_integration.system.version
}

resource "elasticstack_fleet_integration" "docker" {
  name = "docker"
  # Kibana 8.19 rifiuta 2.15.2 come non piu' installabile. La versione e' stata
  # letta dall'endpoint EPM della stessa istanza su cui viene applicata.
  version = "2.15.3"
}

resource "elasticstack_fleet_integration_policy" "docker" {
  name                = "docker-metrics"
  namespace           = "default"
  agent_policy_id     = elasticstack_fleet_agent_policy.infra.policy_id
  integration_name    = elasticstack_fleet_integration.docker.name
  integration_version = elasticstack_fleet_integration.docker.version

  # Gli identificatori di input e stream e la variabile `hosts` sono quelli
  # esposti dalla specifica del package Docker installato su Kibana. La policy
  # indirizza ogni metricset al proxy e non al socket locale dell'agent.
  inputs = {
    "docker-docker/metrics" = {
      streams = {
        "docker.container" = {
          vars = jsonencode({ hosts = ["tcp://socket-proxy:2375"] })
        }
        "docker.cpu" = {
          vars = jsonencode({ hosts = ["tcp://socket-proxy:2375"] })
        }
        "docker.diskio" = {
          vars = jsonencode({ hosts = ["tcp://socket-proxy:2375"] })
        }
        "docker.event" = {
          vars = jsonencode({ hosts = ["tcp://socket-proxy:2375"] })
        }
        "docker.healthcheck" = {
          vars = jsonencode({ hosts = ["tcp://socket-proxy:2375"] })
        }
        "docker.image" = {
          enabled = false
          vars    = jsonencode({ hosts = ["tcp://socket-proxy:2375"] })
        }
        "docker.info" = {
          vars = jsonencode({ hosts = ["tcp://socket-proxy:2375"] })
        }
        "docker.memory" = {
          vars = jsonencode({ hosts = ["tcp://socket-proxy:2375"] })
        }
        "docker.network" = {
          vars = jsonencode({ hosts = ["tcp://socket-proxy:2375"] })
        }
      }
    }
  }
}

# ---------- Enrollment token (input per il .env) ----------

data "elasticstack_fleet_enrollment_tokens" "apm" {
  policy_id = elasticstack_fleet_agent_policy.apm.policy_id
}

data "elasticstack_fleet_enrollment_tokens" "infra" {
  policy_id = elasticstack_fleet_agent_policy.infra.policy_id
}

data "elasticstack_fleet_enrollment_tokens" "fleet_server" {
  policy_id = elasticstack_fleet_agent_policy.fleet_server.policy_id
}
