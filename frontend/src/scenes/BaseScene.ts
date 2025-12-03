
// You can write more code here
import Player from "@/items/Main/Player";
import PopupManager from "../items/UI/PopupManager";
import LetterManager  from "../items/UI/LetterManager";
import { applyTranslations } from "../utils";

import OggettoInterattivo from "../items/Main/OggettoInterattivo";

/* START OF COMPILED CODE */

class BaseScene extends Phaser.Scene {

	constructor() {
		super("BaseScene");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

		// player
		const player = new Player(this, 160, 90);
		this.add.existing(player);

		// lists
		const boundaries: Array<any> = [];
		const oggVector: Array<any> = [];

		this.player = player;
		this.boundaries = boundaries;
		this.oggVector = oggVector;

		this.events.emit("scene-awake");
	}

	private player!: Player;
	private boundaries!: Array<any>;
	private oggVector!: Array<any>;

	/* START-USER-CODE */

	private popupManager!: PopupManager;
	private letterManager!: LetterManager;

	async preload() {
		this.load.pack("tutorial-pack", "assets/images/tutorial-pack.json");
		this.load.pack("player-pack", "assets/images/player-pack.json");
		this.load.pack("icons-pack", "assets/images/icons-pack.json");

		const lang = localStorage.getItem("lang") || "en";
        this.load.json("baseScene_i18n", `assets/i18n/${lang}/BaseScene.json`);
	}

	create() {

		this.editorCreate();

		// Applicazione delle traduzioni sui testi già presenti nella scena
		const i18n = this.cache.json.get("baseScene_i18n");
		applyTranslations(this, i18n);

		// Configurazione del giocatore
		this.player.debug(false);
		this.player.setBoundaries(this.boundaries);

		// Configurazione della telecamera
		this.cameras.main.setZoom(5.0);
        this.cameras.main.startFollow(this.player);

		// Inizializzazione dei manager
		this.popupManager = new PopupManager(this);
		this.letterManager = new LetterManager(this);

		/* START-SCENE-LOGIC */
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default BaseScene;