# Phaser Game Project – Architettura Sandbox + Server

## 🧭 Panoramica

Questa repository supporta lo sviluppo di un videogioco in HTML5 basato su **Phaser**, con una struttura **client-server modulare**, pensata per sviluppo, test e distribuzione. Include:
- un **ambiente sandbox** per test dinamico delle scene
- un **client reale** minimale che carica scene e asset dal server
- un **server centralizzato** che gestisce scene, stato, asset e logica narrativa

## 🗂️ Struttura del progetto

```
phaser-game-project/
├── client/                   → Client di gioco reale (Phaser + Vite)
│   ├── public/               → HTML statico e asset non sensibili
│   ├── scripts/              → Logica TS condivisa (es. ApiClient)
│   ├── scene/                → Scena corrente + asset ricevuti dal server
│   │   └── assets/           → Asset sensibili validati dal backend
│   ├── vite.config.ts        → Configurazione Vite
│   └── package.json
│
├── sandbox-client/           → Interfaccia dev sandbox (Phaser + Vite)
│   ├── public/               → HTML base
│   ├── sandbox/              → UI, scripts e scene per simulare stato
│   │   ├── scripts/          → Logica Phaser sandbox
│   │   └── scenes/           → Scene dev configurabili manualmente
│   ├── vite.config.ts
│   └── package.json
│
├── server/                   → Backend Node.js (Express)
│   ├── controllers/          → Route API: scene, trigger, minigiochi
│   ├── scenes/               → Scene base (.scene.base.json)
│   ├── assets/               → Asset ufficiali: sprites, tiled, video, audio
│   ├── filters/              → Trasformazione dinamica delle scene
│   ├── models/               → Stato sessione, inventario, flag
│   ├── index.js              → Entrypoint del server
│   └── package.json
│
├── docker-compose.yml        → Orchestrazione dei container
├── Dockerfile.client         → Build client reale con NGINX
├── Dockerfile.sandbox        → Dev server sandbox con Vite
├── Dockerfile.server         → Server Express con asset statici
├── .env                      → Configurazione ambiente
└── README.md                 → Documentazione del progetto
```

## 🧠 Logica di sviluppo

Le scene e gli asset sono salvati **solo sul server**, nelle cartelle:
- `server/scenes/` → descrizione logica delle scene
- `server/assets/` → file validati: PNG, JSON, Tiled, video, ecc.

Il server fornisce due modalità:

### 🎮 Modalità Giocatore Reale (`/api/scene/:id`)
- Autenticazione sessione
- Filtraggio oggetti in base allo stato (oggetti raccolti, eventi)
- Offuscamento asset (es. `torch_white.png` → `4f91a.png`)
- Accesso negato a scene non sbloccate

### 🧪 Modalità Sandbox (`/api/sandbox/scene/:id`)
- Accesso a tutte le scene senza blocchi
- Stato arbitrario simulabile (flag, inventario, minigiochi)
- Asset non offuscati
- Test rapido di trigger, eventi, condizioni

## 🔁 Flusso di lavoro

1. Le scene vengono progettate in Phaser Editor e salvate in `server/scenes/`
2. Gli asset associati vengono copiati in `server/assets/`
3. Gli sviluppatori usano `sandbox-client` per testare le scene in tempo reale
4. Una volta validata, la scena viene usata dal client reale (`client/`)
5. Il server filtra dinamicamente la scena a seconda dello stato del giocatore

## 🚀 Deployment

- Solo il client reale viene buildato (`vite build`) e servito da NGINX
- Il `sandbox-client` viene escluso in produzione
- Il server esegue la logica di sessione, accesso, filtraggio e asset
- Tutti i file sensibili sono accessibili solo tramite route protette

## 🔐 Sicurezza

- Gli asset sono offuscati in produzione
- Il server decide cosa mostrare al client in base allo stato della sessione
- La sandbox è disponibile solo in sviluppo (`ENABLE_SANDBOX=true`)
- La logica di filtraggio è centralizzata in `filters/`

---

## ▶️ Avvio rapido

```bash
git clone <repo>
cd phaser-game-project
docker compose up --build
```

Poi visita:
- **http://localhost:8080** → client reale
- **http://localhost:5173** → sandbox client
- **http://localhost:3000/api/scene/iniziale** → scena test
