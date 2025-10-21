
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
		const flask = new OggettoInterattivo(this, 191, 230, "flask");
		this.add.existing(flask);
		flask.scaleX = 0.5;
		flask.scaleY = 0.5;

		// player
		const player = new Player(this, 160, 300);
		this.add.existing(player);

		// MapUp
		const mapUp = this.add.rectangle(160, -13, 320, 120);
		mapUp.alpha = 0.8;
		mapUp.isFilled = true;
		mapUp.fillColor = 16711680;

		// MapDown
		const mapDown = this.add.rectangle(160, 380, 320, 120);
		mapDown.isFilled = true;
		mapDown.fillColor = 16711680;

		// MapLeft
		const mapLeft = this.add.rectangle(-60, 160, 120, 320);
		mapLeft.isFilled = true;
		mapLeft.fillColor = 16711680;

		// MapRight
		const mapRight = this.add.rectangle(380, 160, 120, 320);
		mapRight.isFilled = true;
		mapRight.fillColor = 16711680;

		// DeskCollider4
		const deskCollider4 = this.add.rectangle(96, 160, 80, 65);
		deskCollider4.isStroked = true;
		deskCollider4.strokeColor = 16515072;

		// DeskCollider5
		const deskCollider5 = this.add.rectangle(224, 160, 80, 65);
		deskCollider5.isStroked = true;
		deskCollider5.strokeColor = 16728642;

		// DeskCollider2
		const deskCollider2 = this.add.rectangle(96, 239, 80, 30);
		deskCollider2.isStroked = true;
		deskCollider2.strokeColor = 16515072;

		// DeskCollider3
		const deskCollider3 = this.add.rectangle(224, 239, 80, 30);
		deskCollider3.isStroked = true;
		deskCollider3.strokeColor = 16728642;

		// DeskCollider1
		const deskCollider1 = this.add.rectangle(160, 64, 65, 32);
		deskCollider1.isStroked = true;
		deskCollider1.strokeColor = 16728642;

		// lists
		const oggVector = [flask, letter];
		const boundaries = [mapUp, deskCollider1, deskCollider3, deskCollider2, deskCollider5, deskCollider4, mapRight, mapLeft, mapDown];

		// flask (prefab fields)
		flask.number = 2;

		this.letter = letter;
		this.flask = flask;
		this.player = player;
		this.oggVector = oggVector;
		this.boundaries = boundaries;

		this.events.emit("scene-awake");
	}

	private letter!: OggettoInterattivo;
	private flask!: OggettoInterattivo;
	private player!: Player;
	private oggVector!: OggettoInterattivo[];
	private boundaries!: Phaser.GameObjects.Rectangle[];

	/* START-USER-CODE */
	private popupManager!: PopupManager;
	private letterManager!: LetterManager;
	private isMemoryActive = false;

	create() {
		this.editorCreate();
		this.player.setBoundaries(this.boundaries);			//Passo i boundaries al player
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