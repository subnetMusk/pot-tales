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

    const html = await res.text();
    const temp = document.createElement("div");
    temp.innerHTML = html;

    // Estrai e rimuovi gli script prima di iniettare l'HTML
    const scripts = Array.from(temp.querySelectorAll("script"));
    scripts.forEach(script => script.remove());

    wrapper.innerHTML = temp.innerHTML;

    // Ricrea e reinserisci gli script
    for (const oldScript of scripts) {
      const newScript = document.createElement("script");
      if (oldScript.type) newScript.type = oldScript.type;
      if (oldScript.src) {
        newScript.src = oldScript.src;
        newScript.async = oldScript.async;
      } else {
        newScript.textContent = oldScript.textContent;
      }
      wrapper.appendChild(newScript);
    }

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

  if (!hasSession) {
    await injectAndExecute("/static/pages/consent.html");
  } else {
    await injectAndExecute("/static/pages/menu.html");
  }
})();
