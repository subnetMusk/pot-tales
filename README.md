# Phaser Game Project – Architettura Dockerizzata

## 🧭 Descrizione
Videogioco HTML5 sviluppato con **Phaser 3**, asset creati in **Aseprite** e mappe progettate in **Tiled Map Editor**, containerizzato in un’architettura **client-sandbox-server** e orchestrato tramite **Docker Compose** con **NGINX** come reverse proxy.

## 🗂️ Struttura del progetto
```
phaser-game-project/
├── client/                   
│   ├── public/               # HTML statico (index.html) e asset non sensibili
│   ├── src/                  # Codice front-end (TypeScript)
│   │   ├── assets/           # Sprite, audio, mappe
│   │   ├── items/            # Definizioni di oggetti/collezionabili
│   │   ├── network/          # Comunicazione col server via HTTP/WebSocket
│   │   ├── scenes/           # Scene Phaser (menu, livelli, game over…)
│   │   └── main.ts           # Entry point
│   └── package.json
│
├── sandbox/                  
│   ├── public/               # Risorse temporanee per test rapido
│   │   ├── sb-resources/     # Risorse specifiche per la ui di sandbox
│   │   └── scripts/          # Scripts per il funzionamento di sandbox
│   ├── src/                  # Front-end semplificato per sviluppo veloce
│   ├── vite.config.ts        # Configurazione Vite per live reload
│   ├── Dockerfile            # Container isolato per sandbox
│   ├── package.json
│   └── .env                  # Variabili ambiente per sandbox
│
├── server/                   
│   ├── config/               # Configurazioni generali (ESLint, ambiente)
│   ├── public/               # Endpoint statici (se necessari)
│   ├── src/                  # Codice backend (Node.js + Express)
│   │   ├── db/               # Query al db
│   │   ├── models/           # Schemi dati
│   │   ├── routes/           # Endpoint server
│   │   ├── services/         # 
│   │   ├── utils/            # 
│   │   └── main.ts           # Entry point del server
│   ├── Dockerfile            # Container per backend
│   ├── tsconfig.json
│   └── package.json
│
├── proxy/                    
│   ├── nginx.dev.conf        # Config NGINX per sviluppo
│   ├── nginx.prod.conf       # Config NGINX per produzione
│   └── certs/                # Certificati .pem
│
├── docker/                   
├── docker-compose.yml        # Orchestrazione di client, sandbox, server e proxy
├── .env                      # Variabili ambiente (da copiare e personalizzare da .env.example)
├── .gitignore                
└── README.md                 
```

## 🚀 Avvio del progetto
1. **Clona** la repository e spostati nella cartella:
   ```bash
   git clone https://…/phaser-game-project.git
   cd phaser-game-project
   ```
2. **Copia** `.env.example` in `.env` e definisci le variabili (come porte e chiavi API).
3. **Avvia** tutto con Docker Compose:
   ```bash
   docker-compose up --build
   ```
4. **Accedi**:
   - `http://localhost`: client “reale”
   - `http://localhost/sandbox/`: sandbox per sviluppo rapido
   - `http://localhost/api/health`: health-check del server

## 🔧 Scelte architetturali
- **Separazione Client/Sandbox**: il sandbox fornisce live-reload e iterazione veloce senza ricostruire l’intero container di produzione.
- **Containerizzazione**: garantisce consistenza tra ambienti di sviluppo e produzione.
- **NGINX come proxy**: un’unica entry point per routing dev vs prod e gestione di certificati SSL in produzione.
- **Modularità**: client, sandbox e server isolati migliorano la manutenibilità e permettono team dedicati per frontend e backend.
- **Asset Pipeline**: Aseprite per creare sprite di qualità e Tiled per mappe tile-based, integrati direttamente in Phaser.

Buon sviluppo! 🎮✨
