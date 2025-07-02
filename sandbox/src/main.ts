const gameContainer = document.getElementById("game-container");
const logPanel = document.getElementById("log-panel");

if (!gameContainer || !logPanel) {
  throw new Error("Elemento #game-container o #log-panel non trovato.");
}

// 👇 Log visuale nel pannello laterale
function log(message: string, type: 'info' | 'error' = 'info') {
  const line = document.createElement("div");
  line.textContent = `[${type.toUpperCase()}] ${message}`;
  line.style.color = type === 'error' ? 'red' : 'inherit';
  logPanel.appendChild(line);
  logPanel.scrollTop = logPanel.scrollHeight;
}

// 👇 Esegue una richiesta API e logga in/out
async function fetchScene(id: string): Promise<void> {
  try {
    log(`Richiesta scena personalizzata: ${id}`);
    const res = await fetch(`/sandbox-api/scene?id=${encodeURIComponent(id)}`, {
      method: "GET",
      credentials: "include"
    });

    if (!res.ok) {
      throw new Error(`Errore ${res.status} durante il fetch della scena.`);
    }

    const html = await res.text();
    gameContainer.innerHTML = html;
    log("Scena caricata con successo.");
  } catch (err) {
    log((err as Error).message, 'error');
  }
}

// Esempio iniziale: carica scena default
fetchScene("default");
