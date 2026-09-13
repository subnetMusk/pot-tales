// You can write more code here
import Player from "@/items/Main/Player";
import PopupManager from "../items/UI/PopupManager";
import { applyTranslations, launchSubScene, playSequence, reloadTranslations } from "../utils";
import {APISession} from "../network/APISession";

import OggettoInterattivo from "../items/Main/OggettoInterattivo";
import { ambientDrift } from "../items/ParticleFx";
import { soundManager } from "../audio/SoundManager";

/* START OF COMPILED CODE */

class Stage1 extends Phaser.Scene {

	constructor() {
		super("Stage1");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

		// background
		this.add.image(640, 360, "BG");

		// blackMass
		const blackMass = new OggettoInterattivo(this, 682, 568, "black_mass", 0);
		this.add.existing(blackMass);

		// rectangle_3
		const rectangle_3 = this.add.rectangle(640, -160, 1360, 30);

		// rectangle_4
		const rectangle_4 = this.add.rectangle(640, 880, 1360, 30);

		// rectangle_5
		const rectangle_5 = this.add.rectangle(-55, 360, 30, 1070);

		// rectangle_6
		const rectangle_6 = this.add.rectangle(1335, 360, 30, 1070);

		// player
		const player = new Player(this, 355, 223);
		this.add.existing(player);

		// lists
		const boundaries = [rectangle_6, rectangle_5, rectangle_4, rectangle_3];
		const oggVector = [blackMass];

		this.blackMass = blackMass;
		this.player = player;
		this.boundaries = boundaries;
		this.oggVector = oggVector;

		this.events.emit("scene-awake");
	}

	private blackMass!: OggettoInterattivo;
	private player!: Player;
	private boundaries!: Phaser.GameObjects.Rectangle[];
	private oggVector!: OggettoInterattivo[];

	/* START-USER-CODE */
	private apiSession!: APISession;

	private popupManager!: PopupManager;

	// Stato del minigioco di memoria (serve per evitare riavvii multipli)
	private isGraficoActive: boolean = false;

	private loadedLang!: string;

	private pingTimer?: Phaser.Time.TimerEvent;

	preload() {
		this.load.pack("stage1-pack", "assets/images/stage1-pack.json");
		this.load.pack("player-pack", "assets/images/player-pack.json");
		this.load.pack("icons-pack", "assets/images/icons-pack.json");

		this.loadedLang = localStorage.getItem("lang") || "en";
        this.load.json("stage1_i18n", `assets/i18n/${this.loadedLang}/Stage1.json`);
	}

