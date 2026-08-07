# ==============================================================================
# Raccolta dei comandi del progetto
# ==============================================================================
# Un solo punto di ingresso per operazioni che altrimenti vivrebbero sparse fra
# script, invocazioni di Docker con sei variabili d'ambiente e comandi ricordati
# a memoria. Sotto pressione durante un evento nulla di tutto cio' si
# ricostruisce, e l'infrastruttura ha un solo operatore.
#
# L'aiuto si genera dai target: ogni target porta la propria descrizione come
# commento `##` sulla stessa riga, e `make help` la estrae da questo file. Un
# elenco mantenuto a parte divergerebbe al primo target aggiunto, e un aiuto che
# mente e' peggio di nessun aiuto.
#
# Nessuna dipendenza da strumenti installati sull'host oltre a `make` e Docker:
# compilatori e analizzatori girano in container ancorati per digest, gli stessi
# che usa la pipeline.
# ==============================================================================

.DEFAULT_GOAL := help

# --- Parametri ----------------------------------------------------------------
# Sovrascrivibili dalla riga di comando: `make stack-deploy STACK_NAME=prova`.

COMPOSE_DEV        ?= docker-compose.dev.yml
COMPOSE_MONITORING ?= docker-compose.monitoring.yml
COMPOSE_SECURITY   ?= docker-compose.security.yml

STACK_FILE  ?= deploy/stack.yml
STACK_NAME  ?= pi
SECRETS_DIR ?= secrets

# Soglia di copertura. Il valore obiettivo e' 85%; finche' i test non lo
# raggiungono, il target la riporta senza imporla.
COVERAGE_MIN ?= 85

# Salta la conferma sui target distruttivi. Serve all'automazione, non alle
# persone: chiedere e' il comportamento predefinito.
FORCE ?= 0

# --- Immagini degli strumenti -------------------------------------------------
# Ancorate per digest: un tag e' mutabile, e uno strumento di verifica che cambia
# sotto i piedi produce esiti non riproducibili.

# Immagine su base Debian e non alpine: il rilevatore di corse critiche richiede
# cgo, che a sua volta richiede un compilatore C. L'immagine alpine non lo ha, e
# `go test -race` fallirebbe con un errore che sembra di configurazione ma e' di
# ambiente. L'immagine che costruisce l'artefatto resta quella alpine.
GO_IMAGE         ?= golang:1.26.5@sha256:2005724102f45917a63e9d092fc0e4ea56ea575048ce147caad5f5f61502c365
NODE_IMAGE       ?= node:24-alpine@sha256:f70403e87646dc51b45295f4b8b70cdad0b63d2297c4c9899119b03f7af7a6b3
HADOLINT_IMAGE   ?= hadolint/hadolint:v2.14.0-alpine@sha256:7aba693c1442eb31c0b015c129697cb3b6cb7da589d85c7562f9deb435a6657c
SHELLCHECK_IMAGE ?= koalaman/shellcheck:v0.11.0@sha256:61862eba1fcf09a484ebcc6feea46f1782532571a34ed51fedf90dd25f925a8d
TERRAFORM_IMAGE  ?= hashicorp/terraform:1.9@sha256:18f9986038bbaf02cf49db9c09261c778161c51dcc7fb7e355ae8938459428cd

# Su Windows la shell converte gli argomenti che sembrano percorsi POSIX prima
# di passarli a Docker: `-w /src/server` diventerebbe un percorso Windows e il
# demone lo rifiuterebbe. La variabile disattiva la conversione, ed e' inerte su
# Linux, dove il problema non esiste.
DOCKER := MSYS_NO_PATHCONV=1 docker

# Cache di moduli e compilazione su volumi con nome: senza, ogni invocazione
# riscarica le dipendenze e ricompila da zero.
GO_RUN := $(DOCKER) run --rm -v "$(CURDIR)":/src -w /src/server \
	-v pi-go-mod:/go/pkg/mod -v pi-go-build:/root/.cache/go-build $(GO_IMAGE)
NODE_RUN := $(DOCKER) run --rm -v "$(CURDIR)":/src -w /src $(NODE_IMAGE)

##@ Aiuto

.PHONY: help
help: ## Mostra questo elenco
	@awk 'BEGIN { FS = ":.*##"; \
			printf "\n\033[1mUso:\033[0m make \033[36m<target>\033[0m [VARIABILE=valore]\n" } \
		/^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 } \
		END { printf "\n" }' $(MAKEFILE_LIST)

##@ Sviluppo

.PHONY: dev-up
dev-up: ## Avvia lo stack di sviluppo
	docker compose -f $(COMPOSE_DEV) up -d

