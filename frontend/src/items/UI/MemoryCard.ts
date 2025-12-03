/*START OF COMPILED CODE */ 
class MemoryCard  extends Phaser.GameObjects.Container {

    //attributes
    private id: number;
    private code:  number = 0;
    protected isFlipped: boolean = false;
    protected isMatched: boolean = false;
    private image: Phaser.GameObjects.Image = new Phaser.GameObjects.Image(this.scene, 0, 0, 'card', 0);
    private backImage : Phaser.GameObjects.Image = new Phaser.GameObjects.Image(this.scene, 0, 0, 'card', 0);
    private dimensions: {width: number, height: number} = {width: 96, height: 128};
    public scene: Phaser.Scene;

    constructor( scene: Phaser.Scene,id:number,coords?: {x: number, y: number}) {
        super(scene,640,360);       
        this.scene = scene;
        console.log("scena padre: ", this.scene.scene.key);

        this.setPosition(coords?.x || 0, coords?.y || 0);

        this.id = id;

        this.add(this.backImage);
        this.add(this.image);
        
        this.image.setVisible(false); // Inizia con il dorso visibile
        this.backImage.setVisible(true);
        
        // Ridimensiona le immagini
        this.backImage.setDisplaySize(this.dimensions.width, this.dimensions.height);
        this.image.setDisplaySize(this.dimensions.width, this.dimensions.height);

        this.setSize(this.dimensions.width, this.dimensions.height);

        

        // Abilita l'interazione
        this.setInteractive({ useHandCursor: true })
            .on('pointerup', () => {
                // Emetti un evento personalizzato quando la carta viene cliccata
                this.scene.events.emit('card-clicked', this);
            });
    }

    public flip(): void {

        //TODO fare l'animazione per girare la carta

        this.backImage.setVisible(this.isFlipped);
        this.image.setVisible(!this.isFlipped);

        this.isFlipped = !this.isFlipped;
    }

    public getCode(): number {
        return this.code;
    }

    public getId(): number {
        return this.id;
    }

    public getImg(): Phaser.GameObjects.Image {
        return this.image;
    }


    public isSister(card: MemoryCard): boolean{
        if(this.id != card.getId()){
            return this.code === card.getCode();
        }
        return false;
    }

    public setCode(code: number): void {
        this.code = code;

        // Rimuovi l'immagine vecchia dal container
        this.remove(this.image);
        this.image.destroy();
        
        // Crea una nuova immagine e aggiungila al container
        this.image = new Phaser.GameObjects.Image(this.scene, 0, 0, 'card', this.code);
        console.log("Setting image", this.image, " found at ", this.image.texture.key, " frame ", this.image.frame.name);
        this.add(this.image);
        this.image.setDisplaySize(this.dimensions.width, this.dimensions.height);
        this.image.setVisible(false); // Mantieni il dorso visibile finché non viene girata
    }

}

export default MemoryCard;