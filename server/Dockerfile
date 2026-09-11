###############################################################################
# Backend Go: binario statico per la produzione, con Air per la ricarica a caldo
# nello stadio di sviluppo.
#
# Il contesto di build e' la radice del repository, non questa directory: oltre
# al modulo Go l'immagine deve contenere gli schemi di validazione in `comms/`,
# che vivono fuori da `server/` perche' sono un contratto condiviso. Montarli
# dall'host renderebbe l'immagine non avviabile da sola, e in swarm mode un bind
# mount relativo non si traduce in un percorso valido sul nodo che schedula il
# task: sarebbe un blocco all'avvio, non un degrado.
###############################################################################

# --- stadio di compilazione: cross-compilazione e Air per la ricarica a caldo -
# Immagini pinnate per digest.
FROM --platform=$BUILDPLATFORM golang:1.26.6-alpine@sha256:3889b425f035be855a72fb4755265311293b6d414521f0a519d819df32222d83 AS builder
ARG TARGETOS
ARG TARGETARCH

# indica al toolchain Go che il module è privato
ENV GOPRIVATE=github.com/subnetMusk/progetti_innovativi


# Imposta la working directory per il build
WORKDIR /src

# Copia i file mod e installa le dipendenze in cache e Air nel GOPATH
COPY server/go.mod server/go.sum ./
# Il module path canonico di air e' github.com/air-verse/air
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download && \
    go install github.com/air-verse/air@v1.67.4

# Aggiunge la directory Go bin al PATH in modo che 'air' sia disponibile
ENV PATH="/go/bin:${PATH}"

# Abilita output dettagliato per la compilazione Go:
# -v: mostra i pacchetti compilati
# -x: mostra i comandi interni eseguiti da go build
ENV GOFLAGS="-v -x"

# Copia il codice sorgente del backend
COPY server/ ./

# Compila il binario statico con cross-compilazione
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -o /server .

# --- stadio di esecuzione: immagine leggera per la produzione ----------------
FROM alpine:3.24@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b

# Copia il binario compilato dal builder
COPY --from=builder /server /server

# Schemi di validazione delle richieste. Il percorso corrisponde al valore
# predefinito di SCHEMA_DIR_SERVER, cosi' l'immagine parte senza configurazione
# aggiuntiva; la variabile resta impostabile per sovrascriverlo.
COPY comms/ /src/comms/

# Definisce la porta di ascolto e il comando di avvio
ENV PORT=3000
EXPOSE 3000
ENTRYPOINT ["/server"]
