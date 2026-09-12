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
# `@custom` e' l'ultimo componente della catena, quindi le sue impostazioni
# vincono su quelle dichiarate da Fleet: e' il punto in cui la ritenzione
# sostituisce la policy predefinita, che ruota gli indici senza cancellarli mai.
#
# Le tre classi di dati la condividono perche' la ritenzione e' una scelta
# unica. Sono gli access log del proxy a contenere gli indirizzi completi, ma
# tracce e metriche vivono sullo stesso disco e nessuna delle tre ha ragione di
# sopravvivere alle altre.
resource "elasticstack_elasticsearch_component_template" "logs_custom" {
  name = "logs@custom"

  template {
    settings = jsonencode({
      "index.number_of_replicas" = "0"
      "index.lifecycle.name"     = elasticstack_elasticsearch_index_lifecycle.logs.name
    })

    # I pannelli dell'evento devono conoscere i campi anche prima del primo
    # checkpoint o della prima conclusione. Senza una mappatura esplicita il
    # data stream dinamico li materializza soltanto alla prima scrittura e
    # Kibana mostra "campo non disponibile" invece di un contatore a zero.
    mappings = file("${path.module}/gameplay-mappings.json")
  }
}

resource "elasticstack_elasticsearch_component_template" "metrics_custom" {
  name = "metrics@custom"

  template {
    settings = jsonencode({
      "index.number_of_replicas" = "0"
      "index.lifecycle.name"     = elasticstack_elasticsearch_index_lifecycle.logs.name
    })
  }
}

resource "elasticstack_elasticsearch_component_template" "traces_custom" {
  name = "traces@custom"

  template {
    settings = jsonencode({
      "index.number_of_replicas" = "0"
      "index.lifecycle.name"     = elasticstack_elasticsearch_index_lifecycle.logs.name
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
