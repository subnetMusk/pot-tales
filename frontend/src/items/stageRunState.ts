// Stato "di partita" del gioco: flag, contatori e dati che devono ripartire da zero a ogni
// nuova partita.
//
// Phaser riusa la stessa istanza di una scena a ogni scene.start() o launch(): gli
// inizializzatori dei campi di classe girano una volta sola, alla costruzione, non a ogni
// partita. Chi finiva il gioco e ripartiva da "Gioca" nella stessa scheda ritrovava lo stato
// della partita precedente e restava bloccato: stageComplete in Stage2,
// recapShown/doorOpened/finaleStarted in Stage3, i picchi già trovati nel minigioco dei
// grafici. Le scene ricreano questo stato a ogni avvio (Stage2 e Stage3 in init(), GraficoGame
// in create()). L'inventario invece vive nel registry del gioco, che sopravvive a tutte le
// scene: lo svuota il Menu con clearRunRegistry().
//
// Il modulo non importa Phaser, così lo si può testare con il runner di Node (vedi
// frontend/test/stageRunState.test.ts).

export interface Stage2RunState {
	laserActive: boolean;
	activeShooter: boolean;
	stageComplete: boolean;
	// Livello di difficoltà del prossimo Shooter: 1 per la sonda, poi uno in più per ogni
	// turret sbloccato (al massimo 3).
	currentShooterLevel: number;
	// Intensità del bagliore del raggio nella finale, animata da brightenBeam() fra 0 e 1.
	beamGlowBoost: number;
}

export function createStage2RunState(): Stage2RunState {
	return {
		laserActive: false,
		activeShooter: false,
		stageComplete: false,
		currentShooterLevel: 1,
		beamGlowBoost: 0
	};
}

export interface Stage3RunState {
	// Il recap va giocato una volta sola per partita.
	recapShown: boolean;
	doorOpened: boolean;
	finaleStarted: boolean;
}

export function createStage3RunState(): Stage3RunState {
	return {
		recapShown: false,
		doorOpened: false,
		finaleStarted: false
	};
}

// True se i checkpoint salvati contengono la soluzione di tutti i quiz di Stage3 indicati.
// Serve al Resume: recap e apertura della porta partono dalla risposta corretta al terzo quiz,
// quindi chi ricarica dopo averlo risolto ritroverebbe la porta chiusa senza più niente con
// cui aprirla.
export function allQuizzesSolved(checkpoints: readonly string[] | undefined, quizKeys: readonly string[]): boolean {
	if (!checkpoints || quizKeys.length === 0) {
		return false;
	}
	return quizKeys.every(key => checkpoints.includes(`stage3_${key}_solved`));
}

// Distanza dal centro della porta di Stage3 entro cui parte la cinematica finale.
// La porta aperta lascia un varco largo 18px (x 65-83) fra due arredi che arrivano fino a
// y=54. Il bound superiore del giocatore, largo 15px e alto da y-3, ci passa solo se allineato
// entro 3px; altrimenti si ferma a y=57, a 16px dal centro (74,41). Con 21 la cinematica parte
// appena il giocatore arriva all'imbocco, anche 13px fuori asse; con 15 non partiva.
export const DOOR_TRIGGER_RADIUS = 21;

export function isWithinDoorTrigger(playerX: number, playerY: number, doorX: number, doorY: number): boolean {
	return Math.hypot(playerX - doorX, playerY - doorY) < DOOR_TRIGGER_RADIUS;
}

export interface GraficoLevel {
	imageKey: string;
	picchi: { x: number; found: boolean }[];
}

// Livelli del minigioco dei grafici (GraficoGame), in sequenza: stesso numero di picchi e
// stessa difficoltà per ognuno, cambia solo il grafico (immagine e posizione dei picchi). Le x
// dei picchi per i livelli 2 e 3 sono placeholder, da tarare sulle immagini reali.
// GraficoGame segna i picchi trovati direttamente in questi oggetti, quindi ogni partita deve
// riceverne una copia nuova.
export function createGraficoLevels(): GraficoLevel[] {
	return [
		{
			imageKey: "grafico1",
			picchi: [
				{ x: 564, found: false },
				{ x: 689, found: false },
				{ x: 726, found: false }
			]
		},
		{
			imageKey: "grafico2",
			picchi: [
				{ x: 693, found: false },
				{ x: 729, found: false },
				{ x: 740, found: false }
			]
		},
		{
			imageKey: "grafico3",
			picchi: [
				{ x: 698, found: false },
				{ x: 727, found: false }
			]
		}
	];
}

// Chiave del registry del gioco sotto cui Player salva gli oggetti sbloccati. Il registry
// sopravvive a scene.start(), così un nuovo Player in Stage2 riparte con gli oggetti di Stage1.
export const INVENTORY_REGISTRY_KEY = "inventoryItems";

// Svuota lo stato di partita tenuto nel registry del gioco. Il Menu la chiama a ogni apertura,
// prima di Play o Continue: senza, la partita successiva nella stessa scheda partirebbe con gli
// oggetti di quella precedente, e il resume li aggiungerebbe una seconda volta.
export function clearRunRegistry(registry: { remove(key: string): unknown }): void {
	registry.remove(INVENTORY_REGISTRY_KEY);
}
