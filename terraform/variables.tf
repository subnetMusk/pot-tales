variable "hcloud_token" {
  description = "Token API di Hetzner Cloud"
  type        = string
  sensitive   = true
}

variable "server_name" {
  description = "Nome del server"
  type        = string
  default     = "progetti-innovativi"
}

variable "server_type" {
  description = "Tipo di server Hetzner. Lo stack (ELK incluso) vuole >= 4GB RAM."
  type        = string
  default     = "cpx21" # 3 vCPU, 4GB RAM
}

variable "location" {
  description = "Datacenter Hetzner (nbg1, fsn1, hel1, ...)"
  type        = string
  default     = "nbg1"
}

variable "image" {
  description = "Immagine base del server"
  type        = string
  default     = "ubuntu-24.04"
}

variable "ssh_public_key" {
  description = "Chiave pubblica SSH autorizzata all'accesso"
  type        = string
}

variable "admin_ip" {
  description = "CIDR autorizzato per SSH (es. 1.2.3.4/32). Default aperto: da restringere."
  type        = string
  default     = "0.0.0.0/0"
}
