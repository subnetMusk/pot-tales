// Tenuta della barra spaziatrice per saltare un video (VideoPlayer): quanto a lungo tenerla e
// quanta parte del tasto illuminare nel frattempo.
//
// Il modulo non importa Phaser, così lo si può testare con il runner di Node (vedi
// frontend/test/skipHold.test.ts).

export const SKIP_HOLD_MS = 2000;

// Righe del tasto nel frame "premuto" (1) di spacebar.png, 64x64: quelle opache vanno dalla 23
// alla 42 comprese. Sopra e sotto il frame è trasparente.
export const SKIP_KEY_ROWS = { top: 23, bottom: 43 };

// Altezza del ritaglio (in pixel del frame, dall'alto) che mostra il riempimento del tasto dopo
// heldMs di tenuta: a 0 non copre nessuna riga del tasto, a SKIP_HOLD_MS lo copre tutto, e nel
// mezzo scende di pari passo con il tempo.
export function skipFillCropHeight(heldMs: number): number {
	const progress = Math.min(Math.max(heldMs / SKIP_HOLD_MS, 0), 1);
	return SKIP_KEY_ROWS.top + (SKIP_KEY_ROWS.bottom - SKIP_KEY_ROWS.top) * progress;
}
