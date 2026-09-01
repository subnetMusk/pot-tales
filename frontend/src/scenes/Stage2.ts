
// You can write more code here
import Player from "@/items/Main/Player";
import OggettoInterattivo from "../items/Main/OggettoInterattivo";
import { traceBeam, directionAngle } from "../items/beamTracer";
import { applyTranslations, launchSubScene, playSequence, reloadTranslations } from "../utils";
import { flashBurst, sparkBurst } from "../items/ParticleFx";
import PopupManager from "../items/UI/PopupManager";
import { APISession } from "../network/APISession";
import { applyInventoryCheckpoints } from "../items/inventoryCheckpoints";

type TurretOrientation = "neutral" | "right" | "back" | "left";

type TurretMode = "locked" | "unlocked";

interface Stage2Turret extends OggettoInterattivo {
	mode: TurretMode;
	orientation: TurretOrientation;
	gridX: number;
	gridY: number;
}

// Clockwise cycle used when the player rotates an unlocked turret
const ORIENTATION_CYCLE: TurretOrientation[] = ["neutral", "right", "back", "left"];

// Indexes directly into the specchi spritesheet (0: transmitting, 1: reflecting right,
// 2: reflecting back, 3: reflecting left).
const ORIENTATION_FRAMES: Record<TurretOrientation, number> = {
	"neutral": 0,
	"right": 1,
	"back": 2,
	"left": 3
};

/* START OF COMPILED CODE */

class Stage2 extends Phaser.Scene {

