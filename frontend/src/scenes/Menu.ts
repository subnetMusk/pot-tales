import { applyTranslations } from "../utils";
import { showElements } from "../utils";
import { fadeElements } from "../utils";
import { setupPixelButton } from "../utils";
import MenuBackground from "../items/UI/MenuBackground";
import { soundManager } from "../audio/SoundManager";

import {APISession, CreateSessionRequest} from "@/network/APISession";
import {hasAnalyticsConsent} from "@/privacy/consent";

// You can write more code here

// Scene registrate raggiungibili tramite Resume (vedi Preload.ts). Un scene_id salvato
// che non è in questo elenco (es. valore di default legacy, o scena non più esistente)
// fa cadere il Resume su Stage1 invece di crashare su scene.start di una chiave ignota.
const RESUMABLE_SCENES = ["Stage1", "Stage2", "Stage3"];

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
		settings_icon.scaleX = 2;
		settings_icon.scaleY = 2;

		// Gallery_button
		const gallery_button = this.add.rectangle(640, 520, 400, 75);
		gallery_button.isStroked = true;
		gallery_button.strokeColor = 15792383;
		gallery_button.lineWidth = 2;

		// Gallery
		const gallery = this.add.text(640, 520, "", {});
		gallery.name = "Gallery";
		gallery.setOrigin(0.5, 0.5);
		gallery.text = "Gallery";
		gallery.setStyle({ "align": "center", "color": "#f0f8ff", "fontFamily": "PixelifySans-VariableFont_wght", "fontSize": "30px", "stroke": "#000000" });

		// gallery_icon
		const gallery_icon = this.add.image(478, 520, "gallery");
		gallery_icon.scaleX = 2;
		gallery_icon.scaleY = 2;

		// resume_button
		const resume_button = this.add.rectangle(640, 420, 400, 75);
		resume_button.isStroked = true;
		resume_button.strokeColor = 15792383;
		resume_button.lineWidth = 2;

		// Resume
		const resume = this.add.text(640, 420, "", {});
		resume.name = "Resume";
		resume.setOrigin(0.5, 0.5);
		resume.text = "Continue";
		resume.setStyle({ "align": "center", "color": "#f0f8ff", "fontFamily": "PixelifySans-VariableFont_wght", "fontSize": "30px", "stroke": "#000000" });

		// resume_icon
		const resume_icon = this.add.image(478, 420, "continue");
		resume_icon.scaleX = 2;
		resume_icon.scaleY = 2;

		// Play_button
		const play_button = this.add.rectangle(640, 320, 400, 75);
		play_button.isStroked = true;
		play_button.strokeColor = 15792383;
		play_button.lineWidth = 2;

		// Play
		const play = this.add.text(640, 320, "", {});
		play.name = "Play";
		play.setOrigin(0.5, 0.5);
		play.text = "Play";
		play.setStyle({ "align": "center", "color": "#f0f8ff", "fontFamily": "PixelifySans-VariableFont_wght", "fontSize": "30px", "stroke": "#000000" });

		// play_icon
		const play_icon = this.add.image(478, 320, "play", 0);
		play_icon.scaleX = 2;
		play_icon.scaleY = 2;

		// fullscreen_icon
		const fullscreen_icon = this.add.image(1182, 98, "fullscreen", 1);
		fullscreen_icon.scaleX = 1.5;
		fullscreen_icon.scaleY = 1.5;

		// Title
		const title = this.add.image(640, 150, "title");
		title.scaleX = 2;
		title.scaleY = 2;

		// Demo
		const demo = this.add.text(316, 680, "", {});
		demo.name = "Demo";
		demo.setOrigin(0.5, 0.5);
		demo.text = "";
		demo.setStyle({ "color": "#f0f8ff", "fixedWidth": 500, "fontFamily": "PixelifySans-VariableFont_wght", "fontSize": "30px", "stroke": "#000000" });

		// lists
		const uI = [play_button, play_icon, fullscreen_icon, gallery_icon, gallery, gallery_button, play, settings_icon, resume_icon, resume, resume_button, title, demo];
		const resume_button_items = [resume_icon, resume, resume_button];

		this.settings_icon = settings_icon;
		this.gallery_button = gallery_button;
		this.resume_button = resume_button;
		this.play_button = play_button;
		this.fullscreen_icon = fullscreen_icon;
		this.demo = demo;
		this.uI = uI;
		this.resume_button_items = resume_button_items;

		this.events.emit("scene-awake");
	}

	private settings_icon!: Phaser.GameObjects.Image;
	private gallery_button!: Phaser.GameObjects.Rectangle;
	private resume_button!: Phaser.GameObjects.Rectangle;
	private play_button!: Phaser.GameObjects.Rectangle;
	private fullscreen_icon!: Phaser.GameObjects.Image;
	private demo!: Phaser.GameObjects.Text;
	private uI!: Array<Phaser.GameObjects.Rectangle|Phaser.GameObjects.Image|Phaser.GameObjects.Text>;
	private resume_button_items!: Array<Phaser.GameObjects.Image|Phaser.GameObjects.Text|Phaser.GameObjects.Rectangle>;

	/* START-USER-CODE */

	// Write your code here
	private apiSession!: APISession;
	private resumeData?: { sceneId: string; x?: number; y?: number; checkpoints?: string[] };
	private hasExistingSession = false;
	private isStartingGame = false;

	// L'icona di ogni bottone (play_icon, gallery_icon, ...) non è esposta come campo di
	// classe da editorCreate() e non ha un .name assegnato, quindi va cercata dentro a
	// `uI` per posizione: le icone dei bottoni stanno tutte nella colonna x=478, alla
	// stessa y (± qualche px) del rettangolo del bottone corrispondente.
	private findButtonIcon(rect: Phaser.GameObjects.Rectangle): Phaser.GameObjects.Image | undefined {
		return this.uI.find((obj): obj is Phaser.GameObjects.Image =>
			obj instanceof Phaser.GameObjects.Image && Math.abs(obj.x - 478) < 10 && Math.abs(obj.y - rect.y) < 10
		);
	}

	private setupMenuButton(rect: Phaser.GameObjects.Rectangle, textName: string, hoverColor: number) {
		const text = this.children.getByName(textName) as Phaser.GameObjects.Text | null;
		const icon = this.findButtonIcon(rect);
		return setupPixelButton(this, rect, { fillColor: 0x2b2b3d, hoverColor, text, icon });
	}

	async preload() {
		this.load.pack("icons-pack", "assets/images/icons-pack.json");

        const lang = localStorage.getItem("lang") || "en";
        this.load.json("menu_i18n", `assets/i18n/${lang}/Menu.json`);
    }

	async create() {
		this.editorCreate();
		// Le istanze delle scene Phaser vengono riutilizzate: non conservare lo
		// stato di validazione di una precedente apertura del menu.
		this.hasExistingSession = false;
		this.resumeData = undefined;
		this.isStartingGame = false;

		// Sostituisce il bordo piatto dei bottoni con un pannello "8-bit" (bordo spesso +
		// ombra + highlight, stesso linguaggio visivo del box-shadow stack di style.css).
		// Il rettangolo editor-generato resta come hit-area invisibile.
		const playPanel = this.setupMenuButton(this.play_button, "Play", 0xf98170);
		const galleryPanel = this.setupMenuButton(this.gallery_button, "Gallery", 0x8fd3f1);
		const resumePanel = this.setupMenuButton(this.resume_button, "Resume", 0x83f772);

		// Aggiunge i nuovi pannelli agli stessi gruppi di fade-in/out usati dagli altri
		// elementi UI, così appaiono/scompaiono in sincrono col resto del menu.
		(this.uI as unknown as Phaser.GameObjects.GameObject[]).push(playPanel.graphics, galleryPanel.graphics, resumePanel.graphics);
		(this.resume_button_items as unknown as Phaser.GameObjects.GameObject[]).push(resumePanel.graphics);

		showElements(this.uI, false);

		let resume_alpha = 0.5;

        // ------- VALIDAZIONE DELLA SESSIONE -----
        this.apiSession = new APISession();
        try {
            const validation = await this.apiSession.validateSession();
            switch (validation.state) {
                case 'active':
					console.log("SESSIONE ATTIVA");
					this.hasExistingSession = true;

					try {
						const position = await this.apiSession.getPosition();
						this.resumeData = {
							sceneId: position.scene_id,
							// parseFloat(undefined) darebbe NaN, che passerebbe il
							// controllo di esistenza nelle scene e finirebbe in
							// setPosition: l'assenza va propagata come tale.
							x: position.x !== undefined ? parseFloat(position.x) : undefined,
							y: position.y !== undefined ? parseFloat(position.y) : undefined,
							checkpoints: position.checkpoints,
						};
						resume_alpha = 1;
					} catch (error) {
						console.error("Recupero della posizione salvata fallito:", error);
					}
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

					fadeElements(this.uI, true);
					fadeElements(this.resume_button_items, true, 1000, undefined, resume_alpha);
					soundManager.playMusic(this, "menu_theme");
				});
			});
		} else {
			fadeElements(this.uI.filter(el => !this.resume_button_items.includes(el)), true);
			fadeElements(this.resume_button_items, true, 1000, undefined, resume_alpha);
			soundManager.playMusic(this, "menu_theme");
		}

		// Apply translations
        const i18n = this.cache.json.get("menu_i18n");
        applyTranslations(this, i18n);
		// Set demo text based on session state
		const gameFinished = localStorage.getItem("gameFinished") === "true";
		let demoText = "1.0";
		if (gameFinished) {
			demoText = i18n['ThanksForPlaying'] || "Thanks for playing the game!";
			localStorage.removeItem("gameFinished");
		}
		this.demo.setText(demoText);

		// add click events
		this.play_button.setInteractive();
		this.gallery_button.setInteractive();
		this.settings_icon.setInteractive();
		this.fullscreen_icon.setInteractive();

		// Piccolo tween di scala per dare feedback tattile alle icone (settings/fullscreen).
		// Le icone hanno già uno scale base (2x/1.5x) impostato in editorCreate: il fattore
		// va applicato relativo a quello, non sovrascritto.
		const settingsBaseScale = this.settings_icon.scaleX;
		const fullscreenBaseScale = this.fullscreen_icon.scaleX;
		const tweenIconScale = (icon: Phaser.GameObjects.Image, baseScale: number, factor: number) => {
			this.tweens.add({ targets: icon, scale: baseScale * factor, duration: 90, ease: 'Sine.easeOut' });
		};

		// play_button/gallery_button/resume_button pointerdown feedback ora gestito da setupPixelButton()
		this.settings_icon.on('pointerdown', () => {this.settings_icon.setTint(0xbdbdbd); tweenIconScale(this.settings_icon, settingsBaseScale, 0.9);});
		this.fullscreen_icon.on('pointerdown', () => {this.fullscreen_icon.setTint(0xbdbdbd); tweenIconScale(this.fullscreen_icon, fullscreenBaseScale, 0.9);});

		this.play_button.on('pointerup', () => {
			// Difesa esplicita dal reingresso oltre a disableInteractive: protegge
			// anche da callback gia' accodati nello stesso evento Phaser.
			if (this.isStartingGame) return;
			this.isStartingGame = true;
			this.play_button.disableInteractive();
			fadeElements(this.uI, false, 1000, () => {
				this.cameras.main.zoomTo(1.5, 1000);
				this.cameras.main.fadeOut(1000, 0, 0, 0);
				this.cameras.main.once('camerafadeoutcomplete', async () => {
					// "Play" apre sempre una nuova partita. Se esiste una sessione precedente,
					// il reset ne registra l'uscita prima che il nuovo cookie la sostituisca.
					if (this.hasExistingSession) {
						try {
							await this.apiSession.resetProgress();
						} catch (error) {
							console.error("Reset dei progressi fallito:", error);
						}
					}

					const requestData: CreateSessionRequest = {
						consentGiven: hasAnalyticsConsent(),
						device: navigator.userAgent.substring(0, 1024)
					};

					try {
						await this.apiSession.createSession(requestData);
						// Il checkpoint rende subito la sessione "usata" (estendendone il TTL)
						// e misura l'avvio reale senza confonderlo col completamento di Stage 1.
						await this.apiSession.saveCheckpoint("game_started");
					} catch (error) {
						console.error("Avvio della sessione di gioco fallito:", error);
					}

					soundManager.stopMusic("menu_theme");
					this.scene.start("Stage1");
				});
			});
		});
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
		// play_button/gallery_button/resume_button hover feedback ora gestito da setupPixelButton()

		this.settings_icon.on('pointerover', () => {this.settings_icon.setTint(0xbababa); tweenIconScale(this.settings_icon, settingsBaseScale, 1.15);});
		this.settings_icon.on('pointerout', () => {this.settings_icon.clearTint(); tweenIconScale(this.settings_icon, settingsBaseScale, 1);});

		this.fullscreen_icon.on('pointerover', () => {this.fullscreen_icon.setTint(0xbababa); tweenIconScale(this.fullscreen_icon, fullscreenBaseScale, 1.15);});
		this.fullscreen_icon.on('pointerout', () => {this.fullscreen_icon.clearTint(); tweenIconScale(this.fullscreen_icon, fullscreenBaseScale, 1);});

		if(resume_alpha === 1) {
			this.resume_button.setInteractive();

			// resume_button hover/press feedback ora gestito da setupPixelButton()
			this.resume_button.on('pointerup', () => {
				// Stessa guardia di Play, condivisa: un doppio click avvierebbe la
				// scena due volte, e Play dopo Continue azzererebbe la partita ripresa.
				if (this.isStartingGame) return;
				this.isStartingGame = true;
				this.resume_button.disableInteractive();
				fadeElements(this.uI, false, 1000, () => {
					this.cameras.main.zoomTo(1.5, 1000);
					this.cameras.main.fadeOut(1000, 0, 0, 0);
					this.cameras.main.once('camerafadeoutcomplete', () => {
						const target = this.resumeData && RESUMABLE_SCENES.includes(this.resumeData.sceneId)
							? this.resumeData.sceneId
							: "Stage1";
						soundManager.stopMusic("menu_theme");
						this.scene.start(target, {
							x: this.resumeData?.x,
							y: this.resumeData?.y,
							checkpoints: this.resumeData?.checkpoints,
						});
					});
				});
			});
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
