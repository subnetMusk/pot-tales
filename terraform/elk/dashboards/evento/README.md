# Space `evento`

Export dei saved object della vista divulgativa: andamento dell'evento,
destinata alla condivisione.

I file `.ndjson` di questa directory vengono reimportati in questo Space da
`../../dashboards.tf`. Accanto a ciascuno deve stare il file `.ndjson.versione`
con la versione di Kibana che l'ha prodotto: senza, l'importazione viene
rifiutata. Il ciclo completo e' in [../README.md](../README.md).

Cio' che finisce qui viene condiviso: prima di esportare una dashboard va
verificato che i pannelli non mostrino indirizzi, identificativi di sessione o
nomi di host. Il ruolo `osservabilita_evento` limita gli indici leggibili, ma
non puo' impedire a un pannello di riportare un valore gia' aggregato.

Directory ancora priva di export.
