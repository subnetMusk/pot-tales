# Sistema di Pulizia e Gestione Centralizzato

Questo documento descrive il nuovo sistema centralizzato per la gestione, pulizia e backup delle configurazioni del progetto.

## Script Disponibili

### `scripts/cleanup.sh` - Script di Pulizia Centralizzato

Sostituisce i vecchi `clean_build.sh` e `production-cleanup.sh` con un sistema intelligente e modulare.

```bash
# Modalità sviluppo (default) - pulizia completa per dev
./scripts/cleanup.sh --dev

# Modalità produzione - pulizia selettiva preservando configurazioni
./scripts/cleanup.sh --production

# Modalità leggera - solo cache e build artifacts
./scripts/cleanup.sh --soft

# Modalità completa - ATTENZIONE: cancella TUTTO
./scripts/cleanup.sh --full
```

**Caratteristiche:**
- **Backup automatico** configurazioni critiche prima della pulizia
- **Protezione intelligente** di certificati SSL, configurazioni NGINX, Kibana
- **Modalità multiple** per diversi scenari d'uso
- **Verifica integrità** configurazioni dopo pulizia
- **Output colorato** e informativo

### `scripts/dev-reinstall.sh` - Reinstallazione Sviluppo

Ricostruzione completa dell'ambiente di sviluppo usando il nuovo sistema centralizzato.

```bash
./scripts/dev-reinstall.sh
```

**Processo:**
1.  Pulizia completa via `cleanup.sh --dev`
2.  Reinstallazione dipendenze JavaScript (frontend, sandbox)
3.  Aggiornamento moduli Go in container
4.  Ricostruzione immagini Docker da zero
5.  Avvio stack e verifica stato servizi

### Gestione delle dashboard Kibana

Le dashboard non sono piu' gestite da uno script dedicato. L'export e' versionato
nel repository e reimportato da Terraform, quindi ricrearle su un'istanza vuota
non richiede un backup da custodire a parte.

```bash
# Esporta i saved object di uno Space e li versiona
make dashboards-export SPAZIO=esercizio NOME=salute-risorse

# Elenca gli export versionati e la versione di Kibana che li ha prodotti
make dashboards-list

# Reimporta gli export applicando il modulo Terraform
make dashboards-import
```

Il dettaglio, compreso il vincolo di compatibilita' fra la versione che ha
prodotto l'export e quella di destinazione, e' in
[../terraform/elk/dashboards/README.md](../terraform/elk/dashboards/README.md).

## Struttura Backup e Protezione

### Configurazioni Protette Automaticamente

Il sistema preserva automaticamente:

```
docker/volumes/
├── kibana/
│   ├── config/kibana.yml           Sempre preservato
│   ├── snapshots/                  Backup automatici
│   └── protected-dashboards/       Export dashboard
└── filebeat/filebeat.yml           Configurazione raccolta log
```

### Directory di Backup

```
backups/
├── config-YYYYMMDD_HHMMSS/        Backup automatici pre-pulizia
│   ├── kibana-config/
│   ├── kibana-dashboards/
│   ├── .env
│   └── docker-env
└── docker/volumes/kibana/
    ├── snapshots/                  Snapshot configurazioni Kibana
    └── protected-dashboards/        Export dashboard personalizzate
```

## Workflow Raccomandato

### Per Sviluppo Quotidiano

```bash
# Pulizia leggera (solo cache)
./scripts/cleanup.sh --soft

# Riavvio servizi
docker compose -f docker-compose.dev.yml restart
```

### Prima di Grandi Modifiche

```bash
# Backup dashboard personalizzate
make dashboards-export SPAZIO=<spazio> NOME=<nome>

# Pulizia completa e ricostruzione
./scripts/dev-reinstall.sh
```

### Deployment Produzione

```bash
# 1. Backup completo
make dashboards-export SPAZIO=<spazio> NOME=<nome>

# 2. Pulizia selettiva (preserva configurazioni)
./scripts/cleanup.sh --production

# 3. Deploy produzione
docker compose -f docker-compose.prod.yml up -d

# 4. Verifica servizi
docker compose -f docker-compose.prod.yml ps
```

### Ripristino Dopo Problemi

```bash
# 1. Importa dashboard da backup
make dashboards-import

# 2. Se necessario, ricostruzione completa
./scripts/dev-reinstall.sh
```

## Cosa Fare in Caso di Errori

### Kibana Non Si Avvia

```bash
# 1. Controlla log
docker logs kibana --tail 50

# 2. Verifica configurazione
cat docker/volumes/kibana/config/kibana.yml

# 3. Ripristina da snapshot
cd docker/volumes/kibana
tar -xzf snapshots/kibana-config-YYYYMMDD_HHMMSS.tar.gz

# 4. Riavvia
docker restart kibana
```

### Configurazioni NGINX Perse

```bash
# 1. Verifica backup
ls -la backups/config-*/

# 2. Ripristina da backup più recente (env e config Kibana)
cd backups/config-YYYYMMDD_HHMMSS/
cp .env ../../.env
cp -r kibana-config/* ../../docker/volumes/kibana/config/

# 3. Riavvia i servizi
docker compose -f docker-compose.dev.yml up -d
```

### Dashboard Kibana Perse

```bash
# 1. Lista backup disponibili
make dashboards-list

# 2. Importa backup
make dashboards-import

# 3. Se nessun backup, ricrea dashboard manualmente
```

## Checklist Pre-Produzione

Prima del deployment in produzione, assicurati:

- [ ]  **Backup dashboard**: `make dashboards-export SPAZIO=<spazio> NOME=<nome>`
- [ ]  **Pulizia selettiva**: `./scripts/cleanup.sh --production`
- [ ]  **Configurazioni verificate**: Kibana, NGINX, SSL ancora presenti
- [ ]  **Credenziali aggiornate**: File `.env` con password produzione
- [ ]  **Test servizi**: Tutti i container si avviano correttamente

## Vantaggi del Nuovo Sistema

1. ** Sicurezza**: Backup automatici prima di ogni pulizia
2. ** Controllo**: Modalità multiple per diversi scenari
3. ** Visibilità**: Output dettagliato e colorato
4. ** Automazione**: Meno comandi manuali, meno errori
5. ** Modularità**: Script specializzati per compiti specifici
6. ** Testing**: Verifica automatica dello stato post-operazione

## Tips e Best Practices

- **Esporta dashboard regolarmente** durante lo sviluppo
- **Usa `--soft`** per pulizie quotidiane, preserva tutto
- **Usa `--production`** solo per deployment live
- **Controlla sempre i log** dopo operazioni di pulizia/restart
- **Mantieni backup multipli** delle configurazioni critiche
- **Testa in locale** prima di applicare in produzione

---

*Sistema implementato il 30 Luglio 2025 - per supporto controlla i log degli script o la documentazione del progetto.*
