
// You can write more code here

/* START OF COMPILED CODE */

class VolumeBar extends Phaser.GameObjects.Container {

	constructor(scene: Phaser.Scene, x?: number, y?: number) {
		super(scene, x ?? 17, y ?? 10);

		// volume_fill
		const volume_fill = scene.add.rectangle(64, 16, 121, 28);
		volume_fill.isFilled = true;
		volume_fill.fillColor = 0;
		this.add(volume_fill);

		// volume
		const volume = scene.add.image(64, 16, "volume");
		this.add(volume);

		/* START-USER-CTR-CODE */
		// Write your code here.

		const colors = [
			0xA60000,
			0xB92C1A,
			0xCC5834,
			0xDF844E,
			0xEBAF7D,
			0xD6C97D,
			0xB5D67D,
			0x7DD6A5,
			0x57C67A,
			0x57BA3D
		];

		for (let i = 0; i < colors.length; i++) {
			const rect = scene.add.rectangle(11 + i * 12, 15, 12, 28, colors[i]);
			this.rects.push(rect);

			rect.setInteractive().on("pointerdown", () => {this.updateBar(i + 1);});
			this.addAt(rect, 1);
		}

		scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
			if (pointer.isDown && this.y < pointer.y && pointer.y < this.y + 28 * this.scaleY) {
				const scaleX = this.scaleX || 1;
				const localX = (pointer.x - this.x) / scaleX;

				let index = Math.floor((localX - 5) / 12);
				index = Phaser.Math.Clamp(index, 0, this.rects.length);

				this.updateBar(index);
			}
		});

		/* END-USER-CTR-CODE */
	}

	/* START-USER-CODE */

	// Write your code here.
	private rects: Phaser.GameObjects.Rectangle[] = [];
	private onValueChanged?: (value: number) => void;

	public init(value: number, onValueChanged?: (value: number) => void) {
		this.updateBar(value);
		this.onValueChanged = onValueChanged;
	}

	private updateBar(level: number) {
    	for (let i = 0; i < this.rects.length; i++) this.rects[i].setAlpha(i < level ? 1 : 0.4);
    	if (this.onValueChanged) this.onValueChanged(level);
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default VolumeBar;