
// You can write more code here

/* START OF COMPILED CODE */

class Player extends Phaser.GameObjects.Container {

	constructor(scene: Phaser.Scene, x?: number, y?: number) {
		super(scene, x ?? 13, y ?? 8);

		// player
		const player = scene.physics.add.sprite(0, 0, "frontPlayer_L");
		player.body.setSize(16, 16, false);
		this.add(player);

		// BottomBound
		const bottomBound = scene.add.rectangle(0, 20, 15, 16);
		bottomBound.isStroked = true;
		this.add(bottomBound);

		// TopBound
		const topBound = scene.add.rectangle(0, -3, 15, 16);
		topBound.isStroked = true;
		this.add(topBound);

		// LeftBound
		const leftBound = scene.add.rectangle(-15, 8, 16, 8);
		leftBound.isStroked = true;
		this.add(leftBound);

		// RightBound
		const rightBound = scene.add.rectangle(15, 8, 16, 8);
		rightBound.isStroked = true;
		this.add(rightBound);

		// TLBound
		const tLBound = scene.add.rectangle(-15, -3, 15, 16);
		tLBound.isStroked = true;
		this.add(tLBound);

		// TRBound
		const tRBound = scene.add.rectangle(15, -3, 15, 16);
		tRBound.isStroked = true;
		this.add(tRBound);

		// BLBound
		const bLBound = scene.add.rectangle(-15, 20, 15, 16);
		bLBound.isStroked = true;
		this.add(bLBound);

		// BRBound
		const bRBound = scene.add.rectangle(15, 20, 15, 16);
		bRBound.isStroked = true;
		this.add(bRBound);

		this.player = player;
		this.bottomBound = bottomBound;
		this.topBound = topBound;
		this.leftBound = leftBound;
		this.rightBound = rightBound;
		this.tLBound = tLBound;
		this.tRBound = tRBound;
		this.bLBound = bLBound;
		this.bRBound = bRBound;

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
	private bottomBound: Phaser.GameObjects.Rectangle;
	private topBound: Phaser.GameObjects.Rectangle;
	private leftBound: Phaser.GameObjects.Rectangle;
	private rightBound: Phaser.GameObjects.Rectangle;
	private tLBound: Phaser.GameObjects.Rectangle;
	private tRBound: Phaser.GameObjects.Rectangle;
	private bLBound: Phaser.GameObjects.Rectangle;
	private bRBound: Phaser.GameObjects.Rectangle;

	/* START-USER-CODE */
	private stepSize: number = 16;					//grandezza del passo
	private stepDelay: number = 200;				//attesa in ms tra i frame
	private BoundsDebug: boolean = true;			//se true mostra i boundaries

	//Input della tastiera
	private rightKey!: Phaser.Input.Keyboard.Key;
	private downKey!: Phaser.Input.Keyboard.Key;
	private upKey!: Phaser.Input.Keyboard.Key;
	private leftKey!: Phaser.Input.Keyboard.Key;
	private Ikey?: Phaser.Input.Keyboard.Key;

	boundaries : Phaser.GameObjects.Rectangle[] = [];

	lastMoveTime: number = 0;						//tempo dell'ultimo movimento (per l'effetto a bassi fps)
	lastStep: boolean = false;						// Ultima textura usata
	direction: 'front' | 'back' | 'side' = 'front';	// Direzione in cui sto guardando

	//Check dell'overlap fra due rettangoli
	private checkOverlap(rect1: Phaser.GameObjects.Rectangle, rect2: Phaser.GameObjects.Rectangle): boolean {
		const rect1WorldX = this.x + rect1.x;
		const rect1WorldY = this.y + rect1.y;

		const bounds1 = new Phaser.Geom.Rectangle(
			rect1WorldX - rect1.width / 2,
			rect1WorldY - rect1.height / 2,
			rect1.width,
			rect1.height
		);
		const bounds2 = new Phaser.Geom.Rectangle(
			rect2.x - rect2.width / 2,
			rect2.y - rect2.height / 2,
			rect2.width,
			rect2.height
		);
		return Phaser.Geom.Rectangle.Overlaps(bounds1, bounds2);
	}

	//Passaggio della lista dei boundaries dalla scena al player
	public setBoundaries(boundsList : Object[]) {
		this.leftBound.visible = this.BoundsDebug;
		this.rightBound.visible = this.BoundsDebug;
		this.topBound.visible = this.BoundsDebug;
		this.bottomBound.visible = this.BoundsDebug;

		for (let i = 0; i < boundsList.length; i++) {
			let b = boundsList[i] as Phaser.GameObjects.Rectangle;
			b.visible = this.BoundsDebug; 					// Mostra i boundaries se il debug è attivo
			this.boundaries.push(b);
		}
		if (this.BoundsDebug) console.log("Caricati i boundaries");
	}

	public debug(v : boolean) {
		if (v) {
			this.BoundsDebug = true;
			this.leftBound.visible = true;
			this.rightBound.visible = true;
			this.topBound.visible = true;
			this.bottomBound.visible = true;
			this.boundaries.forEach(b => b.visible = true);
		} else {
			this.BoundsDebug = false;
			this.leftBound.visible = false;
			this.rightBound.visible = false;
			this.topBound.visible = false;
			this.bottomBound.visible = false;
			this.boundaries.forEach(b => b.visible = false);
		}
	}

	//Funzione di movimento
	private movePlayer(time: number, delta: number) {
		if (this.player.body !== null) {
			let dx = 0;
			let dy = 0;
			let moving = false;

			// Input verticale
			if (this.upKey.isDown && !this.downKey.isDown) {
				if (time - this.lastMoveTime >= this.stepDelay) {				//Controlla solo ogni stepDelay
					for (let i = 0; i < this.boundaries.length; i++) {			//Controlla collisione con tutti i boundaries
						let b = this.boundaries[i];
						if (this.checkOverlap(this.topBound, b)) {
							if (this.BoundsDebug) console.log("Collisione in alto con boundary");
							dy = 0;												//Collisione = movimento nullo, animazione attiva
							break;
						} else {
							dy = -this.stepSize;
						}
					}
				}
				this.direction = "back";
				moving = true;
			} else if (this.downKey.isDown && !this.upKey.isDown) {
				if (time - this.lastMoveTime >= this.stepDelay) {
					for (let i = 0; i < this.boundaries.length; i++) {
						let b = this.boundaries[i];
						if (this.checkOverlap(this.bottomBound, b)) {
							if (this.BoundsDebug) console.log("Collisione in basso con boundary");
							dy = 0;
							break;
						} else {
							dy = this.stepSize;
						}
					}
				}
				this.direction = "front";
				moving = true;
			}

			// Input orizzontale
			if (this.leftKey.isDown && !this.rightKey.isDown) {
				if (time - this.lastMoveTime >= this.stepDelay) {
					for (let i = 0; i < this.boundaries.length; i++) {
						let b = this.boundaries[i];
						if (this.checkOverlap(this.leftBound, b)) {
							if (this.BoundsDebug) console.log("Collisione a sinistra con boundary");
							dx = 0;
							break;
						} else {
							dx = -this.stepSize;
						}
					}
				}
				this.direction = "side";
				this.player.setFlipX(false);
				moving = true;
			} else if (this.rightKey.isDown && !this.leftKey.isDown) {
				if (time - this.lastMoveTime >= this.stepDelay) {
					for (let i = 0; i < this.boundaries.length; i++) {
						let b = this.boundaries[i];
						if (this.checkOverlap(this.rightBound, b)) {
							if (this.BoundsDebug) console.log("Collisione a destra con boundary");
							dx = 0;
							break;
						} else {
							dx = this.stepSize;
						}
					}
				}
				this.direction = "side";
				this.player.setFlipX(true);
				moving = true;
			}

			//Input diagonale 
			if (this.rightKey.isDown && this.downKey.isDown) {
				if (time - this.lastMoveTime >= this.stepDelay) {
					for (let i = 0; i < this.boundaries.length; i++) {
						let b = this.boundaries[i];
						if (this.checkOverlap(this.bRBound, b)) {
							if (this.BoundsDebug) console.log("Collisione in basso a destra con boundary");
							dx = 0;
							dy = 0;
							break;
						}
					}
				}
			}
			if (this.rightKey.isDown && this.upKey.isDown) {
				if (time - this.lastMoveTime >= this.stepDelay) {
					for (let i = 0; i < this.boundaries.length; i++) {
						let b = this.boundaries[i];
						if (this.checkOverlap(this.tRBound, b)) {
							if (this.BoundsDebug) console.log("Collisione in alto a destra con boundary");
							dx = 0;
							dy = 0;
							break;
						}
					}
				}
			}
			if (this.leftKey.isDown && this.downKey.isDown) {
				if (time - this.lastMoveTime >= this.stepDelay) {
					for (let i = 0; i < this.boundaries.length; i++) {
						let b = this.boundaries[i];
						if (this.checkOverlap(this.bLBound, b)) {
							if (this.BoundsDebug) console.log("Collisione in basso a sinistra con boundary");
							dx = 0;
							dy = 0;
							break;
						}
					}
				}
			}
			if (this.leftKey.isDown && this.upKey.isDown) {
				if (time - this.lastMoveTime >= this.stepDelay) {
					for (let i = 0; i < this.boundaries.length; i++) {
						let b = this.boundaries[i];
						if (this.checkOverlap(this.tLBound, b)) {
							if (this.BoundsDebug) console.log("Collisione in alto a sinistra con boundary");
							dx = 0;
							dy = 0;
							break;
						}
					}
				}
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

	private controllaInterazioneOggetto() {
		this.scene.oggVector.forEach(ogg => {
			const distanza = Phaser.Math.Distance.Between(this.x, this.y, ogg.x, ogg.y);
			//TODO : controllare che gli oggetti non siano abbastanza vicini
			if(distanza < 20 &&  ogg.set == true) {
				ogg.interagisci();
			}
		});
	}
	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Player;