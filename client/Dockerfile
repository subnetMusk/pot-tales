# Stage 1: build dell’app con Vite
FROM node:18-alpine AS builder
WORKDIR /app

# Copia manifest delle dipendenze e config di Vite/TS per caching layer
COPY package*.json vite.config.ts tsconfig.json ./

# Installa le dipendenze in modo deterministico
RUN npm ci

# Copia sorgenti e asset pubblici
COPY public ./public
COPY src ./src

# Genera la build ottimizzata in /app/dist
RUN npm run build

# Stage 2: serve i file statici con Nginx
FROM nginx:alpine
# Rimuove la configurazione default di Nginx (opzionale, ma consigliato)
RUN rm /etc/nginx/conf.d/default.conf

# Copia i file statici generati nella directory servita da Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Espone la porta HTTP standard
EXPOSE 80

# Avvia Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
