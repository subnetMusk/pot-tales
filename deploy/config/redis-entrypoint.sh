#!/bin/sh
# Avvio di Redis con le utenze costruite dal secret montato.
#
# L'elenco versionato in docker/redis/users.acl serve allo sviluppo e porta
# password note a chiunque abbia visto il repository: in produzione non va
# usato. Qui l'elenco si scrive all'avvio a partire dal secret, in un filesystem
# in memoria, e l'utente predefinito resta disattivato: senza credenziali Redis
# non accetta nessuno, nemmeno dalla rete interna.
#
# Il file va reso leggibile all'utente `redis`: l'entrypoint dell'immagine
# riduce i privilegi prima di avviare il server.
set -eu

PASS_FILE=${REDIS_PASSWORD_FILE:-/run/secrets/redis_password}
ACL=/dev/shm/users.acl

if [ ! -s "$PASS_FILE" ]; then
	# Dichiarato e non silenzioso: partire con un elenco vuoto significherebbe
	# un Redis che rifiuta anche il backend, con un errore che sembra di rete.
	echo "redis-entrypoint: password non leggibile in $PASS_FILE" >&2
	exit 1
fi

umask 077
{
	echo "user default off"
	printf 'user app on >%s ~* &* +@all\n' "$(cat "$PASS_FILE")"
} > "$ACL"
chown redis "$ACL"

# L'opzione sulla riga di comando prevale su quella della configurazione, che
# resta la stessa dello sviluppo.
exec docker-entrypoint.sh redis-server /usr/local/etc/redis/redis.conf --aclfile "$ACL"
