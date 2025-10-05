import { transformWithEsbuild } from "vite";
import Player from "../items/Main/Player";
import PopupManager from "../items/UI/PopupManager";
import OggettoInterattivo from "../items/Main/OggettoInterattivo";
// You can write more code here

/* START OF COMPILED CODE */

class Tutorial extends Phaser.Scene {

	constructor() {
		super("Tutorial");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

		// player
		const player = new Player(this, 640, 360);
		this.add.existing(player);

		this.player = player;

		this.events.emit("scene-awake");
	}

	private player!: Player;

	/* START-USER-CODE */
	private popupManager!: PopupManager;
	private overlay!: Phaser.GameObjects.Graphics;
	private spotlight!: Phaser.GameObjects.Graphics;
	private targetLuce!: Phaser.GameObjects.Graphics;
	private timer = false
	private temp = 20000; // tempo di attesa
	private popupMostrato = false; // Flag per evitare che il popup si riapra
	public oggVector = new Array<OggettoInterattivo>();

	// Write your code here
	preload() {
		this.load.pack("Player-pack", "frontend/public/assets/images/player-pack.json");
		this.load.pack("Tutorial-pack", "frontend/public/assets/images/tutorial-pack.json");
		this.load.pack("Items-pack", "frontend/public/assets/images/player-pack.json");
	}

	create() {

		this.editorCreate();
	
		this.cameras.main.setZoom(5);
		this.cameras.main.startFollow(this.player);


		// Inizializza il PopupManager
		this.popupManager = new PopupManager(this);

		// Aggiugiamo i popup alla coda 
		this.popupManager.queuePopup("ohoh, è così scuro qui dentro...");
		this.popupManager.queuePopup("forse hai la torcia scarica..");
		this.popupManager.queuePopup("cerca delle pile nuove..");
		this.popupManager.queuePopup("(usa le frecce per muoverti)");

		// Inizia la visualizzazione dei popup
		this.popupManager.showNextPopup();

		this.avviaTimer();

		this.events.on("timer-finished", () => {
			// timer finito
			this.timer = true;
			// Crea il pallino vicino al player
			const ogg = new OggettoInterattivo(this, 640 + 10, 360 + 10, 0, "batteria", 1);

			//sovrascrivo la funzione interagisci 
			ogg.interagisci = () => {	
				this.scene.start("Scene_1");
			}

			// Aggiungi l'oggetto all'array di oggetti
			this.oggVector.push(ogg);

			// Aggiungi l'oggetto alla scena
			this.add.existing(ogg); 

			//TODO cambiare immagine --batteria
			ogg.setImg("backPlayer_L");
		});


	}

	//timer 
	private avviaTimer() {
		this.time.addEvent({
			delay: this.temp, 
			callback: () => {
				this.events.emit("timer-finished");
			},
			callbackScope: this // Importante: assicura che il callback abbia il giusto contesto
		});
	}



	// Metodo update per controllare eventi
	update() {

		//gestione bordi
		const bounds = {
			xMin: 480,
			xMax: 800,
			yMin: 240,
			yMax: 480
		};

		if(this.player.x < bounds.xMin )this.player.x = bounds.xMax - 1;		
		if(this.player.x > bounds.xMax ) this.player.x = bounds.xMin + 1;
		if(this.player.y < bounds.yMin ) this.player.y = bounds.yMax - 1;
		if(this.player.y > bounds.yMax ) this.player.y = bounds.yMin + 1;

	}
	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Tutorial;