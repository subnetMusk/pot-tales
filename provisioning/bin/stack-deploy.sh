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
#   ACME_CA_SERVER   directory dell'autorita'. Non impostata vale produzione;
#                    in collaudo va puntata a quella di prova
#   HSTS_MAX_AGE     durata dichiarata di HSTS, in secondi. Non impostata vale
#                    zero, cioe' HSTS assente
#   HSTS_INCLUDE_SUBDOMAINS  estensione di HSTS ai sottodomini
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

# Il nome dello stack entra nei nomi dei config: Docker antepone il prefisso
# dello stack solo ai nomi impliciti, e questi sono espliciti.
export STACK_NAME

# Parametri del bordo, letti da stack.yml. Vanno esportati anche quando non
# sono configurati: `stack.yml` dichiara i valori predefiniti, e sono quelli
# prudenti — autorita' di produzione e HSTS assente.
export ACME_CA_SERVER="${ACME_CA_SERVER:-}"
export HSTS_MAX_AGE="${HSTS_MAX_AGE:-0}"
export HSTS_INCLUDE_SUBDOMAINS="${HSTS_INCLUDE_SUBDOMAINS:-false}"

# Revisione dei config, derivata dal contenuto.
#
# Un config di Swarm e' immutabile: modificare il file lasciando invariato il
# nome non produce un aggiornamento. Il demone rifiuta con `only updates to
# Labels are allowed`, il deploy esce con errore e i servizi restano montati sul
# contenuto vecchio. Legare il nome all'impronta del file rende la modifica
# applicabile senza intervento: contenuto uguale, nome uguale, nessun effetto;
# contenuto diverso, config nuovo e servizi aggiornati.
#
# Le coppie nome-percorso si leggono da stack.yml invece di essere elencate qui,
# perche' un elenco separato si sarebbe disallineato alla prima aggiunta.
revisioni=$(awk '
  /^configs:/            { dentro = 1; next }
  dentro && /^[a-zA-Z]/  { dentro = 0 }
  dentro && /^  [a-zA-Z0-9_]+:[[:space:]]*$/ {
    nome = $1; sub(/:$/, "", nome); next
  }
  dentro && /^    file:/ { print nome, $2 }
' stack.yml)

while read -r nome percorso; do
  [ -n "$nome" ] || continue
  if [ ! -r "$percorso" ]; then
    echo "file di configurazione non leggibile: $percorso (config $nome)" >&2
    exit 1
  fi
  impronta=$(sha256sum "$percorso" | cut -c1-12)
  export "CFG_REV_${nome^^}=$impronta"
done <<< "$revisioni"

# Stessa destinazione che usa `data-export.sh`, e stesso valore predefinito. Va
# esportata perche' il servizio che consegna gli archivi la monta: se le due
# divergessero, l'esportazione scriverebbe in un posto e il prelievo servirebbe
# una directory vuota, senza che nulla lo segnali.
export EXPORT_DEST="${EXPORT_DEST:-/srv/export}"

# Directory dati del demone, da cui Filebeat legge i log dei container. Si
# chiede al demone invece di dichiararla: `daemon.json` la sposta dal percorso
# predefinito, e un valore scritto a mano in due posti lascerebbe Filebeat su
# una directory vuota alla prima divergenza, senza alcun errore.
DOCKER_ROOT_DIR=$(docker info --format '{{.DockerRootDir}}' 2>/dev/null)
if [ -z "$DOCKER_ROOT_DIR" ] || [ ! -d "$DOCKER_ROOT_DIR/containers" ]; then
  echo "directory dati del demone non determinabile: '${DOCKER_ROOT_DIR}'" >&2
  exit 1
fi
export DOCKER_ROOT_DIR

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
esito_deploy=$?

# Rimozione dei config non piu' riferiti.
#
# `--prune` agisce sui servizi e non sui config: verificato che quelli sostituiti
# restino registrati a tempo indeterminato. Con il nome legato al contenuto ogni
# modifica ne lascia indietro uno, quindi la rimozione va fatta qui o l'elenco
# cresce a ogni deploy.
#
# Il tentativo e' cieco di proposito: il demone rifiuta la rimozione di un config
# montato da un servizio, quindi quelli in uso si difendono da soli e non serve
# ricostruire chi riferisce cosa. Gli errori sono attesi e vanno scartati.
#
# Solo dopo un deploy riuscito: se il deploy e' fallito, i servizi possono essere
# ancora fermi sulla revisione precedente, che a quel punto non va rimossa.
if [ "$esito_deploy" -eq 0 ]; then
  docker config ls --format '{{.Name}}' 2>/dev/null \
    | grep -E "^${STACK_NAME}_" \
    | while read -r vecchio; do
        docker config rm "$vecchio" >/dev/null 2>&1
      done
fi

# L'uscita e' quella del deploy, non quella della rimozione: l'unita' systemd
# riprova in base a questo valore, e mascherarlo con l'esito della pulizia
# renderebbe un deploy fallito indistinguibile da uno riuscito.
exit "$esito_deploy"
