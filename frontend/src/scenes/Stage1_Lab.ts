
// You can write more code here
import PopupManager from "../items/UI/PopupManager";
import { applyTranslations, launchSubScene } from "../utils";

/* START OF COMPILED CODE */

class Stage1_Lab extends Phaser.Scene {

	constructor() {
		super("Stage1_Lab");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

		// lab_bg
		this.add.image(640, 360, "lab_bg");

		// player
		const player = this.add.sprite(554, 344, "big_player_idle", 0);
		player.scaleX = 2;
		player.scaleY = 2;

		this.player = player;

		this.events.emit("scene-awake");
	}

	private player!: Phaser.GameObjects.Sprite;

	/* START-USER-CODE */

	private popupManager!: PopupManager;

	// Write your code here

	preload() {
		const lang = localStorage.getItem("lang") || "en";
		this.load.json("stage1_lab_i18n", `assets/i18n/${lang}/Stage1_Lab.json`);

		this.load.pack("stage1-pack", "assets/images/stage1-pack.json");
		this.load.pack("player-pack", "assets/images/player-pack.json");
		this.load.pack("icons-pack", "assets/images/icons-pack.json");
	}

	create() {

		this.editorCreate();

		// Initialize popup manager
		this.popupManager = new PopupManager(this);

		// Applicazione delle traduzioni
		const i18n = this.cache.json.get("stage1_lab_i18n");
		applyTranslations(this, i18n);

		// Fade in from red to give the scene an intro pulse
		this.cameras.main.fadeFrom(1500, 255, 0, 0);
		this.cameras.main.setZoom(4.3);

		// Position player facing right
		this.player.setFlipX(true); // Face right while moving

		// Create animations for the big player
		const anims = this.anims;

		// Walk side animation
		anims.create({
			key: 'big_walk_side',
			frames: anims.generateFrameNumbers('big_player_walk_side', { start: 0, end: -1 }),
			frameRate: 15,
			repeat: -1
		});

		// Show dialogs after fade completes
		this.cameras.main.once('camerafadeincomplete', () => {
			this.popupManager.queuePopup(i18n.lab_entrance_1);
			this.popupManager.showNextPopup();

			this.popupManager.on("queueEmpty", () => {
				this.popupManager.queuePopup(i18n.lab_entrance_2);
				this.popupManager.queuePopup(i18n.lab_entrance_3);
				this.popupManager.showNextPopup(200);

				// Start walking animation and move to x=680
				this.player.play('big_walk_side', true);
				this.tweens.add({
					targets: this.player,
					x: 678,
					duration: 2000,
					ease: 'Linear',
					onComplete: () => {
						// Stop at upward facing idle
						this.player.stop();
						this.player.setTexture('big_player_idle', 3);

						// Run camera zoom and fade-out in parallel, both required before minigame
						let cameraReady = false;
						let fadeReady = false;
						let minigameLaunched = false;
						const tryLaunchMinigame = () => {
							if (cameraReady && fadeReady && !minigameLaunched) {
								minigameLaunched = true;

								launchSubScene(this, "GraficoGame", { completionEvent: "grafico-complete", overlay: false }, () => {
									this.scene.stop("GraficoGame");
									this.scene.resume();

									// Fade to red when returning
									this.cameras.main.fadeOut(1500, 255, 0, 0);
									this.time.delayedCall(1500, () => {
										this.events.emit("lab-complete");
									});
								});
							}
						};

						this.sound.play("keyboard", {
							volume: this.game.sound.volume * parseFloat(localStorage.getItem("sfxVolume") || "1")
						})

						this.tweens.add({
							targets: this.cameras.main,
							zoom: 31.25,
							scrollX: this.player.x - 640,
							scrollY: this.player.y - 360 - 47,
							duration: 1000,
							ease: 'Linear',
							onComplete: () => {
								cameraReady = true;
								tryLaunchMinigame();
							}
						});

						this.tweens.add({
							targets: this.player,
							alpha: 0.0,
							duration: 1000,
							ease: 'Linear',
							onComplete: () => {
								fadeReady = true;
								tryLaunchMinigame();
							}
						});
					}
				});
			});
		});
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Stage1_Lab;