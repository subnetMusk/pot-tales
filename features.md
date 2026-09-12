# Funzionalità e verifiche esterne

Questo documento raccoglie ciò che un operatore può osservare o verificare
senza modificare il codice. Le procedure invasive, il provisioning e il
ripristino restano in [docs/ESERCIZIO.md](docs/ESERCIZIO.md).

## Superficie pubblica

| Funzione | Indirizzo | Esito atteso |
|---|---|---|
| Home e ingresso al gioco | `https://pot-tales.it/` | pagina bilingue, link “Gioca ora” e galleria |
| Gioco | `https://pot-tales.it/play` | scelta privacy, poi caricamento del gioco su desktop |
| Salute applicativa | `https://pot-tales.it/health` | HTTP 200 e JSON con `server`, `mongodb` e `redis` a `true` |
| Informativa privacy | `https://pot-tales.it/privacy` | pagina statica in italiano e inglese |
| Accessibilità | `https://pot-tales.it/accessibility` | dichiarazione e contatti del progetto |
| Indicizzazione | `https://pot-tales.it/robots.txt` e `https://pot-tales.it/sitemap.xml` | file testuali |

Verifica rapida, esclusivamente in lettura:

```bash
curl --fail --silent --show-error https://pot-tales.it/health
curl --fail --head https://pot-tales.it/robots.txt
curl --fail --head https://pot-tales.it/sitemap.xml
```

## Dashboard

Le dashboard sono in sola lettura e separate per pubblico. L’autenticazione è
HTTP Basic; la stessa credenziale viene poi verificata da Kibana e può accedere
soltanto allo Space assegnato.

### Esercizio

