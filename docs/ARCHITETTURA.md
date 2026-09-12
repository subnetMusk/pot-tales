# Architettura

Com'è fatto il sistema e perché. Come avviarlo è in [SVILUPPO.md](SVILUPPO.md); come
gestirlo in esercizio in [ESERCIZIO.md](ESERCIZIO.md).

## Componenti

| Componente | Ruolo |
|---|---|
| Frontend | landing page, consenso, informativa e applicazione Phaser, compilati con Vite e serviti da nginx |
| Backend | servizio Go: ciclo di vita della sessione, stato di gioco lato server, ingestione degli eventi |
| MongoDB | persistenza di sessioni e stato di gioco |
| Redis | cache di sessione e contatori delle quote |
| Traefik | unico ingresso, instradamento e difese di bordo |
| Stack Elastic | log, metriche e telemetria applicativa |
| Sandbox | gemello del frontend per prototipare, escluso dal monitoraggio |

La landing page realizzata insieme al gioco è la home del frontend (`/`). Il gioco
inizia su `/play`, dopo la scelta privacy, mentre l'informativa completa è su
`/privacy`. Il vecchio percorso `/info` non serve più una pagina separata e reindirizza
alla home per non lasciare inutilizzabili eventuali collegamenti già distribuiti.

## Reti

| Rete | Chi ci sta |
|---|---|
| `edge` / `proxy_net` | ciò che Traefik deve raggiungere |
| `data` / `internal_net` | base dati e cache, **senza uscita a internet** |
| `socket` | socket-proxy e i suoi soli consumatori |
| `elastic` / `kibana_net` | osservabilità e registro dei pacchetti Elastic |

La rete dei dati è dichiarata `internal`: base dati e cache non hanno alcun motivo di
raggiungere l'esterno, e impedirglielo è più economico che accorgersene dopo.

In produzione **Traefik è l'unico servizio che pubblica porte**, e lo fa in `mode: host`
e non `ingress`. Il routing mesh di Swarm applica SNAT e sostituirebbe l'indirizzo del
client con quello della rete interna: quote per indirizzo e rilevamento vedrebbero tutto
il traffico come proveniente da un unico host.

## Frontend

Phaser 3 con TypeScript, compilato da Vite.

| Directory | Contenuto |
|---|---|
| `src/scenes/` | scene di gioco |
| `src/items/` | oggetti ed entità |
| `src/network/` | sessione API e telemetria |
| `src/components/` | componenti di interfaccia riutilizzabili |
| `public/assets/` | sprite, audio, traduzioni |

Gli schemi in `comms/frontend/` definiscono i contratti verso il backend, validati con
Zod lato client.

**Politiche di cache in produzione**, tre e distinte: gli artefatti con un'impronta nel
nome sono `immutable` per un anno, gli asset di gioco hanno nomi stabili e quindi durata
di un'ora, il documento di ingresso non va mai in cache perché dichiara quali artefatti
caricare. Le postazioni ricaricano gli stessi asset molte volte al giorno: è l'intervento
con più effetto sul carico reale.

## Backend

Go con Gorilla Mux, driver MongoDB e Redis, agente APM Elastic.

### Validazione come whitelist

`server/middleware/validator.go` carica gli schemi JSON da `comms/server/public/` e
valida ogni corpo di richiesta contro lo schema corrispondente. **Una rotta senza schema
non è raggiungibile**: l'assenza di schema nega, non consente. Gli schemi sono dentro
l'immagine, non montati: il processo termina all'avvio se non li trova.

### Superficie HTTP

| Metodo | Rotta | Auth | Quota | Descrizione |
|---|---|---|---|---|
| POST | `/auth/session` | no | dedicata | Crea sessione (cookie `session_token`), con prova di lavoro |
| GET | `/auth/validate` | sì | 600 | Verifica sessione |
| GET | `/game/position` | sì | 1200 | Posizione, scena corrente e checkpoint raggiunti |
| GET | `/game/timer` | sì | 1200 | Tempo di gioco accumulato |
| POST | `/game/ping` | sì | 1200 | Battito di gioco, valida spostamento e accumula tempo |
| POST | `/game/checkpoint` | sì | 1200 | Registra un traguardo raggiunto |
| POST | `/game/reset` | sì | 1200 | Azzera i progressi della sessione |
| GET | `/health` | no | 0 | Stato di server, Mongo e Redis |
| POST | `/log` | no | 0 | Ingest eventi dal frontend verso Elastic |

La quota è per sessione e non per indirizzo, sulla finestra di
`SESSION_QUOTA_WINDOW_MIN` minuti (10 per default): un indirizzo pubblico è condiviso
da tutti gli utenti dietro lo stesso NAT, quindi un limite per indirizzo
penalizzerebbe utenti estranei a chi lo supera. Superata la quota la risposta è
`429` con `Retry-After`.

