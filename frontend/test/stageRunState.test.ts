// Test dello stato di partita di Stage2/Stage3 e delle regole di Resume e porta
// (src/items/stageRunState.ts). Girano con il runner di Node: `npm test` o `make frontend-test`.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
	DOOR_TRIGGER_RADIUS,
	allQuizzesSolved,
	createStage2RunState,
	createStage3RunState,
	isWithinDoorTrigger
} from "../src/items/stageRunState.ts";

// Stesse chiavi di Stage3.quizConfig.
const QUIZ_KEYS = ["lipidi", "cellulosa", "carbon"];
const SOLVED = QUIZ_KEYS.map(key => `stage3_${key}_solved`);

// Geometria di Stage3.editorCreate(): centro della porta, spawn del giocatore, banchi dei quiz.
const DOOR = { x: 74, y: 41 };
const SPAWN = { x: 69, y: 76 };
const QUIZ_BENCHES = [{ x: 119, y: 66 }, { x: 54, y: 95 }, { x: 18, y: 66 }];
// Raggio d'interazione dei banchi, impostato in Stage3.create().
const INTERACTION_RADIUS = 20;
// Il bound superiore del giocatore (da y-3) urta gli arredi, che arrivano fino a y=54, quando y < 57.
const GAP_MOUTH_Y = 57;

const STAGE2_NEW_RUN = {
	laserActive: false,
	activeShooter: false,
	stageComplete: false,
	currentShooterLevel: 1,
	beamGlowBoost: 0
};

const STAGE3_NEW_RUN = {
	recapShown: false,
	doorOpened: false,
	finaleStarted: false
};

describe("createStage2RunState", () => {
	test("una partita nuova parte con laser e Shooter spenti, al livello 1, stage non completato", () => {
		assert.deepEqual(createStage2RunState(), STAGE2_NEW_RUN);
	});

	test("lo stato di una partita conclusa non passa alla successiva", () => {
		const conclusa = createStage2RunState();
		conclusa.laserActive = true;
		conclusa.activeShooter = true;
		conclusa.stageComplete = true;
		conclusa.currentShooterLevel = 3;
		conclusa.beamGlowBoost = 1;

		const nuova = createStage2RunState();
		assert.notEqual(nuova, conclusa);
		assert.deepEqual(nuova, STAGE2_NEW_RUN);
	});
});

describe("createStage3RunState", () => {
	test("una partita nuova parte senza recap, con la porta chiusa e senza finale", () => {
		assert.deepEqual(createStage3RunState(), STAGE3_NEW_RUN);
	});

	test("lo stato di una partita conclusa non passa alla successiva", () => {
		const conclusa = createStage3RunState();
		conclusa.recapShown = true;
		conclusa.doorOpened = true;
		conclusa.finaleStarted = true;

		const nuova = createStage3RunState();
		assert.notEqual(nuova, conclusa);
		assert.deepEqual(nuova, STAGE3_NEW_RUN);
	});
});

describe("allQuizzesSolved", () => {
	test("senza checkpoint non c'è niente da ripristinare", () => {
		assert.equal(allQuizzesSolved(undefined, QUIZ_KEYS), false);
		assert.equal(allQuizzesSolved([], QUIZ_KEYS), false);
	});

	test("con due quiz su tre la porta resta chiusa", () => {
		for (const missing of SOLVED) {
			const checkpoints = ["game_started", "stage1_complete", "stage2_complete", ...SOLVED.filter(c => c !== missing)];
			assert.equal(allQuizzesSolved(checkpoints, QUIZ_KEYS), false, `manca ${missing}`);
		}
	});

	test("con tutti e tre i quiz risolti, in qualunque ordine e fra altri checkpoint, la porta va aperta", () => {
		const checkpoints = ["stage2_complete", ...[...SOLVED].reverse(), "stage3_complete"];
		assert.equal(allQuizzesSolved(checkpoints, QUIZ_KEYS), true);
	});

	test("conta solo i checkpoint esatti", () => {
		assert.equal(allQuizzesSolved(["stage3_lipidi_solved", "stage3_cellulosa_solved", "stage3_carbon"], QUIZ_KEYS), false);
	});

	test("senza quiz da controllare non apre niente", () => {
		assert.equal(allQuizzesSolved(SOLVED, []), false);
	});
});

describe("isWithinDoorTrigger", () => {
	test("dentro il varco la cinematica parte", () => {
		assert.equal(isWithinDoorTrigger(DOOR.x, DOOR.y, DOOR.x, DOOR.y), true);
		assert.equal(isWithinDoorTrigger(DOOR.x, 45, DOOR.x, DOOR.y), true);
	});

	test("fermo all'imbocco del varco, anche fuori asse, la cinematica parte", () => {
		// A 16px dal centro: con la soglia precedente (15) il giocatore restava fermo qui.
		assert.equal(isWithinDoorTrigger(DOOR.x, GAP_MOUTH_Y, DOOR.x, DOOR.y), true);
		assert.equal(isWithinDoorTrigger(DOOR.x - 13, GAP_MOUTH_Y, DOOR.x, DOOR.y), true);
		assert.equal(isWithinDoorTrigger(DOOR.x + 13, GAP_MOUTH_Y, DOOR.x, DOOR.y), true);
	});

	test("il raggio è esclusivo", () => {
		assert.equal(isWithinDoorTrigger(DOOR.x, DOOR.y + DOOR_TRIGGER_RADIUS, DOOR.x, DOOR.y), false);
		assert.equal(isWithinDoorTrigger(DOOR.x - 14, GAP_MOUTH_Y, DOOR.x, DOOR.y), false);
	});

	test("dallo spawn e dai banchi dei quiz non parte da sola", () => {
		// La porta si apre subito dopo il terzo quiz, con il giocatore ancora a un banco: anche il
		// punto più vicino alla porta da cui si interagisce con un banco deve restare fuori raggio.
		assert.equal(isWithinDoorTrigger(SPAWN.x, SPAWN.y, DOOR.x, DOOR.y), false);
		for (const bench of QUIZ_BENCHES) {
			const distance = Math.hypot(bench.x - DOOR.x, bench.y - DOOR.y);
			const ratio = (distance - INTERACTION_RADIUS) / distance;
			const closestX = DOOR.x + (bench.x - DOOR.x) * ratio;
			const closestY = DOOR.y + (bench.y - DOOR.y) * ratio;
			assert.equal(isWithinDoorTrigger(closestX, closestY, DOOR.x, DOOR.y), false, `banco in (${bench.x}, ${bench.y})`);
		}
	});
});
