
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

		this.sfxVolumeSlider = sfxVolumeSlider;
		this.musicVolumeSlider = musicVolumeSlider;
		this.mainVolumeSlider = mainVolumeSlider;

		this.events.emit("scene-awake");
	}

	private sfxVolumeSlider!: VolumeBar;
	private musicVolumeSlider!: VolumeBar;
	private mainVolumeSlider!: VolumeBar;

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
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Settings;