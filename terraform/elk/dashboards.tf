# ============================================================
# Versionamento delle dashboard
# ------------------------------------------------------------
# Le dashboard si costruiscono a mano su Kibana, perche' hanno bisogno di dati
# veri per essere disegnate. Cio' che si versiona e' il loro export.
#
# Il ciclo e':
#
#   1. si compone la dashboard su Kibana, nello Space di destinazione;
#   2. `make dashboards-export` scrive l'export NDJSON sotto dashboards/, con
#      accanto la versione di Kibana che l'ha prodotto;
#   3. il file entra nel controllo di versione;
#   4. `terraform apply` lo reimporta, su questa istanza o su una ricostruita
#      da zero.
#
# L'export e' passato attraverso senza riscritture. Ogni oggetto porta
# `coreMigrationVersion` e `typeMigrationVersion`, che Kibana usa per decidere
# quali migrazioni applicare in importazione: un file riformattato da uno
# strumento che non li conserva viene importato come se fosse gia' aggiornato,
# e il difetto si manifesta molto piu' tardi, sotto forma di oggetto che non si
# apre.
#
# Le risorse sono guidate dal contenuto della directory: finche' non c'e' alcun
# export, non c'e' alcuna risorsa e il modulo si applica lo stesso. Aggiungere
# una dashboard e' un file in piu', non una modifica al codice.
# ============================================================

locals {
  cartella_esercizio = "${path.module}/dashboards/esercizio"
  cartella_evento    = "${path.module}/dashboards/evento"

  export_esercizio = fileset(local.cartella_esercizio, "*.ndjson")
  export_evento    = fileset(local.cartella_evento, "*.ndjson")

  # Versione registrata accanto a ciascun export. Assente o illeggibile vale
  # stringa vuota, che la verifica sotto tratta come incompatibile: un export
  # di provenienza ignota non si importa.
  versione_esercizio = {
    for f in local.export_esercizio :
    f => try(trimspace(file("${local.cartella_esercizio}/${f}.versione")), "")
  }
  versione_evento = {
    for f in local.export_evento :
    f => try(trimspace(file("${local.cartella_evento}/${f}.versione")), "")
  }

  major_atteso = tonumber(split(".", var.kibana_version)[0])
  minor_atteso = tonumber(split(".", var.kibana_version)[1])

  # Regola di compatibilita' dichiarata da Elastic: un export si importa nella
  # stessa versione di Kibana, in una minor successiva della stessa major, o
  # nella major successiva. Tutto il resto e' rifiutato qui invece che da
  # Kibana, perche' un'importazione fuori intervallo puo' riuscire e lasciare
  # oggetti che non si aprono.
  #
  # `try(..., false)` copre il file di versione mancante o malformato: qualunque
  # errore di valutazione vale incompatibile.
  compatibile_esercizio = {
    for f, v in local.versione_esercizio : f => try(
      (tonumber(split(".", v)[0]) == local.major_atteso && tonumber(split(".", v)[1]) <= local.minor_atteso)
      || tonumber(split(".", v)[0]) == local.major_atteso - 1,
      false
    )
  }
  compatibile_evento = {
    for f, v in local.versione_evento : f => try(
      (tonumber(split(".", v)[0]) == local.major_atteso && tonumber(split(".", v)[1]) <= local.minor_atteso)
      || tonumber(split(".", v)[0]) == local.major_atteso - 1,
      false
    )
  }
}

# `overwrite` invece di `create_new_copies`: gli oggetti conservano
# l'identificativo che avevano all'export, quindi un riapply riscrive gli stessi
# oggetti anziche' affiancarne una copia a ogni esecuzione. E' anche cio' che
# rende l'operazione ripetibile senza accumulare duplicati.

resource "elasticstack_kibana_import_saved_objects" "esercizio" {
  for_each = local.export_esercizio

  space_id      = elasticstack_kibana_space.esercizio.space_id
  overwrite     = true
  file_contents = file("${local.cartella_esercizio}/${each.value}")

  # Le data view arrivano dal codice, non dall'export: se un export ne portasse
  # una con lo stesso identificativo, l'importazione la sovrascriverebbe e la
  # differenza comparirebbe al plan successivo.
  depends_on = [elasticstack_kibana_data_view.esercizio]

  lifecycle {
    precondition {
      condition = local.compatibile_esercizio[each.value]
      error_message = format(
        "dashboards/esercizio/%s e' stato prodotto con Kibana '%s' e non si importa su %s. Riesportarlo dall'istanza in uso oppure allineare kibana_version.",
        each.value,
        local.versione_esercizio[each.value] == "" ? "(versione non registrata)" : local.versione_esercizio[each.value],
        var.kibana_version
      )
    }
  }
}

resource "elasticstack_kibana_import_saved_objects" "evento" {
  for_each = local.export_evento

  space_id      = elasticstack_kibana_space.evento.space_id
  overwrite     = true
  file_contents = file("${local.cartella_evento}/${each.value}")

  depends_on = [elasticstack_kibana_data_view.evento]

  lifecycle {
    precondition {
      condition = local.compatibile_evento[each.value]
      error_message = format(
        "dashboards/evento/%s e' stato prodotto con Kibana '%s' e non si importa su %s. Riesportarlo dall'istanza in uso oppure allineare kibana_version.",
        each.value,
        local.versione_evento[each.value] == "" ? "(versione non registrata)" : local.versione_evento[each.value],
        var.kibana_version
      )
    }
  }
}
