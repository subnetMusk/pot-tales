
// You can write more code here
import MenuBackground from "../items/UI/MenuBackground";
import VideoPlayer from "../items/UI/VideoPlayer";
/* START OF COMPILED CODE */

class Intro extends Phaser.Scene {

	constructor() {
		super("Intro");

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

		this.videoPlayer = videoPlayer;

		this.events.emit("scene-awake");
	}

	private videoPlayer!: VideoPlayer;

	/* START-USER-CODE */

	// Write your code here

	create() {
		this.editorCreate();

		this.videoPlayer.loadVideo("intro.mp4", "fill");
		this.videoPlayer.play();
		this.events.on('video-ended', () => {
			this.tweens.add({
				targets: this.videoPlayer,
				alpha: 0,
				duration: 1000,
				onComplete: () => {
					this.videoPlayer.destroy();
					this.scene.start("Menu");
				}
			});
		});
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Intro;