	create() {

		this.editorCreate();
		this.player.setDepth(10);
		this.apiSession = new APISession();
		// La massa diventa interagibile solo dopo la sequenza delle luci, quando
		// activateBlackMass() le assegna anche il relativo handler.
		this.blackMass.set = false;

		if (!this.anims.exists("strange_light_anim")) {
			this.anims.create({
				key: "strange_light_anim",
				frames: this.anims.generateFrameNumbers("red_light", { start: 0, end: 5 }),
				frameRate: 8,
				repeat: -1
			});
		}

		if (!this.anims.exists("strange_light_anim_fade")) {
			this.anims.create({
				key: "strange_light_anim_fade",
				frames: this.anims.generateFrameNumbers("red_light", { start: 0, end: -1 }),
				frameRate: 8
			});
		}

		if (!this.anims.exists("black_mass_anim")) {
			this.anims.create({
				key: "black_mass_anim",
				frames: this.anims.generateFrameNumbers("black_mass", { start: 0, end: -1 }),
				frameRate: 8,
				repeat: -1
			});
		}

		// Play the black mass animation
		this.blackMass.play("black_mass_anim");

		soundManager.playMusic(this, "stage1_theme", { loop: true });

		this.scheduleAmbientSounds();

		// Applicazione delle traduzioni sui testi già presenti nella scena
		const i18n = this.cache.json.get("stage1_i18n");
		applyTranslations(this, i18n);

		this.events.on("resume", () => {
			const currentLang = localStorage.getItem("lang") || "en";
			if (currentLang !== this.loadedLang) {
				this.loadedLang = currentLang;
				void reloadTranslations(this, "stage1_i18n", `assets/i18n/${currentLang}/Stage1.json`);
			}
		});

		// Configurazione del giocatore
		this.player.debug(false);
		this.player.setBoundaries(this.boundaries);
		this.player.isMovementAllowed = false;

		// Configurazione della telecamera
		this.cameras.main.setZoom(5.0);
		this.cameras.main.roundPixels = true;
        this.cameras.main.startFollow(this.player);

		// Inizializzazione dei manager
		this.popupManager = new PopupManager(this);

		// Ping periodico, come in Stage2: senza segnali la spazzata chiuderebbe per
		// inattivita' una partita ancora in corso qui, e l'ultimo ping e' l'istante
		// fino a cui si misura la durata. La posizione non viene ripristinata al
		// Continue: la scena e' una sequenza a copione senza traguardi intermedi, e
		// ripartire da un altro punto non riprenderebbe nulla.
		this.pingTimer = this.time.addEvent({ delay: 7000, loop: true, callback: () => this.sendPing() });
		this.events.once("shutdown", () => this.pingTimer?.remove());

		/* START-SCENE-LOGIC */

		// Animazione del risveglio con matte nero
		const blackScreen = this.add.rectangle(
			this.cameras.main.centerX, 
			this.cameras.main.centerY, 
			this.cameras.main.width, 
			this.cameras.main.height, 
			0x000000
		);

		blackScreen.setScrollFactor(0, 0);
		blackScreen.setDepth(2000);
		blackScreen.setAlpha(0.2);

		let wakeCount = 0;
		const totalWakes = 4;
		let durations = [1300, 200, 300, 2000]; // Durate dei singoli flash

		const flashSequence = () => {
			// Animazione della chiusura degli occhi (blackScreen alpha 0 -> 1)
			this.tweens.add({
				targets: blackScreen,
				alpha: 1,
				ease: "Linear",
				duration: durations[wakeCount] / 4
			});

			// Dopo la chiusura, animazione della riapertura degli occhi (blackScreen alpha 1 -> 0)
			this.time.delayedCall(durations[wakeCount] / 4, () => {
				this.tweens.add({
					targets: blackScreen,
					alpha: 0,
					ease: "Linear",
					duration: durations[wakeCount] / 2,
					onComplete: () => {
						// Pausa tra un flash e l'altro

						wakeCount++;
						if(wakeCount < totalWakes) this.time.delayedCall(durations[wakeCount] / 4, flashSequence);
						else blackScreen.destroy();
					}
				});
			});
		};

		// Inizio della sequenza di flash
		flashSequence();

		// Mostra il dialogo iniziale SOLO quando l'animazione del risveglio è completa
		blackScreen.on("destroy", () => {
			void playSequence(this.popupManager, [
				i18n.wake_up_1,
				{ message: i18n.wake_up_2_narrator, preset: "dark" },
				{ message: i18n.wake_up_3_narrator, preset: "dark" },
				{ message: i18n.wake_up_4_narrator, preset: "dark" },
				{ message: i18n.wake_up_5_narrator, preset: "dark" },
				{ message: i18n.wake_up_6_narrator, preset: "dark" },
				i18n.wake_up_7,
				i18n.wake_up_8,
				i18n.wake_up_9,
				i18n.wake_up_10,
				i18n.wake_up_11
			]).then(() => {
				// Abilita il movimento del giocatore una volta terminato il dialogo dei suggerimenti
				const hintsDone = playSequence(this.popupManager, [
					{ message: i18n.movement_tutorial, preset: "hint" },
					{ message: i18n.interact_tutorial, preset: "hint" }
				]);
				this.lightInteraction();
				hintsDone.then(() => {
					this.player.isMovementAllowed = true;
				});
			});
		});

		/* END-SCENE-LOGIC */
	}

