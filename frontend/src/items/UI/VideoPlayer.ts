// You can write more code here

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
		this.add(playButton);

		// skipButton
		const skipButton = scene.add.text(1248, 694, "", {});
		skipButton.name = "skipButton";
		skipButton.text = "Skip";
		skipButton.setStyle({ "fontFamily": "PixelifySans-VariableFont_wght" });
		this.add(skipButton);

		// progressBarBg
		const progressBarBg = scene.add.rectangle(640, 715, 1280, 10);
		progressBarBg.isFilled = true;
		progressBarBg.fillColor = 2236962;
		progressBarBg.fillAlpha = 0.8;
		this.add(progressBarBg);

		// progressBar
		const progressBar = scene.add.rectangle(0, 710, 0, 10);
		progressBar.isFilled = true;
		progressBar.fillColor = 10883584;
		this.add(progressBar);

		// lists
		const uI = [progressBar, progressBarBg, playButton, skipButton];

		this.playButton = playButton;
		this.skipButton = skipButton;
		this.progressBar = progressBar;
		this.uI = uI;

		/* START-USER-CTR-CODE */
		// Write your code here.

		// --- Custom UI logic ---
		this.lastPointerMove = this.scene.time.now;
        this.uiVisible = true;
        this.fadeDuration = 300;
        this.hideDelay = 2000;

        this.scene.input.on('pointermove', () => {
            this.lastPointerMove = this.scene.time.now;
            if (!this.uiVisible) this.fadeUI(true);
        });

        this.scene.events.on('update', () => {
            if (this.uiVisible && this.scene.time.now - this.lastPointerMove > this.hideDelay && this.skipHoldStart === undefined) this.fadeUI(false);
        });

		playButton.setInteractive().on('pointerup', () => {
            if (this.isPlaying()) this.pause();
			else this.play();
        });

        // Space hold for skip
        this.scene.input.keyboard.on('keydown-SPACE', () => {
            if (!this.skipHoldStart) {
                if (!this.uiVisible) this.fadeUI(true);

                this.skipHoldStart = this.scene.time.now;
            }
        });

        this.scene.input.keyboard.on('keyup-SPACE', () => {
            this.lastPointerMove = this.scene.time.now;

			this.skipHoldStart = undefined;
        });

        // Progress bar update
        this.scene.events.on('update', this.updateProgressBar, this);

		/* END-USER-CTR-CODE */
	}

	private playButton: Phaser.GameObjects.Image;
	private skipButton: Phaser.GameObjects.Text;
	private progressBar: Phaser.GameObjects.Rectangle;
	private uI: Array<Phaser.GameObjects.Rectangle|Phaser.GameObjects.Image|Phaser.GameObjects.Text>;

	/* START-USER-CODE */

	// Write your code here.
	private skipHoldStart?: number;
	private video?: Phaser.GameObjects.Video;

	private lastPointerMove: number;
    private uiVisible: boolean;
    private fadeDuration: number;
    private hideDelay: number;

	private fadeUI(show: boolean) {
        this.uiVisible = show;
        this.uI.forEach(obj => {
            this.scene.tweens.add({
                targets: obj,
                alpha: show ? 1 : 0,
                duration: this.fadeDuration,
                ease: 'Quad.easeInOut'
            });
        });
    }

	public play(): void {
        if (this.video) {
            if (this.video.isPaused()) this.video.resume();
            else this.video.play();
        }

        this.playButton.setTexture("play", 1);
    }

    public pause(): void {
        if (this.video) this.video.pause();
        this.playButton.setTexture("play", 0);
    }

    public isPlaying(): boolean {
        return !!this.video && this.video.isPlaying();
    }

    public loadVideo(filename: string, x: number = 640, y: number = 360): void {
        if (this.video)this.video.destroy();

        const videoPath = `/assets/videos/${filename}`;
        this.video = this.scene.add.video(x, y, undefined);
        this.video.loadURL(videoPath);
		this.video.setLoop(false);
        this.addAt(this.video, 0);
        this.playButton.setTexture("play", 1);

        this.video.once('complete', () => {this.scene.events.emit('video-ended', this.video?.texture.key);});
    }

    public enableSkipButton(enable: boolean = true): void {
        this.skipButton.visible = enable;
    }

    private updateProgressBar(): void {
        if (!this.video) return;

        const duration = this.video.getDuration();
        const current = this.video.getCurrentTime();
        const percent = duration > 0 ? current / duration : 0;
        this.progressBar.width = 1280 * percent;

        // Handle skip by holding space
        if (this.skipButton.visible && this.skipHoldStart !== undefined) {
            const held = this.scene.time.now - this.skipHoldStart;
            if (held > 2000) {
                this.video.setCurrentTime(this.video.getDuration());
            	this.pause();
                this.skipHoldStart = undefined;
                this.scene.events.emit('video-ended', this.video?.texture.key);
            }
        }
    }

    public resizeVideo(width: number = 1280, height: number = 720): void {
        if (this.video) {
            this.video.setDisplaySize(width, height);
            this.video.setPosition(640, 360);
        }
    }

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default VideoPlayer;