
// You can write more code here

/* START OF COMPILED CODE */

class OggettoInterattivo extends Phaser.GameObjects.Sprite {

	constructor(scene: Phaser.Scene, x?: number, y?: number, texture?: string, frame?: number | string) {
		super(scene, x ?? 0, y ?? 0, texture || "default", frame);

		/* START-USER-CTR-CODE */
        /* END-USER-CTR-CODE */
	}

	public id_ogg: number = 0;
	public categoria: string = "";
	public number: number = 1;
	public interagisci!: () => void;
    public set : boolean = true;

	/* START-USER-CODE */

	public setImg(img: string) {
        this.setTexture(img);
    }

    public getId(): number {
        return this.id_ogg;
    }

    public getCategoria(): string {
        return this.categoria;
    }

    public getNumero(): number {
        return this.number;
    }   

    public setVisible(value: boolean): this {
        this.setVisible(value);
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