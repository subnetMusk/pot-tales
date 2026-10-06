# Guida all'inserimento delle traduzioni nel progetto Phaser

## Struttura consigliata

Organizza le traduzioni in cartelle per lingua all'interno della directory `assets/i18n/`, con un file JSON per ogni scena:

```
assets/i18n/en/Menu.json
assets/i18n/it/Menu.json
assets/i18n/en/Preload.json
assets/i18n/it/Preload.json
...
```

## Struttura dei file JSON

Ogni file JSON deve contenere le chiavi corrispondenti ai nomi degli oggetti testo nella scena.  
Esempio per `Menu.json`:

```json
{
  "play": "Play",
  "leaderboard": "Leaderboard",
  "gallery": "Gallery",
  "settings": "Settings"
}
```
Esempio per la versione italiana:

```json
{
  "play": "Gioca",
  "leaderboard": "Classifica",
  "gallery": "Galleria",
  "settings": "Impostazioni"
}
```

## Assegnazione dei nomi agli oggetti testo

In Phaser Editor 2D, seleziona ogni oggetto testo e imposta la proprietà **Name** con la chiave corrispondente (es. `play`, `leaderboard`, ecc.) nel pannello delle proprietà. **Spuntare la casella GO Name.**


## Caricamento delle traduzioni nella scena

Nel metodo `preload()` della scena, carica il file JSON della lingua scelta:

```typescript
const lang = localStorage.getItem("lang") || "en";
this.load.json("menu_i18n", `assets/i18n/${lang}/Menu.json`);
```

## Applicazione automatica delle traduzioni

Nel metodo `create()` della scena, usa la funzione `applyTranslations` per aggiornare automaticamente tutti i testi:

```typescript
import { applyTranslations } from "../utils";

create() {
    this.editorCreate();
    const i18n = this.cache.json.get("menu_i18n");
    applyTranslations(this, i18n);
    // ...resto del codice
}
```

La funzione `applyTranslations` cerca tutti gli oggetti testo per nome e aggiorna il loro contenuto con la traduzione corrispondente.

Le chiavi JSON devono corrispondere ai nomi assegnati ai testi.

## Cambiare lingua

La lingua viene scelta e salvata (ad esempio tramite una pagina di consenso) in `localStorage` con la chiave `"lang"`.  
Le scene leggono questa impostazione quando caricano le traduzioni.

Se la scena viene ripresa dopo un cambio lingua nelle impostazioni, usare
`reloadTranslations` in `frontend/src/utils.ts` per invalidare la cache JSON,
caricare il nuovo file e aggiornare i testi. Il solo cambio di `localStorage`
non aggiorna le scene già avviate.
