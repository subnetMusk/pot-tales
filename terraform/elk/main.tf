# ============================================================
# ELK as-code: configurazione dello stack Elastic via Terraform
# ------------------------------------------------------------
# Risolve i punti fragili documentati in MONITORING_SETUP.md:
#  - utenza dedicata per Filebeat (niente superuser elastic)   [fragilita' 5]
#  - Fleet policy + enrollment token generati, non hardcoded   [fragilita' 2]
#  - retention dei log (ILM) definita e versionata
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

  input {
    input_id = "apm-apm"
    vars_json = jsonencode({
      host         = "0.0.0.0:8200"
      url          = "http://apm.localhost"
      secret_token = var.apm_secret_token
      enable_rum   = true
    })
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
  name    = "docker"
  version = var.docker_package_version
}

resource "elasticstack_fleet_integration_policy" "docker" {
  name                = "docker-metrics"
  namespace           = "default"
  agent_policy_id     = elasticstack_fleet_agent_policy.infra.policy_id
  integration_name    = elasticstack_fleet_integration.docker.name
  integration_version = elasticstack_fleet_integration.docker.version
}

# ---------- Enrollment token (input per il .env) ----------

data "elasticstack_fleet_enrollment_tokens" "apm" {
  policy_id = elasticstack_fleet_agent_policy.apm.policy_id
}

data "elasticstack_fleet_enrollment_tokens" "infra" {
  policy_id = elasticstack_fleet_agent_policy.infra.policy_id
}
