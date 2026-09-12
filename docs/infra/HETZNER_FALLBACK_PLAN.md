# Ripiego su hardware Hetzner — tabella di marcia

Documento di contingenza, **attivato l'11 settembre 2026**: l'host di esercizio non è la
VM di dipartimento ma una macchina dedicata presa dall'asta Hetzner. Riporta i dati reali
della consegna, le verifiche già eseguite e i passi che restano, nell'ordine in cui vanno
eseguiti.

Non sostituisce `INFRA_RESTRUCTURING_PLAN.md`: ne eredita architettura, budget delle
risorse, disegno dei segreti e criteri di sicurezza. Interviene solo dove l'ipotesi
"VM fornita da terzi" smette di valere, cioè su acquisto, installazione del sistema,
layout dei dischi, DNS e certificato. Le procedure operative restano in
`docs/ESERCIZIO.md`; qui stanno i dati e le differenze specifiche di questa macchina.

Le modifiche al repository sono elencate in sezione 9. Sono applicate solo quelle
segnate come fatte; le altre sono descritte e non eseguite.

## Stato al 12 settembre 2026

| Voce | Stato |
|---|---|
| Decisione fra i due percorsi | **chiusa**: ripiego su Hetzner |
| Macchina | ordinata alle 10:39, in servizio nel sistema di ripristino dalle 10:46. Hardware accettato dopo le verifiche della sezione 4.1. Sistema installato e avviato alle 12:44. Prima sincronizzazione RAID e controllo di coerenza dopo il riavvio conclusi: entrambi gli array `[UU]`, `sync_action=idle`, `mismatch_cnt=0` |
| Dominio | `pot-tales.it` registrato alle 11:15 e attivo. Record A verso `195.201.247.58` e CAA per Let's Encrypt impostati il 12 settembre con TTL 5 minuti; nessun AAAA e `www` rimosso. Propagazione verificata sui quattro server autoritativi Aruba |
| Storage Box | facoltativa e non ordinata: nessun passo ne dipende, sezioni 3.3 e 9.6 |
| Prerequisiti dell'host | sezioni 5.1–5.8 e riavvio 5.10 completati l'11 settembre: utente `admin`, SSH a chiave, root disabilitato, kernel `6.8.0-139-generic`, fuso, sysctl, rete, firewall, Docker e journal verificati dopo il riavvio. Controllo di coerenza RAID concluso il 12 settembre con `mismatch_cnt=0`. Il 12 settembre le unità provvisorie di rete sono state sostituite con `nic-offload@enp0s31f6` e `docker-user-rules@enp0s31f6`: entrambe attive, TSO/GSO spenti, porta 80 raggiungibile e 8080 bloccata dall'esterno |
| Repository | clonato manualmente sulla macchina in `/srv/progetti_innovativi`. Il 12 settembre il ramo `develop` è stato aggiornato manualmente, in fast-forward, a `8af699d2`, che corregge la configurazione statica di Traefik. Non esistono timer, webhook o mirror automatici. Le immagini applicate restano quelle pubblicate da `954513d0` e verificate per digest; le modifiche privacy, accessibilità e risorse del presente aggiornamento richiedono una successiva pubblicazione e un deploy manuale |
| Deploy | primo deploy completato. Swarm attivo; setup completato; Fleet inizializzato e token generati; tutti i servizi persistenti hanno raggiunto `1/1`. La correzione Traefik `8af699d2` è stata applicata, il certificato di produzione già emesso è stato riutilizzato e `/health` risponde 200. `stack-deploy.service` resta disabilitata e inattiva, HSTS resta a zero e non è configurato alcun riavvio automatico |

**Vincolo storico, assolto al primo deploy.** Le unità di rete di `provisioning/` sono
installate e attive, mentre `stack-deploy.service` resta deliberatamente disabilitata e
inattiva fino alla conclusione del collaudo. Il repository si aggiorna e lo stack si
riapplica solo con comandi manuali. Il volume `pi_acme` non va cancellato: contiene il
certificato di produzione già emesso e deve essere riutilizzato senza provocare una
nuova richiesta alla CA.

## 1. Perimetro e condizione di attivazione

Il ripiego si attivava se si verificava una di queste condizioni:

- il dipartimento non consegna la macchina entro una data compatibile con il collaudo
- la consegna avviene ma senza uno dei requisiti bloccanti della sezione 10 del piano
  principale: `vm.max_map_count` impostabile, raggiungibilità pubblica su 80 e 443,
  uscita verso i registry, privilegi amministrativi
- il certificato fornito non è emesso da una CA pubblicamente attendibile

**Esito.** Si è verificata la prima condizione: al 2 settembre la macchina non era stata
consegnata, e la decisione è stata chiusa l'11 settembre in un colpo solo, senza portare
avanti i due percorsi in parallelo.

## 2. Delta rispetto al piano principale

### Vincoli che cadono

Tutta la sezione 10 del piano principale è una lista di cose da chiedere. Su hardware
proprio diventano decisioni interne, e con esse spariscono i rischi di attesa.

| Requisito | Su macchina Hetzner |
|---|---|
| `vm.max_map_count` persistente | già a 1048576 nel sistema installato, sezione 5.3 |
| swap disabilitato | nessuna partizione di swap nel layout |
| LVM con spazio non allocato | proprio, deciso in installazione |
| account amministrativo, SSH da rete esterna | proprio |
| porte 80 e 443 pubbliche | aperte, nessuna autorizzazione da chiedere |
| uscita verso Docker Hub, Elastic, GHCR, CA | verificata in sezione 4.3. In uscita il fornitore blocca solo le porte 25 e 465, che lo stack non usa: sorveglianza e allarmi viaggiano in HTTPS |
| hostname e record DNS | dominio proprio |
| CA pubblicamente attendibile | Let's Encrypt, già strada predefinita in `traefik.yml` |
| finestre di manutenzione con riavvio | nessuna imposta da terzi |
| disponibilità non prima del 1 settembre | **caduto**: la macchina è stata attivata sette minuti dopo l'ordine |

### Vincoli che peggiorano

| Voce | Conseguenza | Compensazione |
|---|---|---|
| Nessuno snapshot della macchina offerto dal fornitore | cade la copertura "perdita della macchina" prevista in sezione 8 | snapshot LVM locali contro gli errori logici; contro la perdita della macchina, prelievo dell'archivio portabile e delle esportazioni sulla postazione (sezione 9.6). Una Storage Box in un'altra sede, se aggiunta in seguito, lo renderebbe automatico (sezione 3.3) |
| Hardware ricondizionato | un disco molto usurato, l'altro con errori di integrità storici: sezione 4.1 | RAID1, verifica di coerenza dopo la sincronizzazione, contatori SMART nella vigilia di ogni apertura |
| Nessun supporto operativo di secondo livello | un guasto hardware è un ticket, non una telefonata | password telefonica impostata nel Robot, così l'assistenza del datacenter può essere chiamata senza accesso al pannello |
| Responsabilità di sistema interamente interna | patch, firewall e aggiornamenti non li fa nessun altro | sezione 5 |

### Vincoli che migliorano

- **La copia off-host automatica diventa possibile, non necessaria.** La sezione 8 del
  piano principale la escludeva perché il dipartimento non forniva spazio esterno. Con
  la Storage Box del fornitore (sezione 3.3) la sincronizzazione dei dump diventerebbe
  pianificata e senza presenza, e coprirebbe la finestra del primo giorno che il piano
  dichiarava scoperta. Non è stata ordinata e nessun passo ne dipende: se la si
  aggiunge, è un passo in più (sezione 9.6).
- **Memoria abbondante.** 64 GB contro un budget tarato su 16 GB, che sommava tetti per
  circa 13,5 GB. I limiti restano come contenimento: servono a decidere chi muore per
  primo, non a stare nella RAM. Il budget è stato ridimensionato sui 64 GB, con una
  somma dei limiti intorno a 25 GB, compreso il job di setup; APM e l'agente
  infrastrutturale hanno margine esplicito dopo la prova reale (sezione 9.5).
- **Dominio proprio.** Cade il vincolo dell'hostname singolo imposto dal dipartimento.
  Vedi sezione 8.

**La CPU non migliora.** L'i7-7700 ha quattro core fisici e otto thread, in linea con le
4 vCPU richieste. I tetti di CPU in `deploy/stack.yml` sono tarati su otto CPU logiche e
restano validi. Il collo di bottiglia resta quello previsto, e il load test va eseguito
comunque.

## 3. Fase 0 — Acquisti (eseguita)

### 3.1 Macchina

