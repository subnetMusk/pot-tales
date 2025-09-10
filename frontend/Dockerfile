# Stage 1: build dell’app con Vite
FROM node:18-alpine AS builder
WORKDIR /app

# --- Variabili di build per Vite (arrivano da docker-compose) ---
ARG VITE_ELASTIC_APM_RUM_SERVER_URL
ARG VITE_ELASTIC_APM_RUM_SERVICE_NAME
ARG VITE_ELASTIC_APM_RUM_SECRET_TOKEN
ARG VITE_ELASTIC_APM_ENVIRONMENT

# Rendi gli ARG disponibili come ENV al processo di build (npm run build)
ENV VITE_ELASTIC_APM_RUM_SERVER_URL=${VITE_ELASTIC_APM_RUM_SERVER_URL} \
    VITE_ELASTIC_APM_RUM_SERVICE_NAME=${VITE_ELASTIC_APM_RUM_SERVICE_NAME} \
    VITE_ELASTIC_APM_RUM_SECRET_TOKEN=${VITE_ELASTIC_APM_RUM_SECRET_TOKEN} \
    VITE_ELASTIC_APM_ENVIRONMENT=${VITE_ELASTIC_APM_ENVIRONMENT}

# Copia manifest delle dipendenze e config di Vite/TS per caching layer
COPY package*.json vite.config.ts tsconfig.json ./

# Installa le dipendenze in modo deterministico
RUN npm ci

# Copia sorgenti e asset pubblici
COPY public ./public
COPY src ./src
COPY index.html .

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
