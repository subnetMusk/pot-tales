
// You can write more code here

/* START OF COMPILED CODE */

class Player extends Phaser.GameObjects.Container {

	constructor(scene: Phaser.Scene, x?: number, y?: number) {
		super(scene, x ?? 13, y ?? 8);

		// player
		const player = scene.physics.add.sprite(0, 0, "frontPlayer_L");
		player.body.setSize(16, 16, false);
		this.add(player);

		// darkMask
		const darkMask = scene.add.image(0, 0, "darkMask");
		darkMask.scaleX = 0.25;
		darkMask.scaleY = 0.25;
		this.add(darkMask);

		this.player = player;
		this.darkMask = darkMask;

		/* START-USER-CTR-CODE */
		if (this.scene.input && this.scene.input.keyboard) {
			this.rightKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
			this.downKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
			this.upKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
			this.leftKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
		}

		this.scene.events.on("update", (time: number, delta: number) => this.movePlayer(time, delta), this);

		this.Ikey = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.I);
		this.Ikey?.on("down", () => {
			//controllo collisione
			this.controllaInterazioneOggetto();
		});

		/* END-USER-CTR-CODE */
	}

	public player: Phaser.Physics.Arcade.Sprite;
	private darkMask: Phaser.GameObjects.Image;

	/* START-USER-CODE */
	private stepSize: number = 16;					//grandezza del passo
	private stepDelay: number = 200;				//attesa in ms tra i frame
	//Input della tastiera
	private rightKey!: Phaser.Input.Keyboard.Key;
	private downKey!: Phaser.Input.Keyboard.Key;
	private upKey!: Phaser.Input.Keyboard.Key;
	private leftKey!: Phaser.Input.Keyboard.Key;
	private Ikey?: Phaser.Input.Keyboard.Key;

	lastMoveTime: number = 0;						//tempo dell'ultimo movimento (per l'effetto a bassi fps)
	lastStep: boolean = false;						// Ultima textura usata
	direction: 'front' | 'back' | 'side' = 'front';	// Direzione in cui sto guardando

	public flashlight(active: boolean) {
		this.darkMask.visible = active;
	}

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
				if (time - this.lastMoveTime >= this.stepDelay) {
					this.x += dx;
					this.y += dy;

					this.lastMoveTime = time;
					this.updateMoveTexture(); // qui viene invertito lastStep
				}
			} else {
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
		if (this.direction === "front") {
			this.player.setTexture(this.lastStep ? "frontPlayer_L" : "frontPlayer_R");
		} else if (this.direction === "back") {
			this.player.setTexture(this.lastStep ? "backPlayer_L" : "backPlayer_R"); // CORRETTO
		} else if (this.direction === "side") {
			this.player.setTexture(this.lastStep ? "sidePlayer_M" : "sidePlayer_S");
		}

		// Invertiamo lastStep **solo qui**, dopo aver cambiato la texture
		this.lastStep = !this.lastStep;
	}
	/* END-USER-CODE */

	/* START-USER-CTR-CODE */
	private controllaInterazioneOggetto() {
		this.scene.oggVector.forEach(ogg => {
			const distanza = Phaser.Math.Distance.Between(this.x, this.y, ogg.x, ogg.y);
			//controllare che gli oggetti non siano abbastanza vicini
			if(distanza < 20){
				ogg.interagisci();
			}
		});
	}

	/* END-USER-CTR-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Player;