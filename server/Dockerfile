# Usa un’immagine Node.js leggera basata su Alpine
FROM node:18-alpine

# Imposta la cartella di lavoro all’interno del container
WORKDIR /app

# Copia i manifest delle dipendenze e il file di configurazione TypeScript
# così da sfruttare la cache di Docker quando cambiano solo i sorgenti
COPY package*.json tsconfig.json ./

# Installa le dipendenze in modo deterministico usando il lockfile
RUN npm ci

# Copia il codice dell’applicazione
COPY src ./src
COPY config ./config

# Espone la porta su cui il server ascolta
EXPOSE 3000

# Comando di default: avvia il server in modalità sviluppo con live-reload
CMD ["npm", "run", "dev"]
