
// You can write more code here

/* START OF COMPILED CODE */

class Player extends Phaser.GameObjects.Container {

	constructor(scene: Phaser.Scene, x?: number, y?: number) {
		super(scene, x ?? 13, y ?? 8);

		// player
		const player = scene.physics.add.sprite(0, 0, "frontPlayer_L");
		player.body.setSize(16, 16, false);
		this.add(player);

		// darkMask
		const darkMask = scene.add.image(0, 0, "darkMask");
		darkMask.scaleX = 0.25;
		darkMask.scaleY = 0.25;
		this.add(darkMask);

		this.player = player;
		this.darkMask = darkMask;

		/* START-USER-CTR-CODE */
		// Write your code here.

		if (this.scene.input && this.scene.input.keyboard) {
			this.rightKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
			this.downKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
			this.upKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
			this.leftKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
		}

		this.scene.events.on('update', this.movePlayer, this);
		/* END-USER-CTR-CODE */
	}

	public player: Phaser.Physics.Arcade.Sprite;
	private darkMask: Phaser.GameObjects.Image;

	/* START-USER-CODE */

	private speed: number = 50;
	private rightKey!: Phaser.Input.Keyboard.Key;
	private downKey!: Phaser.Input.Keyboard.Key;
	private upKey!: Phaser.Input.Keyboard.Key;
	private leftKey!: Phaser.Input.Keyboard.Key;

	// Write your code here.
	
	// Metodi per controllare la darkMask
	public showDarkMask(): void {
		this.darkMask.setVisible(true);
	}
	
	public hideDarkMask(): void {
		this.darkMask.setVisible(false);
	}
	
	public toggleDarkMask(): void {
		this.darkMask.setVisible(!this.darkMask.visible);
	}
	
	public isDarkMaskVisible(): boolean {
		return this.darkMask.visible;
	}
	
	// Metodo per cambiare l'opacità della darkMask
	public setDarkMaskAlpha(alpha: number): void {
		this.darkMask.setAlpha(alpha);
	}
	
	private movePlayer() {
		if(this.player.body !== null) {
			var speed = this.speed;

			var verical_movement = (this.downKey.isDown && this.upKey.isUp) || (this.downKey.isUp && this.upKey.isDown)
			var horizontal_movement = (this.rightKey.isDown && this.leftKey.isUp) || (this.rightKey.isUp && this.leftKey.isDown)

			if(verical_movement && horizontal_movement) speed = this.speed / Math.sqrt(2)

			// TODO: include animations for the player
			if(verical_movement) {
				if(this.downKey.isDown){
					this.player.body.velocity.y = speed
					// this.player.play("player_move_down", true);
				} else{
					this.player.body.velocity.y = -speed
					// this.player.play("player_move_up", true);
				}
			} else {
				this.player.body.velocity.y = 0
			}

			if(horizontal_movement) {
				if(this.rightKey.isDown){
					this.player.body.velocity.x = speed
					if(this.player.flipX) this.player.flipX = false;
					// this.player.play("player_move_side", true);
				} else{
					this.player.body.velocity.x = -speed
					if(!this.player.flipX) this.player.flipX = true;
					// this.player.play("player_move_side", true);
				}
			} else {
				this.player.body.velocity.x = 0;
			}

			if(!verical_movement && !horizontal_movement) this.player.stop();

			this.darkMask.x = this.player.x;
			this.darkMask.y = this.player.y;

			console.log("Sprite position: ", this.player.x, this.player.y);
			console.log("Container position: ", this.x, this.y);
			console.log("Camera position: ", this.scene.cameras.main.scrollX, this.scene.cameras.main.scrollY);
		}
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Player;