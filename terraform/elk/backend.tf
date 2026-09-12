# Collocazione dello stato.
#
# Stato locale, senza backend remoto: un solo host, un solo operatore, nessun
# altro punto da cui l'apply possa partire. Le ragioni della scelta, e cosa
# comporta in termini di conservazione e di ricostruzione, sono in
# ../README.md.
#
# Il blocco e' dichiarato vuoto di proposito. Il percorso non appartiene al
# codice: dipende dalla macchina, e scriverlo qui costringerebbe a modificarlo
# per lavorare altrove. Si passa a `init`:
#
#   terraform init -backend-config=path=/var/lib/pi-terraform/elk/terraform.tfstate
#
# Senza l'argomento Terraform usa `terraform.tfstate` nella directory corrente:
# accettabile per una prova locale, non per la macchina in servizio, dove lo
# stato deve stare fuori dalla copia di lavoro.
terraform {
  backend "local" {}
}
