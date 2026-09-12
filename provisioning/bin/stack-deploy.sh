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
#   SECRETS_DIR      directory dei secret letta da fleet-bootstrap.sh
#                    (predefinita secrets/ nel repository). stack.yml riferisce
#                    i file per percorso relativo e non la legge: va lasciata
#                    al valore predefinito
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
#   DASHBOARD_USERS_TFVARS  copia root-only delle credenziali con cui Terraform
#                    crea le utenze delle due platee (predefinita accanto agli
#                    altri secret)
#   EXPORT_DEST      directory degli archivi, servita in sola lettura dal bordo
#                    (predefinita /srv/export, come in stack-data.env)
#   ES_DATA_DIR      directory degli indici di Elasticsearch, montata dal volume
#                    esdata01 (predefinita /srv/data/elastic). Deve esistere e
#                    appartenere a uid 1000 e gid 0
#   SWARM_ADVERTISE_ADDR  indirizzo annunciato all'inizializzazione dello swarm.
#                    Serve solo se il nodo ha piu' indirizzi e il demone non
#                    puo' sceglierne uno da solo.
#   TRAEFIK_SNI_STRICT  rifiuto degli handshake per nomi senza certificato. Non
#                    impostata vale true, che e' il valore di esercizio; si
#                    disattiva solo per verifiche locali prima di un'emissione.
#
# Le altre variabili lette da stack.yml (ES_JAVA_OPTS, DATA_RETENTION_DAYS, ...)
# si possono impostare nello stesso file.
set -uo pipefail

CONF=${CONF:-/etc/stack-deploy.env}

# Ogni variabile del file viene esportata, come fa `EnvironmentFile` quando lo
# script parte dall'unita' systemd. Senza, i parametri di stack.yml che questo
# script non esporta uno per uno avrebbero effetto dall'unita' e nessuno quando
# lo script parte a mano, e lo stesso file produrrebbe due stack diversi.
if [ -r "$CONF" ]; then
  set -a
  # Il percorso e' parametrico di proposito, quindi l'analizzatore non puo'
  # seguirlo: la direttiva glielo dichiara invece di lasciarlo protestare.
  # shellcheck source=/dev/null
  . "$CONF"
  set +a
fi

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

# Le tre liste htpasswd permettono al bordo di verificare le credenziali, ma
# non contengono la password necessaria a creare gli stessi utenti su
# Elasticsearch. Senza questa fonte il deploy applicativo riuscirebbe e il
# bootstrap dichiarerebbe gli Space pronti ma nessuna platea potrebbe entrare.
DASHBOARD_USERS_TFVARS=${DASHBOARD_USERS_TFVARS:-../secrets/dashboard_users.tfvars.json}
if [ ! -s "$DASHBOARD_USERS_TFVARS" ]; then
  echo "credenziali Terraform delle dashboard assenti: $DASHBOARD_USERS_TFVARS" >&2
  echo "eseguire provisioning/bin/configure-dashboard-users.py ../secrets" >&2
  exit 1
fi
export DASHBOARD_USERS_TFVARS

export APP_HOST ACME_EMAIL SERVER_IMAGE FRONTEND_IMAGE LANDING_IMAGE
export CROWDSEC_DISABLE_ONLINE_API="${CROWDSEC_DISABLE_ONLINE_API:-false}"

