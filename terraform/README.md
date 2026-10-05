# Infrastruttura come codice

L'host non è provisionato da qui. Il servizio gira su un server dedicato:
sistema operativo, rete e accesso sono preparati dagli script di
[provisioning/](../provisioning/), e non esiste un'API su cui Terraform possa
agire.

Quello che resta a Terraform è la configurazione dello stack Elastic, che gira
su quella macchina ed espone un'API: sta in [elk/](elk/README.md).

## Stato

Lo stato è locale, su disco della macchina, e non c'è un backend remoto.

La scelta non è un ripiego provvisorio: un backend remoto risolve il lavoro
concorrente e il blocco fra più operatori, condizioni che qui non esistono.
C'è un solo host, un solo operatore e nessun altro punto da cui l'apply possa
partire. Introdurre un servizio di stato remoto significherebbe aggiungere una
dipendenza esterna e un secondo insieme di credenziali per un problema che non
si presenta.

Quello che resta da governare è la conservazione, perché lo stato locale non
ha ridondanza per costruzione.

### Dove risiede

Fuori dalla copia di lavoro del repository, in una directory dedicata:

```
/var/lib/pi-terraform/elk/terraform.tfstate
```

Permessi `0700` sulla directory e `0600` sul file, di proprietà dell'utente che
esegue l'apply. Il percorso si passa a `init`, non è scritto nel codice:

```bash
terraform -chdir=terraform/elk init -backend-config=path=/var/lib/pi-terraform/elk/terraform.tfstate
```

La directory sta fuori dalla copia di lavoro di proposito. Dentro, sarebbe
soggetta a `git clean`, verrebbe copiata da qualunque archiviazione della
directory di lavoro e finirebbe in un'immagine del progetto insieme al resto.

### Dove non deve finire

Lo stato contiene in chiaro tutti i valori dichiarati `sensitive`: password
dell'utente `elastic` e di `filebeat_writer`, secret token dell'APM, enrollment
token di Fleet, password delle utenze delle dashboard. `sensitive` nasconde un
valore dall'output del comando, non dal file.

Ne segue che lo stato non va:

- versionato: `.gitignore` esclude `*.tfstate*`, e l'esclusione va lasciata
  intatta;
- incluso in un archivio destinato a uscire dalla macchina, o in una copia di
  cortesia consegnata a chi non ha già quelle credenziali;
- allegato a una segnalazione di problema, dove tende a finire perché è il
  file che descrive lo stato del sistema.

Vale lo stesso per i file di piano salvati (`terraform plan -out`): contengono
gli stessi valori. Sono anch'essi esclusi dal controllo di versione.

La copia di sicurezza dello stato eredita quindi la classificazione del file: va
dove vanno i segreti, non dove vanno i log.

### Se lo stato si perde

Nessun effetto immediato sul servizio. Le risorse dichiarate qui esistono dentro
Elasticsearch e Kibana, che continuano a funzionare: lo stato descrive cosa
Terraform ha creato, non fa girare nulla.

Il danno si manifesta all'apply successivo. Senza stato Terraform considera
tutto da creare e incontra oggetti già presenti: alcune risorse falliscono per
conflitto, altre vengono sovrascritte. In nessuno dei due casi il risultato è
quello dichiarato.

### Come si ricostruisce

Tutte le risorse del modulo `elk/` hanno un identificativo stabile e noto in
anticipo (nome del ruolo, nome utente, `space_id`, `policy_id`), scelto anche
per questo. Lo stato si ricostruisce importandole una per una, senza toccare il
servizio:

```bash
cd terraform/elk
terraform init -backend-config=path=/var/lib/pi-terraform/elk/terraform.tfstate

terraform import elasticstack_elasticsearch_security_role.filebeat_writer filebeat_writer
terraform import elasticstack_elasticsearch_security_user.filebeat filebeat_writer
terraform import elasticstack_kibana_space.esercizio esercizio
terraform import elasticstack_kibana_space.evento evento
terraform import elasticstack_kibana_security_role.esercizio osservabilita_esercizio
terraform import elasticstack_kibana_security_role.evento osservabilita_evento
# ... una riga per ogni utenza dichiarata in utenze_esercizio e utenze_evento,
#     con la chiave della mappa come indice:
#     terraform import 'elasticstack_elasticsearch_security_user.esercizio["nome"]' nome
```

Poi `terraform plan` deve risultare vuoto. Se non lo è, la differenza indica
una risorsa creata a mano fuori dal codice: va riportata nel codice, non
allineata a mano.

Le risorse di importazione dei saved object (`elasticstack_kibana_import_saved_objects`)
non si importano e non serve farlo: rappresentano un'operazione, non un oggetto
remoto. Ripetere l'apply le riesegue, e l'importazione è idempotente perché
avviene con sovrascrittura.

## Verifica

```bash
make lint-terraform      # formattazione di tutte le definizioni
make terraform-validate  # init senza backend e validazione del modulo elk
```
