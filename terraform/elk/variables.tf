variable "elasticsearch_endpoint" {
  description = "Endpoint HTTPS di Elasticsearch raggiungibile da dove gira Terraform. In dev, pubblicare temporaneamente la porta di es01 (es. https://localhost:9200) o eseguire da un container su internal_net."
  type        = string
  default     = "https://localhost:9200"
}

variable "kibana_endpoint" {
  description = "Endpoint di Kibana (via Traefik in dev)"
  type        = string
  default     = "http://kibana.localhost"
}

variable "elastic_username" {
  description = "Utente amministrativo Elastic"
  type        = string
  default     = "elastic"
}

variable "elastic_password" {
  description = "Password dell'utente elastic (stessa di ELASTIC_PASSWORD nel .env)"
  type        = string
  sensitive   = true
}

variable "insecure_tls" {
  description = "Salta la verifica TLS (cert self-signed di sviluppo). In prod: false + CA."
  type        = bool
  default     = true
}

variable "filebeat_password" {
  description = "Password per l'utente dedicato filebeat_writer (sostituisce il superuser elastic in filebeat.yml)"
  type        = string
  sensitive   = true
}

variable "apm_secret_token" {
  description = "Secret token del server APM (stesso di APM_SECRET_TOKEN nel .env)"
  type        = string
  sensitive   = true
}

variable "apm_package_version" {
  description = "Versione del package Fleet 'apm' (allineata a STACK_VERSION)"
  type        = string
  default     = "8.19.19"
}

variable "apm_server_url" {
  description = "URL con cui gli agenti RUM raggiungono il server APM."
  type        = string
  default     = "http://apm.localhost"
}

# ---------- Alerting ----------

variable "telegram_webhook_url" {
  description = "URL completo della Bot API di Telegram, token incluso: https://api.telegram.org/bot<TOKEN>/sendMessage. E' un segreto perche' contiene il token."
  type        = string
  sensitive   = true
}

variable "telegram_chat_id" {
  description = "Identificativo della chat Telegram che riceve le notifiche."
  type        = string
  sensitive   = true
}

variable "logs_index_pattern" {
  description = "Pattern degli indici su cui valutano le regole di alerting"
  type        = string
  default     = "logs-*"
}

variable "error_rate_threshold" {
  description = "Numero di eventi di livello error in 5 minuti oltre il quale scatta l'allarme. Da tarare sul carico osservato."
  type        = number
  default     = 25
}




variable "fleet_server_package_version" {
  description = "Versione del package Fleet 'fleet_server'"
  type        = string
  default     = "1.5.0"
}

variable "system_package_version" {
  description = "Versione del package Fleet 'system'"
  type        = string
  default     = "1.62.1"
}

variable "docker_package_version" {
  description = "Versione del package Fleet 'docker'"
  type        = string
  default     = "2.11.0"
}

variable "log_retention" {
  description = "Retention dei log applicativi prima della cancellazione (fase delete ILM)"
  type        = string
  default     = "14d"
}
