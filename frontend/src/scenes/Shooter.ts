import MenuBackground from "../items/UI/MenuBackground";
import PopupManager from "../items/UI/PopupManager";
import VideoPlayer from "../items/UI/VideoPlayer";
import { playSequence } from "../utils";
import { circleBurst } from "../items/ParticleFx";

/* START OF COMPILED CODE */

class Shooter extends Phaser.Scene {

	constructor() {
		super("Shooter");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

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

		// time_bar
		const time_bar = this.add.rectangle(911, 492, 12, 264);
		time_bar.setOrigin(0.5, 1);
		time_bar.isFilled = true;
		time_bar.fillColor = 5636095;

		// shooter_screen
		const shooter_screen = this.add.image(640, 360, "shooter_screen");

		this.timerText = timerText;
		this.scoreText = scoreText;
		this.resultText = resultText;
		this.time_bar = time_bar;
		this.shooter_screen = shooter_screen;

		this.events.emit("scene-awake");
	}

	private timerText!: Phaser.GameObjects.Text;
	private scoreText!: Phaser.GameObjects.Text;
	private resultText!: Phaser.GameObjects.Text;
	private time_bar!: Phaser.GameObjects.Rectangle;
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
	// Just under the cabinet bezel/frame so it still renders on top of the video, same as
	// the playfield sits under it — the intro clip should look like it's playing on the
	// arcade screen itself, not floating above the whole scene.
	private static readonly INTRO_VIDEO_DEPTH = 999;
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
	private static readonly SPREAD_PATTERN_COUNT = 3;
	private static readonly SPREAD_PATTERN_WIDTH = 220;
	private static readonly SPREAD_PATTERN_Y_JITTER = 30;

	private static readonly COUNTDOWN_INTERVAL_MS = 1000;
	private static readonly MIN_LEVEL = 1;
	private static readonly PROJ_ANIM_FRAMERATE = 36;

