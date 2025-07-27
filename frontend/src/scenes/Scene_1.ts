
// You can write more code here

/* START OF COMPILED CODE */

class Scene_1 extends Phaser.Scene {

	constructor() {
		super("Scene_1");

		/* START-USER-CTR-CODE */
		/* 

		Modificare i json
		frontend/public/assets/...
		/assets/...

		PATH di phaser

		this.load.pack("Sprite-pack", "frontend/public/assets/sprite/Sprite-pack.json");
		this.load.pack("Images", "frontend/public/assets/images/Images.json");

		PATH reali

		this.load.pack("Images", "/assets/images/Images.json");
		this.load.pack("Sprite-pack", "/assets/sprite/Sprite-pack.json");

		*/
		/* END-USER-CTR-CODE */
	}

	preload(): void {

		this.load.pack("Images", "/assets/images/Images.json");
		this.load.pack("Sprite-pack", "/assets/sprite/Sprite-pack.json");
	}

	editorCreate(): void {

		// fondale
		const fondale = this.add.image(1123, 731, "Fondale");
		fondale.scaleX = 3;
		fondale.scaleY = 3;

		// player
		const player = this.add.sprite(650, 374, "backPlayer_S");
		player.scaleX = 3;
		player.scaleY = 3;

		this.events.emit("scene-awake");
	}

	/* START-USER-CODE */

	// Write your code here

	fondale?: Phaser.GameObjects.Image;
	player?: Phaser.GameObjects.Sprite;
	lastMoveTime: number = 0;
	lastStep: boolean = false;
	direction: 'front' | 'back' | 'side' = 'back';
	stepValue: number = 10;

	create() {
		this.editorCreate();
		// Salvo riferimenti agli oggetti
		this.player = this.children.list.find(obj => obj instanceof Phaser.GameObjects.Sprite) as Phaser.GameObjects.Sprite;
		this.fondale = this.children.list.find(obj => obj instanceof Phaser.GameObjects.Image && obj.texture.key === 'Fondale') as Phaser.GameObjects.Image;
	}

	update(time: number) {
		const keyboard = this.input.keyboard;
		if (!keyboard || !this.player || !this.fondale) return;
		const wKey = keyboard.addKey('W');
		const sKey = keyboard.addKey('S');
		const aKey = keyboard.addKey('A');
		const dKey = keyboard.addKey('D');
		let moving = false;
		let newDirection: 'front' | 'back' | 'side' = this.direction;
		// Direzione e flip
		if (wKey.isDown) {
			newDirection = 'front';
			moving = true;
		} else if (sKey.isDown) {
			newDirection = 'back';
			moving = true;
		} else if (aKey.isDown) {
			newDirection = 'side';
			this.player.setFlipX(false);
			moving = true;
		} else if (dKey.isDown) {
			newDirection = 'side';
			this.player.setFlipX(true);
			moving = true;
		}
		// Movimento scattoso ogni 100ms
		if (moving && time - this.lastMoveTime > 100) {
			this.lastMoveTime = time;
			this.direction = newDirection;
			if (newDirection === 'front') {
				this.fondale.y += this.stepValue;
				const step = this.lastStep ? 'R' : 'L';
				this.player.setTexture(`backPlayer_${step}`);
				this.lastStep = !this.lastStep;
			} else if (newDirection === 'back') {
				this.fondale.y -= this.stepValue;
				const step = this.lastStep ? 'R' : 'L';
				this.player.setTexture(`frontPlayer_${step}`);
				this.lastStep = !this.lastStep;
			} else if (newDirection === 'side') {
				const step = this.lastStep ? 'M' : 'S';
				this.player.setTexture(`sidePlayer_${step}`);
				this.lastStep = !this.lastStep;
				if (aKey.isDown) {
					this.fondale.x += this.stepValue;
				}
				if (dKey.isDown) {
					this.fondale.x -= this.stepValue;
				}
			}
		} else if (!moving) {
			// Personaggio fermo: texture stop
			if (this.direction === 'front') {
				this.player.setTexture('backPlayer_S');
			} else if (this.direction === 'back') {
				this.player.setTexture('frontPlayer_S');
			} else if (this.direction === 'side') {
				this.player.setTexture('sidePlayer_S');
			}
		}
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here

export default Scene_1;