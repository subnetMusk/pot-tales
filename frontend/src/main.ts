// ===================================================
// frontend/src/main.ts
// ===================================================
// Main entry point with APM RUM monitoring
// ===================================================

// Initialize APM RUM monitoring FIRST
import apm from './apm-rum-config.js'

// Expose APM agent globally for debugging and console access
if (typeof window !== 'undefined') {
  (window as any).apm = apm;
  (window as any).elasticApm = apm;
}

// Log APM initialization with proper type handling
const env = (import.meta as any).env || {};
console.log('🔍 APM RUM Agent initialized:', {
  serviceName: env.VITE_ELASTIC_APM_RUM_SERVICE_NAME || 'frontend-app',
  serverUrl: env.VITE_ELASTIC_APM_RUM_SERVER_URL || 'http://apm.localhost',
  environment: env.VITE_ELASTIC_APM_ENVIRONMENT || 'development',
  apmAgent: !!apm,
  globallyExposed: !!((window as any).apm && (window as any).elasticApm)
})

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
    wrapper!.innerHTML = injectHtml;

    // Trova tutti i tag script e li esegue (iniettare HTML non esegue automaticamente il codice)
    const scripts = wrapper!.querySelectorAll('script');
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
    wrapper!.innerHTML = `<p>Errore caricando contenuto: ${path}</p>`;
  }
}

// Funzione per validare la sessione
function checkConsent(): boolean {
    return localStorage.getItem("consentGiven") == "true";
}

// Il gioco richiede tastiera/mouse e uno schermo ampio: blocca i dispositivi mobili
function isMobileDevice(): boolean {
    return /Android|iPhone|iPad|iPod|Windows Phone|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );
}

// Flusso principale all'avvio: la landing page vive su "/", il gioco su "/play"
(async () => {
    if (window.location.pathname.startsWith("/play")) {
        await enterGame();
    } else {
        await showLanding();
    }
})();

async function showLanding() {
    await injectAndExecute('/static/pages/homePage.html');
}

// Chiamata dal bottone Play della landing page: avvia il flusso di consenso/gioco
async function enterGame() {
    if (isMobileDevice()) {
        await showMobileBlocked();
        return;
    }
    if (checkConsent()) {
        await startGame();
    } else {
        await injectAndExecute("/static/pages/consent.html");
    }
}

async function showMobileBlocked() {
    await injectAndExecute('/static/pages/desktopOnly.html');
}

async function startGame() {
    await injectAndExecute('static/pages/game.html');
    import('./loader.js').then(() => {});
}

// Esporta le funzione per poterle usare in altri moduli
// serve per evitare errori dati dalla rinominazione di file e funzioni
// Global exports for browser access
(window as any).injectAndExecute = injectAndExecute;
(window as any).showLanding = showLanding;
(window as any).enterGame = enterGame;
(window as any).showMobileBlocked = showMobileBlocked;
(window as any).startGame = startGame;