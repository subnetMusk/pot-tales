#!/usr/bin/env bash
# Controllo completo della macchina in servizio, su richiesta.
#
# Raccoglie in un solo comando le verifiche fatte a mano dopo ogni rilascio e
# alla vigilia di una giornata di apertura (docs/ESERCIZIO.md): unita' systemd,
# servizi dello stack e immagini distribuite, bordo e certificato, dischi e
# snapshot, copia notturna, contatori SMART e, per ultima, la verifica
# end-to-end di ci/stack-verify.sh.
#
# Sola lettura: non riavvia, non corregge e non tocca il volume ACME. Ogni
# controllo stampa OK, ATTENZIONE o GUASTO, e l'uscita e' 1 se c'e' almeno un
# guasto: l'esito si legge anche senza scorrere l'output.
#
# Non ha timer e non deve averlo. La sorveglianza continua e' compito del
# battito e di Healthchecks; questo e' lo sguardo d'insieme che l'operatore
# chiede quando serve.
#
#   sudo stack-checkup.sh [--rapido]
#
#   --rapido   salta ci/stack-verify.sh, che attende 30 secondi per escludere i
#              riavvii ciclici e interroga Kibana e Fleet
set -uo pipefail

RAPIDO=0
case "${1:-}" in
  "") ;;
  --rapido) RAPIDO=1 ;;
  *) echo "uso: $0 [--rapido]" >&2; exit 2 ;;
esac

if [ "$(id -u)" -ne 0 ]; then
  echo "va eseguito come root: legge Docker, i volumi logici e i contatori SMART" >&2
  exit 2
fi

# shellcheck source=/dev/null
[ -r /etc/stack-deploy.env ] && . /etc/stack-deploy.env
# shellcheck source=/dev/null
[ -r /etc/stack-data.env ] && . /etc/stack-data.env

STACK_NAME=${STACK_NAME:-pi}
APP_HOST=${APP_HOST:-}
REPO_DIR=${REPO_DIR:-$(dirname "${STACK_DIR:-/srv/progetti_innovativi/deploy}")}
VG_NAME=${VG_NAME:-vg0}
SNAP_SIZE=${SNAP_SIZE:-16G}
BACKUP_DEST=${BACKUP_DEST:-/srv/backup}
DIAGNOSTIC_DEST=${DIAGNOSTIC_DEST:-/srv/diagnostics}

# Le stesse soglie del battito: un disco che qui risulta in guasto e' anche
# quello per cui host-resources va in allarme.
DISK_MOUNTS=${DISK_MOUNTS:-/ /var /srv/docker /srv/data/elastic /srv/backup /srv/export /srv/diagnostics}
DISK_MAX_PCT=${DISK_MAX_PCT:-85}
DISK_WARN_PCT=${DISK_WARN_PCT:-75}
MEM_MIN_PCT=${MEM_MIN_PCT:-15}
SNAP_MAX_PCT=${SNAP_MAX_PCT:-80}

# Il rinnovo automatico parte a 30 giorni dalla scadenza: sotto i 20 si e'
# fermato qualcosa, sotto i 7 non c'e' piu' margine per indagare.
TLS_WARN_DAYS=${TLS_WARN_DAYS:-20}
TLS_MIN_DAYS=${TLS_MIN_DAYS:-7}

# Una copia notturna piu' vecchia di cosi' vuol dire che almeno una notte e'
# saltata.
DUMP_MAX_ORE=${DUMP_MAX_ORE:-26}

# Contatori di integrita' di riferimento, per seriale (docs/ESERCIZIO.md, vigilia).
# Il nome del dispositivo non e' stabile fra un avvio e l'altro, il seriale si'.
SMART_RIFERIMENTI=${SMART_RIFERIMENTI:-Y67S105STUHV=0 S3W8NB0K413381=3}

LIMITE=${CHECKUP_TIMEOUT:-20}

guasti=0
avvisi=0
riusciti=0

ok()      { riusciti=$((riusciti + 1)); printf '  OK         %s\n' "$*"; }
avviso()  { avvisi=$((avvisi + 1));     printf '  ATTENZIONE %s\n' "$*"; }
guasto()  { guasti=$((guasti + 1));     printf '  GUASTO     %s\n' "$*"; }
info()    { printf '             %s\n' "$*"; }
sezione() { printf '\n== %s ==\n' "$*"; }

# Un comando bloccato non deve fermare il controllo: meglio un guasto dichiarato
# che una sessione appesa.
limitato() { timeout -k 2 "$LIMITE" "$@"; }

# --- Sistema ------------------------------------------------------------------

