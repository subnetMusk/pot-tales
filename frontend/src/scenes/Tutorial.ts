import { transformWithEsbuild } from "vite";
import Player from "../items/Main/Player";
import PopupManager from "../items/UI/PopupManager";
// You can write more code here

/* START OF COMPILED CODE */

class Tutorial extends Phaser.Scene {

	/*bisogna controllare i bordi e fare la luce più carina   */

	constructor() {
		super("Tutorial");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

		// bgBL
		const bgBL = this.add.image(640, 360, "Background");
		bgBL.setOrigin(1, 0);
		bgBL.flipX = true;
		bgBL.flipY = true;

		// bgBR
		const bgBR = this.add.image(640, 360, "Background");
		bgBR.setOrigin(0, 0);
		bgBR.flipY = true;

		// bgTR
		const bgTR = this.add.image(640, 360, "Background");
		bgTR.setOrigin(0, 1);

		// bgTL
		const bgTL = this.add.image(640, 360, "Background");
		bgTL.setOrigin(1, 1);
		bgTL.flipX = true;

		// player
		const player = new Player(this, 640, 360);
		this.add.existing(player);

		this.player = player;

		this.events.emit("scene-awake");
	}

	private player!: Player;
	private popupManager!: PopupManager;
	private overlay!: Phaser.GameObjects.Graphics;
	private spotlight!: Phaser.GameObjects.Graphics;
	private targetLuce!: Phaser.GameObjects.Graphics;
	private timer = false
	private temp = 20000; // tempo di attesa

	/* START-USER-CODE */

	// Write your code here
	preload() {
		this.load.pack("Player-pack", "frontend/public/assets/images/Sprite-pack.json");
		this.load.pack("Tutorial-pack", "frontend/public/assets/images/tutorial-pack.json");
	}

	create() {

		this.editorCreate();
		this.cameras.main.setZoom(5);
		this.cameras.main.startFollow(this.player.player, true, 1.0, 1.0, -this.player.x, -this.player.y);

		
		this.createSpotlightEffect();

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
			xMin: -120,
			xMax: 120,
			yMin: -64,
			yMax: 64
		};
		
		if(this.player.player.x < bounds.xMin ) {
			this.player.player.x = bounds.xMin+1;		
		}
		if(this.player.player.x > bounds.xMax ) {
			this.player.player.x = bounds.xMax-1;
		}
		if(this.player.player.y < bounds.yMin ) {
			this.player.player.y = bounds.yMin+1;
		}
		if(this.player.player.y > bounds.yMax ) {
			this.player.player.y = bounds.yMax-1;
		}



		// Controlla se esiste un pallino da raggiungere
		if (this.timer) {
			//quando il player raggiunge il pallino passa a scena 1
			if (this.player.player.x <= 10  && this.player.player.x >= -10 && this.player.player.y <= 10 && this.player.player.y >= -10	) {
				this.scene.start("Scene_1");
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

	// Funzione per creare l'effetto spotlight
	private createSpotlightEffect() {

		// Add dark overlay everywhere
		this.overlay = this.add.graphics();
		this.overlay.fillStyle(0x000000, 0.9); // Black with 90% opacity
		this.overlay.fillRect(0, 0, this.scale.width, this.scale.height);
		this.overlay.setScrollFactor(0); // Keep overlay fixed to camera
		this.overlay.setDepth(50); // Below spotlight but above background

		// Create a spotlight effect - a circle where the dark overlay is removed
		this.spotlight = this.add.graphics();
		this.spotlight.fillCircle(0, 0, 15); // Circle with radius 15 pixels
		this.spotlight.setDepth(51);
		this.spotlight.setScrollFactor(0); // Keep spotlight fixed to camera

		// Create a mask from the spotlight circle 
		const mask = this.spotlight.createGeometryMask();
		mask.setInvertAlpha(true); // Invert the mask so the circle is transparent

		// Apply the mask to the overlay to create the spotlight effect
		this.overlay.setMask(mask);

		// Make the spotlight follow the player - USA LE COORDINATE CORRETTE
		this.tweens.add({
			targets: this.spotlight,
			x: this.player.player.x,
			y: this.player.player.y,
			duration: 0,
			repeat: -1,
			onUpdate: () => {
				this.spotlight.setPosition(this.player.x, this.player.y);
			}
		});
	}
		
	

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Tutorial;