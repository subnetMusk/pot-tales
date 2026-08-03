###############################################################################
# Costruisce un binario statico per produzione e include Air per il dev hot-reload
###############################################################################

# --- build stage: cross-compile e installazione di Air per hot-reload ----
# Immagini pinnate per digest.
FROM --platform=$BUILDPLATFORM golang:1.26.5-alpine@sha256:0178a641fbb4858c5f1b48e34bdaabe0350a330a1b1149aabd498d0699ff5fb2 AS builder
ARG TARGETOS
ARG TARGETARCH

# indica al toolchain Go che il module è privato
ENV GOPRIVATE=github.com/subnetMusk/progetti_innovativi


# Imposta la working directory per il build
WORKDIR /src

# Copia i file mod e installa le dipendenze in cache e Air nel GOPATH
COPY go.mod go.sum ./
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

# Copia tutto il codice sorgente nell’immagine
COPY . .

# Compila il binario statico con cross-compilazione
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -o /server .

# --- runtime stage: immagine leggera per produzione ----------------------
FROM alpine:3.24@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b

# Copia il binario compilato dal builder
COPY --from=builder /server /server

# Definisce la porta di ascolto e il comando di avvio
ENV PORT=3000
EXPOSE 3000
ENTRYPOINT ["/server"]
