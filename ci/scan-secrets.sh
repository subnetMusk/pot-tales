#!/usr/bin/env bash
# Cerca credenziali in cio' che e' effettivamente versionato.
#
# Non nell'albero di lavoro sul disco: contiene `.env`, lo stato Terraform e i
# dati dei volumi, tutti ignorati da git e tutti pieni di valori veri. Sarebbero
# segnalazioni corrette su file che non finiranno mai in un commit, cioe' rumore
# che porta a spegnere il controllo.
#
# Non nella cronologia: e' immutabile e contiene credenziali di sviluppo note,
# destinate alla rotazione. Continuerebbe a segnalarle anche dopo che i file
# sono stati corretti, e un controllo che non puo' tornare verde smette di
# essere letto. La cronologia ha un target proprio, non bloccante.
#
# Il contenuto versionato si ottiene esportando l'albero del commit corrente:
# l'elenco si mantiene da solo, senza duplicare le regole di esclusione.
set -uo pipefail

GITLEAKS_IMAGE=${GITLEAKS_IMAGE:-zricethezav/gitleaks:v8.28.0@sha256:cdbb7c955abce02001a9f6c9f602fb195b7fadc1e812065883f695d1eeaba854}
RIF=${RIF:-HEAD}

# Dentro il repository e non in /tmp: il percorso viene passato a Docker, e su
# Windows un percorso assoluto in stile POSIX non verrebbe risolto.
ESPORTAZIONE=.scan-tree

pulisci() { rm -rf "$ESPORTAZIONE"; }
trap pulisci EXIT
pulisci
mkdir -p "$ESPORTAZIONE"

git archive "$RIF" | tar -x -C "$ESPORTAZIONE" || {
  echo "esportazione dell'albero fallita" >&2
  exit 1
}

conteggio=$(find "$ESPORTAZIONE" -type f | wc -l)
if [ "$conteggio" -lt 10 ]; then
  echo "PREMESSA FALLITA: esportati solo $conteggio file, l'albero non e' completo" >&2
  exit 1
fi
echo "file versionati esaminati: $conteggio"

# `--source=.` e non un percorso assoluto: in questa modalita' i percorsi
# riportati seguono la sorgente, e le esclusioni sono scritte come relative.
MSYS_NO_PATHCONV=1 docker run --rm \
  -v "$(pwd)/$ESPORTAZIONE":/repo -w /repo \
  "$GITLEAKS_IMAGE" detect --source=. --no-git --redact --verbose
