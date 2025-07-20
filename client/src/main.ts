const wrapper = document.getElementById("wrapper");

if (!wrapper) {
  throw new Error("Elemento #wrapper non trovato nel DOM.");
}

// Funzione per iniettare HTML e eseguire gli script al suo interno
async function injectAndExecute(path: string): Promise<void> {
  try {
    const res = await fetch(path, { credentials: "include" });

    if (!res.ok) {
      throw new Error(`Errore ${res.status} caricando ${path}`);
    }

    const injectHtml = await res.text();
    wrapper.innerHTML = injectHtml;

    // Trova tutti i tag script e li esegue (iniettare HTML non esegue automaticamente il codice)
    const scripts = wrapper.querySelectorAll('script');
    scripts.forEach(oldScript => {
      const newScript = document.createElement('script');

      for (const attr of oldScript.attributes) {
        newScript.setAttribute(attr.name, attr.value);
      }

      if (oldScript.src) newScript.src = oldScript.src;
      else newScript.textContent = oldScript.textContent;

      document.body.appendChild(newScript);
    });

  } catch (err) {
    console.error("Errore in injectAndExecute:", err);
    wrapper.innerHTML = `<p>Errore caricando contenuto: ${path}</p>`;
  }
}

// Funzione per validare la sessione
async function checkSession(): Promise<boolean> {
  try {
    const res = await fetch("/auth/validate", { credentials: "include" });
    return res.ok;
  } catch {
    return false;
  }
}

// Flusso principale all'avvio
(async () => {
  const hasSession = await checkSession();

  if (hasSession) {
    await injectAndExecute("/static/pages/menu.html");
  } else {
    await injectAndExecute("/static/pages/consent.html");
  }
})();

async function startGame() {
  await injectAndExecute('static/pages/game.html');
  import('./loader.ts').then(() => {});
}

// Esporta le funzione per poterle usare in altri moduli 
// serve per evitare errori dati dalla rinominazione di file e funzioni
window.injectAndExecute = injectAndExecute;
window.startGame = startGame;