sezione "Sistema"
info "$(date '+%F %T %Z'), $(hostname), avviata il $(uptime -s 2>/dev/null)"

fuso=$(timedatectl show -p Timezone --value 2>/dev/null)
if [ "$fuso" = "Europe/Rome" ]; then
  ok "fuso orario $fuso"
else
  avviso "fuso orario ${fuso:-ignoto}: il timer della copia notturna e il suo check assumono Europe/Rome"
fi

mem_tot=$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)
mem_disp=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
mem_pct=$((mem_disp * 100 / mem_tot))
if [ "$mem_pct" -ge "$MEM_MIN_PCT" ]; then
  ok "memoria disponibile ${mem_pct}%"
else
  avviso "memoria disponibile ${mem_pct}%, sotto la soglia del battito (${MEM_MIN_PCT}%)"
fi

oom=$(journalctl -k -b --no-pager -q 2>/dev/null | grep -ci 'out of memory')
if [ "${oom:-0}" -eq 0 ]; then
  ok "nessuna terminazione per memoria esaurita dall'avvio"
else
  avviso "$oom terminazioni per memoria esaurita dall'avvio (journalctl -k -b)"
fi

# --- Unita' systemd -----------------------------------------------------------

sezione "Unita' systemd"
fallite=$(systemctl --failed --no-legend --plain 2>/dev/null | awk '{print $1}' | xargs)
if [ -z "$fallite" ]; then
  ok "nessuna unita' in errore"
else
  guasto "unita' in errore: $fallite"
fi

for unita in docker.service stack-deploy.service fleet-bootstrap.service; do
  stato=$(systemctl is-active "$unita" 2>/dev/null)
  if [ "$stato" = active ]; then ok "$unita attiva"; else guasto "$unita: $stato"; fi
done

# Deve risultare attiva: e' il suo ExecStop che raccoglie la diagnostica allo
# spegnimento, e un'unita' mai avviata non viene fermata.
if systemctl is-active --quiet diagnostic-bundle.service; then
  ok "diagnostic-bundle.service attiva, raccoglie allo spegnimento"
else
  guasto "diagnostic-bundle.service non attiva: allo spegnimento non verrebbe raccolto nulla"
fi
ultimo_pacchetto=$(ls -1dt "$DIAGNOSTIC_DEST"/2*/ 2>/dev/null | head -1)
info "ultimo pacchetto diagnostico: ${ultimo_pacchetto:-nessuno}"

for timer in stack-heartbeat.timer alert-notifier.timer backup-nightly.timer traefik-logrotate.timer; do
  if systemctl is-active --quiet "$timer"; then
    prossima=$(systemctl show -p NextElapseUSecRealtime --value "$timer" 2>/dev/null)
    ok "$timer attivo${prossima:+, prossima esecuzione $prossima}"
  else
    guasto "$timer non attivo"
  fi
done

unita_stack=(-u stack-deploy.service -u fleet-bootstrap.service -u stack-heartbeat.service
  -u alert-notifier.service -u backup-nightly.service -u traefik-logrotate.service)
righe_errore=$(journalctl "${unita_stack[@]}" -p err --since -24h --no-pager -q 2>/dev/null)
errori=$(grep -c . <<< "$righe_errore")
if [ "$errori" -eq 0 ]; then
  ok "nessun errore nel journal delle unita' dello stack nelle ultime 24 ore"
else
  avviso "$errori righe di errore nelle ultime 24 ore, le ultime:"
  tail -n 5 <<< "$righe_errore" | cut -c1-200 | while IFS= read -r riga; do info "$riga"; done
fi

# --- Stack --------------------------------------------------------------------

sezione "Stack $STACK_NAME"
if ! servizi=$(limitato docker service ls --filter "label=com.docker.stack.namespace=$STACK_NAME" \
     --format '{{.Name}}|{{.Replicas}}' 2>/dev/null); then
  guasto "Docker non interrogabile"
elif [ -z "$servizi" ]; then
  guasto "nessun servizio nello stack $STACK_NAME"
else
  while IFS='|' read -r nome repliche; do
    [ -n "$nome" ] || continue
    attuali=${repliche%%/*}
    volute=${repliche#*/}
    volute=${volute%% *}
    case "$repliche" in
      # Il job di setup termina: 0/1 con il completamento e' il suo stato sano.
      *completed*) ok "$nome: job completato" ;;
      *)
        if [ "$attuali" = "$volute" ] && [ "$volute" != 0 ]; then
          ok "$nome $repliche"
        else
          guasto "$nome: repliche $repliche"
        fi
        ;;
    esac
  done <<< "$servizi"
fi