	constructor() {
		super("Stage2");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

		// rectangle_1
		const rectangle_1 = this.add.rectangle(-357, 360, 30, 900);

		// rectangle
		const rectangle = this.add.rectangle(1637, 360, 30, 900);

		// rectangle_2
		const rectangle_2 = this.add.rectangle(-245, -58, 200, 50);

		// rectangle_3
		const rectangle_3 = this.add.rectangle(-96, -21, 100, 50);

		// rectangle_4
		const rectangle_4 = this.add.rectangle(-25, -37, 50, 50);

		// rectangle_5
		const rectangle_5 = this.add.rectangle(38, -6, 80, 50);

		// rectangle_6
		const rectangle_6 = this.add.rectangle(108.8771352430117, 40.323824341372905, 80, 50);

		// rectangle_7
		const rectangle_7 = this.add.rectangle(160.0849790812908, 35.97659534632849, 30, 50);

		// rectangle_8
		const rectangle_8 = this.add.rectangle(220, 16, 80, 50);

		// rectangle_9
		const rectangle_9 = this.add.rectangle(301, 58, 80, 50);

		// rectangle_10
		const rectangle_10 = this.add.rectangle(310, 203, 80, 50);

		// rectangle_11
		const rectangle_11 = this.add.rectangle(327, 176, 80, 50);

		// rectangle_12
		const rectangle_12 = this.add.rectangle(371, 153, 80, 50);

		// rectangle_13
		const rectangle_13 = this.add.rectangle(330.3005372177651, 124.95227480966511, 80, 50);

		// rectangle_14
		const rectangle_14 = this.add.rectangle(408.99533269266414, 110.74882391907357, 80, 50);

		// rectangle_15
		const rectangle_15 = this.add.rectangle(443.3249152407966, 66.43294204901053, 80, 50);

		// rectangle_16
		const rectangle_16 = this.add.rectangle(496, 35, 80, 50);

		// rectangle_17
		const rectangle_17 = this.add.rectangle(536.2710236967163, 71.16372464706494, 80, 50);

		// rectangle_18
		const rectangle_18 = this.add.rectangle(592.4938005696189, 104.3862746174165, 80, 50);

		// rectangle_19
		const rectangle_19 = this.add.rectangle(648, 83, 30, 50);

		// rectangle_20
		const rectangle_20 = this.add.rectangle(673.8206864448543, 120.775150009874, 30, 50);

		// rectangle_21
		const rectangle_21 = this.add.rectangle(652.1197487631866, 157.3954823476884, 30, 50);

		// rectangle_22
		const rectangle_22 = this.add.rectangle(343.4157082912764, 93.17307651137928, 30, 50);

		// rectangle_23
		const rectangle_23 = this.add.rectangle(709, 79, 50, 50);

		// rectangle_24
		const rectangle_24 = this.add.rectangle(818, 108, 170, 50);

		// rectangle_25
		const rectangle_25 = this.add.rectangle(999, 84, 200, 50);

		// rectangle_26
		const rectangle_26 = this.add.rectangle(1126, 94, 50, 50);

		// rectangle_27
		const rectangle_27 = this.add.rectangle(1166.953647066653, 117.1084529696947, 50, 50);

		// rectangle_28
		const rectangle_28 = this.add.rectangle(1217, 131, 50, 50);

		// rectangle_29
		const rectangle_29 = this.add.rectangle(1277, 139, 70, 50);

		// rectangle_30
		const rectangle_30 = this.add.rectangle(1361, 153, 100, 50);

		// rectangle_31
		const rectangle_31 = this.add.rectangle(1520, 193, 240, 50);

		// rectangle_32
		const rectangle_32 = this.add.rectangle(-252, 691, 200, 50);

		// rectangle_33
		const rectangle_33 = this.add.rectangle(-120, 696, 150, 50);

		// rectangle_34
		const rectangle_34 = this.add.rectangle(54, 708, 200, 50);

		// rectangle_35
		const rectangle_35 = this.add.rectangle(173, 681, 50, 50);

		// rectangle_36
		const rectangle_36 = this.add.rectangle(203, 705, 20, 50);

		// rectangle_37
		const rectangle_37 = this.add.rectangle(235, 721, 50, 50);

		// rectangle_38
		const rectangle_38 = this.add.rectangle(300, 710, 50, 50);

		// rectangle_39
		const rectangle_39 = this.add.rectangle(268, 723, 20, 50);

		// rectangle_40
		const rectangle_40 = this.add.rectangle(346, 726, 50, 50);

		// rectangle_41
		const rectangle_41 = this.add.rectangle(409, 712, 100, 50);

		// rectangle_42
		const rectangle_42 = this.add.rectangle(515, 717, 150, 50);

		// rectangle_43
		const rectangle_43 = this.add.rectangle(589, 693, 40, 50);

		// rectangle_44
		const rectangle_44 = this.add.rectangle(623, 725, 40, 50);

		// rectangle_45
		const rectangle_45 = this.add.rectangle(655.914621477785, 723.9515416542677, 40, 50);

		// rectangle_46
		const rectangle_46 = this.add.rectangle(691.5328177274537, 706.1424435294333, 40, 50);

		// rectangle_47
		const rectangle_47 = this.add.rectangle(713.9378121425679, 682.5884750417491, 40, 50);

		// rectangle_48
		const rectangle_48 = this.add.rectangle(750.7049824648066, 692.3547546585938, 40, 50);

		// rectangle_49
		const rectangle_49 = this.add.rectangle(781.7272824241954, 671.0987343160496, 40, 50);

		// rectangle_50
		const rectangle_50 = this.add.rectangle(819.643426819004, 670.5242472797646, 40, 50);

		// rectangle_51
		const rectangle_51 = this.add.rectangle(856, 710, 40, 50);

		// rectangle_52
		const rectangle_52 = this.add.rectangle(902, 701, 50, 50);

		// rectangle_53
		const rectangle_53 = this.add.rectangle(938, 675, 40, 50);

		// rectangle_54
		const rectangle_54 = this.add.rectangle(970.7935444957412, 655.5156304046988, 40, 50);

		// rectangle_55
		const rectangle_55 = this.add.rectangle(982, 613, 40, 70);

		// rectangle_56
		const rectangle_56 = this.add.rectangle(969, 705, 40, 50);

		// rectangle_57
		const rectangle_57 = this.add.rectangle(1013, 721, 40, 50);

		// rectangle_58
		const rectangle_58 = this.add.rectangle(1042, 702, 40, 50);

		// rectangle_59
		const rectangle_59 = this.add.rectangle(1068, 674, 20, 50);

		// rectangle_60
		const rectangle_60 = this.add.rectangle(1094, 712, 40, 50);

		// rectangle_61
		const rectangle_61 = this.add.rectangle(1121.0187250068852, 695.1330779108827, 40, 50);

		// rectangle_62
		const rectangle_62 = this.add.rectangle(1154.8487942264069, 698.0263712249214, 40, 50);

		// rectangle_63
		const rectangle_63 = this.add.rectangle(1174.7285772846308, 682.9324618658995, 40, 50);

		// rectangle_64
		const rectangle_64 = this.add.rectangle(1216, 670, 60, 50);

		// rectangle_65
		const rectangle_65 = this.add.rectangle(1269, 683, 60, 50);

		// rectangle_66
		const rectangle_66 = this.add.rectangle(1311, 672, 30, 50);

		// rectangle_67
		const rectangle_67 = this.add.rectangle(1345, 679, 40, 50);

		// rectangle_68
		const rectangle_68 = this.add.rectangle(1379.452641284205, 659.5472185489996, 30, 50);

		// rectangle_69
		const rectangle_69 = this.add.rectangle(1392, 699, 30, 50);

		// rectangle_70
		const rectangle_70 = this.add.rectangle(1413.1349799080285, 721.4802305271501, 30, 50);

		// rectangle_71
		const rectangle_71 = this.add.rectangle(1438, 731, 30, 50);

		// rectangle_72
		const rectangle_72 = this.add.rectangle(1472, 722, 30, 50);

		// rectangle_73
		const rectangle_73 = this.add.rectangle(1482.511612222581, 704.3478643093762, 30, 50);

		// rectangle_74
		const rectangle_74 = this.add.rectangle(1551, 689, 130, 50);

		// bg_stage2
		this.add.image(640, 360, "bg-stage2");

		// player
		const player = new Player(this, 169, 567);
		this.add.existing(player);

		// lists
		const boundaries = [rectangle_74, rectangle_73, rectangle_72, rectangle_71, rectangle_70, rectangle_69, rectangle_68, rectangle_67, rectangle_66, rectangle_65, rectangle_64, rectangle_63, rectangle_62, rectangle_61, rectangle_60, rectangle_59, rectangle_58, rectangle_57, rectangle_56, rectangle_55, rectangle_54, rectangle_53, rectangle_52, rectangle_51, rectangle_50, rectangle_49, rectangle_48, rectangle_47, rectangle_46, rectangle_45, rectangle_44, rectangle_43, rectangle_42, rectangle_41, rectangle_40, rectangle_39, rectangle_38, rectangle_37, rectangle_36, rectangle_35, rectangle_34, rectangle_33, rectangle_32, rectangle_31, rectangle_30, rectangle_29, rectangle_28, rectangle_27, rectangle_26, rectangle_25, rectangle_24, rectangle_23, rectangle_22, rectangle_21, rectangle_20, rectangle_19, rectangle_18, rectangle_17, rectangle_16, rectangle_15, rectangle_14, rectangle_13, rectangle_12, rectangle_11, rectangle_10, rectangle_9, rectangle_8, rectangle_7, rectangle_6, rectangle_5, rectangle_4, rectangle_3, rectangle_2, rectangle, rectangle_1];
		const oggVector: Array<any> = [];

		this.player = player;
		this.boundaries = boundaries;
		this.oggVector = oggVector;

		this.events.emit("scene-awake");
	}

