import PopupManager from "../items/UI/PopupManager";
import { applyTranslations, playSequence } from "../utils";
import VideoPlayer from "../items/UI/VideoPlayer";
import { flashBurst, sparkBurst } from "../items/ParticleFx";

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


	// Flash brevemente il colore dell'indicatore (bianco per hit, rosso scuro per miss) prima di
	// tornare al colore originale, come feedback visivo aggiuntivo oltre al burst di particelle.
	private flashIndicator(tint: number) {
		const originalColor = this.indicator.fillColor;
		this.indicator.setFillStyle(tint);
		this.time.delayedCall(120, () => this.indicator.setFillStyle(originalColor));
	}

	// Aggiorna il testo di completamento con un piccolo "pop" invece di un setText piatto
	private setCompletionText(value: string) {
		this.completionText.setText(value);
		this.tweens.add({
			targets: this.completionText,
			scale: { from: 1.3, to: 1 },
			duration: 150,
			ease: "Back.easeOut"
		});
	}

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
			this.setCompletionText("0 / " + this.levels[levelIndex].picchi.length);

			// L'indicatore sfuma alla posizione corrente, si riposiziona all'inizio, poi
			// riappare con un fade-in, invece di scattare istantaneamente su startX. Solo per i
			// passaggi di livello: al primo avvio (levelIndex 0) l'indicatore è già in startX con
			// alpha 1, quindi il fade non farebbe che sfarfallare (alpha 0 mostra lo sfondo chiaro
			// del grafico dietro di lui) senza alcun riposizionamento reale da animare.
			if (levelIndex > 0) {
				this.tweens.add({
					targets: this.indicator,
					alpha: 0,
					duration: 300,
					ease: 'Quad.easeInOut',
					onComplete: () => {
						this.indicator.x = startX;
						this.tweens.add({
							targets: this.indicator,
							alpha: 1,
							duration: 300,
							ease: 'Quad.easeInOut'
						});
					}
				});
			}

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

											this.setCompletionText(picchiTrovati + " / " + picchi.length);
											this.flashIndicator(0xffffff);

											picchi[i].found = true;
											foundPeak = true;

											break;
										}
									}

									if(!foundPeak){
										const i18n = this.cache.json.get("graficoGame_i18n");
										lines.push({ message: i18n.miss, preset: "minigame" });

										this.flashIndicator(0x8b0000);
										this.cameras.main.shake(150, 0.004);
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

			// Fireworks effect (particle emitter nativo al posto di ~300 oggetti Text emoji),
			// tramite gli helper condivisi in ParticleFx.ts (usati anche da Shooter/Stage1).
			const fireworksCount = 50;
			for (let f = 0; f < fireworksCount; f++) {
				this.time.delayedCall(f * 100, () => {
					const x = Phaser.Math.Between(425, 850);
					const y = Phaser.Math.Between(200, 500);
					flashBurst(this, x, y);
					sparkBurst(this, x, y, { count: 6 });
				});
			}
		}

		return true;
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */
export default GraficoGame;
// You can write more code here