L'autenticazione usa session token (cookie più cache Redis e Mongo), non JWT:
`JWT_SECRET` in `.env` è un residuo non usato.

### Stato di gioco autoritativo

Il server tiene lo stato e valida i ping del client contro di esso. Un ping può essere
accettato, respinto con correzione di posizione, o rifiutato del tutto. La posizione
sospetta non viene mai persistita: la risposta riporta l'ultimo stato autoritativo.

Le coordinate compaiono solo dopo il primo ping. Lo stato nasce con coordinate a zero,
che non descrivono un punto della scena ma l'assenza di un punto: servirle come posizione
salvata riporterebbe il giocatore nell'angolo invece che al suo ingresso.

### Scritture confermate

Sessioni e stato di gioco si scrivono con write concern `j:true`. Il default conferma
quando il documento è in memoria: con il journal la conferma arriva dopo la scrittura su
disco, e una scrittura confermata sopravvive a un arresto brusco. Il volume è minimo, il
costo in latenza irrilevante, e la differenza è fra perdere le ultime scritture e non
perdere nulla di confermato.

### Ritenzione

Un indice TTL su `created_at` cancella i documenti dopo `DATA_RETENTION_DAYS`. È distinta
dalla validità della sessione, che è dell'ordine dei minuti: confonderle cancellerebbe i
dati appena la sessione scade.

## Osservabilità

Elasticsearch, Kibana, Fleet, APM e Filebeat. Nodo singolo, **zero repliche per scelta**:
su un nodo una replica non può essere allocata, resterebbe perennemente non assegnata e
il cluster giallo in permanenza. Un indicatore sempre acceso non distingue nulla, e
l'allarme sullo stato del cluster diventerebbe inutile proprio quando serve. Il prezzo è
esplicito: perdere il nodo significa perdere gli indici, e i dati che devono sopravvivere
passano dall'esportazione, non dal cluster.

### Le tre sorgenti

| Sorgente | Cosa contiene |
|---|---|
| Access log di Traefik | richieste, percorsi, user agent, codici di stato |
| APM RUM | caricamenti pagina, tempi di risorsa, errori JavaScript, chiamate HTTP |
| Log applicativi | tracce, latenza, eventi strutturati del backend |

### I tre dataset, e perché sono separati

| Dataset | Origine | Chi lo legge |
|---|---|---|
| `backend.api` | log del backend | vista di esercizio |
| `frontend.app` | eventi da `POST /log` | vista di esercizio |
| `gioco.partita` | fatti di partita emessi dal backend | **anche** la vista divulgativa |

Con licenza basic **la sicurezza a livello di documento non esiste**: non c'è modo di
concedere un sottoinsieme di documenti dentro un indice condiviso. La separazione in
indici distinti è l'unico meccanismo disponibile per delimitare ciò che viene condiviso,
e Filebeat instrada su `event.dataset`.

Ne discendono tre scelte:

- **Il token di sessione non compare** nei fatti di partita: è lo stesso valore che il
  visitatore porta nel cookie. Al suo posto un identificativo derivato con sale, che
  consente di contare e raggruppare senza consentire di collegare una riga a un browser.
- **Il dispositivo compare come classe**, non come stringa dichiarata, che sarebbe un
  vettore di riconoscimento.
- **La telemetria del frontend resta nel dataset tecnico.** Categoria, azione e dettagli
  che arrivano da `/log` li dichiara il client e non sono verificabili: instradarli sulla
  destinazione condivisa permetterebbe a chiunque parli con quell'endpoint di scrivere
  righe nelle dashboard pubbliche.

### Fatti di partita

Emessi dal backend nei punti in cui lo stato cambia, non sincronizzando i documenti di
MongoDB: Mongo resta la fonte autorevole dello stato corrente, Elasticsearch riceve i
fatti nel tempo.

| Evento | Origine |
|---|---|
| `sessione_iniziata` | creazione sessione |
| `scena_iniziata` | ping, solo sulla transizione di scena |
| `checkpoint_raggiunto` | endpoint dei traguardi |
| `partita_azzerata` | reset |
| `sessione_conclusa` | chiusura differita, espulsione o completamento |

L'ultimo non ha una richiesta in cui nascere: le partite finiscono quando qualcuno si
alza dalla postazione. Una spazzata periodica rivendica le partite ferme ed emette la
conclusione con durata e scena finale. La rivendicazione è atomica, quindi le repliche
del backend non emettono la stessa conclusione due volte.

### Due Space, due platee

| Space | Indici | Contenuto |
|---|---|---|
| Esercizio | tutti | salute del servizio, risorse, contenimento, imbuto |
| Andamento evento | solo `gioco.partita` | affluenza e comportamento, nessuno stato macchina |

