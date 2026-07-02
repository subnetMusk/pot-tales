# Infrastruttura (Terraform / Hetzner Cloud)

Skeleton IaC per provisionare un server Hetzner che ospita lo stack Docker.
La configurazione dello stack Elastic (Fleet policy, utenti, retention) e' nel
modulo separato [elk/](elk/README.md).

## Cosa crea

- Una chiave SSH (`hcloud_ssh_key`)
- Un firewall (`hcloud_firewall`): SSH limitato a `admin_ip`, 80/443 pubblici
- Un server (`hcloud_server`) con cloud-init che installa Docker + Compose

## Uso

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars   # compila i valori reali
terraform init
terraform plan
terraform apply
```

L'IP del server è negli output (`terraform output server_ip`).

## Note

- Lo stack richiede >= 4GB RAM (ELK): il default `cpx21` è il minimo sensato.
- Questo skeleton si ferma al provisioning dell'host. Il deploy applicativo
  (clone repo, `.env` di produzione, `docker compose up`) va aggiunto dopo aver
  riallineato `docker-compose.prod.yml` allo stack attuale (Go + Traefik).
- Lo stato Terraform (`*.tfstate`) e `terraform.tfvars` non vanno versionati
  (vedi `.gitignore`). Per il lavoro in team valutare un backend remoto.
