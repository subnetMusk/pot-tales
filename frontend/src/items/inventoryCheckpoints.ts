import Player from "./Main/Player";

// Mappa checkpoint -> frame(i) di player_items assegnati quando quel traguardo viene
// raggiunto per la prima volta durante il gioco normale (vedi le rispettive chiamate
// addInventoryItem() in Stage1.ts/Stage2.ts). Centralizzata qui perché il Resume deve poter
// ricostruire l'intero inventario a partire dai soli checkpoint salvati sul server,
// indipendentemente da quale stage li ha effettivamente originati — un giocatore che
// riprende in Stage3 deve avere anche gli oggetti di Stage1/Stage2 già raggiunti. I
// checkpoint stage3_*_solved non compaiono qui: risolvere un quiz di Stage3 non assegna più
// alcun oggetto, consuma solo quello già portato (vedi CHECKPOINT_CONSUMES sotto).
const CHECKPOINT_GRANTS: Record<string, number[]> = {
	stage1_complete: [2],
	stage2_complete: [3, 4, 5],
};

// Mappa checkpoint -> frame(i) rimossi dall'inventario quando quel traguardo viene
// raggiunto: i quiz di Stage3 "consumano" un oggetto raccolto in precedenza (vedi
// Stage3.ts runQuiz(), che chiama Player.removeInventoryItem() con lo stesso frame dal
// vivo). I checkpoint sul server sono immutabili/solo-additivi (vedi
// APISession.saveCheckpoint — non esiste un endpoint di rimozione), quindi questa
// derivazione è puramente client-side, ricalcolata da zero ad ogni resume.
const CHECKPOINT_CONSUMES: Record<string, number[]> = {
	stage3_lipidi_solved: [2],
	stage3_carbon_solved: [4],
	stage3_cellulosa_solved: [5],
};

export function applyInventoryCheckpoints(player: Player, checkpoints: string[] | undefined): void {
	if (!checkpoints) {
		return;
	}

	// Calcola prima la lista completa dei frame assegnati, poi applica le consumazioni sulla
	// stessa lista in memoria: così il resume ottiene direttamente lo stato finale invece di
	// assegnare e poi rimuovere sull'inventario reale.
	const frames: number[] = [];
	for (const checkpoint of checkpoints) {
		const granted = CHECKPOINT_GRANTS[checkpoint];
		if (granted) {
			frames.push(...granted);
		}
	}

	for (const checkpoint of checkpoints) {
		const consumed = CHECKPOINT_CONSUMES[checkpoint];
		if (!consumed) {
			continue;
		}
		for (const frame of consumed) {
			const index = frames.indexOf(frame);
			if (index !== -1) {
				frames.splice(index, 1);
			}
		}
	}

	frames.forEach(frame => player.addInventoryItem(frame));
}
