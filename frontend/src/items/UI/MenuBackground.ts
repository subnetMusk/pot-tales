
// You can write more code here

/* START OF COMPILED CODE */

class MenuBackground extends Phaser.GameObjects.Container {

	constructor(scene: Phaser.Scene, x?: number, y?: number) {
		super(scene, x ?? 519, y ?? 350);

		// bg_filter
		const bg_filter = scene.add.rectangle(121, 10, 1280, 720);
		bg_filter.alpha = 0.4;
		bg_filter.isFilled = true;
		bg_filter.fillColor = 0;
		this.add(bg_filter);

		// bg
		const bg = scene.add.sprite(121, 0, "tunnel_1", 0);
		bg.scaleX = 20.01;
		bg.scaleY = 20.01;
		this.add(bg);

		/* START-USER-CTR-CODE */
		// Write your code here.
		if (!scene.anims.exists('tunnel_spin')) {
			scene.anims.create({
				key: 'tunnel_spin',
				frames: scene.anims.generateFrameNumbers('tunnel_1', { start: 0, end: 11 }),
				frameRate: 9,
				repeat: -1
			});
		}
		bg.play('tunnel_spin');
		/* END-USER-CTR-CODE */
	}

	/* START-USER-CODE */

	// Write your code here.

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default MenuBackground
