// You can write more code here

/* START OF COMPILED CODE */

class Scene_1 extends Phaser.Scene {

	constructor() {
		super("Scene_1");

		/* START-USER-CTR-CODE */
		/* 

		Modificare i json
		frontend/public/assets/
		/assets/

		PATH di phaser

		this.load.pack("Sprite-pack", "frontend/public/assets/sprite/Sprite-pack.json");
		this.load.pack("images", "frontend/public/assets/images/images.json");
		this.load.pack("Font-pack", "frontend/public/assets/fonts/Pixelify_Sans/Font-pack.json");

		PATH reali

		this.load.pack("Sprite-pack", "/assets/sprite/Sprite-pack.json");
		this.load.pack("images", "/assets/images/images.json");
		this.load.pack("Font-pack", "/assets/fonts/Pixelify_Sans/Font-pack.json");

		*/
		/* END-USER-CTR-CODE */
	}

	preload(): void {

		this.load.pack("Sprite-pack", "/assets/sprite/Sprite-pack.json");
		this.load.pack("images", "/assets/images/images.json");
		this.load.pack("Font-pack", "/assets/fonts/Pixelify_Sans/Font-pack.json");
	}

	editorCreate(): void {

		// Backgorund
		const backgorund = this.add.container(0, -148);

		// fondale
		const fondale = this.add.image(0, 0, "Fondale");
		fondale.scaleX = 3;
		fondale.scaleY = 3;
		fondale.setOrigin(0, 0);
		backgorund.add(fondale);

		// sideQuest
		const sideQuest = this.add.image(1991, 1031, "SideQuest");
		sideQuest.scaleX = 3;
		sideQuest.scaleY = 3;
		backgorund.add(sideQuest);

		// player
		const player = this.add.sprite(650, 374, "backPlayer_S");
		player.scaleX = 5;
		player.scaleY = 5;

		// mASK
		const mASK = this.add.image(0, 0, "MASK");
		mASK.setOrigin(0, 0);
		mASK.alpha = 0.7;
		mASK.alphaTopLeft = 0.7;
		mASK.alphaTopRight = 0.7;
		mASK.alphaBottomLeft = 0.7;
		mASK.alphaBottomRight = 0.7;

		// Info_text
		const info_text = this.add.text(640, 650, "", {});
		info_text.setOrigin(0.5, 0);
		info_text.text = "Inizia la quest";
		info_text.setStyle({ "fontFamily": "PixelifySans-VariableFont_wght", "fontSize": "32px" });

		this.info_text = info_text;

		this.events.emit("scene-awake");
	}

	public info_text!: Phaser.GameObjects.Text;

	/* START-USER-CODE */

	// Write your code here
	fondale?: Phaser.GameObjects.Image;
	player?: Phaser.GameObjects.Sprite;
	sideQuest?: Phaser.GameObjects.Image;
	backgorund?: Phaser.GameObjects.Container; // <--- aggiungi questa variabile
	lastMoveTime: number = 0;
	lastStep: boolean = false;
	direction: 'front' | 'back' | 'side' = 'back';
	stepValue: number = 50;

	//Dati scena
	sceneWidth: number = 0;
	sceneHeight: number = 0;
	FondaleWidth: number = 0;
	FondaleHeight: number = 0;
	playerBoundingBox: number = 60;

	//Limiti movimento mappa
	leftMapLimit: number = 0; // Limite sinistro
	rightMapLimit: number = -(this.FondaleWidth - this.sceneWidth); // Limite destro
	upMapLimit: number = 0; // Limite superiore
	downMapLimit: number = -(this.FondaleHeight - this.sceneHeight); // Limite inferiore

	//Limiti movimento giocatore
	leftPlayerLimit: number = this.playerBoundingBox; // Limite sinistro
	rightPlayerLimit: number = this.sceneWidth - this.playerBoundingBox; // Limite destro
	upPlayerLimit: number = this.playerBoundingBox; // Limite superiore
	downPlayerLimit: number = this.sceneHeight - this.playerBoundingBox; // Limite inferiore
	lastKeyPressed: 'W' | 'A' | 'S' | 'D' | null = null; // <--- aggiungi questa variabile