	private player!: Player;
	private boundaries!: Phaser.GameObjects.Rectangle[];
	private oggVector!: Array<any>;

	/* START-USER-CODE */
	private i18n: Record<string, string> = {};
	private loadedLang!: string;
	private popupManager!: PopupManager;

	// Grid cells are literal screen pixels (cellSize 1, origin 0) so turrets/receiver can sit at
	// exact on-screen coordinates instead of being locked to a coarse tile lattice; traceBeam's
	// unit-step algorithm is unchanged below, it's just stepping pixel-by-pixel now.
	private readonly cellSize = 1;
	private readonly gridCols = 1280;
	private readonly gridRows = 720;
	private readonly gridOriginX = 0;
	private readonly gridOriginY = 0;
	// The probe sits where the first mirror used to be (near player spawn) and is itself the
	// beam's origin, so it replaces that mirror rather than needing one of its own.
	private readonly sourceCell = { x: 155, y: 553 };
	private readonly receiverCell = { x: 510, y: 300 };
	// Posizione fissa (pixel, non cella della griglia) dell'overlay del cratere nella finale:
	// allineata all'arte di sfondo, indipendente dalla posizione logica del receiver del laser.
	private readonly craterPosition = { x: 676, y: 341 };
	// Last frame index of the "sem_probe_activate" animation (0-40): used to restore the
	// probe to its activated end-state on Resume without replaying the whole animation.
	private readonly probeActivateLastFrame = 40;
	private readonly turretCellLayout: Array<{ x: number; y: number; orientation: TurretOrientation }> = [
		{ x: 155, y: 110, orientation: "neutral" },
		{ x: 510, y: 110, orientation: "neutral" }
	];

	private turrets: Stage2Turret[] = [];
	private probe!: OggettoInterattivo;
	private laserActive = false;
	private beamGraphics!: Phaser.GameObjects.Graphics;
	private beamPulseTween?: Phaser.Tweens.Tween;
	private beamGlowBoost = 0;
	private currentShooterLevel = 1;
	private activeShooter = false;
	private stageComplete = false;

	private apiSession!: APISession;
	private resumeData?: { x?: number; y?: number; checkpoints?: string[] };
	private pingTimer?: Phaser.Time.TimerEvent;

