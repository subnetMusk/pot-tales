# ============================================================
# Variabili di Space, ruoli, utenze e dashboard
# ------------------------------------------------------------
# Separate da variables.tf per tenere insieme cio' che descrive la
# consultazione delle dashboard.
# ============================================================

# ---------- Indici visibili a ciascuna platea ----------

variable "indici_esercizio" {
  description = <<-EOT
    Pattern di indici leggibili dalla platea tecnica. Comprende i log
    applicativi, le metriche di host e container e le tracce APM. L'indice degli
    allarmi vi si aggiunge da solo: e' gia' dichiarato in `alert_index`.
  EOT
  type        = list(string)
  default     = ["filebeat-*", "logs-*", "metrics-*", "traces-apm*"]
}

variable "indici_evento" {
  description = <<-EOT
    Pattern di indici leggibili dalla platea divulgativa.

    Il valore predefinito segue lo schema di denominazione dei data stream
    (`logs-<dataset>-<namespace>`) applicato al dataset dei fatti di partita,
    `gioco.partita`, che il backend dichiara su ogni evento di gioco e che
    l'ingestione instrada su un indice separato da quello tecnico.

    Il pattern non deve intersecare quelli tecnici. Con licenza basic la
    sicurezza a livello di documento non e' disponibile, quindi non esiste modo
    di concedere un sottoinsieme di documenti dentro un indice condiviso: se i
    due elenchi si sovrappongono, la platea divulgativa legge anche i log
    tecnici, e nessun'altra parte della configurazione lo impedisce.

    Finche' l'ingestione non instrada gli eventi del gioco su questa
    destinazione, il pattern non corrisponde ad alcun indice e le dashboard
    divulgative restano vuote. E' il comportamento voluto: preferibile a un
    pattern piu' largo che mostrerebbe cio' che non deve essere condiviso.
  EOT
  type        = list(string)
  default     = ["logs-gioco.partita-*"]
}

locals {
  # L'indice degli allarmi appartiene alla vista tecnica. Deriva da
  # `alert_index` invece di essere ripetuto: le regole in alerting.tf ci
  # scrivono usando quella stessa variabile, e due valori scritti a mano
  # divergerebbero al primo cambio.
  indici_esercizio = concat(var.indici_esercizio, ["${var.alert_index}*"])
}

# ---------- Visibilita' delle funzionalita' nello Space ----------

variable "funzionalita_disattivate_esercizio" {
  description = <<-EOT
    Funzionalita' nascoste nello Space di esercizio. Vuoto: alla platea tecnica
    non si toglie nulla oltre a cio' che il ruolo gia' nega.
  EOT
  type        = list(string)
  default     = []
}

variable "funzionalita_disattivate_evento" {
  description = <<-EOT
    Funzionalita' nascoste nello Space divulgativo.

    E' una scelta di leggibilita', non di sicurezza: la documentazione Elastic
    afferma che il controllo di visibilita' delle funzionalita' non e' una
    misura di sicurezza. Cio' che protegge davvero e' il ruolo, che qui non
    concede alcuna di queste funzionalita'.

    Gli identificativi dipendono dalla versione di Kibana e vanno confrontati
    con `GET /api/features` sull'istanza in uso. Un identificativo errato lascia
    visibile una voce di menu che il ruolo comunque non autorizza.

    `indexPatterns` e' escluso dall'elenco, ed e' deliberato: e' la funzionalita'
    che possiede le data view. Disattivandola il tipo di oggetto non esiste piu'
    in questo Space, e la data view dichiarata per questa platea non e' creabile:
    Kibana risponde 400 con `insufficient access`, che sembra un problema di
    privilegi ed e' invece di funzionalita' assente. Lasciarla visibile non
    allarga nulla, perche' il ruolo concede lettura sui soli indici divulgativi
    ed e' quello a decidere.
  EOT
  type        = list(string)
  default     = ["dev_tools", "advancedSettings", "savedObjectsManagement"]
}

# ---------- Utenze di consultazione ----------

variable "utenze_esercizio" {
  description = <<-EOT
    Utenze della platea tecnica, come mappa nome -> password.

    Devono corrispondere, nome per nome e password per password, alle righe di
    `secrets/dashboard_users_esercizio` e comparire anche in
    `secrets/dashboard_users`. Il bordo verifica la credenziale e lascia
    passare l'intestazione di autorizzazione: la stessa credenziale autentica
    poi l'utente su Kibana.
  EOT
  type        = map(string)
  sensitive   = true
  default     = {}
}

variable "utenze_evento" {
  description = <<-EOT
    Utenze della platea divulgativa, come mappa nome -> password.

    Devono corrispondere alle righe di `secrets/dashboard_users_evento` e
    comparire anche in `secrets/dashboard_users`.
  EOT
  type        = map(string)
  sensitive   = true
  default     = {}
}

# ---------- Dashboard ----------

variable "kibana_version" {
  description = <<-EOT
    Versione di Kibana su cui questo modulo applica, allineata a STACK_VERSION
    del `.env`.

    Serve a validare gli export dei saved object prima di reimportarli. Elastic
    dichiara compatibile un export solo verso la stessa versione di Kibana, una
    minor successiva della stessa major, o la major successiva: le condizioni
    sono verificate in dashboards.tf confrontando questo valore con la versione
    registrata accanto a ciascun file.
  EOT
  type        = string
  default     = "8.19.19"

  validation {
    condition     = can(regex("^[0-9]+\\.[0-9]+\\.[0-9]+$", var.kibana_version))
    error_message = "kibana_version deve avere la forma major.minor.patch."
  }
}