| Voce | Valore |
|---|---|
| Ordine | riferimento `B20260911-3504740`, 11 settembre 2026 alle 10:39 |
| Prodotto | Dedicated Server "Server Auction", ID asta `3068151` |
| Sede | Falkenstein, FSN1 (FSN1-DC11 nell'annuncio) |
| CPU | Intel Core i7-7700, 4 core e 8 thread, 3,6 GHz |
| Memoria | 64 GB DDR4 non ECC, 4 moduli da 16 GB |
| Dischi | 2 NVMe M.2 da 512 GB, dettaglio in sezione 4.1 |
| Rete | Intel I219-LM 1 Gbit, driver `e1000e`, interfaccia `enp0s31f6`, MAC `90:1b:0e:fe:13:b1`, traffico non misurato |
| Avvio | BIOS legacy (CSM), nessuna partizione EFI necessaria |
| IPv4 | `195.201.247.58/32` |
| IPv6 | `2a01:4f8:231:764::/64`, configurato `::2` |
| Hostname | `pot-tales` |
| Accesso iniziale | chiave pubblica ed25519 `pottales-ops` indicata nell'ordine; nessuna password inviata |
| Chiave host del sistema di ripristino | `SHA256:3eAwTz3J6/lvzosaHQu/01QbfDKsYouYNfR/Mkt9lO8`, non più in uso |
| Chiave host del sistema installato | `SHA256:m1/KqdbeInIdbKhFgF8Wqr4HCchIwHbEGu9/a4wfvC8` (ed25519) |
| Supporto | email e telefono inclusi. L'assistenza del datacenter identifica il cliente con la password telefonica impostata nel Robot |

**Costi e fatturazione.** Prezzi con IVA al 22%, come applicata nel Robot:

| Voce | Tetto mensile | Orario | Setup |
|---|---|---|---|
| Server | 73,20 € (60,00 € netti) | 0,1174 € | 0,00 € |
| IPv4 primario | 2,07 € (1,70 € netti) | 0,0033 € | 0,00 € |
| **Totale** | **75,27 €** | **0,1207 €** | 0,00 € |

La fatturazione è oraria fino al tetto mensile, e la disdetta di un server d'asta è di
norma immediata. Sull'esercizio previsto, dall'11 al 27 settembre, il costo del solo
server con l'IPv4 è compreso fra **46,35 €** (384 ore) e **49,25 €** (408 ore).
L'addebito corre dalla consegna alla disdetta effettiva, quindi la disdetta segue il
prelievo finale dei dati senza giorni di scarto.

Correzione alla prima stesura: l'IPv4 non è incluso nel prezzo del server, è una voce a
parte.

### 3.2 Dominio

| Voce | Valore |
|---|---|
| Nome | `pot-tales.it`, con il trattino |
| Registrar | Aruba (`ARUBA-REG`), servizio "Dominio" senza email, con gestione DNS |
| Registrazione | 11 settembre 2026 alle 11:15:10, poi attivazione nello stesso giorno |
| Intestatario | persona fisica (`EntityType: 1`), Filippo Maria Valente |
| Recapiti dell'intestatario | email e telefono del referente tecnico dell'infrastruttura, per scelta concordata con l'intestatario |
| Titolare dell'account Aruba | referente tecnico dell'infrastruttura |
| Pubblicazione dei dati nel WHOIS | negata |
| Scadenza | 11 settembre 2027 |
| Rinnovo automatico | **attivo**, 11,99 € + IVA a carico del titolare dell'account |
| Costo del primo anno | 3,99 € + IVA |

**Pannello DNS.** Accetta record A, AAAA e CAA, con TTL impostabile per record. Il valore
minimo del TTL non è documentato e va letto nel pannello quando si crea il primo record.

**Da decidere alla dismissione** (`docs/ESERCIZIO.md`, sezione 10): il rinnovo automatico
è attivo per impostazione predefinita. Lasciarlo acceso evita che il nome stampato sui
QR torni libero e venga registrato da altri. Spegnerlo evita un addebito non deciso su un
dominio intestato a un'altra persona. La decisione spetta all'intestatario.

**Nota sul nome.** La forma senza trattino, `pottales.it`, non è registrata. Chi digita
il nome a memoria può omettere il trattino e finire su un nome che chiunque può
registrare. Registrarla come reindirizzamento costa 3,99 € + IVA il primo anno. È
facoltativo e non blocca nulla.

### 3.3 Storage Box (facoltativa)

Non ordinata. Nessuno script del repository e nessun passo di questo piano la presuppone
(sezione 9.6): la tabella resta come riferimento se la si aggiunge in seguito.

| Voce | Valore |
|---|---|
| Modello | BX11, 1 TB: il taglio più piccolo, ampiamente sopra i 5 GB di dump previsti |
| Sede | **HEL1**. La pagina del prodotto elenca solo FSN1 e HEL1, e con il server in FSN1 la sede diversa è l'unica che protegge anche da un guasto dell'intero datacenter |
| Costo | circa 3,20 € netti al mese, dato di un listino di terzi da confermare in console. Fatturazione oraria, nessun setup, nessuna durata minima |
| Accesso | sub-account limitato a una sola directory, con la chiave SSH dedicata del server (sezione 5.9). La chiave che scrive sulla box non deve poter raggiungere altro |
| Snapshot | automatici attivi, fino a 10 sul modello BX11. Proteggono i dump da una sincronizzazione che sovrascrive copie buone con uno stato già corrotto |
| Protocolli | SFTP e SCP sulla porta 22. Per rsync e BorgBackup la porta attesa è la 23, da verificare in configurazione |

## 4. Fase 1 — Accettazione dell'hardware e installazione

### 4.1 Accettazione (eseguita l'11 settembre)

Verifiche eseguite dal sistema di ripristino prima di scrivere sui dischi.

**I nomi `nvme0n1` e `nvme1n1` in questa tabella sono quelli del sistema di ripristino.**
Nel sistema installato l'ordine di enumerazione è invertito, verificato l'11 settembre
con `lsblk -d -o NAME,MODEL,SERIAL`: `nvme0n1` è il Samsung (`S3W8NB0K413381`),
`nvme1n1` il Toshiba (`Y67S105STUHV`). Il nome del dispositivo non è stabile fra un kernel e l'altro: **i dischi si
identificano per seriale**, e ogni lettura dei contatori va associata al seriale che la
riporta.

| | `nvme0n1` | `nvme1n1` |
|---|---|---|
| Modello | Toshiba THNSN5512GPU7 | Samsung MZVLB512HAJQ-00000 (PM981) |
| Seriale | `Y67S105STUHV` | `S3W8NB0K413381` |
| Firmware | 57GA4103 | EXA7301Q |
| Critical Warning | 0x00 | 0x00 |
| Available Spare (soglia) | 100% (10%) | 100% (10%) |
| **Percentage Used** | **76%** | 7% |
| Dati scritti / letti | 133 TB / 54,2 TB | 28,4 TB / 55,1 TB |
| **Power On Hours** | **78.781** | 17.494 |
| Unsafe Shutdowns | 16 | 2 |
| **Media and Data Integrity Errors** | 0 | **3** |
| Error Information Log Entries | 0 | 68 |
| Temperatura a riposo | 46 °C | 26 °C |
| Soglia di avviso della temperatura | 78 °C | 81 °C |
| Auto-test del dispositivo | non supportato | supportato |

**Prove eseguite.**

1. Lettura completa di entrambi i dischi con `dd ... iflag=direct`: 2,3 GB/s su
   `nvme1n1`, 2,2 GB/s su `nvme0n1`, nessun errore di I/O, contatori SMART invariati,
   nessun messaggio anomalo del kernel.
2. Auto-test esteso su `nvme1n1` (durata dichiarata 35 minuti): **superato**, esito 0,
   codice di test 2, all'ora di funzionamento 17.494.
3. Contatore degli errori di integrità di `nvme1n1` ricontrollato dopo l'auto-test:
   fermo a 3.

**Lettura dei risultati.**

- Le 68 voci del registro errori di `nvme1n1` non indicano un difetto: l'unica voce
  mostrata ha stato `0x4004` sulla coda di amministrazione, cioè "Invalid Field in
  Command", tipico dei PM981 quando ricevono un comando che non supportano.
- La lettura completa da sola non basta su `nvme1n1`: il disco dichiarava solo 10,8 GB
  occupati, e per i blocchi mai scritti un NVMe restituisce zeri senza leggere la
  memoria fisica. È per questo che l'auto-test esteso, che verifica la memoria
  dall'interno, era necessario.
- I 3 errori di integrità di `nvme1n1` sono storici e non si ripetono né in lettura né
  nell'auto-test.
- `nvme0n1` non ha errori, e il margine di scrittura residuo supera di ordini di
  grandezza quanto un mese di esercizio può scrivere. Il rischio è l'età: nove anni di
  funzionamento continuo. Il fornitore non sostituisce un disco solo perché è usurato.

**Esito: hardware accettato.** La sostituzione di `nvme1n1` avrebbe portato un altro
disco usato di condizione ignota, senza toccare il rischio principale, che è l'età di
`nvme0n1`. Il rischio residuo è la perdita di entrambi i dischi durante l'esercizio, ed
è coperto da:

- RAID1, con verifica di coerenza delle due copie dopo la prima sincronizzazione
  (sezione 4.3);
- lettura dei contatori SMART nella vigilia di ogni apertura (`docs/ESERCIZIO.md`,
  sezione 7), con i valori di riferimento di questa tabella;
- copia automatica dei dump fuori dalla macchina (sezioni 3.3 e 9.6).

Se in una lettura successiva il contatore del Samsung (`S3W8NB0K413381`) supera 3, o
quello del Toshiba (`Y67S105STUHV`) supera 0, si chiede la sostituzione del disco
indicando il seriale.

Lettura dei contatori con il seriale accanto, valida qualunque sia l'ordine dei nomi:

```
for d in /dev/nvme?n1; do printf '%s %s\n' "$d" "$(smartctl -i "$d" | awk -F': *' '/Serial Number/ {print $2}')"; smartctl -A "$d" | grep -E 'Media and Data|Error Information|^Temperature:'; done
```

### 4.2 Installazione (completata l'11 settembre)

Eseguita dal sistema di ripristino con `installimage -a -c /root/install.conf`, completata
in 17 passi senza errori. `installimage` ha disattivato la password di root e l'accesso
SSH di root con password, e ha copiato la chiave `pottales-ops` nel sistema installato.
Configurazione usata:

```
DRIVE1 /dev/nvme0n1
DRIVE2 /dev/nvme1n1
SWRAID 1
SWRAIDLEVEL 1
BOOTLOADER grub
HOSTNAME pot-tales
PART /boot ext3 1024M
PART lvm vg0 all
LV vg0 root / ext4 30G
LV vg0 var /var ext4 20G
LV vg0 docker /srv/docker ext4 60G
LV vg0 elastic /srv/data/elastic ext4 120G
LV vg0 diagnostics /srv/diagnostics ext4 20G
LV vg0 backup /srv/backup ext4 30G
LV vg0 export /srv/export ext4 30G
IMAGE /root/images/Ubuntu-2404-noble-amd64-base.tar.zst
```

**Scostamenti dalla prima stesura, e perché.**

- **Il volume dei dati Docker si chiama `docker`, non `dock`.** `data-backup.sh`
  fotografa `/dev/$VG_NAME/$LV_DOCKER`, con `LV_DOCKER=docker` come valore predefinito.
  Con questo nome basta impostare `VG_NAME=vg0`.
- **MongoDB resta sul volume `docker`, senza un volume logico proprio.** Lo snapshot LVM
  copre un solo volume. Con MongoDB su un volume separato, la copia primaria dei dati
  non ricostruibili non lo includerebbe. `data-restore.sh` lavora sul volume Docker
  `pi_mongodata` e non dipende da dove questo risiede. La separazione che conta resta:
  Elasticsearch ha un volume proprio, e il riempimento degli indici non raggiunge
  MongoDB.
- **Volumi `backup` ed `export`.** Gli script scrivono in `/srv/backup` e `/srv/export`,
  che nel layout della prima stesura stavano sul volume di sistema da 30 GB.
  Un'esportazione completa degli indici lo avrebbe riempito, cioè esattamente il guasto
  che il volume di sistema piccolo deve evitare.
- **Nessuna partizione EFI:** la macchina si avvia in BIOS legacy.
- **L'immagine è `.tar.zst`**, non `.tar.gz`.

**Spazio.** Un disco da 512 GB vale 476,9 GiB. Il volume group misura 475,81 GiB: ne sono
allocati 310, e **ne restano 165,81 non allocati** per gli snapshot. La prima stesura
indicava circa 250 GiB, stima che non teneva conto della capacità effettiva. Tre snapshot
da 16 GB, come da `SNAP_SIZE` e `SNAP_KEEP` (sezione 9.5), ne usano 48. Aggiungere un volume logico più
avanti resta un'operazione a caldo.

**Perché questo layout.**

**RAID1 e non RAID0.** Lo spazio utile scende a circa 476 GiB, oltre tre volte il budget
di 150 GB. RAID0 raddoppierebbe spazio e probabilità di guasto su una macchina senza
snapshot del fornitore, con dischi della sezione 4.1.

**Volume di sistema piccolo.** Il riempimento di indici, esportazioni o log non deve
poter rendere la macchina ingestibile proprio quando serve intervenire. La differenza è
fra "il monitoraggio si degrada" e "la macchina non risponde", e il primo giorno non c'è
nessuno a rimediare il secondo.

**ext4 e non XFS.** A questa scala la differenza non è materiale, XFS non si può
restringere, ed ext4 è ciò che la catena esistente in `provisioning/` già usa.

**Nota sullo strumento esistente.** `provisioning/bin/setup-volumes.sh` assume
`VG_NAME=ubuntu-vg`, crea volumi con altri nomi e ci passa sopra `mkfs.ext4`. Con il
layout definito in installazione **non va eseguito**: sezione 9.4.

### 4.3 Verifiche dopo l'installazione (eseguite l'11 settembre)

Primo accesso alle 12:44, dopo `ssh-keygen -R 195.201.247.58` sulla postazione: la chiave
host cambia fra sistema di ripristino e sistema installato. La nuova impronta è in
sezione 3.1.

| Controllo | Atteso | Rilevato |
|---|---|---|
| sistema | Ubuntu 24.04 LTS | Ubuntu 24.04.4 LTS, kernel 6.8.0-138-generic |
| volumi e punti di montaggio | quelli della sezione 4.2 | corrispondono; `/boot` su `md0`, volume group su `md1` |
| `vgs` | circa 165 GiB liberi | 475,81 GiB, liberi 165,81 |
| `mdstat` | due array RAID1 | `md0` e `md1` `[UU]`; `md1` in prima sincronizzazione, 45% alle 12:45 a circa 205 MB/s |
| `swapon` | nessuna riga | nessuna riga |
| `sshd -T` | autenticazione a chiave attiva | `permitrootlogin without-password`, `pubkeyauthentication yes`, **`passwordauthentication yes`**: da chiudere in sezione 5.1 |
| `timedatectl` | orologio sincronizzato | sincronizzato, servizio NTP attivo; fuso **`Europe/Berlin`**, da allineare in sezione 5.2 |
| `ip -br addr` | indirizzi della sezione 3.1 | `enp0s31f6` con `195.201.247.58/32` e `2a01:4f8:231:764::2/64` |
| `vm.max_map_count` | valore predefinito | **1048576**, già sopra il minimo di Elasticsearch: sezione 5.3 |
| blocchi della scheda di rete | nessuno | nessuno |
| uscita verso i registry | qualunque codice HTTP | Docker Hub 401, Elastic 401, GHCR 401, `hc-ping.com` 301, directory di prova dell'autorità 200 |

La prova verso l'autorità di certificazione è una lettura dell'elenco dei servizi: non
crea account né certificati e non conta nei limiti.

**Temperatura.** Il riepilogo di accesso riportava 70,8 °C, senza indicare il sensore,
con la sincronizzazione del RAID in corso. Rilettura per zona e per disco, alle 12:55
circa, con la sincronizzazione ancora in corso:

| Sensore | Valore |
|---|---|
| CPU (`x86_pkg_temp`) | 46 °C |
| chipset (`pch_skylake`) | 38 °C |
| Toshiba, soglia di avviso 78 °C | 50 °C; minuti sopra soglia nella vita del disco fermi a 8 |
| Samsung, soglia di avviso 81 °C | 36 °C, secondo sensore 53 °C; minuti sopra soglia 0 |

Margini ampi sotto carico di scrittura sequenziale. La lettura si ripete durante il load
test, con il ciclo per seriale della sezione 4.1 e le zone termiche:

```
for z in /sys/class/thermal/thermal_zone*; do printf '%s %s\n' "$(cat $z/type)" "$(( $(cat $z/temp) / 1000 ))"; done
```

**Coerenza del RAID (da eseguire).** Dopo la conclusione della sincronizzazione di `md1`
**e dopo il riavvio della sezione 5.10**: un riavvio interrompe il controllo, che non
riprende da solo. Si fanno confrontare le due copie:

```
echo check > /sys/block/md1/md/sync_action
cat /proc/mdstat
cat /sys/block/md1/md/mismatch_cnt
```

A controllo concluso `mismatch_cnt` deve valere 0, e il ciclo per seriale della sezione
4.1 deve riportare 0 errori di integrità sul Toshiba e 3 sul Samsung. La prima
sincronizzazione scrive entrambi i dischi per intero, quindi è anche la prima prova in
scrittura su tutta la superficie.

- esito della verifica di coerenza: *da compilare*

## 5. Fase 2 — Prerequisiti dell'host

Da eseguire a sistema installato e verificato, prima di qualunque deploy. L'ordine conta:
ogni passo ha la propria verifica, e il passo successivo parte solo quando questa è
superata. Nessun passo di questa fase tocca certificati, DNS o stack. La sincronizzazione
del RAID può essere ancora in corso: prosegue in background.

L'interfaccia di rete è `enp0s31f6`. `<utente>` è il nome dell'utente amministrativo.

### 5.0 Aggiornamento del sistema e strumenti di diagnosi

L'immagine installata segnala un elenco di aggiornamenti vecchio di oltre una settimana.
Si aggiorna prima di tutto il resto, e si installano gli strumenti usati dalle verifiche
di questo piano:

```
apt-get update
apt-get full-upgrade -y
apt-get install -y smartmontools nvme-cli ethtool
```

Un eventuale kernel nuovo entra in uso con il riavvio di prova della sezione 5.10.

### 5.1 Utente amministrativo e accesso SSH

**Eseguita l'11 settembre 2026.** L'utente amministrativo è `admin`, membro del gruppo
`sudo`. L'accesso è stato verificato da entrambi i PC prima di chiudere root; una
verifica successiva dal desktop ha confermato l'accesso di `admin` e il rifiuto di
`root` con `Permission denied (publickey)`. Le chiavi autorizzate sono distinte:

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIL/qwqdXsAE/GZVzcB1Jkv7zOPM6AFqOeqgOUDg6ydlG pottales-ops
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPVdtwW+pUuvRjKK4gQYEJKuneKqKxrKUrqGJjqv5qb6 leonardosoligo21@gmail.com
```

La prima appartiene al desktop, la seconda al portatile. La revoca di una postazione
non richiede quindi di sostituire la chiave privata dell'altra.

Dopo l'installazione `sshd` accetta ancora l'autenticazione con password. Root non ha
password, ma un utente creato con una password sarebbe raggiungibile così. Per questo si
chiude prima l'autenticazione con password, che non tocca l'accesso di root con chiave,
poi si crea l'utente, e l'accesso di root si chiude per ultimo, solo dopo aver provato
quello del nuovo utente da una seconda sessione.

**Passo 1**, dalla sessione di root:

```
cat > /etc/ssh/sshd_config.d/10-accesso.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
EOF
sshd -t && systemctl reload ssh
sshd -T | grep -Ei '^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication)'
```

**Passo 2:**

```
adduser --gecos "" <utente>
usermod -aG sudo <utente>
install -d -m 700 -o <utente> -g <utente> /home/<utente>/.ssh
install -m 600 -o <utente> -g <utente> /root/.ssh/authorized_keys /home/<utente>/.ssh/authorized_keys
```

La password chiesta da `adduser` serve solo a `sudo` e va conservata nel gestore di
password. Da una **seconda** sessione, lasciando aperta la prima:

```bash
ssh <utente>@195.201.247.58
```

Sulla macchina, in quella sessione, `sudo -v` deve riuscire.

**Passo 3**, solo a passo 2 superato, dalla sessione di root:

```
echo 'PermitRootLogin no' >> /etc/ssh/sshd_config.d/10-accesso.conf
sshd -t && systemctl reload ssh
sshd -T | grep -Ei '^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication)'
```

Atteso: `permitrootlogin no`, `passwordauthentication no`,
`kbdinteractiveauthentication no`. `sshd` usa il primo valore che incontra, e i file di
`sshd_config.d` sono letti in ordine alfabetico: il prefisso `10-` prevale su eventuali
file successivi. Verifica da una terza sessione: `ssh root@...` rifiutato,
`ssh <utente>@...` accettato. Da qui i comandi di amministrazione passano da `sudo`.

### 5.2 Fuso orario

```
timedatectl set-timezone Europe/Rome
timedatectl
```

Il sistema installato era su `Europe/Berlin`. Lo scostamento orario è identico, ma
documenti e check della copia notturna dichiarano `Europe/Rome`, attesa dal servizio
esterno alle 03:30: si allinea per coerenza.

### 5.3 Parametri del kernel

Il sistema installato ha già `vm.max_map_count = 1048576`, sopra il minimo di 262144
richiesto da Elasticsearch: Ubuntu 24.04 lo imposta con un file di sistema in
`/usr/lib/sysctl.d/`. Scrivere 262144 in `/etc/sysctl.d/` lo abbasserebbe, perché i file
in `/etc` sono applicati dopo. Si rende esplicito il requisito senza abbassare il valore,
così resta valido anche se il predefinito della distribuzione cambiasse:

```
grep -rs max_map_count /usr/lib/sysctl.d /etc/sysctl.d /run/sysctl.d
echo 'vm.max_map_count=1048576' > /etc/sysctl.d/60-elasticsearch.conf
sysctl --system | grep max_map_count
```

Il valore va riletto dopo il riavvio della sezione 5.10.

### 5.4 Scheda di rete

La I219-LM con il driver `e1000e` è soggetta a blocchi della coda di trasmissione sotto
carico (`Detected Hardware Unit Hang`), legati alla segmentazione in hardware. Per un
esercizio con il primo giorno non presidiato si disattivano TSO e GSO in modo
persistente. Con questo traffico il costo è trascurabile.

Si usa un'unità dedicata e non un file `.link` o le opzioni di netplan: un file `.link`
che corrisponde alla scheda sostituisce quello predefinito, e con esso la politica che
assegna il nome dell'interfaccia. Un nome che cambia romperebbe la configurazione di rete.

```
cat > /etc/systemd/system/nic-offload.service <<'EOF'
[Unit]
Description=Disattiva TSO e GSO sulla scheda Intel I219-LM
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/sbin/ethtool -K enp0s31f6 tso off gso off

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now nic-offload.service
ethtool -k enp0s31f6 | grep -E '^(tcp-segmentation-offload|generic-segmentation-offload):'
```

Atteso: entrambe le voci a `off`, anche dopo il riavvio. Durante il load test
`dmesg | grep -i 'hardware unit hang'` deve restare vuoto.

L'unità scritta qui serve finché il repository non è sulla macchina. In sezione 7.2,
punto 4, si sostituisce con il template `provisioning/systemd/nic-offload@.service`
(commit `9d058280`), parametrizzato sull'interfaccia.

### 5.5 Firewall

Due livelli, perché **Docker scavalca ufw**: i pacchetti diretti alle porte pubblicate
dai container non attraversano `INPUT`, dove vivono le regole di ufw.

**Livello dell'host, con ufw.** La porta 22 si apre prima di attivare il firewall:

```
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw default deny incoming
ufw default allow outgoing
ufw enable
ufw status verbose
```

ufw applica le stesse regole a IPv6. Conta: la macchina ha un indirizzo IPv6 pubblico
anche senza record AAAA.

**Livello dei container, in `DOCKER-USER`.** La catena esiste solo dopo l'installazione
di Docker, quindi le regole si abilitano in sezione 5.6. Consentono la risposta alle
connessioni già stabilite e le sole porte 80 e 443 originali, confrontate prima della
traduzione di indirizzo con `--ctorigdstport`, e scartano il resto in ingresso
dall'interfaccia pubblica. `RETURN` e non `ACCEPT`, perché le regole proprie di Docker
devono comunque essere valutate.

```
cat > /usr/local/sbin/docker-user-rules.sh <<'EOF'
#!/bin/sh
set -e
for ipt in iptables ip6tables; do
  $ipt -N DOCKER-USER 2>/dev/null || true
  $ipt -F DOCKER-USER
  $ipt -A DOCKER-USER -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
  $ipt -A DOCKER-USER -i enp0s31f6 -p tcp -m conntrack --ctorigdstport 80 --ctdir ORIGINAL -j RETURN
  $ipt -A DOCKER-USER -i enp0s31f6 -p tcp -m conntrack --ctorigdstport 443 --ctdir ORIGINAL -j RETURN
  $ipt -A DOCKER-USER -i enp0s31f6 -j DROP
  $ipt -A DOCKER-USER -j RETURN
done
EOF
chmod 0755 /usr/local/sbin/docker-user-rules.sh
cat > /etc/systemd/system/docker-user-rules.service <<'EOF'
[Unit]
Description=Regole della catena DOCKER-USER
After=docker.service
Requires=docker.service
PartOf=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/sbin/docker-user-rules.sh

[Install]
WantedBy=docker.service
EOF
```

Le regole non sono ancora state provate su questa macchina: la verifica esterna fa parte
del passo. Dopo l'abilitazione, in sezione 5.6, si pubblica una porta di prova e si
controlla dalla postazione che non sia raggiungibile:

```
docker run --rm -d --name prova-firewall -p 8080:80 nginx:alpine
```

```bash
curl -m 5 http://195.201.247.58:8080/
```

La richiesta dalla postazione deve andare in timeout. Poi `docker stop prova-firewall`.

Il firewall del fornitore resta facoltativo, come nella prima stesura. È stateless e
richiede regole esplicite per il traffico di ritorno.

Come in 5.4, script e unità scritti qui si sostituiscono in sezione 7.2, punto 4, con
`provisioning/bin/docker-user-rules.sh` e il template `docker-user-rules@.service`
(commit `9d058280`): stesse regole, parametrizzate sull'interfaccia.

### 5.6 Docker Engine

`daemon.json` va scritto **prima** di installare il pacchetto, che avvia il demone
durante l'installazione: senza, le immagini finirebbero in `/var/lib/docker`. Il
contenuto è quello di `provisioning/docker/daemon.json`, riportato qui perché in questa
fase il repository non è ancora sulla macchina:

```
findmnt /srv/docker
install -d -m 0755 /etc/docker
cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3",
    "compress": "true"
  },
  "data-root": "/srv/docker",
  "storage-driver": "overlay2"
}
EOF
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
docker info --format '{{.DockerRootDir}} {{.Driver}} {{.LoggingDriver}}'
docker version --format '{{.Server.Version}}'
systemctl daemon-reload
systemctl enable --now docker-user-rules.service
iptables -S DOCKER-USER
```

Atteso da `docker info`: `/srv/docker overlay2 json-file`. La versione del demone va
annotata: lo stack è stato verificato su Docker 29.5.3 e 29.6.2.

- versione di Docker installata: **29.8.0**, verificata dopo il riavvio; data root
  `/srv/docker`, driver `overlay2`, log `json-file`, Swarm ancora `inactive`

Lo swarm **non** si inizializza a mano: lo fa `stack-deploy.sh` al primo deploy, e con
più indirizzi sulla macchina serve `SWARM_ADVERTISE_ADDR` (sezione 7.1).

### 5.7 Aggiornamenti automatici

Aggiornamenti di sicurezza automatici, senza riavvio automatico. Il riavvio va deciso,
non subito durante una finestra di apertura.

```
apt-get install -y unattended-upgrades
echo 'Unattended-Upgrade::Automatic-Reboot "false";' > /etc/apt/apt.conf.d/51no-reboot
apt-config dump | grep -E '^Unattended-Upgrade::Automatic-Reboot '
systemctl is-enabled unattended-upgrades
```

### 5.8 Journal persistente

Contenuto di `provisioning/systemd/journald.conf.d/10-persistent.conf`:

```
install -d -m 0755 /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/10-persistent.conf <<'EOF'
[Journal]
Storage=persistent
Compress=yes
SystemMaxUse=2G
SystemMaxFileSize=200M
SystemMaxFiles=20
MaxRetentionSec=1month
SyncIntervalSec=30s
EOF
systemctl restart systemd-journald
journalctl --disk-usage
```

Il journal sta su `/var`, volume separato da 20 GB: il tetto di 2 GB resta ampiamente
dentro.

### 5.9 Chiave per la Storage Box (facoltativa)

Solo se si aggiunge la Storage Box (sezione 3.3), che non è un prerequisito. La copia
notturna gira senza
presenza, quindi la chiave non ha passphrase: la limita il sub-account, che vede una sola
directory.

```
ssh-keygen -t ed25519 -N '' -C 'pot-tales-backup' -f /root/.ssh/storagebox
cat /root/.ssh/storagebox.pub
```

La chiave pubblica si registra sul sub-account dalla console del fornitore.

### 5.10 Riavvio di prova

L'aggiornamento della sezione 5.0, eseguito l'11 settembre, ha installato il kernel
6.8.0-139-generic, mentre è in uso il 6.8.0-138: il riavvio lo carica. Si esegue a
sincronizzazione del RAID conclusa. Un riavvio durante la sincronizzazione è sicuro,
perché la bitmap la fa riprendere dal punto raggiunto, ma allunga i tempi. La verifica di
coerenza della sezione 4.3 si lancia dopo questo riavvio.

```
reboot
```

Dopo il riavvio, tutti questi controlli devono dare l'atteso senza interventi:
`sysctl vm.max_map_count` a 1048576, TSO e GSO a `off`, `ufw status` attivo,
`iptables -S DOCKER-USER` con le regole della sezione 5.5, `docker info` con
`/srv/docker`, `journalctl --list-boots` con più di un avvio, `timedatectl` su
`Europe/Rome`, `uname -r` con il kernel aggiornato in sezione 5.0.

Oltre ai prerequisiti di sistema, prima dell'esercizio va impostata la **password
telefonica** nel Robot.

## 6. Fase 3 — DNS e certificato

È la fase dove un errore è visibile a tutti i visitatori, e dove alcuni errori non si
correggono in tempi utili. Va eseguita nell'ordine indicato.

### 6.1 Record DNS, nel pannello Aruba

I record servono **prima** del primo deploy: la verifica del dominio avviene sulla porta
80 del nome pubblico, quindi anche il certificato di prova richiede che il nome risolva
già sulla macchina. La prima stesura li collocava dopo il primo deploy, e la sequenza non
reggeva.

All'attivazione Aruba crea record predefiniti verso i propri servizi: vanno letti nel
pannello e sostituiti o rimossi.

| Tipo | Nome | Valore | TTL |
|---|---|---|---|
| A | `pot-tales.it` | `195.201.247.58` | 300, o il minimo consentito se più alto |
| A | `www.pot-tales.it` | `195.201.247.58` | come sopra, **solo se si decide di coprire `www`** |
| CAA | `pot-tales.it` | `0 issue "letsencrypt.org"` | predefinito |
| AAAA | — | nessuno; rimuovere quelli predefiniti | — |

- Il **TTL basso** è una via d'uscita: se la macchina va rifatta, il traffico si sposta
  in pochi minuti anziché in un giorno.
- **AAAA solo dopo** aver verificato che il sito risponda su IPv6. Un AAAA verso un
  indirizzo su cui nulla risponde rende il sito irraggiungibile per i client che
  preferiscono IPv6, e il sintomo compare solo su alcune reti.
- **`www` si decide adesso.** Aggiungerlo ai nomi del certificato costa nulla prima
  dell'emissione e richiede una riemissione dopo.

Verifica da rete esterna, dalla postazione:

```bash
nslookup pot-tales.it 1.1.1.1
```

- decisione su `www`: **non usato**. Si pubblica solo `pot-tales.it`; il record
  predefinito `www` di Aruba va rimosso e il certificato copre un solo nome

### 6.2 Emissione del certificato — sequenza obbligata

Il rischio da evitare non è l'avviso di certificato, che è transitorio e correggibile. È
la **combinazione fra HSTS e un certificato rotto**, che non è correggibile dal lato del
visitatore. Appena un browser riceve l'intestazione, per la durata dichiarata rifiuta il
traffico in chiaro e non lascia proseguire su un avviso di certificato. Se nel frattempo
il certificato si rompe (scaduto, nome non corrispondente, oppure Traefik che ricade sul
proprio certificato predefinito), chi è già passato dal sito trova una pagina di errore
senza uscita.

Con la modifica 9.2 la durata arriva da `HSTS_MAX_AGE`, predefinita a 0, cioè
intestazione assente. **Il rischio torna se la revisione trasferita sulla macchina
precede `de4e1073`**: in quella versione `middlewares.yml` dichiara un anno come
letterale, con `stsIncludeSubdomains: true`. Vedi sezione 7.1.

**Esito reale del primo deploy, 12 settembre.** Il file dell'host indicava la CA di
prova e HSTS era spento, ma lo stack mescolava `--configfile` e argomenti statici.
Traefik usa un solo metodo di configurazione statica: ha quindi caricato il file e
ignorato gli argomenti con CA di prova, plugin e middleware globale. La verifica
HTTP-01 è riuscita al primo tentativo e Let's Encrypt ha emesso un certificato di
produzione attendibile per il solo `pot-tales.it`, valido fino al 10 dicembre 2026.
Non si è verificato alcun errore di autorizzazione né blocco del dominio.

Da questo momento la sequenza originaria sotto è **storica e non va eseguita sulla
macchina attuale**. Il volume `pi_acme` contiene già il certificato valido: non va
cancellato, il proxy non va riavviato con la revisione difettosa e non va provocata una
seconda emissione. La correzione porta tutta la configurazione statica negli argomenti,
con un controllo automatico che vieta la ricomparsa di `--configfile`. Dopo
l'aggiornamento del repository si imposta esplicitamente la CA di produzione, si
ridistribuisce una sola volta e si verifica che Traefik riusi lo stato ACME esistente.

| Passo | `/etc/stack-deploy.env` | Esito atteso |
|---|---|---|
| 1. Primo deploy e prove | `ACME_CA_SERVER=https://acme-staging-v02.api.letsencrypt.org/directory`, `HSTS_MAX_AGE=0` | certificato di prova, avviso nel browser: atteso |
| 2. Catena completa funzionante | invariato | applicazione, dashboard e telemetria raggiungibili |
| 3. Cancellazione dello stato ACME | invariato | procedura sotto |
| 4. Passaggio a produzione | `ACME_CA_SERVER=` vuoto, `HSTS_MAX_AGE=0` | certificato attendibile |
| 5. Verifica esterna | invariato | catena valida da rete esterna e da telefono |
| 6. Solo a verifica superata | `HSTS_MAX_AGE=86400`, `HSTS_INCLUDE_SUBDOMAINS=false` | protezione reale, via d'uscita in 24 ore |
| 7. Sorveglianza del certificato | `TLS_HOST=pot-tales.it` in `/etc/stack-surveillance.env` | controllo del certificato attivo |