	private static readonly LEVEL_CONFIGS: ReadonlyArray<{
		timeLeft: number; lives: number; targetDelay: number; bulletCooldown: number; targetSpeed: number; playerSpeed: number; patternChance: number;
	}> = [
		{ timeLeft: 30, lives: 4, targetDelay: 820, bulletCooldown: 210, targetSpeed: 1.0, playerSpeed: 5, patternChance: 0.25 },
		{ timeLeft: 28, lives: 4, targetDelay: 780, bulletCooldown: 200, targetSpeed: 1.15, playerSpeed: 6, patternChance: 0.35 },
		{ timeLeft: 28, lives: 4, targetDelay: 600, bulletCooldown: 130, targetSpeed: 1.25, playerSpeed: 6.5, patternChance: 0.55 }
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
	private canFire = true;
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
	private videoPlayer?: VideoPlayer;
	private healthIcons: Phaser.GameObjects.Image[] = [];

	// time_bar drains top-down over the round like a liquid level, so its bottom edge must
	// stay fixed while only its height shrinks — tracked separately from roundActive's
	// second-granular timeLeft so the drain reads as continuous instead of ticking down in
	// visible one-second steps.
	private timeBarInitialHeight = 0;
	private roundStartTime = 0;
	private roundDurationMs = 0;

	preload() {
		this.load.pack("icons-pack", "assets/images/icons-pack.json");
		this.load.pack("stage2-pack", "assets/images/stage2-pack.json");

		const lang = localStorage.getItem("lang") || "en";
		this.load.json("shooter_i18n", `assets/i18n/${lang}/Shooter.json`);
	}

	create(data: { level?: number; returnSceneKey?: string } = {}) {
		this.editorCreate();
		this.cameras.main.setZoom(1.75);

		// "CRT power-on": squash the camera vertically then snap it open, like an old tube TV
		// turning on. Purely a camera-zoom effect, so it applies uniformly to everything drawn
		// this frame onward regardless of setup order below. Popups/tutorial only start once
		// this finishes — while zoomY != zoomX, camera.zoom (the average of the two, which
		// PopupManager uses to size/position itself) is transiently wrong and mispositions
		// the first popup off-screen.
		this.cameras.main.zoomY = 0.02;
		this.tweens.add({
			targets: this.cameras.main,
			zoomY: 1.75,
			duration: 260,
			ease: "Cubic.easeOut",
			onComplete: () => {
				if (this.level === Shooter.MIN_LEVEL) {
					this.playIntroVideo();
				} else {
					this.startIntroSequence();
				}
			}
		});
		const powerOnFlash = this.add.rectangle(Shooter.SCREEN_CENTER_X, Shooter.SCREEN_CENTER_Y, 2000, 2000, 0xffffff, 0.85);
		powerOnFlash.setDepth(Shooter.SHOOTER_SCREEN_DEPTH + 1);
		this.tweens.add({
			targets: powerOnFlash,
			alpha: 0,
			duration: 220,
			ease: "Cubic.easeOut",
			onComplete: () => powerOnFlash.destroy()
		});

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
		// needs to sit above the playfield (but still below the shooter_screen frame) to stay visible.
		// scrollFactor(0) keeps it pinned to the screen instead of jostling with the ambient/
		// life-lost camera shake, which should only read on the playfield itself.
		this.timerText.setDepth(Shooter.HUD_DEPTH);
		this.timerText.setScrollFactor(0);
		this.resultText.setDepth(Shooter.HUD_DEPTH);
		this.resultText.setScrollFactor(0);

		// No points/scoring system — only Time (right) and the health-icon bar (left) remain
		// in the HUD. scoreText is still created by editorCreate() (compiled code) but unused.
		this.scoreText.setVisible(false);
		this.timerText.setOrigin(1, 0);
		this.timerText.setPosition(this.screenRight - 15, 230);

		// time_bar is bottom-anchored in editorCreate() (origin 0.5,1) so shrinking its height
		// below only eats away at the top, leaving the bottom fixed like a liquid running out.
		this.timeBarInitialHeight = this.time_bar.height;

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

		this.canFire = true;
		this.completionEmitted = false;
		this.targetSpawnTimer?.remove(false);
		this.countdownTimer?.remove(false);
		this.popupManager?.destroy();

		this.level = Math.max(Shooter.MIN_LEVEL, Math.min(Shooter.LEVEL_CONFIGS.length, data.level ?? Shooter.MIN_LEVEL));
		this.returnSceneKey = data.returnSceneKey ?? "Stage2";
		this.levelConfig = Shooter.LEVEL_CONFIGS[this.level - 1];

		this.timeLeft = this.levelConfig.timeLeft;
		this.lives = this.levelConfig.lives;
		this.roundActive = false;

		this.buildHealthIcons();
		this.refreshHud();
		this.drawScanlines();

		// gun-shoot's frameRate is derived from this level's bulletCooldown so the animation's
		// duration always exactly matches the fire-rate gate (see canFire) — must be rebuilt every
		// round (not skipped once a "gun-shoot" key exists) since bulletCooldown differs per level.
		if (this.anims.exists("gun-shoot")) {
			this.anims.remove("gun-shoot");
		}
		const gunFrameNames = this.textures.get("electron_gun").getFrameNames().filter((n: any) => n !== "__BASE");
		this.anims.create({
			key: "gun-shoot",
			frames: this.anims.generateFrameNumbers("electron_gun", { start: 0, end: Math.max(0, gunFrameNames.length - 1) }),
			frameRate: (Math.max(1, gunFrameNames.length) * 1000) / this.levelConfig.bulletCooldown,
			repeat: 0
		});
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
	}

	// Real SEM footage shown once before the level-1 tutorial, same video-intro pattern as
	// GraficoGame's IR.mp4, but confined to the arcade screen cutout instead of fullscreen:
	// VideoPlayer lays out its UI assuming a fullscreen 1280x720 canvas, so we shrink the
	// whole container by SCREEN_WIDTH/HEIGHT's ratio to that canvas and reposition it at the
	// screen rect's top-left — every child (video, overlay, skip button, progress bar) scales
	// down together and lands exactly inside SCREEN_WIDTH x SCREEN_HEIGHT, so no mask is needed.
	// Its depth sits just under shooter_screen so the cabinet bezel still frames it, like it's
	// playing on the in-game monitor rather than floating over the whole scene.
	private playIntroVideo() {
		const scaleX = Shooter.SCREEN_WIDTH / 1280;
		const scaleY = Shooter.SCREEN_HEIGHT / 720;

		this.videoPlayer = new VideoPlayer(this, this.screenLeft, this.screenTop);
		this.videoPlayer.setScale(scaleX, scaleY);
		this.videoPlayer.setDepth(Shooter.INTRO_VIDEO_DEPTH);

		this.add.existing(this.videoPlayer);

		this.videoPlayer.loadVideo("SEM.mp4", "fill");
		this.videoPlayer.play();

		this.events.once("video-ended", () => {
			this.time.delayedCall(750, () => {
				this.videoPlayer?.destroy();
				this.videoPlayer = undefined;
				this.startIntroSequence();
			});
		});
	}

	// Scrolling backdrop + gun entrance used to start ticking/tweening in create(), invisibly
	// behind the level-1 intro video — moved here so they only start once the video (if any)
	// has actually ended and startIntroSequence() runs.
	private startGameplayVisuals() {
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
	}

	// Runs once the CRT power-on camera tween finishes (see create()), so PopupManager sees a
	// correctly-restored camera.zoom instead of the transient zoomX/zoomY mismatch mid-tween.
	// Also gated on the level-1 intro video's completion (see playIntroVideo()), so this is the
	// single point where gameplay visuals should actually start becoming visible.
	private startIntroSequence() {
		this.startGameplayVisuals();
		const i18n = this.cache.json.get("shooter_i18n");
		if (this.level === Shooter.MIN_LEVEL) {
			this.popupManager = new PopupManager(this, { anchor: "center" });
			void playSequence(this.popupManager, [
				{ message: i18n.tutorial_1, preset: "shooterYou" },
				{ message: i18n.tutorial_2, preset: "shooterNarrator" },
				{ message: i18n.tutorial_3, preset: "shooterNarrator" },
				{ message: i18n.tutorial_4, preset: "shooterHint" },
				{ message: i18n.tutorial_5, preset: "shooterNarrator" },
				{ message: i18n.tutorial_6, preset: "shooterNarrator" }
			]).then(() => {
				this.startRound();
			});
		} else {
			// brief "get ready" beat before levels 2/3 (no full tutorial replay)
			this.popupManager = new PopupManager(this, { anchor: "center" });
			void playSequence(this.popupManager, [
				{ message: i18n[`prepare_${this.level}`], preset: "shooterHint" }
			]).then(() => {
				this.startRound();
			});
		}
	}

	private startRound() {
		this.roundActive = true;
		this.roundStartTime = this.time.now;
		this.roundDurationMs = this.levelConfig.timeLeft * 1000;

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
		// a no-op until startGameplayVisuals() populates backgroundTiles (see startIntroSequence())
		this.updateScrollingBackground(delta);

		if (!this.roundActive) {
			return;
		}

		this.updateTimeBar();

		const moveSpeed = this.levelConfig.playerSpeed;
		if (this.cursors.left.isDown) {
			this.cannon.x = Math.max(this.playerLeftBound, this.cannon.x - moveSpeed);
		}
		if (this.cursors.right.isDown) {
			this.cannon.x = Math.min(this.playerRightBound, this.cannon.x + moveSpeed);
		}

		if (Phaser.Input.Keyboard.JustDown(this.cursors.space) && this.canFire) {
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
				this.onLifeLost();
				if (this.lives <= 0) {
					this.endRound(false);
					return;
				}
			}
		}
	}

