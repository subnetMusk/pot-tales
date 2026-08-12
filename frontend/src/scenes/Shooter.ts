import MenuBackground from "../items/UI/MenuBackground";

/* START OF COMPILED CODE */

class Shooter extends Phaser.Scene {

	constructor() {
		super("Shooter");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

		// screen_back
		const screen_back = this.add.rectangle(640, 360, 462, 302);
		screen_back.isFilled = true;
		screen_back.fillColor = 331285;

		// timerText
		const timerText = this.add.text(449, 230, "", {});
		timerText.name = "timerText";
		timerText.setStyle({ "color": "#f0f8ff", "fontFamily": "PixelifySans-VariableFont_wght", "fontSize": "22px", "stroke": "#000000" });

		// scoreText
		const scoreText = this.add.text(449, 268, "", {});
		scoreText.name = "scoreText";
		scoreText.setStyle({ "color": "#f0f8ff", "fontFamily": "PixelifySans-VariableFont_wght", "fontSize": "15px", "stroke": "#000000" });

		// resultText
		const resultText = this.add.text(640, 332, "", {});
		resultText.name = "resultText";
		resultText.setOrigin(0.5, 0.5);
		resultText.setStyle({ "align": "center", "color": "#f0f8ff", "fontFamily": "PixelifySans-VariableFont_wght", "fontSize": "20px", "stroke": "#000000" });

		// shooter_screen
		const shooter_screen = this.add.image(640, 360, "shooter_screen");

		this.timerText = timerText;
		this.scoreText = scoreText;
		this.resultText = resultText;
		this.shooter_screen = shooter_screen;

		this.events.emit("scene-awake");
	}

	private timerText!: Phaser.GameObjects.Text;
	private scoreText!: Phaser.GameObjects.Text;
	private resultText!: Phaser.GameObjects.Text;
	private shooter_screen!: Phaser.GameObjects.Image;

	/* START-USER-CODE */

	// Geometry of the arcade display, mirroring the screen_back rectangle created in
	// editorCreate() (640,360, 462x302) — kept as named constants instead of duplicated
	// literals so the playfield mask below always matches what's actually drawn.
	private static readonly SCREEN_CENTER_X = 640;
	private static readonly SCREEN_CENTER_Y = 360;
	private static readonly SCREEN_WIDTH = 462;
	private static readonly SCREEN_HEIGHT = 302;

	private static readonly SHOOTER_SCREEN_DEPTH = 1000;
	private static readonly PLAYFIELD_DEPTH = 2;

	private static readonly PLAYER_MARGIN = 40;
	private static readonly GUN_BOTTOM_OFFSET = 40;
	private static readonly BARREL_OFFSET_Y = 30;
	private static readonly BULLET_SPEED = 16;
	private static readonly OFFSCREEN_MARGIN = 8;
	private static readonly COLLISION_DISTANCE = 34;

	private static readonly TARGET_SPAWN_MARGIN = 32;
	private static readonly TARGET_SPAWN_Y_OFFSET = 20;
	private static readonly PATTERN_SPAWN_CHANCE = 0.3;
	private static readonly LINE_PATTERN_COUNT = 3;
	private static readonly LINE_PATTERN_SPACING = 60;
	private static readonly V_PATTERN_OFFSET = 60;
	private static readonly V_PATTERN_SLOPE = 0.4;
	private static readonly DIAGONAL_PATTERN_COUNT = 3;
	private static readonly DIAGONAL_SPACING_X = 70;
	private static readonly DIAGONAL_SPACING_Y = 40;

	private static readonly COUNTDOWN_INTERVAL_MS = 1000;
	private static readonly MIN_LEVEL = 1;
	private static readonly GUN_ANIM_FRAMERATE = 40;
	private static readonly PROJ_ANIM_FRAMERATE = 36;
	private static readonly BASE_POINTS = 10;

	private static readonly LEVEL_CONFIGS: ReadonlyArray<{
		timeLeft: number; lives: number; targetDelay: number; bulletCooldown: number; targetSpeed: number; playerSpeed: number;
	}> = [
		{ timeLeft: 30, lives: 4, targetDelay: 760, bulletCooldown: 210, targetSpeed: 1.1, playerSpeed: 5 },
		{ timeLeft: 28, lives: 4, targetDelay: 680, bulletCooldown: 195, targetSpeed: 1.45, playerSpeed: 5.5 },
		{ timeLeft: 28, lives: 3, targetDelay: 680, bulletCooldown: 195, targetSpeed: 1.45, playerSpeed: 5.5 },
		{ timeLeft: 24, lives: 3, targetDelay: 500, bulletCooldown: 155, targetSpeed: 2.15, playerSpeed: 6.5 }
	];

