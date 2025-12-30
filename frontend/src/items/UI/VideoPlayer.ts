// You can write more code here
import { applyTranslations } from "../../utils";
import { fadeElements } from "../../utils";
/* START OF COMPILED CODE */

class VideoPlayer extends Phaser.GameObjects.Container {

	constructor(scene: Phaser.Scene, x?: number, y?: number) {
		super(scene, x ?? 626, y ?? 318);

		// overlay
		const overlay = scene.add.rectangle(640, 360, 1280, 720);
		overlay.isFilled = true;
		overlay.fillColor = 0;
		overlay.fillAlpha = 0.5;
		this.add(overlay);

		// playButton
		const playButton = scene.add.image(640, 360, "play", 0);
		playButton.scaleX = 2;
		playButton.scaleY = 2;
		this.add(playButton);

		// skip
		const skip = scene.add.text(1149, 659, "", {});
		skip.name = "skip";
		skip.setOrigin(0.5, 0.5);
		skip.text = "Skip";
		skip.setStyle({ "align": "right", "fixedWidth": 100, "fontFamily": "PixelifySans-VariableFont_wght", "fontSize": "24px" });
		this.add(skip);

		// skipIcon
		const skipIcon = scene.add.image(1231, 659, "spacebar", 0);
		this.add(skipIcon);

		// progressBarBg
		const progressBarBg = scene.add.rectangle(640, 705, 1280, 30);
		progressBarBg.isFilled = true;
		progressBarBg.fillColor = 2236962;
		progressBarBg.fillAlpha = 0.8;
		this.add(progressBarBg);

		// progressBar
		const progressBar = scene.add.rectangle(0, 705, 0, 30);
		progressBar.isFilled = true;
		progressBar.fillColor = 10883584;
		this.add(progressBar);

		// lists
		const uI = [progressBar, progressBarBg, playButton, skip, skipIcon];

		this.playButton = playButton;
		this.skip = skip;
		this.skipIcon = skipIcon;
		this.progressBar = progressBar;
		this.uI = uI;

		/* START-USER-CTR-CODE */
        this.skipFillOverlay = this.scene.add.graphics();
        this.skipFillOverlay.setDepth(this.skipIcon.depth + 1);
        this.skipFillOverlay.setMask(new Phaser.Display.Masks.BitmapMask(this.scene, this.skipIcon));
        this.add(this.skipFillOverlay);

        const lang = localStorage.getItem("lang") || "en";
        this.scene.load.json("video_i18n", `assets/i18n/${lang}/VideoPlayer.json`);
        this.scene.load.once('filecomplete-json-video_i18n', () => {
            const i18n = this.scene.cache.json.get("video_i18n");
            if (i18n) applyTranslations(this, i18n);
        });
        this.scene.load.start();

        // --- Logica UI personalizzata ---
        this.lastPointerMove = this.scene.time.now;
        this.uiVisible = true;
        this.fadeDuration = 300;
        this.hideDelay = 2000;

        this.registerHandlers();

		/* END-USER-CTR-CODE */
	}

	private playButton: Phaser.GameObjects.Image;
	private skip: Phaser.GameObjects.Text;
	private skipIcon: Phaser.GameObjects.Image;
	private progressBar: Phaser.GameObjects.Rectangle;
	private uI: Array<Phaser.GameObjects.Rectangle|Phaser.GameObjects.Image|Phaser.GameObjects.Text>;

	/* START-USER-CODE */

	// Write your code here.
    private skipHoldStart?: number;
    private skipFillOverlay: Phaser.GameObjects.Graphics;

	private video?: Phaser.GameObjects.Video;

	private lastPointerMove: number;
    private uiVisible: boolean;
    private fadeDuration: number;
    private hideDelay: number;

    // Avvia il video
    public play(): void {
        if (this.video) {
            if (this.video.isPaused()) this.video.resume();
            else this.video.play();

            if(this.video.isPlaying()) this.playButton.setTexture("play", 1);
        }
    }

    // Metti in pausa il video
    public pause(): void {
        if (this.video) this.video.pause();
        this.playButton.setTexture("play", 0);
    }

    // Controlla se il video è in riproduzione
    public isPlaying(): boolean {
        return !!this.video && this.video.isPlaying();
    }

    /**
     * Carica un file video nel player.
     * @param filename - Il nome del file video da caricare (il video deve essere nella cartella /assets/videos/).
     * @param x - La posizione x dove posizionare il video.
     * @param y - La posizione y dove posizionare il video.
     */
    public loadVideo(filename: string, mode: string = "original", x: number = 640, y: number = 360): void {
        if (this.video)this.video.destroy();

        const videoPath = `/assets/videos/${filename}`;
        this.video = this.scene.add.video(x, y, undefined);

        this.video.loadURL(videoPath);
        if(mode !== "original") this.video.once('play', () => this.resizeVideo(mode));

        this.video.setVolume(this.scene.game.sound.volume);
		this.video.setLoop(false);
        this.addAt(this.video, 1);

        this.playButton.setTexture("play", 0);

        this.video.once('complete', () => {this.scene.events.emit('video-ended', this.video?.texture.key);});
    }