Ruoli in sola lettura distinti, definiti come codice via provider Terraform. Le dashboard
non sono generate da Terraform ma esportate in NDJSON e reimportate: una dashboard si
disegna sui dati, e dichiararla prima di averli visti significa interrogare campi
ipotetici. Il codice governa il ciclo di vita dell'export, non il suo contenuto.

### Sorveglianza esterna

Un servizio esterno riceve battiti e allarmi: vive fuori dalla macchina, quindi parla
anche quando la macchina è morta. Con macchina singola è un requisito, non un lusso: il
monitoraggio interno muore insieme a ciò che monitora.

Le notifiche del servizio sono legate alla **transizione di stato**: un secondo segnale
di guasto mentre la destinazione è già in guasto non produce nulla. Per questo le classi
sono separate su check distinti, e ciascuna transita per conto proprio.

Due battiti — servizio e relay degli allarmi — e sei relay, che non scendono mai da soli
ma solo su un segnale esplicito.

## Sicurezza di bordo

Traefik con limite di frequenza, tetto sulle richieste in volo, tetto sul corpo,
interruttore per staccare un backend in sofferenza, intestazioni di sicurezza e politica
sui contenuti. CrowdSec come bouncer.

**Le soglie sono tarate per non danneggiare l'uso legittimo, non per contenere l'abuso.**
Dietro il NAT di una conferenza l'intera sala condivide un indirizzo, e un limite per
indirizzo tarato sul singolo utente colpisce tutti i presenti. È la stessa ragione per
cui le decisioni locali di CrowdSec sono disattivate.

Il controllo applicativo dei backend è distinto dall'healthcheck del container: il
secondo osserva il processo, il primo la risposta. Un servizio vivo che risponde in modo
non valido resta nel bilanciamento senza il primo.

## Fragilità note

Da conoscere prima di metterci mano.

**Race sui certificati all'avvio in sviluppo.** In `docker-compose.monitoring.yml` `es01`
dipende da `setup` con `condition: service_started` e non `service_healthy`, perché
`setup` attende a sua volta che ES risponda per impostare la password di `kibana_system`:
usare `service_completed_successfully` produrrebbe un deadlock. Il prezzo è una possibile
race in cui `es01` parte prima che i certificati siano scritti. In produzione il problema
non si pone: su Swarm non esiste `depends_on` e i servizi ripartono finché la dipendenza
non è pronta.

**Filebeat parte prima della propria utenza.** Scrive come `filebeat_writer`, che
Terraform crea al bootstrap con i privilegi per scrivere i log e gestirne template e
ciclo di vita, e nient'altro. Fino a quel momento riceve un 401 e ritenta, e dopo il
primo avvio il servizio risulta non sano per qualche minuto: lo stack converge da solo,
come per gli agenti Fleet.

**I config e i secret di Swarm sono immutabili.** Modificare un file lasciando invariato
il nome non aggiorna nulla: il demone rifiuta, il deploy esce con errore e i servizi
restano montati sul contenuto precedente. Il nome porta l'impronta del contenuto proprio
per questo, e `--prune` non rimuove i config e i secret sostituiti, che vanno rimossi a
parte.

**Segreti.** In sviluppo `.env` contiene password in chiaro. In produzione i valori sono
generati sulla macchina da `provisioning/bin/generate-secrets.sh` e non entrano mai nel
repository. Arrivano ai servizi come Docker secret, trasmessi su mTLS, cifrati nel Raft
log e montati in un filesystem in memoria sotto `/run/secrets`: non compaiono mai
nell'ambiente né nella specifica del servizio. Sul disco della macchina restano come file
con permessi 0400 in una directory 0700.

Cambiare un valore è un'operazione ordinaria, perché il nome del secret segue il contenuto
come per i config; quali valori vanno prima cambiati nel servizio è descritto in
[`ESERCIZIO.md`](ESERCIZIO.md#cambiare-un-secret). Cifrare i file, per esempio con SOPS,
servirebbe a condividere il `.env` di sviluppo. In produzione sposterebbe il problema sulla
chiave che li decifra, che l'avvio non presidiato dovrebbe comunque trovare sulla macchina.

## Riferimenti

- [`provisioning/README.md`](../provisioning/README.md) — preparazione dell'host, sorveglianza, dati
- [`terraform/README.md`](../terraform/README.md) — osservabilità come codice, stato Terraform
- [`terraform/elk/README.md`](../terraform/elk/README.md) — Space, ruoli, utenze, dashboard
- [`secrets/README.md`](../secrets/README.md) — secret dello stack
- `deploy/stack.yml` — definizione dello stack di produzione