	private readonly targetTiers: Array<{ id: string; speedMultiplier: number; pointsMultiplier: number; weight: number; tint: number; scale: number }> = [
		{ id: "common", speedMultiplier: 1.0, pointsMultiplier: 1, weight: 65, tint: 0xffffff, scale: 1.0 },
		{ id: "swift", speedMultiplier: 1.3, pointsMultiplier: 2, weight: 25, tint: 0x8fd3ff, scale: 0.85 },
		{ id: "rare", speedMultiplier: 1.7, pointsMultiplier: 4, weight: 10, tint: 0xffd75e, scale: 0.75 }
	];

	private screenLeft = 0;
	private screenRight = 0;
	private screenTop = 0;
	private screenBottom = 0;
	private playerLeftBound = 0;
	private playerRightBound = 0;

	// All gun/bullet/target sprites live inside this container, which is geometry-masked
	// to the visible display rect — anything spawned above/below the screen (e.g. targets
	// entering from off-screen) stays invisible until it moves into the masked area.
	private playfield!: Phaser.GameObjects.Container;
	private maskGraphics?: Phaser.GameObjects.Graphics;

	private cannon!: Phaser.GameObjects.Sprite;
	private bullets: Phaser.GameObjects.Sprite[] = [];
	private targets: Phaser.GameObjects.Sprite[] = [];
	private cursors!: {
		left: Phaser.Input.Keyboard.Key;
		right: Phaser.Input.Keyboard.Key;
		space: Phaser.Input.Keyboard.Key;
	};
	private fireCooldownUntil = 0;
	private score = 0;
	private timeLeft = 0;
	private lives = 0;
	private roundActive = false;
	private level = 1;
	private levelConfig!: (typeof Shooter.LEVEL_CONFIGS)[number];
	private returnSceneKey = "Stage2";
	private completionEmitted = false;
	private targetSpawnTimer?: Phaser.Time.TimerEvent;
	private countdownTimer?: Phaser.Time.TimerEvent;

	preload() {
		this.load.pack("icons-pack", "assets/images/icons-pack.json");
		this.load.pack("stage2-pack", "assets/images/stage2-pack.json");
	}

