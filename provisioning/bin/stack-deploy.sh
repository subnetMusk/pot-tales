#!/usr/bin/env bash
# Porta in servizio lo stack di produzione.
#
# Invocato da una unita' systemd all'avvio della macchina, non da una persona:
# l'obiettivo dichiarato e' che il primo giorno, che non e' presidiato, non
# richieda alcun intervento.
#
# `docker stack deploy` e' idempotente: applicato a uno stack gia' in servizio
# aggiorna solo cio' che e' cambiato. Eseguirlo a ogni avvio e' quindi sicuro, e
# rende il file dello stack la sola descrizione di cio' che deve girare.
#
# Configurazione in /etc/stack-deploy.env:
#   STACK_DIR        directory che contiene stack.yml
#   STACK_NAME       nome dello stack
#   SECRETS_DIR      directory dei file di secret, riferita da stack.yml
#   APP_HOST         hostname pubblico
#   ACME_EMAIL       recapito per l'autorita' di certificazione
#   SERVER_IMAGE     riferimento per digest dell'immagine del backend
#   FRONTEND_IMAGE   riferimento per digest dell'immagine del gioco
#   LANDING_IMAGE    riferimento per digest della pagina di ingresso
#   EXPORT_DEST      directory degli archivi, servita in sola lettura dal bordo
#                    (predefinita /srv/export, come in stack-data.env)
#   SWARM_ADVERTISE_ADDR  indirizzo annunciato all'inizializzazione dello swarm.
#                    Serve solo se il nodo ha piu' indirizzi e il demone non
#                    puo' sceglierne uno da solo.
set -uo pipefail

CONF=${CONF:-/etc/stack-deploy.env}
# Il percorso e' parametrico di proposito, quindi l'analizzatore non puo'
# seguirlo: la direttiva glielo dichiara invece di lasciarlo protestare.
# shellcheck source=/dev/null
[ -r "$CONF" ] && . "$CONF"

STACK_DIR=${STACK_DIR:-/srv/progetti_innovativi/deploy}
STACK_NAME=${STACK_NAME:-pi}

manca=""
for v in APP_HOST ACME_EMAIL SERVER_IMAGE FRONTEND_IMAGE LANDING_IMAGE; do
  [ -n "${!v:-}" ] || manca="$manca $v"
done
if [ -n "$manca" ]; then
  echo "variabili non configurate in $CONF:$manca" >&2
  exit 1
fi

# Le immagini vanno riferite per digest. Un tag e' mutabile: lo stesso comando
# eseguito a distanza di tempo porterebbe in servizio contenuto diverso senza
# che nulla lo segnali.
for v in SERVER_IMAGE FRONTEND_IMAGE LANDING_IMAGE; do
  case "${!v}" in
    *@sha256:*) ;;
    *) echo "$v non e' ancorata per digest: ${!v}" >&2; exit 1 ;;
  esac
done

# Swarm mode. Senza, `docker stack deploy` non ha nulla su cui applicare, e su
# una macchina appena installata nessuno lo ha ancora inizializzato: farlo qui e'
# cio' che rende non presidiato anche il primo avvio, non solo quelli successivi.
#
# L'inizializzazione parte solo dallo stato `inactive`, che il demone riporta
# quando sul nodo non esiste alcuno stato di swarm. Gli altri stati descrivono
# uno swarm che esiste: `pending` e `locked` sono un ripristino in corso, e
# inizializzarne uno nuovo sopra scarterebbe servizi e secret gia' registrati.
# In quel caso si esce con errore e l'unita' riprova, che e' il comportamento
# che il file dell'unita' prevede gia'.
stato_swarm=$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null)
case "$stato_swarm" in
  active) ;;
  inactive)
    echo "swarm non inizializzato: inizializzazione in corso"
    esito=0
    if [ -n "${SWARM_ADVERTISE_ADDR:-}" ]; then
      docker swarm init --advertise-addr "$SWARM_ADVERTISE_ADDR" || esito=$?
    else
      docker swarm init || esito=$?
    fi
    if [ "$esito" -ne 0 ]; then
      echo "inizializzazione dello swarm fallita." >&2
      echo "Con piu' indirizzi sul nodo il demone non ne sceglie uno da solo:" >&2
      echo "indicare SWARM_ADVERTISE_ADDR in $CONF." >&2
      exit 1
    fi
    ;;
  "")
    echo "demone Docker non raggiungibile" >&2
    exit 1
    ;;
  *)
    echo "swarm in stato '$stato_swarm': non applicabile adesso" >&2
    exit 1
    ;;
esac

cd "$STACK_DIR" || { echo "directory dello stack non trovata: $STACK_DIR" >&2; exit 1; }

# Verifica che i file di secret esistano prima di provare il deploy: senza,
# l'errore arriva a meta' applicazione, con una parte dei servizi gia' creata.
mancanti=$(awk '/^ +file: .*secrets\// {print $2}' stack.yml | while read -r f; do
  [ -s "$f" ] || echo "$f"
done)
if [ -n "$mancanti" ]; then
  echo "file di secret assenti o vuoti:" >&2
  echo "$mancanti" >&2
  exit 1
fi

export APP_HOST ACME_EMAIL SERVER_IMAGE FRONTEND_IMAGE LANDING_IMAGE
export CROWDSEC_DISABLE_ONLINE_API="${CROWDSEC_DISABLE_ONLINE_API:-false}"

# Stessa destinazione che usa `data-export.sh`, e stesso valore predefinito. Va
# esportata perche' il servizio che consegna gli archivi la monta: se le due
# divergessero, l'esportazione scriverebbe in un posto e il prelievo servirebbe
# una directory vuota, senza che nulla lo segnali.
export EXPORT_DEST="${EXPORT_DEST:-/srv/export}"

# La directory deve esistere prima del deploy. In swarm mode un bind mount non
# crea la propria sorgente come farebbe `docker run`: il task viene rifiutato e
# riprovato all'infinito, con il servizio fermo a zero repliche. Senza questa
# riga il prelievo resterebbe irraggiungibile dall'avvio della macchina fino
# alla prima esportazione, che e' esattamente la finestra in cui serve.
mkdir -p "$EXPORT_DEST" || {
  echo "destinazione degli archivi non creabile: $EXPORT_DEST" >&2
  exit 1
}

echo "deploy dello stack $STACK_NAME da $STACK_DIR"
docker stack deploy \
  --detach=true \
  --prune \
  --with-registry-auth \
  -c stack.yml "$STACK_NAME"