**Procedura storica, da non eseguire sull'installazione attuale.** Il volume `acme` sopravvive alla
ridistribuzione. Senza cancellare il file, il certificato di prova resta in cache e
continua a essere servito mentre tutto sembra a posto. Con lo stack chiamato `pi`:

```
docker service scale pi_proxy=0
rm /srv/docker/volumes/pi_acme/_data/acme.json
```

Poi si modifica `/etc/stack-deploy.env` e si riapplica lo stack con
`systemctl restart stack-deploy.service`. **`start` non basta**: l'unità è `oneshot`
con `RemainAfterExit`, e su un'unità già attiva `start` non esegue nulla. Il deploy
riporta il proxy a una replica, e Traefik ricrea il file con i permessi corretti.

Regole che non cambiano:

- **`stsPreload` resta `false` e il dominio non va mai sottoposto alla lista di
  precaricamento.** L'inserimento è compilato nei binari dei browser, la rimozione
  richiede mesi, ed è l'unica variante del problema che sopravvive alla dismissione
  della macchina.
- **`HSTS_INCLUDE_SUBDOMAINS` resta `false`.** Con l'estensione attiva, un sottodominio
  con certificato di prova eredita il blocco.
- **Prima della prima emissione, tutto il collaudo va fatto contro la directory di prova.** L'autorità limita per
  settimana i certificati con lo stesso insieme di nomi: pochi tentativi con
  configurazione sbagliata e il dominio può restare senza certificato valido per giorni.
  Sulla macchina attuale la prima emissione di produzione è già riuscita: si conserva e
  si verifica il certificato invece di tornare alla CA di prova.
