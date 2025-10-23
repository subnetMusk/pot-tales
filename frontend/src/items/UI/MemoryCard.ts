/*START OF COMPILED CODE */ 
class MemoryCard  extends Phaser.GameObjects.Container {

    //attributes
    private id: number;
    private code:  number = 0;
    protected isFlipped: boolean = false;
    protected isMatched: boolean = false;
    private image: Phaser.GameObjects.Image;
    private backImage : Phaser.GameObjects.Image;
    private dimensions: {width: number, height: number} = {width: 100, height: 150};
    public scene: Phaser.Scene;

    constructor(code: number, imageKey: string, scene: Phaser.Scene,id:number,coords?: {x: number, y: number}) {
        super(scene,640,360);
        this.code = code;
        this.scene = scene;
        this.image = new Phaser.GameObjects.Image(this.scene, 0, 0, imageKey);
        this.backImage = new Phaser.GameObjects.Image(this.scene, 0, 0, 'card_back');
        this.backImage.setActive(true);
        this.id = id;
        this.isFlipped = false;
        this.setPosition(coords?.x || 0, coords?.y || 0);
    }

    public flip(): void {

        //TODO fare l'animazione per girare la carta

        this.backImage.setVisible(!this.isFlipped);
        this.image.setVisible(this.isFlipped);

        this.isFlipped = !this.isFlipped;
    }

    public getCode(): number {
        return this.code;
    }

    public getId(): number {
        return this.id;
    }

    public isSister(code:number): boolean{
        return this.code === code;
    }

    public createCard(): void {
        this.scene.add.existing(this.backImage);
        this.scene.add.existing(this.image);


    }




}