
// You can write more code here
import MenuBackground from "../items/UI/MenuBackground";
import Back_button from "../items/UI/Back_button";
/* START OF COMPILED CODE */

class Leaderboard extends Phaser.Scene {

	constructor() {
		super("Leaderboard");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

		// menuBackground
		const menuBackground = new MenuBackground(this, 520, 360);
		this.add.existing(menuBackground);
		
		// back_button
		const back_button = new Back_button(this, 1182, 98);
		this.add.existing(back_button);
		back_button.scaleX = 1.5;
		back_button.scaleY = 1.5;

		this.events.emit("scene-awake");
	}

	/* START-USER-CODE */

	// Write your code here

	create() {
		this.editorCreate();
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Leaderboard;