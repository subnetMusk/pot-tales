import PopupManager from "../items/UI/PopupManager";
// You can write more code here

/* START OF COMPILED CODE */

class GraficoGame extends Phaser.Scene {
	/*START-USER-CODE */
	/*END-USER-CODE */
	constructor() {
		super("GraficoGame");

		/* START-USER-CTR-CODE */
		
		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

		// sfondo_grafico
		const sfondo_grafico = this.add.rectangle(640, 360, 1280, 720);
		sfondo_grafico.isFilled = true;
		sfondo_grafico.fillColor = 0;
        sfondo_grafico.alpha = 0.3;

		this.events.emit("scene-awake");
	}

	/* START-USER-CODE */
    
	private popup!: PopupManager;

	// Write your code here

	create() {

		this.editorCreate();
        this.cameras.main.setZoom(5);
        const picchi :{ x:number, y:number}[] = [
			{ x: 100, y: 200 },
			{ x: 200, y: 150 },
			{ x: 300, y: 250 },
			{ x: 400, y: 300 }
		];

        const risposte:{text : string}[] = [
            { text: "Risposta 1" },
            { text: "Risposta 2" },
            { text: "Risposta 3" },
            { text: "Risposta 4" }
        ];

        //aggiungo immagine 
        const grafico = this.add.image(640, 360, "graficoEx");
		grafico.scaleX = 0.2;
		grafico.scaleY = 0.2;
        grafico.setDepth(0); // Assicurati che sia dietro

        
        this.popup = new PopupManager(this);


        //popup per spiegare il gioco 

        this.popup.queuePopup("Benvenuto nel gioco del grafico!,In questo gioco, dovrai trovare i materiali più usati, rappresentati dai picchi del grafico.");
        this.popup.queuePopup("premi il tasto 'invio' per avviare la scansione, e ripremilo quando la barra si trova sul picco maggiore");
        this.popup.showNextPopup();

		//creo una barra di scansione 
		const barraScansione = this.add.rectangle(640, 360, 2, (grafico.height * 0.2));
		barraScansione.setFillStyle(0xff0000);
		barraScansione.setOrigin(0, 0.5);
		barraScansione.setDepth(1);
		barraScansione.setVisible(true);

		

		if (this.input.keyboard) {
			this.input.keyboard.on('keydown-ENTER', () => {
				//avvia scansione
				console.log("Scansione avviata!");


			});
		}

		
		console.log("GraficoGame scene created");
		
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */
export default GraficoGame;
// You can write more code here
