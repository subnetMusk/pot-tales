
// You can write more code here

/* START OF COMPILED CODE */

class OggettoInterattivo extends Phaser.GameObjects.Sprite {

	constructor(scene: Phaser.Scene, x?: number, y?: number, texture?: string, frame?: number | string) {
		super(scene, x ?? 0, y ?? 0, texture || "default", frame);

		/* START-USER-CTR-CODE */
        /* END-USER-CTR-CODE */
	}

	public interagisci!: () => void;
    public set : boolean = true;

    public interactionRadius : number = 32;

	/* START-USER-CODE */

	public setImg(img: string) {
        this.setTexture(img);
    }

    public setVisible(value: boolean): this {
        super.setVisible(value);
        return this;
    }

    public destroy(fromScene?: boolean): void {
        super.destroy(fromScene);
        this.set = false;
    }

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default OggettoInterattivo;