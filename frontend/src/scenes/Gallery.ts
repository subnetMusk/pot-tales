
// You can write more code here
import MenuBackground from "../items/UI/MenuBackground";
import BackButton from "../items/UI/BackButton";
import VideoPlayer from "../items/UI/VideoPlayer";
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

		// videoPlayer
		const videoPlayer = new VideoPlayer(this, 0, 0);
		this.add.existing(videoPlayer);

		// back_button
		const back_button = new BackButton(this, 1182, 98);
		this.add.existing(back_button);
		back_button.scaleX = 1.5;
		back_button.scaleY = 1.5;

		this.videoPlayer = videoPlayer;

		this.events.emit("scene-awake");
	}

	private videoPlayer!: VideoPlayer;

	/* START-USER-CODE */

	// Write your code here

	create() {
		this.editorCreate();

		this.videoPlayer.loadVideo("meatthezoo.mp4");
		this.videoPlayer.resizeVideo();
		this.videoPlayer.play();
		this.events.on('video-ended', () => {
    		this.videoPlayer.destroy();
		});
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Gallery;