	// Dati di resume passati da Menu.ts via scene.start("Stage2", {...}) quando il
	// giocatore preme "Resume": posizione dell'ultimo ping e traguardi già raggiunti.
	init(data?: { x?: number; y?: number; checkpoints?: string[] }) {
		this.resumeData = data;
	}

	async preload() {
		this.load.pack("stage2-pack", "assets/images/stage2-pack.json");
		this.load.pack("player-pack", "assets/images/player-pack.json");
		this.load.pack("icons-pack", "assets/images/icons-pack.json");

		this.loadedLang = localStorage.getItem("lang") || "en";
        this.load.json("Stage2_i18n", `assets/i18n/${this.loadedLang}/Stage2.json`);
	}

	create() {

		this.editorCreate();

		// Applicazione delle traduzioni sui testi già presenti nella scena
		this.i18n = this.cache.json.get("Stage2_i18n") ?? {};
		applyTranslations(this, this.i18n);

		// (a differenza di Stage1.ts, qui i dialoghi leggono da questo campo invece che dalla cache ad
		this.events.on("resume", () => {
			const currentLang = localStorage.getItem("lang") || "en";
			if (currentLang !== this.loadedLang) {
				this.loadedLang = currentLang;
				void reloadTranslations(this, "Stage2_i18n", `assets/i18n/${currentLang}/Stage2.json`).then(i18n => {
					this.i18n = i18n;
				});
			}
		});

		this.popupManager = new PopupManager(this);
		this.apiSession = new APISession();

		// Configurazione del giocatore
		this.player.debug(false);
		this.player.setBoundaries(this.boundaries);
		this.player.setDepth(6);

		// Se arriviamo qui da un Resume, riposizioniamo il giocatore all'ultimo punto
		// pingato invece dello spawn di default.
		if (this.resumeData?.x !== undefined && this.resumeData?.y !== undefined) {
			this.player.setPosition(this.resumeData.x, this.resumeData.y);
		}

		this.player.isMovementAllowed = false;

		// Configurazione della telecamera
		this.cameras.main.setZoom(5.0);
        this.cameras.main.startFollow(this.player);

		if (!this.anims.exists("sem_probe_activate")) {
			this.anims.create({
				key: "sem_probe_activate",
				frames: this.anims.generateFrameNumbers("SEM-Probe", { start: 0, end: this.probeActivateLastFrame }),
				frameRate: 20,
				repeat: 0
			});
		}

		this.buildTurretPuzzle();
		this.applyResumeCheckpoints();

		// Ping periodico (5-10s) con la posizione corrente: mantiene aggiornato lo stato
		// autoritativo sul server per il Resume, e passa dal validatore anti-cheat.
		this.pingTimer = this.time.addEvent({ delay: 7000, loop: true, callback: () => this.sendPing() });
		this.events.once("shutdown", () => this.pingTimer?.remove());

		/* START-SCENE-LOGIC */
		this.playIntroSequence();
	}

	// Ricostruisce lo stato della scena a partire dai checkpoint opachi salvati sul server,
	// così un giocatore che riprende da qui non deve rifare i minigiochi già superati.
	private applyResumeCheckpoints() {
		const checkpoints = this.resumeData?.checkpoints;
		if (!checkpoints || checkpoints.length === 0) {
			return;
		}

		applyInventoryCheckpoints(this.player, checkpoints);

		let resumedLevel = 1;
		if (checkpoints.includes("stage2_probe_activated")) {
			// Restore the probe to its activated end-state instead of leaving it on frame 0
			// (its default creation frame) — activateLaser() never touches the probe's frame.
			this.probe.setFrame(this.probeActivateLastFrame);
			this.activateLaser({ silent: true });
			resumedLevel += 1;
		}

		for (const [index, turret] of this.turrets.entries()) {
			if (!checkpoints.includes(`stage2_turret_${index}`)) {
				continue;
			}

			turret.mode = "unlocked";
			resumedLevel = Math.min(3, resumedLevel + 1);

			// L'orientamento è l'ultima voce salvata con prefisso "..._orientation|" (vedi
			// saveTurretOrientation) — se manca, il turret resta sull'orientamento di default
			// con cui è stato creato in createTurret().
			const orientationEntries = checkpoints.filter(entry => entry.startsWith(`stage2_turret_${index}_orientation|`));
			const savedOrientation = orientationEntries[orientationEntries.length - 1]?.split("|")[1] as TurretOrientation | undefined;
			if (savedOrientation && ORIENTATION_CYCLE.includes(savedOrientation)) {
				turret.orientation = savedOrientation;
			}

			this.applyTurretStyle(turret);
		}

		// Il livello di difficoltà dello Shooter segue lo stesso ordine progressivo
		// probe -> turret 0 -> turret 1 usato durante il gioco normale (vedi activateProbe()
		// e runChallengeForTurret()): senza questo, un turret non ancora risolto dopo un
		// Resume ripartirebbe sempre dal livello 1 invece di quello raggiunto in precedenza.
		this.currentShooterLevel = resumedLevel;

		this.redrawBeam();
	}

