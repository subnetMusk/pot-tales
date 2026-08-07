# ============================================================
# Space Kibana, ruoli e utenze di consultazione
# ------------------------------------------------------------
# Le dashboard servono due platee con esigenze opposte:
#
#   esercizio  salute del servizio, risorse della macchina, contenimento.
#              Tecnica, non si distribuisce.
#   evento     andamento dell'evento. Si condivide con leggerezza.
#
# Ognuna ha il proprio Space e il proprio ruolo in sola lettura, limitato a una
# data view.
#
# La separazione e' affidata al RUOLO, non allo Space. Nascondere funzionalita'
# a livello di Space rende l'interfaccia piu' leggibile, ma la documentazione
# Elastic dichiara che il controllo di visibilita' delle funzionalita' non e'
# una misura di sicurezza. I ruoli qui sotto sono quindi scritti perche' reggano
# da soli: se domani gli Space venissero eliminati, i privilegi concessi
# resterebbero gli stessi.
#
# Ogni ruolo delimita su due lati indipendenti:
#
#   Elasticsearch  quali indici sono leggibili. E' il lato che conta: senza il
#                  privilegio sull'indice non c'e' interfaccia che possa
#                  mostrarne il contenuto.
#   Kibana         in quale Space e con quali funzionalita'. Lo `spaces` del
#                  blocco kibana e' applicato dal livello di autorizzazione di
#                  Kibana su ogni richiesta, non dallo Space stesso.
#
# Nessun privilegio di cluster e' concesso: la consultazione di dashboard e
# Discover non ne richiede, e ometterli evita di esporre la topologia del
# cluster a chi deve solo leggere dei dati.
#
# ------------------------------------------------------------
# Vincolo di corrispondenza con il bordo
# ------------------------------------------------------------
# I router delle dashboard in deploy/config/dynamic/ verificano la credenziale
# con basicAuth e NON rimuovono l'intestazione di autorizzazione: la stessa
# credenziale prosegue verso Kibana e vi autentica l'utente.
#
# Ne segue che le utenze dichiarate qui e le righe dei file htpasswd distribuiti
# come secret devono coincidere, nome per nome e password per password:
#
#   utenze_esercizio  <->  secrets/dashboard_users_esercizio
#   utenze_evento     <->  secrets/dashboard_users_evento
#   entrambe          <->  secrets/dashboard_users
#
# Il terzo file copre le risorse comuni ai due Space (risorse statiche, chiamate
# non legate a uno Space) e deve contenere l'unione delle due platee.
#
# Un nome presente solo nell'htpasswd supera il bordo e viene respinto da
# Kibana: l'utente vede una richiesta di credenziali che non si chiude mai. Un
# nome presente solo qui non supera il bordo e non arriva a Kibana. Le due
# condizioni si manifestano in modo diverso ma hanno la stessa causa, ed e' la
# sola forma di disallineamento che questo modulo non puo' rilevare da solo,
# perche' i file htpasswd contengono impronte e non password.
# ============================================================

# ---------- Space ----------
#
# `space_id` non e' cosmetico: e' il segmento di percorso su cui i router del
# bordo instradano (/osservabilita/s/<space_id>). Cambiarlo qui senza cambiarlo
# in deploy/config/dynamic/routes.yml lascia lo Space raggiungibile solo dal
# router comune, cioe' senza il controllo di platea.

resource "elasticstack_kibana_space" "esercizio" {
  space_id    = "esercizio"
  name        = "Esercizio"
  description = "Salute del servizio, risorse della macchina, contenimento"
  initials    = "ES"

  # Riduzione del rumore nell'interfaccia, non un confine: cio' che il ruolo
  # non concede resta negato anche se la voce di menu fosse visibile.
  disabled_features = var.funzionalita_disattivate_esercizio
}

resource "elasticstack_kibana_space" "evento" {
  space_id    = "evento"
  name        = "Andamento evento"
  description = "Andamento dell'evento, destinato alla condivisione"
  initials    = "EV"

  disabled_features = var.funzionalita_disattivate_evento
}

# ---------- Data view ----------
#
# Una per Space. Il titolo e' un pattern di indici, non un filtro sui documenti:
# e' il motivo per cui la separazione fra le due platee deve passare per indici
# distinti e non per una condizione sui campi.
#
# Con licenza basic la sicurezza a livello di documento e di campo non e'
# disponibile: il blocco `indices` di un ruolo accetta una `query`, ma
# Elasticsearch la rifiuta senza licenza platinum. L'unico confine applicabile
# e' quindi quello sull'indice, e le due data view non devono sovrapporsi nella
# direzione che conta: la platea divulgativa non deve poter nominare gli indici
# tecnici.
#
# `allow_no_index` consente alla data view di esistere prima dei dati: alla
# prima applicazione gli indici possono non essere ancora stati creati, e senza
# questo l'oggetto non verrebbe salvato.

