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
		graficoEx.alpha = 0;
		this.graficoEx = graficoEx;

		// completion text
		this.completionText = this.add.text(750, 280, "", {});
		this.completionText.setStyle({ "align": "center", "color": "#000000", "fontFamily": "PixelifySans-VariableFont_wght", "fontSize": "10px", "resolution": "5" });
		this.completionText.setOrigin(0, 0.5);

		// indicator
		this.indicator = this.add.rectangle(532, 349.4, 2, 162.6, 13633030);

		this.events.emit("scene-awake");
	}

	/* START-USER-CODE */

	private popup!: PopupManager;
	private graficoEx!: Phaser.GameObjects.Image;
	private indicator!: Phaser.GameObjects.Rectangle;
	private completionText!: Phaser.GameObjects.Text;

	private picchi :{ x:number, found:boolean}[] = [
		{ x: 553, found: false },
		{ x: 686, found: false },
		{ x: 753, found: false }
	];

	// Attributo che evita lo spam di picchi trovati
	private lastPeakTime: number = 0;

	// Attributo che evita di mostrare più volte il messaggio di vittoria
	private victoryShown: boolean = false;


	// Write your code here

	preload() {
		const lang = localStorage.getItem("lang") || "en";
		this.load.json("graficoGame_i18n", `assets/i18n/${lang}/GraficoGame.json`);
	}

	create() {

		this.editorCreate();

		this.completionText.setText("0 / " + this.picchi.length);
		// Start zoomed out so the scene is invisible
		this.cameras.main.setZoom(0.695);

		// Applicazione delle traduzioni
		const i18n = this.cache.json.get("graficoGame_i18n");
		applyTranslations(this, i18n);

		//Popup per spiegare il gioco 
		this.popup = new PopupManager(this);
		this.popup.queuePopup(i18n.welcome_1, "hint");
		this.popup.queuePopup(i18n.welcome_2);
		this.popup.queuePopup(i18n.welcome_3_narrator, "dark");
		this.popup.queuePopup(i18n.welcome_4);
		this.popup.queuePopup(i18n.welcome_5_narrator, "dark");
		this.popup.queuePopup(i18n.instructions, "hint");

		// Video introduttivo

		// Video come finestra sullo schermo del computer
		const videoPlayer = new VideoPlayer(this, 0, 0);
		this.add.existing(videoPlayer);

		videoPlayer.loadVideo("IR.mp4", "fill");
		videoPlayer.play();
		this.events.on('video-ended', () => {
			this.time.delayedCall(750, () => {
				videoPlayer.destroy();
				this.cameras.main.alpha = 0;

				this.tweens.add({
					targets: this.graficoEx,
					alpha: 1,
					duration: 1000,
					ease: 'Quad.easeInOut'
				});

				this.tweens.add({
					targets: this.cameras.main,
					zoom: 2.5,
					alpha: 1,
					duration: 1000,
					ease: 'Quad.easeInOut',
					onComplete: () => {
						this.popup.showNextPopup();
					}
				});
			});
		});

		const risposte:{text : string}[] = [
			{ text: i18n.peak_1 },
			{ text: i18n.peak_2 },
			{ text: i18n.peak_3 }
		];


		const lunghezzaMax = 253; // Valore massimo del grafico 
		let picchiTrovati = 0;
		let tween: Phaser.Tweens.Tween;

		this.popup.on("queueEmpty", () => {
			let startX = this.indicator.x;
			let endX = startX + lunghezzaMax;

			this.input.keyboard?.off('keydown-ENTER');

			tween = this.tweens.add({
				targets: this.indicator,
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

			this.input.keyboard?.on('keydown-SPACE', () => {
				//ferma scansione e valuta posizione
				// console.log("SPAZIO premuto! Posizione rettangolo: " + this.rectangle_1.x);

				if(this.time.now - this.lastPeakTime > 500 && !this.popup.isActive){
					this.lastPeakTime = this.time.now;
					tween.pause();

					let foundPeak = false;
					for(let i = 0; i < this.picchi.length; i++){
						if(this.indicator.x <= this.picchi[i].x+4 && this.indicator.x >= this.picchi[i].x-4	&&  this.picchi[i].found == false){
							this.popup.queuePopup(risposte[i].text);
							this.popup.showNextPopup();

							picchiTrovati++;
							tween.timeScale *= 1.5;

							this.completionText.setText(picchiTrovati + " / " + this.picchi.length);

							this.picchi[i].found = true;
							foundPeak = true;

							break;
						}
					}

					if(!foundPeak){
						const i18n = this.cache.json.get("graficoGame_i18n");
						this.popup.queuePopup(i18n.miss);

					}

					this.popup.showNextPopup();
					this.popup.on("queueEmpty", () => {
						this.controllaPunteggio(picchiTrovati,tween);
						tween.resume();
					});
				}
			});
		});
	
		// console.log("GraficoGame scene created");

	}

	controllaPunteggio(picchiTrovati:number,tween:Phaser.Tweens.Tween){ 
			if(picchiTrovati == this.picchi.length && !this.victoryShown){

				this.victoryShown = true;
				tween.stop();

				const i18n = this.cache.json.get("graficoGame_i18n");
				this.popup.queuePopup(i18n.victory, "dark");
				this.popup.on("queueEmpty", () => {
					this.events.emit("grafico-complete");
				});
				this.popup.showNextPopup();

				// Fireworks effect 
				const fireworksCount = 50;
				for (let f = 0; f < fireworksCount; f++) {
					this.time.delayedCall(f * 100, () => {
						const x = Phaser.Math.Between(425, 850);
						const y = Phaser.Math.Between(200, 500);

						for (let i = 0; i < 6; i++) {
							const particle = this.add.text(x, y, '✨', { fontSize: '24px' });
							const angle = (i / 6) * Math.PI * 2;
							const distance = 75;

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
