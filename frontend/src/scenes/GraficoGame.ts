import PopupManager from "../items/UI/PopupManager";
import { applyTranslations } from "../utils";
// You can write more code here

/* START OF COMPILED CODE */

class GraficoGame extends Phaser.Scene {

	constructor() {
		super("GraficoGame");

		/* START-USER-CTR-CODE */

		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

		// graficoEx
		const graficoEx = this.add.image(640, 360, "graficoEx");
		graficoEx.scaleX = 0.2;
		graficoEx.scaleY = 0.2;

		// rectangle_1
		this.rectangle_1 = this.add.rectangle(561, 360, 1, 80);
		this.rectangle_1.isFilled = true;
		this.rectangle_1.fillColor = 13633030;

		this.events.emit("scene-awake");
	}

	/* START-USER-CODE */

	private popup!: PopupManager;
	private rectangle_1!: Phaser.GameObjects.Rectangle;


	// Write your code here

	preload() {
		const lang = localStorage.getItem("lang") || "en";
		this.load.json("graficoGame_i18n", `assets/i18n/${lang}/GraficoGame.json`);
	}

	create() {

		this.editorCreate();
		this.cameras.main.setZoom(5);

		// Applicazione delle traduzioni
		const i18n = this.cache.json.get("graficoGame_i18n");
		applyTranslations(this, i18n);

		const picchi :{ x:number, found:boolean}[] = [
			{ x: 624, found: false },
			{ x: 600, found: false },
			{ x: 640, found: false },
			{ x: 580, found: false }
		];

		const risposte:{text : string}[] = [
			{ text: i18n.peak_1 },
			{ text: i18n.peak_2 },
			{ text: i18n.peak_3 },
			{ text: i18n.peak_4 }
		];


		this.popup = new PopupManager(this);
		const lunghezzaMax = 180; // Valore massimo del grafico 
		let picchiTrovati = 0;

		//popup per spiegare il gioco 

		this.popup.queuePopup(i18n.welcome);
		this.popup.queuePopup(i18n.instructions);
		this.popup.showNextPopup();
		let tween: Phaser.Tweens.Tween;


		if (this.input.keyboard) {
			console.log("Impostando i listener per i tasti...");
			this.input.keyboard.on('keydown-ENTER', () => {
				//avvia scansione con animazione visibile
				let startX = this.rectangle_1.x;
				let endX = startX + lunghezzaMax;

				this.input.keyboard?.off('keydown-ENTER');

				 tween = this.tweens.add({
					targets: this.rectangle_1,
					x: endX,
					duration: 4000,
					ease: 'linear',
					yoyo: true,
					loop: -1,
					//deve accelerare e decelerare
					onComplete: () => {
						console.log("Scansione completata!");
					}
				});
			});

			this.input.keyboard.on('keydown-SPACE', () => {
				//ferma scansione e valuta posizione
				console.log("SPAZIO premuto! Posizione rettangolo: " + this.rectangle_1.x);
				tween.pause();
				if(this.rectangle_1.x <= picchi[0].x+4 && this.rectangle_1.x >= picchi[0].x-4	&&  picchi[0].found == false){
					this.popup.queuePopup(risposte[0].text);
					this.popup.showNextPopup();
					picchiTrovati++;
					picchi[0].found = true;
					
				}else if(this.rectangle_1.x <= picchi[1].x+4 && this.rectangle_1.x >= picchi[1].x-4	&&  picchi[1].found == false){
					this.popup.queuePopup(risposte[1].text);
					this.popup.showNextPopup();
					picchiTrovati++;
					picchi[1].found = true;
					
				}else if(this.rectangle_1.x <= picchi[2].x+4 && this.rectangle_1.x >= picchi[2].x-4	&&  picchi[2].found == false){
					this.popup.queuePopup(risposte[2].text);
					this.popup.showNextPopup();
					picchiTrovati++;
					picchi[2].found = true;
					
				}else if(this.rectangle_1.x <= picchi[3].x+4 && this.rectangle_1.x >= picchi[3].x-4	&&  picchi[3].found == false){
					this.popup.queuePopup(risposte[3].text);
					this.popup.showNextPopup();

					picchiTrovati++;
					picchi[3].found = true;
					
				}else {
					const i18n = this.cache.json.get("graficoGame_i18n");
					this.popup.queuePopup(i18n.miss);

				}
				this.popup.showNextPopup();
				this.popup.on("popupClosed", () => {
					this.controllaPunteggio(picchiTrovati,tween);
					tween.resume();
				});

				

				
			});

			
		}

	
		console.log("GraficoGame scene created");

	}

	controllaPunteggio(picchiTrovati:number,tween:Phaser.Tweens.Tween){ 
			if(picchiTrovati == 1){
				tween.stop();
				const i18n = this.cache.json.get("graficoGame_i18n");
				this.popup.queuePopup(i18n.victory);
				console.log("Hai vinto il gioco!");

				// Fireworks effect 
				//TODO sistemare l'effetto provvisorio fatto da copilot
				const fireworksCount = 8;
				for (let f = 0; f < fireworksCount; f++) {
					this.time.delayedCall(f * 100, () => {
						const x = Phaser.Math.Between(200, 1080);
						const y = Phaser.Math.Between(100, 400);

						for (let i = 0; i < 6; i++) {
							const particle = this.add.text(x, y, '✨', { fontSize: '12px' });
							const angle = (i / 6) * Math.PI * 2;
							const distance = 200;

							this.tweens.add({
								targets: particle,
								x: x + Math.cos(angle) * distance,
								y: y + Math.sin(angle) * distance,
								alpha: 0,
								duration: 800,
								ease: 'Quad.easeOut',
								onComplete: () => particle.destroy()
							});
						}
					});
				}

				this.cameras.main.shake(300, 0.001);
				this.time.delayedCall(2000, () => {
					// Emetti un evento di vittoria SUBITO
					this.events.emit('grafico-complete');
				});
			}
		}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */
export default GraficoGame;
// You can write more code here
