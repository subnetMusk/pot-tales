import { transformWithEsbuild } from "vite";
import Player from "../items/Main/Player";
import PopupManager from "../items/UI/PopupManager";
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

	// Write your code here
	preload() {
		this.load.pack("Player-pack", "frontend/public/assets/images/player-pack.json");
		this.load.pack("Tutorial-pack", "frontend/public/assets/images/tutorial-pack.json");
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
			this.creaLuce(640 + 10, 350 +10);
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

		// Controlla se esiste un pallino da raggiungere
		if (this.timer && !this.popupMostrato) {
			//quando il player raggiunge il pallino passa a scena 1
			if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.targetLuce.x, this.targetLuce.y) < 20) {
				this.popupMostrato = true; // Imposta la flag per evitare che si ripeta
				/*fai comparire un popup che spiega che per raccogliere la pila deve premere I, e dopo che ha premuto I passa a scena 1 */
				this.popupManager.queuePopup("Per raccogliere gli oggetti, premi I.");
				this.popupManager.showNextPopup();
				this.input.keyboard?.on('keydown-I', () => {
					if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.targetLuce.x, this.targetLuce.y) < 20) {
						this.scene.start("Scene_1");
					}
				});

			}
		}
	}

	// Funzione per creare il pallino fisso nel mondo
	private creaLuce(x: number, y: number) {
		// Crea un disegno di una batteria fisso nel mondo
		const battery = this.add.graphics();

		// Corpo principale della batteria (rettangolo)
		battery.fillStyle(0x333333, 1); // Grigio scuro
		battery.fillRect(-6, -3, 12, 6);

		// Terminale positivo della batteria
		battery.fillStyle(0x666666, 1); // Grigio chiaro
		battery.fillRect(6, -1, 2, 2);

		// Indicatore di carica (verde)
		battery.fillStyle(0x00ff00, 1); // Verde
		battery.fillRect(-5, -2, 8, 4);

		// Contorno della batteria
		battery.lineStyle(1, 0x000000, 1); // Nero
		battery.strokeRect(-6, -3, 12, 6);
		battery.strokeRect(6, -1, 2, 2);

		battery.setPosition(x, y);
		battery.setDepth(100);

		// Salva il riferimento per il controllo delle collisioni
		this.targetLuce = battery;

	}
	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Tutorial;