
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
		this.load.pack("Images", "frontend/public/assets/images/Images.json");

		PATH reali

		this.load.pack("Images", "/assets/images/Images.json");
		this.load.pack("Sprite-pack", "/assets/sprite/Sprite-pack.json");

		*/
		/* END-USER-CTR-CODE */
	}

	preload(): void {
		this.load.pack("Sprite-pack", "/assets/sprite/Sprite-pack.json");
		this.load.pack("images", "/assets/images/images.json");
	}

	editorCreate(): void {

		// fondale
		const fondale = this.add.image(0, -2327, "Fondale");
		fondale.scaleX = 3;
		fondale.scaleY = 3;
		fondale.setOrigin(0, 0);

		// player
		const player = this.add.sprite(650, 374, "backPlayer_S");
		player.scaleX = 5;
		player.scaleY = 5;

		this.events.emit("scene-awake");
	}

	/* START-USER-CODE */

	// Write your code here
	fondale?: Phaser.GameObjects.Image;
	player?: Phaser.GameObjects.Sprite;
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

	create() {
		this.editorCreate();
		// Salvo riferimenti agli oggetti
		this.player = this.children.list.find(obj => obj instanceof Phaser.GameObjects.Sprite) as Phaser.GameObjects.Sprite;
		this.fondale = this.children.list.find(obj => obj instanceof Phaser.GameObjects.Image && obj.texture.key === 'Fondale') as Phaser.GameObjects.Image;
		// Ora posso accedere a scale e dimensioni
		this.sceneWidth = this.scale.width;
		this.sceneHeight = this.scale.height;
		this.FondaleWidth = this.fondale.width * this.fondale.scaleX;
		this.FondaleHeight = this.fondale.height * this.fondale.scaleY;
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
			newDirection = 'front';		//W
			moving = true;
		} else if (sKey.isDown) {
			newDirection = 'back';		//S
			moving = true;
		} else if (aKey.isDown) {
			newDirection = 'side';		//A
			this.player.setFlipX(false);
			moving = true;
		} else if (dKey.isDown) {
			newDirection = 'side';		//D
			this.player.setFlipX(true);
			moving = true;
		}
		// Movimento scattoso ogni 100ms
		if (moving && time - this.lastMoveTime > 100) {
			this.lastMoveTime = time;
			this.direction = newDirection;
			if (newDirection === 'front') {
				if (this.fondale.y + this.stepValue > 0) {	// Limite superiore
					this.fondale.y = 0;
				} else {									//Movimento	front	
					this.fondale.y += this.stepValue;
				}
				const step = this.lastStep ? 'R' : 'L';			//Switch delle texture R-L
				this.player.setTexture(`backPlayer_${step}`);
				this.lastStep = !this.lastStep;
			} else if (newDirection === 'back') {
				if (this.fondale.y - this.stepValue > -2352) {
					this.fondale.y -= this.stepValue;				//Movimento back
				} else { 											// Limite inferiore
					this.fondale.y = -2352;
				}
				const step = this.lastStep ? 'R' : 'L';			//Switch delle texture R-L
				this.player.setTexture(`frontPlayer_${step}`);
				this.lastStep = !this.lastStep;
			} else if (newDirection === 'side') {
				const step = this.lastStep ? 'M' : 'S';	        //Switch delle texture M-S
				this.player.setTexture(`sidePlayer_${step}`);
				this.lastStep = !this.lastStep;
				if (aKey.isDown) {
					if (this.fondale.x + this.stepValue > 0) { 			// Limite sinistro
						this.fondale.x = 0;
					} else {										//Movimento sinistro
						this.fondale.x += this.stepValue;
					}
				}	
				if (dKey.isDown) {
					if (this.fondale.x - this.stepValue > -1792) {
						this.fondale.x -= this.stepValue;					//Movimento destro
					} else { 											// Limite destro
						this.fondale.x = -1792;
					}
				}
			}
			console.log(`Fondale: x=${this.fondale.x}, y=${this.fondale.y}`);
			console.log(`Player: x=${this.player.x}, y=${this.player.y}`);
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