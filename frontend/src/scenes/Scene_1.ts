
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
import LecterManager  from "../items/UI/LetterManager";
import { Function } from "@/items/Main/Function";
import OggettoInterattivo from "../items/Main/OggettoInterattivo";

class Scene_1 extends Phaser.Scene {

	private fondale!: Phaser.GameObjects.Image;
	private popupManager!: PopupManager;
	private player!: Player;
	private lecterManager!: LecterManager;
	
	public oggVector = new Array<OggettoInterattivo>();
	
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
		this.cameras.main.startFollow(this.player);


		console.log("Creando PopupManager in Scene_1...");
		this.popupManager = new PopupManager(this);

		this.popupManager.queuePopup("Sei entrato nel laboratorio!");
		this.popupManager.queuePopup("Adesso cerca la droga!!!!");
		this.popupManager.queuePopup("e muoviti cazzo!");

		console.log("Mostrando primo popup...");
		this.popupManager.showNextPopup();

		
		var coordinateLettera = Function.coordinateRelativeToAbsolute(20, 0);

		const oggLettera = new OggettoInterattivo(this, coordinateLettera.x, coordinateLettera.y, 0, "lettera", 1);
		this.oggVector.push(oggLettera);

		//aggiungo la lettera alla scena
		this.add.existing(oggLettera);

		oggLettera.interagisci = () => {
			this.lecterManager = new LecterManager(this);
			this.lecterManager.queueLetter("I contraccettivi femminili rappresentano uno strumento fondamentale per la salute e l'autonomia delle donne. Permettono una pianificazione familiare consapevole, consentendo alle donne di decidere quando e se avere figli, contribuendo così al loro benessere fisico, economico e sociale.");
			this.lecterManager.showNextLetter();

			//distruggi l'oggetto lettera dopo averla letta 
			oggLettera.destroy();
		
		}


		//aggiungo l'ampolla
		var coordinateAmpolla = Function.coordinateRelativeToAbsolute(-160, 100);

		const oggAmpolla = new OggettoInterattivo(this, coordinateAmpolla.x, coordinateAmpolla.y, 0, "ampolla", 1);

		this.oggVector.push(oggAmpolla);

		//aggiungo l'oggetto alla scena
		this.add.existing(oggAmpolla);

		oggAmpolla.interagisci = () => {
			this.popupManager.queuePopup("Hai trovato un'ampolla con uno strano liquido giallo...");
			this.popupManager.queuePopup("prova a berla..");
			this.popupManager.queuePopup("...");
			this.popupManager.queuePopup("che schifo, era un'ampolla di piscio!");
			this.popupManager.queuePopup("l'unico metodo per sciacquarsi la bocca dopo averlo bevuto è vincere questo minigioco");
			this.popupManager.showNextPopup();

			this.popupManager.on('queueEmpty', () => {
					console.log("Tutti i popup dell'ampolla sono finiti, avvio memory game!");
					oggAmpolla.destroy();
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