- **Con `sniStrict` attivo le prove locali passano dal nome, non da `localhost`:**
  `curl -sk --resolve pot-tales.it:443:127.0.0.1 https://pot-tales.it/health`.
- **Il materiale con il QR si stampa dopo il passo 5**, mai prima.

### 6.3 Metodo di verifica del dominio

Resta la verifica sulla porta 80, configurata negli argomenti statici del servizio
`proxy` in `deploy/stack.yml`. La verifica via DNS
richiederebbe una credenziale del registrar e un componente in più, e serve solo per
certificati jolly, che qui non servono.

**La porta 80 resta aperta e non solo reindirizzata.** È il percorso su cui l'autorità
verifica il dominio. Il router di verifica ha priorità maggiore del reindirizzamento
dichiarato sull'entrypoint, quindi la richiesta di controllo non viene deviata.

### 6.4 Il rinnovo non riguarda questo esercizio

Un certificato emesso a inizio esercizio si rinnoverebbe circa due mesi dopo, a macchina
già dismessa. L'emissione va fatta bene una volta, e non serve collaudare un rinnovo che
non avverrà.

## 7. Fase 4 — Deploy e collaudo

### 7.1 Prerequisiti prima del primo deploy

**Revisione del repository sulla macchina.** Il repository su GitHub è privato: la
macchina lo raggiunge con una chiave di deploy in sola lettura, oppure lo riceve dalla
postazione (per esempio con `git bundle`). La posizione attesa dagli script è
`/srv/progetti_innovativi`. All'11 settembre:

- `origin/integrazione/infra` era a `b543eaba` alla prima verifica. Contiene i 7
  commit di infrastruttura, fra cui `70c1e9ee` (nome dei config legato al contenuto),
  `de4e1073` (autorità ACME e durata di HSTS parametriche), `506f8670` (battito del
  recapito allarmi e controllo del certificato) e i tre dei fatti di partita
  (`6ab8f3fa`, `b0505d09`, `990d96e6`); i 4 commit del frontend (`fa34e203`, `63d4d2d3`,
  `6b585322`, `73a9cb6e`), integrati con il merge `5c039227`; le correzioni della
  sezione 9.9; i test degli handler di gioco (`0d958099`) e la pipeline sul ramo
  (`16fd492a`); i 5 commit del frontend successivi, fino ad `a464426d`, integrati con
  `27d95693`; il ripristino di `frontend/package-lock.json` (`922f57d8`), che
  `a464426d` aveva cancellato; i permessi della pipeline e le correzioni dei suoi
  gate, da `08cf5d4d` a `b543eaba` (sezione 9.9, riga 17);
- dopo `b543eaba`, tre commit del frontend (ivanrossi04) fino a `5bdeb7c4`, la revisione da cui
  `develop` ha pubblicato le immagini; sopra, i 13 commit della sezione 9.10, da
  `db30956e` ad `aee6ac5c`, pushati l'11 settembre;
- in locale il merge `954513d0` di `1480e1e3` da `develop`: due scene e tre immagini del
  frontend;
- `docs/ARCHITETTURA.md`, `docs/ESERCIZIO.md` e `docs/SVILUPPO.md` sono versionati da
  `744ff603`.

La revisione usata sulla macchina deve contenere entrambi i gruppi di commit e le
correzioni. Verifica sulla macchina prima del primo deploy:

```
cd /srv/progetti_innovativi
for c in 70c1e9ee de4e1073 506f8670 990d96e6 73a9cb6e 4a90a583 922f57d8 b543eaba 5bdeb7c4 db30956e 811ad514 aee6ac5c; do git merge-base --is-ancestor $c HEAD && echo "ok $c" || echo "MANCA $c"; done
```

**Immagini.** `stack-deploy.sh` rifiuta immagini non riferite per digest, e i digest
esistono solo per immagini pubblicate su un registry. La pipeline pubblica su GHCR solo
per i push su `main` e `develop` (`ci.yml`, lavoro `publish-images`) e riporta i digest
nel riepilogo dell'esecuzione. L'immagine del backend deve provenire da una revisione
con i commit dei fatti di partita, altrimenti il dataset `gioco.partita` resta vuoto, e
con `db30956e` e `811ad514`: senza il primo le sessioni scadono a partita in corso,
senza il secondo un arresto può chiudere una partita senza conclusione (sezione 9.10).
Le immagini pubblicate da `develop` su `5bdeb7c4` non contengono nessuno dei due.
Quella del frontend deve contenere `aee6ac5c`: senza, oltre la soglia sulla creazione di
sessioni nessun visitatore ne ottiene una.
Quella del frontend deve contenere i commit del frontend presenti sul remoto.

**Immagini pubblicate l'11 settembre da `954513d0`.** La pipeline `34650660800` è
verde e le tre immagini sono state scaricate con successo sulla macchina:

