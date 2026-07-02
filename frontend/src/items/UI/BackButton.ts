
// You can write more code here

/* START OF COMPILED CODE */

class BackButton extends Phaser.GameObjects.Image {

	constructor(scene: Phaser.Scene, x?: number, y?: number, texture?: string, frame?: number | string) {
		super(scene, x ?? 32, y ?? 32, texture || "back", frame);

		/* START-USER-CTR-CODE */
		// Write your code here.
		this.setInteractive()
			.on('pointerdown', () => this.setTint(0xbababa))
			.on('pointerup', () => this.scene.scene.start('Menu'))
			.on('pointerover', () => this.setTint(0xbdbdbd))
			.on('pointerout', () => this.clearTint());
		/* END-USER-CTR-CODE */
	}

	/* START-USER-CODE */

	// Write your code here.
	
	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default BackButton;