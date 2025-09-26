
/*
dopo aver trovato le batterie per la torcia il giocatore entra nel laboratorio,
dove trova una lettera che spiega qualcosa sui vasi,
seguendo la strada il giocatore trova un altra porta chiusa che si aprirà dopo aver
vinto un minigioco, dopo aver aperto la porta il giocatore viene catapultato nella scena 2
*/
/* START OF COMPILED CODE 
*/
import Player from "@/items/Main/Player";
import PopupManager from "../items/UI/PopupManager";
import LecterManager  from "../items/UI/LecterManager";
import { Function } from "@/items/Main/Function";

class Scene_1 extends Phaser.Scene {

	private fondale!: Phaser.GameObjects.Image;
	private popupManager!: PopupManager;
	private player!: Player;
	private lecterManager!: LecterManager;
	
	// Memory Game variables
	private memoryContainer!: Phaser.GameObjects.Container;
	private memoryCards: Phaser.GameObjects.Graphics[] = [];
	private cardValues: number[] = [];
	private flippedCards: { card: Phaser.GameObjects.Graphics, index: number, value: number }[] = [];
	private isMemoryActive: boolean = false;
	private matchedPairs: number = 0;

	constructor() {
		super("Scene_1");
	}

	preload(): void {
		// Carica i pack con i path corretti
		this.load.pack("Sprite-pack", "/assets/images/Sprite-pack.json");
		this.load.pack("Images", "/assets/images/Images.json");
	}

	editorCreate(): void {

		// Background
		const background = this.add.container(0, 0);

		// fondale
		const fondale = this.add.image(640, 360, "lab");
		fondale.scaleX = 3;
		fondale.scaleY = 3;
		fondale.setOrigin(0.5, 0.5);
		background.add(fondale);


		// player
		const player = new Player(this, 640, 360);
		this.add.existing(player);

		this.player = player;


		this.fondale = fondale;

		this.events.emit("scene-awake");
	}

	create() {
		this.editorCreate();
		this.cameras.main.setZoom(5);
		this.cameras.main.startFollow(this.player.player, true, 1.0, 1.0, -this.player.x, -this.player.y);


		console.log("Creando PopupManager in Scene_1...");
		this.popupManager = new PopupManager(this);

		this.popupManager.queuePopup("Sei entrato nel laboratorio!");
		this.popupManager.queuePopup("Adesso cerca la droga!!!!");
		this.popupManager.queuePopup("e muoviti cazzo!");

		console.log("Mostrando primo popup...");
		this.popupManager.showNextPopup();

		
		var coordinateLettera = Function.coordinateRelativeToAbsolute(20, 0);

		this.creaLettera(coordinateLettera.x, coordinateLettera.y);

		var coordinateAmpolla = Function.coordinateRelativeToAbsolute(-160, 100);

		this.creaAmpolla(coordinateAmpolla.x, coordinateAmpolla.y);

	}

