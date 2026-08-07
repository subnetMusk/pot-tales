# ============================================================
# Impostazioni degli indici
# ------------------------------------------------------------
# Su un nodo singolo una replica non puo' essere assegnata: resta perennemente
# non allocata e il cluster rimane giallo. Un indicatore sempre acceso non
# distingue nulla, quindi l'allarme sullo stato del cluster diventa inutile
# proprio quando servirebbe.
#
# Con zero repliche il verde e' lo stato normale, e giallo o rosso tornano a
# significare che e' successo qualcosa.
#
# Il compromesso e' esplicito: senza repliche la perdita del nodo comporta la
# perdita degli indici. E' accettabile perche' il nodo e' uno solo — una replica
# sulla stessa macchina non protegge da nulla — e perche' i dati che devono
# sopravvivere passano dall'esportazione, non dal cluster.
# ============================================================

# I template di Fleet dichiarano `<tipo>@custom` fra i propri componenti proprio
# per consentire questa personalizzazione. Definire invece un index template
# con priorita' maggiore sostituirebbe quelli di Fleet, perdendone le mappature.
resource "elasticstack_elasticsearch_component_template" "logs_custom" {
  name = "logs@custom"

  template {
    settings = jsonencode({
      "index.number_of_replicas" = "0"
    })
  }
}

resource "elasticstack_elasticsearch_component_template" "metrics_custom" {
  name = "metrics@custom"

  template {
    settings = jsonencode({
      "index.number_of_replicas" = "0"
    })
  }
}

resource "elasticstack_elasticsearch_component_template" "traces_custom" {
  name = "traces@custom"

  template {
    settings = jsonencode({
      "index.number_of_replicas" = "0"
    })
  }
}

# L'indice degli allarmi non e' un data stream gestito da Fleet: viene creato
# dal connettore alla prima scrittura, quindi ha bisogno di un template proprio.
resource "elasticstack_elasticsearch_index_template" "alert_index" {
  name           = "alerts-infra"
  index_patterns = ["${var.alert_index}*"]
  priority       = 200

  template {
    settings = jsonencode({
      "index.number_of_replicas" = "0"
      "index.number_of_shards"   = "1"
    })
  }
}
