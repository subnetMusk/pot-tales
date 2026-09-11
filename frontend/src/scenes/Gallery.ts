
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
	private imageViewer?: Phaser.GameObjects.Image;
	private galleryElements: Array<Phaser.GameObjects.GameObject> = [];

	private readonly edsKey = "stage2-eds";
	private readonly xrdKey = "stage2-xrd";
	private readonly c14Key = "stage3-c14graph";

	// Write your code here

	preload() {
		// Gallery is reachable straight from the Menu, without ever visiting Stage2/Stage3
		// (which normally load these textures) — load them directly here too so the cards always
		// have something to show. Guarded since Stage2's/Stage3's own load may already have
		// populated them.
		if (!this.textures.exists(this.edsKey)) {
			this.load.image(this.edsKey, "assets/images/backgrounds/EDS.png");
		}
		if (!this.textures.exists(this.xrdKey)) {
			this.load.image(this.xrdKey, "assets/images/backgrounds/XRD.png");
		}
		if (!this.textures.exists(this.c14Key)) {
			this.load.image(this.c14Key, "assets/images/ui/c14_graph.png");
		}
	}

	create() {
		this.editorCreate();
		this.galleryElements = [];
		this.setupVideoElements();
		this.setupImageRow();

		this.events.on("resume", () => {
			this.galleryElements = [];
			this.setupVideoElements();
			this.setupImageRow();
		});
	}

	// Card row degli scatti di analisi, allineata alle stesse colonne x della riga video
	// sottostante (210/640/1070) per coerenza visiva fra le due file.
	private setupImageRow() {
		this.setupImageElement(this.edsKey, "EDS", 300, 200);
		this.setupImageElement(this.c14Key, "C14", 640, 200);
		this.setupImageElement(this.xrdKey, "XRD", 980, 200);
	}

	private setupVideoElements() {
		const videos = [
			{ filename: "intro.mp4", x: 210, y: 480, label: "Intro" },
			{ filename: "IR.mp4", x: 640, y: 480, label: "IR" },
			{ filename: "SEM.mp4", x: 1070, y: 480, label: "SEM" }
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

			// Fill the preview with an actual frame grabbed from the video once it's ready
			this.createVideoPreviewTexture(video.filename).then(textureKey => {
				if (!this.scene.isActive() || container.scene !== this) return;

				const thumbnail = this.add.image(0, 0, textureKey);
				thumbnail.setDisplaySize(396, 296);
				container.addAt(thumbnail, 1);
			}).catch(err => console.warn(`Could not generate preview for ${video.filename}:`, err));

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
				this.tweens.add({ targets: playIcon, scale: 1.5 * 0.85, duration: 80, ease: "Sine.easeOut" });
				this.playVideo(video.filename);
			});

			previewBg.on("pointerup", () => {
				this.tweens.add({ targets: playIcon, scale: 1.5, duration: 80, ease: "Sine.easeOut" });
			});

			previewBg.on("pointerover", () => {
				previewBg.setStrokeStyle(3, 0x72d572);
				label.setColor("#72d572");
				this.tweens.add({ targets: container, scale: 1.03, duration: 100, ease: "Sine.easeOut" });
			});

			previewBg.on("pointerout", () => {
				previewBg.setStrokeStyle(2, 0xf0f8ff);
				label.setColor("#f0f8ff");
				this.tweens.add({ targets: container, scale: 1, duration: 100, ease: "Sine.easeOut" });
			});

			this.galleryElements.push(container);
		});
	}

	// EDS.png and XRD.png are static analysis images, not videos, so they get plain thumbnail
	// cards (no play icon, no video preview capture) placed above the video row. Clicking one
	// opens an enlarged view, mirroring the video cards' open/close interaction via viewImage/
	// closeImageViewer instead of playVideo/returnToGallery.
	private setupImageElement(textureKey: string, label: string, x: number, y: number) {
		const cardWidth = 260;
		const cardHeight = 140;

		const container = this.add.container(x, y);
		container.setDepth(1);

		const previewBg = this.add.rectangle(0, 0, cardWidth, cardHeight);
		previewBg.setFillStyle(0x333333);
		previewBg.setStrokeStyle(2, 0xffffff);
		previewBg.setInteractive({ useHandCursor: true });
		container.add(previewBg);

		const thumbnail = this.add.image(0, 0, textureKey);
		thumbnail.setDisplaySize(cardWidth - 4, cardHeight - 4);
		container.add(thumbnail);

		const labelText = this.add.text(0, cardHeight / 2 + 20, label, {
			fontFamily: "PixelifySans-VariableFont_wght",
			fontSize: "24px",
			color: "#f0f8ff",
			align: "center"
		});
		labelText.setOrigin(0.5, 0.5);
		container.add(labelText);

		previewBg.on("pointerover", () => {
			previewBg.setStrokeStyle(3, 0x72d572);
			labelText.setColor("#72d572");
			this.tweens.add({ targets: container, scale: 1.03, duration: 100, ease: "Sine.easeOut" });
		});

		previewBg.on("pointerout", () => {
			previewBg.setStrokeStyle(2, 0xf0f8ff);
			labelText.setColor("#f0f8ff");
			this.tweens.add({ targets: container, scale: 1, duration: 100, ease: "Sine.easeOut" });
		});

		previewBg.on("pointerup", () => this.viewImage(textureKey));

		this.galleryElements.push(container);
	}

	// Full-screen enlarged view of an analysis image: fades the gallery cards out, fades the
	// image in, and lets the player dismiss it by clicking it, pressing ESC, or the back button —
	// same dismissal surface as playVideo()/returnToGallery(), just without a VideoPlayer.
	private viewImage(textureKey: string) {
		fadeElements(this.galleryElements, false, 500);

		const image = this.add.image(640, 360, textureKey);
		image.setDepth(100);
		image.setAlpha(0);
		image.setInteractive({ useHandCursor: true });

		const maxWidth = 1100;
		const maxHeight = 600;
		const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
		image.setScale(scale);

		this.tweens.add({ targets: image, alpha: 1, duration: 300, ease: "Sine.easeOut" });

		this.imageViewer = image;
		image.on("pointerup", () => this.closeImageViewer());

		if (this.input.keyboard) {
			this.input.keyboard.off("keydown-ESC");
			this.input.keyboard.on("keydown-ESC", () => this.closeImageViewer());
		}
	}

	private closeImageViewer() {
		const image = this.imageViewer;
		if (!image) return;

		this.imageViewer = undefined;
		this.tweens.add({
			targets: image,
			alpha: 0,
			duration: 300,
			ease: "Sine.easeIn",
			onComplete: () => image.destroy()
		});

		fadeElements(this.galleryElements, true, 500);
	}

	/**
	 * Grabs a real frame from the given video file and turns it into a Phaser texture,
	 * so gallery thumbnails show an actual preview instead of a flat placeholder color.
	 * Textures are cached by filename and reused across repeat visits to the scene.
	 */
	private createVideoPreviewTexture(filename: string): Promise<string> {
		const key = `preview_${filename}`;
		if (this.textures.exists(key)) return Promise.resolve(key);

		return new Promise((resolve, reject) => {
			const videoEl = document.createElement("video");
			videoEl.muted = true;
			videoEl.playsInline = true;
			videoEl.preload = "auto";

			const cleanup = () => {
				videoEl.removeAttribute("src");
				videoEl.load();
			};

			videoEl.addEventListener("loadedmetadata", () => {
				try {
					videoEl.currentTime = Math.min(0.5, (videoEl.duration || 1) / 4);
				} catch (err) {
					cleanup();
					reject(err);
				}
			});

			videoEl.addEventListener("seeked", () => {
				const canvas = document.createElement("canvas");
				canvas.width = videoEl.videoWidth;
				canvas.height = videoEl.videoHeight;
				const ctx = canvas.getContext("2d");

				if (ctx && canvas.width > 0 && canvas.height > 0) {
					ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
					if (!this.textures.exists(key)) this.textures.addCanvas(key, canvas);
					cleanup();
					resolve(key);
				} else {
					cleanup();
					reject(new Error(`Empty video frame for ${filename}`));
				}
			}, { once: true });

			videoEl.addEventListener("error", () => {
				cleanup();
				reject(new Error(`Failed to load video preview for ${filename}`));
			});

			videoEl.src = `/assets/videos/${filename}`;
			videoEl.load();
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
			this.input.keyboard.off("keydown-ESC");
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