# Docker conserva nella cronologia anche i task sostituiti da un riavvio della
# macchina, che risultano falliti per sempre. Si segnala solo cio' che e'
# fallito nell'ultima ora, che Docker descrive in secondi e minuti; il resto si
# conta soltanto.
falliti=$(limitato docker stack ps "$STACK_NAME" --no-trunc \
  --format '{{.Name}}|{{.CurrentState}}|{{.Error}}' 2>/dev/null |
  awk -F'|' '$2 ~ /^(Failed|Rejected)/')
recenti=$(awk -F'|' '$2 ~ /(second|minute|About an hour) ago/ {print $1 ": " $2 " " $3}' <<< "$falliti")
n_falliti=$(grep -c . <<< "$falliti")
n_recenti=$(grep -c . <<< "$recenti")
if [ "$n_recenti" -eq 0 ]; then
  ok "nessun task fallito nell'ultima ora"
else
  avviso "task falliti nell'ultima ora:"
  while IFS= read -r riga; do info "$riga"; done <<< "$recenti"
fi
[ "$n_falliti" -eq "$n_recenti" ] ||
  info "$((n_falliti - n_recenti)) task falliti piu' vecchi nella cronologia di Docker, per esempio le sostituzioni dopo un riavvio"

# L'immagine in esecuzione deve essere quella indicata nel file di deploy: una
# differenza vuol dire un rilascio non applicato o un rollback rimasto.
for coppia in "server|${SERVER_IMAGE:-}" "frontend|${FRONTEND_IMAGE:-}"; do
  servizio=${coppia%%|*}
  atteso=${coppia#*|}
  if [ -z "$atteso" ]; then
    avviso "immagine di $servizio non indicata in /etc/stack-deploy.env"
    continue
  fi
  corrente=$(limitato docker service inspect "${STACK_NAME}_$servizio" \
    --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' 2>/dev/null)
  if [ "${corrente##*@}" = "${atteso##*@}" ]; then
    ok "$servizio in esecuzione con l'immagine indicata (${atteso##*@})"
  else
    guasto "$servizio: in esecuzione ${corrente##*@}, indicata ${atteso##*@}"
  fi
done

if [ -d "$REPO_DIR/.git" ]; then
  git_repo() { git -c safe.directory="$REPO_DIR" -C "$REPO_DIR" "$@"; }
  info "repository: $(git_repo rev-parse --abbrev-ref HEAD 2>/dev/null) @ $(git_repo log -1 --format='%h %s' 2>/dev/null)"
  modificati=$(git_repo status --porcelain --untracked-files=no 2>/dev/null | wc -l)
  if [ "$modificati" -eq 0 ]; then
    ok "copia di lavoro senza modifiche locali"
  else
    avviso "$modificati file modificati localmente in $REPO_DIR"
  fi
else
  avviso "repository non trovato in $REPO_DIR"
fi

# --- Bordo e certificato ------------------------------------------------------

sezione "Bordo e certificato"
if [ -z "$APP_HOST" ]; then
  guasto "APP_HOST non impostato in /etc/stack-deploy.env"
else
  # Il nome pubblico risolto sulla macchina stessa: con sniStrict un handshake
  # per localhost verrebbe rifiutato. -k perche' il certificato ha il suo
  # controllo, qui interessa la risposta.
  richiesta() {
    limitato curl -sk -o /dev/null -w '%{http_code}' \
      --resolve "$APP_HOST:443:127.0.0.1" --resolve "$APP_HOST:80:127.0.0.1" "$@"
  }

  codice=$(richiesta "https://$APP_HOST/health")
  if [ "$codice" = 200 ]; then ok "/health risponde 200"; else guasto "/health risponde ${codice:-niente}"; fi

  codice=$(richiesta "http://$APP_HOST/")
  case "$codice" in
    301|302|307|308) ok "HTTP reindirizza a HTTPS ($codice)" ;;
    *) guasto "HTTP risponde ${codice:-niente} invece di reindirizzare" ;;
  esac

  codice=$(richiesta "https://$APP_HOST/export/")
  if [ "$codice" = 401 ]; then ok "/export chiede le credenziali"; else guasto "/export senza credenziali risponde ${codice:-niente}"; fi

  codice=$(richiesta "https://$APP_HOST/osservabilita/s/evento/app/dashboards")
  if [ "$codice" = 401 ]; then ok "dashboard dell'evento chiedono le credenziali"; else guasto "dashboard senza credenziali rispondono ${codice:-niente}"; fi

  hsts=$(limitato curl -sk -D - -o /dev/null --resolve "$APP_HOST:443:127.0.0.1" "https://$APP_HOST/" 2>/dev/null |
    grep -ci '^strict-transport-security')
  if [ "${HSTS_MAX_AGE:-0}" = 0 ]; then
    if [ "${hsts:-0}" -eq 0 ]; then ok "HSTS non dichiarato, come deciso"; else avviso "HSTS dichiarato con HSTS_MAX_AGE a 0"; fi
  else
    info "HSTS_MAX_AGE=$HSTS_MAX_AGE"
  fi

  certificato=$(echo | limitato openssl s_client -connect 127.0.0.1:443 -servername "$APP_HOST" 2>/dev/null |
    openssl x509 -noout -issuer -enddate 2>/dev/null)
  emittente=$(sed -n 's/^issuer=//p' <<< "$certificato")
  scadenza=$(sed -n 's/^notAfter=//p' <<< "$certificato")
  if [ -z "$scadenza" ]; then
    guasto "certificato non leggibile sulla 443"
  else
    case "$emittente" in
      *STAGING*|*Fake*|*"TRAEFIK DEFAULT"*) guasto "certificato non di produzione: $emittente" ;;
      *) ok "emittente: $emittente" ;;
    esac
    giorni=$(( ($(date -d "$scadenza" +%s) - $(date +%s)) / 86400 ))
    if [ "$giorni" -lt "$TLS_MIN_DAYS" ]; then
      guasto "il certificato scade tra $giorni giorni ($scadenza)"
    elif [ "$giorni" -lt "$TLS_WARN_DAYS" ]; then
      avviso "il certificato scade tra $giorni giorni: il rinnovo automatico parte a 30"
    else
      ok "il certificato scade tra $giorni giorni ($scadenza)"
    fi
  fi

  case "${ACME_CA_SERVER:-}" in
    *staging*) guasto "ACME_CA_SERVER punta all'autorita' di prova" ;;
    *) ok "autorita' ACME di produzione" ;;
  esac
