#!/usr/bin/env bash
# ==============================================================================
# Iniezione di guasti per esercitazioni di diagnosi
# ==============================================================================
# Applica allo stack uno di quattro guasti scelto casualmente, senza indicarlo,
# per esercitare la diagnosi tramite i soli comandi dell'orchestratore.
#
#   ./fault-drill.sh            inietta un guasto casuale
#   ./fault-drill.sh --reveal   mostra il guasto applicato
#   ./fault-drill.sh --reset    ripristina lo stack
#
# L'obiettivo dell'esercizio e' individuare quale servizio e' degradato, da
# quanto tempo e per quale causa.
# ==============================================================================
set -uo pipefail

STACK=${STACK:-elkproto}
HERE="$(cd "$(dirname "$0")" && pwd)"
# Un cd fallito lascerebbe lo script a operare nella directory sbagliata,
# che e' esattamente il momento in cui i comandi distruttivi fanno danno.
cd "$HERE" || exit 1
STATE=".fault-drill-state"

case "${1:-inject}" in
  --reveal)
    if [ -s "$STATE" ]; then
      echo "Guasto iniettato:"
      cat "$STATE"
    else
      echo "Nessun guasto registrato."
    fi
    exit 0
    ;;
  --reset)
    echo "Ripristino lo stack da stack.yml"
    docker stack deploy -c stack.yml "$STACK" --detach=true
    rm -f "$STATE"
    echo "Fatto. Attendi che i servizi tornino healthy."
    exit 0
    ;;
esac

if [ -z "$(docker service ls -q --filter "label=com.docker.stack.namespace=$STACK" 2>/dev/null)" ]; then
  echo "Lo stack $STACK non e' in esecuzione. Avvialo prima:"
  echo "  docker stack deploy -c stack.yml $STACK"
  exit 1
fi

# I quattro guasti si manifestano in modo diverso: servizio assente, container
# terminato e ricreato, riavvio ripetuto da configurazione, processo terminato
# dal cgroup. Ognuno lascia tracce distinte in `docker service ps` e
# `docker service logs`.
case $(( RANDOM % 4 )) in
  0)
    docker service scale "${STACK}_kibana"=0 >/dev/null 2>&1
    echo "scale a 0 del servizio kibana" > "$STATE"
    ;;
  1)
    cid=$(docker ps -q --filter "label=com.docker.swarm.service.name=${STACK}_es01" | head -1)
    docker kill "$cid" >/dev/null 2>&1
    echo "docker kill del container di es01 (${cid:0:12})" > "$STATE"
    ;;
  2)
    docker service update --env-add "cluster.initial_master_nodes=nodo-inesistente" \
      --detach=true "${STACK}_es01" >/dev/null 2>&1
    echo "es01 aggiornato con cluster.initial_master_nodes verso un nodo inesistente" > "$STATE"
    ;;
  3)
    docker service update --limit-memory 128M --detach=true "${STACK}_kibana" >/dev/null 2>&1
    echo "limite di memoria di kibana abbassato a 128M" > "$STATE"
    ;;
esac

echo "Guasto iniettato."
echo "Per rivelare il guasto applicato: ./fault-drill.sh --reveal"
