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

		// bG
		this.add.image(540, 360, "BG");

		// player
		const player = new Player(this, 160, 90);
		this.add.existing(player);

		// lists
		const boundaries: Array<any> = [];
		const oggVector: Array<any> = [];

		this.player = player;
		this.boundaries = boundaries;
		this.oggVector = oggVector;

		this.events.emit("scene-awake");
	}

	private player!: Player;
	private boundaries!: Array<any>;
	private oggVector!: Array<any>;

	/* START-USER-CODE */

	private popupManager!: PopupManager;
	private letterManager!: LetterManager;

	// Stato del minigioco di memoria (serve per evitare riavvii multipli)
	private isMemoryActive: boolean = false;

	async preload() {
		this.load.pack("tutorial-pack", "assets/images/tutorial-pack.json");
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

		this.sound.play("dripping_water", {
			loop: true, 
			volume: this.game.sound.volume * parseFloat(localStorage.getItem("musicVolume") || "1") * 0.3
		});

		// Applicazione delle traduzioni sui testi già presenti nella scena
		const i18n = this.cache.json.get("stage1_i18n");
		applyTranslations(this, i18n);

		// Configurazione del giocatore
		this.player.debug(false);
		this.player.setBoundaries(this.boundaries);
		this.player.movementAllowed = false;

		// Configurazione della telecamera
		this.cameras.main.setZoom(5.0);
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
		this.popupManager.queuePopup("Dove sono...? Cosa è successo?");
		this.popupManager.queuePopup("Devo trovare una via d'uscita da questo posto strano.");

		// Mostra il popup SOLO quando l'animazione del risveglio è completa
		blackScreen.on("destroy", () => {this.popupManager.showNextPopup();});

		// Abilita il movimento del giocatore una volta terminato il dialogo iniziale
		this.popupManager.on('queueEmpty', () => {
			this.player.movementAllowed = true;
			this.popupManager.queuePopup("Usa le frecce direzionali per muoverti.");
			this.popupManager.showNextPopup();

			this.lightInteraction();
		});

		/* END-SCENE-LOGIC */
	}

	private startMinigame() {
		// Evita di avviare più volte il gioco
		if (this.isMemoryActive) return;
		this.isMemoryActive = true;

		// Pausa il gioco principale
		this.scene.pause();
		console.log("Avvio del memory game...");

		// Sfocare la camera prima di avviare Memory
		this.cameras.main.postFX.addBlur(2, 2, 2);

		// Avvia il gioco
		this.scene.launch("Memory");

		// Porta la scena Memory in primo piano
		this.scene.bringToTop("Memory");

		// Una volta terminato il memory riprende il gioco principale
		const memScene = this.scene.get("Memory") as Phaser.Scene | undefined;
		if (memScene) {
			// Ascolta l'evento personalizzato di vittoria
			memScene.events.once("memory-complete", () => {
				console.log("Memory game completato con successo!");

				this.cameras.main.postFX.clear();				// Rimuovi il blur quando torni

				this.scene.stop("Memory"); 						// Ferma la scena Memory
				this.scene.resume();
				this.isMemoryActive = false;

				// Mostra un messaggio di successo
				this.popupManager.queuePopup("Bravissimo! Hai vinto!");
				// Mostra un messaggio di successo
				this.popupManager.queuePopup("Bravissimo! Hai vinto!");
				this.popupManager.queuePopup("Che succede ora?");
				this.popupManager.showNextPopup();

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
						alpha: 0.95,
						duration: 600,
						ease: "Linear",
						onComplete: () => {
							this.time.delayedCall(9600, () => {
								this.tweens.add({
									targets: fadeRect,
									alpha: 1,
									duration: 400,
									ease: "Linear",
									onComplete: () => {
										this.sound.stopAll();
										this.scene.start("Stage2");
									}
								});
							});
						}
					});
				});
			});
		}
	}

	private lightsPositions: Array<{x: number, y: number}> = [
		{x: 100, y: 100},
		{x: 200, y: 250},
		{x: 400, y: 350}
	];
	private currentLightIndex: number = 0;
	private currentLight!: OggettoInterattivo;
	private lightInteraction = () => {
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

		// Configura l'interazione della luce
		if(this.currentLightIndex < this.lightsPositions.length - 1) {
			light.setAlpha(0.5);
			light.interagisci = this.lightInteraction;
		} else {
			// Crea una zona luminosa attorno alla luce
			const brightZone = this.add.circle(light.x, light.y, 100, 0xff0000);
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

			// L'ultima luce avvierà il minigioco
			light.interagisci = () => {
				this.popupManager.queuePopup("Una luce strana emana da questo oggetto...");
				this.popupManager.queuePopup("Forse dovrei indagare più a fondo...");
				this.popupManager.showNextPopup();

				this.popupManager.on("queueEmpty", () => {this.startMinigame();});
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
				}
			});

			// Parametri per il triangolo di luce, che punta alla prossima luce (con un po' di variazione casuale)
			const nextLight = light;
			const angle = Phaser.Math.Angle.Between(this.currentLight.x, this.currentLight.y, nextLight.x, nextLight.y) + Phaser.Math.FloatBetween(-0.2, 0.2);
			const amplitude = 1.0 // Apertura del triangolo
			const finalLength = 200; // Lunghezza finale dei lati uguali

			const x1 = this.currentLight.x;
			const y1 = this.currentLight.y;
			let x2 = x1
			let y2 = y1
			let x3 = x1
			let y3 = y1
			
			const triangle = this.add.triangle(
				0, 0,
				x1, y1,
				x2, y2,
				x3, y3,
				0xff0000
			);
			triangle.setBlendMode(Phaser.BlendModes.ADD);
			triangle.setAlpha(0.1);
			const animData = { length: 0 };

			// Anima l'allungamento del triangolo
			this.tweens.add({
				targets: animData,
				length: finalLength,
				duration: duration,
				ease: 'Sine.easeOut',
				onUpdate: () => {
					// Ricalcola le posizioni dei vertici in base alla lunghezza corrente
					const currentLength = animData.length;
					let x2 = x1 + currentLength * Math.cos(angle - amplitude / 2);
					let y2 = y1 + currentLength * Math.sin(angle - amplitude / 2);
					let x3 = x1 + currentLength * Math.cos(angle + amplitude / 2);
					let y3 = y1 + currentLength * Math.sin(angle + amplitude / 2);
					
					// Aggiorna la geometria del triangolo
					triangle.setTo(x1, y1, x2, y2, x3, y3);
				},
				onComplete: () => {
					triangle.destroy();
				}
			});

			// Anima il fade out
			this.tweens.add({
				targets: triangle,
				alpha: 0,
				duration: duration,
				ease: 'Linear'
			});
		} else {
			this.currentLight = light;
		}
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Stage1;