
// You can write more code here
import Player from "@/items/Main/Player";
import PopupManager from "../items/UI/PopupManager";
import LetterManager  from "../items/UI/LetterManager";
import { applyTranslations } from "../utils";

import OggettoInterattivo from "../items/Main/OggettoInterattivo";
import VideoPlayer from "@/items/UI/VideoPlayer";

/* START OF COMPILED CODE */

class Stage3 extends Phaser.Scene {

	constructor() {
		super("Stage3");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

		// bG
		this.add.image(540, 360, "BG");

		// bG_1
		this.add.image(740, 363, "BG");

		// player
		const player = new Player(this, 160, 90);
		this.add.existing(player);

		// top_bound
		const top_bound = this.add.image(640, 16, "default");
		top_bound.scaleX = 40;

		// bot_bound
		const bot_bound = this.add.image(640, 704, "default");
		bot_bound.scaleX = 40;

		// left_bound
		const left_bound = this.add.image(16, 360, "default");
		left_bound.scaleY = 20.5;

		// right_bound
		const right_bound = this.add.image(1264, 360, "default");
		right_bound.scaleY = 20.5;

		// carbon_core
		const carbon_core = new OggettoInterattivo(this, 1187, 650);
		this.add.existing(carbon_core);

		// lists
		const boundaries = [top_bound, left_bound, right_bound, bot_bound];
		const oggVector = [carbon_core];

		this.player = player;
		this.carbon_core = carbon_core;
		this.boundaries = boundaries;
		this.oggVector = oggVector;

		this.events.emit("scene-awake");
	}

	private player!: Player;
	private carbon_core!: OggettoInterattivo;
	private boundaries!: Phaser.GameObjects.Image[];
	private oggVector!: OggettoInterattivo[];

	/* START-USER-CODE */

	private popupManager!: PopupManager;
	private letterManager!: LetterManager;

	private isMemoryActive: boolean = false;

	async preload() {
		this.load.pack("stage3-pack", "assets/images/stage3-pack.json");
		this.load.pack("player-pack", "assets/images/player-pack.json");
		this.load.pack("icons-pack", "assets/images/icons-pack.json");

		const lang = localStorage.getItem("lang") || "en";
        this.load.json("baseScene_i18n", `assets/i18n/${lang}/BaseScene.json`);
	}

	create() {

		this.editorCreate();

		// Applicazione delle traduzioni sui testi già presenti nella scena
		const i18n = this.cache.json.get("baseScene_i18n");
		applyTranslations(this, i18n);

		// Configurazione del giocatore
		this.player.debug(false);
		this.player.setBoundaries(this.boundaries);

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

		this.popupManager.queuePopup("Is this a labirynth?");
		this.popupManager.showNextPopup();


		this.tweens.add({
			targets: fadeRect,
			alpha: 0.0,
			duration: 600,
			ease: "Linear",
			onComplete: () => {
				fadeRect.destroy()
				this.popupManager.showNextPopup();
				this.popupManager.on("queueEmpty", () => {
					this.player.movementAllowed = true;
				});
			}
		});
		
		this.carbon_core.interagisci = () => {
			this.startMinigame();
		};
	}

	private startMinigame() {
		this.player.movementAllowed = false;

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

				this.popupManager.queuePopup("Great! I've found the carbon core!");
				this.popupManager.showNextPopup();

				this.popupManager.on("queueEmpty", () => {
					const whiteRect = this.add.rectangle(
						this.cameras.main.centerX,
						this.cameras.main.centerY,
						this.cameras.main.width,
						this.cameras.main.height,
						0xffffff
					);
					whiteRect.setScrollFactor(0);
					whiteRect.setDepth(20);
					whiteRect.alpha = 0;

					this.tweens.add({
						targets: whiteRect,
						alpha: 1,
						duration: 1000,
						ease: "Linear",
						onComplete: () => {
							this.scene.start("Ending");
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
export default Stage3;