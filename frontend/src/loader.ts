import * as Phaser from "phaser";

class Boot extends Phaser.Scene {
	constructor() {
		super("Boot");
	}
	
	preload() {
		this.load.pack("Font-pack", "assets/fonts/Pixelify_Sans/Font-pack.json");
	}

	async create() {
		localStorage.setItem("playIntro", "false");
		this.game.sound.volume = Number(localStorage.getItem("mainVolume") ?? "1");

		const { default: Preload } = await import("./scenes/Preload");
		this.scene.add("Preload", Preload, true);
		this.scene.stop("Boot");
	}
}

const game = new Phaser.Game({
	width: 1280,
	height: 720,
	backgroundColor: "#121314",
	parent: "game-container",
	scale: {
		mode: Phaser.Scale.ScaleModes.FIT,
		autoCenter: Phaser.Scale.Center.CENTER_BOTH
	},
	physics: {
		default: 'arcade',
		arcade: {}
	},
	scene: [Boot],
	pixelArt: true
});

game.scene.start("Boot");