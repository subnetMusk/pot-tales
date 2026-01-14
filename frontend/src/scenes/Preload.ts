import { applyTranslations } from "../utils";

/* START OF COMPILED CODE */

class Preload extends Phaser.Scene {

	constructor() {
		super("Preload");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

		// bg_filter
		const bg_filter = this.add.rectangle(640, 360, 1280, 720);
		bg_filter.alpha = 0.4;
		bg_filter.isFilled = true;
		bg_filter.fillColor = 0;

		// loader_bg
		const loader_bg = this.add.rectangle(640, 360, 400, 40);
		loader_bg.isFilled = true;
		loader_bg.fillColor = 15792383;

		// loader
		const loader = this.add.rectangle(640, 360, 390, 30);
		loader.isFilled = true;
		loader.fillColor = 10883584;

		// Loading
		const loading = this.add.text(640, 320, "", {});
		loading.name = "Loading";
		loading.setOrigin(0.5, 0.5);
		loading.text = "Loading...";
		loading.setStyle({ "align": "center", "color": "#f0f8ff", "fixedWidth": 200, "fontFamily": "PixelifySans-VariableFont_wght", "fontSize": "30px" });

		this.loader_bg = loader_bg;
		this.loader = loader;

		this.events.emit("scene-awake");
	}

	private loader_bg!: Phaser.GameObjects.Rectangle;
	private loader!: Phaser.GameObjects.Rectangle;

	/* START-USER-CODE */

	// Write your code here
	preload() {
		const lang = localStorage.getItem("lang") || "en";
        this.load.json("preload_i18n", `assets/i18n/${lang}/Preload.json`);

		this.editorCreate();

		const width = this.loader.width;

		this.load.on("progress", (value: number) => {

			this.loader.width = width * value;
		});
	}

	async create() {
		const i18n = this.cache.json.get("preload_i18n");
		applyTranslations(this, i18n);

		this.scene.add("Settings", (await import("./Settings")).default);
		this.scene.add("Gallery", (await import("./Gallery")).default);
		this.scene.add("Leaderboard", (await import("./Leaderboard")).default);

		this.scene.add("Stage1", (await import("./Stage1")).default);
		this.scene.add("Stage1_Lab", (await import("./Stage1_Lab")).default);
		this.scene.add("GraficoGame", (await import("./GraficoGame")).default);
		
		this.scene.add("Tutorial", (await import("./Tutorial")).default);
		
		// this.scene.add("Stage2", (await import("./Stage2")).default);
		// this.scene.add("Memory", (await import("./Memory")).default);
		
		// this.scene.add("Stage3", (await import("./Stage3")).default);
		
		this.scene.add("Menu", (await import("./Menu")).default, true);

		this.scene.stop("Preload");

		this.events.once("shutdown", () => {
        	this.cache.json.remove("preload_i18n");
    	});
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Preload;