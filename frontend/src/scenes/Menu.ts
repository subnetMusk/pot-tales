import { applyTranslations } from "../utils";
import { showElements } from "../utils";
import { fadeElements } from "../utils";
import MenuBackground from "../items/UI/MenuBackground";
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

		// menuBackground
		const menuBackground = new MenuBackground(this, 520, 360);
		this.add.existing(menuBackground);

		// settings_icon
		const settings_icon = this.add.image(1182, 622, "settings");
		settings_icon.scaleX = 1.5;
		settings_icon.scaleY = 1.5;

		// Leaderboard_button
		const leaderboard_button = this.add.rectangle(640, 470, 450, 90);
		leaderboard_button.isStroked = true;
		leaderboard_button.strokeColor = 15792383;
		leaderboard_button.lineWidth = 2;

		// Leaderboard
		const leaderboard = this.add.text(640, 470, "", {});
		leaderboard.name = "Leaderboard";
		leaderboard.setOrigin(0.5, 0.5);
		leaderboard.text = "Leaderboard";
		leaderboard.setStyle({ "align": "center", "color": "#f0f8ff", "fontFamily": "PixelifySans-VariableFont_wght", "fontSize": "30px", "stroke": "#000000" });

		// leaderboard_icon
		const leaderboard_icon = this.add.image(500, 470, "leaderboard");

		// Play_button
		const play_button = this.add.rectangle(640, 250, 450, 90);
		play_button.isStroked = true;
		play_button.strokeColor = 15792383;
		play_button.lineWidth = 2;

		// Play
		const play = this.add.text(640, 250, "", {});
		play.name = "Play";
		play.setOrigin(0.5, 0.5);
		play.text = "Play";
		play.setStyle({ "align": "center", "color": "#f0f8ff", "fontFamily": "PixelifySans-VariableFont_wght", "fontSize": "30px", "stroke": "#000000" });

		// Gallery_button
		const gallery_button = this.add.rectangle(640, 360, 450, 90);
		gallery_button.isStroked = true;
		gallery_button.strokeColor = 15792383;
		gallery_button.lineWidth = 2;

		// Gallery
		const gallery = this.add.text(640, 360, "", {});
		gallery.name = "Gallery";
		gallery.setOrigin(0.5, 0.5);
		gallery.text = "Gallery";
		gallery.setStyle({ "align": "center", "color": "#f0f8ff", "fontFamily": "PixelifySans-VariableFont_wght", "fontSize": "30px", "stroke": "#000000" });

		// gallery_icon
		const gallery_icon = this.add.image(500, 359, "gallery");

		// fullscreen_icon
		const fullscreen_icon = this.add.image(1182, 98, "fullscreen", 1);
		fullscreen_icon.scaleX = 1.5;
		fullscreen_icon.scaleY = 1.5;

		// play_icon
		const play_icon = this.add.image(500, 250, "play", 0);

		// lists
		const uI = [play_button, play_icon, fullscreen_icon, gallery_icon, gallery, gallery_button, play, leaderboard_icon, leaderboard, leaderboard_button, settings_icon];

		this.settings_icon = settings_icon;
		this.leaderboard_button = leaderboard_button;
		this.play_button = play_button;
		this.gallery_button = gallery_button;
		this.fullscreen_icon = fullscreen_icon;
		this.uI = uI;

		this.events.emit("scene-awake");
	}

	private settings_icon!: Phaser.GameObjects.Image;
	private leaderboard_button!: Phaser.GameObjects.Rectangle;
	private play_button!: Phaser.GameObjects.Rectangle;
	private gallery_button!: Phaser.GameObjects.Rectangle;
	private fullscreen_icon!: Phaser.GameObjects.Image;
	private uI!: Array<Phaser.GameObjects.Rectangle|Phaser.GameObjects.Image|Phaser.GameObjects.Text>;

	/* START-USER-CODE */

	// Write your code here

	async preload() {
        const lang = localStorage.getItem("lang") || "en";
        this.load.json("menu_i18n", `assets/i18n/${lang}/Menu.json`);
    }

	async create() {
		this.editorCreate();
		showElements(this.uI, false);

		// Riproduce il video introduttivo al primo accesso (si resetta aggiornando la pagina)
		if(localStorage.getItem("playIntro") === "true") {
			const { default: VideoPlayer } = await import("../items/UI/VideoPlayer");

			const videoPlayer = new VideoPlayer(this, 0, 0);
			this.add.existing(videoPlayer);

			videoPlayer.loadVideo("intro.mp4", "fill");
			videoPlayer.play();
			this.events.on('video-ended', () => {
				fadeElements([videoPlayer], false, 1000, () => {
					videoPlayer.destroy();
					localStorage.setItem("playIntro", "false");
					fadeElements(this.uI, true);
				});
			});
		} else fadeElements(this.uI, true);

		// Apply translations
        const i18n = this.cache.json.get("menu_i18n");
        applyTranslations(this, i18n);

		// add click events
		this.leaderboard_button.setInteractive();
		this.play_button.setInteractive();
		this.gallery_button.setInteractive();
		this.settings_icon.setInteractive();
		this.fullscreen_icon.setInteractive();

		this.play_button.on('pointerdown', () => {this.play_button.setStrokeStyle(4, 0x00aaff);});
		this.leaderboard_button.on('pointerdown', () => {this.leaderboard_button.setStrokeStyle(4, 0x00aaff);});
		this.gallery_button.on('pointerdown', () => {this.gallery_button.setStrokeStyle(4, 0x00aaff);});
		this.settings_icon.on('pointerdown', () => {this.settings_icon.setTint(0x00aaff);});
		this.fullscreen_icon.on('pointerdown', () => {this.fullscreen_icon.setTint(0x00aaff);});

		this.play_button.on('pointerup', () => {
			fadeElements(this.uI, false, 1000, () => {
				this.cameras.main.zoomTo(1.5, 1000);
				this.cameras.main.fadeOut(1000, 0, 0, 0);
				this.cameras.main.once('camerafadeoutcomplete', () => {this.scene.start("Tutorial");});
			});
		});
		this.leaderboard_button.on('pointerup', () => {this.scene.start("Leaderboard");});
		this.gallery_button.on('pointerup', () => {this.scene.start("Gallery");});
		this.settings_icon.on('pointerup', () => {this.scene.start("Settings");});
		this.fullscreen_icon.on('pointerup', () => {
			if (this.scale.isFullscreen) {
				this.fullscreen_icon.setFrame(1);
				this.scale.stopFullscreen();
			} else {
				this.fullscreen_icon.setFrame(0);
				this.scale.startFullscreen();
			}
		});

		// add hover effects
		this.leaderboard_button.on('pointerover', () => {this.leaderboard_button.setStrokeStyle(4, 0x70bcff);});
		this.leaderboard_button.on('pointerout', () => {this.leaderboard_button.setStrokeStyle(2, 0xf0f8ff);});

		this.play_button.on('pointerover', () => {this.play_button.setStrokeStyle(4, 0x70bcff);});
		this.play_button.on('pointerout', () => {this.play_button.setStrokeStyle(2, 0xf0f8ff);});

		this.gallery_button.on('pointerover', () => {this.gallery_button.setStrokeStyle(4, 0x70bcff);});
		this.gallery_button.on('pointerout', () => {this.gallery_button.setStrokeStyle(2, 0xf0f8ff);});

		this.settings_icon.on('pointerover', () => {this.settings_icon.setTint(0x70bcff);});
		this.settings_icon.on('pointerout', () => {this.settings_icon.clearTint();});

		this.fullscreen_icon.on('pointerover', () => {this.fullscreen_icon.setTint(0x70bcff);});
		this.fullscreen_icon.on('pointerout', () => {this.fullscreen_icon.clearTint();});

		this.events.once("shutdown", () => {
        	this.cache.json.remove("menu_i18n");
    	});
	}
	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Menu;