
// You can write more code here
import Player from "@/items/Main/Player";
import PopupManager from "../items/UI/PopupManager";
import LetterManager  from "../items/UI/LetterManager";
import OggettoInterattivo from "../items/Main/OggettoInterattivo";

/* START OF COMPILED CODE */

class LabTutorial extends Phaser.Scene {

	constructor() {
		super("LabTutorial");
		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	preload(): void {

		this.load.pack("Sprite-pack", "frontend/public/assets/sprite/Sprite-pack.json");
		this.load.pack("images", "frontend/public/assets/images/images.json");
		this.load.pack("Font-pack", "frontend/public/assets/fonts/Pixelify_Sans/Font-pack.json");
	}

	editorCreate(): void {

		// labv2
		const labv2 = this.add.image(0, 0, "labv2");
		labv2.setOrigin(0, 0);

		// letter
		const letter = new OggettoInterattivo(this, 104, 272, "letter");
		this.add.existing(letter);

		// flask
		const flask = new OggettoInterattivo(this, 226, 161, "flask");
		this.add.existing(flask);

		// player
		const player = new Player(this, 160, 300);
		player.flashlight(false);
		this.add.existing(player);

		// lists
		const oggVector = [flask, letter];

		// flask (prefab fields)
		flask.number = 2;

		this.letter = letter;
		this.flask = flask;
		this.player = player;
		this.oggVector = oggVector;

		this.events.emit("scene-awake");
	}

	private letter!: OggettoInterattivo;
	private flask!: OggettoInterattivo;
	private player!: Player;
	private oggVector!: OggettoInterattivo[];

	/* START-USER-CODE */
	private popupManager!: PopupManager;
	private letterManager!: LetterManager;

	private isMemoryActive = false;

	// Write your code here

	create() {

		this.editorCreate();
		this.cameras.main.setZoom(5);
		this.cameras.main.startFollow(this.player);


		console.log("Creando PopupManager in LabTutorial...");
		this.popupManager = new PopupManager(this);

		this.popupManager.queuePopup("Sei entrato nel laboratorio!");
		this.popupManager.queuePopup("Adesso cerca la droga!!!!");
		this.popupManager.queuePopup("e muoviti cazzo!");

		console.log("Mostrando primo popup...");
		this.popupManager.showNextPopup();

		this.letter.interagisci = () => {
			this.letterManager = new LetterManager(this);
			this.letterManager.queueLetter("I contraccettivi femminili rappresentano uno strumento fondamentale per la salute e l'autonomia delle donne. Permettono una pianificazione familiare consapevole, consentendo alle donne di decidere quando e se avere figli, contribuendo così al loro benessere fisico, economico e sociale.");
			this.letterManager.showNextLetter();

			//distruggi l'oggetto lettera dopo averla letta 
			this.letter.destroy();

		}

		this.flask.interagisci = () => {
			this.popupManager.queuePopup("Hai trovato un'ampolla con uno strano liquido giallo...");
			this.popupManager.queuePopup("prova a berla..");
			this.popupManager.queuePopup("...");
			this.popupManager.queuePopup("che schifo, era un'ampolla di piscio!");
			this.popupManager.queuePopup("l'unico metodo per sciacquarsi la bocca dopo averlo bevuto è vincere questo minigioco");
			this.popupManager.showNextPopup();

			this.popupManager.on('queueEmpty', () => {
				console.log("Tutti i popup dell'ampolla sono finiti, avvio memory game!");
				this.flask.destroy();
				this.createMemoryGame();
			});
		};
	}

	update(){
		console.log(`Player coordinates: x=${this.player.x}, y=${this.player.y}`);

		//gestione bordi
		//dim lab_x /2 
		//dim lab_y /2
		const bounds = {
			xMin: 0,
			xMax: 320,
			yMin: 0,
			yMax: 320
		};

		if(this.player.x < bounds.xMin ) {
			this.player.x = bounds.xMin+1;		
		}
		if(this.player.x > bounds.xMax ) {
			this.player.x = bounds.xMax-1;
		}
		if(this.player.y < bounds.yMin ) {
			this.player.y = bounds.yMin+1;
		}
		if(this.player.y > bounds.yMax ) {
			this.player.y = bounds.yMax-1;
		}

	}

	private createMemoryGame() {
		if (this.isMemoryActive) return; // Evita di avviare più volte il gioco
		this.isMemoryActive = true;

		//TODO implementare il memory game
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */
// You can write more code here
export default LabTutorial;