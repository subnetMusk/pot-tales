(() => {
  const langSelect = document.getElementById("privacy-lang-select");
  const labels = {
    it: { kicker: "Pot Tales · Informativa", title: "Privacy e cookie", subtitle: "Cosa raccogliamo, perché e per quanto tempo.", language: "Lingua:", game: "Torna al gioco", landing: "Torna alla home" },
    en: { kicker: "Pot Tales · Notice", title: "Privacy and cookies", subtitle: "What we collect, why, and for how long.", language: "Language:", game: "Back to the game", landing: "Back to home" }
  };
  const applyLanguage = lang => {
    const selected = labels[lang] ? lang : "it";
    const t = labels[selected];
    document.documentElement.lang = selected;
    document.getElementById("privacy-kicker").textContent = t.kicker;
    document.getElementById("privacy-title").textContent = t.title;
    document.getElementById("privacy-subtitle").textContent = t.subtitle;
    document.getElementById("privacy-lang-label").textContent = t.language;
    document.getElementById("privacy-back-game").textContent = t.game;
    document.getElementById("privacy-back-landing").textContent = t.landing;
    document.getElementById("privacy-content-it").hidden = selected !== "it";
    document.getElementById("privacy-content-en").hidden = selected !== "en";
  };
  langSelect.value = localStorage.getItem("lang") || "it";
  applyLanguage(langSelect.value);
  langSelect.addEventListener("change", () => {
    localStorage.setItem("lang", langSelect.value);
    applyLanguage(langSelect.value);
  });
  document.getElementById("privacy-back-game").addEventListener("click", () => window.location.assign("/play"));
  document.getElementById("privacy-back-landing").addEventListener("click", () => window.returnToLanding());
})();
