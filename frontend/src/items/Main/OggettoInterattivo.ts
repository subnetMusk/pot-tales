class OggettoInterattivo  extends Phaser.GameObjects.Container{

    private ogg: Phaser.GameObjects.Sprite;
    private id: number;
    private categoria: string;
    private numero: number;

    constructor(scene: Phaser.Scene, x?: number, y?: number , id?: number, categoria?: string, numero?: number) {
        super(scene, x ?? 0, y ?? 0);
        this.id = id ?? 0;
        this.categoria = categoria ?? "";
        this.numero = numero ?? 1;

        //creo un oggetto 
        const ogg = scene.add.sprite(0, 0, "oggetto_interattivo");
        this.add(ogg);
        this.ogg = ogg;
        this.ogg.setDepth(100);
        console.log("Creando OggettoInterattivo con id:", this.id, "categoria:", this.categoria, "numero:", this.numero);
        
    }

    /* START-USER-CTR-CODE */
    
    public setImg(img: string) {
        this.ogg.setTexture(img);
    }

    public getId(): number {
        return this.id;
    }

    public getCategoria(): string {
        return this.categoria;
    }

    public getNumero(): number {
        return this.numero;
    }   

    public setVisible(value: boolean): this {
        this.ogg.setVisible(value);
        return this;
    }

    /* END-USER-CTR-CODE */
    }
export default OggettoInterattivo;