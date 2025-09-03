
// You can write more code here
import { applyTranslations } from "../utils";
import MenuBackground from "../items/UI/MenuBackground";
import BackButton from "../items/UI/BackButton";
import VolumeBar from "../items/UI/VolumeBar";

/* START OF COMPILED CODE */

class Settings extends Phaser.Scene {

	constructor() {
		super("Settings");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

		// menuBackground
		const menuBackground = new MenuBackground(this, 520, 360);
		this.add.existing(menuBackground);

		// backButton
		const backButton = new BackButton(this, 1182, 98);
		this.add.existing(backButton);
		backButton.scaleX = 1.5;
		backButton.scaleY = 1.5;

		// sfxVolumeSlider
		const sfxVolumeSlider = new VolumeBar(this, 640, 421);
		this.add.existing(sfxVolumeSlider);
		sfxVolumeSlider.scaleX = 2;
		sfxVolumeSlider.scaleY = 2;

		// sfxVolume
		const sfxVolume = this.add.text(465, 453, "", {});
		sfxVolume.name = "sfxVolume";
		sfxVolume.setOrigin(0.5, 0.5);
		sfxVolume.text = "Effects Volume";
		sfxVolume.setStyle({ "align": "right", "fixedWidth": 300, "fontFamily": "PixelifySans-VariableFont_wght", "fontSize": "30px" });

		// musicVolumeSlider
		const musicVolumeSlider = new VolumeBar(this, 640, 346);
		this.add.existing(musicVolumeSlider);
		musicVolumeSlider.scaleX = 2;
		musicVolumeSlider.scaleY = 2;

		// musicVolume
		const musicVolume = this.add.text(465, 378, "", {});
		musicVolume.name = "musicVolume";
		musicVolume.setOrigin(0.5, 0.5);
		musicVolume.text = "Music Volume";
		musicVolume.setStyle({ "align": "right", "fixedWidth": 300, "fontFamily": "PixelifySans-VariableFont_wght", "fontSize": "30px" });

		// mainVolumeSlider
		const mainVolumeSlider = new VolumeBar(this, 640, 271);
		this.add.existing(mainVolumeSlider);
		mainVolumeSlider.scaleX = 2;
		mainVolumeSlider.scaleY = 2;

		// mainVolume
		const mainVolume = this.add.text(465, 303, "", {});
		mainVolume.name = "mainVolume";
		mainVolume.setOrigin(0.5, 0.5);
		mainVolume.text = "Main Volume";
		mainVolume.setStyle({ "align": "right", "fixedWidth": 300, "fontFamily": "PixelifySans-VariableFont_wght", "fontSize": "30px" });

		// enButton
		const enButton = this.add.rectangle(1166, 638, 150, 64);
		enButton.isStroked = true;
		enButton.strokeColor = 15792383;
		enButton.lineWidth = 2;

		// english
		const english = this.add.text(1167, 638, "", {});
		english.setOrigin(0.5, 0.5);
		english.text = "English";
		english.setStyle({ "align": "center", "fixedWidth": 128, "fontFamily": "PixelifySans-VariableFont_wght", "fontSize": "30px" });

		// itButton
		const itButton = this.add.rectangle(1006, 638, 150, 64);
		itButton.isStroked = true;
		itButton.strokeColor = 15792383;
		itButton.lineWidth = 2;

		// italian
		const italian = this.add.text(1006, 638, "", {});
		italian.setOrigin(0.5, 0.5);
		italian.text = "Italiano";
		italian.setStyle({ "align": "center", "fixedWidth": 128, "fontFamily": "PixelifySans-VariableFont_wght", "fontSize": "30px" });

		this.sfxVolumeSlider = sfxVolumeSlider;
		this.musicVolumeSlider = musicVolumeSlider;
		this.mainVolumeSlider = mainVolumeSlider;
		this.enButton = enButton;
		this.itButton = itButton;

		this.events.emit("scene-awake");
	}

	private sfxVolumeSlider!: VolumeBar;
	private musicVolumeSlider!: VolumeBar;
	private mainVolumeSlider!: VolumeBar;
	private enButton!: Phaser.GameObjects.Rectangle;
	private itButton!: Phaser.GameObjects.Rectangle;

	/* START-USER-CODE */

	// Write your code here

	preload() {
		const lang = localStorage.getItem("lang") || "en";
		this.load.json("settings_i18n", `assets/i18n/${lang}/Settings.json`);
	}

	create() {
		this.editorCreate();
		const i18n = this.cache.json.get("settings_i18n");
    	applyTranslations(this, i18n);

		switch(localStorage.getItem("lang") || "en"){
			case "en":
				this.enButton.isFilled = true;
				this.enButton.setFillStyle(0x70bcff);
				break;
			case "it":
				this.itButton.isFilled = true;
				this.itButton.setFillStyle(0x70bcff);
				break;
		}

		const mainVolumeValue = Number(localStorage.getItem("mainVolume") ?? this.game.sound.volume);
		const musicVolumeValue = Number(localStorage.getItem("musicVolume") ?? 1);
		const sfxVolumeValue = Number(localStorage.getItem("sfxVolume") ?? 1);

		this.mainVolumeSlider.init(mainVolumeValue * 10, (value: number) => {
			this.game.sound.volume = value / 10;
			localStorage.setItem("mainVolume", (value / 10).toString());
		});

		this.musicVolumeSlider.init(musicVolumeValue * 10, (value: number) => {
			localStorage.setItem("musicVolume", (value / 10).toString());
		});

		this.sfxVolumeSlider.init(sfxVolumeValue * 10, (value: number) => {
			localStorage.setItem("sfxVolume", (value / 10).toString());
		});

		this.enButton.setInteractive();
		this.itButton.setInteractive();

		this.enButton.on('pointerdown', () => { this.enButton.setStrokeStyle(4, 0x00aaff); });
		this.itButton.on('pointerdown', () => { this.itButton.setStrokeStyle(4, 0x00aaff); });

		this.enButton.on('pointerover', () => { this.enButton.setStrokeStyle(4, 0x70bcff); });
		this.itButton.on('pointerover', () => { this.itButton.setStrokeStyle(4, 0x70bcff); });

		this.enButton.on('pointerout', () => { this.enButton.setStrokeStyle(2, 0xf0f8ff); });
		this.itButton.on('pointerout', () => { this.itButton.setStrokeStyle(2, 0xf0f8ff); });


		this.enButton.on("pointerup", () => {
			if(localStorage.getItem("lang") !== "en") {
				localStorage.setItem("lang", "en");
				this.scene.restart();
			}
		});

		this.itButton.on("pointerup", () => {
			if(localStorage.getItem("lang") !== "it") {
				localStorage.setItem("lang", "it");
				this.scene.restart();
			}
		});

		this.events.once("shutdown", () => {
        	this.cache.json.remove("settings_i18n");
    	});
	}
	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Settings;