// Shared particle/flash helpers, extracted from GraficoGame's inline spark-texture code so
// other scenes (Shooter, Stage1, ...) can reuse the same "pop"/burst visual language instead
// of duplicating the canvas-drawn texture and emitter configs.

const SPARK_KEY = "fx_spark";

// Idempotent: safe to call every time a scene wants to use spark-based effects.
export function ensureSparkTexture(scene: Phaser.Scene): void {
	if (scene.textures.exists(SPARK_KEY)) return;

	const size = 16;
	const cx = size / 2;
	const cy = size / 2;
	const canvas = scene.textures.createCanvas(SPARK_KEY, size, size);
	const ctx = canvas!.getContext();

	const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
	glow.addColorStop(0, "rgba(255,255,255,1)");
	glow.addColorStop(0.45, "rgba(255,255,255,0.85)");
	glow.addColorStop(1, "rgba(255,255,255,0)");
	ctx.fillStyle = glow;
	ctx.fillRect(0, 0, size, size);

	ctx.strokeStyle = "rgba(255,255,255,0.9)";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(cx, 0.5); ctx.lineTo(cx, size - 0.5);
	ctx.moveTo(0.5, cy); ctx.lineTo(size - 0.5, cy);
	ctx.stroke();

	canvas!.refresh();
}

// Single white/tinted "pop" — used for Shooter's kill-flash and GraficoGame's per-peak hit flash.
// Caller owns nothing; the emitter self-destroys after its one burst finishes.
export function flashBurst(scene: Phaser.Scene, x: number, y: number, opts?: { tint?: number; scale?: number; depth?: number }): void {
	ensureSparkTexture(scene);
	const emitter = scene.add.particles(0, 0, SPARK_KEY, {
		lifespan: 220,
		speed: 0,
		scale: { start: opts?.scale ?? 2.6, end: 0, ease: "Cubic.easeOut" },
		alpha: { start: 0.9, end: 0 },
		tint: opts?.tint ?? 0xffffff,
		blendMode: "ADD",
		emitting: false,
	});
	if (opts?.depth !== undefined) emitter.setDepth(opts.depth);
	emitter.explode(1, x, y);
	scene.time.delayedCall(240, () => emitter.destroy());
}

// Multi-spark radial burst — used for GraficoGame's fireworks/miss-flash and Shooter's
// tier-proportional kill-burst (more/bigger sparks for rarer targets).
export function sparkBurst(scene: Phaser.Scene, x: number, y: number, opts?: {
	count?: number; tint?: number | number[]; speedMin?: number; speedMax?: number; lifespan?: number; blendMode?: "ADD" | "NORMAL"; scale?: number; depth?: number;
}): void {
	ensureSparkTexture(scene);
	const lifespan = opts?.lifespan ?? 950;
	const emitter = scene.add.particles(0, 0, SPARK_KEY, {
		lifespan,
		speed: { min: opts?.speedMin ?? 70, max: opts?.speedMax ?? 150 },
		scale: { start: opts?.scale ?? 1.9, end: 0, ease: "Cubic.easeOut" },
		alpha: { start: 1, end: 0, ease: "Cubic.easeIn" },
		rotate: { start: 0, end: 120 },
		tint: opts?.tint ?? [0xff1744, 0xffd600, 0x00e5ff, 0x7c4dff, 0x00e676],
		blendMode: opts?.blendMode ?? "NORMAL",
		emitting: false,
	});
	if (opts?.depth !== undefined) emitter.setDepth(opts.depth);
	emitter.explode(opts?.count ?? 6, x, y);
	scene.time.delayedCall(lifespan + 50, () => emitter.destroy());
}

// Small plain white circle that pops and fades — used for Shooter's target-kill explosion.
// Unlike flashBurst (a tinted crosshair-shaped spark texture, shared with GraficoGame/Stage2),
// this is a bare Arc shape so it always reads as a clean white circle regardless of caller.
// Pass `container` when the caller renders inside a container with its own depth (e.g. Shooter's
// masked playfield) — without it the circle is added at the scene root at depth 0, which can end
// up hidden behind anything the caller draws at a higher depth.
export function circleBurst(scene: Phaser.Scene, x: number, y: number, opts?: { radius?: number; duration?: number; container?: Phaser.GameObjects.Container }): void {
	const circle = scene.add.circle(x, y, opts?.radius ?? 10, 0xffffff, 0.65);
	circle.setBlendMode(Phaser.BlendModes.ADD);
	opts?.container?.add(circle);
	scene.tweens.add({
		targets: circle,
		scale: 1.8,
		alpha: 0,
		duration: opts?.duration ?? 220,
		ease: "Cubic.easeOut",
		onComplete: () => circle.destroy()
	});
}

// Continuous low-density drift emitter (dust motes / eerie glow). Unlike flashBurst/sparkBurst
// this keeps emitting until told to stop — caller is responsible for calling emitter.stop()
// and destroying it once particles have had time to finish (~lifespan ms later).
export function ambientDrift(scene: Phaser.Scene, x: number, y: number, width: number, height: number, opts?: { tint?: number; frequency?: number }): Phaser.GameObjects.Particles.ParticleEmitter {
	ensureSparkTexture(scene);
	return scene.add.particles(x, y, SPARK_KEY, {
		lifespan: 4000,
		speedY: { min: -6, max: -2 },
		speedX: { min: -3, max: 3 },
		scale: { start: 0.5, end: 0 },
		alpha: { start: 0.25, end: 0 },
		tint: opts?.tint ?? 0x552222,
		blendMode: "ADD",
		frequency: opts?.frequency ?? 600,
		// Phaser's RandomZone accepts a raw Geom shape (Rectangle included) at runtime, but its
		// TS types only declare the { getRandomPoint } function form — cast to bridge the gap.
		emitZone: {
			type: "random",
			source: new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height)
		} as unknown as Phaser.Types.GameObjects.Particles.EmitZoneData,
	});
}
