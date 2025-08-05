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
		const loading = this.add.text(574, 305, "", {});
		loading.name = "Loading";
		loading.text = "Loading...";
		loading.setStyle({ "color": "#f0f8ff", "fontFamily": "PixelifySans-VariableFont_wght", "fontSize": "30px" });

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

		this.load.pack("Icons-pack", "frontend/public/assets/images/icons-pack.json");
	}

	async create() {
		const i18n = this.cache.json.get("preload_i18n");
		applyTranslations(this, i18n);

		const { default: Menu } = await import("./Menu");
		this.scene.add("Menu", Menu, true);
		this.scene.stop("Preload");
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Preload;