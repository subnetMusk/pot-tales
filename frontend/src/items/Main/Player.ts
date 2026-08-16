// You can write more code here

/* START OF COMPILED CODE */

class Player extends Phaser.GameObjects.Container {

	constructor(scene: Phaser.Scene, x?: number, y?: number) {
		super(scene, x ?? 13, y ?? 8);

		// player
		const player = scene.add.sprite(0, 0, "Ch_front", 0) as Phaser.GameObjects.Sprite & { body: Phaser.Physics.Arcade.Body };
		scene.physics.add.existing(player, false);
		player.body.setSize(32, 32, false);
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
		darkMask.alpha = 0.75;
		darkMask.alphaTopLeft = 0.75;
		darkMask.alphaTopRight = 0.75;
		darkMask.alphaBottomLeft = 0.75;
		darkMask.alphaBottomRight = 0.75;
		this.add(darkMask);

		// playerUi
		const playerUi = scene.add.image(-64, -54, "player_ui");
		this.add(playerUi);

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
		this.playerUi = playerUi;

		/* START-USER-CTR-CODE */
		if (this.scene.input && this.scene.input.keyboard) {
			this.rightKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
			this.downKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
			this.upKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
			this.leftKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
		}

		// Create animations for the player
		this.createPlayerAnimations();

		// Start with idle front animation
		this.player.play('idle_front', true);

		this.scene.events.on("update", (time: number) => this.movePlayer(time), this);

		this.Ikey = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.I);
		this.Ikey?.on("down", () => {
			// Controllo collisione
			this.controllaInterazioneOggetto();
		});