```
SERVER_IMAGE=ghcr.io/subnetmusk/progetti_innovativi/server@sha256:496041a31458f291f6ca86cbb689cbc12b56b53b8ef22fc8170164e0eaba6fc2
FRONTEND_IMAGE=ghcr.io/subnetmusk/progetti_innovativi/frontend@sha256:923bf8b00f9ddff7799f2e349fcf2fea5332187ffba0617fbfe84403665a9463
LANDING_IMAGE=ghcr.io/subnetmusk/progetti_innovativi/landing@sha256:e7f0fcd5a855f8966905d5036d79127c5059e824901835f714ed3bb8c76d556a
```

Il repository è clonato come `admin` in `/srv/progetti_innovativi`, ramo `develop`.
Il primo deploy è partito da `954513d0eb7f5e82356cd634a014b3e6074a885d`; il 12
settembre un aggiornamento manuale lo ha portato in fast-forward a
`8af699d26ebb61a318479445914cc533228ab20d`, poi applicato per correggere Traefik. Il
remoto HTTPS viene aggiornato solo manualmente: non sono installati timer, webhook o
processi di sincronizzazione. Le immagini restano ancorate ai digest pubblicati da
`954513d0` finché una nuova pipeline non pubblica gli artefatti del presente
aggiornamento e l'operatore non sostituisce manualmente i digest nell'ambiente.

I dieci segreti automatici sono stati generati sulla macchina e la seconda esecuzione
idempotente li ha lasciati invariati. Gli elenchi delle dashboard sono completi:
`esercizio` in `dashboard_users_esercizio`, `evento` in `dashboard_users_evento` e
entrambi in `dashboard_users`; tutti i file sono `root:root` a modo `0400`.

**Gate di copertura.** In `ci.yml` il lavoro `publish-images` dipende da `backend`,
che esegue `go-cover-full`. L'11 settembre la copertura era scesa a 79,6% contro un
pavimento dell'85% (sezione 9.9), e un push su `develop` non avrebbe pubblicato immagini.
Con i test degli handler di gioco e della chiusura differita (`0d958099`) misura 89,7%,
e 90,0% su `811ad514`.
Da `16fd492a` la pipeline gira anche sui push a `integrazione/infra`, ma senza
pubblicare: i digest arrivano solo da `main` e `develop`.

I package di un repository privato sono privati, quindi la macchina si autentica su GHCR
come root, con un token limitato a `read:packages`:

```
docker login ghcr.io -u <utente-github>
```

`stack-deploy.sh` usa già `--with-registry-auth`. Il token va revocato alla dismissione,
insieme alle altre credenziali elencate in `docs/ESERCIZIO.md`, sezione 10.

**Correzioni al repository.** Quelle della sezione 9.9 sono applicate e pushate
(`4a90a583`); quelle della sezione 9.10 sono pushate, da `db30956e` ad `aee6ac5c`.
Le verifiche che richiedono la macchina sono al punto 7 della sezione 7.2.

**`/etc/stack-deploy.env`**, a partire dal modello in `provisioning/systemd/`:

| Variabile | Valore per il primo deploy |
|---|---|
| `STACK_DIR` | `/srv/progetti_innovativi/deploy` |
| `STACK_NAME` | `pi` |
| `APP_HOST` | `pot-tales.it` |
| `ACME_EMAIL` | recapito del referente tecnico |
| `ACME_CA_SERVER` | `https://acme-staging-v02.api.letsencrypt.org/directory`. **Vuota significa produzione** |
| `HSTS_MAX_AGE` | `0` |
| `HSTS_INCLUDE_SUBDOMAINS` | `false` |
| `SERVER_IMAGE`, `FRONTEND_IMAGE`, `LANDING_IMAGE` | `ghcr.io/...@sha256:...` dal riepilogo della pipeline |
| `SWARM_ADVERTISE_ADDR` | `195.201.247.58`: la macchina ha anche un indirizzo IPv6 |
| `ES_DATA_DIR` | `/srv/data/elastic`, il valore del modello. La directory va portata a `1000:0` prima del deploy (sezione 9.3) |

`TRAEFIK_SNI_STRICT` non fa parte del modello e non va impostata. Dal commit `2cedc1bb`
`stack-deploy.sh` esporta ogni variabile del file, come fa l'unità systemd, quindi il
deploy si comporta allo stesso modo avviato dall'unità o a mano. Con il dominio già
attivo il collaudo usa il certificato di prova, e disattivare `sniStrict` non serve.

**`/etc/stack-surveillance.env`**, valori specifici di questa macchina:

| Variabile | Valore |
|---|---|
| `HEALTH_CONNECT` | `127.0.0.1`, il valore del modello. `HEALTH_URL` non esiste più (`3e9509fc`): il battito legge `APP_HOST` da `/etc/stack-deploy.env` e interroga `https://pot-tales.it/health` con `--resolve pot-tales.it:443:127.0.0.1`, senza verificare il certificato. Con il certificato di prova il battito va quindi in verde appena il backend risponde; la validità del certificato resta al controllo di `TLS_HOST` |
| `ES_NETWORK` | `pi_elastic` |
| `ES_CA` | `/srv/docker/volumes/pi_certs/_data/ca/ca.crt`, il valore del modello da `68532fda` |
| `TLS_HOST` | vuota fino al passo 7 della sezione 6.2 |
| `DISK_MOUNTS` | `"/ /var /srv/docker /srv/data/elastic /srv/backup /srv/export"`, **tra virgolette**: il valore del modello da `68532fda` |

**`/etc/stack-data.env`:** `VG_NAME=vg0` ed `ES_CA` come sopra, già valori del modello da
`68532fda`. `LV_DOCKER=docker`, `BACKUP_DEST=/srv/backup` ed `EXPORT_DEST=/srv/export`
coincidono con il layout. `EXPORT_KEEP=2` e `SNAP_SIZE=16G` sono i valori del modello,
dimensionati sullo stesso layout (sezione 9.5).

### 7.2 Sequenza

Da qui il percorso coincide con il piano principale, sezione 11, gruppo 8, e con
`docs/ESERCIZIO.md`, sezioni 4 e 5.

**Stato al 12 settembre.** I punti 1–4 sono completati. Del punto 5 sono verificati la
convergenza dello stack, il setup Elastic, il bootstrap Fleet, tutti i servizi
persistenti a `1/1`, il riuso del certificato e `/health` a 200. Il limite originario
di 512 MiB dell'`infra-agent` ha prodotto OOM di cgroup; dopo il riavvio ha raggiunto
`1/1`, ma la correzione stabile è il limite da 1 GiB della sezione 9.5, ancora da
pubblicare e applicare. Restano i controlli distruttivi o operativi del punto 7, il load
test, i ripristini, la prima copia, il riavvio non presidiato, HSTS e la verifica esterna
finale. `stack-deploy.service` resta disabilitata e inattiva nel frattempo.

1. Repository in `/srv/progetti_innovativi` con la revisione verificata in 7.1,
   generazione dei segreti con `provisioning/bin/generate-secrets.sh`, che produce anche
   `gameplay_id_salt`, `filebeat_writer_password` e `pow_secret` (sezioni 9.9 e 9.10). È idempotente: se i
   segreti fossero stati generati con una revisione precedente, rilanciarlo aggiunge solo
   i mancanti. Directory degli
   indici con il volume montato: `chown 1000:0 /srv/data/elastic` e
   `chmod 2770 /srv/data/elastic` (sezione 9.3), altrimenti `stack-deploy.sh` rifiuta il
   deploy.
2. File di `/etc` compilati come in 7.1.
3. Record DNS della sezione 6.1 e loro verifica da rete esterna.
4. Installazione delle unità di `provisioning/` **solo ora**, con `ACME_CA_SERVER`
   già puntata alla directory di prova. Le unità di rete scritte a mano in 5.4 e 5.5 si
   sostituiscono con i template del repository, **non ancora provati sulla macchina**:
   ```
   systemctl disable --now nic-offload.service docker-user-rules.service
   rm /etc/systemd/system/nic-offload.service /etc/systemd/system/docker-user-rules.service /usr/local/sbin/docker-user-rules.sh
   systemctl daemon-reload
   systemctl enable --now nic-offload@enp0s31f6.service docker-user-rules@enp0s31f6.service
   ethtool -k enp0s31f6 | grep -E '^(tcp-segmentation-offload|generic-segmentation-offload):'
   iptables -S DOCKER-USER; ip6tables -S DOCKER-USER
   ```
   Poi la prova della porta 8080 dalla postazione, come in 5.5, e le stesse letture dopo
   il riavvio del punto 11. Primo deploy con `systemctl start stack-deploy.service`:
   `start` vale solo per il primo avvio, per riapplicare si usa `restart`.
5. **Verifica a stack acceso**, che il piano principale segnala come la categoria di
   controllo che ha trovato più difetti e che a oggi non è stata eseguita sullo stack
   unificato. Non è una formalità e non va compressa perché le fasi precedenti sono
   andate lisce.
6. Verifica che l'indirizzo di provenienza arrivi corretto al backend: le porte sono
   pubblicate in `mode: host` proprio per questo.
7. Verifiche delle correzioni della sezione 9.9 possibili solo sulla macchina:
   - **Filebeat (punto 1):** il montaggio punta a `/srv/docker/containers` e i log dei
     contenitori arrivano in Kibana.
     `docker service inspect pi_filebeat --format '{{json .Spec.TaskTemplate.ContainerSpec.Mounts}}'`
   - **WiredTiger (punto 8):** 1610612736 byte, cioè 1,5 GiB (sezione 9.5).
     `docker exec $(docker ps -qf name=pi_db) sh -c 'mongosh --quiet -u root -p "$(cat /run/secrets/mongo_root_password)" --authenticationDatabase admin --eval "db.serverStatus().wiredTiger.cache[\"maximum bytes configured\"]"'`
   - **Indici (punto 9):** `docker volume inspect pi_esdata01 --format '{{json .Options}}'`
     con `device` a `/srv/data/elastic`; in quella directory le cartelle di
     Elasticsearch con uid 1000; lo spazio occupato cresce su `/srv/data/elastic` e non
     su `/srv/docker`.
   - **Battito (punti 3 e 4):** `sudo /usr/local/bin/stack-heartbeat.sh; echo $?` esce
     con 0 a stack sano. Con `docker service scale pi_server=0` deve uscire con 1 e
     `applicazione-irraggiungibile-http-...`; poi `docker service scale pi_server=1`. Le
     notifiche di `stack-liveness` sono ancora spente, quindi il guasto provocato non
     sveglia nessuno. Il comando dei "Primi trenta secondi" di `docs/ESERCIZIO.md`
     risponde 200, e `curl -sk https://localhost/` fallisce l'handshake.
   - **`DISK_MOUNTS` letto da systemd (punto 5):** la lettura da bash è provata in
     contenitore, quella di systemd no.
     `systemd-run --quiet --pipe --wait -p EnvironmentFile=/etc/stack-surveillance.env /usr/bin/printenv DISK_MOUNTS`
     deve stampare l'elenco senza virgolette.
   - **Snapshot (punto 6):** `/usr/local/bin/data-backup.sh --solo-snapshot` crea
     `docker-snap-...` in `vg0` (`lvs vg0`).
   - **`sniStrict` e avvio a mano (punto 14):**
     `docker service inspect pi_proxy --format '{{json .Spec.TaskTemplate.ContainerSpec.Env}}'`
     contiene `TRAEFIK_SNI_STRICT=true`, e un deploy lanciato con `make stack-deploy`
     produce lo stesso ambiente dell'unità.
   - **Riapplicazione (punto 7):** dopo una modifica a `/etc/stack-deploy.env`,
     `systemctl restart stack-deploy.service` registra un nuovo deploy nel journal.
   - **Contatori SMART (punto 12):** il ciclo della vigilia (`docs/ESERCIZIO.md`,
     sezione 7) riporta i due seriali con i valori di riferimento.
   - **Redis:** una connessione senza credenziali riceve `NOAUTH`.
     `docker exec $(docker ps -qf name=pi_redis) redis-cli ping`
   - **Filebeat con l'utenza dedicata:** dopo `fleet-bootstrap.service`, documenti recenti
     in `filebeat-*` e nessun 401 o 403 nei log del servizio.
   - **CrowdSec:** `docker exec $(docker ps -qf name=pi_crowdsec) cscli bouncers list`
     elenca `key_traefik`, con un prelievo recente.
   - **Secret legati al contenuto:** `docker secret ls` mostra nomi con l'impronta. Dopo una
     modifica a un file di `secrets/` e `systemctl restart stack-deploy.service`, il
     secret precedente non compare più.