	// Registered via physics.add.overlap() in create() - replaces the old O(bullets x targets)
	// manual distance-check loop with the physics engine's own overlap detection.
	//
	// Typed with Phaser's own callback type instead of narrowing the parameters: overlap()
	// hands the callback anything that can carry a body (sprites, raw bodies, tiles), so
	// declaring narrower parameters would not stop it from passing one of the others, it
	// would only stop the assignment from compiling. The narrowing belongs where the objects
	// are actually used, and both are groups of sprites here.
	private onBulletHitTarget: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (bulletObj, targetObj) => {
		const bullet = bulletObj as Phaser.Physics.Arcade.Sprite;
		const target = targetObj as Phaser.Physics.Arcade.Sprite;

		circleBurst(this, target.x, target.y + target.displayHeight / 2, { container: this.playfield });

		bullet.destroy();
		target.destroy();
	};

	// Camera shake + a brief translucent red flash over the display, so losing a life reads
	// immediately instead of only being noticeable via the HUD text/icons.
	private onLifeLost() {
		this.cameras.main.shake(180, 0.01);
		const flash = this.add.rectangle(Shooter.SCREEN_CENTER_X, Shooter.SCREEN_CENTER_Y, Shooter.SCREEN_WIDTH, Shooter.SCREEN_HEIGHT, 0xff0000, 0.35);
		flash.setDepth(Shooter.HUD_DEPTH + 1);
		this.tweens.add({
			targets: flash,
			alpha: 0,
			duration: 220,
			ease: "Cubic.easeOut",
			onComplete: () => flash.destroy()
		});
	}

