(() => {
  const translations = {
    it: {
      kicker: "Un piccolo intoppo",
      title: "Questa avventura vuole un PC",
      subtitle: "Per ora servono tastiera e mouse.",
      desc: "Hai aperto Pot Tales da uno smartphone o tablet. Il gioco non è ancora ottimizzato per i comandi touch.",
      redirect: seconds => `Tra ${seconds} secondi tornerai alla home.`,
      cancelled: "Reindirizzamento automatico annullato. Puoi tornare alla home quando vuoi.",
      back: "Torna alla home",
      cancel: "Resta su questa pagina",
      language: "Lingua:"
    },
    en: {
      kicker: "A small obstacle",
      title: "This adventure needs a PC",
      subtitle: "For now, you will need a keyboard and mouse.",
      desc: "You opened Pot Tales on a smartphone or tablet. The game is not yet optimised for touch controls.",
      redirect: seconds => `You will return home in ${seconds} seconds.`,
      cancelled: "Automatic redirect cancelled. You can return home whenever you want.",
      back: "Back to home",
      cancel: "Stay on this page",
      language: "Language:"
    }
  };

  const langSelect = document.getElementById("mobile-lang-select");
  let seconds = 15;
  let redirectCancelled = false;
  const applyLanguage = lang => {
    const t = translations[lang] || translations.it;
    document.documentElement.lang = lang;
    document.getElementById("mobile-blocked-kicker").textContent = t.kicker;
    document.getElementById("mobile-blocked-title").textContent = t.title;
    document.getElementById("mobile-blocked-subtitle").textContent = t.subtitle;
    document.getElementById("mobile-blocked-desc").textContent = t.desc;
    document.getElementById("mobile-blocked-redirect").textContent = redirectCancelled ? t.cancelled : t.redirect(seconds);
    document.getElementById("mobile-back").textContent = t.back;
    document.getElementById("mobile-cancel").textContent = t.cancel;
    document.getElementById("mobile-lang-label").textContent = t.language;
  };

  langSelect.value = localStorage.getItem("lang") || "it";
  applyLanguage(langSelect.value);
  langSelect.addEventListener("change", () => {
    localStorage.setItem("lang", langSelect.value);
    applyLanguage(langSelect.value);
  });
  document.getElementById("mobile-back").addEventListener("click", () => window.returnToLanding());

  const timer = window.setInterval(() => {
    seconds -= 1;
    applyLanguage(langSelect.value);
    if (seconds <= 0) {
      window.clearInterval(timer);
      window.returnToLanding();
    }
  }, 1000);
  document.getElementById("mobile-cancel").addEventListener("click", () => {
    redirectCancelled = true;
    window.clearInterval(timer);
    applyLanguage(langSelect.value);
    document.getElementById("mobile-cancel").hidden = true;
    document.getElementById("mobile-back").focus();
  });
})();
