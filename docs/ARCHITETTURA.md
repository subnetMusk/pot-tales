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
| POST | `/game/ping` | sì | 1200 | Ping di gioco, salva posizione e rinnova attività |
| POST | `/game/checkpoint` | sì | 1200 | Registra un traguardo raggiunto |
| POST | `/game/reset` | sì | 1200 | Azzera i progressi della sessione |
| GET | `/health` | no | 0 | Stato di server, Mongo e Redis |

La quota è per sessione e non per indirizzo, sulla finestra di
`SESSION_QUOTA_WINDOW_MIN` minuti (10 per default): un indirizzo pubblico è condiviso
da tutti gli utenti dietro lo stesso NAT, quindi un limite per indirizzo
penalizzerebbe utenti estranei a chi lo supera. Superata la quota la risposta è
`429` con `Retry-After`.

L'autenticazione usa session token (cookie, cache Redis e Mongo).

### Stato di gioco

Il backend conserva posizione, scena e checkpoint ricevuti dal client dopo
autenticazione, schema e quota. Il ping arriva ogni 7 secondi mediante un timer
del browser indipendente dalle scene: prosegue mentre la scena principale è
in pausa per un minigioco. Alla chiusura della scena il timer si ferma e le
risposte ancora in volo non modificano la scena successiva.

Non ci sono controlli di velocità o espulsioni per ritardo: il gioco include
spostamenti a copione e cambi di stanza. La posizione è un dato di ripresa
dichiarato dal client, non una prova anti-cheat. L'endpoint non usato
`/game/timer` e l'accumulatore di tempo sono stati rimossi.

Le coordinate compaiono solo dopo il primo ping. Gli zeri iniziali non sono
una posizione salvata: prima di quel ping il client usa il punto di ingresso.

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

### I dataset, e perché sono separati

| Dataset | Origine | Chi lo legge |
|---|---|---|
| `traefik.access` | access log del bordo, senza IP né credenziali | vista di esercizio |
| `backend.api` | log del backend | vista di esercizio |
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
- **I fatti didattici li emette il backend.** Il logger del client e il suo
  endpoint pubblico non sono usati e sono stati rimossi. Il RUM resta una
  sorgente tecnica separata e richiede consenso.

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
| `sessione_conclusa` | chiusura differita o completamento |
| `partita_avviata` | primo checkpoint `game_started`, **anche senza consenso** |

Tutti i fatti richiedono il consenso analitico tranne `partita_avviata`, il conteggio
anonimo dell'affluenza. Può farne a meno perché porta soltanto azione e orario: nessun
`partita.id`, che lo collegherebbe agli altri fatti della stessa partita, nessuna
classe di dispositivo né altri dettagli. È emesso una sola volta per sessione, con la
stessa idempotenza del checkpoint da cui nasce.

La durata (`partita.durata_ms`) va dalla creazione all'ultimo ping ricevuto.
Stage 1, 2 e 3 inviano il ping ogni 7 secondi, anche durante i minigiochi.
Una scheda in background può subire il throttling del browser: la durata non
è una misura esatta dell'attenzione del giocatore. La chiusura per inattività
usa 15 minuti per default, distinti dal TTL della sessione.

Il click su **Play** apre sempre una nuova partita: se il browser ha già una sessione ne
azzera lo stato (`partita_azzerata`), poi crea la sessione prima di entrare in Stage 1 e
registra subito il checkpoint `game_started`. Questo primo traguardo estende il TTL
ridotto delle sessioni appena create e separa nelle dashboard l'avvio effettivo dal
completamento di Stage 1 (`stage1_complete`). **Continue** riprende invece la sessione e
lo stato esistenti. Una guardia condivisa fra i due pulsanti ignora il doppio click e
impedisce che Play azzeri una partita appena ripresa.

**Continue** riparte dalla scena dell'ultimo ping. Stage 1 riparte dall'inizio: fino al suo
completamento non c'è progresso salvato. Stage 2 ripristina sonda, laser, torrette e livello
dello Shooter; Stage 3 i quiz risolti, e con tutti e tre risolti apre subito la porta, perché
recap e porta partono solo dalla risposta corretta al terzo quiz.

