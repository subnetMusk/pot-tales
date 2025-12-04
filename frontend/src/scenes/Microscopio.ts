import { i } from "vite/dist/node/types.d-aGj9QkWt";
import PopupManager from "../items/UI/PopupManager";
// You can write more code here

/* START OF COMPILED CODE */

class GraficoGame extends Phaser.Scene {

    constructor() {
        super("Microscopio");

        /* START-USER-CTR-CODE */

        /* END-USER-CTR-CODE */
    }

    editorCreate(): void {
        const background = this.add.rectangle(640, 360, 1280, 720, 0xf5f5f0);
        background.setOrigin(0.5, 0.5);
        background.setDepth(1);

        // Divisione schermo: 2/3 sopra, 1/3 sotto
        const topHeight = 720 * (2/3); // 480px
        const bottomHeight = 720 * (1/3); // 240px
        const rightWidth = 1280 * (1/5); // larghezza blocco dx

        
        const topRectangle = this.add.rectangle(640, topHeight / 2, 1280, topHeight, 0xcccccc);
        topRectangle.setOrigin(0.5, 0.5);
        topRectangle.setDepth(2);
        
        const bottomRectangle = this.add.rectangle(640, topHeight + (bottomHeight / 2), 1280, bottomHeight, 0x999999);
        bottomRectangle.setOrigin(0.5, 0.5);
        bottomRectangle.setDepth(2);

        // Blocco destro: posizionato al bordo destro (x = 1280 con origin = 1)
        const rightRectangle = this.add.rectangle(1280, 360, rightWidth, 720, 0xaaaaaa);
        rightRectangle.setOrigin(1, 0.5);
        rightRectangle.setDepth(2);

        this.events.emit("scene-awake");
    }

    /* START-USER-CODE */

    private popup!: PopupManager;
    private rectangle_1!: Phaser.GameObjects.Rectangle;


    // Write your code here

    create() {

        this.editorCreate();

        const risposte:{text : string}[] = [
            { text: "Risposta 1" },
            { text: "Risposta 2" },
            { text: "Risposta 3" },
            { text: "Risposta 4" }
        ];

        console.log("dentro a microscopio game");

        this.popup = new PopupManager(this);


        //popup per spiegare il gioco 

        this.popup.queuePopup("Benvenuto nel gioco del grafico!,In questo gioco, dovrai trovare i materiali più usati, rappresentati dai picchi del grafico.");
        this.popup.queuePopup("premi il tasto 'invio' per avviare la scansione, e premi 'spazio' quando la barra si trova sul picco maggiore");
        this.popup.showNextPopup();
    

    }

    /* END-USER-CODE */
}

/* END OF COMPILED CODE */
export default GraficoGame;
// You can write more code here