	// Interazione con la luce rossa ------------------------------------------------------
	private lightsPositions: Array<{x: number, y: number}> = [
		{x: 270, y: 200},
		{x: 348, y: 464},
		{x: 840, y: 0},
		{x: 682, y: 540}
	];
	private currentLightIndex: number = 0;
	private currentLight!: OggettoInterattivo;
	private currentLightDrift?: Phaser.GameObjects.Particles.ParticleEmitter;
	private lightInteraction = () => {
		if (this.currentLightIndex >= this.lightsPositions.length) return;

		this.player.isMovementAllowed = false;
		const i18n = this.cache.json.get("stage1_i18n");

		// this.currentLightIndex = this.lightsPositions.length - 1; // DEBUG: attiva l'ultima luce subito

		// Crea una nuova luce nella posizione successiva
		var light = new OggettoInterattivo(this, this.lightsPositions[this.currentLightIndex].x, this.lightsPositions[this.currentLightIndex].y, "red_light", 0);
		light.setScale(0);
		light.play("strange_light_anim");
		this.add.existing(light);
		light.setDepth(this.player.depth - 1);

		// Animazione di comparsa della luce
		this.tweens.add({
			targets: light,
			scale: 1,
			duration: 500,
			ease: "Linear"
		});

		// Beat di sorpresa sul player solo alla primissima luce; pulviscolo ambientale
		// inquietante attorno alla luce invece è presente per ogni spawn.
		if (this.currentLightIndex === 0) {
			this.player.surprise();
		}
		const drift = ambientDrift(this, light.x, light.y, 40, 40, { tint: 0x661111, frequency: 800 });

		// Configura l'interazione della luce basata sull'indice
		if(this.currentLightIndex === 0) {
			// Prima luce - dialogo lungo con il narratore
			light.setAlpha(0.75);
			light.interagisci = async () => {
				this.player.isMovementAllowed = false;
				this.player.interactionAllowed = false;

				await playSequence(this.popupManager, [
					{ message: i18n.light_1_0_narrator, preset: "dark" },
					i18n.light_1_1,
					i18n.light_1_2,
					{ message: i18n.light_1_3_narrator, preset: "dark" },
					i18n.light_1_4,
					{ message: i18n.light_1_5_narrator, preset: "dark" },
					i18n.light_1_6,
					i18n.light_1_7,
					{ message: i18n.light_1_8_narrator, preset: "dark" },
					i18n.light_1_9,
					{ message: i18n.light_1_10_narrator, preset: "dark" },
					{ message: i18n.light_1_11_narrator, preset: "dark" },
					i18n.light_1_12,
					{ message: i18n.light_1_13_narrator, preset: "dark" }
				]);
				this.lightInteraction();
				this.player.interactionAllowed = true;
			};
		} else if(this.currentLightIndex === 1) {
			// Seconda luce - solo narratore
			light.setAlpha(0.75);
			light.interagisci = async () => {
				this.player.isMovementAllowed = false;
				this.player.interactionAllowed = false;

				await playSequence(this.popupManager, [{ message: i18n.light_2_narrator, preset: "dark" }]);
				this.lightInteraction();
				this.player.interactionAllowed = true;
			};
		} else if(this.currentLightIndex < this.lightsPositions.length - 1) {
			// Luci intermedie
			light.setAlpha(0.75);
			light.interagisci = () => {
				this.player.interactionAllowed = false;
				this.lightInteraction();
				this.player.interactionAllowed = true;
			};
		} else {
			// Penultima luce - dialogo con il tutorial
			light.setAlpha(0.75);
			light.interagisci = async () => {
				this.player.isMovementAllowed = false;
				this.player.interactionAllowed = false;

				await playSequence(this.popupManager, [
					{ message: i18n.light_3_1_narrator, preset: "dark" },
					{ message: i18n.light_3_2_narrator, preset: "dark" },
					i18n.light_3_3,
					{ message: i18n.light_3_4_narrator, preset: "dark" },
					i18n.light_3_5,
					i18n.light_3_6,
					{ message: i18n.light_3_7_narrator, preset: "dark" },
					i18n.light_3_8,
					{ message: i18n.light_3_9_narrator, preset: "dark" },
					i18n.light_3_10,
					{ message: i18n.light_3_11_narrator, preset: "dark" },
					i18n.light_3_12,
					{ message: i18n.light_3_13_narrator, preset: "dark" }
				]);
				// Make the black mass interactable with the minigame trigger
				this.activateBlackMass();
				this.player.interactionAllowed = true;
			};
		}

		// Rende l'oggetto interagibile
		this.oggVector.push(light);
		this.currentLightIndex++;

		const previousDrift = this.currentLightDrift;

		if(this.currentLight) {
			// Disattiva subito l'interazione con la luce precedente: altrimenti resta
			// "set" (quindi reinteragibile) per tutta la durata del fade-out, e un
			// secondo tocco su di essa richiamerebbe lightInteraction() con l'indice
			// già avanzato, sfasando (o mandando fuori limite) currentLightIndex.
			this.currentLight.set = false;
			let duration = 2500;

			// Elimina la luce precedente
			this.tweens.add({
				targets: this.currentLight,
				alpha: 0,
				ease: "Linear",
				duration: duration,
				onStart: () => this.currentLight.play("strange_light_anim_fade"),
				onComplete: () => {
					// Rimuovi la luce corrente
					this.currentLight.destroy();
					this.currentLight = light;

					this.player.isMovementAllowed = true;

					previousDrift?.stop();
					this.time.delayedCall(4000, () => previousDrift?.destroy());
				}
			});

			// Impulso sferico dal nuovo punto luce per rivelarne la posizione
			const revealWave = this.add.circle(light.x, light.y, 1200, 0xff0000);
			revealWave.setBlendMode(Phaser.BlendModes.ADD);
			revealWave.setAlpha(0.3);
			revealWave.setScale(0);

			this.tweens.add({
				targets: revealWave,
				scale: 1,
				alpha: 0,
				duration: duration * 4,
				ease: 'Cubic.easeOut',
				onComplete: () => {
					revealWave.destroy();
				}
			});
		} else {
			this.currentLight = light;
		}

		this.currentLightDrift = drift;

		// Ripeti il pulse radar ogni 15 secondi finché la luce è attiva
		this.time.addEvent({
			delay: 15000,
			loop: true,
			callback: () => {
				if (!light.active) return;
				const wave = this.add.circle(light.x, light.y, 1200, 0xff0000);
				wave.setBlendMode(Phaser.BlendModes.ADD);
				wave.setAlpha(0.2);
				wave.setScale(0);
				this.tweens.add({ targets: wave, scale: 1, alpha: 0, duration: 10000, ease: 'Cubic.easeOut', onComplete: () => wave.destroy() });
			}
		});
	}

