# Phaser Game Project – Architettura Dockerizzata

## 🧭 Descrizione
Videogioco HTML5 sviluppato con **Phaser 3**, asset creati in **Aseprite** e mappe progettate in **Tiled Map Editor**, containerizzato in un’architettura **client-sandbox-server** e orchestrato tramite **Docker Compose** con **NGINX** come reverse proxy.

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