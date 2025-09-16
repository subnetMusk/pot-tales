class Player extends Phaser.GameObjects.Container {

	constructor(scene: Phaser.Scene, x?: number, y?: number) {
		super(scene, x ?? 13, y ?? 8);

		// player
		const player = scene.physics.add.sprite(0, 0, "frontPlayer_S");
		player.body.setSize(16, 16, false);
		this.add(player);

		this.player = player;

		/* START-USER-CTR-CODE */
		if (this.scene.input && this.scene.input.keyboard) {
			this.rightKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
			this.downKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
			this.upKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
			this.leftKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
		}

		this.scene.events.on("update", (time: number, delta: number) => this.movePlayer(time, delta), this);
		/* END-USER-CTR-CODE */
	}

	public player: Phaser.Physics.Arcade.Sprite;

	private stepSize: number = 16;					//grandezza del passo
	private stepDelay: number = 200;				//attesa in ms tra i frame
	//Input della tastiera
	private rightKey!: Phaser.Input.Keyboard.Key;
	private downKey!: Phaser.Input.Keyboard.Key;
	private upKey!: Phaser.Input.Keyboard.Key;
	private leftKey!: Phaser.Input.Keyboard.Key;

	lastMoveTime: number = 0;						//tempo dell'ultimo movimento (per l'effetto a bassi fps)
	lastStep: boolean = false;						// Ultima textura usata
	direction: 'front' | 'back' | 'side' = 'front';	// Direzione in cui sto guardando

	//Funzione di movimento, 
	private movePlayer(time: number, delta: number) {
		if (this.player.body !== null) {
			let dx = 0;
			let dy = 0;
			let moving = false;

			// Input verticale
			if (this.upKey.isDown && !this.downKey.isDown) {
				dy = -this.stepSize;
				this.direction = "back";
				moving = true;
			} else if (this.downKey.isDown && !this.upKey.isDown) {
				dy = this.stepSize;
				this.direction = "front";
				moving = true;
			}

			// Input orizzontale
			if (this.leftKey.isDown && !this.rightKey.isDown) {
				dx = -this.stepSize;
				this.direction = "side";
				this.player.setFlipX(false);
				moving = true;
			} else if (this.rightKey.isDown && !this.leftKey.isDown) {
				dx = this.stepSize;
				this.direction = "side";
				this.player.setFlipX(true);
				moving = true;
			}

			// Se sto muovendo
			if (moving) {
				// posso fare lo step solo dopo stepDelay
				if (time - this.lastMoveTime >= this.stepDelay) {
					this.player.x += dx;
					this.player.y += dy;

					this.lastMoveTime = time;
					this.updateMoveTexture();
					this.lastStep = !this.lastStep;
				}
			} else {
				// Se non premo nulla metto la texture ferma
				this.updateIdleTexture();
			}
		}
	}

	private updateIdleTexture() {
		switch (this.direction) {		//Carico la texture in base alla direzione
			case "front":
				this.player.setTexture("frontPlayer_S");
				break;
			case "back":
				this.player.setTexture("backPlayer_S");
				break;
			case "side":
				this.player.setTexture("sidePlayer_S");
				break;
		}
	}

	private updateMoveTexture() {
		switch (this.direction) {	//Switch delle texture
			case "front":
				this.player.setTexture(this.lastStep ? "frontPlayer_L" : "frontPlayer_R");
				break;
			case "back":
				this.player.setTexture(this.lastStep ? "backPlayer_L" : "backPlayer_R");
				break;
			case "side":
				this.player.setTexture(this.lastStep ? "sidePlayer_M" : "sidePlayer_S");
				break;
		}
	}
}

export default Player;
