# Space `esercizio`

Export dei saved object della vista di esercizio: salute del servizio, risorse
della macchina, contenimento. Vista tecnica, non destinata alla distribuzione.

I file `.ndjson` di questa directory vengono reimportati in questo Space da
`../../dashboards.tf`. Accanto a ciascuno deve stare il file `.ndjson.versione`
con la versione di Kibana che l'ha prodotto: senza, l'importazione viene
rifiutata. Il ciclo completo e' in [../README.md](../README.md).

Directory ancora priva di export: le dashboard si compongono sui dati reali,
che non esistono prima del primo evento.
