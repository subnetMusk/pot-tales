<p align="center">
  <img src="frontend/public/assets/images/ui/title.png" width="250" alt="Pot Tales">
</p>

<p align="center">
  <a href="https://pot-tales.it/">Gioca a Pot Tales</a>
  ·
  <a href="features.md">Funzionalità e verifiche esterne</a>
</p>

<p align="center">
  <img src="https://healthchecks.io/badge/6e1f0796-8cd7-4beb-a3f5-5bd22fab18fd/zys6OZ9t-2.svg" alt="Stato dei controlli operativi di Pot Tales">
</p>

# Un’avventura tra scienza e gioco

**Pot Tales** è un videogioco educativo online che trasforma la ricerca
archeometrica sui residui conservati nelle ceramiche antiche in un’avventura
interattiva 2D. Il giocatore esplora un laboratorio di ricerca archeologica,
entra nelle “profondità oscure” dei depositi e ne riemerge seguendo gli indizi
della scoperta scientifica.

Il progetto nasce da un’iniziativa didattica multidisciplinare: studenti di
archeologia e informatica, insieme a professionisti dell’audiovisivo, hanno
cercato un linguaggio nuovo per raccontare risultati di ricerca complessi.

## Il contesto della ricerca

I depositi neri che si trovano all’interno dei contenitori in ceramica si
comportano come capsule del tempo. Il loro studio può restituire informazioni
preziose sulle attività quotidiane delle comunità antiche e sugli ambienti in
cui vivevano.

L’indagine combina analisi petrografiche, mineralogiche, chimiche e
spettroscopiche con microscopia elettronica e datazione. Pot Tales rende
esplorabili metodi e risultati senza ridurli a una lezione frontale: si impara
muovendosi, osservando e risolvendo le sfide del gioco.

## Dal problema alla soluzione

Comunicare efficacemente la ricerca archeologica non è semplice. Per questo il
progetto usa una narrazione esplorativa: il giocatore percorre metaforicamente
i depositi come una caverna buia, trova il proprio cammino e scopre, passo dopo
passo, ciò che le analisi di laboratorio hanno reso visibile.

L’esperienza è accessibile dal browser desktop e non richiede installazione.
L’interfaccia è disponibile in italiano e inglese; la raccolta analitica
facoltativa viene attivata soltanto dopo una scelta esplicita del visitatore.

## Il team

F. M. Valente · C. D. Baeza Vega · D. Favale · L. Mocchiutti · I. Malliota ·
I. Garcia Trivès · T. T. Kahveci · R. Buso · A. Cipriani · F. Marcon ·
I. Rossi · L. Soligo

## Dietro le quinte

Il gioco usa Phaser 3 e TypeScript/Vite, con un backend Go e stato temporaneo
su MongoDB e Redis. Lo stack di produzione gira su Docker Swarm dietro Traefik
e integra osservabilità Elastic, telemetria RUM, controlli esterni, backup ed
esportazione dei dati.

Per provare il progetto in locale:

```bash
cp .env.example .env
make dev-up
```

I riferimenti per chi sviluppa o gestisce il servizio sono volutamente
separati dalla presentazione:

- [Funzionalità e verifiche esterne](features.md)
- [Sviluppo locale](docs/SVILUPPO.md)
- [Architettura](docs/ARCHITETTURA.md)
- [Esercizio e recovery](docs/ESERCIZIO.md)
- [Provisioning della macchina](provisioning/README.md)
- [Osservabilità come codice](terraform/elk/README.md)

`make help` elenca i comandi disponibili e rimane la fonte operativa più
rapida per orientarsi nel repository.
