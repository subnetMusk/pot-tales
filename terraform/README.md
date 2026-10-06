# Infrastruttura come codice

Terraform configura lo stack Elastic tramite API nel modulo [elk/](elk/README.md).
Sistema operativo, rete e accessi dell'host sono preparati dal
[provisioning](../provisioning/README.md).

## Stato

Lo stato usa il backend locale. La configurazione prevede un solo host e un
solo operatore; l'accesso concorrente e la replica dello stato non sono predisposti.
Conservare una copia protetta dello stato fuori dalla macchina.

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

Tenere lo stato fuori dal checkout per escluderlo da `git clean`, dagli archivi
del repository e dalle immagini del progetto.

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
- allegato a una segnalazione di problema.

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

Le risorse del modulo `elk/` hanno identificativi dichiarati nel codice
(nome del ruolo, nome utente, `space_id`, `policy_id`). Lo stato si ricostruisce importandole una per una, senza toccare il
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