# Il nome dello stack entra nei nomi dei config e dei secret: Docker antepone il
# prefisso dello stack solo ai nomi impliciti, e questi sono espliciti.
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
# Lo stesso vale per i secret, verificato su Docker 29.6.2: cambiare un file di
# secret, per esempio aggiungendo un'utenza alle dashboard, farebbe fallire il
# deploy con lo stesso errore. L'impronta di un valore casuale lungo non ne
# rivela nulla.
#
# Le coppie nome-percorso si leggono da stack.yml invece di essere elencate qui,
# perche' un elenco separato si sarebbe disallineato alla prima aggiunta.
esporta_revisioni() {
  local sezione=$1 prefisso=$2 voci nome percorso impronta
  voci=$(awk -v sezione="$sezione:" '
    $0 == sezione          { dentro = 1; next }
    dentro && /^[a-zA-Z]/  { dentro = 0 }
    dentro && /^  [a-zA-Z0-9_]+:[[:space:]]*$/ {
      nome = $1; sub(/:$/, "", nome); next
    }
    dentro && /^    file:/ { print nome, $2 }
  ' stack.yml)

  while read -r nome percorso; do
    [ -n "$nome" ] || continue
    if [ ! -r "$percorso" ]; then
      echo "file non leggibile: $percorso ($sezione $nome)" >&2
      return 1
    fi
    impronta=$(sha256sum "$percorso" | cut -c1-12)
    export "${prefisso}${nome^^}=$impronta"
  done <<< "$voci"
}

esporta_revisioni configs CFG_REV_ || exit 1
esporta_revisioni secrets SEC_REV_ || exit 1

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

# Directory degli indici di Elasticsearch, sorgente del bind del volume
# `esdata01`. Come per gli archivi, deve esistere prima del deploy, altrimenti
# il task viene rifiutato e riprovato all'infinito. A differenza di quella non
# viene creata: e' il punto di montaggio di un volume dedicato, e crearla qui
# metterebbe gli indici sul volume di sistema se quello non fosse montato.
#
# L'immagine scrive come uid 1000 e gid 0. Con un altro proprietario il processo
# non scrive e resta in riavvio ciclico, con il motivo visibile solo nei log del
# contenitore. Il controllo coglie anche il volume non montato: la directory
# sottostante resta di root.
export ES_DATA_DIR="${ES_DATA_DIR:-/srv/data/elastic}"
if [ ! -d "$ES_DATA_DIR" ]; then
  echo "directory degli indici assente: $ES_DATA_DIR" >&2
  exit 1
fi
proprietario=$(stat -c '%u:%g' "$ES_DATA_DIR" 2>/dev/null)
if [ "$proprietario" != "1000:0" ]; then
  echo "directory degli indici $ES_DATA_DIR di proprieta' '$proprietario', attesa 1000:0." >&2
  echo "Con il volume montato: chown 1000:0 $ES_DATA_DIR && chmod 2770 $ES_DATA_DIR" >&2
  exit 1
fi

# La directory deve esistere prima del deploy. In swarm mode un bind mount non
# crea la propria sorgente come farebbe `docker run`: il task viene rifiutato e
# riprovato all'infinito, con il servizio fermo a zero repliche. Senza questa
# riga il prelievo resterebbe irraggiungibile dall'avvio della macchina fino
# alla prima esportazione, che e' esattamente la finestra in cui serve.
mkdir -p "$EXPORT_DEST" || {
  echo "destinazione degli archivi non creabile: $EXPORT_DEST" >&2
  exit 1
}

# Preflight prima della prima mutazione. La risoluzione completa intercetta
# riferimenti a volumi/config/secret inesistenti e variabili non esportate.
docker stack config -c stack.yml >/dev/null || {
  echo "configurazione dello stack non valida" >&2
  exit 1
}

# La sintassi interna di Filebeat non e' parte dello schema Compose. Validarla
# con la stessa immagine ancorata dello stack evita che un config formalmente
# YAML ma semanticamente errato sostituisca il task sano.
FILEBEAT_IMAGE=$(awk '
  $0 == "  filebeat:" { dentro = 1; next }
  dentro && /^    image:/ { print $2; exit }
' stack.yml)
[ -n "$FILEBEAT_IMAGE" ] || {
  echo "immagine Filebeat non ricavabile da stack.yml" >&2
  exit 1
}
docker run --rm --entrypoint filebeat \
  -e ELASTICSEARCH_USERNAME=preflight \
  -e ELASTICSEARCH_PASSWORD=preflight \
  -v "$STACK_DIR/config/filebeat.yml:/usr/share/filebeat/filebeat.yml:ro" \
  "$FILEBEAT_IMAGE" test config -c /usr/share/filebeat/filebeat.yml \
    -e --strict.perms=false \
    -E 'output={elasticsearch.enabled: false, console.pretty: false}' >/dev/null 2>&1 || {
  echo "configurazione Filebeat non valida" >&2
  exit 1
}

echo "deploy dello stack $STACK_NAME da $STACK_DIR"
docker stack deploy \
  --detach=true \
  --prune \
  --with-registry-auth \
  -c stack.yml "$STACK_NAME"
esito_deploy=$?

# Rimozione dei config e dei secret non piu' riferiti.
#
# `--prune` agisce sui servizi e non sui config ne' sui secret: verificato che
# quelli sostituiti restino registrati a tempo indeterminato. Con il nome legato
# al contenuto ogni modifica ne lascia indietro uno, quindi la rimozione va fatta
# qui o l'elenco cresce a ogni deploy.
#
# Il tentativo e' cieco di proposito: il demone rifiuta la rimozione di un config
# o di un secret montato da un servizio, quindi quelli in uso si difendono da
# soli e non serve ricostruire chi riferisce cosa. Gli errori sono attesi e vanno
# scartati.
#
# Solo dopo un deploy riuscito: se il deploy e' fallito, i servizi possono essere
# ancora fermi sulla revisione precedente, che a quel punto non va rimossa.
#
# Il demone pero' difende solo i riferimenti della specifica corrente. Un
# servizio con `failure_action: rollback` che fallisce l'aggiornamento torna
# alla specifica precedente: se i suoi config o secret fossero gia' stati
# rimossi, il rollback non potrebbe avviare i task e il servizio resterebbe
# fermo. Quelli della specifica precedente restano quindi fino al deploy
# successivo.
if [ "$esito_deploy" -eq 0 ]; then
  conservati=$(docker service ls -q --filter "label=com.docker.stack.namespace=$STACK_NAME" 2>/dev/null \
    | xargs -r docker service inspect --format \
      '{{with .PreviousSpec}}{{range .TaskTemplate.ContainerSpec.Configs}}{{.ConfigName}} {{end}}{{range .TaskTemplate.ContainerSpec.Secrets}}{{.SecretName}} {{end}}{{end}}' 2>/dev/null \
    | tr ' ' '\n' | sed '/^$/d' | sort -u)
  for tipo in config secret; do
    docker "$tipo" ls --format '{{.Name}}' 2>/dev/null \
      | grep -E "^${STACK_NAME}_" \
      | grep -vxF -e "" -f <(printf '%s\n' "$conservati") \
      | while read -r vecchio; do
          docker "$tipo" rm "$vecchio" >/dev/null 2>&1
        done
  done
fi

# L'uscita e' quella del deploy, non quella della rimozione: l'unita' systemd
# riprova in base a questo valore, e mascherarlo con l'esito della pulizia
# renderebbe un deploy fallito indistinguibile da uno riuscito.
exit "$esito_deploy"
