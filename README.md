# Progetti Innovativi – Avvio Servizi

Questo progetto utilizza Docker Compose per orchestrare i servizi in ambiente di sviluppo e produzione.

## 🛠 Requisiti

- Docker
- Docker Compose
- Node.js (per build locali opzionali)

---

## ⚙️ Sviluppo

Per avviare tutti i servizi in ambiente di sviluppo (con sandbox attivo):

```bash
./scripts/dev-reinstall.sh
```

Questo script:
- Rimuove `node_modules` e file di lock
- Reinstalla tutte le dipendenze
- Builda `frontend` e `sandbox`
- Ricostruisce tutte le immagini
- Avvia `docker-compose.dev.yml`

---

## 🚀 Produzione

Per eseguire il progetto in produzione (senza sandbox):

```bash
./scripts/prod-rebuild.sh
```

Questo script:
- Rimuove `node_modules` e file di lock
- Reinstalla le dipendenze
- Builda `frontend` (output in `dist/`)
- Ricostruisce le immagini
- Avvia `docker-compose.prod.yml`

Per aggiornare velocemente i file lato frontend senza dover ricostruire tutte le immagini, esuguire lo script: 

```bash
./scripts/update_frontend.sh
```

---

## 🧹 Pulizia

Entrambi gli script rimuovono anche:
- container esistenti
- volumi anonimi
- immagini e cache inutilizzate

### 🧼 Pulizia completa manuale

Per una pulizia totale di tutte le dipendenze, build e risorse Docker:

```bash
./scripts/clean-all.sh
```

Questo script:
- Rimuove tutte le cartelle node_modules e dist
- Arresta e rimuove container, network e volumi anonimi
- Elimina immagini e cache Docker inutilizzate

Si consiglia di utilizzarlo prima di eseguire eventuali commit, il .gitignore dovrebbe essere solido ma non si sa mai