	// Invia la posizione corrente al server; se il server rifiuta il movimento (lag/cheat)
	// o rileva un ban, allinea il client allo stato autoritativo restituito.
	private async sendPing() {
		try {
			const result = await this.apiSession.ping("Stage2", this.player.x, this.player.y);
			if (result.action === "rubberband" || result.action === "kick") {
				this.player.setPosition(parseFloat(result.x), parseFloat(result.y));
			} else if (result.action === "ban") {
				this.pingTimer?.remove();
				this.scene.start("Menu");
			}
		} catch (error) {
			console.error("Ping fallito:", error);
		}
	}

	private playIntroSequence() {
		const fadeRect = this.add.rectangle(
			this.cameras.main.centerX,
			this.cameras.main.centerY,
			this.cameras.main.width,
			this.cameras.main.height,
			0x000000
		);

		fadeRect.setScrollFactor(0);
		fadeRect.setDepth(10);

		this.tweens.add({
			targets: fadeRect,
			alpha: 0.0,
			duration: 600,
			ease: "Linear",
			onComplete: () => {
				fadeRect.destroy();
				this.player.isMovementAllowed = true;
				this.player.surprise();
			}
		});
	}

	private buildTurretPuzzle() {
		this.beamGraphics = this.add.graphics();
		this.beamGraphics.setDepth(7);

		this.probe = new OggettoInterattivo(this, this.cellCenterX(this.sourceCell.x) + 4.5, this.cellCenterY(this.sourceCell.y) + 7, "SEM-Probe", 0);
		this.probe.setDisplaySize(32, 40);
		this.probe.setDepth(3);
		this.probe.interagisci = () => this.activateProbe();
		this.add.existing(this.probe);

		// The receiver is a hidden trigger: no sprite is drawn for it. It only exists as a
		// target cell for traceBeam and as the spawn point for the finale's reveal sprite.

		this.turrets = this.turretCellLayout.map((cell, index) => this.createTurret(cell, index));
		this.oggVector = [this.probe, ...this.turrets];

		this.redrawBeam();
	}

	private createTurret(cell: { x: number; y: number; orientation: TurretOrientation }, index: number): Stage2Turret {
		const turret = new OggettoInterattivo(this, this.cellCenterX(cell.x) + 0.5, this.cellCenterY(cell.y), "specchi", ORIENTATION_FRAMES[cell.orientation]) as Stage2Turret;

		turret.mode = "locked";
		turret.orientation = cell.orientation;
		turret.gridX = cell.x;
		turret.gridY = cell.y;
		turret.set = false;
		turret.setDisplaySize(32, 32);
		turret.setDepth(4);
		turret.interagisci = () => this.handleTurretInteract(turret, index);

		this.applyTurretStyle(turret);
		this.add.existing(turret);
		return turret;
	}

	private handleTurretInteract(turret: Stage2Turret, index: number) {
		if (this.stageComplete || this.activeShooter) {
			return;
		}

		if (turret.mode === "locked") {
			this.startShooter(index);
			return;
		}

		this.cycleTurretOrientation(turret, index);
	}

	private cycleTurretOrientation(turret: Stage2Turret, index: number) {
		const currentIndex = ORIENTATION_CYCLE.indexOf(turret.orientation);
		turret.orientation = ORIENTATION_CYCLE[(currentIndex + 1) % ORIENTATION_CYCLE.length];
		console.log(`[Stage2] turret (${turret.gridX}, ${turret.gridY}) orientation -> ${turret.orientation} (frame ${ORIENTATION_FRAMES[turret.orientation]})`);
		this.applyTurretStyle(turret);
		this.redrawBeam();
		this.saveTurretOrientation(index, turret.orientation);
	}

	// L'orientamento cambia continuamente (il giocatore lo ruota a piacere), quindi non può
	// essere un checkpoint "aggiungi soltanto" come gli altri: usa il formato chiave|valore
	// (vedi APISession.saveCheckpoint) così il server sostituisce la voce precedente invece
	// di accumulare uno storico di tutte le rotazioni provate.
	private saveTurretOrientation(index: number, orientation: TurretOrientation) {
		void this.apiSession.saveCheckpoint(`stage2_turret_${index}_orientation|${orientation}`);
	}

