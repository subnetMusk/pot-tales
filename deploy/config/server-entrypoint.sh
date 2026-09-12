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

# Sale degli identificativi di partita, per la stessa via e la stessa ragione.
# Senza, il backend ne genera uno a ogni avvio e le partite a cavallo di un
# riavvio vengono contate due volte: lo si dichiara e si prosegue, perche' il
# conteggio e' un dato accessorio e non deve impedire di giocare.
SALT_FILE=${GAMEPLAY_ID_SALT_FILE:-/run/secrets/gameplay_id_salt}

if [ -r "$SALT_FILE" ]; then
	GAMEPLAY_ID_SALT=$(cat "$SALT_FILE")
	export GAMEPLAY_ID_SALT
else
	echo "server-entrypoint: sale degli identificativi non leggibile in $SALT_FILE, ne verra' generato uno a ogni avvio" >&2
fi

# Chiave delle sfide a prova di lavoro. Senza, il backend usa il predefinito del
# codice, pubblico nel repository: chiunque potrebbe firmarsi una sfida a
# difficolta' zero, e la soglia sulla creazione di sessioni non tratterrebbe
# nessuno. Come per il sale, lo si dichiara e si prosegue.
POW_SECRET_FILE=${POW_SECRET_FILE:-/run/secrets/pow_secret}

if [ -r "$POW_SECRET_FILE" ]; then
	POW_SECRET=$(cat "$POW_SECRET_FILE")
	export POW_SECRET
else
	echo "server-entrypoint: chiave delle sfide non leggibile in $POW_SECRET_FILE, la soglia sulla creazione di sessioni e' aggirabile" >&2
fi

# Credenziali di MongoDB. L'immagine del database abilita l'autenticazione
# tramite MONGO_INITDB_ROOT_PASSWORD_FILE: il ping resta accessibile anche senza
# login, quindi un backend privo di credenziali supera il controllo di salute ma
# fallisce alla prima scrittura. La URI viene composta qui, nello stesso
# processo del backend, senza pubblicare la password nella specifica Swarm.
#
# I secret prodotti da generate-secrets.sh contengono soltanto caratteri
# alfanumerici, quindi possono essere inseriti nella userinfo della URI senza
# codifica aggiuntiva. Una MONGO_URI esplicita continua ad avere precedenza per
# ambienti che gestiscono le credenziali in altro modo.
MONGO_PASSWORD_FILE=${MONGO_PASSWORD_FILE:-/run/secrets/mongo_root_password}

if [ -z "${MONGO_URI:-}" ]; then
	if [ ! -r "$MONGO_PASSWORD_FILE" ]; then
		echo "server-entrypoint: password MongoDB non leggibile in $MONGO_PASSWORD_FILE" >&2
		exit 1
	fi

	MONGO_URI="mongodb://${MONGO_ROOT_USERNAME:-root}:$(cat "$MONGO_PASSWORD_FILE")@${MONGO_ADDR:-db:27017}/${MONGO_DB_NAME:-game_db}?authSource=${MONGO_AUTH_SOURCE:-admin}"
	export MONGO_URI
fi

# Credenziali di Redis. In produzione Redis non accetta connessioni senza utente
# (vedi redis-entrypoint.sh): l'indirizzo con utente e password si costruisce qui
# dal secret, cosi' la password resta nell'ambiente del solo processo e non
# nella specifica del servizio. Senza secret l'indirizzo resta quello
# configurato.
REDIS_PASSWORD_FILE=${REDIS_PASSWORD_FILE:-/run/secrets/redis_password}

if [ -r "$REDIS_PASSWORD_FILE" ]; then
	REDIS_URL="redis://app:$(cat "$REDIS_PASSWORD_FILE")@${REDIS_ADDR:-redis:6379}/0"
	export REDIS_URL
fi

exec /server "$@"
