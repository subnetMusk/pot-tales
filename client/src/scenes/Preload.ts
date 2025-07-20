
// You can write more code here

/* START OF COMPILED CODE */

class Preload extends Phaser.Scene {

	constructor() {
		super("Preload");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

		// loader_bg
		const loader_bg = this.add.rectangle(400, 300, 200, 20);
		loader_bg.isFilled = true;

		// loader
		const loader = this.add.rectangle(400, 300, 198, 18);
		loader.isFilled = true;
		loader.fillColor = 10883584;

		// Loading
		const loading = this.add.text(345.5, 268, "", {});
		loading.text = "Loading...";
		loading.setStyle({ "fontSize": "18px" });

		this.loader_bg = loader_bg;
		this.loader = loader;

		this.events.emit("scene-awake");
	}

	private loader_bg!: Phaser.GameObjects.Rectangle;
	private loader!: Phaser.GameObjects.Rectangle;

	/* START-USER-CODE */

	// Write your code here
	preload() {
		this.editorCreate();

		const width = this.loader.width;

		this.load.on("progress", (value: number) => {

			this.loader.width = width * value;
		});
	}

	async create() {
		const { default: Menu } = await import("./Menu");
		this.scene.add("Menu", Menu, true);
		this.scene.stop("Preload");
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Preload;