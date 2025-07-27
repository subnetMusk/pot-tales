// @ts-nocheck
// You can write more code here

/* START OF COMPILED CODE */

class Scene_1 extends Phaser.Scene {

	constructor() {
		super("Scene_1");

		/* START-USER-CTR-CODE */
		// Write your code here.
		// Modifiche da fare, nel preload:
		// this.load.pack("Sprite-pack", "/assets/sprite/Sprite-pack.json");
		/* END-USER-CTR-CODE */
	}

	preload(): void {
		this.load.pack("Sprite-pack", "/assets/sprite/Sprite-pack.json");
	}

	editorCreate(): void {

		// player
		const player = this.add.sprite(640, 360, "backPlayer_S");
		player.scaleX = 2;
		player.scaleY = 2;

		this.events.emit("scene-awake");
	}

	/* START-USER-CODE */

	// Write your code here

player?: Phaser.GameObjects.Sprite;
direction: 'front' | 'back' | 'side' = 'back';
lastStep: boolean = false;
lastMoveTime: number = 0;

	create() {
		this.editorCreate();
		// Salvo il riferimento al player per l'update
		this.player = this.children.getByName('player') as Phaser.GameObjects.Sprite || undefined;
		if (!this.player) {
			// fallback: cerca il primo sprite
			this.player = this.children.list.find(obj => obj instanceof Phaser.GameObjects.Sprite) as Phaser.GameObjects.Sprite;
		}
	}

update(time: number) {
	const keyboard = this.input.keyboard;
	if (!keyboard || !this.player) return;
	const wKey = keyboard.addKey('W');
	const sKey = keyboard.addKey('S');
	const aKey = keyboard.addKey('A');
	const dKey = keyboard.addKey('D');
	let moving = false;
	let newDirection = this.direction;

	// Movimento scattoso ogni 100ms
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

	if (moving && time - this.lastMoveTime > 100) {
		this.lastMoveTime = time;
		this.direction = newDirection;
		if (newDirection === 'front') {
			this.player.y -= 10;
			// Alterna R/L
			const step = this.lastStep ? 'R' : 'L';
			this.player.setTexture(`backPlayer_${step}`);
			this.lastStep = !this.lastStep;
		} else if (newDirection === 'back') {
			this.player.y += 10;
			// Alterna R/L
			const step = this.lastStep ? 'R' : 'L';
			this.player.setTexture(`frontPlayer_${step}`);
			this.lastStep = !this.lastStep;
		} else if (newDirection === 'side') {
			// Alterna M/S
			const step = this.lastStep ? 'M' : 'S';
			this.player.setTexture(`sidePlayer_${step}`);
			this.lastStep = !this.lastStep;
			// Movimento orizzontale
			if (aKey.isDown) {
				this.player.x -= 10;
			}
			if (dKey.isDown) {
				this.player.x += 10;
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
