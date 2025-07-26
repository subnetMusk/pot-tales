// You can write more code here

/* START OF COMPILED CODE */

class Scene1 extends Phaser.Scene {
private player!: Phaser.GameObjects.Image;
private isFacingRight: boolean = true;
private lastStep: boolean = false;
private lastMoveTime: number = 0;

update(time: number) {
	const keyboard = this.input.keyboard;
	if (!keyboard) return;
	const right = keyboard.addKey('RIGHT');
	const left = keyboard.addKey('LEFT');
	const change = 20;

	// Movimento "scattoso" ogni 100ms
	if (right.isDown || left.isDown) {
		if (time - this.lastMoveTime > 100) {
			// Alterna la texture ad ogni step
			if (this.lastStep) {
				this.player.setTexture("MC00");
			} else {
				this.player.setTexture("MC01");
			}
			this.lastStep = !this.lastStep;

			if (right.isDown) {
				if (!this.isFacingRight) {
					this.player.scaleX *= -1;
					this.isFacingRight = true;
				}
				this.player.x += change;
			}
			if (left.isDown) {
				if (this.isFacingRight) {
					this.player.scaleX *= -1;
					this.isFacingRight = false;
				}
				this.player.x -= change;
			}
			this.lastMoveTime = time;
		}
	} else {
		// Nessun input: texture base
		if (this.player.texture.key !== "MC00") {
			this.player.setTexture("MC00");
		}
	}
}
	constructor() {
		super("Scene1");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	preload(): void {
		this.load.pack("pack", "/assets/sprite/sprites.json");
		this.load.image("BG", "/assets/images/BG.png");
	}

	editorCreate(): void {
		// bG
		const bG = this.add.image(0, 0, "BG");
		bG.scaleX = 0.835;
		bG.scaleY = 0.7067954613128317;
		bG.setOrigin(0, 0);

		// player
		this.player = this.add.image(204, 552, "MC00");
		this.player.scaleX = 5;
		this.player.scaleY = 5;
		this.isFacingRight = true;

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

export default Scene1;