.PHONY: dev-down
dev-down: ## Ferma lo stack di sviluppo lasciando intatti i volumi
	docker compose -f $(COMPOSE_DEV) down

.PHONY: dev-restart
dev-restart: ## Riavvia i servizi dello stack di sviluppo
	docker compose -f $(COMPOSE_DEV) restart

.PHONY: dev-rebuild
dev-rebuild: ## Ricostruisce le immagini di sviluppo e riavvia senza toccare le dipendenze
	./scripts/dev-rebuild.sh

.PHONY: dev-ps
dev-ps: ## Elenca i servizi di sviluppo e il loro stato
	docker compose -f $(COMPOSE_DEV) ps

.PHONY: dev-logs
dev-logs: ## Segue i log dello stack di sviluppo (SERVICE=nome per limitarli a uno)
	docker compose -f $(COMPOSE_DEV) logs -f --tail=100 $(SERVICE)

.PHONY: dev-shell
dev-shell: ## Apre una shell in un servizio di sviluppo (SERVICE=nome, default server)
	docker compose -f $(COMPOSE_DEV) exec $(or $(SERVICE),server) sh

.PHONY: monitoring-up
monitoring-up: ## Avvia lo stack di osservabilita' di sviluppo
	./scripts/start-monitoring.sh

.PHONY: monitoring-down
monitoring-down: ## Ferma lo stack di osservabilita' di sviluppo
	./scripts/stop-monitoring.sh

.PHONY: security-up
security-up: ## Avvia lo stack di sviluppo con l'overlay di sicurezza CrowdSec
	docker compose -f $(COMPOSE_DEV) -f $(COMPOSE_SECURITY) up -d

##@ Verifica

.PHONY: verify
verify: verify-fast go-cover lint-terraform ## Batteria completa di verifiche locali

.PHONY: verify-fast
verify-fast: go-fmt go-vet go-build go-test lint-shell lint-docker lint-compose lint-stack ## Verifiche rapide, senza copertura

.PHONY: go-fmt
go-fmt: ## Verifica la formattazione del codice Go
	$(GO_RUN) sh -c 'non_formattati=$$(gofmt -l .); if [ -n "$$non_formattati" ]; then echo "File non formattati:"; echo "$$non_formattati"; exit 1; fi'

.PHONY: go-vet
go-vet: ## Esegue l'analisi statica del backend
	$(GO_RUN) go vet ./...

.PHONY: go-build
go-build: ## Compila il backend
	$(GO_RUN) go build ./...

.PHONY: go-test
go-test: ## Esegue i test del backend con il rilevatore di corse critiche
	$(GO_RUN) go test -race ./...

.PHONY: go-cover
go-cover: ## Misura la copertura del backend e la confronta con la soglia
	$(GO_RUN) sh -c 'go test -coverprofile=/tmp/cover.out ./... >/dev/null && go tool cover -func=/tmp/cover.out | tail -1'
	@echo "soglia obiettivo: $(COVERAGE_MIN)%"

