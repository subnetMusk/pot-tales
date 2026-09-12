export type PrivacyChoice = "all" | "necessary";

const STORAGE_KEY = "pot-tales.privacy-choice";
const LEGACY_KEY = "consentGiven";

export function getPrivacyChoice(): PrivacyChoice | null {
    const value = sessionStorage.getItem(STORAGE_KEY);
    return value === "all" || value === "necessary" ? value : null;
}

export function setPrivacyChoice(choice: PrivacyChoice): void {
    sessionStorage.setItem(STORAGE_KEY, choice);
    localStorage.removeItem(LEGACY_KEY);
}

export function clearPrivacyChoice(): void {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_KEY);
}

export function hasAnalyticsConsent(): boolean {
    return getPrivacyChoice() === "all";
}

export function discardLegacyConsent(): void {
    localStorage.removeItem(LEGACY_KEY);
}
