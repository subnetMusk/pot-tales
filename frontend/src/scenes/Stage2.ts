
// You can write more code here
import Player from "@/items/Main/Player";
import PopupManager from "../items/UI/PopupManager";
import LetterManager  from "../items/UI/LetterManager";
import { applyTranslations } from "../utils";

import OggettoInterattivo from "../items/Main/OggettoInterattivo";

/* START OF COMPILED CODE */

class Stage2 extends Phaser.Scene {

	constructor() {
		super("Stage2");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

		// bg_stage2
		this.add.image(640, 360, "bg-stage2");

		// player
		const player = new Player(this, 640, 519);
		this.add.existing(player);

		// lists
		const boundaries: Array<any> = [];
		const oggVector: Array<any> = [];
		const slowAreas: Array<any> = [];

		this.player = player;
		this.boundaries = boundaries;
		this.oggVector = oggVector;
		this.slowAreas = slowAreas;

		this.events.emit("scene-awake");
	}

	private player!: Player;
	private boundaries!: Array<any>;
	private oggVector!: Array<any>;
	private slowAreas!: Array<any>;

	/* START-USER-CODE */
	private popupManager!: PopupManager;
	private letterManager!: LetterManager;

	private isMemoryActive: boolean = false;

	async preload() {
		this.load.pack("stage2-pack", "assets/images/stage2-pack.json");
		this.load.pack("player-pack", "assets/images/player-pack.json");
		this.load.pack("icons-pack", "assets/images/icons-pack.json");

		const lang = localStorage.getItem("lang") || "en";
        this.load.json("Stage2_i18n", `assets/i18n/${lang}/Stage2.json`);
	}

	create() {

		this.editorCreate();

		// Applicazione delle traduzioni sui testi già presenti nella scena
		const i18n = this.cache.json.get("Stage2_i18n");
		applyTranslations(this, i18n);

		// Configurazione del giocatore
		this.player.debug(false);
		this.player.setBoundaries(this.boundaries);
		
		// const slowZone = this.add.rectangle(640, 480, 220, 130, 0x00ff00, 0.5);
		// slowZone.setDepth(-1);
		// this.slowAreas.push({ zone: slowZone, multiplier: 0.45 });
		// this.player.setSlowAreas(this.slowAreas);
		
		this.player.isMovementAllowed = false;

		// Configurazione della telecamera
		this.cameras.main.setZoom(5.0);
        this.cameras.main.startFollow(this.player);

		// Inizializzazione dei manager
		this.popupManager = new PopupManager(this);
		this.letterManager = new LetterManager(this);

		/* START-SCENE-LOGIC */
		const fadeRect = this.add.rectangle(
			this.cameras.main.centerX,
			this.cameras.main.centerY,
			this.cameras.main.width,
			this.cameras.main.height,
			0x000000
		);

		fadeRect.setScrollFactor(0);
		fadeRect.setDepth(10);

		this.popupManager.queuePopup(i18n.wake_up_1);
		this.popupManager.queuePopup(i18n.wake_up_2);


		this.tweens.add({
			targets: fadeRect,
			alpha: 0.0,
			duration: 600,
			ease: "Linear",
			onComplete: () => {
				fadeRect.destroy()
				this.popupManager.showNextPopup();
				this.popupManager.on("queueEmpty", () => {
					this.player.isMovementAllowed = true;
				});
			}
		});

		this.pool_center.interagisci = () => {
			this.popupManager.queuePopup(i18n.pool_1);
			this.popupManager.queuePopup(i18n.pool_2);
			this.popupManager.showNextPopup();

			this.popupManager.on("queueEmpty", () => {this.startMinigame();});
		}
	}

	private startMinigame() {
		this.player.isMovementAllowed = false;

		// Evita di avviare più volte il gioco
		if (this.isMemoryActive) return;
		this.isMemoryActive = true;

		// Pausa il gioco principale
		this.scene.pause();
		console.log("Avvio del memory game...");

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

				this.cameras.main.shake(10000, 0.0004); 

				const i18n = this.cache.json.get("Stage2_i18n");
				this.popupManager.queuePopup(i18n.shaking);
				this.popupManager.showNextPopup();

				this.popupManager.on("queueEmpty", () => {
					this.tweens.add({
						targets: this.player,
						x: this.pool_center.x,
						y: this.pool_center.y - 50,
						duration: 1000,
						ease: "Sine.easeInOut",
						onComplete: () => {
							const blackRect = this.add.rectangle(
								this.cameras.main.centerX,
								this.cameras.main.centerY,
								this.cameras.main.width,
								this.cameras.main.height,
								0x000000
							);
							blackRect.setScrollFactor(0);
							blackRect.setDepth(100);
							blackRect.alpha = 0;

							this.tweens.add({
								targets: blackRect,
								alpha: 1,
								duration: 1000,
								ease: "Linear"
							});

							this.tweens.add({
								targets: this.cameras.main,
								zoom: 10.0,
								duration: 1000,
								ease: "Sine.easeInOut",
								onComplete: () => {
									this.scene.start("Stage3");
								}
							});
						}
					});
				});
			});
		}
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Stage2;