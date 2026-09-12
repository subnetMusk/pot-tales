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

output "fleet_enrollment_token_server" {
  description = "Valore per FLEET_ENROLLMENT_TOKEN nel .env"
  value       = data.elasticstack_fleet_enrollment_tokens.fleet_server.tokens[0].api_key
  sensitive   = true
}

output "fleet_server_policy_id" {
  description = "Valore per FLEET_SERVER_POLICY_ID nel .env"
  value       = elasticstack_fleet_agent_policy.fleet_server.policy_id
}

output "filebeat_username" {
  description = "Utente dedicato da usare in filebeat.yml al posto di elastic"
  value       = elasticstack_elasticsearch_security_user.filebeat.username
}