resource "elasticstack_kibana_data_view" "esercizio" {
  space_id = elasticstack_kibana_space.esercizio.space_id

  data_view = {
    id              = "vista-esercizio"
    name            = "Esercizio"
    title           = join(",", local.indici_esercizio)
    time_field_name = "@timestamp"
    allow_no_index  = true
  }
}

resource "elasticstack_kibana_data_view" "evento" {
  space_id = elasticstack_kibana_space.evento.space_id

  data_view = {
    id              = "vista-evento"
    name            = "Andamento evento"
    title           = join(",", var.indici_evento)
    time_field_name = "@timestamp"
    allow_no_index  = true
  }
}

# ---------- Ruoli ----------
#
# `view_index_metadata` accompagna `read` perche' senza di esso la data view non
# riesce a elencare i campi dell'indice, e ogni pannello resta vuoto con un
# errore che sembra di dati mancanti e invece e' di privilegi.

resource "elasticstack_kibana_security_role" "esercizio" {
  name        = "osservabilita_esercizio"
  description = "Sola lettura sugli indici tecnici, limitata allo Space di esercizio"

  elasticsearch {
    indices {
      names      = local.indici_esercizio
      privileges = ["read", "view_index_metadata"]
    }
  }

  kibana {
    spaces = [elasticstack_kibana_space.esercizio.space_id]

    # Nessun `base`: `base = ["read"]` concederebbe la lettura su tutte le
    # funzionalita' dello Space, comprese quelle che permettono di interrogare
    # il cluster direttamente. L'elenco esplicito concede solo cio' che serve a
    # consultare.
    feature {
      name       = "dashboard"
      privileges = ["read"]
    }

    # La platea tecnica ha bisogno di interrogare i dati grezzi quando una
    # dashboard non basta a spiegare cosa sta succedendo.
    feature {
      name       = "discover"
      privileges = ["read"]
    }
  }
}

resource "elasticstack_kibana_security_role" "evento" {
  name        = "osservabilita_evento"
  description = "Sola lettura sugli indici dell'evento, limitata allo Space divulgativo"

  elasticsearch {
    indices {
      names      = var.indici_evento
      privileges = ["read", "view_index_metadata"]
    }
  }

  kibana {
    spaces = [elasticstack_kibana_space.evento.space_id]

    # Solo le dashboard. Senza Discover la platea divulgativa non compone
    # interrogazioni proprie: vede cio' che e' stato preparato, che e' quanto
    # serve e quanto e' stato verificato prima di essere condiviso.
    feature {
      name       = "dashboard"
      privileges = ["read"]
    }
  }
}

# ---------- Utenze ----------
#
# Dichiarate come mappa nome -> password. Ogni voce deve avere la riga
# corrispondente nel file htpasswd della propria platea: vedi il vincolo in
# testa a questo file.
#
# Revocare un destinatario significa togliere la voce da qui e la riga
# dall'htpasswd. Le due operazioni sono indipendenti e nessuna delle due basta
# da sola: senza la prima la credenziale continua a essere valida su Kibana,
# senza la seconda continua a essere valida sul bordo.

#
# `nonsensitive` sulle sole chiavi: Terraform rifiuta un valore sensibile come
# indice di `for_each`, perche' la chiave diventa parte dell'indirizzo della
# risorsa e comparirebbe nel piano. Il nome utente non e' il segreto — compare
# gia' nell'access log del bordo a ogni consultazione — mentre la password
# resta marcata, perche' e' letta dal valore della mappa e non dalla chiave.

resource "elasticstack_elasticsearch_security_user" "esercizio" {
  for_each = toset(nonsensitive(keys(var.utenze_esercizio)))

  username = each.key
  password = var.utenze_esercizio[each.key]
  roles    = [elasticstack_kibana_security_role.esercizio.name]
  enabled  = true
}

resource "elasticstack_elasticsearch_security_user" "evento" {
  for_each = toset(nonsensitive(keys(var.utenze_evento)))

  username = each.key
  password = var.utenze_evento[each.key]
  roles    = [elasticstack_kibana_security_role.evento.name]
  enabled  = true
}
