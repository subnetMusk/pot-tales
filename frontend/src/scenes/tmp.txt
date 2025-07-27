class Scene_1 extends Phaser.Scene {

    player?: Phaser.GameObjects.Sprite;
    fondale?: Phaser.GameObjects.Image;
    lastMoveTime: number = 0;
    lastStep: boolean = false;
    lastDirection: 'front' | 'back' | 'side' = 'back';
    stepValue: number = 30;
    playerCenterX: number = 640;
    playerCenterY: number = 360;

    constructor() {
        super("Scene_1");
    }

    preload(): void {
        this.load.pack("Images", "/assets/images/Images.json");
        this.load.pack("Sprite-pack", "/assets/sprite/Sprite-pack.json");
    }

    editorCreate(): void {
        // fondale
        const fondale = this.add.image(1123, 731, "Fondale");
        fondale.scaleX = 3;
        fondale.scaleY = 3;

        // player
        const player = this.add.sprite(this.playerCenterX, this.playerCenterY, "backPlayer_S");
        player.scaleX = 4;
        player.scaleY = 4;

        this.events.emit("scene-awake");
    }

    create() {
        this.editorCreate();
        this.player = this.children.getByName('player') as Phaser.GameObjects.Sprite || undefined;
        if (!this.player) {
            this.player = this.children.list.find(obj => obj instanceof Phaser.GameObjects.Sprite) as Phaser.GameObjects.Sprite;
        }
        this.fondale = this.children.list.find(obj => obj instanceof Phaser.GameObjects.Image && obj.texture.key === 'Fondale') as Phaser.GameObjects.Image;
    }

    update(time: number) {
        if (this.player && this.fondale) {
            console.log(`Player: x=${this.player.x}, y=${this.player.y} | Fondale: x=${this.fondale.x}, y=${this.fondale.y}`);
        }
        const keyboard = this.input.keyboard;
        if (!keyboard || !this.fondale) return;
        const wKey = keyboard.addKey('W');
        const sKey = keyboard.addKey('S');
        const aKey = keyboard.addKey('A');
        const dKey = keyboard.addKey('D');
        if (!this.player) return;
        let moving = false;
        let direction: 'front' | 'back' | 'side' = this.lastDirection;
        if (wKey.isDown) {
            direction = 'front';
            moving = true;
        } else if (sKey.isDown) {
            direction = 'back';
            moving = true;
        } else if (aKey.isDown) {
            direction = 'side';
            this.player.setFlipX(false);
            moving = true;
        } else if (dKey.isDown) {
            direction = 'side';
            this.player.setFlipX(true);
            moving = true;
        }
        if (time - this.lastMoveTime > 100 && moving) {
            this.lastMoveTime = time;
            this.lastDirection = direction;
            if (direction === 'front') {
                this.fondale.y += this.stepValue;
                const step = this.lastStep ? 'R' : 'L';
                this.player.setTexture(`backPlayer_${step}`);
                this.lastStep = !this.lastStep;
            } else if (direction === 'back') {
                this.fondale.y -= this.stepValue;
                const step = this.lastStep ? 'R' : 'L';
                this.player.setTexture(`frontPlayer_${step}`);
                this.lastStep = !this.lastStep;
            } else if (direction === 'side') {
                const step = this.lastStep ? 'M' : 'S';
                this.player.setTexture(`sidePlayer_${step}`);
                this.lastStep = !this.lastStep;
                if (aKey.isDown) {
                    this.fondale.x += this.stepValue;
                }
                if (dKey.isDown) {
                    this.fondale.x -= this.stepValue;
                }
            }
        } else if (!moving) {
            // Personaggio fermo: texture stop
            if (this.lastDirection === 'front') {
                this.player.setTexture('backPlayer_S');
            } else if (this.lastDirection === 'back') {
                this.player.setTexture('frontPlayer_S');
            } else if (this.lastDirection === 'side') {
                this.player.setTexture('sidePlayer_S');
            }
        }
    }
}

/* END OF COMPILED CODE */

// You can write more code here

export default Scene_1;