	private activateProbe() {
		if (this.laserActive || this.activeShooter) {
			return;
		}

		// Set immediately (not just once runShooterChallenge starts) so a second interaction
		// during the approach/vibration beat below can't re-trigger this flow.
		this.activeShooter = true;

		void this.approachTurret(this.probe).then(() => {
			this.runShooterChallenge(1, success => {
				if (!success) {
					this.player.isMovementAllowed = true;
					return;
				}

				this.currentShooterLevel += 1;
				void this.apiSession.saveCheckpoint("stage2_probe_activated");
				// Oggetto sbloccato dal minigioco della probe (frame 3 di player_items).
				this.player.addInventoryItem(3);
				this.probe.set = false;
				this.probe.play("sem_probe_activate");
				this.probe.once("animationcomplete", () => {
					this.time.delayedCall(500, () => this.activateLaser());
				});
			});
		});
	}

	private approachTurret(target: { x: number; y: number }): Promise<void> {
		const bottomLeftX = target.x - 16;
		const bottomLeftY = target.y + 20;

		this.player.isMovementAllowed = false;

		this.tweens.add({
			targets: this.player,
			x: this.player.x + 1,
			duration: 40,
			yoyo: true,
			repeat: 4,
			ease: "Sine.easeInOut"
		});

		return new Promise<void>(resolve => {
			this.time.delayedCall(220, () => {
				this.player.walkTo(bottomLeftX, bottomLeftY, 500).then(resolve);
			});
		});
	}

	// silent: true quando lo stato viene ricostruito da un Resume, invece che raggiunto
	// giocando — salta il salto di festeggiamento e non forza il movimento (ci pensa già
	// playIntroSequence a riabilitarlo al termine del fade-in).
	private activateLaser(options: { silent?: boolean } = {}) {
		this.laserActive = true;

		if (!options.silent) {
			this.player.isMovementAllowed = true;
			void this.player.jump().then(() => this.player.jump());
		}

		this.activateHitbox(this.probe);

		for (const turret of this.turrets) {
			turret.set = true;
			this.applyTurretStyle(turret);
			this.activateHitbox(turret);
		}

		this.redrawBeam();
	}

	private startShooter(turretIndex: number) {
		if (this.activeShooter) {
			return;
		}

		this.activeShooter = true;

		const turret = this.turrets[turretIndex];
		void this.approachTurret(turret ?? this.player).then(() => this.runChallengeForTurret(turretIndex));
	}

	private runChallengeForTurret(turretIndex: number) {
		this.runShooterChallenge(this.currentShooterLevel, success => {
			this.player.isMovementAllowed = true;

			if (!success) {
				return;
			}

			const turret = this.turrets[turretIndex];
			if (turret) {
				turret.mode = "unlocked";
				this.applyTurretStyle(turret);
				void this.apiSession.saveCheckpoint(`stage2_turret_${turretIndex}`);
				this.saveTurretOrientation(turretIndex, turret.orientation);

				// One-shot pulse + flash on the locked->unlocked transition specifically
				// (cycleTurretOrientation reuses applyTurretStyle too, but shouldn't re-pulse).
				this.tweens.add({
					targets: turret,
					scale: { from: 1.25, to: 1 },
					duration: 300,
					ease: "Back.easeOut"
				});
				flashBurst(this, turret.x, turret.y, { tint: 0x7fd27f });

				// Oggetto sbloccato dal minigioco di questa torretta specifica
				// (frame 4 per la prima torretta, 5 per la seconda, ecc.).
				this.player.addInventoryItem(4 + turretIndex);
			}

			this.currentShooterLevel = Math.min(3, this.currentShooterLevel + 1);
			this.redrawBeam();
		});
	}

	// Launches the Shooter minigame, pausing this scene until it reports success/failure
	private runShooterChallenge(level: number, onResult: (success: boolean) => void) {
		this.activeShooter = true;

		launchSubScene(
			this,
			"Shooter",
			{ launchData: { level, returnSceneKey: "Stage2" }, completionEvent: "shooter-complete", listenOn: "parent", overlay: false },
			(result: { level: number; success: boolean }) => {
				this.scene.resume();
				this.activeShooter = false;
				onResult(result.success);
			}
		);
	}

	private applyTurretStyle(turret: Stage2Turret) {
		turret.setFrame(ORIENTATION_FRAMES[turret.orientation]);

		if (!turret.set) {
			turret.setAlpha(0.35);
			return;
		}

		turret.setAlpha(turret.mode === "locked" ? 0.76 : 1);
	}