Le scene Phaser sono istanze riusate: `scene.start()` e `launch()` non le ricostruiscono, e
gli inizializzatori dei campi di classe girano una volta sola per pagina. Lo stato di
partita (flag di Stage 2 e Stage 3, picchi del minigioco dei grafici) sta quindi in
`frontend/src/items/stageRunState.ts`, e le scene lo ricreano a ogni avvio: Stage 2 e
Stage 3 in `init()`, prima che `create()` lo ricostruisca dai checkpoint, GraficoGame in
`create()`. L'inventario vive nel registry del gioco, che sopravvive a tutte le scene, e lo
svuota il menu a ogni apertura. Così si giocano più partite di fila nella stessa scheda
senza ricaricare la pagina.

Per la stessa ragione gli eventi di una scena (`scene.events`) sopravvivono allo shutdown:
li svuota solo la distruzione della scena, che nel gioco non avviene. Un oggetto che vi
registra un listener lo deve togliere quando viene distrutto
(`frontend/src/items/sceneListeners.ts`, usato dal Player), e un gestore che deve
scattare una volta per partita va registrato con `once`. Altrimenti, al riavvio della
scena, il listener di un oggetto già distrutto scatta con `this.scene` non definito e
l'eccezione blocca anche i listener della partita nuova.

Il data stream contiene **fatti**, non una riga per partita. Con il consenso un singolo
click su **Play** produce esattamente tre fatti iniziali: una `sessione_iniziata`, un
`checkpoint_raggiunto` con checkpoint `game_started` e una `partita_avviata`; senza,
soltanto la `partita_avviata`. Se esisteva una sessione, li precede la
`partita_azzerata` di quella precedente. La progressione aggiunge poi un
fatto per ciascun checkpoint distinto, cambio scena e conclusione. I contatori
“partite” filtrano gli eventi unici del ciclo di vita e crescono di una sola unità per
partita; il conteggio grezzo dei documenti misura invece il volume degli eventi. Il
checkpoint finale `stage3_complete` chiude immediatamente la partita con motivo
`completata`, così la spazzata non la riclassifica come abbandono per inattività.

Per gli abbandoni l'ultimo evento non ha una richiesta in cui nascere: la partita finisce
quando qualcuno si alza dalla postazione. Una spazzata periodica rivendica le partite
ferme ed emette la conclusione con durata e scena finale. La rivendicazione è atomica,
quindi le repliche del backend non emettono la stessa conclusione due volte.

### Due Space, due platee

| Space | Indici | Contenuto |
|---|---|---|
| Esercizio | tutti | salute del servizio, risorse, contenimento, imbuto |
| Andamento evento | solo `gioco.partita` | affluenza e comportamento, nessuno stato macchina |

Ruoli in sola lettura distinti, definiti come codice via provider Terraform. Le dashboard
non sono generate da Terraform ma esportate in NDJSON e reimportate: una dashboard si
disegna sui dati, e dichiararla prima di averli visti significa interrogare campi
ipotetici. Il codice governa il ciclo di vita dell'export, non il suo contenuto.
Discover resta entro lo stesso confine: nello Space evento rende consultabili i soli
fatti pseudonimizzati di `gioco.partita`, senza concedere log tecnici, metriche o tracce.

### Sorveglianza esterna

Un servizio esterno riceve battiti e allarmi: vive fuori dalla macchina, quindi parla
anche quando la macchina è morta. Con macchina singola è un requisito, non un lusso: il
monitoraggio interno muore insieme a ciò che monitora.

Le notifiche del servizio sono legate alla **transizione di stato**: un secondo segnale
di guasto mentre la destinazione è già in guasto non produce nulla. Per questo le classi
sono separate su check distinti, e ciascuna transita per conto proprio.

Due battiti — servizio e relay degli allarmi — cinque relay, che non scendono mai da soli
ma solo su un segnale esplicito, e il check a calendario della copia notturna.

## Sicurezza

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

### Host, accessi e CI

Il [provisioning](../provisioning/README.md) prepara firewall, journald, backup
e unità systemd. Il socket proxy limita le API Docker raggiungibili dai servizi;
MongoDB e Redis restano sulla rete interna. Le dashboard richiedono credenziali
distinte e ruoli in sola lettura. I segreti si generano al deploy, secondo la
[guida](../secrets/README.md), e non sono versionati.

La CI verifica codice, configurazioni, superficie HTTP e persistenza, ricerca
credenziali con gitleaks e dipendenze vulnerabili con Trivy. Le action e le
immagini degli strumenti sono fissate a revisioni immutabili.

## Dati e privacy