fi

# --- Dischi e volumi ----------------------------------------------------------

sezione "Dischi e volumi"
for punto in $DISK_MOUNTS; do
  if [ ! -d "$punto" ]; then
    avviso "$punto assente"
    continue
  fi
  uso=$(df --output=pcent "$punto" 2>/dev/null | tail -1 | tr -dc '0-9')
  if [ -z "$uso" ]; then
    avviso "$punto: occupazione non leggibile"
  elif [ "$uso" -gt "$DISK_MAX_PCT" ]; then
    guasto "$punto al ${uso}%: oltre l'85% Elasticsearch smette di allocare"
  elif [ "$uso" -ge "$DISK_WARN_PCT" ]; then
    avviso "$punto al ${uso}%"
  else
    ok "$punto al ${uso}%"
  fi
done

libero=$(vgs "$VG_NAME" -o vg_free --noheadings --units g --nosuffix 2>/dev/null | tr -d ' ')
richiesto=${SNAP_SIZE%G}
if [ -z "$libero" ]; then
  guasto "volume group $VG_NAME non trovato"
elif [ "${libero%%.*}" -lt "$richiesto" ]; then
  guasto "${libero}G non allocati in $VG_NAME: il prossimo snapshot da $SNAP_SIZE non si crea"
else
  ok "${libero}G non allocati in $VG_NAME, ne servono $SNAP_SIZE per il prossimo snapshot"
fi

# Uno snapshot che esaurisce lo spazio copy-on-write viene invalidato dal kernel
# e non e' piu' ripristinabile: l'occupazione va letta, non presunta.
snapshot=0
while read -r lv occupazione; do
  [ -n "$lv" ] || continue
  snapshot=$((snapshot + 1))
  intero=${occupazione%%.*}
  if [ "${intero:-0}" -ge "$SNAP_MAX_PCT" ]; then
    avviso "snapshot $lv al ${occupazione}% dello spazio copy-on-write"
  else
    ok "snapshot $lv al ${occupazione}%"
  fi
done < <(lvs --noheadings -o lv_name,data_percent --select "lv_attr=~^s" "$VG_NAME" 2>/dev/null)
[ "$snapshot" -gt 0 ] || avviso "nessuno snapshot presente in $VG_NAME"

# --- Copia notturna -----------------------------------------------------------

sezione "Copia notturna"
fine=$(systemctl show -p ExecMainExitTimestamp --value backup-nightly.service 2>/dev/null)
risultato=$(systemctl show -p Result --value backup-nightly.service 2>/dev/null)
uscita=$(systemctl show -p ExecMainStatus --value backup-nightly.service 2>/dev/null)
if [ -z "$fine" ]; then
  info "backup-nightly non ancora eseguito dall'avvio della macchina"