	// Adds a static, invisible (outside of player.debug) boundary matching the object's current
	// bounds so the player can no longer walk through it once it's activated — mirrors/probe have
	// no hitbox before that so approachTurret() can still place the player right up against them.
	private activateHitbox(obj: OggettoInterattivo) {
		const bounds = obj.getBounds();
		const hitbox = this.add.rectangle(bounds.centerX, bounds.centerY, bounds.width, bounds.height);
		this.player.setBoundaries([hitbox]);
	}

	private redrawBeam() {
		this.beamGraphics.clear();

		if (!this.laserActive) {
			this.stopBeamPulse();
			return;
		}

		const mirrorStates = this.turrets.map(turret => ({
			x: turret.gridX,
			y: turret.gridY,
			orientation: turret.orientation
		}));

		const traced = traceBeam({
			sourceCell: this.sourceCell,
			targetCell: this.receiverCell,
			gridCols: this.gridCols,
			gridRows: this.gridRows,
			mirrors: mirrorStates,
			startDirection: "up",
			maxSteps: 2000
		});

		// Rotate each turret to match the direction the beam actually hits it from this trace —
		for (const turret of this.turrets) {
			const hit = traced.cells.find(cell => cell.x === turret.gridX && cell.y === turret.gridY);
			if (hit) {
				turret.setAngle(directionAngle(hit.direction));
			}
		}

		const points = traced.cells.map(cell => new Phaser.Math.Vector2(this.cellCenterX(cell.x), this.cellCenterY(cell.y)));
		if (points.length < 2) {
			return;
		}

		this.beamGraphics.lineStyle(10, 0x55ffff, 0.15);
		this.drawPolyline(points);
		this.beamGraphics.lineStyle(3, 0xbdfeff, 0.95);
		this.drawPolyline(points);

		// One-shot brighten pass for the finale: brightenBeam() tweens beamGlowBoost 0->1 and
		// redraws on every step, layering this extra glow on top of the normal beam strokes.
		if (this.beamGlowBoost > 0) {
			this.beamGraphics.lineStyle(18, 0xffffff, 0.35 * this.beamGlowBoost);
			this.drawPolyline(points);
		}

		const last = points[points.length - 1];
		this.beamGraphics.fillStyle(traced.solved ? 0xe8ffff : 0x55ffff, 0.95);
		this.beamGraphics.fillCircle(last.x, last.y, traced.solved ? 14 : 10);

		if (traced.solved) {
			this.startBeamPulse();
		} else {
			this.stopBeamPulse();
		}

		if (traced.solved && this.turrets.every(turret => turret.mode === "unlocked")) {
			this.finishStage();
		}
	}

	// Slow alpha "breathe" on the beam once it successfully threads through to the receiver,
	// instead of it staying a flat static line while the player unlocks any remaining turrets.
	private startBeamPulse() {
		if (this.beamPulseTween) {
			return;
		}
		this.beamPulseTween = this.tweens.add({
			targets: this.beamGraphics,
			alpha: { from: 0.75, to: 1 },
			duration: 1000,
			yoyo: true,
			repeat: -1,
			ease: "Sine.easeInOut"
		});
	}

	private stopBeamPulse() {
		this.beamPulseTween?.stop();
		this.beamPulseTween = undefined;
		this.beamGraphics.setAlpha(1);
	}

	private drawPolyline(points: Phaser.Math.Vector2[]) {
		this.beamGraphics.beginPath();
		this.beamGraphics.moveTo(points[0].x, points[0].y);
		for (let index = 1; index < points.length; index += 1) {
			this.beamGraphics.lineTo(points[index].x, points[index].y);
		}
		this.beamGraphics.strokePath();
	}

	private finishStage() {
		if (this.stageComplete) {
			return;
		}

		this.stageComplete = true;
		this.player.isMovementAllowed = false;

		this.cameras.main.shake(800, 0.001);
		void this.playFinaleSequence();
	}

	// Hidden-trigger finale: the UI/darkMask fade out while the camera pulls back to frame both
	// the player and the crater site, the beam brightens into a bright explosion that leaves the
	// crater behind, then the player walks into it and falls away before the existing
	// fade-to-black in transitionToStage3() hands off to Stage3. Paced slower than a normal
	// beat (900ms+ per step) since this is the stage's ending, not a quick reaction.
	private async playFinaleSequence() {
		this.cameras.main.stopFollow();

		await playSequence(this.popupManager, [this.i18n.shaking]);

		// The dark mask must finish fading before the camera visibly continues zooming out,
		// instead of both running concurrently — the crater reveal should only start once the
		// mask is no longer obscuring the view.
		await this.player.fadeOutFlashlight(900);
		await Promise.all([
			this.player.fadeOutUi(900),
			this.zoomOutToRevealTarget(this.craterPosition.x, this.craterPosition.y, 1600)
		]);

		await this.brightenBeam(900);
		await this.triggerCraterExplosion();
		await playSequence(this.popupManager, [this.i18n.finale_crater]);
		await this.player.walkTo(this.player.x, this.player.y + 30, 900);
		await playSequence(this.popupManager, [this.i18n.finale_falling]);
		await this.player.fallDown(1400);

		this.transitionToStage3();
	}

