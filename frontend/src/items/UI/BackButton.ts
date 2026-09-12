
// You can write more code here
import { soundManager } from "../../audio/SoundManager";

/* START OF COMPILED CODE */

class BackButton extends Phaser.GameObjects.Image {

	constructor(scene: Phaser.Scene, x?: number, y?: number, texture?: string, frame?: number | string) {
		super(scene, x ?? 32, y ?? 32, texture || "back", frame);

		/* START-USER-CTR-CODE */
		// Write your code here.
		let baseScale: number | null = null;
		const tweenTo = (factor: number) => {
			baseScale ??= this.scale;
			scene.tweens.add({ targets: this, scale: baseScale * factor, duration: 90, ease: 'Sine.easeOut' });
		};

		this.setInteractive()
			.on('pointerdown', () => { this.setTint(0xbababa); tweenTo(0.9); })
			.on('pointerup', () => { soundManager.playSfx(scene, "ui_click"); this.scene.scene.start('Menu'); })
			.on('pointerover', () => { this.setTint(0xbdbdbd); tweenTo(1.15); soundManager.playSfx(scene, "ui_hover"); })
			.on('pointerout', () => { this.clearTint(); tweenTo(1); });
		/* END-USER-CTR-CODE */
	}

	/* START-USER-CODE */

	// Write your code here.
	
	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default BackButton;