
# Phaser Game Project – Architettura Sandbox + Server

## Panoramica

Questa repository è progettata per supportare lo sviluppo di un videogioco in HTML5 basato su Phaser, con una solida infrastruttura backend costruita in Node.js tramite Express. Il progetto include un ambiente sandbox per testare dinamicamente scene e meccaniche, un client di gioco reale per la distribuzione e un sistema centralizzato di gestione di asset e scene sul server.

## Struttura del progetto

```
phaser-game-project/
├── client/                   → Client principale del gioco (Phaser + Vite)
│   ├── scenes/               → Scene caricate dinamicamente dal server
│   ├── scripts/              → Logica TypeScript del gioco
│   ├── assets/               → Asset temporanei solo per sviluppo
│   ├── public/               → HTML statico e entrypoint
│   ├── vite.config.ts        → Configurazione Vite per build e dev
│   └── package.json
│
├── sandbox-client/           → Interfaccia per test sandbox via browser
│   ├── ui/                   → UI di sviluppo per scegliere scena, mock stato
│   ├── scripts/              → Codice Phaser per test rapido
│   ├── vite.config.ts
│   └── package.json
│
├── server/                   → Backend Node.js (Express)
│   ├── controllers/          → Route API: scene, interazioni, pickup, minigiochi
│   ├── scenes/               → Scene base (.scene.base.json)
│   ├── assets/               → Asset ufficiali: sprites, tiled, video, audio
│   ├── filters/              → Motore per la trasformazione dinamica delle scene
│   ├── models/               → Stato delle sessioni, inventario, flag
│   ├── index.js              → Entrypoint Express
│   └── package.json
│
├── docker-compose.yml        → Orchestrazione Docker: server, client, sandbox
├── Dockerfile.client         → Container per build e deploy client (nginx)
├── Dockerfile.sandbox        → Container dev per ambiente sandbox
├── Dockerfile.server         → Container backend Node.js
├── .env                      → Configurazioni ambiente: porte, modalità, path
└── README.md                 → Documentazione del progetto
```

## Logica di sviluppo

Le scene e gli asset vengono salvati **solo** sul server, nelle directory `server/scenes` e `server/assets`. Il server espone due modalità principali per accedervi:

### Modalità Sandbox (`/api/sandbox/scene/:id`)
Questa modalità è pensata per gli sviluppatori. Permette di:
- accedere a qualsiasi scena direttamente, senza restrizioni
- simulare uno stato arbitrario del giocatore (oggetti raccolti, minigiochi completati)
- ricevere le scene con nomi di asset in chiaro
- bypassare completamente la logica narrativa e di sessione
- testare la generazione condizionale e i trigger degli oggetti

### Modalità Giocatore Reale (`/api/scene/:id`)
Questa modalità rappresenta il comportamento finale in produzione. Il server:
- autentica la sessione
- filtra gli oggetti visibili nella scena in base allo stato della partita
- offusca i riferimenti agli asset (es. torch_white.png → 4f91a.png)
- restituisce solo ciò che è sbloccato o previsto
- rifiuta l’accesso non autorizzato a scene non raggiungibili

## Flusso di lavoro per lo sviluppo

1. Le scene vengono create in Phaser Editor e salvate direttamente in `server/scenes/`
2. Gli asset ufficiali (sprite, tiled, video) vengono copiati in `server/assets/`
3. Il `sandbox-client` viene utilizzato per testare le scene in tempo reale, simulando inventario e stato
4. Una volta validata una scena, si collega alla logica di filtraggio lato server
5. Il client di gioco finale carica solo scene tramite `/api/scene/:id`, con comportamento controllato

## Deployment in produzione

Nel deployment:
- il `sandbox-client` non viene incluso (o viene disattivato via `.env`)
- solo il client reale viene buildato con Vite (`vite build`) e servito via NGINX
- il server mantiene tutta la logica narrativa, lo stato e il routing API
- gli asset vengono offuscati e serviti tramite endpoint protetti

## Sicurezza e manutenibilità

- I nomi dei file asset vengono offuscati in produzione per impedire l’accesso diretto
- Le scene sono filtrate dinamicamente in base allo stato reale della sessione
- La modalità sandbox è abilitata solo in sviluppo e può essere disattivata
- Il codice per la trasformazione delle scene è centralizzato e condiviso tra sandbox e client reale

---

## Per iniziare

1. Clona la repository
2. Passa al branch `develop`
3. Avvia l'ambiente con `docker compose up --build`
4. Accedi al sandbox client per testare le scene in tempo reale