elif [ "$risultato" = success ] && [ "$uscita" = 0 ]; then
  ok "ultima esecuzione riuscita ($fine)"
else
  guasto "ultima esecuzione: $risultato, uscita $uscita ($fine)"
fi

ultimo_dump=$(ls -1d "$BACKUP_DEST"/mongodump/2*/ 2>/dev/null | sort | tail -1)
if [ -z "$ultimo_dump" ]; then
  guasto "nessun dump in $BACKUP_DEST/mongodump"
else
  ore=$(( ($(date +%s) - $(stat -c %Y "$ultimo_dump")) / 3600 ))
  if [ "$ore" -gt "$DUMP_MAX_ORE" ]; then
    avviso "ultimo dump di $ore ore fa: almeno una notte e' saltata ($ultimo_dump)"
  else
    ok "ultimo dump di $ore ore fa ($ultimo_dump)"
  fi
  # Prodotta non basta: la vigilia chiede una copia leggibile. Le somme sono
  # scritte per ultime, a manifesto completo, e distinguono una copia integra
  # da una troncata.
  if [ ! -f "$ultimo_dump/SHA256SUMS" ]; then
    avviso "ultimo dump senza SHA256SUMS: integrita' non verificabile"
  elif (cd "$ultimo_dump" && limitato sha256sum -c --quiet SHA256SUMS >/dev/null 2>&1); then
    ok "somme di controllo dell'ultimo dump corrispondenti"
  else
    guasto "somme di controllo dell'ultimo dump non corrispondenti"
  fi
fi

# --- Dischi fisici ------------------------------------------------------------

sezione "Dischi fisici"
if ! command -v smartctl >/dev/null 2>&1; then
  avviso "smartctl assente: contatori SMART non leggibili"
else
  for disco in /dev/nvme?n1; do
    [ -e "$disco" ] || continue
    seriale=$(limitato smartctl -i "$disco" 2>/dev/null | awk -F': *' '/Serial Number/ {print $2}')
    attributi=$(limitato smartctl -A "$disco" 2>/dev/null)
    errori_disco=$(awk -F': *' '/Media and Data Integrity Errors/ {gsub(/[^0-9]/, "", $2); print $2}' <<< "$attributi")
    temperatura=$(awk -F': *' '/^Temperature:/ {print $2}' <<< "$attributi")
    riferimento=
    for voce in $SMART_RIFERIMENTI; do
      [ "${voce%%=*}" = "$seriale" ] && riferimento=${voce#*=}
    done
    if [ -z "$errori_disco" ]; then
      avviso "$disco ($seriale): contatore di integrita' non leggibile"
    elif [ -z "$riferimento" ]; then
      avviso "$disco ($seriale): seriale senza riferimento, errori di integrita' $errori_disco"
    elif [ "$errori_disco" -gt "$riferimento" ]; then
      guasto "$disco ($seriale): errori di integrita' $errori_disco, riferimento $riferimento: chiedere la sostituzione indicando il seriale"
    else
      ok "$disco ($seriale): errori di integrita' $errori_disco (riferimento $riferimento), $temperatura"
    fi
  done
fi

# --- Verifica end-to-end ------------------------------------------------------

sezione "Verifica end-to-end"
if [ "$RAPIDO" -eq 1 ]; then
  info "saltata (--rapido)"
elif [ ! -x "$REPO_DIR/ci/stack-verify.sh" ]; then
  avviso "ci/stack-verify.sh non trovato in $REPO_DIR"
else
  # Dalla radice del repository: la verifica legge le credenziali da percorsi
  # relativi alla copia di lavoro, come nel comando documentato.
  esito_verifica=$(cd "$REPO_DIR" && export APP_HOST STACK_NAME &&
    timeout -k 5 600 ./ci/stack-verify.sh 2>&1)
  stato_verifica=$?
  if [ "$stato_verifica" -eq 0 ]; then
    ok "ci/stack-verify.sh superata"
    tail -n 2 <<< "$esito_verifica" | while IFS= read -r riga; do info "$riga"; done
  else
    guasto "ci/stack-verify.sh fallita (uscita $stato_verifica), ultime righe:"
    tail -n 15 <<< "$esito_verifica" | while IFS= read -r riga; do info "$riga"; done
  fi
fi

# --- Esito --------------------------------------------------------------------

sezione "Esito"
printf '  %d OK, %d ATTENZIONE, %d GUASTO\n' "$riusciti" "$avvisi" "$guasti"
info "restano da guardare a mano: stato dei check su Healthchecks e sito da rete cellulare"
[ "$guasti" -eq 0 ]
