(() => {
  const langSelect = document.getElementById("accessibility-lang-select");
  const labels = {
    it: { kicker: "Pot Tales · Accessibilità", title: "Dichiarazione di accessibilità", subtitle: "Il nostro impegno e i limiti attuali.", language: "Lingua:", home: "Torna alla home" },
    en: { kicker: "Pot Tales · Accessibility", title: "Accessibility statement", subtitle: "Our commitment and current limitations.", language: "Language:", home: "Back to home" }
  };
  const applyLanguage = lang => {
    const selected = labels[lang] ? lang : "it";
    const t = labels[selected];
    document.documentElement.lang = selected;
    document.getElementById("accessibility-kicker").textContent = t.kicker;
    document.getElementById("accessibility-title").textContent = t.title;
    document.getElementById("accessibility-subtitle").textContent = t.subtitle;
    document.getElementById("accessibility-lang-label").textContent = t.language;
    document.getElementById("accessibility-back-home").textContent = t.home;
    document.getElementById("accessibility-content-it").hidden = selected !== "it";
    document.getElementById("accessibility-content-en").hidden = selected !== "en";
  };
  langSelect.value = localStorage.getItem("lang") || "it";
  applyLanguage(langSelect.value);
  langSelect.addEventListener("change", () => {
    localStorage.setItem("lang", langSelect.value);
    applyLanguage(langSelect.value);
  });
  document.getElementById("accessibility-back-home").addEventListener("click", () => window.returnToLanding());
})();