    /**
     * Ridimensiona il video in modalità preimpostate.
     * @param mode - La modalità di ridimensionamento:
     *   "original" - Imposta alla dimensione originale del video.
     *   "fit"      - Adatta il video all'area della scena, mantenendo le proporzioni, possono esserci barre nere.
     *   "fill"     - Riempi l'area della scena, può tagliare fuori sezioni del video.
     * ! Se il video non è ancora caricato (viene caricato alla chiamata di play), questa funzione non avrà effetto.
     */
    public resizeVideo(mode: string = "fill"): void {
        var width: number = this.scene.scale.width;
        var height: number = this.scene.scale.height;

        if (this.video) {
            if (mode === "original") {
                this.video.setDisplaySize(this.video.width, this.video.height);
                this.video.setPosition(640, 360);
            } else if (mode === "fit") {
                if(this.video.width > this.video.height) {
                    const scale = height / this.video.height;
                    this.video.setDisplaySize(this.video.width * scale, height);
                } else {
                    const scale = width / this.video.width;
                    this.video.setDisplaySize(width, this.video.height * scale);
                }
            } else if (mode === "fill") {
                if(this.video.width > this.video.height) {
                    const scale = width / this.video.width;
                    this.video.setDisplaySize(width, this.video.height * scale);
                } else {
                    const scale = height / this.video.height;
                    this.video.setDisplaySize(this.video.width * scale, height);
                }
            }
        }
    }

    // Event Handlers

    private updateProgressBar = () => {
        if (!this.scene || !this.video) return;

        const duration = this.video.getDuration();
        const current = this.video.getCurrentTime();
        const percent = duration > 0 ? current / duration : 0;
        this.progressBar.width = 1280 * percent;

        if (this.skipHoldStart !== undefined) {
            const held = this.scene.time.now - this.skipHoldStart;
            if (held > 2000) {
                this.video.setCurrentTime(this.video.getDuration());
            	this.pause();
                this.skipHoldStart = undefined;
                this.scene.events.emit('video-ended', this.video?.texture.key);
            } else if(this.video.isPlaying()) {
                this.skipFillOverlay.clear();
                this.skipFillOverlay.fillStyle(0xbdbdbd, 0.5);
                this.skipFillOverlay.fillRect(
                    this.skipIcon.x - this.skipIcon.displayWidth / 2,
                    this.skipIcon.y - this.skipIcon.displayHeight / 2,
                    this.skipIcon.displayWidth,
                    this.skipIcon.displayHeight * (2/5 + 1/3 * held / 2000)
                );
            }
        }
    }

    private handleSkipHoldStart = () => {
        if (!this.skipHoldStart) {
            if (!this.uiVisible) {
                fadeElements(this.uI, true, this.fadeDuration);
                this.uiVisible = true;
            }
            this.skipIcon.setTexture("spacebar", 1);
            this.skipHoldStart = this.scene.time.now;
        }
    }

    private handleSkipHoldEnd = () => {
        this.lastPointerMove = this.scene.time.now;

        this.skipFillOverlay.clear();
        this.skipIcon.setTexture("spacebar", 0);
        this.skipHoldStart = undefined;
    }

    private pointerMoveHandler = () => {
        this.lastPointerMove = this.scene.time.now;
        if (!this.uiVisible) {
            fadeElements(this.uI, true, this.fadeDuration);
            this.uiVisible = true;
        }
    };

    private updateHandler = () => {
        if (!this.scene) return;
        if (
            this.uiVisible
            && this.scene.time.now - this.lastPointerMove > this.hideDelay
            && this.skipHoldStart === undefined
        ) {
            fadeElements(this.uI, false, this.fadeDuration);
            this.uiVisible = false;
        }
    };

    private playButtonHandler = () => {
        if (this.isPlaying()) this.pause();
        else this.play();
    };

    private registerHandlers() {
        this.scene.input.on('pointermove', this.pointerMoveHandler);
        this.scene.events.on('update', this.updateHandler);

        this.playButton.setInteractive().on('pointerup', this.playButtonHandler);

        if (this.scene.input.keyboard) {
            this.scene.input.keyboard.on('keydown-SPACE', this.handleSkipHoldStart);
            this.scene.input.keyboard.on('keyup-SPACE', this.handleSkipHoldEnd);
        }

        this.skip.setInteractive().on('pointerdown', this.handleSkipHoldStart);
        this.skip.on('pointerup', this.handleSkipHoldEnd);

        this.skipIcon.setInteractive().on('pointerdown', this.handleSkipHoldStart);
        this.skipIcon.on('pointerup', this.handleSkipHoldEnd);

        this.scene.events.on('update', this.updateProgressBar, this);
    }

    private unregisterHandlers() {

        this.playButton.off('pointerup', this.playButtonHandler);

        this.skip.off('pointerdown', this.handleSkipHoldStart);
        this.skip.off('pointerup', this.handleSkipHoldEnd);

        this.skipIcon.off('pointerdown', this.handleSkipHoldStart);
        this.skipIcon.off('pointerup', this.handleSkipHoldEnd);

        if (!this.scene) return;

        this.scene.input.off('pointermove', this.pointerMoveHandler);
        this.scene.events.off('update', this.updateHandler);

        if (this.scene.input.keyboard) {
            this.scene.input.keyboard.off('keydown-SPACE', this.handleSkipHoldStart);
            this.scene.input.keyboard.off('keyup-SPACE', this.handleSkipHoldEnd);
        }

        this.scene.events.off('update', this.updateProgressBar, this);

        this.scene.cache.json.remove("video_i18n");
    }

    public override destroy(fromScene?: boolean): void {
        this.unregisterHandlers();
        if (this.video) this.video.destroy();

        super.destroy(fromScene);
    }

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default VideoPlayer;