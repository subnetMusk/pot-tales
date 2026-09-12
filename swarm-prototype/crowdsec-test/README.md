# CrowdSec con Traefik 3.7

Ambiente minimo per verificare l'integrazione fra CrowdSec e Traefik tramite il
bouncer plugin: LAPI, Traefik e un backend di prova.

```bash
docker compose up -d
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:18080/
docker compose exec crowdsec cscli decisions add --ip <IP> --duration 5m --type ban
```

## Risultati

Verificato con Traefik 3.7.10, CrowdSec 1.7.8 e bouncer plugin 1.7.1.

| Verifica | Esito |
|---|---|
| Caricamento del plugin | riuscito |
| Blocco di un IP con decisione attiva | 403 entro pochi secondi |
| Ripristino dopo rimozione della decisione | riuscito |
| Comportamento con LAPI non raggiungibile | dipende da `updateMaxFailure` |
| Analisi degli access log di Traefik | 182 righe lette, 182 interpretate, 0 non interpretate |
| Rilevamento automatico | 4 scenari attivati su traffico di scansione |
| Emissione automatica della decisione | ban creato senza intervento |
| Durata graduata sulla recidiva | quarta decisione a 60 minuti anziche' 15 |

## Catena di rilevamento

Con `crowdsecurity/traefik` e `crowdsecurity/base-http-scenarios` installate,
60 richieste a percorsi inesistenti da uno stesso indirizzo hanno attivato
`http-probing`, `http-crawl-non_statics`, `http-wordpress-scan` e
`http-admin-interface-probing`, producendo una decisione di ban applicata dal
bouncer: 403 per l'indirizzo colpito, 200 per gli altri.

La durata segue `duration_expr` nei profili e cresce con il numero di decisioni
gia' emesse per lo stesso indirizzo: la quarta e' stata emessa per 60 minuti
invece dei 15 iniziali.

## Due comportamenti da conoscere

**Gli indirizzi privati sono in whitelist.** La collection
`crowdsecurity/whitelists`, installata di serie, scarta il traffico proveniente
da reti private: in una prova da rete locale tutte le righe risultano
`whitelisted` e nessuno scenario si attiva. Per esercitare il rilevamento
serve un indirizzo pubblico.

**L'indirizzo osservato e' quello che Traefik registra come `ClientHost`.**
Quando Traefik e' il punto di ingresso coincide con il client reale. In questo
ambiente di prova l'entrypoint dichiara `forwardedHeaders.trustedIPs` per poter
simulare un client pubblico tramite header; una configurazione del genere non va
riportata in produzione, dove renderebbe l'indirizzo dichiarabile dal client.

## Comportamento con LAPI non raggiungibile

Con la configurazione predefinita, l'arresto di CrowdSec porta il bouncer a
rispondere 403 a ogni richiesta. Il valore `updateMaxFailure` vale `0` di
default: al primo aggiornamento fallito lo stream viene marcato non integro e
tutte le richieste vengono bloccate.

Impostando `updateMaxFailure: -1` la condizione di stream non integro non viene
mai attivata e il bouncer continua a decidere sulla base dell'ultima lista di
decisioni ricevuta.

Verificato in entrambe le direzioni: con `-1`, CrowdSec arrestato e Traefik
riavviato senza aver mai raggiunto la LAPI, le richieste ricevono 200; a
CrowdSec riavviato, una nuova decisione produce nuovamente 403.

La scelta determina quale comportamento si preferisce in caso di
indisponibilita' del servizio di decisione: interruzione completa del traffico
oppure perdita della sola protezione aggiuntiva.

## Dipendenza da rete in fase di avvio

Il bouncer e' un plugin Traefik, cioe' sorgente Go interpretato che Traefik
scarica da GitHub all'avvio. Il proxy dipende quindi dalla raggiungibilita' di
GitHub al momento della partenza, salvo che il plugin risulti gia' presente in
`plugins-storage`.

## Perimetro

La prova del blocco e' stata condotta senza collezioni di rilevamento e riguarda
il percorso fra decisione e applicazione; quella del rilevamento, descritta
sopra, con `crowdsecurity/traefik` e `crowdsecurity/base-http-scenarios`. Le
collezioni usate in produzione sono dichiarate in `deploy/stack.yml`.
