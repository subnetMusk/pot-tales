import apm, { enableApm } from "./apm-rum-config.js";
import {
    clearPrivacyChoice,
    discardLegacyConsent,
    getPrivacyChoice,
    hasAnalyticsConsent,
    setPrivacyChoice,
    type PrivacyChoice,
} from "./privacy/consent";

const wrapper = document.getElementById("wrapper");

if (!wrapper) throw new Error("Elemento #wrapper non trovato nel DOM.");

(window as any).apm = apm;
(window as any).elasticApm = apm;
discardLegacyConsent();

async function injectAndExecute(path: string): Promise<void> {
    try {
        const res = await fetch(path, {
            credentials: "include",
            cache: "no-store",
        });
        if (!res.ok) throw new Error(`Errore ${res.status} caricando ${path}`);

        wrapper!.innerHTML = await res.text();
        const scripts = Array.from(wrapper!.querySelectorAll("script"));
        for (const oldScript of scripts) {
            if (!oldScript.src) {
                throw new Error(`Script inline non ammesso dalla CSP in ${path}`);
            }

            const newScript = document.createElement("script");
            for (const attr of oldScript.attributes) newScript.setAttribute(attr.name, attr.value);
            newScript.src = oldScript.src;
            oldScript.remove();

            await new Promise<void>((resolve, reject) => {
                newScript.addEventListener("load", () => {
                    newScript.remove();
                    resolve();
                }, { once: true });
                newScript.addEventListener("error", () => {
                    newScript.remove();
                    reject(new Error(`Errore caricando lo script ${newScript.src}`));
                }, { once: true });
                document.body.appendChild(newScript);
            });
        }
    } catch (err) {
        console.error("Errore in injectAndExecute:", err);
        wrapper!.innerHTML = '<main class="legal-screen"><section class="legal-card"><h1>Qualcosa non ha funzionato</h1><div class="legal-copy"><p>Non siamo riusciti a caricare questa schermata. Riprova tra poco.</p></div></section></main>';
    }
}

// Telefono/tablet: user agent noto oppure puntatore primario grossolano, touch
// e schermo compatto. Un laptop touch con mouse rimane quindi utilizzabile.
function isTouchOnlyPortableDevice(): boolean {
    const mobileUserAgent = /Android|iPhone|iPad|iPod|Windows Phone|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const touchPortable = navigator.maxTouchPoints > 0
        && window.matchMedia("(pointer: coarse)").matches
        && Math.min(window.screen.width, window.screen.height) < 1024;
    return mobileUserAgent || touchPortable;
}

async function showPrivacy(): Promise<void> {
    document.title = "Privacy | Pot Tales";
    await injectAndExecute("/static/pages/privacy.html");
}

async function showAccessibility(): Promise<void> {
    document.title = "Accessibility | Pot Tales";
    await injectAndExecute("/static/pages/accessibility.html");
}

async function enterGame(): Promise<void> {
    document.title = "Play | Pot Tales";
    if (isTouchOnlyPortableDevice()) {
        await showMobileBlocked();
        return;
    }

    const choice = getPrivacyChoice();
    if (!choice) {
        await injectAndExecute("/static/pages/consent.html");
        return;
    }

    if (choice === "all") await enableApm();
    await startGame();
}

async function choosePrivacy(choice: PrivacyChoice, lang?: string): Promise<void> {
    if (lang === "it" || lang === "en") localStorage.setItem("lang", lang);
    setPrivacyChoice(choice);
    if (choice === "all") await enableApm();
    await startGame();
}

async function showMobileBlocked(): Promise<void> {
    document.title = "Desktop only | Pot Tales";
    await injectAndExecute("/static/pages/desktopOnly.html");
}

async function startGame(): Promise<void> {
    await injectAndExecute("/static/pages/game.html");
    void import("./loader.js");
}

function returnToLanding(): void {
    clearPrivacyChoice();
    window.location.assign("/");
}

function changePrivacyChoice(): void {
    clearPrivacyChoice();
    window.location.assign("/play");
}

(window as any).injectAndExecute = injectAndExecute;
(window as any).showPrivacy = showPrivacy;
(window as any).showAccessibility = showAccessibility;
(window as any).enterGame = enterGame;
(window as any).showMobileBlocked = showMobileBlocked;
(window as any).startGame = startGame;
(window as any).acceptAll = (lang?: string) => choosePrivacy("all", lang);
(window as any).acceptNecessary = (lang?: string) => choosePrivacy("necessary", lang);
(window as any).returnToLanding = returnToLanding;
(window as any).changePrivacyChoice = changePrivacyChoice;
(window as any).hasAnalyticsConsent = hasAnalyticsConsent;

(async () => {
    if (window.location.pathname === "/info" || window.location.pathname.startsWith("/info/")) {
        window.location.replace("/");
    }
    else if (window.location.pathname.startsWith("/privacy")) await showPrivacy();
    else if (window.location.pathname.startsWith("/accessibility") || window.location.pathname.startsWith("/accessibilita")) await showAccessibility();
    else if (window.location.pathname.startsWith("/play")) await enterGame();
    else {
        document.title = "Home | Pot Tales";
        await injectAndExecute("/static/pages/homePage.html");
    }
})();
