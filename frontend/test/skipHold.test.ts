// Test del riempimento della barra spaziatrice durante lo skip dei video
// (src/items/skipHold.ts). Girano con il runner di Node: `npm test` o `make frontend-test`.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { SKIP_HOLD_MS, SKIP_KEY_ROWS, skipFillCropHeight } from "../src/items/skipHold.ts";

describe("skipFillCropHeight", () => {
	test("appena premuta, il ritaglio si ferma sopra il tasto: niente di illuminato", () => {
		assert.equal(skipFillCropHeight(0), SKIP_KEY_ROWS.top);
	});

	test("a metà tenuta è illuminata metà del tasto", () => {
		assert.equal(skipFillCropHeight(SKIP_HOLD_MS / 2), (SKIP_KEY_ROWS.top + SKIP_KEY_ROWS.bottom) / 2);
	});

	test("a tenuta completa il tasto è illuminato tutto, e oltre non cresce", () => {
		assert.equal(skipFillCropHeight(SKIP_HOLD_MS), SKIP_KEY_ROWS.bottom);
		assert.equal(skipFillCropHeight(SKIP_HOLD_MS * 3), SKIP_KEY_ROWS.bottom);
	});

	test("un tempo negativo (orologio della scena ripartito) non illumina niente", () => {
		assert.equal(skipFillCropHeight(-500), SKIP_KEY_ROWS.top);
	});

	test("cresce in modo graduale, senza salti", () => {
		let precedente = skipFillCropHeight(0);
		for (let ms = 100; ms <= SKIP_HOLD_MS; ms += 100) {
			const attuale = skipFillCropHeight(ms);
			assert.ok(attuale > precedente, `a ${ms}ms`);
			assert.ok(attuale - precedente <= 1.01, `passo troppo ampio a ${ms}ms`);
			precedente = attuale;
		}
	});
});
