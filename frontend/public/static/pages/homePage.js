const landingTranslations = {
    it: {
        "document-title": "Pot Tales | Videogioco di archeologia e scienza",
        "meta-description": "Pot Tales è un videogioco educativo online che trasforma la ricerca archeometrica sui residui nelle ceramiche antiche in un’avventura interattiva.",
        "social-description": "Esplora la ricerca archeometrica in un’avventura educativa 2D tra depositi antichi, laboratorio e scoperta scientifica.",
        "nav-home": "Home",
        "nav-project": "Progetto",
        "nav-gallery": "Galleria",
        "nav-team": "Team",
        "skip-link": "Vai al contenuto principale",
        "lang-label": "Lingua:",
        "hero-title": "Un'avventura tra scienza e gioco",
        "hero-desc": "Esplora un laboratorio di ricerca archeologica trasformato in un'esperienza interattiva.",
        "play-button": "Gioca ora",
        "project-title": "Il progetto",
        "subtitle-background": "Il contesto della ricerca",
        "subtitle-research": "Metodologie e scoperte",
        "subtitle-challenge": "La sfida della comunicazione",
        "subtitle-solution": "La soluzione: un videogioco interattivo",
        "project-background": "Questo progetto presenta i risultati di un'innovativa iniziativa didattica che ha coinvolto studenti di diverse discipline nella comunicazione dei risultati di uno studio archeometrico. I depositi neri, che si trovano spesso all'interno di contenitori in ceramica, agiscono come capsule temporali, fornendo preziose intuzioni sulle attività quotidiane del passato.",
        "project-research": "Lo studio approfondito di questi residui, nonché degli oggetti in ceramica stessi, è stato condotto mediante analisi di laboratorio, tra cui analisi petrografica, mineralogica, chimica e spettroscopica, nonché microscopia elettronica e datazione. Ciò ha rivelato dettagli finora sconosciuti sulla vita quotidiana delle comunità antiche, permettendo agli studenti di scoprire storie affascinanti da ambienti domestici e oltre.",
        "project-challenge": "Comunicare efficacemente i risultati della ricerca archeologica non è mai facile; questo progetto si concentra sulla creazione di una narrativa esplorativa in cui i giocatori entrano virtualmente nelle 'profondità oscure' e devono trovare la loro strada per uscire dall'oscurità e scoprire i risultati della ricerca scientifica.",
        "project-solution": "La collaborazione tra studenti di archeologia e informatica, nonché professionisti del settore audiovisivo, ha portato alla creazione di un videogioco online 2D in cui i giocatori possono esplorare questi 'depositi neri' come se fosse una caverna oscura. Gli utenti possono quindi 'emergere dall'oscurità' trovando il percorso giusto, imparando e trovando la loro strada o perdersi nel buio.",
        "team-members": "F. M. Valente • C.D. Baeza Vega • D. Favale • L. Mocchiutti • I. Malliota • I. Garcia Trivès • T.T. Kahveci • R. Buso • A. Cipriani • F. Marcon • I. Rossi • L. Soligo",
        "gallery-title": "Scopri il gioco",
        "team-title": "Il team",
        "team-intro": "Un piccolo gruppo di persone dietro questo progetto:",
        "legacy-footer-text": "AAAAAAAAAAAAA.",
        "footer-text": "© 2026 Pot Tales. Tutti i diritti riservati.",
        "footer-privacy": "Privacy",
        "footer-accessibility": "Accessibilità",
        "footer-html-validator": "Validatore HTML W3C",
        "footer-css-validator": "Validatore CSS W3C",
        "back-to-top-label": "Torna in su",
        "carousel-pause": "Pausa carosello",
        "carousel-resume": "Riprendi carosello",
        "carousel-label": "Carosello di schermate del gioco",
        "carousel-dots-label": "Seleziona una schermata",
        "slide-label": "Schermata {current} di {total}"
    },
    en: {
        "document-title": "Pot Tales | Archaeology and science educational game",
        "meta-description": "Pot Tales is an online educational game that turns archaeometric research on residues in ancient pottery into an interactive adventure.",
        "social-description": "Explore archaeometric research through a 2D educational adventure spanning ancient residues, laboratory work and scientific discovery.",
        "nav-home": "Home",
        "nav-project": "Project",
        "nav-gallery": "Gallery",
        "nav-team": "Team",
        "skip-link": "Skip to main content",
        "lang-label": "Language:",
        "hero-title": "An adventure between science and game",
        "hero-desc": "Explore a research lab turned into an interactive experience: discover the project by playing it!",
        "play-button": "Play now",
        "project-title": "The project",
        "subtitle-background": "Research context and insights",
        "subtitle-research": "Methods and discoveries",
        "subtitle-challenge": "The communication challenge",
        "subtitle-solution": "The solution: an interactive game",
        "project-background": "This work presents the results of an innovative teaching project that involved students from a wide range of disciplines in communicating the findings of an archacometric study. Black deposits, which are often found inside ceramic containers, act as time capsules, providing valuable insights into past daily activities.",
        "project-research": "In-depth study of these residues, as well as the ceramic objects themselves, was conducted through laboratory analysis, including petrographic, mineralogical, chemical and spectroscopic analyses, as well as electron microscopy and dating. This revealed hitherto unknown details about the daily lives of ancient communities, enabling students to uncover fascinating stories from domestic environments and possibly beyond.",
        "project-challenge": "Effectively communicating the results of archaeological research is never easy; this project focuses on creating an exploratory narrative in which players virtually enter the 'dark depths' and must find their way out of the darkness to discover the results of scientific research.",
        "project-solution": "The collaboration between archaeology and computer science students, as well as professionals in the audiovisual sector, has resulted in the creation of a 2D online video game in which players can explore these 'black deposits' as if they were a dark cave. Users can therefore 'emerge from the darkness' by finding the right path, learning and finding their way or getting lost in the dark.",
        "team-members": "F. M. Valente • C.D. Baeza Vega • D. Favale • L. Mocchiutti • I. Malliota • I. Garcia Trivès • T.T. Kahveci • R. Buso • A. Cipriani • F. Marcon • I. Rossi • L. Soligo",
        "gallery-title": "Discover the game",
        "team-title": "The team",
        "team-intro": "A small bunch of people behind this project:",
        "legacy-footer-text": "AAAAAAAAAAAAA.",
        "footer-text": "© 2026 Pot Tales. All rights reserved.",
        "footer-privacy": "Privacy",
        "footer-accessibility": "Accessibility",
        "footer-html-validator": "W3C HTML validator",
        "footer-css-validator": "W3C CSS validator",
        "back-to-top-label": "Back to top",
        "carousel-pause": "Pause carousel",
        "carousel-resume": "Resume carousel",
        "carousel-label": "Game screenshot carousel",
        "carousel-dots-label": "Select a screenshot",
        "slide-label": "Screenshot {current} of {total}"
    }
};

