#!/bin/bash
# Filebeat non supporta il suffisso _FILE sulle variabili d'ambiente e non
# legge credenziali da file, quindi il valore del secret viene esportato qui.
#
# Il segreto resta leggibile in /proc/<pid>/environ all'interno del container.
# L'alternativa che evita il passaggio dall'ambiente e' la keystore di Beats.
set -euo pipefail

export ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD="$(cat /run/secrets/elastic_password)"
export ELASTICSEARCH_PASSWORD

# Il flag richiede due trattini: nella forma con un solo trattino viene
# interpretato come cluster di shorthand e l'avvio fallisce.
# --environment container e' il default dell'immagine, che va ripristinato
# perche' sovrascrivere `command` lo rimuove.
exec filebeat -e --strict.perms=false --environment container
