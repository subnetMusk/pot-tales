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

	preload(): void {

		this.load.pack("tutorial-pack", "frontend/public/assets/images/tutorial-pack.json");
		this.load.pack("player-pack", "frontend/public/assets/images/player-pack.json");
		this.load.pack("icons-pack", "frontend/public/assets/images/icons-pack.json");
	}

	editorCreate(): void {

		// bG
		const bG = this.add.image(640, 360, "BG");
		bG.scaleX = 0.55;
		bG.scaleY = 0.55;

		// wine_jar
		const wine_jar = this.add.image(600, 330, "wine jar");
		wine_jar.scaleX = 0.4;
		wine_jar.scaleY = 0.4;
		wine_jar.visible = false;

		// battery
		const battery = new OggettoInterattivo(this, 640, 335, "battery");
		this.add.existing(battery);
		battery.scaleX = 0.5;
		battery.scaleY = 0.5;
		battery.visible = false;

		// letter
		const letter = new OggettoInterattivo(this, 640, 360, "letter");
		this.add.existing(letter);
		letter.scaleX = 0.5;
		letter.scaleY = 0.5;
		letter.visible = false;

		// player
		const player = new Player(this, 640, 360);
		this.add.existing(player);
		player.visible = true;

		// Top
		const top = this.add.rectangle(640, 222, 300, 100);
		top.alpha = 0.11;
		top.isFilled = true;
		top.fillColor = 16711680;

		// Bottom
		const bottom = this.add.rectangle(640, 493, 300, 100);
		bottom.alpha = 0.1;
		bottom.isFilled = true;
		bottom.fillColor = 16711680;

		// Left
		const left = this.add.rectangle(439, 371, 100, 300);
		left.alpha = 0.1;
		left.isFilled = true;
		left.fillColor = 16711680;

		// Right
		const right = this.add.rectangle(842, 371, 100, 300);
		right.alpha = 0.1;
		right.isFilled = true;
		right.fillColor = 16711680;

		// lists
		const oggVector = [letter, battery];
		const boundaries = [top, bottom, right, left];

		this.wine_jar = wine_jar;
		this.battery = battery;
		this.letter = letter;
		this.player = player;
		this.oggVector = oggVector;
		this.boundaries = boundaries;

		this.events.emit("scene-awake");
	}

	private wine_jar!: Phaser.GameObjects.Image;
	private battery!: OggettoInterattivo;
	private letter!: OggettoInterattivo;
	private player!: Player;
	private oggVector!: OggettoInterattivo[];
	private boundaries!: Phaser.GameObjects.Rectangle[];

	/* START-USER-CODE */
	private popupManager!: PopupManager;
	private letterManager!: LetterManager;

	// Write your code here

	create() {
		this.editorCreate();
		this.player.setBoundaries(this.boundaries); // Non serve a nulla, devo solo disabilitare i boundaries
		this.player.debug(false);               //Disabilita il debug (grazie al cazzo aggiungo)
        this.player.movementAllowed = false;        // Disabilita gli input durante la transizione
		this.player.flashlight(true);         // Disabilito la torcia
		let zoom: number = 10;                         //Zoom della camera
        this.cameras.main.startFollow(this.player);     //Tracking del player

        // Inizializzo il PopupManager e il LetterManager
        this.popupManager = new PopupManager(this);
        this.letterManager = new LetterManager(this);

        //Inizio, transizione di camera
		const animation = this.time.addEvent({      //Animazione
			delay: 25,
			callback: () => {
				zoom -= 0.1;
				this.cameras.main.setZoom(zoom);
				if (zoom < 5) {
					animation.destroy();
					this.cameras.main.setZoom(5);
                    this.time.delayedCall(1000, () => {         //Attende un secondo
                        this.events.emit("begin");                  //Ora parte tutto
                    });
				}
			},
			loop: true
		});

		this.events.once("begin", () => {
            //Ogni 250ms controlla la distanza dal vaso
            const moveTimer = this.time.addEvent({
                delay: 250,
                callback: () => {
                    let offset: number = 20;        //Distanza minima arbitraria
                    if (Math.abs(this.player.x - this.wine_jar.x) < offset && Math.abs(this.player.y - this.wine_jar.y) < offset) {
                        this.events.emit("player-moved");
                        this.wine_jar.visible = false;
                        moveTimer.destroy();                //Termino il controllo raggiunto l'obbiettivo
                    }
                },
                loop: true
            });

            //Mostra i messaggi
            this.popupManager.queuePopup("Benvenuto nel tutorial di");
            this.popupManager.queuePopup("IL VIDEOGIOCO SENZA NOME");
            this.popupManager.queuePopup("Finché Filippo non ci manda il plot");
            this.popupManager.showNextPopup();

            this.player.movementAllowed = true;                         //Abilita l'input da tastiera

            //Terminati i primi messaggi rendo visibile il vaso e dico di avvicinarsi
            this.popupManager.on("queueEmpty", () => {
                this.wine_jar.visible = true;
                this.popupManager.queuePopup("Usa i tasti freccia per avvicinarti al vaso");
                this.popupManager.showNextPopup();
            });
		});

		// Check inventario, prima controllo se viene premuta la E
		this.events.once("player-moved", () => {
			this.popupManager.queuePopup("Ottimo! Ora passiamo all'inventario");
			this.popupManager.queuePopup("Al suo interno puoi trovare gli oggetti che hai raccolto durante la partita");
			this.popupManager.queuePopup("Usa il tasto E per aprire l'inventario");
			this.popupManager.showNextPopup();

            //Inizia ad ascoltare il tasto E
            const eKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.E);
            eKey?.on('down', () => {
                eKey?.destroy();                //Termina l'ascolto
                this.events.emit("E");
            });
		});

        // Lettera E premuta, non c'è un inventario ma ok
		this.events.once("E", () => {
			this.events.emit("inventory-opened");
		});

		//Check interazione
		this.events.once("inventory-opened", () => {
            this.popupManager.queuePopup("È comparsa una lettera al centro della mappa!");
            this.popupManager.queuePopup("Per interagire con un oggetto, avvicinati e premi I");
			this.popupManager.showNextPopup();
            this.letter.visible = true;                 //Lettera visibile
			this.letter.interagisci = () => {
                //Una volta che vi si interagisce, aspetto che finisca di leggere
				const messaggioLettera = "Nelle lettere puoi trovare informazioni utili per il gioco.";

				this.letterManager.queueLetter(messaggioLettera);
				this.letterManager.showNextLetter();
				// Una volta chiusa la lettera inizia il blackout
				this.letterManager.on('queueEmpty', () => {
					this.events.emit("blackout");
				});
				this.letter.destroy();
			};
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
			const totalFlashes = 5;						            //Numero di flash
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
						this.time.delayedCall(1000, () => {     //Attende un secondo e poi va alla prossima parte
							this.events.emit("battery");
						});
					}
				});
			};

			// Inizia la sequenza dopo un breve delay di 500ms
			this.time.delayedCall(500, flashSequence);
		});

		// Mostra la batteria
		this.events.once("battery", () => {
			this.popupManager.queuePopup("Oh no, la batteria della torcia è quasi scarica");
			this.popupManager.queuePopup("Raccogli la batteria per ricaricarla e iniziare il gioco!");
			this.popupManager.showNextPopup();

            //Terminano i messaggi e mostra la batteria
			this.popupManager.on('queueEmpty', () => {
                this.battery.visible = true;
				this.battery.interagisci = () => {
					this.scene.start("LabTutorial"); //Entra nel laboratorio ᓚᘏᗢ
				};
			});
		});
	}	
	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Tutorial;