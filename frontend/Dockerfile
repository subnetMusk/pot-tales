# Stage 1: build dell’app con Vite
# Immagini pinnate per digest. Node 24 e' la linea LTS attiva.
FROM node:24-alpine@sha256:f70403e87646dc51b45295f4b8b70cdad0b63d2297c4c9899119b03f7af7a6b3 AS builder
WORKDIR /app

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

# Stage 2: serve i file statici con Nginx, linea stable
FROM nginx:1.30.4-alpine@sha256:97d490c12ba55b4946b01546d1c3ed324e8d41ab1c9fcb2a616aa470620e5b46
# Sostituisce la conf di default con una che serve la SPA (fallback su index.html)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia i file statici generati nella directory servita da Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Espone la porta HTTP standard
EXPOSE 80

# Avvia Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
