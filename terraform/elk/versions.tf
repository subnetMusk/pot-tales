terraform {
  required_version = ">= 1.5"
  required_providers {
    elasticstack = {
      source  = "elastic/elasticstack"
      version = "~> 0.11"
    }
  }
}

# Configura ES e Kibana gia' AVVIATI (docker-compose.monitoring.yml):
# questo modulo gestisce la configurazione dello stack, non il provisioning.
provider "elasticstack" {
  elasticsearch {
    endpoints = [var.elasticsearch_endpoint]
    username  = var.elastic_username
    password  = var.elastic_password
    insecure  = var.insecure_tls # cert self-signed del setup dev
  }
  kibana {
    endpoints = [var.kibana_endpoint]
    username  = var.elastic_username
    password  = var.elastic_password
    insecure  = var.insecure_tls
  }
}
