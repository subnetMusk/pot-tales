import * as Phaser from "phaser";

// Phaser's concrete Sound classes (WebAudioSound/HTML5AudioSound/NoAudioSound) all implement
// setVolume(), but the common BaseSound return type of scene.sound.add() does not declare it.
function setSoundVolume(sound: Phaser.Sound.BaseSound, volume: number): void {
	(sound as Phaser.Sound.BaseSound & { setVolume?: (value: number) => unknown }).setVolume?.(volume);
}

interface TrackedSound {
	sound: Phaser.Sound.BaseSound;
	baseVolume: number;
}

/**
 * Single global sound entry point (Phaser's `scene.sound` is itself a proxy to one game-wide
 * SoundManager, so a plain module-singleton is enough - no Phaser plugin registration needed).
 * Centralizes volume persistence/math so Main/Music/Effects sliders live-update every
 * currently-playing sound instead of only affecting sounds started after the slider moved.
 */
class SoundManager {
	private game?: Phaser.Game;
	private mainVolume = 1;
	private musicVolume = 1;
	private sfxVolume = 1;
	private activeMusic = new Map<string, TrackedSound>();
	private activeSfx = new Set<TrackedSound>();
	private mainVolumeListeners = new Set<(volume: number) => void>();

	init(game: Phaser.Game): void {
		this.game = game;
		this.mainVolume = Number(localStorage.getItem("mainVolume") ?? "1");
		this.musicVolume = Number(localStorage.getItem("musicVolume") ?? "1");
		this.sfxVolume = Number(localStorage.getItem("sfxVolume") ?? "1");
		this.game.sound.volume = this.mainVolume;
	}

	playMusic(scene: Phaser.Scene, key: string, opts: { loop?: boolean; volume?: number } = {}): void {
		if (this.activeMusic.has(key)) return;
		if (!scene.cache.audio.exists(key)) {
			console.debug(`[SoundManager] "${key}" not loaded, skipping music playback`);
			return;
		}

		const baseVolume = opts.volume ?? 1;
		const sound = scene.sound.add(key, { loop: opts.loop ?? true, volume: baseVolume * this.musicVolume });
		const untrack = () => this.activeMusic.delete(key);
		sound.once(Phaser.Sound.Events.COMPLETE, untrack);
		sound.once(Phaser.Sound.Events.STOP, untrack);
		sound.play();
		this.activeMusic.set(key, { sound, baseVolume });
	}

	stopMusic(key?: string): void {
		if (key) {
			this.activeMusic.get(key)?.sound.stop();
			this.activeMusic.delete(key);
			return;
		}
		this.activeMusic.forEach(({ sound }) => sound.stop());
		this.activeMusic.clear();
	}

	playSfx(scene: Phaser.Scene, key: string, config: Phaser.Types.Sound.SoundConfig = {}): Phaser.Sound.BaseSound | undefined {
		if (!scene.cache.audio.exists(key)) {
			console.debug(`[SoundManager] "${key}" not loaded, skipping SFX playback`);
			return undefined;
		}

		const baseVolume = config.volume ?? 1;
		const sound = scene.sound.add(key, { ...config, volume: baseVolume * this.sfxVolume });
		const tracked: TrackedSound = { sound, baseVolume };
		const untrack = () => this.activeSfx.delete(tracked);
		sound.once(Phaser.Sound.Events.COMPLETE, untrack);
		sound.once(Phaser.Sound.Events.STOP, untrack);
		this.activeSfx.add(tracked);
		sound.play();
		return sound;
	}

	stopAll(): void {
		this.activeMusic.forEach(({ sound }) => sound.stop());
		this.activeMusic.clear();
		this.activeSfx.forEach(({ sound }) => sound.stop());
		this.activeSfx.clear();
	}

	setMainVolume(v: number): void {
		this.mainVolume = v;
		localStorage.setItem("mainVolume", v.toString());
		if (this.game) this.game.sound.volume = v;
		this.mainVolumeListeners.forEach((cb) => cb(v));
	}

	setMusicVolume(v: number): void {
		this.musicVolume = v;
		localStorage.setItem("musicVolume", v.toString());
		this.activeMusic.forEach(({ sound, baseVolume }) => setSoundVolume(sound, baseVolume * v));
	}

	setSfxVolume(v: number): void {
		this.sfxVolume = v;
		localStorage.setItem("sfxVolume", v.toString());
		this.activeSfx.forEach(({ sound, baseVolume }) => setSoundVolume(sound, baseVolume * v));
	}

	getMainVolume(): number {
		return this.mainVolume;
	}

	getMusicVolume(): number {
		return this.musicVolume;
	}

	getSfxVolume(): number {
		return this.sfxVolume;
	}

	// Used by VideoPlayer to keep an HTML5 video's volume (outside the Sound Manager) in sync
	// with Main Volume while a video is already playing.
	onMainVolumeChange(cb: (volume: number) => void): void {
		this.mainVolumeListeners.add(cb);
	}

	offMainVolumeChange(cb: (volume: number) => void): void {
		this.mainVolumeListeners.delete(cb);
	}
}

export const soundManager = new SoundManager();
