// Test di listenUntilDestroyed (src/items/sceneListeners.ts). Girano con il runner di Node:
// `npm test` o `make frontend-test`.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { listenUntilDestroyed } from "../src/items/sceneListeners.ts";

type Listener = (...args: any[]) => void;

// Emitter minimo con la stessa semantica di on/once/off/emit dell'EventEmitter di Phaser.
class EmitterFinto {
	private listeners = new Map<string, Listener[]>();

	on(event: string, fn: Listener) {
		this.listeners.set(event, [...(this.listeners.get(event) ?? []), fn]);
		return this;
	}

	once(event: string, fn: Listener) {
		const wrapper: Listener = (...args) => {
			this.off(event, wrapper);
			fn(...args);
		};
		return this.on(event, wrapper);
	}

	off(event: string, fn: Listener) {
		this.listeners.set(event, (this.listeners.get(event) ?? []).filter(l => l !== fn));
		return this;
	}

	emit(event: string, ...args: unknown[]) {
		for (const fn of [...(this.listeners.get(event) ?? [])]) {
			fn(...args);
		}
	}

	count(event: string) {
		return this.listeners.get(event)?.length ?? 0;
	}
}

// Un Player ridotto all'osso: registra un listener di update sulla scena e, una volta
// distrutto, fallisce se viene ancora chiamato, come il vero Player con this.scene undefined.
class PlayerFinto extends EmitterFinto {
	aggiornamenti = 0;
	distrutto = false;

	constructor(sceneEvents: EmitterFinto) {
		super();
		listenUntilDestroyed(sceneEvents, "update", () => {
			if (this.distrutto) {
				throw new TypeError("can't access property \"cameras\", this.scene is undefined");
			}
			this.aggiornamenti++;
		}, this);
	}

	destroy() {
		this.emit("destroy");
		this.distrutto = true;
	}
}

describe("listenUntilDestroyed", () => {
	test("finché il proprietario vive il listener riceve gli eventi con i loro argomenti", () => {
		const target = new EmitterFinto();
		const owner = new EmitterFinto();
		const ricevuti: unknown[] = [];

		listenUntilDestroyed(target, "update", (time: number) => ricevuti.push(time), owner);
		target.emit("update", 16);
		target.emit("update", 33);

		assert.deepEqual(ricevuti, [16, 33]);
	});

	test("distrutto il proprietario, il listener viene tolto", () => {
		const target = new EmitterFinto();
		const owner = new EmitterFinto();
		let chiamate = 0;

		listenUntilDestroyed(target, "update", () => chiamate++, owner);
		owner.emit("destroy");
		target.emit("update", 16);

		assert.equal(chiamate, 0);
		assert.equal(target.count("update"), 0);
	});

	test("una scena riavviata nella stessa pagina non chiama il Player della partita precedente", () => {
		// Gli eventi della scena sono gli stessi fra una partita e l'altra: è il caso di
		// "Gioca" o "Continua" dopo una partita finita.
		const sceneEvents = new EmitterFinto();

		const primo = new PlayerFinto(sceneEvents);
		sceneEvents.emit("update");
		primo.destroy();

		const secondo = new PlayerFinto(sceneEvents);
		assert.doesNotThrow(() => sceneEvents.emit("update"));

		assert.equal(primo.aggiornamenti, 1);
		assert.equal(secondo.aggiornamenti, 1);
		assert.equal(sceneEvents.count("update"), 1);
	});
});
