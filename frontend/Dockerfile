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

# Vite ricopia `public/` verbatim nel risultato, sorgenti d'autore compresi. I
# file di progetto degli editor grafici pesano decine di megabyte, finiscono in
# un livello dell'immagine e sono scaricabili da chiunque raggiunga il sito,
# mentre il gioco carica soltanto i PNG esportati da quei sorgenti.
#
# La rimozione avviene qui e non in `vite.config.ts` perche' e' una scelta di
# confezionamento: in sviluppo quei file restano dove l'autore se li aspetta.
RUN find /app/dist \( -name '*.ase' -o -name '*.aseprite' -o -name '*.tif' \
	-o -name '*.tiff' -o -name '*.psd' -o -name '*.xcf' \) -type f -delete

# Stage 2: serve i file statici con Nginx, linea stable
FROM nginx:1.30.4-alpine@sha256:dc5069ad14f19660b141b21236140b91656bf89bbc3e2417c70ae650cd66104c

# Pacchetti di sistema aggiornati a build time. Il digest della base resta
# fissato, ma le correzioni di sicurezza delle librerie di sistema arrivano nei
# repository di Alpine prima che l'immagine di base venga ricostruita. Il
# contenuto dipende quindi anche dai repository al momento della build: e' una
# deroga deliberata alla regola di fissare tutto, e trivy ne verifica l'esito.
RUN apk upgrade --no-cache

# Sostituisce la conf di default con una che serve la SPA (fallback su index.html)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia i file statici generati nella directory servita da Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Espone la porta HTTP standard
EXPOSE 80

# Avvia Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