8. Load test e taratura delle soglie, oggi dichiarate provvisorie. Durante il test:
   `dmesg` senza blocchi della scheda di rete, temperature dei dischi sotto la soglia di
   avviso (sezione 4.3).
9. Prova dei tre percorsi di ripristino con misurazione dei tempi.
10. Prima copia notturna, prelievo dell'archivio portabile e delle esportazioni sulla
    postazione e loro rilettura (sezione 9.6).
11. Prova di riavvio della macchina: lo stack deve tornare su da solo, senza interventi.
12. Passaggio a produzione e attivazione di HSTS secondo la sequenza in 6.2.

## 8. Decisione: uno o due hostname

Con un dominio proprio cade il vincolo dell'hostname singolo, imposto dal dipartimento,
e con esso il rischio di origine condivisa registrato in sezione 6 del piano principale:
applicazione pubblica e dashboard sulla stessa origine significano che una XSS
nell'applicazione potrebbe chiamare le dashboard con le credenziali allegate
automaticamente dal browser.

Il piano principale classifica quel rischio come basso in pratica, perché il gioco è un
canvas con superficie DOM minima e le postazioni pubbliche sono distinte dalla macchina
di amministrazione.

**Raccomandazione: mantenere l'hostname singolo `pot-tales.it`.** La separazione costa
nomi alternativi nel certificato, router aggiuntivi, una riconfigurazione di Kibana e
altra superficie da collaudare, contro un rischio che resta basso. La decisione va
registrata prima dell'emissione del certificato, insieme a quella su `www`
(sezione 6.1): aggiungere un nome dopo richiede una riemissione.

## 9. Modifiche al repository

### 9.1 Scelta dell'autorità di certificazione — fatto (2 settembre)

La configurazione statica di Traefik non espande le variabili d'ambiente, quindi la
directory dell'autorità arriva come argomento del processo.

| File | Intervento |
|---|---|
| `deploy/stack.yml` | argomento `--certificatesresolvers.principale.acme.caserver=${ACME_CA_SERVER:-...}` accanto a quello del recapito |
| `provisioning/systemd/stack-deploy.env.example` | `ACME_CA_SERVER` documentata, con la produzione come comportamento predefinito |
| `provisioning/bin/stack-deploy.sh` | variabile esportata verso l'interpolazione |

Il valore predefinito è dichiarato in `stack.yml` e non nello script: un argomento
`caserver=` interpolato a vuoto non equivale a "predefinito" e romperebbe il resolver.

### 9.2 Durata di HSTS parametrizzata — fatto (2 settembre)

Misurato su Docker 29.6.2: i `configs` di Swarm sono immutabili. Modificare il contenuto
di un file mantenendo lo stesso nome non produce un aggiornamento: il demone risponde
`only updates to Labels are allowed`, il deploy esce con codice 1 e i contenitori restano
montati sul contenuto precedente. `--prune` non rimuove i config sostituiti, e
`docker config rm` rifiuta quelli in uso.

Due meccanismi, perché risolvono problemi diversi:

- **Revisione nel nome del config.** Ogni dichiarazione in `stack.yml` porta
  `name: ${STACK_NAME}_<nome>_${CFG_REV_<NOME>}`, con la revisione calcolata da
  `stack-deploy.sh` come impronta del file.
- **Parametri a variabile d'ambiente.** `stsSeconds` e `stsIncludeSubdomains` sono
  passati come `{{ env "..." }}`: cambiare la durata di HSTS non richiede di toccare
  alcun file, quindi niente revisione nuova e niente riavvio del proxy.

Verificato su Traefik 3.7.10 caricando il file reale: con la variabile non impostata il
campo resta assente e l'intestazione non viene emessa. Una configurazione incompleta
produce HSTS mancante, mai HSTS attivo con un certificato non verificato.

### 9.3 Indici su filesystem dedicato — fatto (11 settembre, `febfa613`)

Solo per Elasticsearch. MongoDB resta sul volume Docker nominato, per le ragioni della
sezione 4.2. In `deploy/stack.yml`:

```yaml
volumes:
  esdata01:
    driver_opts:
      type: none
      device: /srv/data/elastic
      o: bind
```

La directory esiste già come punto di montaggio del volume logico `elastic`, ma
l'immagine di Elasticsearch gira con uid 1000 e gid 0: la proprietà va assegnata prima
del deploy, altrimenti il processo non scrive e resta in riavvio ciclico.

```
chown 1000:0 /srv/data/elastic
chmod 2770 /srv/data/elastic
```

Senza questa modifica gli indici finiscono in `/srv/docker`, 60 GB condivisi con
MongoDB, contro un budget indici di 70 GB, e il volume `elastic` resta vuoto.

**Applicazione.** Il bind è parametrizzato su `ES_DATA_DIR`, predefinita
`/srv/data/elastic`, e `stack-deploy.sh` rifiuta il deploy se la directory manca o non
appartiene a `1000:0`, con il comando di correzione nel messaggio. Il controllo coglie
anche il volume logico non montato, perché la directory sottostante resta di root.
Verificato in contenitore che Elasticsearch 8.19.19 parte su una directory `1000:0`,
modo `2770`, con `lost+found` di root. Le opzioni di un volume valgono alla creazione:
un `pi_esdata01` già esistente resterebbe com'è, ma sulla macchina non ne esiste ancora
nessuno. Lo snapshot LVM del volume `docker` non comprende più gli indici, e
`provisioning/README.md` e `data-backup.sh` lo dicono.

### 9.4 Strumento di creazione dei volumi — non applicabile, marcato (`68532fda`)

Il layout è stato definito in installazione, quindi `provisioning/bin/setup-volumes.sh`
non si applica a questa macchina e **non va eseguito**: presuppone `ubuntu-vg`, crea
volumi con altri nomi e li formatta. Lo dicono il suo commento e `provisioning/README.md`.

### 9.5 Budget delle risorse — applicato

I tetti in `deploy/stack.yml` restano come contenimento e **non vanno rimossi**: senza
tetto decide il kernel, che sceglie il processo più grosso, cioè Elasticsearch.

Dimensionati sui 64 GB (sezione 9.9):

| Servizio | Prima | Ora |
|---|---|---|
| Elasticsearch | heap 1g, limite 2G | heap 4g, limite 12G, riserva 4G. L'heap è il predefinito di `ES_JAVA_OPTS`, sovrascrivibile da `/etc/stack-deploy.env` |
| MongoDB | cache WiredTiger 0,5 GB, limite 2G | cache 1,5 GB, limite 4G, riserva 1G. Verificato con `mongo:8.2.12` e `--memory 4g`: 1,5 GiB configurati |
| Kibana | — | limite 2G, riserva 1G |
| APM agent | limite 1G, riserva 256M | limite 2G, riserva 256M: margine per intake RUM e componenti della policy senza contendere memoria all'agente di infrastruttura |
| Infra agent | limite 512M, riserva 128M, CPU 0,5 | limite 1G, riserva 256M, CPU 1. Il limite precedente ha causato ripetuti OOM di cgroup durante l'avvio; la nuova soglia lascia margine rispetto ai circa 340–510 MiB osservati |

La somma dei limiti è circa 25,4 GB durante il job di setup e 24,9 GB a regime. Il resto
va al sistema e alla cache dei file, di cui Elasticsearch si serve fuori dall'heap. La
somma dei limiti CPU è volutamente superiore agli otto thread: sono tetti concorrenti,
non prenotazioni; il load test deve comunque verificare la contesa reale.

Disco, sul layout della sezione 4.2:

- `EXPORT_KEEP=2`: il volume `export` è di 30 GB;
- `SNAP_SIZE=16G`: durante lo snapshot i log dei contenitori continuano a scrivere sul
  volume `docker`, e 8 GB lasciavano poco margine. Tre snapshot usano 48 dei 165,81 GiB
  non allocati;
- indici su un volume da 120 GB, sopra i 70 GB su cui era dimensionata la ritenzione
  ILM, che resta a 30 giorni. Se il volume si riempie, si estende a caldo dallo spazio
  non allocato (`docs/ESERCIZIO.md`, "Il disco si riempie").

Il load test misura questa configurazione, che è quella che andrà in esercizio.

### 9.6 Copia off-host — non è un prerequisito

La Storage Box non è stata ordinata e il repository non la presuppone. Contro la perdita
della macchina la copertura dichiarata è il prelievo, dalla postazione, dell'archivio
portabile prodotto da `provisioning/bin/data-backup.sh` e delle esportazioni: così
l'intestazione dello script e `provisioning/README.md` (sezione 9.9, punto 11). Il
prelievo richiede presenza, quindi la finestra fra un prelievo e il successivo resta
scoperta.

Se in seguito si aggiunge la Storage Box in HEL1 (sezione 3.3), la sincronizzazione
dell'archivio diventa un passo in più di `data-backup.sh`, con la chiave della sezione
5.9, e la finestra si chiude senza presenza.

### 9.7 Documentazione

`docs/infra/richiesta_vm.txt` descrive il percorso non adottato. Resta come riferimento
finché non viene deciso diversamente, e non descrive l'ambiente reale.

### 9.8 Il modulo Terraform per il cloud non è riutilizzabile

Il modulo di provisioning Hetzner rimosso con `9ba6acba` era scritto per il provider
`hcloud`, cioè per istanze virtuali Hetzner Cloud. La macchina di questo piano è
dedicata, installata dal sistema di ripristino con `installimage`, e non è esposta da
quel provider. Non va riesumato.

### 9.9 Difetti rilevati nella verifica dell'11 settembre — corretti l'11 settembre

Rilevati confrontando script, stack e layout reale della macchina. Tutti corretti l'11
settembre e pushati su `origin/integrazione/infra` a `4a90a583`: l'esito, con i commit,
è nella tabella che segue questa. Il punto 11 non richiede più una destinazione remota
(sezione 9.6, `1dd7d645`). La seconda verifica è nella sezione 9.10.

| # | Dove | Difetto | Effetto | Correzione |
|---|---|---|---|---|
| 1 | `deploy/stack.yml`, servizio `filebeat` | monta `/var/lib/docker/containers`, ma `daemon.json` sposta i dati Docker in `/srv/docker` | nessun log di container raccolto, senza errori | sorgente del montaggio `/srv/docker/containers`; destinazione e `filebeat.yml` invariati |
| 2 | `stack-surveillance.env.example` e `stack-data.env.example`, `ES_CA` | punta a `/srv/docker/volumes/certs/...`, ma lo stack crea il volume come `pi_certs` | battito, recapito allarmi ed esportazione non verificano il certificato del cluster: cluster sempre irraggiungibile e allarme permanente | `/srv/docker/volumes/pi_certs/_data/ca/ca.crt` |
| 3 | `stack-heartbeat.sh` e `stack-surveillance.env.example`, `HEALTH_URL` | predefinito `http://localhost/health`. L'entrypoint `web` reindirizza ogni richiesta, e tutti i router richiedono `Host(APP_HOST)` | il controllo di vitalità non interroga il backend: l'esito dipende dalla risposta di reindirizzamento di Traefik, non dallo stato dell'applicazione | `https://pot-tales.it/health` nel file compilato; valore predefinito e modello da allineare |
| 4 | `docs/ESERCIZIO.md`, "Primi trenta secondi" | `curl -sk https://localhost/health` | con `sniStrict` attivo l'handshake per `localhost` viene rifiutato | `curl -sk --resolve pot-tales.it:443:127.0.0.1 https://pot-tales.it/health` |
| 5 | `stack-surveillance.env.example`, `DISK_MOUNTS` | valore con spazi senza virgolette | gli script leggono il file anche con `.` di bash: la riga esegue `/srv/docker` come comando e non assegna la variabile. Oggi il risultato coincide per caso con il predefinito, con più punti di montaggio no | valore tra virgolette |
| 6 | `stack-data.env.example`, `VG_NAME` | `ubuntu-vg` | snapshot LVM non creabile: guasto dichiarato a ogni copia notturna | `vg0` nel file compilato |
| 7 | `docs/ESERCIZIO.md` ("Il sito non risponde") e `provisioning/README.md` | `systemctl start stack-deploy.service` per riapplicare lo stack | unità `oneshot` con `RemainAfterExit=true`: se già attiva, `start` non esegue nulla | `systemctl restart stack-deploy.service` per riapplicare; `start` resta corretto solo per il primo avvio |
| 8 | `deploy/stack.yml`, servizio `db` | nessun limite alla cache WiredTiger, richiesto dalla sezione 2 del piano principale | se `mongod` non ricava il limite dal cgroup, la cache si dimensiona sui 64 GB dell'host contro un limite di 2 GB del contenitore | verificare a stack acceso `db.serverStatus().wiredTiger.cache["maximum bytes configured"]`; se supera il limite, impostare `--wiredTigerCacheSizeGB` |
| 9 | `deploy/stack.yml`, volume `esdata01` | volume nominato sotto `/srv/docker` | sezione 9.3 | sezione 9.3 |
| 10 | `provisioning/` | mancano l'unità per TSO e GSO e le regole `DOCKER-USER` della sezione 5 | configurazione dell'host non riproducibile dal repository | aggiungere unità e script della sezione 5 |
| 11 | intestazione di `data-backup.sh`, `provisioning/README.md` | la perdita della macchina è affidata agli "snapshot della VM lato infrastruttura" | su una macchina dedicata non esistono | rinvio alla copia sulla Storage Box, sezione 9.6 |
| 12 | `docs/ESERCIZIO.md`, sezione 7 | la vigilia non prevede la lettura dei contatori SMART, a cui la sezione 4.1 affida il controllo dei dischi | un peggioramento dei dischi fra un'apertura e l'altra passa inosservato | aggiungere la lettura di `Media and Data Integrity Errors` ed `Error Information Log Entries` **per seriale**, non per nome del dispositivo, con i valori di riferimento della sezione 4.1: Toshiba `Y67S105STUHV` 0, Samsung `S3W8NB0K413381` 3 |
| 13 | `docs/ESERCIZIO.md`, sezione 3, e piano principale, sezione 10 | `vm.max_map_count=262144` da scrivere in `/etc/sysctl.d/` | su Ubuntu 24.04 il valore predefinito è 1048576: scriverne uno più basso in `/etc` lo riduce | requisito espresso come minimo, sezione 5.3 |

