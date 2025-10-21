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

		// lists
		const oggVector: Array<any> = [];
		const uselessList: Array<any> = [];

		this.player = player;
		this.oggVector = oggVector;
		this.uselessList = uselessList;

		this.events.emit("scene-awake");
	}

	private player!: Player;
	private oggVector!: Array<any>;
	private uselessList!: Array<any>;

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
		this.player.setBoundaries(this.uselessList); // Non serve a nulla, devo solo disabilitare i boundaries
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