	create(data: { level?: number; returnSceneKey?: string } = {}) {
		this.editorCreate();
		this.cameras.main.setZoom(1.75);

		// determine the screen bounds from the screen_back rectangle geometry (centered at
		// SCREEN_CENTER_X/Y)
		this.screenLeft = Shooter.SCREEN_CENTER_X - Shooter.SCREEN_WIDTH / 2;
		this.screenRight = Shooter.SCREEN_CENTER_X + Shooter.SCREEN_WIDTH / 2;
		this.screenTop = Shooter.SCREEN_CENTER_Y - Shooter.SCREEN_HEIGHT / 2;
		this.screenBottom = Shooter.SCREEN_CENTER_Y + Shooter.SCREEN_HEIGHT / 2;

		// ensure the decorative shooter_screen image is on top so all game elements stay underneath
		const shooterScreenImg = this.children.list.find((c: any) => c instanceof Phaser.GameObjects.Image && c.texture?.key === "shooter_screen") as Phaser.GameObjects.Image | undefined;
		shooterScreenImg?.setDepth(Shooter.SHOOTER_SCREEN_DEPTH);

		// (re)build the masked playfield container that clips all gun/bullet/target sprites
		// to the visible display rect
		this.playfield?.destroy();
		this.maskGraphics?.destroy();
		this.maskGraphics = this.make.graphics(undefined, false);
		this.maskGraphics.fillStyle(0xffffff);
		this.maskGraphics.fillRect(this.screenLeft, this.screenTop, Shooter.SCREEN_WIDTH, Shooter.SCREEN_HEIGHT);
		this.playfield = this.add.container(0, 0);
		this.playfield.setDepth(Shooter.PLAYFIELD_DEPTH);
		this.playfield.setMask(this.maskGraphics.createGeometryMask());

		this.bullets = [];
		this.targets = [];
		this.fireCooldownUntil = 0;
		this.completionEmitted = false;
		this.targetSpawnTimer?.remove(false);
		this.countdownTimer?.remove(false);

		this.level = Math.max(Shooter.MIN_LEVEL, Math.min(Shooter.LEVEL_CONFIGS.length, data.level ?? Shooter.MIN_LEVEL));
		this.returnSceneKey = data.returnSceneKey ?? "Stage2";
		this.levelConfig = Shooter.LEVEL_CONFIGS[this.level - 1];

		this.score = 0;
		this.timeLeft = this.levelConfig.timeLeft;
		this.lives = this.levelConfig.lives;
		this.roundActive = true;

		this.refreshHud();

		// create player gun sprite (from spritesheet) and place it inside the masked playfield
		const gun = this.add.sprite(Shooter.SCREEN_CENTER_X, this.screenBottom - Shooter.GUN_BOTTOM_OFFSET, "electron_gun", 0);
		this.playfield.add(gun);
		this.cannon = gun;

		// create animations for gun and projectile if not present
		if (!this.anims.exists("gun-shoot")) {
			const gunFrameNames = this.textures.get("electron_gun").getFrameNames().filter((n: any) => n !== "__BASE");
			this.anims.create({
				key: "gun-shoot",
				frames: this.anims.generateFrameNumbers("electron_gun", { start: 0, end: Math.max(0, gunFrameNames.length - 1) }),
				frameRate: Shooter.GUN_ANIM_FRAMERATE,
				repeat: 0
			});
		}
		if (!this.anims.exists("proj-fly")) {
			const projFrameNames = this.textures.get("electron").getFrameNames().filter((n: any) => n !== "__BASE");
			this.anims.create({
				key: "proj-fly",
				frames: this.anims.generateFrameNumbers("electron", { start: 0, end: Math.max(0, projFrameNames.length - 1) }),
				frameRate: Shooter.PROJ_ANIM_FRAMERATE,
				repeat: 0
			});
		}

		this.cursors = {
			left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
			right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
			space: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
		};

		// clamp movement to the visible screen area (with small margins)
		this.playerLeftBound = this.screenLeft + Shooter.PLAYER_MARGIN;
		this.playerRightBound = this.screenRight - Shooter.PLAYER_MARGIN;

		this.targetSpawnTimer = this.time.addEvent({
			delay: this.levelConfig.targetDelay,
			loop: true,
			callback: this.spawnTarget,
			callbackScope: this
		});

		this.countdownTimer = this.time.addEvent({
			delay: Shooter.COUNTDOWN_INTERVAL_MS,
			loop: true,
			callback: this.tickTimer,
			callbackScope: this
		});

		this.events.once("shutdown", this.cleanup, this);
	}

	update(time: number) {
		if (!this.roundActive) {
			return;
		}

		const moveSpeed = this.levelConfig.playerSpeed;
		if (this.cursors.left.isDown) {
			this.cannon.x = Math.max(this.playerLeftBound, this.cannon.x - moveSpeed);
		}
		if (this.cursors.right.isDown) {
			this.cannon.x = Math.min(this.playerRightBound, this.cannon.x + moveSpeed);
		}

		if (Phaser.Input.Keyboard.JustDown(this.cursors.space) && time >= this.fireCooldownUntil) {
			this.fireCooldownUntil = time + this.levelConfig.bulletCooldown;
			this.fireBullet();
		}

		for (let bulletIndex = this.bullets.length - 1; bulletIndex >= 0; bulletIndex -= 1) {
			const bullet = this.bullets[bulletIndex];
			bullet.y -= Shooter.BULLET_SPEED;
			if (bullet.y < this.screenTop - Shooter.OFFSCREEN_MARGIN) {
				bullet.destroy();
				this.bullets.splice(bulletIndex, 1);
			}
		}

		for (let targetIndex = this.targets.length - 1; targetIndex >= 0; targetIndex -= 1) {
			const target = this.targets[targetIndex];
			const speedMultiplier = (target.getData("speedMultiplier") as number | undefined) ?? 1;
			target.y += this.levelConfig.targetSpeed * speedMultiplier;
			if (target.y > this.screenBottom + Shooter.OFFSCREEN_MARGIN) {
				target.destroy();
				this.targets.splice(targetIndex, 1);
				this.lives -= 1;
				this.refreshHud();
				if (this.lives <= 0) {
					this.endRound(false);
					return;
				}
			}
		}

		for (let bulletIndex = this.bullets.length - 1; bulletIndex >= 0; bulletIndex -= 1) {
			const bullet = this.bullets[bulletIndex];
			for (let targetIndex = this.targets.length - 1; targetIndex >= 0; targetIndex -= 1) {
				const target = this.targets[targetIndex];
				if (Phaser.Math.Distance.Between(bullet.x, bullet.y, target.x, target.y) < Shooter.COLLISION_DISTANCE) {
					bullet.destroy();
					target.destroy();
					this.bullets.splice(bulletIndex, 1);
					this.targets.splice(targetIndex, 1);
					const points = (target.getData("points") as number | undefined) ?? Shooter.BASE_POINTS;
					this.score += points;
					this.refreshHud();
					break;
				}
			}
		}
	}