- [Servizio e funnel](https://pot-tales.it/osservabilita/s/esercizio/app/dashboards#/view/esercizio-servizio-funnel): richieste e codici HTTP, latenza APM, telemetria RUM, log ed errori applicativi, funnel di gioco.
- [Salute e risorse](https://pot-tales.it/osservabilita/s/esercizio/app/dashboards#/view/esercizio-salute-risorse): allarmi, CPU e memoria di host e container, filesystem ed esiti degli healthcheck Docker.
- [Latenza ed errori](https://pot-tales.it/osservabilita/s/esercizio/app/dashboards#/view/esercizio-latenza-errori): latenza media e massima nel tempo, confronto fra transazioni ed errori per azione, dataset e intervallo.

La platea di esercizio dispone anche di **Discover** per consultare i documenti
tecnici non aggregati quando un pannello non basta a spiegare un’anomalia.

### Evento

- [Andamento dell’evento](https://pot-tales.it/osservabilita/s/evento/app/dashboards#/view/evento-andamento): sessioni e partite osservabili, completamenti, durata, dispositivi, avanzamento e ultimi eventi pseudonimizzati.
- [Impatto dell’evento](https://pot-tales.it/osservabilita/s/evento/app/dashboards#/view/evento-impatto): partite totali, sessioni create, partite iniziate e completate, partite con RUM e tempo medio di gioco.

Il numero di documenti del data stream non coincide con il numero di partite:
ogni documento è un fatto (creazione, checkpoint, cambio scena o conclusione).
Con la telemetria facoltativa un click su **Play** produce tre fatti iniziali: una
`sessione_iniziata`, un `checkpoint_raggiunto` per `game_started` e una
`partita_avviata`. I riquadri “Partite totali”, “Sessioni create”, “Partite
iniziate” e “Partite completate” filtrano invece il singolo evento corrispondente e
devono crescere di una sola unità per partita. “Partite iniziate” ha la stessa
definizione (`game_started`) nelle due dashboard.

Lo Space evento offre anche **Discover** sui soli fatti di gioco, per consultare
i documenti non aggregati. Non espone log tecnici, indirizzi, cookie o token di sessione.
Solo “Partite totali” conta tutte le partite avviate, anche senza consenso: è un
conteggio anonimo, senza identificativo di partita né dispositivo. Tutti gli altri dati
esistono soltanto per le partite per cui il visitatore ha scelto la telemetria
facoltativa; questo limite è intenzionale e va considerato quando si interpretano i
totali.

### Credenziali

Le password non sono nel repository. Sulla macchina di produzione:

- gli utenti ammessi sono elencati, come hash bcrypt, in
  `secrets/dashboard_users_esercizio` e `secrets/dashboard_users_evento`;
- la sorgente root-only usata da Terraform è
  `secrets/dashboard_users.tfvars.json`;
- le credenziali della dashboard di esercizio proteggono anche il prelievo
  degli export.

I soli nomi utente si possono elencare senza mostrare password:

```bash
sudo cut -d: -f1 \
  /srv/progetti_innovativi/secrets/dashboard_users_esercizio \
  /srv/progetti_innovativi/secrets/dashboard_users_evento
```

Per creare, verificare o ruotare una credenziale si usa lo strumento previsto,
non si modificano a mano i file generati:

```bash
cd /srv/progetti_innovativi
sudo provisioning/bin/configure-dashboard-users.py secrets
sudo systemctl restart stack-deploy.service
sudo systemctl restart fleet-bootstrap.service
```

## Esportazione dei dati

La produzione di un export **non è esposta via HTTP**: poterla avviare dal web
offrirebbe una leva per saturare disco e I/O. Un operatore la avvia dalla
macchina:

```bash
sudo systemctl start data-export.service
sudo journalctl -u data-export.service -f
```

Ogni esecuzione crea `/srv/export/<marca-temporale>/` con:

- `MANIFEST.txt`, sorgenti, conteggi, tempi ed esito;
- `SHA256SUMS`, somme per verificare l’integrità dopo il trasferimento;
- `elastic/*.ndjson.gz`, documenti Elastic completi;
- `mongo/game_db.archive.gz`, stato nativo ripristinabile con `mongorestore`.

Il servizio web consente soltanto `GET` e `HEAD`, non elenca directory e non
può avviare nuove esportazioni. Il nome esatto del file si legge dal manifesto.
Il prelievo usa la stessa credenziale della dashboard di esercizio:

```bash
read -rp 'Utente esercizio: ' EXPORT_USER
read -rsp 'Password: ' EXPORT_PASSWORD; echo
curl --fail --user "$EXPORT_USER:$EXPORT_PASSWORD" \
  --output dati.ndjson.gz \
  'https://pot-tales.it/export/<marca-temporale>/elastic/<nome>.ndjson.gz'
unset EXPORT_PASSWORD
```

La radice `/export` risponde intenzionalmente `404`, anche dopo
l’autenticazione: l’assenza di directory listing evita di esporre struttura e
cadenza degli archivi.

## Controlli esterni e notifiche

Il badge nel [README](README.md) riassume lo stato del progetto Healthchecks.io.
I controlli sono separati per classe di guasto:

| Check | Cosa verifica | Comportamento |
|---|---|---|
| `stack-liveness` | applicazione e dipendenze | battito ogni 5 minuti; il silenzio allarma |
| `app-degradation` | errori e latenza | relay su transizione |
| `host-resources` | memoria, swap, disco e OOM | relay su transizione |
| `observability` | cluster Elastic e ingestione | relay su transizione |
| `security` | attività anomala | relay su transizione |
| `alert-relay` | processo che inoltra gli allarmi | battito periodico |
| `tls-pubblico` | catena e scadenza del certificato servito | relay su transizione |
| `backup-nightly` | esito della copia notturna | job schedulato alle 03:30 |

I recapiti sono in `/etc/stack-surveillance.env`, root-only. La chiave di ping
equivale a tutti gli endpoint e non deve comparire in documentazione, shell
history o log. Un test controllato invia prima `/fail` e poi il rientro al
medesimo check; non modifica DNS, challenge ACME, certificati o HSTS.

Il ciclo completo, con messaggi `x/8` e rientro di sicurezza anche in caso di
interruzione, è disponibile sulla macchina:

```bash
cd /srv/progetti_innovativi
sudo FORCE=1 ./provisioning/bin/healthchecks-drill.sh
```

## Diagnostica dalla macchina

Questi comandi sono in sola lettura e non costruiscono immagini:

```bash
cd /srv/progetti_innovativi
sudo bash -c '. /etc/stack-deploy.env; docker stack services "$STACK_NAME"; docker stack ps "$STACK_NAME" --no-trunc --filter desired-state=running'
sudo systemctl status stack-heartbeat.timer alert-notifier.timer \
  backup-nightly.timer traefik-logrotate.timer
sudo journalctl -u stack-heartbeat.service -u alert-notifier.service --since today
sudo journalctl -u data-backup.service --since today
```

La verifica end-to-end completa, sulla macchina di produzione che non richiede
`make`, è:

```bash
cd /srv/progetti_innovativi
sudo bash -c '. /etc/stack-deploy.env; export APP_HOST STACK_NAME; ./ci/stack-verify.sh'
```

Eseguita come root, legge la prima utenza tecnica dalla fonte root-only senza
stampare la password. Altrove richiede `DASHBOARD_USER` e `DASHBOARD_PASSWORD`
nell’ambiente; non vanno mai passate come argomenti o scritte nella cronologia.