	// Attivazione della massa nera -----------------------------------------------------
	private activateBlackMass() {
		const i18n = this.cache.json.get("stage1_i18n");

		// Crea una zona luminosa attorno alla massa nera
		const brightZone = this.add.circle(this.blackMass.x, this.blackMass.y, 100, 0xff0000);
		brightZone.alpha = 0.01;
		brightZone.setBlendMode(Phaser.BlendModes.ADD);

		this.tweens.add({
			targets: brightZone,
			alpha: 0.05,
			duration: 3000,
			ease: 'Sine.easeInOut',
			yoyo: true,
			repeat: -1
		});

		// Configura l'interazione della massa nera per avviare il minigioco
		this.blackMass.interagisci = async () => {
			this.player.isMovementAllowed = false;
			this.player.interactionAllowed = false;

			await playSequence(this.popupManager, [i18n.light_final_1, i18n.light_final_2, i18n.light_final_3]);
			this.cameras.main.fadeOut(1000, 255, 0, 0);
			soundManager.stopAll();
			this.time.delayedCall(1000, () => {this.startMinigame();});
		};

		this.blackMass.set = true;
		this.player.isMovementAllowed = true;
	}

	// Avvio del minigioco ---------------------------------------------------------------
	private startMinigame() {
		launchSubScene(this, "Stage1_Lab", { completionEvent: "lab-complete" }, () => this.endingSequence());
	}

