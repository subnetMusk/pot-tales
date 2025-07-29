// You can write more code here
/*
Dettagli:
- Sprite del giocatore: 60x60 pixel
- Lo schermo è 1280x720 pixel
- Nella mappa lasciare almeno 640 pixel in orizzontale e 360 in verticale dai bordi
- Per limitare il movimento bisogna mettere dei rettangoli nel contenitore "Obstacles"
- I minigiochi sono delle immagini nel contenitore "Quests"
- Le sprite di movimento sono :
  - backPlayer_{Stato}: culo del giocatore, gli stati sono S (Stop), R (Passo destro), L (Passo sinistro)
  - frontPlayer_{Stato}: pipo del giocatore, gli stati sono S (Stop), R (Passo destro), L (Passo sinistro)
  - sidePlayer_{Stato}: lato del giocatore, gli stati sono S (Stop), M (Movimento)
  - Il programma dopo le alterna da solo.
- Per ora le quest mostrano solo un testo, basta modificare leggermente il codice e mettere il file con il minigioco corrispondente.
- Per debug, mettere debug = true, per vedere gli ostacoli e il rettangolo di interazione con lo stroke rosso (e alcuni dati).
*/
/* START OF COMPILED CODE */

class Scene_1 extends Phaser.Scene {

	constructor() {
		super("Scene_1");

		/* START-USER-CTR-CODE */
		/* 
		PROBLEMA CON I PATH, se si apre phaser sul progetto:

		Modificare i json
		frontend/public/assets/		(Se si apre phaser sul progetto)
		/assets/					(Se si lancia su localhost)

		PATH di phaser, per il metodo preload:
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

		this.load.pack("Sprite-pack", "frontend/public/assets/sprite/Sprite-pack.json");
		this.load.pack("images", "frontend/public/assets/images/images.json");
		this.load.pack("Font-pack", "frontend/public/assets/fonts/Pixelify_Sans/Font-pack.json");
	}

	editorCreate(): void {

		// Background
		const background = this.add.container(0, -148);

		// fondale
		const fondale = this.add.image(0, 0, "Fondale");
		fondale.scaleX = 3;
		fondale.scaleY = 3;
		fondale.setOrigin(0, 0);
		background.add(fondale);

		// Obstacles
		const obstacles = this.add.container(0, 148);
		background.add(obstacles);

		// Ostacolo_0
		const ostacolo_0 = this.add.rectangle(560, 663, 800, 400);
		ostacolo_0.scaleX = 1.152138881613354;
		ostacolo_0.scaleY = 1.2232234537535815;
		ostacolo_0.setOrigin(0, 0);
		ostacolo_0.isStroked = true;
		ostacolo_0.lineWidth = 2;
		obstacles.add(ostacolo_0);

		// Ostacolo_1
		const ostacolo_1 = this.add.rectangle(793, -10, 800, 500);
		ostacolo_1.scaleX = 1.0835440374130454;
		ostacolo_1.setOrigin(0, 0);
		ostacolo_1.isStroked = true;
		ostacolo_1.lineWidth = 2;
		obstacles.add(ostacolo_1);

		// Ostacolo_2
		const ostacolo_2 = this.add.rectangle(-6, -66, 800, 400);
		ostacolo_2.scaleX = 0.7018596031901114;
		ostacolo_2.scaleY = 2.021394161978518;
		ostacolo_2.setOrigin(0, 0);
		ostacolo_2.isStroked = true;
		ostacolo_2.lineWidth = 2;
		obstacles.add(ostacolo_2);

		// Ostacolo
		const ostacolo = this.add.rectangle(1627, 680, 800, 400);
		ostacolo.scaleX = 0.3391755660663689;
		ostacolo.scaleY = 0.7465534498933816;
		ostacolo.setOrigin(0, 0);
		ostacolo.isStroked = true;
		ostacolo.lineWidth = 2;
		obstacles.add(ostacolo);

		// Ostacolo_3
		const ostacolo_3 = this.add.rectangle(1780, 178, 800, 400);
		ostacolo_3.scaleX = 0.5977387089791966;
		ostacolo_3.scaleY = 1.6766664667490716;
		ostacolo_3.setOrigin(0, 0);
		ostacolo_3.isStroked = true;
		ostacolo_3.lineWidth = 2;
		obstacles.add(ostacolo_3);

		// Ostacolo_4
		const ostacolo_4 = this.add.rectangle(1158, 1143, 800, 400);
		ostacolo_4.scaleX = 1.8693172323746494;
		ostacolo_4.scaleY = 0.3833269990194569;
		ostacolo_4.setOrigin(0, 0);
		ostacolo_4.isStroked = true;
		ostacolo_4.lineWidth = 2;
		obstacles.add(ostacolo_4);

		// Ostacolo_5
		const ostacolo_5 = this.add.rectangle(2426, 785, 800, 400);
		ostacolo_5.scaleX = 0.37100567763509396;
		ostacolo_5.scaleY = 1.137346906579483;
		ostacolo_5.setOrigin(0, 0);
		ostacolo_5.isStroked = true;
		ostacolo_5.lineWidth = 2;
		obstacles.add(ostacolo_5);

		// Ostacolo_6
		const ostacolo_6 = this.add.rectangle(2235, 320, 800, 400);
		ostacolo_6.scaleX = 1.0334725060451;
		ostacolo_6.scaleY = 0.7214967342645326;
		ostacolo_6.setOrigin(0, 0);
		ostacolo_6.isStroked = true;
		ostacolo_6.lineWidth = 2;
		obstacles.add(ostacolo_6);

		// Quests
		const quests = this.add.container(0, 148);
		background.add(quests);

		// sideQuest_0
		const sideQuest_0 = this.add.image(1724, 285, "SideQuest");
		sideQuest_0.scaleX = 3;
		sideQuest_0.scaleY = 3;
		quests.add(sideQuest_0);

		// sideQuest_1
		const sideQuest_1 = this.add.image(2034, 917, "SideQuest");
		sideQuest_1.scaleX = 3;
		sideQuest_1.scaleY = 3;
		quests.add(sideQuest_1);

		// player
		const player = this.add.sprite(640, 360, "backPlayer_S");
		player.scaleX = 5;
		player.scaleY = 5;

		// Light
		const light = this.add.image(0, 0, "MASK");
		light.setOrigin(0, 0);
		light.alpha = 0.7;
		light.alphaTopLeft = 0.7;
		light.alphaTopRight = 0.7;
		light.alphaBottomLeft = 0.7;
		light.alphaBottomRight = 0.7;

		// Info_text
		const info_text = this.add.text(640, 650, "", {});
		info_text.setOrigin(0.5, 0);
		info_text.visible = false;
		info_text.text = "Inizia la quest";
		info_text.setStyle({ "fontFamily": "PixelifySans-VariableFont_wght", "fontSize": "32px" });

		// Interaction
		const interaction = this.add.rectangle(640, 410, 128, 128);
		interaction.scaleX = 0.46035682784591125;
		interaction.scaleY = 0.2520342360865992;
		interaction.isStroked = true;
		interaction.lineWidth = 5;

		this.fondale = fondale;
		this.ostacolo_0 = ostacolo_0;
		this.ostacolo_1 = ostacolo_1;
		this.ostacolo_2 = ostacolo_2;
		this.ostacolo = ostacolo;
		this.ostacolo_3 = ostacolo_3;
		this.ostacolo_4 = ostacolo_4;
		this.ostacolo_5 = ostacolo_5;
		this.ostacolo_6 = ostacolo_6;
		this.obstacles = obstacles;
		this.sideQuest_0 = sideQuest_0;
		this.sideQuest_1 = sideQuest_1;
		this.quests = quests;
		this.background = background;
		this.player = player;
		this.light = light;
		this.info_text = info_text;
		this.interaction = interaction;

		this.events.emit("scene-awake");
	}

	private fondale!: Phaser.GameObjects.Image;
	private ostacolo_0!: Phaser.GameObjects.Rectangle;
	private ostacolo_1!: Phaser.GameObjects.Rectangle;
	private ostacolo_2!: Phaser.GameObjects.Rectangle;
	private ostacolo!: Phaser.GameObjects.Rectangle;
	private ostacolo_3!: Phaser.GameObjects.Rectangle;
	private ostacolo_4!: Phaser.GameObjects.Rectangle;
	private ostacolo_5!: Phaser.GameObjects.Rectangle;
	private ostacolo_6!: Phaser.GameObjects.Rectangle;
	private obstacles!: Phaser.GameObjects.Container;
	private sideQuest_0!: Phaser.GameObjects.Image;
	private sideQuest_1!: Phaser.GameObjects.Image;
	private quests!: Phaser.GameObjects.Container;
	private background!: Phaser.GameObjects.Container;
	public player!: Phaser.GameObjects.Sprite;
	private light!: Phaser.GameObjects.Image;
	private info_text!: Phaser.GameObjects.Text;
	private interaction!: Phaser.GameObjects.Rectangle;

	/* START-USER-CODE */

	// --- VARIABILI PRINCIPALI ---
	// GRAFICHE:
	// fondale: mappa del livello
	// player: sprite del giocatore
	// sideQuest: oggetti che attivano i minigiochi
	// light: immagine che simula l'illuminazione della torcia (Con lo HUE si può cambiare colore)

	// CONTAINER:
	// obstacles: container di rettangoli che limitano il movimento
	// background: container principale della scena
	// interaction: rettangolo usato per collisioni con ostacoli e sideQuest

	// Altre variabili:
	// lastMoveTime: timestamp ultimo movimento
	// lastStep: alterna animazione passo
	// direction: direzione attuale ('front', 'back', 'side')
	// stepValue: valore di spostamento per movimento
	// debug: mostra/rimuove stroke sugli ostacoli e interaction e altre info
	// sceneWidth, sceneHeight: dimensioni scena
	// FondaleWidth, FondaleHeight: dimensioni fondale scalato
	// lastStep: booleano per alternare animazione passo

	// --- FUNZIONI PRINCIPALI ---
	// create(): inizializza la scena e salva riferimenti agli oggetti
	// update(): gestisce input, movimento, animazione e collisioni
	// isTouchingRight/Left/Up/Down(): verifica collisione tra interaction e ostacoli nella direzione specifica

	// --- NOTE ---
	// - Il movimento e le collisioni sono gestiti tramite il rettangolo 'interaction' posto ai piedi del player.
	// - L'overlap per la sideQuest avviene tra interaction e sideQuest.
	// - Se debug è true, viene mostrato uno stroke rosso sugli ostacoli e bianco su interaction.

	lastMoveTime: number = 0;
	lastStep: boolean = false;
	direction: 'front' | 'back' | 'side' = 'back';
	stepValue: number = 20;							//Grandezza dello spostamento

	debug: boolean = false;		//DEBUG

	//Inizializzazione variabili scena
	sceneWidth: number = 0;
	sceneHeight: number = 0;
	FondaleWidth: number = 0;
	FondaleHeight: number = 0;
	leftMapLimit: number = 0;
	rightMapLimit: number = 0;
	upMapLimit: number = 0; 
	downMapLimit: number = 0;

	//Ultimo tasto premuto
	pressedKeys: Set<'W'|'A'|'S'|'D'> = new Set();

	// Array di messaggi associati alle quest
	questMessagesArray: string[] = [
		"Ricicla il denaro della mafia",
		"Trova il cadavere"
	];
	questMessages: Map<Phaser.GameObjects.Image, string> = new Map();

	create() {
		// Listener per aggiornare i tasti premuti
		if (this.input.keyboard) {
			this.input.keyboard.on('keydown', (event: KeyboardEvent) => {
				const key = event.key.toUpperCase();
				if (['W', 'A', 'S', 'D'].includes(key)) {
					this.pressedKeys.add(key as 'W'|'A'|'S'|'D');
				}
				// Listener per il tasto ESC - torna al menu
				if (event.key === 'Escape') {
					this.scene.start("Menu");
				}
			});
			this.input.keyboard.on('keyup', (event: KeyboardEvent) => {
				const key = event.key.toUpperCase();
				if (['W', 'A', 'S', 'D'].includes(key)) {
					this.pressedKeys.delete(key as 'W'|'A'|'S'|'D');
				}
			});
		}
		// Associa messaggi agli oggetti quest
		if (this.quests) {
			const questImages = this.quests.list.filter(obj => obj instanceof Phaser.GameObjects.Image) as Phaser.GameObjects.Image[];
			questImages.forEach((qimg, idx) => {
				// Usa il messaggio dall'array, se presente, altrimenti uno di default
				const msg = this.questMessagesArray[idx] || `Messaggio quest ${idx + 1}`;
				this.questMessages.set(qimg, msg);
			});
		}
		this.editorCreate();

		// Salvo riferimenti agli oggetti principali della scena
		this.background = this.children.list.find(obj => obj instanceof Phaser.GameObjects.Container) as Phaser.GameObjects.Container;
		if (this.background) {
			this.fondale = this.background.list.find(obj => obj instanceof Phaser.GameObjects.Image && obj.texture.key === 'Fondale') as Phaser.GameObjects.Image;
			// Rimuovi sideQuest singolo, ora si usa la collezione quests
			this.quests = this.background.list.find(obj => obj instanceof Phaser.GameObjects.Container && obj.list.some(child => child instanceof Phaser.GameObjects.Image && child.texture.key === 'SideQuest')) as Phaser.GameObjects.Container;
		}
		this.player = this.children.list.find(obj => obj instanceof Phaser.GameObjects.Sprite) as Phaser.GameObjects.Sprite;
		// Calcolo dimensioni scena e fondale
		if (this.fondale) {
			this.sceneWidth = this.scale.width;
			this.sceneHeight = this.scale.height;
			this.FondaleWidth = this.fondale.width * this.fondale.scaleX;
			this.FondaleHeight = this.fondale.height * this.fondale.scaleY;

			this.rightMapLimit = -(this.FondaleWidth - this.sceneWidth); // Limite destro
			this.downMapLimit = -(this.FondaleHeight - this.sceneHeight); // Limite inferiore
		}
		if (this.background) {
			const obstaclesContainer = this.background.list.find(obj =>
				obj instanceof Phaser.GameObjects.Container
			) as Phaser.GameObjects.Container | undefined;

			if (obstaclesContainer) {
				// Applica stroke se debug attivo solo ai rettangoli dentro il container
				const rects = obstaclesContainer.list.filter(obj => obj instanceof Phaser.GameObjects.Rectangle) as Phaser.GameObjects.Rectangle[];
				if (this.debug) {
					rects.forEach(rect => {
						rect.setStrokeStyle(4, 0xff0000); // stroke rosso sugli ostacoli
					});
				} else {
					rects.forEach(rect => {
						rect.setStrokeStyle(0); // rimuovi stroke
					});
				}
				this.obstacles = obstaclesContainer;
			} else {
				this.obstacles = undefined as any;
			}
		} else {
			this.obstacles = undefined as any;
		}

		// Salva interaction (rettangolo per collisioni piedi/interazione)
		this.interaction = this.children.list.find(obj =>
			obj instanceof Phaser.GameObjects.Rectangle &&
			obj.width === 128 && obj.height === 128 && obj.isStroked && obj.lineWidth === 5
		) as Phaser.GameObjects.Rectangle;

		// Applica/rimuovi stroke su interaction in base a debug
		if (this.interaction) {
			if (this.debug) {
				this.interaction.setStrokeStyle(3, 0xffffff);
			} else {
				this.interaction.setStrokeStyle(0);
			}
		}
	}

	update(time: number) {
		const keyboard = this.input.keyboard;
		if (!keyboard || !this.player || !this.fondale || !this.background) return;
		const wKey = keyboard.addKey('W');
		const aKey = keyboard.addKey('A');
		const sKey = keyboard.addKey('S');
		const dKey = keyboard.addKey('D');
		let moving = false;
		let newDirection: 'front' | 'back' | 'side' = this.direction;

		// Determina la direzione in base ai tasti attualmente premuti
		if (this.pressedKeys.has('W')) {
			newDirection = 'front';
			moving = true;
		} else if (this.pressedKeys.has('S')) {
			newDirection = 'back';
			moving = true;
		}
		if (this.pressedKeys.has('A')) {
			newDirection = 'side';
			this.player.setFlipX(false);
			moving = true;
		} else if (this.pressedKeys.has('D')) {
			newDirection = 'side';
			this.player.setFlipX(true);
			moving = true;
		}

		// Per rendere il movimento più scattoso, ogni 100ms viene eseguito un movimento
		if (moving && time - this.lastMoveTime > 100) {
			this.lastMoveTime = time;
			this.direction = newDirection;

			// Esegui sempre l'animazione in base alla direzione
			if (newDirection === 'front') {
				const step = this.lastStep ? 'R' : 'L';			//Switch tra R e L per animazione
				this.player.setTexture(`backPlayer_${step}`);
				this.lastStep = !this.lastStep;
			} else if (newDirection === 'back') {
				const step = this.lastStep ? 'R' : 'L';			//Switch tra R e L per animazione
				this.player.setTexture(`frontPlayer_${step}`);
				this.lastStep = !this.lastStep;
			} else if (newDirection === 'side') {
				const step = this.lastStep ? 'M' : 'S';			//Switch tra M e S per animazione
				this.player.setTexture(`sidePlayer_${step}`);
				this.lastStep = !this.lastStep;
			}

			// Movimento separato per ogni direzione, consentendo movimento nelle altre direzioni anche se bloccato in una
			let moved = false;

			// Chiamata a isTouchingUp se vado in alto
			if (wKey.isDown && !this.isTouchingUp()) {						// Tasto premuto e non in collisione con ostacoli
				if (this.background.y + this.stepValue > this.upMapLimit) {	// Se sono a bordo mappa
					this.background.y = this.upMapLimit;					// Fermo il movimento
				} else {
					this.background.y += this.stepValue;					// Altrimenti muovo
				}	
				moved = true;
			}
			// ...
			if (sKey.isDown && !this.isTouchingDown()) {
				if (this.background.y - this.stepValue > this.downMapLimit) {
					this.background.y -= this.stepValue;
				} else {
					this.background.y = this.downMapLimit;
				}
				moved = true;
			}
			// ...
			if (aKey.isDown && !this.isTouchingLeft()) {
				if (this.background.x + this.stepValue > this.leftMapLimit) {
					this.background.x = this.leftMapLimit;
				} else {
					this.background.x += this.stepValue;
				}
				moved = true;
			}
			// ...
			if (dKey.isDown && !this.isTouchingRight()) {
				if (this.background.x - this.stepValue > this.rightMapLimit) {
					this.background.x -= this.stepValue;
				} else {
					this.background.x = this.rightMapLimit;
				}
				moved = true;
			}

			// Se non si è potuto muovere, prova a muovere anche nelle altre direzioni se i tasti sono premuti
			if (!moved) {
				if (newDirection !== 'front' && wKey.isDown && !this.isTouchingUp()) {
					const step = this.lastStep ? 'R' : 'L';
					this.player.setTexture(`backPlayer_${step}`);
					this.lastStep = !this.lastStep;
					if (this.background.y + this.stepValue > this.upMapLimit) {
						this.background.y = this.upMapLimit;
					} else {
						this.background.y += this.stepValue;
					}
				} else if (newDirection !== 'back' && sKey.isDown && !this.isTouchingDown()) {
					const step = this.lastStep ? 'R' : 'L';
					this.player.setTexture(`frontPlayer_${step}`);
					this.lastStep = !this.lastStep;
					if (this.background.y - this.stepValue > this.downMapLimit) {
						this.background.y -= this.stepValue;
					} else {
						this.background.y = this.downMapLimit;
					}
				} else if (newDirection !== 'side') {
					let canMove = false;
					if (aKey.isDown && !this.isTouchingLeft()) {
						this.player.setFlipX(false);
						const step = this.lastStep ? 'M' : 'S';
						this.player.setTexture(`sidePlayer_${step}`);
						this.lastStep = !this.lastStep;
						if (this.background.x + this.stepValue > this.leftMapLimit) {
							this.background.x = this.leftMapLimit;
						} else {
							this.background.x += this.stepValue;
						}
						canMove = true;
					}
					if (dKey.isDown && !this.isTouchingRight()) {
						this.player.setFlipX(true);
						const step = this.lastStep ? 'M' : 'S';
						this.player.setTexture(`sidePlayer_${step}`);
						this.lastStep = !this.lastStep;
						if (this.background.x - this.stepValue > this.rightMapLimit) {
							this.background.x -= this.stepValue;
						} else {
							this.background.x = this.rightMapLimit;
						}
						canMove = true;
					}
				}
			}
			if (this.debug) {
				console.log(`background: x=${this.background.x}, y=${this.background.y}`);
				console.log(`Player: x=${this.player.x}, y=${this.player.y}`);
			}
			// Overlap tra interaction e oggetti quest: mostra tutti i messaggi associati
			if (this.interaction && this.quests) {
				const feetBounds = this.interaction.getBounds();
				const questImages = this.quests.list.filter(obj => obj instanceof Phaser.GameObjects.Image) as Phaser.GameObjects.Image[];
				const messages: string[] = [];
				questImages.forEach((qimg, i) => {
					const qBounds = qimg.getBounds();
					if (Phaser.Geom.Intersects.RectangleToRectangle(feetBounds, qBounds)) {
						messages.push(this.questMessagesArray[i] || `Messaggio quest ${i + 1}`);
					}
				});
				if (messages.length > 0) {
					this.info_text.text = messages.join('\n');
					this.info_text.visible = true;
				} else {
					this.info_text.visible = false;
				}
			}
		} else if (!moving) {
			// Personaggio fermo: texture stop, evita di settare la stessa texture
			let texture = '';
			if (this.direction === 'front') texture = 'backPlayer_S';
			else if (this.direction === 'back') texture = 'frontPlayer_S';
			else if (this.direction === 'side') texture = 'sidePlayer_S';
			if (this.player.texture.key !== texture) {
				this.player.setTexture(texture);
			}
		}
	}

	// --- METODI DI COLLISIONE ---
	// Questi metodi vengono chiamati in update() per verificare collisioni tra interaction e ostacoli

	isTouchingRight(): boolean {
		if (!this.interaction || !this.obstacles) return false;
		const feetBounds = this.interaction.getBounds();
		return this.obstacles.list
			.filter(obj => obj instanceof Phaser.GameObjects.Rectangle)
			.some(obstacle => {
				const obsBounds = (obstacle as Phaser.GameObjects.Rectangle).getBounds();
				return (
					feetBounds.right >= obsBounds.left &&
					feetBounds.left < obsBounds.left &&
					feetBounds.bottom > obsBounds.top &&
					feetBounds.top < obsBounds.bottom
				);
			}
		);
	}

	isTouchingLeft(): boolean {
		if (!this.interaction || !this.obstacles) return false;
		const feetBounds = this.interaction.getBounds();
		return this.obstacles.list
			.filter(obj => obj instanceof Phaser.GameObjects.Rectangle)
			.some(obstacle => {
				const obsBounds = (obstacle as Phaser.GameObjects.Rectangle).getBounds();
				return (
					feetBounds.left <= obsBounds.right &&
					feetBounds.right > obsBounds.right &&
					feetBounds.bottom > obsBounds.top &&
					feetBounds.top < obsBounds.bottom
				);
			}
		);
	}

	isTouchingUp(): boolean {
		if (!this.interaction || !this.obstacles) return false;
		const feetBounds = this.interaction.getBounds();
		return this.obstacles.list
			.filter(obj => obj instanceof Phaser.GameObjects.Rectangle)
			.some(obstacle => {
				const obsBounds = (obstacle as Phaser.GameObjects.Rectangle).getBounds();
				return (
					feetBounds.top <= obsBounds.bottom &&
					feetBounds.bottom > obsBounds.bottom &&
					feetBounds.right > obsBounds.left &&
					feetBounds.left < obsBounds.right
				);
			}
		);
	}

	isTouchingDown(): boolean {
		if (!this.interaction || !this.obstacles) return false;
		const feetBounds = this.interaction.getBounds();
		return this.obstacles.list
			.filter(obj => obj instanceof Phaser.GameObjects.Rectangle)
			.some(obstacle => {
				const obsBounds = (obstacle as Phaser.GameObjects.Rectangle).getBounds();
				return (
					feetBounds.bottom >= obsBounds.top &&
					feetBounds.top < obsBounds.top &&
					feetBounds.right > obsBounds.left &&
					feetBounds.left < obsBounds.right
				);
			}
		);
	}
	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
// Esportazione della scena
export default Scene_1;