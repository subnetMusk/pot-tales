(() => {
  const translations = {
    it: {
      kicker: "Prima di cominciare",
      title: "Privacy e dati di gioco",
      subtitle: "Scegli tu come vivere l’avventura.",
      essential: "<strong>Necessari.</strong> Servono per avviare e salvare temporaneamente la partita, proteggere il servizio, ricordare la lingua e contare in forma anonima le partite avviate. Puoi giocare normalmente.",
      analytics: "<strong>Analitici facoltativi.</strong> Ci aiutano a capire, con identificativi pseudonimi, scene e traguardi raggiunti, durata, classe del dispositivo, errori e prestazioni. Non usiamo pubblicità né profilazione commerciale.",
      retention: "I dati grezzi sono conservati per non più di 30 giorni e possono essere cancellati prima alla dismissione del server.",
      minors: "Selezionando “Accetta tutti” dichiari di avere almeno 14 anni oppure che la scelta è stata compiuta o autorizzata da chi esercita la responsabilità genitoriale. Se hai meno di 14 anni puoi comunque giocare selezionando “Accetta necessari”.",
      privacy: "Leggi l’informativa completa",
      accessibility: "Accessibilità",
      summary: "Riepilogo privacy",
      information: "Informazioni",
      all: "Accetta tutti",
      necessary: "Accetta necessari",
      back: "Torna indietro",
      language: "Lingua:"
    },
    en: {
      kicker: "Before you begin",
      title: "Privacy and game data",
      subtitle: "Choose how you want to experience the adventure.",
      essential: "<strong>Necessary.</strong> These functions start and temporarily save the game, protect the service, remember your language and anonymously count started games. You can play normally.",
      analytics: "<strong>Optional analytics.</strong> They help us understand, using pseudonymous identifiers, scenes and milestones reached, duration, device class, errors and performance. We use neither advertising nor commercial profiling.",
      retention: "Raw data is kept for no longer than 30 days and may be deleted earlier when the server is decommissioned.",
      minors: "By selecting “Accept all”, you declare that you are at least 14 years old, or that the choice was made or authorised by a person exercising parental responsibility. If you are under 14, you can still play by selecting “Accept necessary”.",
      privacy: "Read the full privacy notice",
      accessibility: "Accessibility",
      summary: "Privacy summary",
      information: "Information",
      all: "Accept all",
      necessary: "Accept necessary",
      back: "Go back",
      language: "Language:"
    }
  };

  const langSelect = document.getElementById("consent-lang-select");
  const applyLanguage = lang => {
    const t = translations[lang] || translations.it;
    document.documentElement.lang = lang;
    document.getElementById("consent-kicker").textContent = t.kicker;
    document.getElementById("consent-title").textContent = t.title;
    document.getElementById("consent-subtitle").textContent = t.subtitle;
    document.getElementById("consent-essential").innerHTML = t.essential;
    document.getElementById("consent-analytics").innerHTML = t.analytics;
    document.getElementById("consent-retention").textContent = t.retention;
    document.getElementById("consent-minors").textContent = t.minors;
    document.getElementById("privacy-link").textContent = t.privacy;
    document.getElementById("accessibility-link").textContent = t.accessibility;
    document.getElementById("consent-summary").setAttribute("aria-label", t.summary);
    document.getElementById("consent-info-links").setAttribute("aria-label", t.information);
    document.getElementById("accept-all").textContent = t.all;
    document.getElementById("accept-necessary").textContent = t.necessary;
    document.getElementById("return-landing").textContent = t.back;
    document.getElementById("consent-lang-label").textContent = t.language;
  };

  langSelect.value = localStorage.getItem("lang") || "it";
  applyLanguage(langSelect.value);
  langSelect.addEventListener("change", () => {
    localStorage.setItem("lang", langSelect.value);
    applyLanguage(langSelect.value);
  });
  document.getElementById("accept-all").addEventListener("click", () => window.acceptAll(langSelect.value));
  document.getElementById("accept-necessary").addEventListener("click", () => window.acceptNecessary(langSelect.value));
  document.getElementById("return-landing").addEventListener("click", () => window.returnToLanding());
})();