function updateLandingLang(lang) {
    const dict = landingTranslations[lang] || landingTranslations.it;
    document.documentElement.lang = lang;
    document.title = dict['document-title'];
    document.querySelector('meta[name="description"]')?.setAttribute('content', dict['meta-description']);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', dict['document-title']);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', dict['social-description']);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', dict['document-title']);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', dict['social-description']);
    document.querySelector('[itemprop="description"]')?.setAttribute('content', dict['meta-description']);
    document.querySelector('[itemprop="inLanguage"]')?.setAttribute('content', lang);
    Object.keys(dict).forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            let text = dict[id];
            if (id === 'team-members') {
                text = text.split(' • ').map(name => name.replace(/ /g, ' ')).join(' • ');
            }
            el.textContent = text;
        }
    });
    document.getElementById('primary-navigation').setAttribute('aria-label', lang === 'en' ? 'Primary navigation' : 'Navigazione principale');
    document.getElementById('footer-navigation').setAttribute('aria-label', lang === 'en' ? 'Information and accessibility' : 'Informazioni e accessibilità');
    document.getElementById('footer-wcag').setAttribute('aria-label', lang === 'en' ? 'Static pages conform to WCAG 2.2 level AA' : 'Pagine statiche conformi alle WCAG 2.2 livello AA');
    const backToTopLabel = dict['back-to-top-label'];
    document.getElementById('back-to-top').setAttribute('aria-label', backToTopLabel);
    document.getElementById('back-to-top').setAttribute('title', backToTopLabel);
    carousel.setAttribute('aria-label', dict['carousel-label']);
    carouselDots.setAttribute('aria-label', dict['carousel-dots-label']);
    document.getElementById('carousel-prev').setAttribute('aria-label', lang === 'en' ? 'Previous screenshot' : 'Schermata precedente');
    document.getElementById('carousel-next').setAttribute('aria-label', lang === 'en' ? 'Next screenshot' : 'Schermata successiva');
    Array.from(carouselSlides).forEach((slide, index) => {
        slide.setAttribute('aria-label', dict['slide-label'].replace('{current}', index + 1).replace('{total}', slideCount));
    });
    Array.from(carouselDots.children).forEach((dot, index) => {
        dot.setAttribute('aria-label', dict['slide-label'].replace('{current}', index + 1).replace('{total}', slideCount));
    });
    updateAutoplayButton();
}

