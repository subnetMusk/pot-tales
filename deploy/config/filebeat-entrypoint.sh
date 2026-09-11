#!/bin/bash
# Carica le credenziali nella keystore nativa di Beats. Il secret non entra
# nell'ambiente del processo Filebeat e non e' leggibile da /proc/<pid>/environ.
#
# L'utenza e' `filebeat_writer`, creata da Terraform al bootstrap con i soli
# privilegi per scrivere i log e gestirne template e ciclo di vita. Prima che il
# bootstrap la crei Filebeat riceve un 401 e ritenta: i log dei contenitori
# restano sui file e vengono letti appena l'utenza esiste, entro i limiti della
# loro rotazione.
set -euo pipefail

filebeat keystore create --force --strict.perms=false >/dev/null
printf '%s' filebeat_writer |
  filebeat keystore add ELASTICSEARCH_USERNAME --stdin --force --strict.perms=false
filebeat keystore add ELASTICSEARCH_PASSWORD --stdin --force --strict.perms=false \
  < /run/secrets/filebeat_writer_password

# Il flag richiede due trattini: nella forma con un solo trattino viene
# interpretato come cluster di shorthand e l'avvio fallisce.
# --environment container e' il default dell'immagine, che va ripristinato
# perche' sovrascrivere `command` lo rimuove.
exec filebeat -e --strict.perms=false --environment container
