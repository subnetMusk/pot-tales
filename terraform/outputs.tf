output "server_ip" {
  description = "IP pubblico IPv4 del server"
  value       = hcloud_server.app.ipv4_address
}

output "server_status" {
  description = "Stato del server"
  value       = hcloud_server.app.status
}
