
// You can write more code here

/* START OF COMPILED CODE */

class Menu extends Phaser.Scene {

	constructor() {
		super("Menu");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

		// Leaderboard_button
		const leaderboard_button = this.add.rectangle(640, 360, 450, 50);
		leaderboard_button.isStroked = true;
		leaderboard_button.strokeColor = 15204153;
		leaderboard_button.lineWidth = 2;
		leaderboard_button.setInteractive();

		// Leaderboard
		const leaderboard = this.add.text(640, 360, "", {});
		leaderboard.setOrigin(0.5, 0.5);
		leaderboard.text = "Leaderboard";
		leaderboard.setStyle({ "color": "#e7ff39", "fontSize": "30px", "stroke": "#000000" });

		leaderboard_button.on('pointerdown', () => {
			leaderboard_button.setFillStyle(0x9ca52b);
			leaderboard.setStyle({ "color": "#bfcf2a" });
		});
		leaderboard_button.on('pointerup', () => {
			leaderboard_button.setFillStyle();
			leaderboard.setStyle({ "color": "#e7ff39" });
			window.location.href = "/static/pages/gay.html";
		});
		leaderboard_button.on('pointerout', () => {
			leaderboard_button.setFillStyle();
			leaderboard.setStyle({ "color": "#e7ff39" });
		});

		// Play_button
		const play_button = this.add.rectangle(640, 260, 450, 50);
		play_button.isStroked = true;
		play_button.strokeColor = 15204153;
		play_button.lineWidth = 2;
		play_button.setInteractive();

		// Play
		const play = this.add.text(640, 260, "", {});
		play.setOrigin(0.5, 0.5);
		play.text = "Play";
		play.setStyle({ "color": "#e7ff39", "fontSize": "30px", "stroke": "#000000" });

		play_button.on('pointerdown', () => {
			play_button.setFillStyle(0x9ca52b);
			play.setStyle({ "color": "#bfcf2a" });
		});
		play_button.on('pointerup', () => {
			play_button.setFillStyle();
			play.setStyle({ "color": "#e7ff39" });
			// Carica la scena Scene1
			this.scene.start("Scene1");
		});
		play_button.on('pointerout', () => {
			play_button.setFillStyle();
			play.setStyle({ "color": "#e7ff39" });
		});

		// Settings_button
		const settings_button = this.add.rectangle(640, 460, 450, 50);
		settings_button.isStroked = true;
		settings_button.strokeColor = 15204153;
		settings_button.lineWidth = 2;
		settings_button.setInteractive();

		// Settings
		const settings = this.add.text(640, 460, "", {});
		settings.setOrigin(0.5, 0.5);
		settings.text = "Settings";
		settings.setStyle({ "color": "#e7ff39", "fontSize": "30px", "stroke": "#000000" });

		settings_button.on('pointerdown', () => {
			settings_button.setFillStyle(0x9ca52b);
			settings.setStyle({ "color": "#bfcf2a" });
		});
		settings_button.on('pointerup', () => {
			settings_button.setFillStyle();
			settings.setStyle({ "color": "#e7ff39" });
			window.location.href = "/static/pages/gay.html";
		});
		settings_button.on('pointerout', () => {
			settings_button.setFillStyle();
			settings.setStyle({ "color": "#e7ff39" });
		});

		this.leaderboard_button = leaderboard_button;
		this.play_button = play_button;
		this.settings_button = settings_button;

		this.events.emit("scene-awake");
	}

	private leaderboard_button!: Phaser.GameObjects.Rectangle;
	private play_button!: Phaser.GameObjects.Rectangle;
	private settings_button!: Phaser.GameObjects.Rectangle;

	/* START-USER-CODE */

	// Write your code here

	create() {
		this.editorCreate();
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Menu;