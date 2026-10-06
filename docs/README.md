# Manuale di Pot Tales

Pot Tales è un gioco educativo per browser desktop. Il servizio pubblico è offline
e può essere riattivato; la documentazione descrive il prodotto e le procedure
utilizzabili per un nuovo esercizio.

1. [Architettura](ARCHITETTURA.md): componenti, stato di gioco, sicurezza,
   osservabilità e trattamento dei dati.
2. [Sviluppo](SVILUPPO.md): prerequisiti, avvio locale, configurazione e verifiche;
   [monitoring locale](MONITORING_LOCALE.md): bootstrap manuale di Fleet e dashboard.
3. [Provisioning](../provisioning/README.md): preparazione della macchina,
   filesystem, installazione degli script e unità systemd.
4. [Esercizio](ESERCIZIO.md): rimessa in esercizio, momenti pianificati,
   intervento per sintomo, backup, ripristino ed esportazione.
5. [Terraform](../terraform/README.md), [stack Elastic](../terraform/elk/README.md)
   e [dashboard](../terraform/elk/dashboards/README.md): osservabilità come codice.
6. [Segreti](../secrets/README.md): generazione al deploy e gestione dei valori
   di produzione, che non sono versionati.
7. [Script](../scripts/README.md): strumenti di sviluppo e manutenzione;
   [volumi locali](../docker/volumes/README.md): configurazione di sviluppo.

`make help` elenca i comandi. Il [prototipo Swarm](../swarm-prototype/README.md)
è un riferimento storico; il deploy corrente usa `deploy/stack.yml`.