**Esito delle correzioni.** Verifiche eseguite fuori dalla macchina, su Docker 29.6.2 in
locale. Quelle che richiedono la macchina sono al punto 7 della sezione 7.2.

| # | Commit | Correzione applicata | Verifica eseguita |
|---|---|---|---|
| 1 | `835076aa` | sorgente `${DOCKER_ROOT_DIR:-/srv/docker}/containers`; `stack-deploy.sh` ricava `DOCKER_ROOT_DIR` da `docker info` | `make stack-config`: `/srv/docker/containers`; `stack-deploy.sh` in contenitore: il valore del demone |
| 2 | `68532fda` | `ES_CA` su `pi_certs` in entrambi i modelli | modelli letti con `.` di bash |
| 3 | `3e9509fc` | `HEALTH_URL` rimossa: `APP_HOST` letto da `/etc/stack-deploy.env`, `curl --insecure --resolve APP_HOST:443:HEALTH_CONNECT`, esito positivo solo con HTTP 200 e `"server":true` | banco con Traefik 3.7.10 e `sniStrict`: servizio sano, dipendenza degradata, backend fermo (HTTP 502), nome assente, nome non servito, certificato non attendibile. A backend fermo lo script precedente mandava un ping di successo |
| 4 | `3e9509fc` | forma con `--resolve`, con `APP_HOST` letto dal file | stesso banco: `https://localhost` rifiutato (curl 35), `--resolve` risponde 200 |
| 5 | `68532fda` | valore tra virgolette, con `/srv/data/elastic` fra i punti sorvegliati; regola spiegata in tutti e tre i modelli | lettura con `.`: i modelli nuovi senza errori, il precedente non assegnava la variabile. Lettura da systemd non provata |
| 6 | `68532fda` | `VG_NAME=vg0` nel modello e come predefinito di `data-backup.sh`; `setup-volumes.sh` marcato non applicabile | lettura dei modelli |
| 7 | `8d15677c` | `restart` per riapplicare, in `ESERCIZIO.md` e `provisioning/README.md`. Stesso difetto e stessa correzione per `fleet-bootstrap.service` | — |
| 8 | `54aa1f9e` | `command: ["mongod", "--wiredTigerCacheSizeGB", "0.5"]`, la formula predefinita di MongoDB applicata al limite di 2G. Da `4750bd5e` 1,5 con limite 4G (sezione 9.5) | `mongo:8.2.12` con `--memory 2g`: 536870912 byte, inizializzazione eseguita. Senza flag lo stesso valore, ricavato dal cgroup; senza limite 3,35 GB. Con `--memory 4g` e 1,5: 1,5 GiB |
| 9 | `febfa613` | sezione 9.3 | `stack-deploy.sh` in contenitore: rifiuto con directory assente e con directory di root, deploy con `1000:0`. Elasticsearch 8.19.19 su `1000:0` con `lost+found` |
| 10 | `9d058280` | `nic-offload@.service`, `docker-user-rules@.service`, `bin/docker-user-rules.sh` | `systemd-analyze verify` con systemd 255; regole applicate due volte in contenitore, IPv4 e IPv6, senza duplicati. **Non provate sulla macchina** |
| 11 | `8d15677c`, `1dd7d645` | rimando alla copia su Storage Box, dichiarata non ancora automatizzata; da `1dd7d645` copertura affidata al prelievo dell'archivio portabile e delle esportazioni, con la Storage Box facoltativa (sezione 9.6) | — |
| 12 | `8d15677c` | lettura per seriale nella vigilia, valori di riferimento e soglie di temperatura per seriale | — |
| 13 | `8d15677c` | `ESERCIZIO.md`, sezione 3: minimo 262144, valore in uso reso esplicito senza abbassarlo. Piano principale, sezione 10: corretto in locale | — |
| 14 | `2cedc1bb` | `TRAEFIK_SNI_STRICT` e gli altri parametri di `stack.yml` avevano effetto solo dall'unità systemd: il file ora si legge con `set -a` | `stack-deploy.sh` in contenitore, avviato a mano con `TRAEFIK_SNI_STRICT=false`: `"false"`; lo script precedente produceva `"true"` |
| 15 | `febfa613`, `8d15677c` | documenti allineati alla 9.3: lo snapshot LVM non comprende più gli indici, sezione 2 di `ESERCIZIO.md`, layout in `provisioning/README.md` | — |
| 16 | `4a90a583` | `TestPosizioneRestituisceLoStatoIniziale` decodificava come mappa di stringhe una risposta che dal commit `b42440de` contiene l'array `checkpoints`. Rotto dal merge `1c6d2298` e mai segnalato, perché la CI esegue l'integrazione solo su `main` e `develop` | `make go-test-integration` verde |
| 17 | `16fd492a` | la pipeline non girava su `integrazione/infra`, e il difetto della riga 16 è rimasto dieci giorni senza segnalazioni. Il ramo esegue ora tutte le verifiche; `publish-images` resta limitato ai push su `main` e `develop` | `make lint-workflows` verde. Prima esecuzione sul ramo (`34610825790`, su `922f57d8`): tutti i lavori fermi al checkout con "Repository not found". Il token aveva solo `Metadata: read`: `permissions: {}`, introdotto da `91ad2bf0` e mai eseguito prima, senza `contents: read` nei lavori, in un repository privato. `develop` ha un altro `ci.yml`, con `contents: read`, e al passaggio si sarebbe rotto allo stesso modo. Correzione: `contents: read` nei cinque lavori di verifica (`08cf5d4d`, pushato). Nell'esecuzione `34611309300` il checkout riesce ovunque, frontend e analisi statica sono verdi. Falliscono tre gate mai eseguiti prima su questo ramo: `go-build` (timbro VCS su un checkout di altro proprietario), `scan-deps-go` (5 vulnerabilità della libreria standard di Go 1.26.5) e `scan-images` (libssl3, libexpat e libuuid nelle immagini di base; Go 1.26.5 e `x/crypto` 0.52.0 nel binario). Corretti con `7322b6b9` (`go-build` con `-buildvcs=false`), `fbda9cba` (Go 1.26.6 e `x/crypto` 0.55.0 in Makefile, Dockerfile e test di integrazione) e `ba84b1ac` (`apk upgrade --no-cache` nello stadio finale dei tre Dockerfile, deroga deliberata al fissare tutto). In locale: govulncheck senza vulnerabilità raggiungibili, trivy a 0 HIGH e CRITICAL sulle tre immagini, `make runtime-check` con 15 controlli su 15. Poi `f0ad8869` (digest ricostruito di nginx per `export`, frontend e landing: il servizio `export` usa l'immagine senza `apk upgrade` e conserva le vulnerabilità residue della base) e `b543eaba` (`scan-images` analizza tutte le immagini prima di fallire). Pushato fino a `b543eaba`: nell'esecuzione `34615868486` tutti i lavori sono verdi (backend con integrazione e copertura, frontend, analisi statica, sicurezza, runtime), e `publish-images` è saltato come previsto sul ramo |
| 18 | `922f57d8` | `a464426d` (frontend, ivanrossi04) cancellava `frontend/package-lock.json` senza toccare `package.json`: `npm ci` rifiutava l'installazione, e con esso typecheck, build e immagine del frontend. Ripristinato com'era in `4a90a583`, su decisione del referente dell'infrastruttura | su `922f57d8`: `make frontend-typecheck`, `make frontend-build`, `make image-frontend` e `make verify-fast` verdi |

**Verifiche complessive su `4a90a583`.** `make -k verify`: verdi tutti i target tranne
`go-cover-full`, compresi lint, Terraform, workflow, integrazione e `scan-secrets`.
`make stack-config` e `make lint-stack` con un file di ambiente realistico: verdi. Prima
delle correzioni, sul merge `5c039227`: `make verify-fast`, `make frontend-typecheck` e
`make frontend-build` verdi.

