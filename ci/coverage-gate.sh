#!/usr/bin/env sh
# Misura la copertura del backend e la confronta con il pavimento.
#
# Il pavimento non e' l'obiettivo. L'obiettivo dichiarato e' 85%; il punto di
# partenza misurato e' 20,4%. Imporre subito l'obiettivo produrrebbe una pipeline
# stabilmente rossa, e una pipeline sempre rossa smette di essere letta: non
# viene piu' guardata proprio quando comincia a segnalare qualcosa di vero.
#
# Il pavimento puo' quindi solo salire. Serve a impedire che la copertura
# arretri mentre il codice cresce, che e' il modo in cui si arriva a fine
# progetto con meno copertura di quanta se ne aveva a meta'.
#
# Eseguito dentro il container Go: si aspetta di trovarsi nel modulo.
set -u

PAVIMENTO=${COVERAGE_FLOOR:-20}
OBIETTIVO=${COVERAGE_TARGET:-85}
PROFILO=${COVERAGE_PROFILE:-/tmp/cover.out}

go test -coverprofile="$PROFILO" ./... >/dev/null 2>&1

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

if [ "$raggiunto" = "1" ]; then
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
