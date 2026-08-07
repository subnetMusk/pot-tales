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
set -uo pipefail

CONF=${CONF:-/etc/stack-deploy.env}
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

echo "deploy dello stack $STACK_NAME da $STACK_DIR"
docker stack deploy \
  --detach=true \
  --prune \
  --with-registry-auth \
  -c stack.yml "$STACK_NAME"
