
// You can write more code here
import Player from "@/items/Main/Player";
import OggettoInterattivo from "../items/Main/OggettoInterattivo";
import { traceBeam } from "../items/beamTracer";
import PopupManager from "../items/UI/PopupManager";
import { applyTranslations } from "../utils";

type TurretOrientation =
	| "up"
	| "up-right"
	| "right"
	| "down-right"
	| "down"
	| "down-left"
	| "left"
	| "up-left";

type TurretMode = "locked" | "unlocked";

interface Stage2Turret extends OggettoInterattivo {
	kind: "turret";
	mode: TurretMode;
	orientation: TurretOrientation;
	gridX: number;
	gridY: number;
}

// Clockwise cycle used when the player rotates an unlocked turret
const ORIENTATION_CYCLE: TurretOrientation[] = [
	"up", "up-right", "right", "down-right", "down", "down-left", "left", "up-left"
];

const ORIENTATION_ANGLES: Record<TurretOrientation, number> = {
	"up": -90,
	"up-right": -45,
	"right": 0,
	"down-right": 45,
	"down": 90,
	"down-left": 135,
	"left": 180,
	"up-left": -135
};

// Diagonal turrets reflect like a slash (/) or backslash (\) mirror, cardinal ones flip a single axis
const ORIENTATION_TO_MIRROR_KIND: Record<TurretOrientation, "slash" | "backslash" | "horizontal" | "vertical"> = {
	"up": "horizontal",
	"down": "horizontal",
	"left": "vertical",
	"right": "vertical",
	"up-right": "slash",
	"down-left": "slash",
	"up-left": "backslash",
	"down-right": "backslash"
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

		// bg_stage2
		this.add.image(640, 360, "bg-stage2");

		// player
		const player = new Player(this, 169, 567);
		this.add.existing(player);

		// lists
		const boundaries: Array<any> = [];
		const oggVector: Array<any> = [];

		this.player = player;
		this.boundaries = boundaries;
		this.oggVector = oggVector;

		this.events.emit("scene-awake");
	}

	private player!: Player;
	private boundaries!: Array<any>;
	private oggVector!: Array<any>;

	/* START-USER-CODE */
	private popupManager!: PopupManager;
	private i18n: Record<string, string> = {};

	private readonly cellSize = 84;
	private readonly gridCols = 8;
	private readonly gridRows = 5;
	private readonly gridOriginX = 288;
	private readonly gridOriginY = 168;
	private readonly sourceCell = { x: 4, y: 4 };
	private readonly receiverCell = { x: 4, y: 2 };
	private readonly turretCellLayout: Array<{ x: number; y: number; orientation: TurretOrientation }> = [
		{ x: 4, y: 3, orientation: "up-right" },
		{ x: 5, y: 3, orientation: "up-right" },
		{ x: 5, y: 2, orientation: "up-right" },
		{ x: 3, y: 2, orientation: "up-left" }
	];

	private turrets: Stage2Turret[] = [];
	private probe!: OggettoInterattivo;
	private laserActive = false;
	private receiverTurret!: Phaser.GameObjects.Image;
	private beamGraphics!: Phaser.GameObjects.Graphics;
	private currentShooterLevel = 1;
	private activeShooter = false;
	private stageComplete = false;
	private beamSolved = false;

	async preload() {
		this.load.pack("stage2-pack", "assets/images/stage2-pack.json");
		this.load.pack("player-pack", "assets/images/player-pack.json");
		this.load.pack("icons-pack", "assets/images/icons-pack.json");

		const lang = localStorage.getItem("lang") || "en";
        this.load.json("Stage2_i18n", `assets/i18n/${lang}/Stage2.json`);
	}

	create() {

		this.editorCreate();

		// Applicazione delle traduzioni sui testi già presenti nella scena
		this.i18n = this.cache.json.get("Stage2_i18n") ?? {};
		applyTranslations(this, this.i18n);

		// Configurazione del giocatore
		this.player.debug(false);
		this.player.setBoundaries(this.boundaries);
		this.player.setDepth(6);

		this.player.isMovementAllowed = false;

		// Configurazione della telecamera
		this.cameras.main.setZoom(5.0);
        this.cameras.main.startFollow(this.player);

		// Inizializzazione dei manager
		this.popupManager = new PopupManager(this);

		if (!this.anims.exists("sem_probe_activate")) {
			this.anims.create({
				key: "sem_probe_activate",
				frames: this.anims.generateFrameNumbers("SEM-Probe", { start: 0, end: 40 }),
				frameRate: 20,
				repeat: 0
			});
		}

		this.buildTurretPuzzle();

		/* START-SCENE-LOGIC */
		this.playIntroSequence();
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

		this.popupManager.queuePopup(this.i18n.wake_up_1);
		this.popupManager.queuePopup(this.i18n.wake_up_2);

		this.tweens.add({
			targets: fadeRect,
			alpha: 0.0,
			duration: 600,
			ease: "Linear",
			onComplete: () => {
				fadeRect.destroy();
				this.popupManager.showNextPopup();
				this.popupManager.on("queueEmpty", () => {
					this.player.isMovementAllowed = true;
				});
			}
		});
	}

	private buildTurretPuzzle() {
		this.beamGraphics = this.add.graphics();
		this.beamGraphics.setDepth(5);

		this.probe = new OggettoInterattivo(this, this.cellCenterX(this.sourceCell.x) + 4.5, this.cellCenterY(this.sourceCell.y) + 7, "SEM-Probe", 0);
		this.probe.setDisplaySize(32, 40);
		this.probe.setDepth(3);
		this.probe.interagisci = () => this.activateProbe();
		this.add.existing(this.probe);

		this.receiverTurret = this.add.image(this.cellCenterX(this.receiverCell.x) + 0.5, this.cellCenterY(this.receiverCell.y), "default");
		this.receiverTurret.setDisplaySize(32, 40);
		this.receiverTurret.setTint(0x6fdc8b);
		this.receiverTurret.setDepth(3);

		this.turrets = this.turretCellLayout.map((cell, index) => this.createTurret(cell, index));
		this.oggVector = [this.probe, ...this.turrets];

		this.redrawBeam();
	}

	private createTurret(cell: { x: number; y: number; orientation: TurretOrientation }, index: number): Stage2Turret {
		const turret = new OggettoInterattivo(this, this.cellCenterX(cell.x) + 0.5, this.cellCenterY(cell.y), "default") as Stage2Turret;

		turret.kind = "turret";
		turret.mode = "locked";
		turret.orientation = cell.orientation;
		turret.gridX = cell.x;
		turret.gridY = cell.y;
		turret.set = false;
		turret.setDisplaySize(32, 40);
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

		this.cycleTurretOrientation(turret);
	}

	private cycleTurretOrientation(turret: Stage2Turret) {
		const currentIndex = ORIENTATION_CYCLE.indexOf(turret.orientation);
		turret.orientation = ORIENTATION_CYCLE[(currentIndex + 1) % ORIENTATION_CYCLE.length];
		this.applyTurretStyle(turret);
		this.redrawBeam();
	}

	private activateProbe() {
		if (this.laserActive || this.activeShooter) {
			return;
		}

		this.player.isMovementAllowed = false;

		this.runShooterChallenge(1, success => {
			if (!success) {
				this.player.isMovementAllowed = true;
				return;
			}

			this.probe.set = false;
			this.probe.play("sem_probe_activate");
			this.probe.once("animationcomplete", () => {
				this.time.delayedCall(500, () => this.activateLaser());
			});
		});
	}

	private activateLaser() {
		this.laserActive = true;
		this.player.isMovementAllowed = true;

		for (const turret of this.turrets) {
			turret.set = true;
			this.applyTurretStyle(turret);
		}

		this.popupManager.queuePopup(this.i18n.laser_online ?? "The probe hums to life.");
		this.popupManager.showNextPopup();

		this.redrawBeam();
	}

	private startShooter(turretIndex: number) {
		if (this.activeShooter) {
			return;
		}

		this.player.isMovementAllowed = false;

		this.runShooterChallenge(this.currentShooterLevel, success => {
			this.player.isMovementAllowed = true;

			if (!success) {
				return;
			}

			const turret = this.turrets[turretIndex];
			if (turret) {
				turret.mode = "unlocked";
				this.applyTurretStyle(turret);
			}

			this.currentShooterLevel = Math.min(4, this.currentShooterLevel + 1);
			this.redrawBeam();
		});
	}

	// Launches the Shooter minigame, pausing this scene until it reports success/failure
	private runShooterChallenge(level: number, onResult: (success: boolean) => void) {
		this.activeShooter = true;
		this.scene.pause();

		this.events.once("shooter-complete", (result: { level: number; success: boolean }) => {
			this.scene.resume();
			this.activeShooter = false;
			onResult(result.success);
		});

		this.scene.launch("Shooter", { level, returnSceneKey: "Stage2" });
		this.scene.bringToTop("Shooter");
	}

	private applyTurretStyle(turret: Stage2Turret) {
		turret.setAngle(ORIENTATION_ANGLES[turret.orientation]);

		if (!turret.set) {
			turret.setTint(0x4a4f5c);
			turret.setAlpha(0.35);
			return;
		}

		turret.setTint(turret.mode === "locked" ? 0x8a93a5 : 0x7fd27f);
		turret.setAlpha(turret.mode === "locked" ? 0.76 : 1);
	}

	private redrawBeam() {
		this.beamGraphics.clear();

		if (!this.laserActive) {
			return;
		}

		const mirrorStates = this.turrets.map(turret => ({
			x: turret.gridX,
			y: turret.gridY,
			orientation: ORIENTATION_TO_MIRROR_KIND[turret.orientation]
		}));

		const traced = traceBeam({
			sourceCell: this.sourceCell,
			targetCell: this.receiverCell,
			gridCols: this.gridCols,
			gridRows: this.gridRows,
			mirrors: mirrorStates,
			startDirection: "up"
		});

		this.beamSolved = traced.solved;

		const points = traced.cells.map(cell => new Phaser.Math.Vector2(this.cellCenterX(cell.x), this.cellCenterY(cell.y)));
		if (points.length < 2) {
			return;
		}

		this.beamGraphics.lineStyle(10, 0x55ffff, 0.15);
		this.drawPolyline(points);
		this.beamGraphics.lineStyle(3, 0xbdfeff, 0.95);
		this.drawPolyline(points);

		const last = points[points.length - 1];
		this.beamGraphics.fillStyle(traced.solved ? 0xe8ffff : 0x55ffff, 0.95);
		this.beamGraphics.fillCircle(last.x, last.y, traced.solved ? 14 : 10);

		if (traced.solved && this.turrets.every(turret => turret.mode === "unlocked")) {
			this.finishStage();
		}
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

		this.popupManager.queuePopup(this.i18n.shaking ?? "The receiver is active.");
		this.popupManager.showNextPopup();

		this.popupManager.on("queueEmpty", () => {
			this.tweens.add({
				targets: this.player,
				x: this.receiverTurret.x,
				y: this.receiverTurret.y + 8,
				duration: 1200,
				ease: "Sine.easeInOut",
				onComplete: () => this.transitionToStage3()
			});
		});
	}

	private transitionToStage3() {
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
			duration: 1000,
			ease: "Linear"
		});

		this.tweens.add({
			targets: this.cameras.main,
			zoom: 10.0,
			duration: 1000,
			ease: "Sine.easeInOut",
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
