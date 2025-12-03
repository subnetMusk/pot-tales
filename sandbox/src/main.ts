const wrapper = document.getElementById("wrapper");
const panel = document.getElementById("dashboard-panel");

if (!wrapper || !panel) {
  throw new Error("Elemento DOM mancante (#wrapper o #dashboard-panel)");
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