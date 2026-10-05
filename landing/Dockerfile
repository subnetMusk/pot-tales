# Pagina di ingresso statica.
#
# Immagine separata da quella del gioco di proposito: deve restare
# raggiungibile anche quando il gioco non parte, e condividere il contenitore
# significherebbe condividerne anche i guasti.
FROM nginx:1.30.4-alpine@sha256:dc5069ad14f19660b141b21236140b91656bf89bbc3e2417c70ae650cd66104c

# Pacchetti di sistema aggiornati a build time. Il digest della base resta
# fissato, ma le correzioni di sicurezza delle librerie di sistema arrivano nei
# repository di Alpine prima che l'immagine di base venga ricostruita. Il
# contenuto dipende quindi anche dai repository al momento della build: e' una
# deroga deliberata alla regola di fissare tutto, e trivy ne verifica l'esito.
# Minimi corretti per CVE-2026-93990 e CVE-2026-103111.
RUN apk upgrade --no-cache && \
    apk add --no-cache 'libexpat>=2.8.5-r0' 'pcre2>=10.49-r0'

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
