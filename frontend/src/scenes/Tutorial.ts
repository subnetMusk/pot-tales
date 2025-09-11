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
		this.cameras.main.setZoom(8);
		this.cameras.main.startFollow(this.player.player, true, 1.0, 1.0, -this.player.x, -this.player.y);


		// Add dark overlay everywhere
		
		const overlay = this.add.graphics();
		overlay.fillStyle(0x000000, 0.9); // Black with 90% opacity
		overlay.fillRect(0, 0, this.scale.width, this.scale.height);
		overlay.setScrollFactor(0); // Keep overlay fixed to camera
		overlay.setDepth(50); // Below spotlight but above background

		// Create a spotlight effect - a circle where the dark overlay is removed
		const spotlight = this.add.graphics();
		spotlight.fillCircle(0, 0, 15); // Circle with radius 15 pixels
		spotlight.setScrollFactor(0);
		spotlight.setDepth(51);

		// Create a mask from the spotlight circle
		const mask = spotlight.createGeometryMask();
		mask.setInvertAlpha(true); // Invert the mask so the circle is transparent

		// Apply the mask to the overlay to create the spotlight effect
		overlay.setMask(mask);

		// spotlight follows player
		// Make the spotlight follow the player
		this.tweens.add({
			targets: spotlight,
			x: this.player.x,
			y: this.player.y,
			duration: 0,
			repeat: -1,
			onUpdate: () => {
				spotlight.setPosition(this.player.x, this.player.y);
			}
		});

		// Timer di 30 secondi
		this.time.delayedCall(30000, () => {
			// Codice da eseguire dopo 30 secondi
			console.log("30 secondi sono passati!");
		});

		

	}
	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Tutorial;