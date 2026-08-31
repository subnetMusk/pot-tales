import PopupManager from "../items/UI/PopupManager";
import { applyTranslations, playSequence } from "../utils";
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
		const graficoEx = this.add.image(640, 360, "grafico1");
		graficoEx.alpha = 0;
		this.graficoEx = graficoEx;

		// completion text
		this.completionText = this.add.text(750, 270, "", {});
		this.completionText.setStyle({ "align": "center", "color": "#000000", "fontFamily": "PixelifySans-VariableFont_wght", "fontSize": "10px", "resolution": "5" });
		this.completionText.setOrigin(0, 0.5);

		// indicator
		this.indicator = this.add.rectangle(517, 360.4, 2, 157, 13633030);

		this.events.emit("scene-awake");
	}

	/* START-USER-CODE */

	private popupManager!: PopupManager;
	private graficoEx!: Phaser.GameObjects.Image;
	private indicator!: Phaser.GameObjects.Rectangle;
	private completionText!: Phaser.GameObjects.Text;

	// Livelli in sequenza: stesso numero di picchi e stessa difficoltà per ognuno,
	// solo il grafico (immagine + posizione dei picchi) cambia. Le x dei picchi per i
	// livelli 2 e 3 sono placeholder, da tarare sulle immagini reali.
	private levels: { imageKey: string, picchi: { x: number, found: boolean }[] }[] = [
		{
			imageKey: "grafico1",
			picchi: [
				{ x: 564, found: false },
				{ x: 689, found: false },
				{ x: 726, found: false }
			]
		},
		{
			imageKey: "grafico2",
			picchi: [
				{ x: 693, found: false },
				{ x: 729, found: false },
				{ x: 740, found: false }
			]
		},
		{
			imageKey: "grafico3",
			picchi: [
				{ x: 698, found: false },
				{ x: 727, found: false }
			]
		}
	];

	private currentLevel: number = 0;

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

		this.completionText.setText("0 / " + this.levels[this.currentLevel].picchi.length);
		// Start zoomed out so the scene is invisible
		this.cameras.main.setZoom(0.695);

		// Applicazione delle traduzioni
		const i18n = this.cache.json.get("graficoGame_i18n");
		applyTranslations(this, i18n);

		// Video introduttivo
		this.popupManager = new PopupManager(this);

		// Video come finestra sullo schermo del computer
		const videoPlayer = new VideoPlayer(this, 0, 0);
		this.add.existing(videoPlayer);

		videoPlayer.loadVideo("IR.mp4", "fill");
		videoPlayer.play();

		const lunghezzaMax = 245; // Valore massimo del grafico
		let picchiTrovati = 0;
		let tween: Phaser.Tweens.Tween;

		// Testi delle spiegazioni dei picchi, per livello (indice 0 = grafico1, 1 = grafico2, 2 = grafico3)
		const peakTextKeys: string[][] = [
			["peak_1", "peak_2", "peak_3"],
			["peak_1_lvl2", "peak_2_lvl2", "peak_3_lvl2"],
			["peak_1_lvl3", "peak_2_lvl3"]
		];

		const startX = this.indicator.x;
		const endX = startX + lunghezzaMax;

		// Avvia (o riavvia per il livello successivo) la scansione: resetta indicatore,
		// testo di completamento e contatore, poi crea il tween che muove l'indicatore.
		// Per i livelli successivi al primo esegue prima un crossfade verso il nuovo grafico.
		const startLevel = (levelIndex: number) => {
			this.currentLevel = levelIndex;
			picchiTrovati = 0;
			this.completionText.setText("0 / " + this.levels[levelIndex].picchi.length);
			this.indicator.x = startX;

			const beginScanning = () => {
				tween = this.tweens.add({
					targets: this.indicator,
					x: endX,
					duration: 4000,
					ease: 'linear',
					yoyo: true,
					loop: -1,
				});
			};

			if (levelIndex === 0) {
				this.graficoEx.setTexture(this.levels[levelIndex].imageKey);
				beginScanning();
				return;
			}

			this.tweens.add({
				targets: this.graficoEx,
				alpha: 0,
				duration: 500,
				ease: 'Quad.easeInOut',
				onComplete: () => {
					this.graficoEx.setTexture(this.levels[levelIndex].imageKey);
					this.tweens.add({
						targets: this.graficoEx,
						alpha: 1,
						duration: 500,
						ease: 'Quad.easeInOut',
						onComplete: beginScanning
					});
				}
			});
		};

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
						//Popup per spiegare il gioco
						void playSequence(this.popupManager, [
							{ message: i18n.welcome_1, preset: "hint" },
							i18n.welcome_2,
							{ message: i18n.welcome_3_narrator, preset: "dark" },
							i18n.welcome_4,
							{ message: i18n.welcome_5_narrator, preset: "dark" },
							{ message: i18n.instructions, preset: "hint" }
						]).then(() => {
							this.input.keyboard?.off('keydown-ENTER');

							startLevel(0);

							this.input.keyboard?.on('keydown-SPACE', () => {
								//ferma scansione e valuta posizione
								if(this.time.now - this.lastPeakTime > 500 && !this.popupManager.isActive){
									this.sound.play("pluck", {
											volume: this.game.sound.volume * parseFloat(localStorage.getItem("sfxVolume") || "1")
									});

									this.lastPeakTime = this.time.now;
									tween.pause();

									const picchi = this.levels[this.currentLevel].picchi;
									const risposte = peakTextKeys[this.currentLevel].map(key => i18n[key]);

									let foundPeak = false;
									const lines: Array<string | { message: string; preset?: string }> = [];
									for(let i = 0; i < picchi.length; i++){
										console.log(`[GraficoGame] picco ${i} - x: ${picchi[i].x}, trovato: ${picchi[i].found}`);
										if(this.indicator.x <= picchi[i].x+4 && this.indicator.x >= picchi[i].x-4	&&  picchi[i].found == false){
											lines.push({ message: risposte[i], preset: "minigame" });
											if(this.currentLevel === 0 && i === 1) lines.push(i18n.peak_2_you);

											picchiTrovati++;
											tween.timeScale *= 1.2;

											this.completionText.setText(picchiTrovati + " / " + picchi.length);

											picchi[i].found = true;
											foundPeak = true;

											break;
										}
									}

									if(!foundPeak){
										const i18n = this.cache.json.get("graficoGame_i18n");
										lines.push({ message: i18n.miss, preset: "minigame" });
									}

									playSequence(this.popupManager, lines).then(() => {
										const advanced = this.controllaPunteggio(picchiTrovati, tween, startLevel);
										if(!advanced) tween.resume();
									});
								}
							});
						});
					}
				});
			});
		});

		// console.log("GraficoGame scene created");

	}

	// Ritorna true quando il livello corrente è concluso (livello intermedio superato, oppure
	// vittoria finale): in entrambi i casi non va ripreso il tween che il chiamante teneva in
	// pausa, dato che startLevel ne crea uno nuovo (o il gioco è finito).
	controllaPunteggio(picchiTrovati: number, tween: Phaser.Tweens.Tween, startLevel: (levelIndex: number) => void): boolean {
		const picchi = this.levels[this.currentLevel].picchi;
		if(picchiTrovati != picchi.length) return false;

		const i18n = this.cache.json.get("graficoGame_i18n");
		const isLastLevel = this.currentLevel === this.levels.length - 1;

		if(!isLastLevel){
			tween.stop();
			playSequence(this.popupManager, [{ message: i18n.level_complete, preset: "dark" }]).then(() => {
				startLevel(this.currentLevel + 1);
			});
			return true;
		}

		if(!this.victoryShown){
			this.sound.play("success", {
					volume: this.game.sound.volume * parseFloat(localStorage.getItem("sfxVolume") || "1")
			});

			this.victoryShown = true;
			tween.stop();

			playSequence(this.popupManager, [{ message: i18n.victory, preset: "dark" }]).then(() => {
				this.events.emit("grafico-complete");
			});

			// Fireworks effect (particle emitter nativo al posto di ~300 oggetti Text emoji)
			// Texture con bagliore morbido (gradiente radiale) + piccola croce "scintillio"
			// al centro, invece di un cerchio pieno a bordo netto.
			if (!this.textures.exists('spark')) {
				const size = 16;
				const cx = size / 2;
				const cy = size / 2;
				const sparkCanvas = this.textures.createCanvas('spark', size, size);
				const ctx = sparkCanvas!.getContext();

				const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
				glow.addColorStop(0, 'rgba(255,255,255,1)');
				glow.addColorStop(0.45, 'rgba(255,255,255,0.85)');
				glow.addColorStop(1, 'rgba(255,255,255,0)');
				ctx.fillStyle = glow;
				ctx.fillRect(0, 0, size, size);

				ctx.strokeStyle = 'rgba(255,255,255,0.9)';
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.moveTo(cx, 0.5); ctx.lineTo(cx, size - 0.5);
				ctx.moveTo(0.5, cy); ctx.lineTo(size - 0.5, cy);
				ctx.stroke();

				sparkCanvas!.refresh();
			}

			// Piccolo flash bianco al centro di ogni scoppio, per un "pop" più netto prima
			// che si aprano le scintille colorate (come un vero fuoco d'artificio).
			const flashEmitter = this.add.particles(0, 0, 'spark', {
				lifespan: 220,
				speed: 0,
				scale: { start: 2.6, end: 0, ease: 'Cubic.easeOut' },
				alpha: { start: 0.9, end: 0 },
				tint: 0xffffff,
				blendMode: 'ADD',
				emitting: false,
			});

			const fireworksEmitter = this.add.particles(0, 0, 'spark', {
				lifespan: 950,
				speed: { min: 70, max: 150 },
				scale: { start: 1.9, end: 0, ease: 'Cubic.easeOut' },
				alpha: { start: 1, end: 0, ease: 'Cubic.easeIn' },
				rotate: { start: 0, end: 120 },
				// Colori pieni e saturi con blend normale (non additivo), così restano
				// visibili anche sopra allo sfondo chiaro della scena.
				tint: [0xff1744, 0xffd600, 0x00e5ff, 0x7c4dff, 0x00e676],
				blendMode: 'NORMAL',
				emitting: false,
			});

			const fireworksCount = 50;
			for (let f = 0; f < fireworksCount; f++) {
				this.time.delayedCall(f * 100, () => {
					const x = Phaser.Math.Between(425, 850);
					const y = Phaser.Math.Between(200, 500);
					flashEmitter.explode(1, x, y);
					fireworksEmitter.explode(6, x, y);
				});
			}
			this.time.delayedCall(fireworksCount * 100 + 950, () => {
				flashEmitter.destroy();
				fireworksEmitter.destroy();
			});
		}

		return true;
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */
export default GraficoGame;
// You can write more code here
