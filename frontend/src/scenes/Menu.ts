
// You can write more code here

/* START OF COMPILED CODE */

class Menu extends Phaser.Scene {

	constructor() {
		super("Menu");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

		// play_button
		const play_button = this.add.rectangle(400, 300, 250, 50);
		play_button.isFilled = true;

		// Play
		const play = this.add.text(363.5, 285, "", {});
		play.text = "Play";
		play.setStyle({ "color": "#000000", "fontSize": "30px", "stroke": "#000000" });

		this.play_button = play_button;

		this.events.emit("scene-awake");
	}

	private play_button!: Phaser.GameObjects.Rectangle;

	/* START-USER-CODE */

	// Write your code here

	create() {
		this.editorCreate();
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Menu;