	private fireBullet() {
		if (!this.roundActive) {
			return;
		}

		// play gun shooting animation, then spawn projectile at animation end.
		// Use a stable bound handler + off-before-once so rapid-fire never stacks
		// duplicate listeners (that was the cause of the multi-bullet/reset bug).
		this.cannon.off("animationcomplete", this.onGunShootComplete, this);
		this.cannon.once("animationcomplete", this.onGunShootComplete, this);
		this.cannon.play("gun-shoot");
	}

	private onGunShootComplete = (anim: Phaser.Animations.Animation) => {
		if (anim.key !== "gun-shoot") {
			return;
		}

		// spawn projectile at barrel position
		const bullet = this.add.sprite(this.cannon.x, this.cannon.y - Shooter.BARREL_OFFSET_Y, "electron", 0);
		this.playfield.add(bullet);
		bullet.play("proj-fly");
		// ensure projectile stops at last frame when animation finishes
		const projAnim = this.anims.get("proj-fly");
		const lastFrameIdx = projAnim ? projAnim.frames.length - 1 : 0;
		bullet.on("animationcomplete", () => {
			bullet.anims.stop();
			bullet.setFrame(lastFrameIdx);
		}, this);
		this.bullets.push(bullet);
		// reset gun to frame 0
		this.cannon.setFrame(0);
		this.cannon.anims.stop();
	};

	private spawnTarget() {
		if (!this.roundActive) {
			return;
		}

		if (Math.random() < Shooter.PATTERN_SPAWN_CHANCE) {
			const patterns = [
				() => this.spawnLinePattern(),
				() => this.spawnVPattern(),
				() => this.spawnDiagonalPattern()
			];
			Phaser.Utils.Array.GetRandom(patterns)();
			return;
		}

		this.spawnSingleTarget();
	}

	private pickTargetTier() {
		const totalWeight = this.targetTiers.reduce((sum, tier) => sum + tier.weight, 0);
		let roll = Phaser.Math.Between(1, totalWeight);
		for (const tier of this.targetTiers) {
			roll -= tier.weight;
			if (roll <= 0) {
				return tier;
			}
		}
		return this.targetTiers[0];
	}

	private get usableSpawnLeft(): number {
		return Math.floor(this.screenLeft) + Shooter.TARGET_SPAWN_MARGIN;
	}

	private get usableSpawnRight(): number {
		return Math.floor(this.screenRight) - Shooter.TARGET_SPAWN_MARGIN;
	}

	private get spawnTopY(): number {
		return Math.floor(this.screenTop) - Shooter.TARGET_SPAWN_Y_OFFSET;
	}

	private spawnSingleTarget(x?: number, y?: number) {
		// pick a random frame from the minerals spritesheet
		const frameNames = this.textures.get("minerals").getFrameNames().filter((n: any) => n !== "__BASE");
		const frameIndex = Phaser.Math.Between(0, Math.max(0, frameNames.length - 1));

		// always clamp to the usable playfield, regardless of what the caller (a spawn
		// pattern) computed, so a target can never end up outside the visible screen
		const spawnX = Phaser.Math.Clamp(x ?? Phaser.Math.Between(this.usableSpawnLeft, this.usableSpawnRight), this.usableSpawnLeft, this.usableSpawnRight);
		const spawnY = y ?? this.spawnTopY;

		const tier = this.pickTargetTier();

		const target = this.add.sprite(spawnX, spawnY, "minerals", frameIndex);
		this.playfield.add(target);
		target.setTint(tier.tint);
		target.setScale(tier.scale);
		target.setData("speedMultiplier", tier.speedMultiplier);
		target.setData("points", Math.round(Shooter.BASE_POINTS * tier.pointsMultiplier));
		this.targets.push(target);
	}

