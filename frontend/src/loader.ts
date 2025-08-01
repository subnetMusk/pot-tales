import Phaser from "phaser";
import Scene1 from "./scenes/Scene_1";

class Boot extends Phaser.Scene {
	constructor() {
		super("Boot");
	}
	preload() {}
	async create() {
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
	scene: [Boot, Scene1],
	pixelArt: true
});

game.scene.start("Boot");