
// You can write more code here
import Player from "@/items/Main/Player";
import OggettoInterattivo from "../items/Main/OggettoInterattivo";
import { traceBeam } from "../items/beamTracer";
import { applyTranslations, launchSubScene } from "../utils";

// A turret's orientation IS its mirror behavior: horizontal/vertical bounce the beam back along
// the same axis, slash/backslash reflect it like a / or \ mirror onto the perpendicular axis.
type TurretOrientation = "horizontal" | "slash" | "vertical" | "backslash";

type TurretMode = "locked" | "unlocked";

interface Stage2Turret extends OggettoInterattivo {
	mode: TurretMode;
	orientation: TurretOrientation;
	gridX: number;
	gridY: number;
	// Overlay che disegna una freccia di orientamento sopra alla texture placeholder "default",
	// finché non esiste uno sprite dedicato per le torrette (vedi elenco asset mancanti).
	glyph: Phaser.GameObjects.Graphics;
}

// Clockwise cycle used when the player rotates an unlocked turret
const ORIENTATION_CYCLE: TurretOrientation[] = ["horizontal", "slash", "vertical", "backslash"];

const ORIENTATION_ANGLES: Record<TurretOrientation, number> = {
	"horizontal": -90,
	"slash": -45,
	"vertical": 0,
	"backslash": 45
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
	private i18n: Record<string, string> = {};

	private readonly cellSize = 84;
	private readonly gridCols = 8;
	private readonly gridRows = 5;
	private readonly gridOriginX = 288;
	private readonly gridOriginY = 168;
	private readonly sourceCell = { x: 4, y: 4 };
	private readonly receiverCell = { x: 4, y: 2 };
	private readonly turretCellLayout: Array<{ x: number; y: number; orientation: TurretOrientation }> = [
		{ x: 4, y: 3, orientation: "slash" },
		{ x: 5, y: 3, orientation: "slash" },
		{ x: 5, y: 2, orientation: "slash" },
		{ x: 3, y: 2, orientation: "backslash" }
	];

	private turrets: Stage2Turret[] = [];
	private probe!: OggettoInterattivo;
	private laserActive = false;
	private receiverTurret!: Phaser.GameObjects.Image;
	private beamGraphics!: Phaser.GameObjects.Graphics;
	private currentShooterLevel = 1;
	private activeShooter = false;
	private stageComplete = false;

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

		this.tweens.add({
			targets: fadeRect,
			alpha: 0.0,
			duration: 600,
			ease: "Linear",
			onComplete: () => {
				fadeRect.destroy();
				this.player.isMovementAllowed = true;
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

		turret.mode = "locked";
		turret.orientation = cell.orientation;
		turret.gridX = cell.x;
		turret.gridY = cell.y;
		turret.set = false;
		turret.setDisplaySize(32, 40);
		turret.setDepth(4);
		turret.interagisci = () => this.handleTurretInteract(turret, index);

		turret.glyph = this.add.graphics();
		turret.glyph.setPosition(turret.x, turret.y);
		turret.glyph.setDepth(4.5);

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

			this.currentShooterLevel += 1;
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
			{ launchData: { level, returnSceneKey: "Stage2" }, completionEvent: "shooter-complete", listenOn: "parent" },
			(result: { level: number; success: boolean }) => {
				this.scene.resume();
				this.activeShooter = false;
				onResult(result.success);
			}
		);
	}

	private applyTurretStyle(turret: Stage2Turret) {
		turret.setAngle(ORIENTATION_ANGLES[turret.orientation]);

		if (!turret.set) {
			turret.setTint(0x4a4f5c);
			turret.setAlpha(0.35);
			this.drawTurretGlyph(turret);
			return;
		}

		turret.setTint(turret.mode === "locked" ? 0x8a93a5 : 0x7fd27f);
		turret.setAlpha(turret.mode === "locked" ? 0.76 : 1);
		this.drawTurretGlyph(turret);
	}

	// Freccia di orientamento sopra al placeholder "default": pieno+perno quando bloccata,
	// pieno quando sbloccata, solo contorno mentre il laser non è ancora attivo.
	private drawTurretGlyph(turret: Stage2Turret) {
		const g = turret.glyph;
		g.setAngle(ORIENTATION_ANGLES[turret.orientation]);
		g.clear();

		if (!turret.set) {
			g.lineStyle(1, 0xffffff, 0.35);
			g.strokeTriangle(9, 0, -6, -5, -6, 5);
			return;
		}

		const isLocked = turret.mode === "locked";
		g.fillStyle(isLocked ? 0x3d4451 : 0xdff5e3, 1);
		g.fillTriangle(9, 0, -6, -5, -6, 5);

		if (isLocked) {
			// Perno pieno alla base: l'orientamento è ancora bloccato
			g.fillStyle(0x1c1f26, 1);
			g.fillCircle(-6, 0, 3);
		}
	}

	private redrawBeam() {
		this.beamGraphics.clear();

		if (!this.laserActive) {
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
			startDirection: "up"
		});

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

		this.tweens.add({
			targets: this.player,
			x: this.receiverTurret.x,
			y: this.receiverTurret.y + 8,
			duration: 1200,
			ease: "Sine.easeInOut",
			onComplete: () => this.transitionToStage3()
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
			// TODO: "Stage3" doesn't exist yet and isn't registered in Preload.ts — needs a
			// product decision (real Stage3 scene? redirect elsewhere? end-of-demo screen?).
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
