#!/bin/sh
# Avvio del backend con il token dell'intake APM letto dal secret montato.
#
# L'agente APM per Go si configura solo da variabili d'ambiente: non ha
# un'opzione per leggere il token da file, come invece hanno le keystore di
# Kibana e Filebeat. Il valore viene quindi caricato qui e resta nell'ambiente
# del solo processo del backend, senza comparire nella specifica del servizio,
# che e' leggibile da chiunque possa interrogare l'API di Docker.
#
# Senza token l'intake risponde 401 a ogni invio. L'agente non lo segnala: non
# ha modo di distinguere un rifiuto da una consegna, quindi il backend
# continuerebbe a dichiarare di avere il monitoraggio attivo mentre nessuna
# traccia arriva.
set -eu

TOKEN_FILE=${APM_SECRET_TOKEN_FILE:-/run/secrets/apm_secret_token}

if [ -r "$TOKEN_FILE" ]; then
	ELASTIC_APM_SECRET_TOKEN=$(cat "$TOKEN_FILE")
	export ELASTIC_APM_SECRET_TOKEN
else
	# Dichiarato e non silenzioso: senza token le tracce vengono rifiutate, e
	# scoprirlo da una dashboard vuota costa molto piu' che leggerlo qui.
	echo "server-entrypoint: token APM non leggibile in $TOKEN_FILE, le tracce saranno rifiutate" >&2
fi

exec /server "$@"