		/* END-USER-CTR-CODE */
	}

	private player: Phaser.GameObjects.Sprite & { body: Phaser.Physics.Arcade.Body };
	private bottomBound: Phaser.GameObjects.Rectangle;
	private topBound: Phaser.GameObjects.Rectangle;
	private leftBound: Phaser.GameObjects.Rectangle;
	private rightBound: Phaser.GameObjects.Rectangle;
	private tLBound: Phaser.GameObjects.Rectangle;
	private tRBound: Phaser.GameObjects.Rectangle;
	private bLBound: Phaser.GameObjects.Rectangle;
	private bRBound: Phaser.GameObjects.Rectangle;
	private darkMask: Phaser.GameObjects.Image;
	private playerUi: Phaser.GameObjects.Image;

	/* START-USER-CODE */
	private stepSize: number = 8;					// Grandezza del passo
	private stepDelay: number = 100;				// Attesa in ms tra i frame
	private BoundsDebug: boolean = true;			// Se true mostra i boundaries
    private movementAllowed: boolean = true;       	// Disabilita l'input
	public interactionAllowed: boolean = true;  	// Disabilita l'interazione con gli oggetti	


	// Input della tastiera
	private rightKey!: Phaser.Input.Keyboard.Key;
	private downKey!: Phaser.Input.Keyboard.Key;
	private upKey!: Phaser.Input.Keyboard.Key;
	private leftKey!: Phaser.Input.Keyboard.Key;
	private Ikey?: Phaser.Input.Keyboard.Key;

	boundaries : Phaser.GameObjects.Rectangle[] = [];
	private slowAreas: Array<{ zone: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite | Phaser.GameObjects.Image; multiplier: number }> = [];

	lastMoveTime: number = 0;						// Tempo dell'ultimo movimento (per l'effetto a bassi fps)
	lastStep: boolean = false;						// Ultima textura usata
	direction: 'front' | 'back' | 'side' = 'front';	// Direzione in cui sto guardando

	public set isMovementAllowed(state : boolean) {
		this.movementAllowed = state;

		// Reset della texture
		if (!state)this.updateIdleTexture();
	}

	// Create animations for the player
	private createPlayerAnimations() {
		const anims = this.scene.anims;

		// Idle animations (standing frame of each direction's sheet)
		if (!anims.exists('idle_side')) {
			anims.create({
				key: 'idle_side',
				frames: [{ key: 'Ch_side', frame: 0 }],
				frameRate: 1,
				repeat: -1
			});
		}

		if (!anims.exists('idle_front')) {
			anims.create({
				key: 'idle_front',
				frames: [{ key: 'Ch_front', frame: 0 }],
				frameRate: 1,
				repeat: -1
			});
		}

		if (!anims.exists('idle_back')) {
			anims.create({
				key: 'idle_back',
				frames: [{ key: 'Ch_back', frame: 0 }],
				frameRate: 1,
				repeat: -1
			});
		}

		// Walk down animation
		if (!anims.exists('walk_down')) {
			anims.create({
				key: 'walk_down',
				frames: anims.generateFrameNumbers('Ch_front', { start: 0, end: -1 }),
				frameRate: 8,
				repeat: -1
			});
		}

		// Walk side animation
		if (!anims.exists('walk_side')) {
			anims.create({
				key: 'walk_side',
				frames: anims.generateFrameNumbers('Ch_side', { start: 0, end: -1 }),
				frameRate: 8,
				repeat: -1
			});
		}

		// Walk up animation
		if (!anims.exists('walk_up')) {
			anims.create({
				key: 'walk_up',
				frames: anims.generateFrameNumbers('Ch_back', { start: 0, end: -1 }),
				frameRate: 8,
				repeat: -1
			});
		}
	}

	// Check dell'overlap fra due rettangoli ᓚᘏᗢ
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

	// True se bound sovrappone un qualsiasi boundary della scena (movimento cardinale bloccato)
	private isBlockedInDirection(bound: Phaser.GameObjects.Rectangle): boolean {
		for (const boundary of this.boundaries) {
			if (this.checkOverlap(bound, boundary)) return true;
		}
		return false;
	}

	// Risolve la collisione diagonale controllando TUTTI i boundary (non solo il primo che
	// trova), così due boundary distinti possono azzerare dx e dy indipendentemente,
	// esattamente come nel controllo cardinale-per-cardinale precedente.
	private resolveDiagonalCollision(
		cornerBound: Phaser.GameObjects.Rectangle,
		axisXBound: Phaser.GameObjects.Rectangle,
		axisYBound: Phaser.GameObjects.Rectangle,
		dx: number,
		dy: number
	): { dx: number; dy: number } {
		for (const boundary of this.boundaries) {
			if (!this.checkOverlap(cornerBound, boundary)) continue;

			const hitX = this.checkOverlap(axisXBound, boundary);
			const hitY = this.checkOverlap(axisYBound, boundary);

			if (hitX && !hitY) {
				dx = 0;						// Solo collisione laterale
			} else if (hitY && !hitX) {
				dy = 0;						// Solo collisione verticale
			} else {
				dx = 0;						// Collisione con angolo
				dy = 0;
			}
		}
		return { dx, dy };
	}

	// Passaggio della lista dei boundaries dalla scena al player
	// Supporta solo Rectangle, Sprite e Image :3
	public setBoundaries(boundsList : Object[]) {
		for (let i = 0; i < boundsList.length; i++) {
			let obj = boundsList[i];

			// Gestione Rectangle
			if (obj instanceof Phaser.GameObjects.Rectangle) {
				obj.visible = this.BoundsDebug;
				this.boundaries.push(obj);
			// Gestione Sprite
			} else if (obj instanceof Phaser.GameObjects.Sprite || obj instanceof Phaser.Physics.Arcade.Sprite) {
				const bounds = obj.getBounds();
				const rect = this.scene.add.rectangle(bounds.x + bounds.width/2, bounds.y + bounds.height/2, bounds.width, bounds.height);
				rect.isStroked = true;
				rect.strokeColor = 0xff0000;
				this.boundaries.push(rect);
			// Gestione Image
			} else if (obj instanceof Phaser.GameObjects.Image) {
				const bounds = obj.getBounds();
				const rect = this.scene.add.rectangle(bounds.x + bounds.width/2, bounds.y + bounds.height/2, bounds.width, bounds.height);
				rect.isStroked = true;
				rect.strokeColor = 0x00ff00;
				this.boundaries.push(rect);
			// Oggetto non supportato
			} else {
				const objName = (obj as any).name || obj.constructor.name || 'oggetto sconosciuto';
				console.log(`L'oggetto ${objName} non può essere convertito in boundary`);
			}
		}
		if (this.BoundsDebug) console.log("Caricati i boundaries");
	}

	// Registra aree in cui il player si muove più lentamente
	public setSlowAreas(areas: Object[]) {
		this.slowAreas = [];

		for (const area of areas) {
			const candidate = area as any;
			const zone = candidate.zone ?? candidate;
			const multiplier = Phaser.Math.Clamp(candidate.multiplier ?? 0.5, 0.1, 1);

			if (zone instanceof Phaser.GameObjects.Rectangle ||
				zone instanceof Phaser.GameObjects.Sprite ||
				zone instanceof Phaser.GameObjects.Image) {
				this.slowAreas.push({ zone, multiplier });
			}
		}
	}

	private isPlayerInsideZone(zone: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite | Phaser.GameObjects.Image): boolean {
		const playerBounds = this.getBounds();
		const zoneBounds = zone.getBounds();
		return Phaser.Geom.Rectangle.Overlaps(playerBounds, zoneBounds);
	}

	private getMovementMultiplier(): number {
		let multiplier = 1;

		for (const area of this.slowAreas) {
			if (this.isPlayerInsideZone(area.zone)) {
				multiplier = Math.min(multiplier, area.multiplier);
			}
		}

		return multiplier;
	}

	// Disabilita l'effetto della torica
	public flashlight(state : boolean) {
		this.darkMask.visible = state;
	}

	// Abilita o disabilita la player ui
	public playerUiVisible(state: boolean) {
		this.playerUi.visible = state;
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

	// Funzione di movimento
	private movePlayer(time: number) {

        // Condizioni per il movimento:
        if (!this.movementAllowed) return;                          // Input deve essere abilitato
        if (this.player.body === null) return;                      // Player non deve essere null

		const movementMultiplier = this.getMovementMultiplier();
		this.player.anims.timeScale = movementMultiplier;
        const effectiveStepDelay = this.stepDelay / movementMultiplier;
        if (time - this.lastMoveTime < effectiveStepDelay) return;      // Passato il tempo minimo dal passo precedente

        let dx = 0;                                         // Spostamento orizzontale
        let dy = 0;                                         // Spostamento verticale
        let moving = false;                                 // Stato del movimento

		const effectiveStepSize = this.stepSize * movementMultiplier;

        if (this.upKey.isDown && !this.downKey.isDown) {            // Freccia sù
            dy = -effectiveStepSize;                                    // Spostamento
            this.direction = "back";                                // Nuova direzione
            moving = true;                                          // Aggiornamento stato

            if (this.isBlockedInDirection(this.topBound)) dy = 0;      // Collisione: annullo il movimento
        } else if (this.downKey.isDown && !this.upKey.isDown) {
            dy = effectiveStepSize;                                     // Spostamento
            this.direction = "front";                               // Nuova direzione
            moving = true;                                          // Aggiornamento stato

            if (this.isBlockedInDirection(this.bottomBound)) dy = 0;   // Collisione: annullo il movimento
        }

        // Input orizzontale
        if (this.leftKey.isDown && !this.rightKey.isDown) {
            dx = -effectiveStepSize;                                    // Spostamento
            this.direction = "side";                                // Nuova direzione
            this.player.setFlipX(false);                      		// Flip della texture
            moving = true;                                          // Aggiornamento stato

            if (this.isBlockedInDirection(this.leftBound)) dx = 0;     // Collisione: annullo il movimento
        } else if (this.rightKey.isDown && !this.leftKey.isDown) {
            dx = effectiveStepSize;                                    	// Spostamento
            this.direction = "side";                                // Nuova direzione
            this.player.setFlipX(true);                      		// Flip della texture
            moving = true;                                          // Aggiornamento stato

            if (this.isBlockedInDirection(this.rightBound)) dx = 0;    // Collisione: annullo il movimento
        }

        // Input diagonale
        if (this.rightKey.isDown && this.downKey.isDown) {
            ({ dx, dy } = this.resolveDiagonalCollision(this.bRBound, this.rightBound, this.bottomBound, dx, dy));
        }
        if (this.rightKey.isDown && this.upKey.isDown) {
            ({ dx, dy } = this.resolveDiagonalCollision(this.tRBound, this.rightBound, this.topBound, dx, dy));
        }
        if (this.leftKey.isDown && this.downKey.isDown) {
            ({ dx, dy } = this.resolveDiagonalCollision(this.bLBound, this.leftBound, this.bottomBound, dx, dy));
        }
        if (this.leftKey.isDown && this.upKey.isDown) {
            ({ dx, dy } = this.resolveDiagonalCollision(this.tLBound, this.leftBound, this.topBound, dx, dy));
        }
        // Se non mi sto muovendo carico la texture stazionaria
        if (!moving) {
            this.updateIdleTexture();
            return;
        }

        // Normalizzo il movimento diagonale
        if (dx !== 0 && dy !== 0) {
            dx /= Math.sqrt(2);
            dy /= Math.sqrt(2);
        }

        // Altrimenti, aggiorno la posizione e salvo il timestamp dell'ultimo passo
        this.x += dx;
        this.y += dy;

        this.lastMoveTime = time;
        this.updateMoveTexture(); 			// Qui viene invertito lastStep
	}

	private updateIdleTexture() {
		switch (this.direction) {			// Play idle animation based on direction
			case "front":
				this.player.play('idle_front', true);
				break;
			case "back":
				this.player.play('idle_back', true);
				break;
			case "side":
				this.player.play('idle_side', true);
				break;
		}
	}

	private updateMoveTexture() {
		if (this.direction === "front") {
			this.player.play('walk_down', true);
		} else if (this.direction === "back") {
			this.player.play('walk_up', true);
		} else if (this.direction === "side") {
			this.player.play('walk_side', true);
		}

		this.lastStep = !this.lastStep;
	}

	private controllaInterazioneOggetto() {
		if (!this.interactionAllowed) return;  	// Controlla se l'interazione è permessa
		const oggVector = (this.scene as any).oggVector as { x: number; y: number; set: boolean; interagisci: () => void; }[] | undefined;

        if (oggVector) for (const ogg of oggVector) {
            const distanza = Phaser.Math.Distance.Between(this.x, this.y, ogg.x, ogg.y);
            if (distanza < 20 && ogg.set) {
                ogg.interagisci();
                break;
            }
        }
	}
	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Player;