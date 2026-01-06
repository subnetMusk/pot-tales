import PopupManager from "../items/UI/PopupManager";
import { applyTranslations } from "../utils";
import VideoPlayer from "../items/UI/VideoPlayer";

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
		const graficoEx = this.add.image(640, 360, "grafico");

		// rectangle_1
		this.rectangle_1 = this.add.rectangle(581.5, 357, 1, 82, 13633030);

		this.events.emit("scene-awake");
	}

	/* START-USER-CODE */

	private popup!: PopupManager;
	private rectangle_1!: Phaser.GameObjects.Rectangle;

	private victoryShown: boolean = false;


	// Write your code here

	preload() {
		const lang = localStorage.getItem("lang") || "en";
		this.load.json("graficoGame_i18n", `assets/i18n/${lang}/GraficoGame.json`);
	}

	create() {

		this.editorCreate();
		// Start zoomed out so the scene is invisible
		this.cameras.main.setZoom(0.695);

		// Applicazione delle traduzioni
		const i18n = this.cache.json.get("graficoGame_i18n");
		applyTranslations(this, i18n);

		//Popup per spiegare il gioco 
		this.popup = new PopupManager(this);
		this.popup.queuePopup(i18n.welcome);
		this.popup.queuePopup(i18n.instructions);

		// Video introduttivo

		// Video come finestra sullo schermo del computer
		const videoPlayer = new VideoPlayer(this, 0, 0);
		this.add.existing(videoPlayer);

		videoPlayer.loadVideo("IR.mp4", "fill");
		videoPlayer.play();
		this.events.on('video-ended', () => {
			this.time.delayedCall(750, () => {
				videoPlayer.destroy();
				this.cameras.main.zoomTo(5, 100);

				this.popup.showNextPopup();
			});
		});

		const picchi :{ x:number, found:boolean}[] = [
			{ x: 592, found: false },
			{ x: 659.5, found: false },
			{ x: 692, found: false }
		];

		const risposte:{text : string}[] = [
			{ text: i18n.peak_1 },
			{ text: i18n.peak_2 },
			{ text: i18n.peak_3 }
		];


		const lunghezzaMax = 127; // Valore massimo del grafico 
		let picchiTrovati = 0;
		let tween: Phaser.Tweens.Tween;

		this.popup.on("queueEmpty", () => {
			if (this.input.keyboard) {
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
							// console.log("Scansione completata!");
						}
					});
				});

				this.input.keyboard.on('keydown-SPACE', () => {
					//ferma scansione e valuta posizione
					// console.log("SPAZIO premuto! Posizione rettangolo: " + this.rectangle_1.x);
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
						
					} else {
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
		});
	
		// console.log("GraficoGame scene created");

	}

	controllaPunteggio(picchiTrovati:number,tween:Phaser.Tweens.Tween){ 
			if(picchiTrovati == 3 && !this.victoryShown){

				this.victoryShown = true;
				tween.stop();

				const i18n = this.cache.json.get("graficoGame_i18n");
				this.popup.queuePopup(i18n.victory);
				this.popup.on("queueEmpty", () => {
					this.events.emit("grafico-complete");
				});
				this.popup.showNextPopup();

				// Fireworks effect 
				const fireworksCount = 15;
				for (let f = 0; f < fireworksCount; f++) {
					this.time.delayedCall(f * 100, () => {
						const x = Phaser.Math.Between(525, 750);
						const y = Phaser.Math.Between(300, 400);

						for (let i = 0; i < 6; i++) {
							const particle = this.add.text(x, y, '✨', { fontSize: '12px' });
							const angle = (i / 6) * Math.PI * 2;
							const distance = 50;

							this.tweens.add({
								targets: particle,
								x: x + Math.cos(angle) * distance,
								y: y + Math.sin(angle) * distance,
								alpha: 0,
								duration: 2000,
								ease: 'Quad.easeOut',
								onComplete: () => particle.destroy()
							});
						}
					});
				}
			}
		}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */
export default GraficoGame;
// You can write more code here
