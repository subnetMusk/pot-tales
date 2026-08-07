#!/bin/bash
# Carica le credenziali nella keystore nativa di Beats. Il secret non entra
# nell'ambiente del processo Filebeat e non e' leggibile da /proc/<pid>/environ.
set -euo pipefail

filebeat keystore create --force --strict.perms=false >/dev/null
printf '%s' elastic |
  filebeat keystore add ELASTICSEARCH_USERNAME --stdin --force --strict.perms=false
filebeat keystore add ELASTICSEARCH_PASSWORD --stdin --force --strict.perms=false \
  < /run/secrets/elastic_password

# Il flag richiede due trattini: nella forma con un solo trattino viene
# interpretato come cluster di shorthand e l'avvio fallisce.
# --environment container e' il default dell'immagine, che va ripristinato
# perche' sovrascrivere `command` lo rimuove.
exec filebeat -e --strict.perms=false --environment container