.PHONY: lint-shell
lint-shell: ## Analizza gli script di infrastruttura
	$(DOCKER) run --rm -v "$(CURDIR)":/mnt -w /mnt $(SHELLCHECK_IMAGE) \
		--severity=warning provisioning/bin/*.sh swarm-prototype/*.sh deploy/config/*.sh

# `scripts/` raccoglie utilita' precedenti a questo lavoro e produce oltre
# settecento segnalazioni. Tenerle nel controllo bloccante renderebbe la
# batteria stabilmente rossa, e una batteria sempre rossa smette di essere
# letta: restano in un target a parte finche' non vengono affrontate.
.PHONY: lint-shell-legacy
lint-shell-legacy: ## Analizza gli script preesistenti in scripts/ (non bloccante)
	-$(DOCKER) run --rm -v "$(CURDIR)":/mnt -w /mnt $(SHELLCHECK_IMAGE) \
		--severity=warning scripts/*.sh

.PHONY: lint-docker
lint-docker: ## Analizza i Dockerfile
	@for f in server/Dockerfile frontend/Dockerfile sandbox/Dockerfile landing/Dockerfile; do \
		echo "hadolint $$f"; \
		$(DOCKER) run --rm -i $(HADOLINT_IMAGE) hadolint --failure-threshold error - < $$f || exit 1; \
	done

.PHONY: lint-compose
lint-compose: ## Valida i file compose
	docker compose -f $(COMPOSE_DEV) config -q
	docker compose -f $(COMPOSE_MONITORING) config -q

.PHONY: lint-stack
lint-stack: ## Valida lo stack Swarm di produzione
	@$(MAKE) --no-print-directory stack-config >/dev/null && echo "stack valido: $(STACK_FILE)"

.PHONY: lint-terraform
lint-terraform: ## Verifica la formattazione delle definizioni Terraform
	$(DOCKER) run --rm -v "$(CURDIR)/terraform":/w -w /w $(TERRAFORM_IMAGE) fmt -check -recursive -diff

.PHONY: frontend-build
frontend-build: ## Compila il frontend di produzione
	$(NODE_RUN) sh -c 'cd frontend && npm ci && npm run build'

##@ Immagini

.PHONY: images
images: image-server image-frontend image-landing ## Costruisce tutte le immagini applicative

.PHONY: image-server
image-server: ## Costruisce l'immagine del backend (contesto alla radice, include comms/)
	docker build -f server/Dockerfile -t progetti-innovativi/server:locale .

.PHONY: image-frontend
image-frontend: ## Costruisce l'immagine del gioco
	docker build -t progetti-innovativi/frontend:locale ./frontend

.PHONY: image-landing
image-landing: ## Costruisce l'immagine della pagina di ingresso
	docker build -t progetti-innovativi/landing:locale ./landing

##@ Deploy

.PHONY: secrets
secrets: ## Genera i secret mancanti senza toccare quelli esistenti
	./provisioning/bin/generate-secrets.sh $(SECRETS_DIR)

.PHONY: stack-config
stack-config: ## Risolve e valida lo stack di produzione senza applicarlo
	cd deploy && docker stack config -c $(notdir $(STACK_FILE))

.PHONY: stack-deploy
stack-deploy: ## Applica lo stack di produzione (richiede /etc/stack-deploy.env)
	./provisioning/bin/stack-deploy.sh

.PHONY: stack-status
stack-status: ## Mostra servizi, repliche e task non in esecuzione
	docker stack services $(STACK_NAME)
	@echo
	@docker stack ps $(STACK_NAME) --no-trunc --filter desired-state=running

.PHONY: stack-remove
stack-remove: ## Rimuove lo stack di produzione lasciando i volumi (FORCE=1 salta la conferma)
	@if [ "$(FORCE)" != "1" ]; then \
		printf 'Rimuovere lo stack %s? I volumi restano. [s/N] ' "$(STACK_NAME)"; \
		read risposta; [ "$$risposta" = "s" ] || { echo "annullato"; exit 1; }; \
	fi
	docker stack rm $(STACK_NAME)

##@ Osservabilita'

.PHONY: fleet-bootstrap
fleet-bootstrap: ## Registra le policy Fleet e genera gli enrollment token
	./scripts/fleet-bootstrap.sh

.PHONY: dashboards-export
dashboards-export: ## Esporta i saved object di Kibana in NDJSON
	./scripts/kibana-dashboard-manager.sh export

.PHONY: dashboards-import
dashboards-import: ## Reimporta i saved object di Kibana da NDJSON
	./scripts/kibana-dashboard-manager.sh import

.PHONY: dashboards-list
dashboards-list: ## Elenca i saved object presenti su Kibana
	./scripts/kibana-dashboard-manager.sh list

##@ Prove di guasto

.PHONY: gate
gate: ## Esegue i cicli di avvio a freddo e a caldo sul prototipo Swarm
	cd swarm-prototype && ./gate.sh

.PHONY: fault-drill
fault-drill: ## Inietta un guasto e osserva la reazione dell'orchestratore
	cd swarm-prototype && ./fault-drill.sh

.PHONY: autoheal-test
autoheal-test: ## Verifica la sostituzione di un task che fallisce la verifica di salute
	cd swarm-prototype && ./autoheal-test.sh

.PHONY: rollback-test
rollback-test: ## Verifica il ritorno alla versione precedente su aggiornamento fallito
	cd swarm-prototype && ./rollback-test.sh

##@ Manutenzione

.PHONY: clean-soft
clean-soft: ## Rimuove cache e artefatti di build, preserva dati e configurazioni
	./scripts/cleanup.sh --soft

.PHONY: clean-dev
clean-dev: ## Pulizia completa dell'ambiente di sviluppo (FORCE=1 salta la conferma)
	@if [ "$(FORCE)" != "1" ]; then \
		printf 'Pulizia completa dell ambiente di sviluppo. Procedere? [s/N] '; \
		read risposta; [ "$$risposta" = "s" ] || { echo "annullato"; exit 1; }; \
	fi
	./scripts/cleanup.sh --dev
