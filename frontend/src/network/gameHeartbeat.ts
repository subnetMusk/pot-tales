// Usa l'orologio del browser: la pausa di una scena Phaser non ferma il ping.
// Una sola richiesta per volta; lo stop impedisce anche a una risposta tardiva
// di intervenire su una scena ormai chiusa.
export function startGameHeartbeat(
    send: (isCurrent: () => boolean) => Promise<void>,
    schedule: (callback: () => void, ms: number) => unknown = (fn, ms) => setInterval(fn, ms),
    cancel: (handle: unknown) => void = handle => clearInterval(handle as ReturnType<typeof setInterval>),
): () => void {
    let active = true;
    let pending = false;
    const handle = schedule(() => {
        if (!active || pending) return;
        pending = true;
        void send(() => active).finally(() => { pending = false; });
    }, 7000);
    return () => {
        if (!active) return;
        active = false;
        cancel(handle);
    };
}
