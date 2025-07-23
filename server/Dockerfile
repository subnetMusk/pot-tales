###############################################################################
# Costruisce un binario statico per produzione e include Air per il dev hot-reload
###############################################################################

# --- build stage: cross-compile e installazione di Air per hot-reload ----
FROM --platform=$BUILDPLATFORM golang:1.22-alpine AS builder
ARG TARGETOS
ARG TARGETARCH

# Imposta la working directory per il build
WORKDIR /src

# Copia i file mod e installa le dipendenze in cache e Air nel GOPATH
COPY go.mod go.sum .
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download && \
    go install github.com/cosmtrek/air@v1.52.0

# Aggiunge la directory Go bin al PATH in modo che 'air' sia disponibile
ENV PATH="/go/bin:${PATH}"

# Copia tutto il codice e compila il binario statico
COPY . .
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -o /server .

# --- runtime stage: immagine leggera per produzione ----------------------
FROM --platform=$TARGETPLATFORM alpine:3.20

# Copia il binario compilato dal builder
COPY --from=builder /server /server

# Definisce la porta e il comando di avvio
ENV PORT=3000
EXPOSE 3000
ENTRYPOINT ["/server"]
