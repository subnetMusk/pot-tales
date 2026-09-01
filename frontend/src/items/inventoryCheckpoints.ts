import Player from "./Main/Player";

// Mappa checkpoint -> frame di player_items assegnato quando quel traguardo viene
// raggiunto per la prima volta durante il gioco normale (vedi le rispettive chiamate
// addInventoryItem() in Stage1.ts/Stage2.ts/Stage3.ts). Centralizzata qui perché il Resume
// deve poter ricostruire l'intero inventario a partire dai soli checkpoint salvati sul
// server, indipendentemente da quale stage li ha effettivamente originati — un giocatore
// che riprende in Stage3 deve avere anche gli oggetti di Stage1/Stage2 già raggiunti.
const STATIC_CHECKPOINT_FRAMES: Record<string, number> = {
	stage1_complete: 2,
	stage2_probe_activated: 3,
	stage3_lipidi_solved: 6,
	stage3_cellulosa_solved: 7,
	stage3_carbon_solved: 8,
};

// I turret di Stage2 sono in numero variabile (vedi turretCellLayout), quindi il loro
// checkpoint->frame non può essere elencato staticamente come gli altri. L'ancoraggio "$"
// esclude la variante "..._orientation|<value>" (vedi saveTurretOrientation in Stage2.ts),
// che non deve assegnare un oggetto.
const TURRET_CHECKPOINT_PATTERN = /^stage2_turret_(\d+)$/;

export function applyInventoryCheckpoints(player: Player, checkpoints: string[] | undefined): void {
	if (!checkpoints) {
		return;
	}

	for (const checkpoint of checkpoints) {
		const staticFrame = STATIC_CHECKPOINT_FRAMES[checkpoint];
		if (staticFrame !== undefined) {
			player.addInventoryItem(staticFrame);
			continue;
		}

		const turretMatch = checkpoint.match(TURRET_CHECKPOINT_PATTERN);
		if (turretMatch) {
			player.addInventoryItem(4 + Number(turretMatch[1]));
		}
	}
}