	update(){
		console.log(`Player coordinates: x=${this.player.x}, y=${this.player.y}`);
		
		//gestione bordi
		//dim lab_x /2 
		//dim lab_y /2
		const bounds = {
			xMin: -187,
			xMax: 187,
			yMin: -140,
			yMax: 148
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

	}

	private creaLettera(x: number, y: number){
		const envelope = this.add.graphics();
		envelope.fillStyle(0xF5F5DC); // Beige color for envelope
		envelope.fillRoundedRect(x - 8, y - 5, 16, 10, 2);

		envelope.lineStyle(1, 0xFF0000); // Red outline
		envelope.strokeRoundedRect(x - 8, y - 5, 16, 10, 2);

		// Envelope flap (triangle)
		envelope.fillStyle(0xDDD8C7); // Slightly darker beige
		envelope.fillTriangle(x - 6, y - 3, x + 6, y - 3, x, y + 2);

		envelope.lineStyle(1, 0xFF0000);
		envelope.strokeTriangle(x - 6, y - 3, x + 6, y - 3, x, y + 2);

		// Make it interactive
		envelope.setInteractive(new Phaser.Geom.Rectangle(x - 8, y - 5, 16, 10), Phaser.Geom.Rectangle.Contains);


		// Check distance and I key press
		this.input.keyboard?.on('keydown-I', () => {

			/*NB  la funzione coordinateAbsoluteToRelative è uguale a fare x-640 e y-360, ma è più bella */
			const relativeCoords = Function.coordinateAbsoluteToRelative(x, y);
			const distance = Phaser.Math.Distance.Between(this.player.player.x, this.player.player.y, relativeCoords.x, relativeCoords.y);
			console.log(`Distance to letter: ${distance}`);
			if (distance < 25 && envelope.active) { // Distanza di 25 pixel per interagire
				// Show letter popup
				this.lecterManager = new LecterManager(this);
				this.lecterManager.queueLetter("I contraccettivi femminili rappresentano uno strumento fondamentale per la salute e l'autonomia delle donne. Permettono una pianificazione familiare consapevole, consentendo alle donne di decidere quando e se avere figli, contribuendo così al loro benessere fisico, economico e sociale.");
				this.lecterManager.showNextLetter();

				// Remove the envelope graphic when letter is closed
				envelope.destroy();
			}
		});

	}

	private creaAmpolla(x: number, y: number){
		const ampolla = this.add.graphics();

		// Create the base of the potion bottle
		ampolla.fillStyle(0x9370DB, 0.8); // Purple semi-transparent color for the glass
		ampolla.fillRoundedRect(x - 5, y - 10, 10, 15, 5);

		// Create the neck of the bottle
		ampolla.fillStyle(0x9370DB, 0.8);
		ampolla.fillRect(x - 2, y - 15, 4, 5);

		// Create the top/cork of the bottle
		ampolla.fillStyle(0xCD853F); // Brown color for cork
		ampolla.fillRect(x - 3, y - 17, 6, 2);

		// Add liquid inside the bottle
		ampolla.fillStyle(0xFFFF00, 0.7); // Yellow liquid
		ampolla.fillRoundedRect(x - 4, y - 8, 8, 12, 4);

		// Add shine effect
		ampolla.fillStyle(0xFFFFFF, 0.5);
		ampolla.fillRect(x - 3, y - 9, 1, 10);

		// Make it interactive
		ampolla.setInteractive(new Phaser.Geom.Rectangle(x - 5, y - 17, 10, 22), Phaser.Geom.Rectangle.Contains);

		// Interaction when pressing I
		this.input.keyboard?.on('keydown-I', () => {
			const relativeCoords = Function.coordinateAbsoluteToRelative(x, y);
			const distance = Phaser.Math.Distance.Between(
				this.player.player.x, 
				this.player.player.y, 
				relativeCoords.x, 
				relativeCoords.y
			);
			
			if (distance < 25 && ampolla.active) {
				// Show potion interaction message
				this.popupManager.queuePopup("Hai trovato un'ampolla con uno strano liquido giallo...");
				this.popupManager.queuePopup("prova a berla..");
				this.popupManager.queuePopup("...");
				this.popupManager.queuePopup("che schifo, era un'ampolla di piscio!");
				this.popupManager.queuePopup("l'unico metodo per sciacquarsi la bocca dopo averlo bevuto è vincere questo minigioco");
				this.popupManager.showNextPopup();

				// Cattura l'evento quando tutti i popup sono finiti
				this.popupManager.on('queueEmpty', () => {
					console.log("Tutti i popup dell'ampolla sono finiti, avvio memory game!");
					ampolla.destroy();
					this.createMemoryGame();
				});

			}
			
		});
	}


	private createMemoryGame() {
		if (this.isMemoryActive) return; // Evita di avviare più volte il gioco
		this.isMemoryActive = true;

		//TODO implementare il memory game
	}
}

/* END OF COMPILED CODE */

// You can write more code here
// Esportazione della scena
export default Scene_1;