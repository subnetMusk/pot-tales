

import Player from "@/items/Main/Player";
import PopupManager from "../items/UI/PopupManager";

class Scene_1 extends Phaser.Scene {

	private fondale!: Phaser.GameObjects.Image;
	private popupManager!: PopupManager;
	private player!: Player;

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
	}

	update(){
		console.log(`Player coordinates: x=${this.player.x}, y=${this.player.y}`);
	}

}

/* END OF COMPILED CODE */

// You can write more code here
// Esportazione della scena
export default Scene_1;