	// Scena finale dopo il completamento del minigioco ----------------------------------
	private async endingSequence() {
		this.isGraficoActive = false;

		this.scene.stop("Stage1_Lab"); 						// Ferma la scena grafico
		this.scene.resume();
		this.cameras.main.fadeIn(1500, 255, 0, 0);

		// Mostra un messaggio di successo
		const i18n = this.cache.json.get("stage1_i18n");
		await playSequence(this.popupManager, [
			i18n.returning_1,
			i18n.ending_1,
			{ message: i18n.ending_2_narrator, preset: "dark" }
		]);

		// Primo oggetto sbloccato dalla storia: assegnato subito dopo il primo dialogo
		this.player.addInventoryItem(2);

		const secondPopupDone = playSequence(this.popupManager, [i18n.ending_3]);

		this.cameras.main.shake(6000, 0.0012);
		soundManager.playSfx(this, "earthquake", { volume: 0.5 });

		await secondPopupDone;

		const fadeRect = this.add.rectangle(
			this.cameras.main.centerX,
			this.cameras.main.centerY,
			this.cameras.main.width,
			this.cameras.main.height,
			0x000000
		);

		fadeRect.setScrollFactor(0);
		fadeRect.setDepth(10);
		fadeRect.setAlpha(0);

		this.tweens.add({
			targets: fadeRect,
			alpha: 0.98,
			duration: 600,
			ease: "Linear",

			onComplete: () => {
				this.player.interactionAllowed = false; //disabilita l'interazione
				this.time.delayedCall(4000, this.cameras.main.fadeOut, [], this.cameras.main);
				this.time.delayedCall(5000, async () => {
					try {
						await this.apiSession.saveCheckpoint("stage1_complete");
					} catch (error) {
						if (error instanceof Error) {
							console.error("Salvataggio del checkpoint di Stage 1 fallito:", error.message);
						} else {
							console.error("Salvataggio del checkpoint di Stage 1 fallito (oggetto non-Error):", error);
						}
					}

					this.scene.start("Stage2");
				});
			}
		});
	}

	// Invia la posizione corrente; se il server la rifiuta, il giocatore torna
	// all'ultima posizione accettata, come in Stage2.
	private async sendPing() {
		try {
			const result = await this.apiSession.ping("Stage1", this.player.x, this.player.y);
			if (result.action === "rubberband" || result.action === "kick") {
				this.player.setPosition(parseFloat(result.x), parseFloat(result.y));
			} else if (result.action === "ban") {
				this.pingTimer?.remove();
				this.scene.start("Menu");
			}
		} catch (error) {
			console.error("Ping fallito:", error);
		}
	}

	private playAmbientSound() {
		const soundType = Math.random() > 0.5 ? "droplet" : "stone";
		soundManager.playSfx(this, soundType, { rate: Phaser.Math.FloatBetween(0.8, 1.2), volume: 0.3 });
		const nextDelay = Phaser.Math.Between(7000, 13000);
		this.time.delayedCall(nextDelay, () => this.playAmbientSound());
	}

	private scheduleAmbientSounds() {
		this.time.delayedCall(Phaser.Math.Between(5000, 15000), () => this.playAmbientSound());
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Stage1;
