import { transformWithEsbuild } from "vite";
import Player from "../items/Main/Player";
// You can write more code here

/* START OF COMPILED CODE */

class Tutorial extends Phaser.Scene {

	/*bisogna controllare i bordi e fare la luce più carina   */

	constructor() {
		super("Tutorial");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

		// bgBL
		const bgBL = this.add.image(640, 360, "Background");
		bgBL.setOrigin(1, 0);
		bgBL.flipX = true;
		bgBL.flipY = true;

		// bgBR
		const bgBR = this.add.image(640, 360, "Background");
		bgBR.setOrigin(0, 0);
		bgBR.flipY = true;

		// bgTR
		const bgTR = this.add.image(640, 360, "Background");
		bgTR.setOrigin(0, 1);

		// bgTL
		const bgTL = this.add.image(640, 360, "Background");
		bgTL.setOrigin(1, 1);
		bgTL.flipX = true;

		// player
		const player = new Player(this, 640, 360);
		this.add.existing(player);

		this.player = player;

		this.events.emit("scene-awake");
	}

	private player!: Player;
	private popupQueue: string[] = []; // Coda dei popup
	private currentPopup: Phaser.GameObjects.Container | null = null; // Popup attualmente visibile
	private isPopupActive: boolean = false; // Flag per sapere se c'è un popup attivo
	private overlay!: Phaser.GameObjects.Graphics;
	private spotlight!: Phaser.GameObjects.Graphics;
	private targetLuce!: Phaser.GameObjects.Graphics;
	private timer = false

	/* START-USER-CODE */

	// Write your code here
	preload() {
		this.load.pack("Player-pack", "frontend/public/assets/images/player-pack.json");
		this.load.pack("Tutorial-pack", "frontend/public/assets/images/tutorial-pack.json");
	}

	create() {

		this.editorCreate();
		this.cameras.main.setZoom(5);
		this.cameras.main.startFollow(this.player.player, true, 1.0, 1.0, -this.player.x, -this.player.y);

		
		this.createSpotlightEffect();

		// Aggiugiamo i popup alla coda 
		this.queuePopup("Benvenuto!");
		this.queuePopup("Usa le frecce direzionali per muoverti.");
		this.queuePopup("Buona fortuna!");
		
		// Inizia la visualizzazione dei popup
		this.showNextPopup();

		this.avviaTimer();

		this.events.on("timer-finished", () => {
			// timer finito
			console.log("Il timer è terminato!");
			this.timer = true;
			// Crea il pallino vicino al player
			this.creaLuce(this.player.x +30, this.player.y+30);
		});


	}

	//timer 
	private avviaTimer() {
		this.time.addEvent({
			delay: 3000, // 30 secondi
			callback: () => {
				this.events.emit("timer-finished");
			},
			callbackScope: this // Importante: assicura che il callback abbia il giusto contesto
		});
	}

