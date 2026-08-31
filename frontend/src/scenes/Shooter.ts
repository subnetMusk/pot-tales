import MenuBackground from "../items/UI/MenuBackground";
import PopupManager from "../items/UI/PopupManager";
import { playSequence } from "../utils";

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
	private static readonly HUD_DEPTH = 500;
	private static readonly PLAYFIELD_DEPTH = 2;

	private static readonly PLAYER_MARGIN = 40;
	private static readonly GUN_BOTTOM_OFFSET = 40;
	private static readonly GUN_ENTRANCE_RISE = 140;
	private static readonly GUN_ENTRANCE_DURATION_MS = 1800;
	private static readonly BARREL_OFFSET_Y = 30;
	private static readonly BULLET_SPEED = 16;
	private static readonly OFFSCREEN_MARGIN = 8;
	private static readonly COLLISION_DISTANCE = 34;
	// Arcade Physics velocities are px/sec, but BULLET_SPEED/targetSpeed above were tuned as
	// px/frame at the game's nominal 60fps — multiply by this to get an equivalent velocity.
	private static readonly PHYSICS_FPS = 60;

	private static readonly TARGET_SPAWN_MARGIN = 32;
	private static readonly TARGET_SPAWN_Y_OFFSET = 20;
	private static readonly LINE_PATTERN_COUNT = 3;
	private static readonly LINE_PATTERN_SPACING = 60;
	private static readonly V_PATTERN_OFFSET = 60;
	private static readonly V_PATTERN_SLOPE = 0.4;
	private static readonly DIAGONAL_PATTERN_COUNT = 3;
	private static readonly DIAGONAL_SPACING_X = 70;
	private static readonly DIAGONAL_SPACING_Y = 40;
	private static readonly SPREAD_PATTERN_COUNT = 4;
	private static readonly SPREAD_PATTERN_WIDTH = 220;
	private static readonly SPREAD_PATTERN_Y_JITTER = 30;

	private static readonly COUNTDOWN_INTERVAL_MS = 1000;
	private static readonly MIN_LEVEL = 1;
	private static readonly GUN_ANIM_FRAMERATE = 40;
	private static readonly PROJ_ANIM_FRAMERATE = 36;
	private static readonly BASE_POINTS = 10;

	private static readonly LEVEL_CONFIGS: ReadonlyArray<{
		timeLeft: number; lives: number; targetDelay: number; bulletCooldown: number; targetSpeed: number; playerSpeed: number; patternChance: number;
	}> = [
		{ timeLeft: 30, lives: 4, targetDelay: 760, bulletCooldown: 210, targetSpeed: 1.1, playerSpeed: 5, patternChance: 0.35 },
		{ timeLeft: 28, lives: 4, targetDelay: 680, bulletCooldown: 195, targetSpeed: 1.45, playerSpeed: 5.5, patternChance: 0.5 },
		{ timeLeft: 28, lives: 3, targetDelay: 680, bulletCooldown: 195, targetSpeed: 1.45, playerSpeed: 5.5, patternChance: 0.65 }
	];

	private readonly targetTiers: Array<{ id: string; pointsMultiplier: number; weight: number; tint: number; scale: number }> = [
		{ id: "common", pointsMultiplier: 1, weight: 65, tint: 0xffffff, scale: 1.0 },
		{ id: "swift", pointsMultiplier: 2, weight: 25, tint: 0x8fd3ff, scale: 0.85 },
		{ id: "rare", pointsMultiplier: 4, weight: 10, tint: 0xffd75e, scale: 0.75 }
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

	// Scrolling backdrop, built from two stacked+recycled images (not a TileSprite) because the
	// source photos are already close to Phaser's max single-texture dimension, so they can't be
	// doubled in height to build one self-mirroring texture. Instead we alternate the normal and
	// pre-flipped image across a small pool of tiles: consecutive tiles always alternate texture,
	// which keeps every seam matched (a flipY image's top row equals the source's bottom row).
	private backgroundTiles: Phaser.GameObjects.Image[] = [];
	private backgroundTileHeight = 0;
	private backgroundNormalKey = "";
	private backgroundFlipKey = "";

	private cannon!: Phaser.GameObjects.Sprite;
	private bullets!: Phaser.Physics.Arcade.Group;
	private targets!: Phaser.Physics.Arcade.Group;
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
	private popupManager?: PopupManager;

	preload() {
		this.load.pack("icons-pack", "assets/images/icons-pack.json");
		this.load.pack("stage2-pack", "assets/images/stage2-pack.json");

		const lang = localStorage.getItem("lang") || "en";
		this.load.json("shooter_i18n", `assets/i18n/${lang}/Shooter.json`);
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

		// HUD text defaults to depth 0, same as the playfield's background before it existed —
		// now that the playfield renders an opaque scrolling backdrop above depth 0, the HUD
		// needs to sit above the playfield (but still below the shooter_screen frame) to stay visible
		this.timerText.setDepth(Shooter.HUD_DEPTH);
		this.scoreText.setDepth(Shooter.HUD_DEPTH);
		this.resultText.setDepth(Shooter.HUD_DEPTH);

		// (re)build the masked playfield container that clips all gun/bullet/target sprites
		// to the visible display rect
		this.playfield?.destroy();
		this.maskGraphics?.destroy();
		this.bullets?.destroy(true, true);
		this.targets?.destroy(true, true);
		this.backgroundTiles = [];
		this.maskGraphics = this.make.graphics(undefined, false);
		this.maskGraphics.fillStyle(0xffffff);
		this.maskGraphics.fillRect(this.screenLeft, this.screenTop, Shooter.SCREEN_WIDTH, Shooter.SCREEN_HEIGHT);
		this.playfield = this.add.container(0, 0);
		this.playfield.setDepth(Shooter.PLAYFIELD_DEPTH);
		this.playfield.setMask(this.maskGraphics.createGeometryMask());

		// bullets/targets are plain Arcade sprites reparented into the (fixed at 0,0,
		// never scaled/rotated) playfield container for masking — their physics bodies
		// track sprite.x/y directly, which stays correct only because the container never
		// applies its own transform.
		this.bullets = this.physics.add.group();
		this.targets = this.physics.add.group();
		this.physics.add.overlap(this.bullets, this.targets, this.onBulletHitTarget, undefined, this);

		this.fireCooldownUntil = 0;
		this.completionEmitted = false;
		this.targetSpawnTimer?.remove(false);
		this.countdownTimer?.remove(false);
		this.popupManager?.destroy();

		this.level = Math.max(Shooter.MIN_LEVEL, Math.min(Shooter.LEVEL_CONFIGS.length, data.level ?? Shooter.MIN_LEVEL));
		this.returnSceneKey = data.returnSceneKey ?? "Stage2";
		this.levelConfig = Shooter.LEVEL_CONFIGS[this.level - 1];

		this.score = 0;
		this.timeLeft = this.levelConfig.timeLeft;
		this.lives = this.levelConfig.lives;
		this.roundActive = false;

		this.refreshHud();

		// scrolling backdrop — added first so it renders behind the gun/bullets/targets also
		// added to the playfield below
		this.setupScrollingBackground(this.level);

		// create player gun sprite (from spritesheet) and place it inside the masked playfield.
		// It starts below the visible display (clipped by the playfield mask, so invisible) and
		// eases up to its resting firing position, overshooting past it before settling back —
		// the "spaceship" arriving and decelerating into place.
		const gunRestY = this.screenBottom - Shooter.GUN_BOTTOM_OFFSET;
		const gun = this.add.sprite(Shooter.SCREEN_CENTER_X, gunRestY + Shooter.GUN_ENTRANCE_RISE, "electron_gun", 0);
		this.playfield.add(gun);
		this.cannon = gun;
		this.tweens.add({
			targets: gun,
			y: gunRestY,
			duration: Shooter.GUN_ENTRANCE_DURATION_MS,
			ease: "Back.easeOut"
		});

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

		this.events.once("shutdown", this.cleanup, this);

		const i18n = this.cache.json.get("shooter_i18n");
		if (this.level === Shooter.MIN_LEVEL) {
			this.popupManager = new PopupManager(this);
			void playSequence(this.popupManager, [
				{ message: i18n.tutorial_1, preset: "shooterYou" },
				{ message: i18n.tutorial_2, preset: "shooterHint" },
				{ message: i18n.tutorial_3, preset: "shooterHint" },
				{ message: i18n.tutorial_4, preset: "shooterHint" },
				{ message: i18n.tutorial_5, preset: "shooterHint" },
				{ message: i18n.tutorial_6, preset: "shooterYou" }
			]).then(() => {
				this.startRound();
			});
		} else {
			// brief "get ready" beat before levels 2/3 (no full tutorial replay)
			this.popupManager = new PopupManager(this);
			void playSequence(this.popupManager, [
				{ message: i18n[`prepare_${this.level}`], preset: "shooterHint" }
			]).then(() => {
				this.startRound();
			});
		}
	}

	private startRound() {
		this.roundActive = true;

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
	}

	// Stacks a small pool of full-width images covering the playfield height (plus one spare),
	// alternating the normal/flip textures top-to-bottom so every seam between adjacent tiles
	// is pixel-matched (a flipY image's top row is identical to the source's bottom row).
	private setupScrollingBackground(level: number) {
		this.backgroundNormalKey = `lvl${level}_bg`;
		this.backgroundFlipKey = `lvl${level}_bg_flip`;

		const source = this.textures.get(this.backgroundNormalKey).source[0];
		const scale = Shooter.SCREEN_WIDTH / source.width;
		this.backgroundTileHeight = source.height * scale;

		// one spare tile above the visible area so there's always a full tile ready to slide
		// into view as the stack scrolls downward
		const tileCount = Math.max(2, Math.ceil(Shooter.SCREEN_HEIGHT / this.backgroundTileHeight) + 1);
		this.backgroundTiles = [];
		for (let i = 0; i < tileCount; i += 1) {
			const key = i % 2 === 0 ? this.backgroundNormalKey : this.backgroundFlipKey;
			const tile = this.add.image(Shooter.SCREEN_CENTER_X, this.screenTop - this.backgroundTileHeight + i * this.backgroundTileHeight, key);
			tile.setOrigin(0.5, 0);
			tile.setDisplaySize(Shooter.SCREEN_WIDTH, this.backgroundTileHeight);
			this.playfield.add(tile);
			this.backgroundTiles.push(tile);
		}
	}

	// Scrolls the tile pool downward at the same rate targets fall (levelConfig.targetSpeed,
	// converted from px/frame-at-60fps to px/sec via PHYSICS_FPS, same as target velocities in
	// spawnSingleTarget) to sell the illusion of forward motion, recycling any tile that's
	// scrolled fully past the bottom back above the current topmost tile — flipping its texture
	// so the normal/flip alternation (and therefore the seam match) is preserved indefinitely.
	private updateScrollingBackground(delta: number) {
		if (this.backgroundTiles.length === 0) {
			return;
		}

		const scrollDelta = this.levelConfig.targetSpeed * Shooter.PHYSICS_FPS * (delta / 1000);
		for (const tile of this.backgroundTiles) {
			tile.y += scrollDelta;
		}

		for (const tile of this.backgroundTiles) {
			if (tile.y > this.screenBottom) {
				const topmostTile = this.backgroundTiles.reduce((topmost, t) => (t.y < topmost.y ? t : topmost));
				const previousKey = topmostTile.texture.key;
				tile.y = topmostTile.y - this.backgroundTileHeight;
				tile.setTexture(previousKey === this.backgroundNormalKey ? this.backgroundFlipKey : this.backgroundNormalKey);
			}
		}
	}

	update(time: number, delta: number) {
		// scrolls from the moment the scene is displayed, independent of round/tutorial state
		this.updateScrollingBackground(delta);

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

		// Movement is now driven by each body's velocity (set at spawn time); this loop only
		// destroys sprites once they drift off the visible playfield.
		for (const bullet of [...this.bullets.getChildren()] as Phaser.Physics.Arcade.Sprite[]) {
			if (bullet.y < this.screenTop - Shooter.OFFSCREEN_MARGIN) {
				bullet.destroy();
			}
		}

		for (const target of [...this.targets.getChildren()] as Phaser.Physics.Arcade.Sprite[]) {
			if (target.y > this.screenBottom + Shooter.OFFSCREEN_MARGIN) {
				target.destroy();
				this.lives -= 1;
				this.refreshHud();
				if (this.lives <= 0) {
					this.endRound(false);
					return;
				}
			}
		}
	}

	// Registered via physics.add.overlap() in create() — replaces the old O(bullets x targets)
	// manual distance-check loop with the physics engine's own overlap detection.
	private onBulletHitTarget = (
		bulletObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
		targetObj: Phaser.Types.Physics.Arcade.GameObjectWithBody
	) => {
		const bullet = bulletObj as Phaser.Physics.Arcade.Sprite;
		const target = targetObj as Phaser.Physics.Arcade.Sprite;

		const points = (target.getData("points") as number | undefined) ?? Shooter.BASE_POINTS;
		bullet.destroy();
		target.destroy();
		this.score += points;
		this.refreshHud();
	};

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
		const bullet = this.physics.add.sprite(this.cannon.x, this.cannon.y - Shooter.BARREL_OFFSET_Y, "electron", 0);
		this.playfield.add(bullet);
		// group.add() re-applies the group's default body config (incl. zero velocity) to
		// new members, so it must run before we configure this body — otherwise it clobbers
		// the velocity set below.
		this.bullets.add(bullet);
		bullet.body.setCircle(Shooter.COLLISION_DISTANCE / 2);
		bullet.body.setVelocityY(-Shooter.BULLET_SPEED * Shooter.PHYSICS_FPS);
		bullet.play("proj-fly");
		// ensure projectile stops at last frame when animation finishes
		const projAnim = this.anims.get("proj-fly");
		const lastFrameIdx = projAnim ? projAnim.frames.length - 1 : 0;
		bullet.on("animationcomplete", () => {
			bullet.anims.stop();
			bullet.setFrame(lastFrameIdx);
		}, this);
		// reset gun to frame 0
		this.cannon.setFrame(0);
		this.cannon.anims.stop();
	};

	private spawnTarget() {
		if (!this.roundActive) {
			return;
		}

		if (Math.random() < this.levelConfig.patternChance) {
			const patterns = [
				() => this.spawnLinePattern(),
				() => this.spawnVPattern(),
				() => this.spawnDiagonalPattern(),
				() => this.spawnSpreadPattern()
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

		const target = this.physics.add.sprite(spawnX, spawnY, "minerals", frameIndex);
		this.playfield.add(target);
		// group.add() re-applies the group's default body config (incl. zero velocity) to
		// new members, so it must run before we configure this body — otherwise it clobbers
		// the velocity set below.
		this.targets.add(target);
		target.body.setCircle(Shooter.COLLISION_DISTANCE / 2);
		target.body.setVelocityY(this.levelConfig.targetSpeed * Shooter.PHYSICS_FPS);
		target.setTint(tier.tint);
		target.setScale(tier.scale);
		target.setData("points", Math.round(Shooter.BASE_POINTS * tier.pointsMultiplier));
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

	private spawnSpreadPattern() {
		const halfWidth = Shooter.SPREAD_PATTERN_WIDTH / 2;
		const centerX = Phaser.Math.Between(this.usableSpawnLeft + halfWidth, this.usableSpawnRight - halfWidth);
		const baseY = this.spawnTopY;

		for (let i = 0; i < Shooter.SPREAD_PATTERN_COUNT; i += 1) {
			const x = centerX + Phaser.Math.Between(-halfWidth, halfWidth);
			const y = baseY - Phaser.Math.Between(0, Shooter.SPREAD_PATTERN_Y_JITTER);
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

		this.bullets.clear(true, true);
		this.targets.clear(true, true);

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
		this.popupManager?.destroy();
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Shooter;
