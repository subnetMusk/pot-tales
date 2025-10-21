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

		// MapUp
		const mapUp = this.add.rectangle(642, 189, 320, 120);
		mapUp.alpha = 0.8;
		mapUp.isFilled = true;
		mapUp.fillColor = 16711680;

		// MapDown
		const mapDown = this.add.rectangle(642, 582, 320, 120);
		mapDown.isFilled = true;
		mapDown.fillColor = 16711680;

		// MapLeft
		const mapLeft = this.add.rectangle(445, 362, 120, 320);
		mapLeft.alpha = 0.7;
		mapLeft.isFilled = true;
		mapLeft.fillColor = 16711680;

		// MapRight
		const mapRight = this.add.rectangle(838, 362, 120, 320);
		mapRight.alpha = 0.7;
		mapRight.isFilled = true;
		mapRight.fillColor = 16711680;

		// lists
		const oggVector: Array<any> = [];
		const boundaries = [mapUp, mapRight, mapLeft, mapDown];

		this.player = player;
		this.oggVector = oggVector;
		this.boundaries = boundaries;

		this.events.emit("scene-awake");
	}

	private player!: Player;
	private oggVector!: Array<any>;
	private boundaries!: Phaser.GameObjects.Rectangle[];

	/* START-USER-CODE */
	private popupManager!: PopupManager;
	private temp = 2000; // tempo di attesa

	// Write your code here
	preload() {
		this.load.pack("Player-pack", "assets/images/player-pack.json");
		this.load.pack("Tutorial-pack", "assets/images/tutorial-pack.json");
	}

	create() {

		this.editorCreate();
		this.player.setBoundaries(this.boundaries); // Non serve a nulla, devo solo disabilitare i boundaries
		this.player.flashlight(true); // Disabilito la torcia
		this.player.debug(false);
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

			this.popupManager.queuePopup("per raccogliere gli oggetti avvicinati e premi I !");
			this.popupManager.showNextPopup();


			const ogg = new OggettoInterattivo(this, 640 + 10, 360 + 10, 'battery');

			//sovrascrivo la funzione interagisci 
			ogg.interagisci = () => {	
				this.scene.start("LabTutorial");
			}

			// Aggiungi l'oggetto all'array di oggetti
			this.oggVector.push(ogg);

			// Crea l'oggetto dopo aver chiuso il popup, per evitare che si sovrapponga 
			/*
				se l'oggetto viene messo fuori  dallo schermo non serve 
			*/ 
			this.popupManager.on('queueEmpty', () => {
					this.add.existing(ogg);
				});
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
	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Tutorial;