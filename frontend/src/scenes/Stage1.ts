// You can write more code here
import Player from "@/items/Main/Player";
import PopupManager from "../items/UI/PopupManager";
import LetterManager  from "../items/UI/LetterManager";
import { applyTranslations } from "../utils";

import OggettoInterattivo from "../items/Main/OggettoInterattivo";

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
		const blackMass = new OggettoInterattivo(this, 682, 570, "black_mass", 0);
		this.add.existing(blackMass);

		// rectangle_1
		const rectangle_1 = this.add.rectangle(628, 331, 100, 30);

		// rectangle
		const rectangle = this.add.rectangle(668, 302, 50, 30);

		// rectangle_2
		const rectangle_2 = this.add.rectangle(706, 272, 50, 30);

		// rectangle_3
		const rectangle_3 = this.add.rectangle(640, -80, 1200, 30);

		// rectangle_4
		const rectangle_4 = this.add.rectangle(640, 800, 1200, 30);

		// rectangle_5
		const rectangle_5 = this.add.rectangle(55, 360, 30, 900);

		// rectangle_6
		const rectangle_6 = this.add.rectangle(1225, 360, 30, 900);

		// rectangle_7
		const rectangle_7 = this.add.rectangle(489, 512, 80, 15);

		// rectangle_8
		const rectangle_8 = this.add.rectangle(413, 445, 90, 25);

		// rectangle_9
		const rectangle_9 = this.add.rectangle(372, 109, 50, 24);

		// rectangle_10
		const rectangle_10 = this.add.rectangle(410, 161, 70, 24);

		// rectangle_11
		const rectangle_11 = this.add.rectangle(456, 297, 70, 24);

		// rectangle_12
		const rectangle_12 = this.add.rectangle(456, 238, 40, 24);

		// rectangle_13
		const rectangle_13 = this.add.rectangle(456, 201, 30, 60);

		// rectangle_14
		const rectangle_14 = this.add.rectangle(400, 140, 30, 60);

		// rectangle_15
		const rectangle_15 = this.add.rectangle(461, 275, 30, 60);

		// rectangle_16
		const rectangle_16 = this.add.rectangle(545, 363, 40, 15);

		// player
		const player = new Player(this, 355, 223);
		this.add.existing(player);

		// lists
		const boundaries = [rectangle_16, rectangle_15, rectangle_14, rectangle_13, rectangle_12, rectangle_11, rectangle_10, rectangle_9, rectangle_8, rectangle_7, rectangle_6, rectangle_5, rectangle_4, rectangle_3, rectangle_2, rectangle, rectangle_1];
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

	private popupManager!: PopupManager;
	private letterManager!: LetterManager;

	// Stato del minigioco di memoria (serve per evitare riavvii multipli)
	private isGraficoActive: boolean = false;

	async preload() {
		this.scene.add("Stage1_Lab", (await import("./Stage1_Lab")).default);

		this.load.pack("stage1-pack", "assets/images/stage1-pack.json");
		this.load.pack("player-pack", "assets/images/player-pack.json");
		this.load.pack("icons-pack", "assets/images/icons-pack.json");

		const lang = localStorage.getItem("lang") || "en";
        this.load.json("stage1_i18n", `assets/i18n/${lang}/Stage1.json`);
	}

	create() {

		this.editorCreate();

		this.anims.create({
			key: "strange_light_anim",
			frames: this.anims.generateFrameNumbers("red_light", { start: 0, end: 3 }),
			frameRate: 4,
			repeat: -1
		});

		this.anims.create({
			key: "black_mass_anim",
			frames: this.anims.generateFrameNumbers("black_mass", { start: 0, end: -1 }),
			frameRate: 8,
			repeat: -1
		});

		// Play the black mass animation
		this.blackMass.play("black_mass_anim");

		this.sound.play("dripping_water", {
			loop: true, 
			volume: this.game.sound.volume * parseFloat(localStorage.getItem("musicVolume") || "1")
		});

		// Applicazione delle traduzioni sui testi già presenti nella scena
		const i18n = this.cache.json.get("stage1_i18n");
		applyTranslations(this, i18n);

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
		this.letterManager = new LetterManager(this);

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

		// Inizio del dialogo iniziale dopo il risveglio
		this.popupManager.queuePopup(i18n.wake_up_1);
		this.popupManager.queuePopup(i18n.wake_up_2_narrator, "dark");
		this.popupManager.queuePopup(i18n.wake_up_3_narrator, "dark");
		this.popupManager.queuePopup(i18n.wake_up_4_narrator, "dark");
		this.popupManager.queuePopup(i18n.wake_up_5_narrator, "dark");
		this.popupManager.queuePopup(i18n.wake_up_6_narrator, "dark");
		this.popupManager.queuePopup(i18n.wake_up_7);
		this.popupManager.queuePopup(i18n.wake_up_8);
		this.popupManager.queuePopup(i18n.wake_up_9);
		this.popupManager.queuePopup(i18n.wake_up_10);
		this.popupManager.queuePopup(i18n.wake_up_11);

		// Mostra il popup SOLO quando l'animazione del risveglio è completa
		blackScreen.on("destroy", () => {this.popupManager.showNextPopup();});

		// Abilita il movimento del giocatore una volta terminato il dialogo iniziale
		this.popupManager.on('queueEmpty', () => {
			this.popupManager.queuePopup(i18n.movement_hint, "hint");
			this.popupManager.queuePopup(i18n.interact_hint, "hint");
			this.popupManager.showNextPopup();
			this.lightInteraction();

			this.popupManager.on('queueEmpty', () => {
				this.player.isMovementAllowed = true;
			});
		});

		/* END-SCENE-LOGIC */
	}

	// Interazione con la luce rossa ------------------------------------------------------
	private lightsPositions: Array<{x: number, y: number}> = [
		{x: 270, y: 100},
		{x: 348, y: 464},
		{x: 840, y: 0},
		{x: 682, y: 540}
	];
	private currentLightIndex: number = 0;
	private currentLight!: OggettoInterattivo;
	private lightInteraction = () => {
		this.player.isMovementAllowed = false;
		const i18n = this.cache.json.get("stage1_i18n");

		// this.currentLightIndex = this.lightsPositions.length - 1; // DEBUG: attiva l'ultima luce subito

		// Crea una nuova luce nella posizione successiva
		var light = new OggettoInterattivo(this, this.lightsPositions[this.currentLightIndex].x, this.lightsPositions[this.currentLightIndex].y, "red_light", 0);
		light.setScale(0);
		light.play("strange_light_anim");
		this.add.existing(light);

		// Animazione di comparsa della luce
		this.tweens.add({
			targets: light,
			scale: 1,
			duration: 500,
			ease: "Linear"
		});

		// Configura l'interazione della luce basata sull'indice
		if(this.currentLightIndex === 0) {
			// Prima luce - dialogo lungo con il narratore
			light.setAlpha(0.5);
			light.interagisci = () => {
				this.player.isMovementAllowed = false;
				this.player.interactionAllowed = false;

				this.popupManager.queuePopup(i18n.light_1_hint, "hint");
				this.popupManager.queuePopup(i18n.light_1_1);
				this.popupManager.queuePopup(i18n.light_1_2);
				this.popupManager.queuePopup(i18n.light_1_3_dark, "dark");
				this.popupManager.queuePopup(i18n.light_1_4);
				this.popupManager.queuePopup(i18n.light_1_5_dark, "dark");
				this.popupManager.queuePopup(i18n.light_1_6);
				this.popupManager.queuePopup(i18n.light_1_7);
				this.popupManager.queuePopup(i18n.light_1_8_dark, "dark");
				this.popupManager.queuePopup(i18n.light_1_9);
				this.popupManager.queuePopup(i18n.light_1_10_dark, "dark");
				this.popupManager.queuePopup(i18n.light_1_11_dark, "dark");
				this.popupManager.queuePopup(i18n.light_1_12);
				this.popupManager.showNextPopup();

				this.popupManager.on("queueEmpty", () => {
					this.lightInteraction();
					this.player.interactionAllowed = true;
				});
			};
		} else if(this.currentLightIndex === 1) {
			// Seconda luce - solo narratore
			light.setAlpha(0.5);
			light.interagisci = () => {
				this.player.isMovementAllowed = false;
				this.player.interactionAllowed = false;

				this.popupManager.queuePopup(i18n.light_2_dark, "dark");
				this.popupManager.showNextPopup();

				this.popupManager.on("queueEmpty", () => {
					this.lightInteraction();
					this.player.interactionAllowed = true;
				});
			};
		} else if(this.currentLightIndex < this.lightsPositions.length - 1) {
			// Luci intermedie
			light.setAlpha(0.5);
			light.interagisci = this.lightInteraction;
		} else {
			// Penultima luce - dialogo con il tutorial
			light.setAlpha(0.5);
			light.interagisci = () => {
				this.player.isMovementAllowed = false;
				this.player.interactionAllowed = false;

				this.popupManager.queuePopup(i18n.light_3_1_dark, "dark");
				this.popupManager.queuePopup(i18n.light_3_2_dark, "dark");
				this.popupManager.queuePopup(i18n.light_3_3);
				this.popupManager.queuePopup(i18n.light_3_4_narrator, "dark");
				this.popupManager.queuePopup(i18n.light_3_5);
				this.popupManager.queuePopup(i18n.light_3_6);
				this.popupManager.queuePopup(i18n.light_3_7_narrator, "dark");
				this.popupManager.queuePopup(i18n.light_3_8);
				this.popupManager.queuePopup(i18n.light_3_9_narrator, "dark");
				this.popupManager.queuePopup(i18n.light_3_10);
				this.popupManager.queuePopup(i18n.light_3_11_narrator, "dark");
				this.popupManager.queuePopup(i18n.light_3_12);
				this.popupManager.queuePopup(i18n.light_3_13_narrator, "dark");
				this.popupManager.showNextPopup();

				this.popupManager.on("queueEmpty", () => {
					// Make the black mass interactable with the minigame trigger
					this.activateBlackMass();
					this.player.interactionAllowed = true;
				});
			};
		}

		// Rende l'oggetto interagibile
		this.oggVector.push(light);
		this.currentLightIndex++;

		if(this.currentLight) {
			let duration = 2500;

			// Elimina la luce precedente
			this.tweens.add({
				targets: this.currentLight,
				alpha: 0,
				scale: 0,
				ease: "Linear",
				duration: duration,
				onComplete: () => {
					// Rimuovi la luce corrente
					this.currentLight.destroy();
					this.currentLight = light;

					this.player.isMovementAllowed = true;
				}
			});

			// Impulso sferico dal nuovo punto luce per rivelarne la posizione
			const revealWave = this.add.circle(light.x, light.y, 1200, 0xff0000);
			revealWave.setBlendMode(Phaser.BlendModes.ADD);
			revealWave.setAlpha(0.2);
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
		this.blackMass.interagisci = () => {
			this.player.isMovementAllowed = false;
			this.player.interactionAllowed = false;

			this.popupManager.queuePopup(i18n.light_final_1);
			this.popupManager.queuePopup(i18n.light_final_2);
			this.popupManager.queuePopup(i18n.light_final_3);
			this.popupManager.showNextPopup();

			this.popupManager.on("queueEmpty", () => {
				this.cameras.main.fadeOut(1000, 255, 0, 0);
				this.sound.stopAll();
				this.time.delayedCall(1000, () => {this.startMinigame();});
			});
		};

		// Aggiungi la massa nera al vettore degli oggetti interagibili
		this.oggVector.push(this.blackMass);
		this.player.isMovementAllowed = true;
	}

	// Avvio del minigioco ---------------------------------------------------------------
	private startMinigame() {
		this.scene.pause();
		// console.log("Avvio del grafico game...");

		// Avvia il gioco
		this.scene.launch("Stage1_Lab");

		// Porta la scena Memory in primo piano
		this.scene.bringToTop("Stage1_Lab");

		// Una volta terminato il memory riprende il gioco principale
		const grafScene = this.scene.get("Stage1_Lab") as Phaser.Scene | undefined;
		if (grafScene) {
			// Ascolta l'evento personalizzato di vittoria
			grafScene.events.once("lab-complete", () => {this.endingSequence();});
		}
	}

	// Scena finale dopo il completamento del minigioco ----------------------------------
	private endingSequence() {
		this.isGraficoActive = false;

		this.scene.stop("Stage1_Lab"); 						// Ferma la scena grafico
		this.scene.resume();
		this.cameras.main.fadeIn(1500, 255, 0, 0);

		// Mostra un messaggio di successo
		const i18n = this.cache.json.get("stage1_i18n");
		this.popupManager.queuePopup(i18n.minigame_success_1, "hint");
		this.popupManager.showNextPopup();
		this.popupManager.on("queueEmpty", () => {
			this.popupManager.queuePopup(i18n.minigame_success_2);
			this.popupManager.showNextPopup();

			this.cameras.main.shake(6000, 0.0012);
			this.sound.play("earthquake", {
				volume: this.game.sound.volume * parseFloat(localStorage.getItem("sfxVolume") || "1")
			});

			this.popupManager.on("queueEmpty", () => {
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
						this.time.delayedCall(5000, () => {this.scene.start("Menu");});
					}
				});
			});
		});
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Stage1;