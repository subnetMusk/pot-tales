
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

		// strange_light
		const strange_light = new OggettoInterattivo(this, 470, 299);
		this.add.existing(strange_light);

		// lists
		const boundaries: Array<any> = [];
		const oggVector = [strange_light];

		// strange_light (prefab fields)
		strange_light.number = 1;

		this.player = player;
		this.strange_light = strange_light;
		this.boundaries = boundaries;
		this.oggVector = oggVector;

		this.events.emit("scene-awake");
	}

	private player!: Player;
	private strange_light!: OggettoInterattivo;
	private boundaries!: Array<any>;
	private oggVector!: OggettoInterattivo[];

	/* START-USER-CODE */

	private popupManager!: PopupManager;
	private letterManager!: LetterManager;

	// Stato del minigioco di memoria (serve per evitare riavvii multipli)
	private isMemoryActive: boolean = false;

	async preload() {
		this.load.pack("tutorial-pack", "frontend/public/assets/images/tutorial-pack.json");
		this.load.pack("player-pack", "frontend/public/assets/images/player-pack.json");
		this.load.pack("icons-pack", "frontend/public/assets/images/icons-pack.json");

		const lang = localStorage.getItem("lang") || "en";
        this.load.json("stage1_i18n", `assets/i18n/${lang}/Stage1.json`);
	}

	create() {

		this.editorCreate();

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
		});

		this.strange_light.interagisci = () => {
			this.popupManager.queuePopup("Una luce strana emana da questo oggetto...");
			this.popupManager.queuePopup("Forse dovrei indagare più a fondo...");
			this.popupManager.showNextPopup();

			this.popupManager.on("queueEmpty", () => {this.startMinigame();});
		}

		/* END-SCENE-LOGIC */
	}

	startMinigame() {
		// Evita di avviare più volte il gioco
		if (this.isMemoryActive) return;
		this.isMemoryActive = true;

		// Pausa il gioco principale
		this.scene.pause();
		console.log("Avvio del memory game...");

		// Sfocare la camera prima di avviare Memory
		this.cameras.main.postFX.addBlur(8, 8, 2);

		// Avvia il gioco
		this.scene.launch("Memory");

		// Una volta terminato il memory riprende il gioco principale
		const memScene = this.scene.get("Memory") as Phaser.Scene | undefined;
		if (memScene) {
			// Ascolta l'evento personalizzato di vittoria
			memScene.events.once("memory-complete", () => {
				console.log("Memory completed, resuming LabTutorial");

				this.cameras.main.postFX.clear();				// Rimuovi il blur quando torni

				this.scene.stop("Memory"); 						// Ferma la scena Memory
				this.scene.resume(); 							// Riprendi LabTutorial
				this.isMemoryActive = false;

				// Mostra un messaggio di successo
				this.popupManager.queuePopup("Bravissimo! Hai vinto!");
				this.popupManager.queuePopup("Ora puoi continuare con il laboratorio...");
				this.popupManager.showNextPopup();
			});
		}
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Stage1;