**Copertura sotto il pavimento — corretto l'11 settembre (`0d958099`).** `make
go-cover-full` misurava 79,6% contro un pavimento dell'85%: erano a 0% `handlePing`,
`handleCheckpoint`, `handleReset` e `AddCheckpoint`, introdotte da `b42440de` e ampliate
da `990d96e6`, e `AvviaChiusuraSessioni`, da `b0505d09`, perché nessun test le
esercitava. Su `develop` il gate avrebbe fermato `publish-images` (sezione 7.1). Le
prove aggiunte le esercitano su basi dati reali e verificano stato persistito e fatti di
partita; la copertura misura 89,7% e `make verify` è verde per intero. Tre modifiche
deliberate al codice (prefisso non citato in `AddCheckpoint`, transizione di scena
sempre vera, soglia di inattività tolta dalla spazzata) fanno fallire ciascuna la prova
corrispondente.

### 9.10 Seconda verifica dell'11 settembre — corretta e pushata

Dopo l'integrazione di `develop` fino a `5bdeb7c4`. Tredici commit sopra `5bdeb7c4`,
verificati su Docker 29.6.2 e pushati fino ad `aee6ac5c`; le verifiche possibili solo
sulla macchina sono al punto 7 della sezione 7.2.

| # | Commit | Difetto | Correzione e verifica |
|---|---|---|---|
| 19 | `db30956e` | la via rapida di `ValidateSession` non prolungava mai la sessione, che da `b4cfb1ba` nasce con 5 minuti: ping, traguardi e validazione rispondevano 401 a partita in corso ("si sono rotti i salvataggi") | rinnovo sotto metà della durata piena. Immagine reale con `SESSION_UNUSED_TTL_MIN=1`: prima 401 da 60 s, dopo 200 fino a 91 s. Test di integrazione che fallisce sul codice precedente |
| 20 | `1dd7d645` | la copertura della perdita della macchina rimandava a uno spazio remoto non disponibile | prelievo dell'archivio portabile e delle esportazioni; Storage Box facoltativa (sezione 9.6) |
| 21 | `4750bd5e` | tetti tarati su 16 GB | sezione 9.5; cache WiredTiger misurata a 1,5 GiB con `--memory 4g` |
| 22 | `57ac1663` | `GAMEPLAY_ID_SALT` vuota per default: le partite a cavallo di un riavvio contate due volte | secret `gameplay_id_salt`, esportato dall'entrypoint al solo processo del backend |
| 23 | `919c2715` | `export` su nginx di base, senza aggiornamento dei pacchetti | immagine della landing: `nginx -t`, health 200, archivio come allegato, 404 sulla radice, 403 su POST |
| 24 | `be5d4272` | Redis in produzione con `users.acl` versionato e utente predefinito senza password; `redis_password` inutilizzato | utenze costruite dal secret in `/dev/shm`, `default` disattivato: senza credenziali `NOAUTH`, backend con `redis: true` |
| 25 | `1bfc7475` | Filebeat autenticato come `elastic`; al ruolo `filebeat_writer` mancavano `manage_index_templates` e `manage_ilm`, e senza Filebeat riceve 403 e non scrive | secret `filebeat_writer_password` condiviso con `fleet-bootstrap.sh`. Su 8.19.19 documenti in `filebeat-*` e in `logs-gioco.partita-default` |
| 26 | `056577e4` | chiave del bouncer montata come `crowdsec_bouncer_key`: CrowdSec registra solo i file `bouncer_key*`, la LAPI rifiutava Traefik e al bordo non arrivava alcuna decisione | montata come `bouncer_key_traefik`, registrata come `key_traefik`. Su v1.7.8: prima nessun bouncer, dopo LAPI 200 |
| 27 | `2e7e3d84` | secret di Swarm immutabili: cambiare un file faceva fallire il deploy | nome legato al contenuto, orfani rimossi; come cambiare ciascun secret in `docs/ESERCIZIO.md`. Swarm locale: secret nuovo al servizio e al job, orfano rimosso, secret in uso protetto dal demone |
| 28 | `8a2bdfb1` | `scripts/` fuori da `lint-shell`, pavimento di copertura predefinito a 20 in `coverage-gate.sh`, `docker-compose.prod.yml` residuo | corretti |
| 29 | `811ad514` | un annullamento durante la rivendicazione di una partita ferma la lasciava chiusa senza conclusione; la prova della chiusura differita falliva in modo intermittente | la rivendicazione non eredita l'annullamento; canale di fine spazzata atteso dalla prova. 0 fallimenti su 200 ripetizioni, contro 6 su 60 prima |
| 30 | `0d29637d` | `POW_SECRET` assente dallo stack: sfide firmate con il predefinito pubblico, e una sfida a difficoltà zero firmata da chiunque superava la soglia sulla creazione di sessioni | secret `pow_secret` esportato dall'entrypoint. Immagine del backend: senza la chiave la sfida falsa ottiene 201, con il secret 429 |
| 31 | `aee6ac5c` | il frontend non gestiva il 429 con la sfida: oltre la soglia, dietro il NAT di una conferenza, nessuna sessione e nessun salvataggio; cookie di sessione riscritto da JavaScript | solutore in `pow.ts` e nuovo tentativo con la soluzione; cookie lasciato al backend. Contro il backend reale a difficoltà 18: la versione precedente fallisce con 429, la nuova crea cinque sessioni consecutive in 32-312 ms |

**Verifiche complessive su `811ad514`.** `make verify` verde, con integrazione e copertura
al 90,0%; immagini ricostruite, trivy a 0 HIGH e CRITICAL sulle tre; `make runtime-check`
con 15 controlli su 15. L'albero dei commit coincide con quello verificato.

Su `aee6ac5c`: typecheck e build del frontend, `lint-shell`, `lint-stack`, immagini
ricostruite, trivy a 0 HIGH e CRITICAL, `make runtime-check` 15 su 15.

**Push.** `5bdeb7c4..aee6ac5c`, l'11 settembre, dopo fetch e controllo del fast-forward.
Il commit `1480e1e3` di `develop`, solo frontend, è integrato in locale con il merge
`954513d0`, senza conflitti.

### 9.11 Consenso, pagine statiche e taratura finale — pronto nel repository

Il presente aggiornamento, sviluppato e verificato in locale il 12 settembre, non è
ancora applicato alla macchina. L'applicazione in esercizio cambia soltanto dopo la
pubblicazione delle nuove immagini, la sostituzione manuale dei digest in
`/etc/stack-deploy.env` e una riapplicazione deliberata dello stack. Non va riavviato il
proxy per il solo scopo di provare queste modifiche e non va cancellato `pi_acme`.

- `/` serve la home originaria del progetto; `/info` reindirizza a `/`. Prima del gioco,
  `/play` presenta una scelta fra tutti i cookie, soli necessari e ritorno alla home.
  La scelta vive nella sessione della scheda e può essere cambiata senza trasferirsi al
  visitatore successivo su una postazione condivisa.
- con i soli cookie necessari la sessione e i salvataggi restano disponibili, ma il
  RUM e gli eventi analitici di gameplay non partono. Il backend tratta l'assenza di una
  scelta esplicita come diniego, non include l'identificativo di sessione nei log tecnici
  senza consenso e conserva la telemetria per 30 giorni al massimo;
- `/privacy` contiene l'informativa estesa e `/accessibility` la dichiarazione di
  accessibilità. Le pagine statiche mirano a WCAG 2.2 AA; il gioco canvas dichiara i
  propri limiti. Titoli di scheda, favicon, ordine di lettura, focus, aree cliccabili,
  riduzione del movimento, lingua e layout responsive sono uniformati. Telefoni e
  tablet touch piccoli ricevono una schermata coerente che rimanda alla home;
- nella home la navbar resta centrata e fuori dall'area scrollabile. Contenuto e footer
  condividono invece lo scorrimento: il footer non è fisso. Il pulsante flottante di
  ritorno in cima compare dopo lo scroll, si sposta sopra il footer e rispetta
  `prefers-reduced-motion`. I nomi finali del team sono ordinati per cognome;
- `ELASTIC_APM_RUM_SAMPLE_RATE` scende a `0.2`; `DATA_RETENTION_DAYS` vale 30; i limiti
  di APM e infra agent sono quelli della sezione 9.5. La landing separata non fa più
  parte dello stack: la home è servita dal frontend sul solo hostname `pot-tales.it`.

Verifiche locali: formattazione, vet, build e test Go con race detector; lint shell,
Dockerfile, Compose, stack, Traefik, Terraform e workflow; integrazione con MongoDB e
Redis reali; copertura complessiva 88,8% contro il pavimento 85%; typecheck e build del
frontend; scansione dei segreti senza rilievi; `npm audit --omit=dev` senza
vulnerabilità di produzione. Restano due avvisi solo di sviluppo legati alla versione
di Vite/esbuild: la correzione automatica richiede il salto maggiore a Vite 8 e non è
stata inclusa senza un collaudo dedicato.

## 10. Rischi specifici di questo percorso

| Rischio | Effetto | Mitigazione | Stato |
|---|---|---|---|
| Verifica dell'identità in fase di acquisto | slittamento dell'intera catena | registrazione anticipata | **rientrato**: attivazione in sette minuti |
| Usura e storia dei dischi | guasto durante l'esercizio | SMART, lettura completa e auto-test prima di installare, RAID1, verifica di coerenza, contatori alla vigilia | **misurato**: sezione 4.1 |
| Temperatura dei dischi sotto carico | rallentamento di `nvme0n1` oltre 78 °C | letture per disco in sezione 4.3 e durante il load test | aperto |
| Layout dei dischi sbagliato | la correzione richiede di ridurre filesystem in uso | layout definito e verificato prima dell'installazione | **eseguito e verificato**: sezioni 4.2 e 4.3 |
| Revisione sul server priva di `de4e1073` | HSTS di un anno servito come letterale | verifica dei commit in 7.1 prima del primo deploy | **ridotto**: il remoto contiene `de4e1073` da `4a90a583`; resta la verifica sulla macchina |
| Immagini da una revisione incompleta | fatti di partita assenti o frontend non aggiornato | digest da una revisione con entrambi i gruppi di commit | aperto |
| Gate di copertura sotto il pavimento | la pipeline di `develop` fallisce e `publish-images` non parte: nessun digest da mettere in `/etc/stack-deploy.env` | test per gli handler di gioco e per la chiusura differita, oppure decisione esplicita sul pavimento | **rientrato**: 89,7% da `0d958099`, sezione 9.9 |
| Commit che rompono la build senza che nessuno se ne accorga | immagine non costruibile scoperta solo al passaggio su `develop` o al deploy, come il lockfile cancellato da `a464426d` | pipeline anche su `integrazione/infra` (`16fd492a`) | mitigato: resta da leggere l'esito di ogni push |
| HSTS attivato prima di una catena verificata | blocco non aggirabile per i visitatori | sequenza in 6.2, non negoziabile | **rientrato per la prima emissione**: HSTS era a zero e la catena di produzione è attendibile; resta spento fino alla verifica completa |
| Limite di frequenza dell'autorità raggiunto in collaudo | nessun certificato valido per giorni | directory di prova prima della prima emissione; poi conservazione dello stato ACME | **non materializzato**: una sola emissione di produzione, riuscita al primo tentativo; `pi_acme` da preservare |
| Metodi statici di Traefik mescolati | gli argomenti con CA di prova, plugin e middleware vengono ignorati | un solo metodo, tutto via CLI; test su stack renderizzato e immagine reale | **corretto, pushato e applicato il 12 settembre** (`8af699d2`): plugin caricato, CA di produzione effettiva, certificato riutilizzato, health 200 |
| `infra-agent` con limite da 512 MiB | riavvii ripetuti con exit 137 e buchi nelle metriche | limite 1 GiB, riserva 256 MiB e una CPU nella sezione 9.5 | **corretto nel repository, da pubblicare e applicare manualmente**; sul server il servizio ha comunque raggiunto `1/1` dopo gli OOM iniziali |
| Telemetria avviata senza scelta | raccolta analitica non necessaria e informativa incompleta | consenso prima del gioco, RUM e gameplay disabilitati senza accettazione esplicita, ritenzione 30 giorni | **corretto nel repository, da pubblicare e applicare manualmente**; sezione 9.11 |
| Controllo di vitalità che non interroga il backend | sorveglianza verde con applicazione ferma | sezione 9.9, punto 3 | **corretto** (`3e9509fc`), da verificare sulla macchina: sezione 7.2, punto 7 |
| Blocco della scheda di rete sotto carico | perdita di connettività per secondi, ripetuta | TSO e GSO disattivati, sezione 5.4 e `nic-offload@.service` | aperto |
| Nessuno snapshot del fornitore | perdita della macchina coperta solo fino all'ultimo prelievo | snapshot LVM locali, prelievo dell'archivio portabile e delle esportazioni dalla postazione; Storage Box facoltativa (sezione 9.6) | accettato: la finestra dipende dalla frequenza dei prelievi |
| Nome con trattino | visitatori su `pottales.it`, registrabile da altri | registrazione facoltativa della forma senza trattino | aperto |
| Frontend senza gestione della prova di lavoro | oltre 500 sessioni l'ora dallo stesso indirizzo il backend risponde 429 con una sfida che `APISession.ts` non gestiva: dietro il NAT di una conferenza i visitatori non riuscivano a iniziare una partita | solutore e nuovo tentativo con la soluzione (`aee6ac5c`); chiave delle sfide da un secret, senza la quale la soglia era aggirabile (`0d29637d`) | **corretto**; la durata della ricerca sui dispositivi dei visitatori va osservata nel load test |
| Guasto hardware non riparabile in giornata non presidiata | fermo fino al giorno successivo | password telefonica nel Robot per l'assistenza del datacenter | rischio residuo accettato, come nel piano principale |

## 11. Cammino critico

Le dipendenze reali, in ordine. Ogni passo richiede il precedente.

1. ~~Decisione fra i due percorsi~~ — chiusa l'11 settembre
2. ~~Account e verifica dell'identità~~
3. ~~Acquisto della macchina e registrazione del dominio~~ — 11 settembre
4. ~~Lettura SMART e accettazione dell'hardware~~ — sezione 4.1
5. ~~Installazione del sistema con il layout definitivo e verifica di coerenza del
   RAID~~ — 11–12 settembre, `[UU]`, `sync_action=idle`, `mismatch_cnt=0`
6. ~~Prerequisiti dell'host e riavvio di prova~~ — sezione 5
7. ~~Storage Box e chiave dedicata~~ — facoltative, fuori dal cammino critico (sezioni
   3.3 e 9.6)
8. ~~Correzioni al repository (9.3, 9.9 e 9.10)~~ — la prima tornata pushata l'11
   settembre (`4a90a583`), la seconda fino ad `aee6ac5c`. Restano la revisione
   verificata sulla macchina e i digest delle immagini, che arrivano solo dal passaggio
   su `develop` e devono contenere `811ad514` per il backend e `aee6ac5c` per il
   frontend — sezione 7.1
9. ~~Record DNS e verifica da rete esterna~~ — sezione 6.1
10. ~~Primo deploy con HSTS spento~~ — la CA di produzione è stata usata per il difetto
    descritto in 6.2; emissione riuscita e volume `pi_acme` preservato
11. ~~Integrare e applicare la correzione del metodo statico di Traefik~~ — `8af699d2`,
    certificato riutilizzato e health 200. Restano verifica completa a stack acceso,
    pubblicazione e deploy manuale della sezione 9.11, load test, taratura e ripristini
12. ~~Passaggio a produzione e CA resa esplicita nell'ambiente~~ — già avvenuto senza
    cancellare lo stato ACME
13. Verifica esterna finale della catena, da rete e da dispositivo terzi
14. Attivazione di HSTS
15. Prova di riavvio non presidiato
16. Stampa del materiale con il codice QR — **dopo** il punto 13, non prima

Il punto 16 è quello che si tende a spostare fuori sequenza, perché ha tempi di fornitore
esterni: stampare prima che la catena sia verificata significa rifare la stampa, o
servire un nome che non corrisponde al certificato.
