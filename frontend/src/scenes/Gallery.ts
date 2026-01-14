
// You can write more code here
import MenuBackground from "../items/UI/MenuBackground";
import BackButton from "../items/UI/BackButton";
import VideoPlayer from "../items/UI/VideoPlayer";
import { fadeElements } from "../utils";
/* START OF COMPILED CODE */

class Gallery extends Phaser.Scene {

	constructor() {
		super("Gallery");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

		// menuBackground
		const menuBackground = new MenuBackground(this, 520, 360);
		this.add.existing(menuBackground);

		// back_button
		const back_button = new BackButton(this, 1182, 98);
		this.add.existing(back_button);
		back_button.scaleX = 1.5;
		back_button.scaleY = 1.5;

		this.events.emit("scene-awake");
	}

	/* START-USER-CODE */

	private back_button!: BackButton;
	private videoPlayer?: VideoPlayer;
	private galleryElements: Array<Phaser.GameObjects.GameObject> = [];

	// Write your code here

	create() {
		this.editorCreate();
		this.setupVideoElements();
	}

	private setupVideoElements() {
		const videos = [
			{ filename: "intro.mp4", x: 320, y: 360, label: "Intro" },
			{ filename: "IR.mp4", x: 960, y: 360, label: "IR" }
		];

		videos.forEach(video => {
			const container = this.add.container(video.x, video.y);
			container.setDepth(1);

			// Create a video preview container
			const previewBg = this.add.rectangle(0, 0, 400, 300);
			previewBg.setFillStyle(0x333333);
			previewBg.setStrokeStyle(2, 0xffffff);
			previewBg.setInteractive();
			container.add(previewBg);

			// Add label text
			const label = this.add.text(0, 200, video.label, {
				fontFamily: "PixelifySans-VariableFont_wght",
				fontSize: "24px",
				color: "#f0f8ff",
				align: "center"
			});
			label.setOrigin(0.5, 0.5);
			container.add(label);

			// Add play icon
			const playIcon = this.add.image(0, 0, "play", 0);
			playIcon.setScale(1.5);
			container.add(playIcon);

			// Add click handlers
			previewBg.on("pointerdown", () => {
				this.playVideo(video.filename);
			});

			previewBg.on("pointerover", () => {
				previewBg.setStrokeStyle(3, 0x72d572);
				label.setColor("#72d572");
			});

			previewBg.on("pointerout", () => {
				previewBg.setStrokeStyle(2, 0xf0f8ff);
				label.setColor("#f0f8ff");
			});

			this.galleryElements.push(container);
		});
	}

	private async playVideo(filename: string) {
		// Hide gallery elements
		fadeElements(this.galleryElements, false, 500);

		// Create and play video
		const { default: VideoPlayerClass } = await import("../items/UI/VideoPlayer");
		this.videoPlayer = new VideoPlayerClass(this, 0, 0);
		this.add.existing(this.videoPlayer);
		this.videoPlayer.setDepth(100);

		this.videoPlayer.loadVideo(filename, "fill");
		this.videoPlayer.play();

		// Handle video end
		const videoEndHandler = () => {
			this.returnToGallery();
		};

		this.events.once("video-ended", videoEndHandler);

		// Handle keyboard escape or back button press
		if (this.input.keyboard) {
			this.input.keyboard.on("keydown-ESC", () => {
				this.events.off("video-ended", videoEndHandler);
				this.returnToGallery();
			});
		}
	}

	private returnToGallery() {
		if (this.videoPlayer) {
			fadeElements([this.videoPlayer], false, 500, () => {
				this.videoPlayer?.destroy();
				this.videoPlayer = undefined;
			});
		}

		fadeElements(this.galleryElements, true, 500);
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Gallery;