	// Pulls the camera back just enough to keep both the player and (targetX, targetY) in frame,
	// instead of a flat pan at the puzzle's zoom level — never zooms past native 1:1 (no camera
	// bounds are set, so anything wider would show empty space past the background's edges) nor
	// back in past the puzzle's zoom.
	private zoomOutToRevealTarget(targetX: number, targetY: number, duration: number): Promise<void> {
		const camera = this.cameras.main;
		const padding = 80;
		const dx = Math.abs(this.player.x - targetX);
		const dy = Math.abs(this.player.y - targetY);
		const zoomX = camera.width / (2 * (dx + padding));
		const zoomY = camera.height / (2 * (dy + padding));
		const targetZoom = Phaser.Math.Clamp(Math.min(zoomX, zoomY, camera.zoom), 1, camera.zoom);

		return new Promise<void>(resolve => {
			let pending = 2;
			const onStepComplete = () => { if (--pending === 0) resolve(); };
			camera.once("camerapancomplete", onStepComplete);
			camera.once("camerazoomcomplete", onStepComplete);
			camera.pan(targetX, targetY, duration, "Sine.easeInOut");
			camera.zoomTo(targetZoom, duration, "Sine.easeInOut");
		});
	}

	private brightenBeam(duration: number = 500): Promise<void> {
		return new Promise<void>(resolve => {
			this.tweens.add({
				targets: this,
				beamGlowBoost: { from: 0, to: 1 },
				duration,
				ease: "Sine.easeOut",
				onUpdate: () => this.redrawBeam(),
				onComplete: () => resolve()
			});
		});
	}

	// Full-screen flash + camera shake (instead of a flash localized on the crater site) so the
	// blast reads as hitting the whole scene, then the crater overlay appears instantly (no
	// fade-in) once the flash has had time to peak, and the laser — its job now done — stops.
	private triggerCraterExplosion(): Promise<void> {
		return new Promise<void>(resolve => {
			const { x, y } = this.craterPosition;

			sparkBurst(this, x, y, { count: 18, tint: 0xffffff, speedMin: 90, speedMax: 220, lifespan: 700 });
			this.flashScreen(250);
			this.cameras.main.shake(400, 0.02);

			this.time.delayedCall(350, () => {
				this.add.image(x, y, "stage2-crater").setDepth(2);
				this.stopLaser();
				resolve();
			});
		});
	}

	// Full-screen white flash overlay, same fixed-rectangle pattern as the intro/outro
	// fade-to-black (playIntroSequence/transitionToStage3), just white and quick instead of a
	// slow black fade.
	private flashScreen(duration: number): void {
		const flash = this.add.rectangle(
			this.cameras.main.centerX,
			this.cameras.main.centerY,
			this.cameras.main.width,
			this.cameras.main.height,
			0xffffff
		);
		flash.setScrollFactor(0);
		flash.setDepth(50);

		this.tweens.add({
			targets: flash,
			alpha: 0,
			duration,
			ease: "Cubic.easeOut",
			onComplete: () => flash.destroy()
		});
	}

	// The laser's beam is cleared and its pulse tween stopped via the existing !laserActive
	// branch in redrawBeam() — the crater it just carved is the payoff, so it has no reason to
	// keep firing afterward.
	private stopLaser(): void {
		this.laserActive = false;
		this.beamGlowBoost = 0;
		this.redrawBeam();
	}

	private transitionToStage3() {
		void this.apiSession.saveCheckpoint("stage2_complete");

		const blackRect = this.add.rectangle(
			this.cameras.main.centerX,
			this.cameras.main.centerY,
			this.cameras.main.width,
			this.cameras.main.height,
			0x000000
		);
		blackRect.setScrollFactor(0);
		blackRect.setDepth(100);
		blackRect.alpha = 0;

		this.tweens.add({
			targets: blackRect,
			alpha: 1,
			duration: 1500,
			ease: "Linear",
			onComplete: () => this.scene.start("Stage3")
		});
	}

	private cellCenterX(gridX: number) {
		return this.gridOriginX + gridX * this.cellSize + this.cellSize / 2;
	}

	private cellCenterY(gridY: number) {
		return this.gridOriginY + gridY * this.cellSize + this.cellSize / 2;
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Stage2;
