#!/usr/bin/env sh
# Misura la copertura del backend e la confronta con il pavimento.
#
# Il pavimento e' partito dal valore misurato, 20,4%, ed e' salito man mano
# fino all'obiettivo dell'85%, con cui oggi coincide. Imporre subito l'obiettivo
# avrebbe prodotto una pipeline stabilmente rossa, e una pipeline sempre rossa
# smette di essere letta proprio quando comincia a segnalare qualcosa di vero.
#
# Il pavimento puo' solo salire. Serve a impedire che la copertura arretri
# mentre il codice cresce, che e' il modo in cui si arriva a fine progetto con
# meno copertura di quanta se ne aveva a meta'.
#
# Eseguito dentro il container Go: si aspetta di trovarsi nel modulo.
set -u

PAVIMENTO=${COVERAGE_FLOOR:-85}
OBIETTIVO=${COVERAGE_TARGET:-85}
PROFILO=${COVERAGE_PROFILE:-/tmp/cover.out}

go test ${GO_TAGS:+-tags=$GO_TAGS} -coverpkg=./... -coverprofile="$PROFILO" ./... >/dev/null 2>&1

# Il punto di ingresso e' escluso dal conteggio.
#
# Contiene cablaggio: legge la configurazione, apre le connessioni, assembla i
# componenti nell'ordine in cui vanno assemblati. Un test che lo attraversa
# asserisce di aver chiamato le funzioni nell'ordine in cui le si chiama, il che
# non distingue una versione corretta da una sbagliata. Cio' che conta davvero
# di quel file — che l'assemblaggio produca un servizio funzionante — e'
# verificato avviandolo, non misurandolo.
ESCLUSI=${COVERAGE_EXCLUDE:-'/server/main\.go:'}
FILTRATO="${PROFILO}.filtrato"
head -1 "$PROFILO" > "$FILTRATO"
grep -vE "$ESCLUSI" "$PROFILO" | tail -n +2 >> "$FILTRATO"
PROFILO="$FILTRATO"

totale=$(go tool cover -func="$PROFILO" | tail -1 | grep -oE '[0-9]+\.[0-9]+' | tail -1)
if [ -z "$totale" ]; then
  echo "copertura non misurabile: profilo assente o vuoto" >&2
  exit 1
fi

echo "copertura totale: $totale%   pavimento: $PAVIMENTO%   obiettivo: $OBIETTIVO%"

# Confronto senza dipendere da `bc`, che non e' presente in tutte le immagini:
# awk c'e' ovunque e fa aritmetica in virgola mobile.
sotto=$(awk -v t="$totale" -v p="$PAVIMENTO" 'BEGIN { print (t < p) ? 1 : 0 }')
raggiunto=$(awk -v t="$totale" -v o="$OBIETTIVO" 'BEGIN { print (t >= o) ? 1 : 0 }')

if [ "$sotto" = "1" ]; then
  echo "la copertura e' scesa sotto il pavimento" >&2
  exit 1
fi

# Il suggerimento ha senso solo finche' il pavimento e' sotto l'obiettivo:
# ripeterlo quando coincidono sarebbe rumore a ogni esecuzione.
sotto_obiettivo=$(awk -v p="$PAVIMENTO" -v o="$OBIETTIVO" 'BEGIN { print (p < o) ? 1 : 0 }')
if [ "$raggiunto" = "1" ] && [ "$sotto_obiettivo" = "1" ]; then
  echo "obiettivo raggiunto: alzare COVERAGE_FLOOR a $OBIETTIVO"
fi

# Le voci meno coperte, perche' il numero da solo non dice dove intervenire.
# L'ordinamento passa da awk: `sort` con separatore di tabulazione richiede una
# sintassi che non tutte le shell POSIX accettano.
echo
echo "funzioni meno coperte:"
go tool cover -func="$PROFILO" \
  | grep -v '^total:' \
  | awk '{ gsub("%", "", $NF); printf "%6.1f  %s  %s\n", $NF, $1, $2 }' \
  | sort -n | head -10
