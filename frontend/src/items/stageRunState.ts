// Stato "di partita" di Stage2 e Stage3: flag e contatori che devono ripartire da zero a ogni
// avvio della scena.
//
// Phaser riusa la stessa istanza di una scena a ogni scene.start(): gli inizializzatori dei
// campi di classe girano una volta sola, alla costruzione, non a ogni partita. Chi finiva il
// gioco e ripartiva da "Gioca" nella stessa scheda ritrovava stageComplete (Stage2) e
// recapShown/doorOpened/finaleStarted (Stage3) ancora a true, e restava bloccato. Le scene
// ricreano questo stato in init(), che Phaser chiama a ogni avvio.
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
