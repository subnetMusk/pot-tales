#!/bin/sh
# Regole della catena DOCKER-USER: dall'interfaccia pubblica raggiungono i
# contenitori solo le connessioni sulle porte 80 e 443.
#
#   docker-user-rules.sh <interfaccia>
#
# Invocato da docker-user-rules@<interfaccia>.service dopo l'avvio del demone.
#
# La porta si confronta con la destinazione originale, letta dal tracciamento
# delle connessioni: in questa catena il pacchetto e' gia' stato tradotto verso
# il contenitore, e la porta visibile e' quella interna, che non coincide per
# forza con quella pubblicata.
#
# RETURN e non ACCEPT: le regole di Docker che seguono vanno comunque valutate.
# Le risposte alle connessioni gia' stabilite passano sempre, altrimenti i
# contenitori non riceverebbero le risposte alle proprie richieste in uscita.
#
# La catena viene svuotata e riempita da capo, per IPv4 e per IPv6: l'indirizzo
# IPv6 pubblico della macchina esiste anche senza record AAAA.
set -eu

IFACE=${1:-}
if [ -z "$IFACE" ]; then
  echo "uso: $0 <interfaccia>" >&2
  exit 2
fi
if [ ! -e "/sys/class/net/$IFACE" ]; then
  echo "interfaccia inesistente: $IFACE" >&2
  exit 1
fi

for ipt in iptables ip6tables; do
  "$ipt" -N DOCKER-USER 2>/dev/null || true
  "$ipt" -F DOCKER-USER
  "$ipt" -A DOCKER-USER -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
  for porta in 80 443; do
    "$ipt" -A DOCKER-USER -i "$IFACE" -p tcp -m conntrack \
      --ctorigdstport "$porta" --ctdir ORIGINAL -j RETURN
  done
  "$ipt" -A DOCKER-USER -i "$IFACE" -j DROP
  "$ipt" -A DOCKER-USER -j RETURN
done
