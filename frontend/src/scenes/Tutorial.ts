import Player from "../items/Main/Player";
import PopupManager from "../items/UI/PopupManager";
import LetterManager from "../items/UI/LetterManager";
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

		// Top
		const top = this.add.rectangle(640, 222, 300, 100);
		top.isFilled = true;

		// Bottom
		const bottom = this.add.rectangle(640, 493, 300, 100);
		bottom.isFilled = true;

		// Left
		const left = this.add.rectangle(439, 371, 100, 300);
		left.isFilled = true;

		// Right
		const right = this.add.rectangle(842, 371, 100, 300);
		right.isFilled = true;

		// lists
		const oggVector: Array<any> = [];
		const boundaries = [top, bottom, right, left];

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
	private letterManager!: LetterManager;

	// Write your code here
	preload() {
		this.load.pack("Player-pack", "assets/images/player-pack.json");
		this.load.pack("Tutorial-pack", "assets/images/tutorial-pack.json");
	}

	create() {
		this.editorCreate();
		this.player.setBoundaries(this.boundaries); // Non serve a nulla, devo solo disabilitare i boundaries
		this.player.debug(false);
		this.player.flashlight(true); // Disabilito la torcia
		this.cameras.main.setZoom(5);
		this.cameras.main.startFollow(this.player);

		// Inizializza il PopupManager
		this.popupManager = new PopupManager(this);
		this.letterManager = new LetterManager(this);

		// Listener per il tasto E
		const eKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.E);
		eKey?.on('down', () => {
			this.events.emit("E");
		});

		//Posizione iniziale di gioco
		let startX = this.player.x;
		let startY = this.player.y;

		// Messaggi iniziali 
		this.popupManager.queuePopup("Benvenuto nel tutorial di");
		this.popupManager.queuePopup("IL VIDEOGIOCO SENZA NOME");
		this.popupManager.queuePopup("Finché Filippo non ci manda il plot");
		this.popupManager.queuePopup("Usa i tasti freccia per muoverti");
		this.popupManager.showNextPopup();

		// Check movimento
		const moveTimer = this.time.addEvent({
			delay: 1000,
			callback: () => {
				if (Math.abs(this.player.x - startX) > 20 && Math.abs(this.player.y - startY) > 20) {
					this.events.emit("player-moved");
					moveTimer.destroy(); // Ferma il timer
				}
			},
			loop: true
		});

		// Check inventario
		this.events.once("player-moved", () => {
			this.popupManager.queuePopup("Ottimo! Ora passiamo all'inventario");
			this.popupManager.queuePopup("Al suo interno puoi trovare gli oggetti che hai raccolto durante la partita");
			this.popupManager.queuePopup("Usa il tasto E per aprire l'inventario");
			this.popupManager.showNextPopup();
		});

		this.events.once("E", () => {
			this.popupManager.queuePopup("È comparsa una lettera al centro della mappa!");
			this.popupManager.queuePopup("Per interagire con un oggetto, avvicinati e premi I");
			this.events.emit("inventory-opened");
		});

		//Check interazione
		this.events.once("inventory-opened", () => {
			this.popupManager.showNextPopup();
			const letter = new OggettoInterattivo(this, 640, 360, "letter");
			letter.setDepth(-1);
			letter.setScale(0.5, 0.5);

			letter.interagisci = () => {
				const messaggioLettera = "Nelle lettere puoi trovare informazioni utili per il gioco.";

				this.letterManager.queueLetter(messaggioLettera);
				this.letterManager.showNextLetter();

				// Una volta chiusa la lettera inizia il blackout
				this.letterManager.on('queueEmpty', () => {
					this.events.emit("blackout");
				});

				// Rimuovi la lettera dalla scena
				letter.destroy();
			};

			this.add.existing(letter);
			this.oggVector.push(letter);
		});

		// Animazione del blackout con matte nero
		this.events.once("blackout", () => {
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

			let flashCount = 0;
			const totalFlashes = 5;						//Numero di flash
			let durations = [400, 50, 50, 50, 150];		//Durate dei singoli flash

			const flashSequence = () => {
				blackScreen.setAlpha(1);

				this.time.delayedCall(100, () => { 
					blackScreen.setAlpha(0);
					flashCount++;

					if (flashCount < totalFlashes) {
						this.time.delayedCall(durations[flashCount], flashSequence);
					} else {
						blackScreen.destroy();
						this.time.delayedCall(1000, () => {
							this.events.emit("battery");
						});
					}
				});
			};

			// Inizia la sequenza dopo un breve delay
			this.time.delayedCall(500, flashSequence);
		});

		// Inizio del gioco da qua ᓚᘏᗢ
		this.events.once("battery", () => {
			this.popupManager.queuePopup("Oh no, la batteria della torcia è quasi scarica");
			this.popupManager.queuePopup("Raccogli la batteria per ricaricarla e iniziare il gioco!");
			this.popupManager.showNextPopup();

			this.popupManager.on('queueEmpty', () => {
				const battery = new OggettoInterattivo(this, 640, 300, "battery");
				battery.setScale(0.5, 0.5);
				battery.setDepth(-1); // Mette la batteria sotto il player

				battery.interagisci = () => {
					this.scene.start("LabTutorial");
				};
				this.add.existing(battery);
				this.oggVector.push(battery);
			});
		});
	}	
	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Tutorial;