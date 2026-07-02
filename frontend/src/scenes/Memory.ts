import { Sleeping } from "matter";
import MemoryCard from "../items/UI/MemoryCard";
import { applyTranslations } from "../utils";
// You can write more code here

/* START OF COMPILED CODE */

class Memory extends Phaser.Scene {

	constructor() {
		super("Memory");

		/* START-USER-CTR-CODE */

		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

		// sfondo_memory
		const sfondo_memory = this.add.rectangle(640, 360, 1280, 720);
		sfondo_memory.alpha = 0.3;
		sfondo_memory.isFilled = true;
		sfondo_memory.fillColor = 0;

		this.events.emit("scene-awake");
	}

	/* START-USER-CODE */
	private cards: MemoryCard[] = [];

	// Write your code here

	preload() {
		const lang = localStorage.getItem("lang") || "en";
		this.load.json("memory_i18n", `assets/i18n/${lang}/Memory.json`);
	}

	create() {

		this.editorCreate();

		// Applicazione delle traduzioni
		const i18n = this.cache.json.get("memory_i18n");
		applyTranslations(this, i18n);

		const numCards = 24; 						// Numero totale di carte nel gioco
		// Enum con i numeri delle carte
		const cardData: { code: number }[] = [
			{ code: 1 },
			{ code: 2 },
			{ code: 3 },
			{ code: 4 },
			{ code: 5 },
			{ code: 6 },
			{ code: 7 },
			{ code: 8 },
			{ code: 9 },
			{ code: 10 },
			{ code: 11 },
			{ code: 12 }
		];

		let carteGirate: MemoryCard[] = [];
		let coppieTrovate: number = 0;



		//creo le 24 carte e posiziono 


		//TODO sistemare coordinate e spaziatura carte 
		//coordianate iniziali 
		let x = 48+ 260;
		let y = 22.4 +104; 

		// Posiziona le carte in una griglia 4x6
		for (let i = 0; i < 4; i++) {
			x = 48+ 260; //resetto x ad ogni riga
			for (let j = 0; j < numCards/4; j++) {
				const card = new MemoryCard( this, i * 4 + j, { x, y });
				this.cards.push(card);
				this.add.existing(card); // Aggiungi il container della carta alla scena
				x += 148;
			}
			y += 156;
		}

		// genera un array con valori unici
		let randomArray: number[] = Phaser.Utils.Array.Shuffle([0, 1, 2, 3, 4, 5, 6, 7,8,9,10,11]);

		//assegno le immagini alle prime 12 carte
		for (let i = 0; i < numCards/2; i++) {
			this.cards[i].setCode (cardData[randomArray[i]].code);
		}

		//rimischia 
		let randomArray1 = Phaser.Utils.Array.Shuffle(randomArray);

		//creo le coppie assegnando le stesse immagini alle carte da 8 a 15
		// Le coppie sono nelle stesse posizioni dell'array (0-7)
		for (let i = 0; i < numCards/2; i++) {
			this.cards[12 + i].setCode(cardData[randomArray[i]].code);
		}


		// Listener per i click sulle carte
		this.events.on('card-clicked', (card: MemoryCard) => {

		//TODO inserire suono di click carta

		//this.sound.play('card_click');

		if(carteGirate.length == 0 ){
			//aggiungo la carta corrente
			carteGirate.push(card);
			carteGirate[0].flip(); // Gira la carta
		}
		else if(carteGirate.length == 1 && !carteGirate.includes(card)){
			//controllo se sono coppie
			carteGirate.push(card);
			carteGirate[1].flip(); // Gira la carta

			//delay per mostrare la seconda carta girata
			this.time.delayedCall(1000, () => {
				if(this.cards[carteGirate[0].getId()].isSister(card)){
					const i18n = this.cache.json.get("memory_i18n");
					console.log(i18n.pair_found);

					//TODO sistemare l'effetto provvisorio fatto da copilot
					const cardX = (carteGirate[0].x + carteGirate[1].x) / 2;
					const cardY = (carteGirate[0].y + carteGirate[1].y) / 2;

					//effetto quando giri carte uguali
					for (let i = 0; i < numCards/2; i++) {
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
					if(coppieTrovate === numCards/2){
						const i18n = this.cache.json.get("memory_i18n");
						console.log(i18n.victory);

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
					const i18n = this.cache.json.get("memory_i18n");
					console.log(i18n.not_match);
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

