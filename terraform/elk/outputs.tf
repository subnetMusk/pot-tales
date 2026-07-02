output "fleet_enrollment_token_apm" {
  description = "Valore per FLEET_ENROLLMENT_TOKEN_APM nel .env"
  value       = data.elasticstack_fleet_enrollment_tokens.apm.tokens[0].api_key
  sensitive   = true
}

output "fleet_enrollment_token_infra" {
  description = "Valore per FLEET_ENROLLMENT_TOKEN_INFRA nel .env"
  value       = data.elasticstack_fleet_enrollment_tokens.infra.tokens[0].api_key
  sensitive   = true
}

output "filebeat_username" {
  description = "Utente dedicato da usare in filebeat.yml al posto di elastic"
  value       = elasticstack_elasticsearch_security_user.filebeat.username
}
