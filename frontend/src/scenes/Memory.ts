
// You can write more code here

/* START OF COMPILED CODE */

class Memory extends Phaser.Scene {
	/*START-USER-CODE */
	private cards: MemoryCard[] = [];
	/*END-USER-CODE */
	constructor() {
		super("Memory");

		/* START-USER-CTR-CODE */
		
		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

		// sfondo_memory
		const sfondo_memory = this.add.rectangle(640, 360, 640, 512);
		sfondo_memory.isFilled = true;
		sfondo_memory.fillColor = 10145483;

		this.events.emit("scene-awake");
	}

	/* START-USER-CODE */

	// Write your code here

	create() {

		this.editorCreate();
		const imageKey: string = 'card_front'; // Chiave dell'immagine frontale delle carte
		const numCards = 16; // Numero totale di carte nel gioco
		// lista di oggetti con due parametri: codice e nome immagine
		const cardData: { code: number; img: string }[] = [
			{ code: 0, img: 'img_0' },
			{ code: 1, img: 'img_01' },
			{ code: 2, img: 'img_02' },
			{ code: 3, img: 'img_03' },
			{ code: 4, img: 'img_04' },
			{ code: 5, img: 'img_05' },
			{ code: 6, img: 'img_06' },
			{ code: 7, img: 'img_07' }
		];

		// helper per ottener

		//creo le 16 carte e posiziono 

		//coordianate iniziali 
		let x = 48;
		let y = 22.4;
		
		//posiziono le carte in una griglia 4x4
		for (let i = 0; i < numCards/4; i++) {
			for (let j = 0; j < 4; j++) {
				this.cards.push(new MemoryCard(0, imageKey, this, i * 4 + j, { x, y }));
				this.add.existing(this.cards[i]);
				x += 148;
			}
			y += 122.4;
		}




	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