	private spawnLinePattern() {
		const totalWidth = Shooter.LINE_PATTERN_SPACING * (Shooter.LINE_PATTERN_COUNT - 1);
		const startX = Phaser.Math.Clamp(Phaser.Math.Between(this.usableSpawnLeft, this.usableSpawnRight - totalWidth), this.usableSpawnLeft, this.usableSpawnRight);

		for (let i = 0; i < Shooter.LINE_PATTERN_COUNT; i += 1) {
			this.spawnSingleTarget(startX + i * Shooter.LINE_PATTERN_SPACING, this.spawnTopY);
		}
	}

	private spawnVPattern() {
		const centerX = Phaser.Math.Between(this.usableSpawnLeft + Shooter.V_PATTERN_OFFSET, this.usableSpawnRight - Shooter.V_PATTERN_OFFSET);
		const baseY = this.spawnTopY;

		for (const dx of [-Shooter.V_PATTERN_OFFSET, 0, Shooter.V_PATTERN_OFFSET]) {
			const y = baseY - Math.abs(dx) * Shooter.V_PATTERN_SLOPE;
			this.spawnSingleTarget(centerX + dx, y);
		}
	}

	private spawnDiagonalPattern() {
		const goRight = Math.random() < 0.5;
		const startX = goRight ? this.usableSpawnLeft : this.usableSpawnRight - Shooter.DIAGONAL_SPACING_X * (Shooter.DIAGONAL_PATTERN_COUNT - 1);
		const baseY = this.spawnTopY;

		for (let i = 0; i < Shooter.DIAGONAL_PATTERN_COUNT; i += 1) {
			const x = Phaser.Math.Clamp(startX + i * Shooter.DIAGONAL_SPACING_X, this.usableSpawnLeft, this.usableSpawnRight);
			const y = baseY - i * Shooter.DIAGONAL_SPACING_Y;
			this.spawnSingleTarget(x, y);
		}
	}

	private tickTimer() {
		if (!this.roundActive) {
			return;
		}

		this.timeLeft -= 1;
		this.refreshHud();

		if (this.timeLeft <= 0) {
			this.endRound(true);
		}
	}

	private refreshHud() {
		this.scoreText.setText(`Level ${this.level}/${Shooter.LEVEL_CONFIGS.length}  Score: ${this.score}`);
		this.timerText.setText(`Time: ${Math.max(this.timeLeft, 0)}s   Lives: ${this.lives}`);
	}

	private endRound(timeUp: boolean) {
		if (!this.roundActive) {
			return;
		}

		this.roundActive = false;
		this.targetSpawnTimer?.remove(false);
		this.countdownTimer?.remove(false);

		this.bullets.forEach(bullet => bullet.destroy());
		this.targets.forEach(target => target.destroy());
		this.bullets = [];
		this.targets = [];

		const title = timeUp ? "Level clear" : "Game Over";
		this.resultText.setText(`${title}\nLevel ${this.level}/${Shooter.LEVEL_CONFIGS.length}\nFinal score: ${this.score}\nPress ENTER to return`);
		this.resultText.setVisible(true);

		this.input.keyboard?.once("keydown-ENTER", () => {
			this.emitCompletion(timeUp);
			this.scene.stop();
		});
	}

	private emitCompletion(success: boolean) {
		if (this.completionEmitted) {
			return;
		}

		this.completionEmitted = true;
		const result = {
			level: this.level,
			success,
			score: this.score,
			returnSceneKey: this.returnSceneKey
		};

		this.events.emit("shooter-complete", result);

		const returnScene = this.scene.get(this.returnSceneKey) as Phaser.Scene | undefined;
		returnScene?.events.emit("shooter-complete", result);
	}

	private cleanup() {
		this.targetSpawnTimer?.remove(false);
		this.countdownTimer?.remove(false);
		this.maskGraphics?.destroy();
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Shooter;
