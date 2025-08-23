
// You can write more code here

/* START OF COMPILED CODE */

class Back_button extends Phaser.GameObjects.Image {

	constructor(scene: Phaser.Scene, x?: number, y?: number, texture?: string, frame?: number | string) {
		super(scene, x ?? 32, y ?? 32, texture || "back", frame);

		/* START-USER-CTR-CODE */
		// Write your code here.

		this.setInteractive();

		this.on('pointerover', () => { this.setTint(0x44ff44); });
		this.on('pointerout', () => { this.clearTint(); });
		this.on('pointerdown', () => { this.setTint(0x00aaff); });
		this.on('pointerup', () => { scene.scene.start("Menu"); });

		/* END-USER-CTR-CODE */
	}

	/* START-USER-CODE */

	// Write your code here.

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Back_button