	create() {
		this.editorCreate();
		// Salvo riferimenti agli oggetti
		this.backgorund = this.children.list.find(obj => obj instanceof Phaser.GameObjects.Container) as Phaser.GameObjects.Container;
		if (this.backgorund) {
			this.fondale = this.backgorund.list.find(obj => obj instanceof Phaser.GameObjects.Image && obj.texture.key === 'Fondale') as Phaser.GameObjects.Image;
			this.sideQuest = this.backgorund.list.find(obj => obj instanceof Phaser.GameObjects.Image && obj.texture.key === 'SideQuest') as Phaser.GameObjects.Image;
		}
		this.player = this.children.list.find(obj => obj instanceof Phaser.GameObjects.Sprite) as Phaser.GameObjects.Sprite;
		// Ora posso accedere a scale e dimensioni
		if (this.fondale) {
			this.sceneWidth = this.scale.width;
			this.sceneHeight = this.scale.height;
			this.FondaleWidth = this.fondale.width * this.fondale.scaleX;
			this.FondaleHeight = this.fondale.height * this.fondale.scaleY;
		}
		// Listener per aggiornare l'ultimo tasto premuto
		if (this.input.keyboard) {
			this.input.keyboard.on('keydown', (event: KeyboardEvent) => {
				const key = event.key.toUpperCase();
				if (['W', 'A', 'S', 'D'].includes(key)) {
					this.lastKeyPressed = key as 'W' | 'A' | 'S' | 'D';
				}
			});
		}
	}

	update(time: number) {
		const keyboard = this.input.keyboard;
		if (!keyboard || !this.player || !this.fondale || !this.backgorund) return;
		const wKey = keyboard.addKey('W');
		const sKey = keyboard.addKey('S');
		const aKey = keyboard.addKey('A');
		const dKey = keyboard.addKey('D');
		let moving = false;
		let newDirection: 'front' | 'back' | 'side' = this.direction;

		// Usa l'ultimo tasto premuto per determinare la direzione
		if (this.lastKeyPressed === 'W' && wKey.isDown) {
			newDirection = 'front';
			moving = true;
		} else if (this.lastKeyPressed === 'S' && sKey.isDown) {
			newDirection = 'back';
			moving = true;
		} else if (this.lastKeyPressed === 'A' && aKey.isDown) {
			newDirection = 'side';
			this.player.setFlipX(false);
			moving = true;
		} else if (this.lastKeyPressed === 'D' && dKey.isDown) {
			newDirection = 'side';
			this.player.setFlipX(true);
			moving = true;
		}
		// Movimento scattoso ogni 100ms
		if (moving && time - this.lastMoveTime > 100) {
			this.lastMoveTime = time;
			this.direction = newDirection;
			if (newDirection === 'front') {
				if (this.backgorund.y + this.stepValue > 0) {	// Limite superiore
					this.backgorund.y = 0;
				} else {									//Movimento	front	
					this.backgorund.y += this.stepValue;
				}
				const step = this.lastStep ? 'R' : 'L';			//Switch delle texture R-L
				this.player.setTexture(`backPlayer_${step}`);
				this.lastStep = !this.lastStep;
			} else if (newDirection === 'back') {
				if (this.backgorund.y - this.stepValue > -2352) {
					this.backgorund.y -= this.stepValue;				//Movimento back
				} else { 											// Limite inferiore
					this.backgorund.y = -2352;
				}
				const step = this.lastStep ? 'R' : 'L';			//Switch delle texture R-L
				this.player.setTexture(`frontPlayer_${step}`);
				this.lastStep = !this.lastStep;
			} else if (newDirection === 'side') {
				const step = this.lastStep ? 'M' : 'S';	        //Switch delle texture M-S
				this.player.setTexture(`sidePlayer_${step}`);
				this.lastStep = !this.lastStep;
				if (aKey.isDown) {
					if (this.backgorund.x + this.stepValue > 0) { 			// Limite sinistro
						this.backgorund.x = 0;
					} else {										//Movimento sinistro
						this.backgorund.x += this.stepValue;
					}
				}	
				if (dKey.isDown) {
					if (this.backgorund.x - this.stepValue > -1792) {
						this.backgorund.x -= this.stepValue;					//Movimento destro
					} else { 											// Limite destro
						this.backgorund.x = -1792;
					}
				}
			}
			console.log(`Backgorund: x=${this.backgorund.x}, y=${this.backgorund.y}`);
			console.log(`Player: x=${this.player.x}, y=${this.player.y}`);
			if (this.player && this.sideQuest) {
				const playerBounds = this.player.getBounds();
				const sideQuestBounds = this.sideQuest.getBounds();
				if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, sideQuestBounds)) {
					this.info_text.visible = true;
				} else {
					this.info_text.visible = false;
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