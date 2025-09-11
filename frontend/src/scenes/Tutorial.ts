import Player from "../items/Main/Player";
// You can write more code here

/* START OF COMPILED CODE */

class Tutorial extends Phaser.Scene {

	constructor() {
		super("Tutorial");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

		// bgBL
		const bgBL = this.add.image(640, 360, "Background");
		bgBL.setOrigin(1, 0);
		bgBL.flipX = true;
		bgBL.flipY = true;

		// bgBR
		const bgBR = this.add.image(640, 360, "Background");
		bgBR.setOrigin(0, 0);
		bgBR.flipY = true;

		// bgTR
		const bgTR = this.add.image(640, 360, "Background");
		bgTR.setOrigin(0, 1);

		// bgTL
		const bgTL = this.add.image(640, 360, "Background");
		bgTL.setOrigin(1, 1);
		bgTL.flipX = true;

		// player
		const player = new Player(this, 640, 360);
		this.add.existing(player);

		this.player = player;

		this.events.emit("scene-awake");
	}

	private player!: Player;

	/* START-USER-CODE */

	// Write your code here
	preload() {
		this.load.pack("Player-pack", "frontend/public/assets/images/player-pack.json");
		this.load.pack("Tutorial-pack", "frontend/public/assets/images/tutorial-pack.json");
	}

	create() {
		this.editorCreate();
		this.cameras.main.setZoom(5);
		this.cameras.main.startFollow(this.player.player, true, 1.0, 1.0, -this.player.x, -this.player.y);

	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Tutorial;