const landingLangSelect = document.getElementById("lang-select");
const goToPlay = () => window.location.href = '/play';
document.getElementById('play-button').addEventListener('click', goToPlay);

const landingScroll = document.getElementById('landing-scroll');
const landingFooter = document.getElementById('landing-footer');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const scrollBehavior = () => reducedMotion.matches ? 'auto' : 'smooth';
document.querySelectorAll('#primary-navigation a[href^="#"]').forEach(link => {
    link.addEventListener('click', event => {
        const target = document.querySelector(link.getAttribute('href'));
        if (!target) return;
        event.preventDefault();
        const top = target.getBoundingClientRect().top - landingScroll.getBoundingClientRect().top + landingScroll.scrollTop;
        landingScroll.scrollTo({ top: Math.max(0, top), behavior: scrollBehavior() });
        history.replaceState(null, '', link.getAttribute('href'));
    });
});

const backToTop = document.getElementById('back-to-top');
backToTop.addEventListener('click', () => {
    landingScroll.scrollTo({ top: 0, behavior: scrollBehavior() });
});

function updateBackToTop() {
    backToTop.classList.toggle('is-visible', landingScroll.scrollTop > 320);
    const footerOverlap = Math.max(0, window.innerHeight - landingFooter.getBoundingClientRect().top);
    backToTop.style.bottom = `${24 + footerOverlap}px`;
}

landingScroll.addEventListener('scroll', updateBackToTop, { passive: true });
window.addEventListener('resize', updateBackToTop);
updateBackToTop();

const carousel = document.getElementById('carousel');
const carouselTrack = document.getElementById('carousel-track');
const carouselSlides = carouselTrack.children;
const carouselDots = document.getElementById('carousel-dots');
const slideCount = carouselSlides.length;
let currentSlide = 0;
let autoplayTimer = null;
let autoplayPaused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let touchStartX = 0;
let touchEndX = 0;

for (let i = 0; i < slideCount; i++) {
    const dot = document.createElement('button');
    dot.classList.add('carousel-dot');
    dot.type = 'button';
    dot.addEventListener('click', () => goToSlide(i));
    carouselDots.appendChild(dot);
}
const dotElements = carouselDots.children;

function goToSlide(index) {
    currentSlide = (index + slideCount) % slideCount;
    carouselTrack.style.transform = `translateX(-${currentSlide * 100}%)`;
    for (let i = 0; i < dotElements.length; i++) {
        dotElements[i].classList.toggle('active', i === currentSlide);
        dotElements[i].setAttribute('aria-current', i === currentSlide ? 'true' : 'false');
        carouselSlides[i].setAttribute('aria-hidden', i === currentSlide ? 'false' : 'true');
    }
}

function startAutoplay() {
    stopAutoplay();
    if (autoplayPaused || document.hidden) return;
    autoplayTimer = setInterval(() => goToSlide(currentSlide + 1), 4000);
}

function stopAutoplay() {
    clearInterval(autoplayTimer);
    autoplayTimer = null;
}

function updateAutoplayButton() {
    const dict = landingTranslations[landingLangSelect.value] || landingTranslations.it;
    const toggle = document.getElementById('carousel-toggle');
    toggle.textContent = autoplayPaused ? dict['carousel-resume'] : dict['carousel-pause'];
    toggle.setAttribute('aria-pressed', autoplayPaused ? 'true' : 'false');
}

function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
            goToSlide(currentSlide + 1);
        } else {
            goToSlide(currentSlide - 1);
        }
    }
}

document.getElementById('carousel-prev').addEventListener('click', () => goToSlide(currentSlide - 1));
document.getElementById('carousel-next').addEventListener('click', () => goToSlide(currentSlide + 1));
document.getElementById('carousel-toggle').addEventListener('click', () => {
    autoplayPaused = !autoplayPaused;
    if (autoplayPaused) stopAutoplay();
    else startAutoplay();
    updateAutoplayButton();
});

carousel.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    stopAutoplay();
}, false);

carousel.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
    startAutoplay();
}, false);

carousel.addEventListener('mouseenter', stopAutoplay);
carousel.addEventListener('mouseleave', startAutoplay);
carousel.addEventListener('focusin', stopAutoplay);
carousel.addEventListener('focusout', startAutoplay);
document.addEventListener('visibilitychange', () => document.hidden ? stopAutoplay() : startAutoplay());

const initialLang = localStorage.getItem("lang") || "it";
landingLangSelect.value = initialLang;
updateLandingLang(initialLang);
localStorage.setItem("lang", initialLang);

landingLangSelect.addEventListener("change", () => {
    localStorage.setItem("lang", landingLangSelect.value);
    updateLandingLang(landingLangSelect.value);
});

goToSlide(0);
startAutoplay();
