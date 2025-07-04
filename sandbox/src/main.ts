const wrapper = document.getElementById("wrapper");
const panel = document.getElementById("dashboard-panel");

if (!wrapper || !panel) {
  throw new Error("Elemento DOM mancante (#wrapper o #dashboard-panel)");
}

// Inietta HTML e riesegue eventuali script JS inclusi
async function injectAndExecute(path: string): Promise<void> {
  while (wrapper.firstChild) {
    wrapper.removeChild(wrapper.firstChild);
  }

  try {
    const res = await fetch(path, { credentials: "include" });
    if (!res.ok) throw new Error(`Errore ${res.status} caricando ${path}`);
    const html = await res.text();

    const temp = document.createElement("div");
    temp.innerHTML = html;

    const scripts = Array.from(temp.querySelectorAll("script"));
    scripts.forEach(s => s.remove());

    wrapper.innerHTML = temp.innerHTML;

    console.log("Injecting HTML from", path, "→", temp.innerHTML);
    console.log("Scripts trovati:", scripts.map(s => s.src || 'inline'));

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
    wrapper.innerHTML = `<p>Errore caricando contenuto: ${path}</p>`;
    console.error("Errore injectAndExecute:", err);
  }
}

// Validazione della sessione
async function checkSession(): Promise<boolean> {
  try {
    const res = await fetch("/auth/validate", { credentials: "include" });
    return res.ok;
  } catch {
    return false;
  }
}

// Form per ID scena custom
function setupDashboardUI() {
  const title = document.createElement("h3");
  title.textContent = "Scene Personalizzate";
  panel.appendChild(title);

  const input = document.createElement("input");
  input.placeholder = "ID scena";
  input.id = "scene-id";
  input.style.width = "100%";
  input.style.marginBottom = "0.5rem";
  panel.appendChild(input);

  const button = document.createElement("button");
  button.textContent = "Carica";
  button.style.width = "100%";
  button.onclick = async () => {
    const id = (document.getElementById("scene-id") as HTMLInputElement).value;
    if (!id) return alert("ID scena non valido");
    await fetchScene(id);
  };
  panel.appendChild(button);

  const hr = document.createElement("hr");
  panel.appendChild(hr);
}

// Caricamento di una scena personalizzata da API
async function fetchScene(id: string): Promise<void> {
  try {
    const res = await fetch(`/sandbox-api/scene?id=${encodeURIComponent(id)}`, {
      method: "GET",
      credentials: "include"
    });
    if (!res.ok) throw new Error(`Errore ${res.status}`);
    const html = await res.text();
    wrapper.innerHTML = html;
  } catch (err) {
    wrapper.innerHTML = `<p>Errore caricando scena ${id}</p>`;
    console.error(err);
  }
}

// Avvio
(async () => {
  setupDashboardUI();

  const hasSession = await checkSession();
  if (!hasSession) {
    await injectAndExecute("/static/pages/consent.html");
  } else {
    await injectAndExecute("/static/pages/menu.html");  }
})();
