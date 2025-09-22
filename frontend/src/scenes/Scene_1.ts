

import Player from "@/items/Main/Player";
import PopupManager from "../items/UI/PopupManager";
import LecterManager  from "../items/UI/LecterManager";

class Scene_1 extends Phaser.Scene {

	private fondale!: Phaser.GameObjects.Image;
	private popupManager!: PopupManager;
	private player!: Player;
	private lecterManager!: LecterManager;

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
		const fondale = this.add.image(640, 360, "Fondale");
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

		this.creaLettera(660, 360);
	}

	update(){
		console.log(`Player coordinates: x=${this.player.x}, y=${this.player.y}`);
	}

	private creaLettera(x: number, y: number){
		const envelope = this.add.graphics();
		envelope.fillStyle(0xF5F5DC); // Beige color for envelope
		envelope.fillRoundedRect(x - 16, y - 10, 32, 20, 3);

		envelope.lineStyle(1, 0xFF0000); // Red outline
		envelope.strokeRoundedRect(x - 16, y - 10, 32, 20, 3);

		// Envelope flap (triangle)
		envelope.fillStyle(0xDDD8C7); // Slightly darker beige
		envelope.fillTriangle(x - 12, y - 7, x + 12, y - 7, x, y + 3);

		envelope.lineStyle(1, 0xFF0000);
		envelope.strokeTriangle(x - 12, y - 7, x + 12, y - 7, x, y + 3);

		// Make it interactive
		envelope.setInteractive(new Phaser.Geom.Rectangle(x - 16, y - 10, 32, 20), Phaser.Geom.Rectangle.Contains);

		// Check distance and E key press
		this.input.keyboard?.on('keydown-E', () => {
			const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
			if (distance < 50) { // Adjust distance threshold as needed
				// Show letter popup
				this.lecterManager = new LecterManager(this);
				this.lecterManager.queueLetter("I contraccettivi femminili rappresentano uno strumento fondamentale per la salute e l'autonomia delle donne. Permettono una pianificazione familiare consapevole, consentendo alle donne di decidere quando e se avere figli, contribuendo così al loro benessere fisico, economico e sociale.");
				this.lecterManager.showNextLetter();

				// Remove the envelope graphic when letter is closed
				envelope.destroy();
			}
		});

	}

}

/* END OF COMPILED CODE */

// You can write more code here
// Esportazione della scena
export default Scene_1;