	private fireBullet() {
		if (!this.roundActive) {
			return;
		}

		// Block further shots until onGunShootComplete() reopens canFire — gun-shoot's duration
		// is derived from levelConfig.bulletCooldown (see create()), so this can't drift out of
		// sync with the animation length again.
		this.canFire = false;

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
		// allow the next shot, then reset gun to frame 0
		this.canFire = true;
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

		const target = this.physics.add.sprite(spawnX, spawnY, "minerals", frameIndex);
		this.playfield.add(target);
		// group.add() re-applies the group's default body config (incl. zero velocity) to
		// new members, so it must run before we configure this body — otherwise it clobbers
		// the velocity set below.
		this.targets.add(target);
		target.body.setCircle(Shooter.COLLISION_DISTANCE / 2);
		target.body.setVelocityY(this.levelConfig.targetSpeed * Shooter.PHYSICS_FPS);
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

	// Drains time_bar linearly against wall-clock progress through the round (rather than the
	// integer-second timeLeft, which only ticks once per second and would make the bar visibly
	// stair-step). setSize() recomputes the shape's fill geometry; time_bar's bottom-anchored
	// origin (set in editorCreate()) keeps its bottom edge fixed as height shrinks toward it.
	private updateTimeBar() {
		if (this.roundDurationMs <= 0) {
			return;
		}

		const elapsed = this.time.now - this.roundStartTime;
		const fraction = Phaser.Math.Clamp(1 - elapsed / this.roundDurationMs, 0, 1);
		this.time_bar.setSize(this.time_bar.width, this.timeBarInitialHeight * fraction);
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
		const i18n = this.cache.json.get("shooter_i18n");
		this.timerText.setText(i18n.hud_time.replace("{seconds}", String(Math.max(this.timeLeft, 0))));
		this.punchText(this.timerText);
		this.updateHealthIcons();
	}

	private punchText(text: Phaser.GameObjects.Text) {
		this.tweens.add({ targets: text, scale: { from: 1.15, to: 1 }, duration: 150, ease: "Back.easeOut" });
	}

	// One health_icon per starting life, laid out left-to-right on the left side of the
	// display; rebuilt each round since levelConfig.lives can differ per level.
	private buildHealthIcons() {
		this.healthIcons.forEach(icon => icon.destroy());
		this.healthIcons = [];

		const spacing = 22;
		const startX = this.screenLeft + 40;
		// timerText sits at y=230 with a top-left origin (see setOrigin(1, 0) above), so its
		// vertical center is ~14px lower than 230 — offset the icons (center-origin) by that
		// much so the heart row lines up with the label instead of floating above it.
		const y = 244;
		for (let i = 0; i < this.levelConfig.lives; i += 1) {
			const icon = this.add.image(startX + i * spacing, y, "health_icon");
			icon.setDepth(Shooter.HUD_DEPTH);
			icon.setScrollFactor(0);
			icon.setScale(1.2);
			this.healthIcons.push(icon);
		}
	}

	private updateHealthIcons() {
		this.healthIcons.forEach((icon, index) => {
			const alive = index < this.lives;
			if (icon.visible === alive) {
				return;
			}
			if (alive) {
				icon.setVisible(true);
				icon.setScale(0);
				this.tweens.add({ targets: icon, scale: 1.2, duration: 150, ease: "Back.easeOut" });
			} else {
				this.tweens.add({ targets: icon, scale: 0, duration: 150, ease: "Back.easeIn", onComplete: () => icon.setVisible(false) });
			}
		});
	}

	// Faint horizontal-line overlay for a cheap CRT-scanline texture, drawn once per round.
	private drawScanlines() {
		const graphics = this.add.graphics();
		graphics.setDepth(Shooter.SHOOTER_SCREEN_DEPTH - 1);
		graphics.lineStyle(1, 0x000000, 0.08);
		for (let y = this.screenTop; y < this.screenBottom; y += 3) {
			graphics.beginPath();
			graphics.moveTo(this.screenLeft, y);
			graphics.lineTo(this.screenRight, y);
			graphics.strokePath();
		}
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

		const i18n = this.cache.json.get("shooter_i18n");
		const title = timeUp ? i18n.result_level_clear : i18n.result_game_over;
		this.resultText.setText(`${title}\n${i18n.result_press_enter}`);
		this.resultText.setScale(0.6);
		this.resultText.setAlpha(0);
		this.resultText.setVisible(true);
		this.tweens.add({
			targets: this.resultText,
			scale: 1,
			alpha: 1,
			duration: 300,
			ease: "Back.easeOut"
		});

		this.input.keyboard?.once("keydown-ENTER", () => {
			// "CRT power-off": squash the camera back down before the scene actually stops.
			this.tweens.add({
				targets: this.cameras.main,
				zoomY: 0.02,
				duration: 220,
				ease: "Cubic.easeIn",
				onComplete: () => {
					this.emitCompletion(timeUp);
					this.scene.stop();
				}
			});
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
		this.videoPlayer?.destroy();
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Shooter;
