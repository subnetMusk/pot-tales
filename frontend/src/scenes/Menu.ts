import { applyTranslations } from "../utils";
import { showElements } from "../utils";
import { fadeElements } from "../utils";
import MenuBackground from "../items/UI/MenuBackground";

import {APISession} from "@/network/APISession";
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
		const leaderboard_button = this.add.rectangle(640, 534, 400, 75);
		leaderboard_button.isStroked = true;
		leaderboard_button.strokeColor = 15792383;
		leaderboard_button.lineWidth = 2;

		// Leaderboard
		const leaderboard = this.add.text(640, 534, "", {});
		leaderboard.name = "Leaderboard";
		leaderboard.setOrigin(0.5, 0.5);
		leaderboard.text = "Leaderboard";
		leaderboard.setStyle({ "align": "center", "color": "#f0f8ff", "fontFamily": "PixelifySans-VariableFont_wght", "fontSize": "30px", "stroke": "#000000" });

		// leaderboard_icon
		const leaderboard_icon = this.add.image(478, 532, "leaderboard");

		// Gallery_button
		const gallery_button = this.add.rectangle(640, 448, 400, 75);
		gallery_button.isStroked = true;
		gallery_button.strokeColor = 15792383;
		gallery_button.lineWidth = 2;

		// Gallery
		const gallery = this.add.text(640, 448, "", {});
		gallery.name = "Gallery";
		gallery.setOrigin(0.5, 0.5);
		gallery.text = "Gallery";
		gallery.setStyle({ "align": "center", "color": "#f0f8ff", "fontFamily": "PixelifySans-VariableFont_wght", "fontSize": "30px", "stroke": "#000000" });

		// gallery_icon
		const gallery_icon = this.add.image(478, 447, "gallery");

		// resume_button
		const resume_button = this.add.rectangle(640, 362, 400, 75);
		resume_button.isStroked = true;
		resume_button.strokeColor = 15792383;
		resume_button.lineWidth = 2;

		// Resume
		const resume = this.add.text(640, 362, "", {});
		resume.name = "Resume";
		resume.setOrigin(0.5, 0.5);
		resume.text = "Continue";
		resume.setStyle({ "align": "center", "color": "#f0f8ff", "fontFamily": "PixelifySans-VariableFont_wght", "fontSize": "30px", "stroke": "#000000" });

		// resume_icon
		const resume_icon = this.add.image(478, 362, "play", 0);

		// Play_button
		const play_button = this.add.rectangle(640, 276, 400, 75);
		play_button.isStroked = true;
		play_button.strokeColor = 15792383;
		play_button.lineWidth = 2;

		// Play
		const play = this.add.text(640, 276, "", {});
		play.name = "Play";
		play.setOrigin(0.5, 0.5);
		play.text = "Play";
		play.setStyle({ "align": "center", "color": "#f0f8ff", "fontFamily": "PixelifySans-VariableFont_wght", "fontSize": "30px", "stroke": "#000000" });

		// play_icon
		const play_icon = this.add.image(478, 277, "play", 0);

		// fullscreen_icon
		const fullscreen_icon = this.add.image(1182, 98, "fullscreen", 1);
		fullscreen_icon.scaleX = 1.5;
		fullscreen_icon.scaleY = 1.5;

		// Title
		const title = this.add.image(640, 150, "title");

		// lists
		const uI = [play_button, play_icon, fullscreen_icon, gallery_icon, gallery, gallery_button, play, leaderboard_icon, leaderboard, leaderboard_button, settings_icon, resume_icon, resume, resume_button, title];
		const resume_button_items = [resume_icon, resume, resume_button];

		this.settings_icon = settings_icon;
		this.leaderboard_button = leaderboard_button;
		this.gallery_button = gallery_button;
		this.resume_button = resume_button;
		this.play_button = play_button;
		this.fullscreen_icon = fullscreen_icon;
		this.uI = uI;
		this.resume_button_items = resume_button_items;

		this.events.emit("scene-awake");
	}

	private settings_icon!: Phaser.GameObjects.Image;
	private leaderboard_button!: Phaser.GameObjects.Rectangle;
	private gallery_button!: Phaser.GameObjects.Rectangle;
	private resume_button!: Phaser.GameObjects.Rectangle;
	private play_button!: Phaser.GameObjects.Rectangle;
	private fullscreen_icon!: Phaser.GameObjects.Image;
	private uI!: Array<Phaser.GameObjects.Rectangle|Phaser.GameObjects.Image|Phaser.GameObjects.Text>;
	private resume_button_items!: Array<Phaser.GameObjects.Image|Phaser.GameObjects.Text|Phaser.GameObjects.Rectangle>;

	/* START-USER-CODE */

	// Write your code here
	private apiSession!: APISession;

	async preload() {
		this.load.pack("icons-pack", "assets/images/icons-pack.json");

        const lang = localStorage.getItem("lang") || "en";
        this.load.json("menu_i18n", `assets/i18n/${lang}/Menu.json`);
    }

	async create() {
		this.editorCreate();
		showElements(this.uI, false);

		let resume_alpha = 0.5;

        // ------- VALIDAZIONE DELLA SESSIONE -----
        this.apiSession = new APISession();
        try {
            const validation = await this.apiSession.validateSession();
            switch (validation.state) {
                case 'active':
					console.log("SESSIONE ATTIVA");
                    resume_alpha = 1;
                    break;
                case 'inactive':
                    console.log("SESSIONE INATTIVA");
                    break;
                case 'absent':
                    console.log("SESSIONE ABSENT");
                    break;
                default:
                    console.log("PALLE SUDATE");
                    break;

            }
        }
        catch(error){
            if(error instanceof Error) {
                console.error(error.message);
            }
            else{
                console.error("ERRORE STRANO: ", error);
            }
        }

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

					fadeElements(this.uI.filter(el => !this.resume_button_items.includes(el)), true);
					fadeElements(this.resume_button_items, true, 1000, undefined, resume_alpha);
				});
			});
		} else {
			fadeElements(this.uI.filter(el => !this.resume_button_items.includes(el)), true);
			fadeElements(this.resume_button_items, true, 1000, undefined, resume_alpha);
		}
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
				this.cameras.main.once('camerafadeoutcomplete', () => {this.scene.start("Stage1");});
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

		if(resume_alpha === 1) {
			this.resume_button.setInteractive();

			this.resume_button.on('pointerdown', () => {this.resume_button.setStrokeStyle(4, 0x00aaff);});
			this.resume_button.on('pointerup', () => {
				fadeElements(this.uI, false, 1000, () => {
					this.cameras.main.zoomTo(1.5, 1000);
					this.cameras.main.fadeOut(1000, 0, 0, 0);
					this.cameras.main.once('camerafadeoutcomplete', () => {this.scene.start("Tutorial");});
				});
			});
			this.resume_button.on('pointerover', () => {this.resume_button.setStrokeStyle(4, 0x70bcff);});
			this.resume_button.on('pointerout', () => {this.resume_button.setStrokeStyle(2, 0xf0f8ff);});
		}

		this.events.once("shutdown", () => {
        	this.cache.json.remove("menu_i18n");
    	});
	}
	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Menu;