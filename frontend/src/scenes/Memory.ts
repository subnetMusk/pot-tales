import { Sleeping } from "matter";
import MemoryCard from "../items/UI/MemoryCard";
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
		const imageKey: string = 'card_front'; //immagine frontale delle carte
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

		let carteGirate: MemoryCard[] = [];
		let coppieTrovate: number = 0;



		//creo le 16 carte e posiziono 


		//TODO sistemare coordinate e spaziatura carte 
		//coordianate iniziali 
		let x = 48+ 320;
		let y = 22.4 +104; 
		
		//posiziono le carte in una griglia 4x4
		for (let i = 0; i < numCards/4; i++) {
			x = 48+ 320; //resetto x ad ogni riga
			for (let j = 0; j < 4; j++) {
				const card = new MemoryCard( this, i * 4 + j, { x, y });
				this.cards.push(card);
				this.add.existing(card); // Aggiungi il container della carta alla scena
				console.log(`Carta ${i * 4 + j} creata alle coordinate (${x}, ${y})`);
				x += 148;
			}
			y += 122.4 ;
		}

		// genera un array con valori unici
		let randomArray: number[] = Phaser.Utils.Array.Shuffle([0, 1, 2, 3, 4, 5, 6, 7]);
		console.log("randomArray:", randomArray);

		//assegno le immagini alle prime 8 carte
		for (let i = 0; i < 8; i++) {
			this.cards[i].setCode (cardData[randomArray[i]].code);
			this.cards[i].setImg (cardData[randomArray[i]].img);
		}

		//rimischia 
		let randomArray1 = Phaser.Utils.Array.Shuffle(randomArray);
		console.log("randomArray:", randomArray1);

		//creo le coppie assegnando le stesse immagini alle carte da 8 a 15
		// Le coppie sono nelle stesse posizioni dell'array (0-7)
		for (let i = 0; i < 8; i++) {
			this.cards[8 + i].setCode(cardData[randomArray[i]].code);
			this.cards[8 + i].setImg(cardData[randomArray[i]].img);
		}

		for(let i=0; i<16;i ++){
			console.log(`Carta ${i}:`, {
				code: this.cards[i].getCode(),
				id: this.cards[i].getImg()
			});
		}
		
		// Listener per i click sulle carte
		this.events.on('card-clicked', (card: MemoryCard) => {
			console.log(`Carta cliccata - ID: ${card.getId()}, Code: ${card.getCode()}`);

			
		
		if(carteGirate.length == 0 ){
			//aggiungo la carta corrente
			carteGirate.push(card);
			carteGirate[0].flip(); // Gira la carta
			console.log("carta girata");
		}
		else if(carteGirate.length == 1 && !carteGirate.includes(card)){
			//controllo se sono coppie
			carteGirate.push(card);
			carteGirate[1].flip(); // Gira la carta
			console.log("Seconda carta girata");
			
			//delay per mostrare la seconda carta girata
			this.time.delayedCall(1000, () => {
				if(this.cards[carteGirate[0].getId()].isSister(card)){
					console.log("Hai trovato una coppia!");

					//TODO sistemare l'effetto provvisorio fatto da copilot
					const cardX = (carteGirate[0].x + carteGirate[1].x) / 2;
					const cardY = (carteGirate[0].y + carteGirate[1].y) / 2;

					for (let i = 0; i < 8; i++) {
						const star = this.add.text(cardX, cardY, '⭐', { fontSize: '32px' });
						const angle = (i / 8) * Math.PI * 2;
						const velocity = {
							x: Math.cos(angle) * 150,
							y: Math.sin(angle) * 150
						};
						
						this.tweens.add({
							targets: star,
							x: cardX + Math.cos(angle) * 100,
							y: cardY + Math.sin(angle) * 100,
							alpha: 0,
							duration: 800,
							ease: 'Quad.easeOut',
							onComplete: () => star.destroy()
						});
					}

					coppieTrovate += 1;
					carteGirate[0].setVisible(false);
					carteGirate[1].setVisible(false);
					carteGirate = [];
					if(coppieTrovate === 8){
						console.log("Hai vinto il gioco!");
						
						// Fireworks effect 
						//TODO sistemare l'effetto provvisorio fatto da copilot
						const fireworksCount = 22;
						for (let f = 0; f < fireworksCount; f++) {
							this.time.delayedCall(f * 100, () => {
								const x = Phaser.Math.Between(200, 1080);
								const y = Phaser.Math.Between(100, 400);
								
								for (let i = 0; i < 16; i++) {
									const particle = this.add.text(x, y, '✨', { fontSize: '24px' });
									const angle = (i / 16) * Math.PI * 2;
									const distance = 200;
									
									this.tweens.add({
										targets: particle,
										x: x + Math.cos(angle) * distance,
										y: y + Math.sin(angle) * distance,
										alpha: 0,
										duration: 1200,
										ease: 'Quad.easeOut',
										onComplete: () => particle.destroy()
									});
								}
							});
						}

						this.cameras.main.shake(500, 0.01);
						console.log("Hai vinto!"); 
					
						
						this.time.delayedCall(3000, () => {
							// Emetti un evento di vittoria SUBITO
							this.events.emit('memory-complete');
						});
					}
				}else{
					console.log("Le carte non sono uguali.");
					carteGirate[0].flip();
					carteGirate[1].flip();
					carteGirate = [];
				}
			});
		}
		});
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */
export default Memory;
// You can write more code here