Il consenso precede RUM e fatti analitici di partita, salvo il conteggio anonimo
degli avvii, che non porta identificativo né dispositivo. Gli identificativi
analitici sono derivati con un sale; le classi di dispositivo sostituiscono
gli user agent nei fatti condivisi. Il backend tronca gli IP secondo la sua
configurazione; Filebeat rimuove IP, cookie e Authorization dalla copia
degli access log inviata a Elasticsearch.

La ritenzione predefinita è 30 giorni per i dati applicativi e analitici.
I log di bordo locali seguono la rotazione dell'host. Backup ed export vanno
protetti e rimossi secondo la durata di conservazione definita per l'evento.
Alla chiusura si separano gli aggregati da archiviare dai dati individuali;
un nuovo esercizio parte da dati vuoti e aggiorna contatti e informativa.

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
log e montati in un filesystem in memoria sotto `/run/secrets`. Gli entrypoint che
richiedono variabili d'ambiente li leggono nel solo processo applicativo; i valori
non compaiono nella specifica Swarm del servizio. Sul disco della macchina restano come file
con permessi 0400 in una directory 0700.

Le dashboard hanno un vincolo aggiuntivo: Traefik usa hash bcrypt, mentre
Elasticsearch deve ricevere la password per creare l'utente. La fonte
`dashboard_users.tfvars.json`, anch'essa `0400`, conserva quindi le due mappe
solo per il contenitore Terraform effimero. Il bootstrap la richiede
esplicitamente, così un ripristino incompleto non può dichiarare pronte
dashboard in realtà irraggiungibili.

Cambiare un valore è un'operazione ordinaria, perché il nome del secret segue il contenuto
come per i config; quali valori vanno prima cambiati nel servizio è descritto in
[`ESERCIZIO.md`](ESERCIZIO.md#cambiare-un-secret). Cifrare i file, per esempio con SOPS,
servirebbe a condividere il `.env` di sviluppo. In produzione sposterebbe il problema sulla
chiave che li decifra, che l'avvio non presidiato dovrebbe comunque trovare sulla macchina.

### Consegna dei log e tracing

Filebeat consegna almeno una volta. I fingerprint di `gioco.partita` e
`traefik.access` fissano `@metadata._id`: la rilettura nello stesso indice non
crea una nuova riga. Il rollover cambia indice di destinazione, quindi questa
misura non garantisce deduplicazione fra indici diversi; il registry persistente
resta necessario.

APM è registrato sul router dopo il matching e prima della validazione: il nome
della transazione usa il template della rotta. `restart` rende il campionamento
backend indipendente dal RUM al 20%, conservando il collegamento tra tracce.
Il client `surveillance-client` nella rete Elastic è riusato dai timer host con
`docker exec`, senza creare un container per ogni battito.

## Riferimenti

- [`provisioning/README.md`](../provisioning/README.md) — preparazione dell'host, sorveglianza, dati
- [`terraform/README.md`](../terraform/README.md) — osservabilità come codice, stato Terraform
- [`terraform/elk/README.md`](../terraform/elk/README.md) — Space, ruoli, utenze, dashboard
- [`secrets/README.md`](../secrets/README.md) — secret dello stack
- `deploy/stack.yml` — definizione dello stack di produzione

## Mappa dei componenti

```mermaid
flowchart LR
  browser[Browser desktop] -->|HTTPS| proxy[Traefik e CrowdSec]
  proxy -->|edge| nginx[Frontend nginx]
  proxy -->|edge| go[Backend Go]
  go -->|data interna| mongo[MongoDB]
  go -->|data interna| redis[Redis]
  proxy -->|socket| socket[Socket proxy]
  filebeat[Filebeat] -->|socket| socket
  go -->|elastic| apm[APM Server]
  apm --> es[Elasticsearch]
```

## Flusso dell'osservabilità

```mermaid
flowchart LR
  game[Fatti backend: gioco.partita] --> fb[Filebeat]
  logs[Log backend e container] --> fb
  access[Access log Traefik] --> fb
  fb --> es[Elasticsearch: dataset separati]
  rum[RUM con consenso] --> apm[APM Server]
  agent[Elastic Agent: metriche] --> es
  apm --> es
  es --> ops[Kibana: Space esercizio]
  es --> event[Kibana: Space evento, solo gioco.partita]
  ops --> alerts[Indice degli allarmi]
  alerts --> relay[Timer host e client persistente]
  relay --> hc[Healthchecks esterno]
```
