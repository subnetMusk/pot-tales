/**
 * Placeholder per la UI di gestione delle custom scenes in sandbox.
 * Qui andremo a:
 *  - Chiedere al server la lista delle scene disponibili
 *  - Mostrare checkbox per gli oggetti raccolti in scene precedenti
 *  - Inviare la selezione al server e ricevere il sceneConfig
 */

export function initCustomSceneUI() {
  const container = document.getElementById('sandbox-ui');
  if (!container) return;
  
  // Messaggio segnaposto
  const info = document.createElement('p');
  info.textContent = "CustomSceneUI Placeholder: qui comparirà l'interfaccia di test.";
  container.appendChild(info);

  console.log('CustomSceneUI script caricato e inizializzato.');
}

// Esegui subito l’inizializzazione
initCustomSceneUI();
