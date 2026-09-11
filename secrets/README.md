# Secrets

Due meccanismi distinti, per due ambienti che non condividono nulla.

## Sviluppo: `.env`

Il file non e' versionato. Si parte dal modello e si compilano i valori, che per
lo sviluppo sono elencati in [docs/SVILUPPO.md](../docs/SVILUPPO.md):

```bash
cp .env.example .env
```

Per condividere valori dentro il gruppo di lavoro senza metterli in chiaro nel
repository, il flusso con SOPS e age resta disponibile:

```bash
cp .sops.yaml.example .sops.yaml
# sostituire il destinatario age in .sops.yaml
sops --encrypt .env > secrets/dev.enc.env
sops --decrypt secrets/dev.enc.env > .env
```

Le chiavi private age stanno fuori dal repository. Un destinatario per persona o
per macchina, cosi' l'accesso si revoca senza riscrivere tutto.

## Produzione: file di secret dello stack

Lo stack Swarm non legge `.env`. Ogni credenziale e' un file separato in questa
directory, montato dal servizio che la usa come Docker secret: `deploy/stack.yml`
li dichiara uno per uno, e il deploy si rifiuta di partire se uno e' assente o
vuoto.

```bash
make secrets SECRETS_DIR=/srv/progetti_innovativi/secrets
```

Lo script e' idempotente per costruzione: un file gia' presente non viene
toccato. Una rigenerazione accidentale invaliderebbe le credenziali con cui i
servizi si sono registrati, e il danno si manifesterebbe solo al riavvio
successivo.

| File | Contenuto |
|---|---|
| `elastic_password` | Utente `elastic`, superuser |
| `kibana_system_password` | Utente `kibana_system` |
| `kibana_encryption_key` | Cifratura dei saved object, almeno 32 caratteri |
| `mongo_root_password` | Utenza amministrativa MongoDB |
| `redis_password` | Utenza dell'applicazione su Redis |
| `crowdsec_bouncer_key` | Chiave del bouncer Traefik, registrata in CrowdSec come `key_traefik` |
| `apm_secret_token` | Token dell'intake APM, condiviso fra policy Fleet e backend |
| `gameplay_id_salt` | Sale degli identificativi di partita, fisso per l'intero esercizio |
| `filebeat_writer_password` | Utente `filebeat_writer`, con cui Filebeat scrive i log |
| `dashboard_users` | Utenze delle dashboard, unione dei due elenchi sotto |
| `dashboard_users_esercizio` | Utenze della vista di esercizio |
| `dashboard_users_evento` | Utenze della vista di evento |

I tre elenchi di utenze non sono generati: le credenziali vanno scelte e
distribuite a persone, quindi si compilano a mano e lo script si limita a
segnalarne l'assenza. La procedura, con i passi di deploy nell'ordine giusto, e'
in [provisioning/README.md](../provisioning/README.md#avvio-non-presidiato).

Nessuno di questi file va versionato.
