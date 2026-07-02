# 1. Immagine base: Node.js su Alpine
FROM node:18-alpine

# 2. Directory di lavoro
WORKDIR /app

# 3. Copia manifest delle dipendenze e config Vite per sfruttare la cache
COPY package*.json vite.config.ts ./

# 4. Installazione delle dipendenze in modo deterministico
RUN npm ci

# 5. Copia sorgenti e file pubblici
COPY index.html ./
COPY src src
COPY public public

# 6. Espone la porta del Vite Dev Server
EXPOSE 5173

# 7. Comando di avvio: Vite in modalità development con HMR
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
