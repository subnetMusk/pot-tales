
// You can write more code here

/* START OF COMPILED CODE */

import Rectangle = Phaser.Geom.Rectangle;

class Player extends Phaser.GameObjects.Container {

	constructor(scene: Phaser.Scene, x?: number, y?: number) {
		super(scene, x ?? 13, y ?? 8);

		// player
		const player = scene.physics.add.sprite(0, 0, "frontPlayer_S");
		player.body.setSize(16, 16, false);
		this.add(player);

		// BottomBound
		const bottomBound = scene.add.rectangle(0, 16, 15, 8);
		bottomBound.isStroked = true;
		this.add(bottomBound);

		// TopBound
		const topBound = scene.add.rectangle(0, 1, 15, 8);
		topBound.isStroked = true;
		this.add(topBound);

		// LeftBound
		const leftBound = scene.add.rectangle(-11, 8, 8, 8);
		leftBound.isStroked = true;
		this.add(leftBound);

		// RightBound
		const rightBound = scene.add.rectangle(11, 8, 8, 8);
		rightBound.isStroked = true;
		this.add(rightBound);

		// TLBound
		const tLBound = scene.add.rectangle(-11, 1, 8, 8);
		tLBound.isStroked = true;
		tLBound.strokeColor = 3211231;
		this.add(tLBound);

		// TRBound
		const tRBound = scene.add.rectangle(11, 1, 8, 8);
		tRBound.isStroked = true;
		tRBound.strokeColor = 3211231;
		this.add(tRBound);

		// BLBound
		const bLBound = scene.add.rectangle(-11, 16, 8, 8);
		bLBound.isStroked = true;
		bLBound.strokeColor = 3211231;
		this.add(bLBound);

		// BRBound
		const bRBound = scene.add.rectangle(11, 16, 8, 8);
		bRBound.isStroked = true;
		bRBound.strokeColor = 3211231;
		this.add(bRBound);

		// darkMask
		const darkMask = scene.add.image(0, 0, "darkMask");
		darkMask.scaleX = 0.25;
		darkMask.scaleY = 0.25;
		this.add(darkMask);

		this.player = player;
		this.bottomBound = bottomBound;
		this.topBound = topBound;
		this.leftBound = leftBound;
		this.rightBound = rightBound;
		this.tLBound = tLBound;
		this.tRBound = tRBound;
		this.bLBound = bLBound;
		this.bRBound = bRBound;
		this.darkMask = darkMask;

		/* START-USER-CTR-CODE */
		if (this.scene.input && this.scene.input.keyboard) {
			this.rightKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
			this.downKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
			this.upKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
			this.leftKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
		}

		this.scene.events.on("update", (time: number) => this.movePlayer(time), this);

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
	private darkMask: Phaser.GameObjects.Image;

	/* START-USER-CODE */
	private stepSize: number = 8;					//Grandezza del passo
	private stepDelay: number = 100;				//Attesa in ms tra i frame
	private BoundsDebug: boolean = true;			//true mostra i boundaries
    public movementAllowed: boolean = true;       //Disabilita l'input

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
	//Supporta solo Rectangle, Sprite e Image
	public setBoundaries(boundsList : Object[]) {
		for (let i = 0; i < boundsList.length; i++) {
			let obj = boundsList[i];

			if (obj instanceof Phaser.GameObjects.Rectangle) {
				obj.visible = this.BoundsDebug;
				this.boundaries.push(obj);
			} else if (obj instanceof Phaser.GameObjects.Sprite || obj instanceof Phaser.Physics.Arcade.Sprite) {
				const bounds = obj.getBounds();
				const rect = this.scene.add.rectangle(bounds.x + bounds.width/2, bounds.y + bounds.height/2, bounds.width, bounds.height);
				rect.isStroked = true;
				rect.strokeColor = 0xff0000;
				this.boundaries.push(rect);
			} else if (obj instanceof Phaser.GameObjects.Image) {
				const bounds = obj.getBounds();
				const rect = this.scene.add.rectangle(bounds.x + bounds.width/2, bounds.y + bounds.height/2, bounds.width, bounds.height);
				rect.isStroked = true;
				rect.strokeColor = 0x00ff00;
				this.boundaries.push(rect);
			} else {
				// Oggetto non supportato
				const objName = (obj as any).name || obj.constructor.name || 'oggetto sconosciuto';
				console.log(`L'oggetto ${objName} non può essere convertito in boundary`);
			}
		}
		if (this.BoundsDebug) console.log("Caricati i boundaries");
	}

	public flashlight(state : boolean) {
		this.darkMask.visible = state;
	}

	public debug(v : boolean) {
			this.BoundsDebug = v;
			this.leftBound.visible = v;
			this.rightBound.visible = v;
			this.topBound.visible = v;
			this.bottomBound.visible = v;
			this.tLBound.visible = v;
			this.tRBound.visible = v;
			this.bLBound.visible = v;
			this.bRBound.visible = v;
			this.boundaries.forEach(b => b.visible = v);
	}

	//Funzione di movimento
	private movePlayer(time: number) {

        //Condizioni per il movimento
        if (!this.movementAllowed) return;                          //Input disabilitato
        if (this.player.body === null) return;                      //Controlla che player non sia null
        if (time - this.lastMoveTime < this.stepDelay) return;      //Movimento a scatti

        let dx = 0;                                         //Componente orizzontale
        let dy = 0;                                         //Componente verticale
        let moving = false;                                 //Stato del movimento

        if (this.upKey.isDown && !this.downKey.isDown) {            //Freccia sù
            dy = -this.stepSize;                                    //Spostamento
            this.direction = "back";                                //Nuova direzione
            moving = true;                                          //Aggiornamento stato

            //Controllo collisioni
            if (this.boundaries.length > 0) for (let bound of this.boundaries) {
                if (this.checkOverlap(this.topBound, bound)) {      //Collisione
                    dy = 0;                                         //Annullo il movimento
                    break;
                }
            }
        } else if (this.downKey.isDown && !this.upKey.isDown) {
            dy = this.stepSize;                                     //Spostamento
            this.direction = "front";                               //Nuova direzione
            moving = true;                                          //Aggiornamento stato

            //Controllo collisioni
            if (this.boundaries.length > 0) for (let bound of this.boundaries) {
                if (this.checkOverlap(this.bottomBound, bound)) {   //Collisione
                    dy = 0;                                         //Annullo il movimento
                    break;
                }
            }
        }

        // Input orizzontale
        if (this.leftKey.isDown && !this.rightKey.isDown) {
            dx = -this.stepSize;                                    //Spostamento
            this.direction = "side";                                //Nuova direzione
            this.player.setFlipX(false);                      //Flip della texture
            moving = true;                                          //Aggiornamento stato

            //Controllo collisioni
            if (this.boundaries.length > 0) for (let bound of this.boundaries) {
                if (this.checkOverlap(this.leftBound, bound)) {      //Collisione
                    dx = 0;                                         //Annullo il movimento
                    break;
                }
            }
        } else if (this.rightKey.isDown && !this.leftKey.isDown) {
            dx = this.stepSize;                                    //Spostamento
            this.direction = "side";                                //Nuova direzione
            this.player.setFlipX(true);                      //Flip della texture
            moving = true;                                          //Aggiornamento stato

            //Controllo collisioni
            if (this.boundaries.length > 0) for (let bound of this.boundaries) {
                if (this.checkOverlap(this.rightBound, bound)) {      //Collisione
                    dx = 0;                                         //Annullo il movimento
                    break;
                }
            }
        }

        //Input diagonale
        if (this.rightKey.isDown && this.downKey.isDown) {
            if (this.boundaries.length !== 0) for (const boundary of this.boundaries) {
                const overlaps = this.checkOverlap(this.bRBound, boundary);
                if (!overlaps) continue;                //Se non c'è overlap salto la prossima parte

                const hitRight = this.checkOverlap(this.rightBound, boundary);
                const hitBottom = this.checkOverlap(this.bottomBound, boundary);

                if (hitRight && !hitBottom) {
                    dx = 0;                             //Collisione laterale
                } else if (hitBottom && !hitRight) {
                    dy = 0;                             //Collisione verticale
                } else {
                    dx = 0;                             //Collisione con angolo
                    dy = 0;
                }
            }
        }
        if (this.rightKey.isDown && this.upKey.isDown) {
            if (this.boundaries.length !== 0) for (const boundary of this.boundaries) {
                const overlaps = this.checkOverlap(this.tRBound, boundary);
                if (!overlaps) continue;                //Se non c'è overlap salto la prossima parte

                const hitRight = this.checkOverlap(this.rightBound, boundary);
                const hitBottom = this.checkOverlap(this.topBound, boundary);

                if (hitRight && !hitBottom) {
                    dx = 0;                             //Collisione laterale
                } else if (hitBottom && !hitRight) {
                    dy = 0;                             //Collisione verticale
                } else {
                    dx = 0;                             //Collisione con angolo
                    dy = 0;
                }
            }
        }
        if (this.leftKey.isDown && this.downKey.isDown) {
            if (this.boundaries.length !== 0) for (const boundary of this.boundaries) {
                const overlaps = this.checkOverlap(this.bLBound, boundary);
                if (!overlaps) continue;                //Se non c'è overlap salto la prossima parte

                const hitRight = this.checkOverlap(this.leftBound, boundary);
                const hitBottom = this.checkOverlap(this.bottomBound, boundary);

                if (hitRight && !hitBottom) {
                    dx = 0;                             //Collisione laterale
                } else if (hitBottom && !hitRight) {
                    dy = 0;                             //Collisione verticale
                } else {
                    dx = 0;                             //Collisione con angolo
                    dy = 0;
                }
            }
        }
        if (this.leftKey.isDown && this.upKey.isDown) {
            if (this.boundaries.length !== 0) for (const boundary of this.boundaries) {
                const overlaps = this.checkOverlap(this.tLBound, boundary);
                if (!overlaps) continue;                //Se non c'è overlap salto la prossima parte

                const hitRight = this.checkOverlap(this.leftBound, boundary);
                const hitBottom = this.checkOverlap(this.topBound, boundary);

                if (hitRight && !hitBottom) {
                    dx = 0;                             //Collisione laterale
                } else if (hitBottom && !hitRight) {
                    dy = 0;                             //Collisione verticale
                } else {
                    dx = 0;                             //Collisione con angolo
                    dy = 0;
                }
            }
        }

        // Se non mi sto muovendo carico la texture ferma
        if (!moving) {
            this.updateIdleTexture();
            return;
        }

        //Altrimenti, aggiorno posizione e tempo dell'ultimo passo
        this.x += dx;
        this.y += dy;
        this.lastMoveTime = time;
        this.updateMoveTexture(); // qui viene invertito lastStep
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
		this.scene.oggVector.forEach((ogg: { x: number; y: number; set: boolean; interagisci: () => void; }) => {
			const distanza = Phaser.Math.Distance.Between(this.x, this.y, ogg.x, ogg.y);
			//TODO : controllare che gli oggetti non siano abbastanza vicini
			if(distanza < 20 &&  ogg.set) {
				ogg.interagisci();
			}
		});
	}
	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Player;