	// Metodo update per controllare eventi
	update() {

		/*** sistemare coordinate e distanza  */


		// Controlla se esiste un pallino da raggiungere
		if (this.timer) {
			// Calcola la distanza tra player e pallino
			const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.targetLuce.x, this.targetLuce.y);

			console.log(`Player: (${this.player.player.x}, ${this.player.player.y}), Pallino: (${this.targetLuce.x}, ${this.targetLuce.y}), Distanza: ${distance}	`);

			// Se il player è abbastanza vicino (raggio di 4 pixel)
			if (distance < 4) {
				console.log("Player ha raggiunto il pallino!");
				this.onPlayerReachedTarget();
			}
		}
	}

	// Evento quando il player raggiunge il target
	private onPlayerReachedTarget() {
		// passa alla prossima scena  
		this.scene.start("Scene_1");
	}


	// Metodi per gestire la coda dei popup
	
	// Aggiunge un popup alla coda
	private queuePopup(message: string) {
		this.popupQueue.push(message);
	}
	
	// Mostra il prossimo popup della coda
	private showNextPopup() {
		// Se c'è già un popup attivo o la coda è vuota, non fare nulla
		if (this.isPopupActive || this.popupQueue.length === 0) {
			return;
		}
		
		// Prendi il primo messaggio dalla coda
		const message = this.popupQueue.shift();
		if (message) {
			this.isPopupActive = true;
			this.currentPopup = this.createInteractivePopup(message);
		}
	}
	
	// Chiamata quando un popup viene chiuso
	private onPopupClosed() {
		this.isPopupActive = false;
		this.currentPopup = null;
		
		// Mostra il prossimo popup se ce ne sono altri
		this.showNextPopup();
	}

	// Funzione per il messaggio di benvenuto
	
	private createInteractivePopup(message: string) {
    // Container per il popup (ignora zoom camera)
    const popup = this.add.container(this.scale.width / 2, this.scale.height / 2);
    popup.setScrollFactor(0); // Ignora zoom della camera
    
    // Crea il testo prima per misurare le dimensioni
    const text = this.add.text(0, -10, message, {
        fontSize: '8px',
        color: '#ffffff',
        fontStyle: 'bold',
        fontFamily: 'Arial, sans-serif',
        resolution: 2,
        align: 'center',
        wordWrap: { width: 200 } // Larghezza massima per il wrapping
    });
    text.setOrigin(0.5);
    
    // Calcola le dimensioni del contenitore basate sul testo
    const textWidth = text.width;
    const textHeight = text.height;
    const padding = 6; // Padding attorno al testo
    const buttonHeight = 10; // Altezza del pulsante OK
    const buttonMargin = 6; // Spazio tra testo e pulsante
    
    const containerWidth = Math.max(textWidth + padding * 2, 60); // Larghezza minima 60px
    const containerHeight = textHeight + padding + buttonHeight + buttonMargin;
    
    // Sfondo adattivo alle dimensioni del contenuto
    const bg = this.add.graphics();
    bg.fillStyle(0x333333, 0.95);
    bg.fillRoundedRect(-containerWidth/2, -containerHeight/2, containerWidth, containerHeight, 6);
    bg.lineStyle(1, 0xffffff, 1);
    bg.strokeRoundedRect(-containerWidth/2, -containerHeight/2, containerWidth, containerHeight, 6);
    
    // Riposiziona il testo al centro dell'area testo
    const textY = -containerHeight/2 + padding + textHeight/2;
    text.setPosition(0, textY);

    
    // Pulsante OK adattivo
    const buttonWidth = Math.max(40, containerWidth * 0.3); // Larghezza proporzionale
    const buttonY = containerHeight/2 - buttonHeight/2 - 4; // Posizione in fondo al container
    
    const okButton = this.add.graphics();
    okButton.fillStyle(0x4CAF50, 1);
    okButton.fillRoundedRect(-buttonWidth/2, buttonY - buttonHeight/2, buttonWidth, buttonHeight, 3);
    okButton.lineStyle(1, 0x45a049, 1);
    okButton.strokeRoundedRect(-buttonWidth/2, buttonY - buttonHeight/2, buttonWidth, buttonHeight, 3);
    okButton.setInteractive(new Phaser.Geom.Rectangle(-buttonWidth/2, buttonY - buttonHeight/2, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);
    
    const okText = this.add.text(0, buttonY, 'OK', {
        fontSize: '6px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        resolution: 2
    });
    okText.setOrigin(0.5);
    
    // Aggiungi tutto al container
    popup.add([bg, text, okButton, okText]);
    popup.setDepth(200);
    popup.setScale(0);
    
    // Animazione senza scaling per evitare blur
    this.tweens.add({
        targets: popup,
        alpha: { from: 0, to: 1 }, // Usa alpha invece di scale
        y: { from: popup.y + 10, to: popup.y }, // Leggero movimento
        scale: { from: 0.8, to: 1 }, // Scaling minimo
        duration: 200, // Più veloce
        ease: 'Power2.easeOut'
    });
    
    // Gestione click con animazione più pulita
    okButton.on('pointerdown', () => {
        this.tweens.add({
            targets: popup,
            alpha: 0,
            y: popup.y - 5,
            duration: 150,
            ease: 'Power2.easeIn',
            onComplete: () => {
                popup.destroy();
                this.onPopupClosed(); // Chiama il callback per mostrare il prossimo popup
            }
        });
    });
    
    return popup;
	}

	
	private creaLuce(x: number, y: number) {
		console.log(`Creando luce alle coordinate: ${x}, ${y}`);

		// Crea semplicemente un cerchio visibile alle coordinate x,y 
		const luce = this.add.graphics();
		luce.fillStyle(0xff0000, 1); // Rosso
		luce.fillCircle(0, 0, 2); 
		luce.setPosition(x, y); 
		luce.setDepth(100); // Depth altissimo

		// Salva il riferimento per il controllo delle collisioni
		this.targetLuce = luce;

		console.log(`Pallino fisso nel mondo alle coordinate: ${x}, ${y}`);
	}




	// Funzione per creare l'effetto spotlight
	private createSpotlightEffect() {

		console.log("Creating spotlight effect");
		// Add dark overlay everywhere
		this.overlay = this.add.graphics();
		this.overlay.fillStyle(0x000000, 0.9); // Black with 90% opacity
		this.overlay.fillRect(0, 0, this.scale.width, this.scale.height);
		this.overlay.setScrollFactor(0); // Keep overlay fixed to camera
		this.overlay.setDepth(50); // Below spotlight but above background

		// Create a spotlight effect - a circle where the dark overlay is removed
		this.spotlight = this.add.graphics();
		this.spotlight.fillCircle(0, 0, 15); // Circle with radius 15 pixels
		this.spotlight.setScrollFactor(0);
		this.spotlight.setDepth(51);

		// Create a mask from the spotlight circle 
		const mask = this.spotlight.createGeometryMask();
		mask.setInvertAlpha(true); // Invert the mask so the circle is transparent

		// Apply the mask to the overlay to create the spotlight effect
		this.overlay.setMask(mask);

		// Make the spotlight follow the player
		this.tweens.add({
			targets: this.spotlight,
			x: this.player.x,
			y: this.player.y,
			duration: 0,
			repeat: -1,
			onUpdate: () => {
				this.spotlight.setPosition(this.player.x, this.player.y);
			}
		});
	}
		
	

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Tutorial;