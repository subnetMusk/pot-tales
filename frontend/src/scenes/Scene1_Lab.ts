
// You can write more code here

/* START OF COMPILED CODE */

class Scene1_Lab extends Phaser.Scene {

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

	// Write your code here

	create() {

		this.editorCreate();

		// Fade in from red to give the scene an intro pulse
		this.cameras.main.fadeFrom(1500, 255, 0, 0);
		this.cameras.main.setZoom(4.3);

		// Create animations for the big player
		const anims = this.anims;

		// Walk side animation
		if (!anims.exists('big_walk_side')) {
			anims.create({
				key: 'big_walk_side',
				frames: anims.generateFrameNumbers('big_player_walk_side', { start: 0, end: -1 }),
				frameRate: 15,
				repeat: -1
			});
		}

		// Start walking animation and move to x=680
		this.player.play('big_walk_side', true);
		this.player.setFlipX(true); // Face right while moving
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
						this.scene.pause();
						this.scene.launch("GraficoGame");
						this.scene.bringToTop("GraficoGame");

						const grafGame = this.scene.get("GraficoGame") as Phaser.Scene | undefined;
						if (grafGame) {
							grafGame.events.once("grafico-complete", () => {
								this.scene.stop("GraficoGame");
								this.scene.resume();

								// Fade to red when returning
								this.cameras.main.fadeOut(1500, 255, 0, 0);
								this.time.delayedCall(1500, () => {
									this.events.emit("lab-complete");
								});
							});
						}
					}
				};

				this.tweens.add({
					targets: this.cameras.main,
					zoom: 31.25,
					scrollX: this.player.x - 640,
					scrollY: this.player.y - 360 - 47,
					duration: 2000,
					ease: 'Power2.easeInOut',
					onComplete: () => {
						cameraReady = true;
						tryLaunchMinigame();
					}
				});

				this.tweens.add({
					targets: this.player,
					alpha: 0.0,
					duration: 2000,
					ease: 'Power2.easeInOut',
					onComplete: () => {
						fadeReady = true;
						tryLaunchMinigame();
					}
				});
			}
		});
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Scene1_Lab;