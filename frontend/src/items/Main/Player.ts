// You can write more code here
import { launchSubScene } from "../../utils";
import { soundManager } from "../../audio/SoundManager";
import { INVENTORY_REGISTRY_KEY } from "../stageRunState";
import { listenUntilDestroyed } from "../sceneListeners";

/* START OF COMPILED CODE */

class Player extends Phaser.GameObjects.Container {

	constructor(scene: Phaser.Scene, x?: number, y?: number) {
		super(scene, x ?? 13, y ?? 8);

		// hud: a separate top-level container, NOT a child of `this`. Phaser Container children
		// can't have a display depth independent of their container (children render in list
		// order within whatever single depth slot the container occupies), so portrait/settings/
		// inventory icons added directly to `this` are stuck at whatever depth each scene gives
		// the player for gameplay-occlusion purposes (e.g. Stage2 sets it below other effects) —
		this.hud = scene.add.container(scene.scale.width / 2, scene.scale.height / 2);
		this.hud.setDepth(Player.UI_DEPTH);

		// player
		const player = scene.add.sprite(0, 0, "Ch_front", 0) as Phaser.GameObjects.Sprite & { body: Phaser.Physics.Arcade.Body };
		scene.physics.add.existing(player, false);
		player.body.setSize(32, 32, false);
		this.add(player);

		// BottomBound
		const bottomBound = scene.add.rectangle(0, 16, 15, 8);
		bottomBound.isStroked = true;
		this.add(bottomBound);

		// TopBound
		const topBound = scene.add.rectangle(0, 1, 15, 8);
		topBound.isStroked = true;
		this.add(topBound);

		// LeftBound
		const leftBound = scene.add.rectangle(-11, 8, 8, 8);
		leftBound.isStroked = true;
		this.add(leftBound);

		// RightBound
		const rightBound = scene.add.rectangle(11, 8, 8, 8);
		rightBound.isStroked = true;
		this.add(rightBound);

		// TLBound
		const tLBound = scene.add.rectangle(-11, 1, 8, 8);
		tLBound.isStroked = true;
		tLBound.strokeColor = 3211231;
		this.add(tLBound);

		// TRBound
		const tRBound = scene.add.rectangle(11, 1, 8, 8);
		tRBound.isStroked = true;
		tRBound.strokeColor = 3211231;
		this.add(tRBound);

		// BLBound
		const bLBound = scene.add.rectangle(-11, 16, 8, 8);
		bLBound.isStroked = true;
		bLBound.strokeColor = 3211231;
		this.add(bLBound);

		// BRBound
		const bRBound = scene.add.rectangle(11, 16, 8, 8);
		bRBound.isStroked = true;
		bRBound.strokeColor = 3211231;
		this.add(bRBound);

		// darkMask
		const darkMask = scene.add.image(0, 0, "darkMask");
		darkMask.alpha = 0.75;
		darkMask.alphaTopLeft = 0.75;
		darkMask.alphaTopRight = 0.75;
		darkMask.alphaBottomLeft = 0.75;
		darkMask.alphaBottomRight = 0.75;
		this.add(darkMask);

		// playerUi
		const playerUi = scene.add.image(-64, -54, "player_ui");
		playerUi.setScrollFactor(0, 0);
		this.hud.add(playerUi);

		this.player = player;
		this.bottomBound = bottomBound;
		this.topBound = topBound;
		this.leftBound = leftBound;
		this.rightBound = rightBound;
		this.tLBound = tLBound;
		this.tRBound = tRBound;
		this.bLBound = bLBound;
		this.bRBound = bRBound;
		this.darkMask = darkMask;
		this.playerUi = playerUi;

		/* START-USER-CTR-CODE */
		if (this.scene.input && this.scene.input.keyboard) {
			this.rightKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
			this.downKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
			this.upKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
			this.leftKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
		}

		// Create animations for the player
		this.createPlayerAnimations();

		// Start with idle front animation
		this.player.play('idle_front', true);

		// Gli eventi della scena sopravvivono allo shutdown: i due listener vanno tolti quando il
		// Player viene distrutto, altrimenti al riavvio della scena nella stessa pagina (Gioca o
		// Continua dopo una partita finita) scatterebbero su questo Player con this.scene
		// undefined, bloccando il gioco. Vedi sceneListeners.ts.
		listenUntilDestroyed(this.scene.events, "update", (time: number) => this.movePlayer(time), this);
		// hud is anchored once at screen-center (see its creation above); only its scale needs a
		// per-frame refresh so it tracks camera.zoom even though zoom isn't known yet when Player
		// is constructed (each Stage sets it later in its own create()) — same BASE_ZOOM/zoom
		listenUntilDestroyed(this.scene.events, "update", () => this.hud.setScale(Player.HUD_BASE_ZOOM / this.scene.cameras.main.zoom), this);

		this.interactKey = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
		this.interactKey?.on("down", () => {
			// Controllo collisione
			this.controllaInterazioneOggetto();
		});

		// surpriseBalloon: figlio del container (stessa "layer" del player, si muove/scompare
		// insieme a lui), riutilizzato ad ogni surprise() invece di crearne uno nuovo ogni volta.
		const surpriseBalloon = this.scene.add.image(0, -24, "surprise_balloon");
		surpriseBalloon.setScale(0);
		this.add(surpriseBalloon);
		this.surpriseBalloon = surpriseBalloon;

		// settingsIcon: stesso sprite/scena "Settings" usati dal menu, ma mette in pausa la
		// scena di gioco corrente invece di distruggerla — vedi openSettings().
		const settingsIcon = this.scene.add.image(110, -53, "settings");
		settingsIcon.setScale(0.4);
		settingsIcon.setInteractive({ useHandCursor: true }).setScrollFactor(0, 0);
		this.hud.add(settingsIcon);
		this.settingsIcon = settingsIcon;

		let settingsIconBaseScale: number | null = null;
		const tweenSettingsIcon = (factor: number) => {
			settingsIconBaseScale ??= settingsIcon.scale;
			this.scene.tweens.add({ targets: settingsIcon, scale: settingsIconBaseScale * factor, duration: 90, ease: 'Sine.easeOut' });
		};
		settingsIcon
			.on('pointerdown', () => { settingsIcon.setTint(0xbdbdbd); tweenSettingsIcon(0.9); })
			.on('pointerup', () => { settingsIcon.clearTint(); tweenSettingsIcon(1); soundManager.playSfx(this.scene, "ui_click"); this.openSettings(); })
			.on('pointerover', () => { settingsIcon.setTint(0xbababa); tweenSettingsIcon(1.15); soundManager.playSfx(this.scene, "ui_hover"); })
			.on('pointerout', () => { settingsIcon.clearTint(); tweenSettingsIcon(1); });

		// inventoryIcons: player_items è uno spritesheet 12x12, un frame per oggetto nell'ordine
		// in cui viene sbloccato dalla storia. Lo stato è salvato nel registry del game (condiviso
		// fra le scene, sopravvive a scene.start()), così un nuovo Player in Stage2 riparte con
		// gli oggetti già raccolti in Stage1 invece dei soli due iniziali (frame 0 e 1).
		const savedItems = this.scene.registry.get(this.inventoryRegistryKey) as number[] | undefined;
		const startingItems = savedItems ?? [0, 1];
		if (!savedItems) this.scene.registry.set(this.inventoryRegistryKey, startingItems);
		startingItems.forEach(frame => this.addInventoryItem(frame, false));

		/* END-USER-CTR-CODE */
	}

	private player: Phaser.GameObjects.Sprite & { body: Phaser.Physics.Arcade.Body };
	private bottomBound: Phaser.GameObjects.Rectangle;
	private topBound: Phaser.GameObjects.Rectangle;
	private leftBound: Phaser.GameObjects.Rectangle;
	private rightBound: Phaser.GameObjects.Rectangle;
	private tLBound: Phaser.GameObjects.Rectangle;
	private tRBound: Phaser.GameObjects.Rectangle;
	private bLBound: Phaser.GameObjects.Rectangle;
	private bRBound: Phaser.GameObjects.Rectangle;
	private darkMask: Phaser.GameObjects.Image;
	private playerUi: Phaser.GameObjects.Image;
	private surpriseBalloon: Phaser.GameObjects.Image;
	private inventoryIcons: Phaser.GameObjects.Image[] = [];
	// Frame corrispondente a ciascuna icona in inventoryIcons, stesso indice — necessario a
	// removeInventoryItem() per trovare quale icona/voce di registry rimuovere dato un frame.
	private inventoryFrames: number[] = [];
	private settingsIcon: Phaser.GameObjects.Image;

	/* START-USER-CODE */
	// Always-on-top portrait/settings/inventory cluster — see its creation in the constructor.
	private hud: Phaser.GameObjects.Container;
	private static readonly UI_DEPTH = 900;
	// Zoom di riferimento su cui sono tarati gli offset/scale degli elementi hud (vedi la loro
	// creazione sopra) — stessa convenzione di PopupManager.BASE_ZOOM / QuizManager's BASE_ZOOM.
	private static readonly HUD_BASE_ZOOM = 5;

	private stepSize: number = 8;					// Grandezza del passo
	private stepDelay: number = 100;				// Attesa in ms tra i frame
	private BoundsDebug: boolean = true;			// Se true mostra i boundaries
    private movementAllowed: boolean = true;       	// Disabilita l'input
	public interactionAllowed: boolean = true;  	// Disabilita l'interazione con gli oggetti	


	// Input della tastiera
	private rightKey!: Phaser.Input.Keyboard.Key;
	private downKey!: Phaser.Input.Keyboard.Key;
	private upKey!: Phaser.Input.Keyboard.Key;
	private leftKey!: Phaser.Input.Keyboard.Key;
	private interactKey?: Phaser.Input.Keyboard.Key;

	// Posizioni degli slot oggetto nell'HUD, relative al centro di playerUi (a destra del
	// ritratto). Un'offset per ogni oggetto mostrato all'avvio: aggiungerne altre qui quando
	// la storia introduce nuovi oggetti da mostrare fin da subito.
	private inventorySlotOffsets: { x: number; y: number }[] = [
		{ x: -27, y: 2 },
		{ x: -12, y: 2 },
		{ x: 3, y: 2 },
		{ x: 18, y: 2 },
		{ x: 33, y: 2 },
		{ x: 48, y: 2 },
		{ x: 63, y: 2 },
		{ x: 78, y: 2 },
		{ x: 93, y: 2 },
	];

	// Chiave nel registry del game (condiviso fra le scene) sotto cui è salvato l'elenco dei
	// frame di player_items già sbloccati, in ordine. Il Menu la svuota a ogni nuova partita
	// (vedi clearRunRegistry() in stageRunState.ts).
	private readonly inventoryRegistryKey = INVENTORY_REGISTRY_KEY;

	boundaries : Phaser.GameObjects.Rectangle[] = [];
	private slowAreas: Array<{ zone: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite | Phaser.GameObjects.Image; multiplier: number }> = [];

	lastMoveTime: number = 0;						// Tempo dell'ultimo movimento (per l'effetto a bassi fps)
	lastStep: boolean = false;						// Ultima textura usata
	direction: 'front' | 'back' | 'side' = 'front';	// Direzione in cui sto guardando

	public set isMovementAllowed(state : boolean) {
		this.movementAllowed = state;

		// Reset della texture
		if (!state) this.updateIdleTexture();
	}

	// Create animations for the player
	private createPlayerAnimations() {
		const anims = this.scene.anims;

		// Idle animations (standing frame of each direction's sheet)
		if (!anims.exists('idle_side')) {
			anims.create({
				key: 'idle_side',
				frames: [{ key: 'Ch_side', frame: 0 }],
				frameRate: 1,
				repeat: -1
			});
		}

		if (!anims.exists('idle_front')) {
			anims.create({
				key: 'idle_front',
				frames: [{ key: 'Ch_front', frame: 0 }],
				frameRate: 1,
				repeat: -1
			});
		}

		if (!anims.exists('idle_back')) {
			anims.create({
				key: 'idle_back',
				frames: [{ key: 'Ch_back', frame: 0 }],
				frameRate: 1,
				repeat: -1
			});
		}

		// Walk down animation
		if (!anims.exists('walk_down')) {
			anims.create({
				key: 'walk_down',
				frames: anims.generateFrameNumbers('Ch_front', { start: 0, end: -1 }),
				frameRate: 8,
				repeat: -1
			});
		}

		// Walk side animation
		if (!anims.exists('walk_side')) {
			anims.create({
				key: 'walk_side',
				frames: anims.generateFrameNumbers('Ch_side', { start: 0, end: -1 }),
				frameRate: 8,
				repeat: -1
			});
		}

		// Walk up animation
		if (!anims.exists('walk_up')) {
			anims.create({
				key: 'walk_up',
				frames: anims.generateFrameNumbers('Ch_back', { start: 0, end: -1 }),
				frameRate: 8,
				repeat: -1
			});
		}
	}

	// Check dell'overlap fra due rettangoli ᓚᘏᗢ
	private checkOverlap(rect1: Phaser.GameObjects.Rectangle, rect2: Phaser.GameObjects.Rectangle): boolean {
		const rect1WorldX = this.x + rect1.x;
		const rect1WorldY = this.y + rect1.y;

		const bounds1 = new Phaser.Geom.Rectangle(
			rect1WorldX - rect1.width / 2,
			rect1WorldY - rect1.height / 2,
			rect1.width,
			rect1.height
		);
		const bounds2 = new Phaser.Geom.Rectangle(
			rect2.x - rect2.width / 2,
			rect2.y - rect2.height / 2,
			rect2.width,
			rect2.height
		);
		return Phaser.Geom.Rectangle.Overlaps(bounds1, bounds2);
	}

	// True se bound sovrappone un qualsiasi boundary della scena (movimento cardinale bloccato)
	private isBlockedInDirection(bound: Phaser.GameObjects.Rectangle): boolean {
		for (const boundary of this.boundaries) {
			if (this.checkOverlap(bound, boundary)) return true;
		}
		return false;
	}

	// Risolve la collisione diagonale controllando TUTTI i boundary (non solo il primo che
	// trova), così due boundary distinti possono azzerare dx e dy indipendentemente,
	// esattamente come nel controllo cardinale-per-cardinale precedente.
	private resolveDiagonalCollision(
		cornerBound: Phaser.GameObjects.Rectangle,
		axisXBound: Phaser.GameObjects.Rectangle,
		axisYBound: Phaser.GameObjects.Rectangle,
		dx: number,
		dy: number
	): { dx: number; dy: number } {
		for (const boundary of this.boundaries) {
			if (!this.checkOverlap(cornerBound, boundary)) continue;

			const hitX = this.checkOverlap(axisXBound, boundary);
			const hitY = this.checkOverlap(axisYBound, boundary);

			if (hitX && !hitY) {
				dx = 0;						// Solo collisione laterale
			} else if (hitY && !hitX) {
				dy = 0;						// Solo collisione verticale
			} else {
				dx = 0;						// Collisione con angolo
				dy = 0;
			}
		}
		return { dx, dy };
	}

	// Passaggio della lista dei boundaries dalla scena al player
	// Supporta solo Rectangle, Sprite e Image :3
	public setBoundaries(boundsList : Object[]) {
		for (let i = 0; i < boundsList.length; i++) {
			let obj = boundsList[i];

			// Gestione Rectangle
			if (obj instanceof Phaser.GameObjects.Rectangle) {
				obj.visible = this.BoundsDebug;
				this.boundaries.push(obj);
			// Gestione Sprite
			} else if (obj instanceof Phaser.GameObjects.Sprite || obj instanceof Phaser.Physics.Arcade.Sprite) {
				const bounds = obj.getBounds();
				const rect = this.scene.add.rectangle(bounds.x + bounds.width/2, bounds.y + bounds.height/2, bounds.width, bounds.height);
				rect.isStroked = true;
				rect.strokeColor = 0xff0000;
				this.boundaries.push(rect);
			// Gestione Image
			} else if (obj instanceof Phaser.GameObjects.Image) {
				const bounds = obj.getBounds();
				const rect = this.scene.add.rectangle(bounds.x + bounds.width/2, bounds.y + bounds.height/2, bounds.width, bounds.height);
				rect.isStroked = true;
				rect.strokeColor = 0x00ff00;
				this.boundaries.push(rect);
			// Oggetto non supportato
			} else {
				const objName = (obj as any).name || obj.constructor.name || 'oggetto sconosciuto';
				console.log(`L'oggetto ${objName} non può essere convertito in boundary`);
			}
		}
		if (this.BoundsDebug) console.log("Caricati i boundaries");
	}

	// Registra aree in cui il player si muove più lentamente
	public setSlowAreas(areas: Object[]) {
		this.slowAreas = [];

		for (const area of areas) {
			const candidate = area as any;
			const zone = candidate.zone ?? candidate;
			const multiplier = Phaser.Math.Clamp(candidate.multiplier ?? 0.5, 0.1, 1);

			if (zone instanceof Phaser.GameObjects.Rectangle ||
				zone instanceof Phaser.GameObjects.Sprite ||
				zone instanceof Phaser.GameObjects.Image) {
				this.slowAreas.push({ zone, multiplier });
			}
		}
	}

	private isPlayerInsideZone(zone: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite | Phaser.GameObjects.Image): boolean {
		const playerBounds = this.getBounds();
		const zoneBounds = zone.getBounds();
		return Phaser.Geom.Rectangle.Overlaps(playerBounds, zoneBounds);
	}

	private getMovementMultiplier(): number {
		let multiplier = 1;

		for (const area of this.slowAreas) {
			if (this.isPlayerInsideZone(area.zone)) {
				multiplier = Math.min(multiplier, area.multiplier);
			}
		}

		return multiplier;
	}

	// Disabilita l'effetto della torica
	public flashlight(state : boolean) {
		this.darkMask.visible = state;
	}

	// Abilita o disabilita la player ui
	public playerUiVisible(state: boolean) {
		this.playerUi.visible = state;
	}

	// Imposta il ritardo tra i passi in millisecondi (valori più alti = movimento più lento)
	public setStepDelay(delay: number) {
		this.stepDelay = delay;
	}


	// Aggiunge un oggetto all'inventario: crea l'icona nel prossimo slot libero dell'HUD
	// usando il frame indicato di player_items. Gli slot si riempiono in ordine, linearmente
	// con il progredire della storia. persist=false è usato solo per ricreare gli oggetti già
	// salvati nel registry all'avvio (per non duplicarli), altrimenti va sempre lasciato true.
	// Ritorna l'icona creata (o undefined se non c'è più spazio) così un chiamante può
	// eventualmente modificarla subito dopo (es. nasconderla se la HUD è già in fade-out).
	public addInventoryItem(frame: number, persist: boolean = true): Phaser.GameObjects.Image | undefined {
		const slotIndex = this.inventoryIcons.length;
		const offset = this.inventorySlotOffsets[slotIndex];

		if (!offset) {
			console.log("Nessuno slot libero nell'inventario per il frame", frame);
			return undefined;
		}

		const icon = this.scene.add.image(this.playerUi.x + offset.x, this.playerUi.y + offset.y, "player_items", frame);
		icon.setScrollFactor(0, 0);
		this.hud.add(icon);
		this.inventoryIcons.push(icon);
		this.inventoryFrames.push(frame);

		if (persist) {
			const saved = (this.scene.registry.get(this.inventoryRegistryKey) as number[] | undefined) ?? [];
			this.scene.registry.set(this.inventoryRegistryKey, [...saved, frame]);
		}

		return icon;
	}

	// Rimuove una singola istanza dell'oggetto con questo frame dall'inventario (usato dai
	// quiz di Stage3 per "consumare" un oggetto raccolto in precedenza): distrugge la sua
	// icona, ricompatta le icone rimanenti sui loro nuovi slot e toglie una sola occorrenza
	// corrispondente dal registry.
	public removeInventoryItem(frame: number): void {
		const index = this.inventoryFrames.indexOf(frame);
		if (index === -1) {
			console.log("Nessun oggetto in inventario con il frame", frame);
			return;
		}

		const [icon] = this.inventoryIcons.splice(index, 1);
		this.inventoryFrames.splice(index, 1);
		icon.destroy();
		this.relayoutInventoryIcons();

		const saved = (this.scene.registry.get(this.inventoryRegistryKey) as number[] | undefined) ?? [];
		const savedIndex = saved.indexOf(frame);
		if (savedIndex !== -1) {
			const next = [...saved];
			next.splice(savedIndex, 1);
			this.scene.registry.set(this.inventoryRegistryKey, next);
		}
	}

	// Riposiziona le icone rimaste sui loro (eventualmente nuovi) slot dopo una rimozione,
	// così non resta un buco vuoto in mezzo alla fila — lo slot di ciascuna è sempre il suo
	// indice corrente nell'array, stessa convenzione usata da addInventoryItem().
	private relayoutInventoryIcons(): void {
		this.inventoryIcons.forEach((icon, slotIndex) => {
			const offset = this.inventorySlotOffsets[slotIndex];
			if (offset) {
				icon.setPosition(this.playerUi.x + offset.x, this.playerUi.y + offset.y);
			}
		});
	}

	// Apre la scena Settings (la stessa usata dal menu) mettendo in pausa la scena di gioco
	// corrente invece di distruggerla con scene.start(); il back button di Settings la
	// riprende al posto di tornare al Menu (vedi Settings.ts). Salva/ripristina lo stato
	// precedente di movimento/interazione invece di riabilitarli a forza, per non riaccendere
	// per errore l'input se le impostazioni vengono aperte durante una cutscene che li aveva
	// già disabilitati.
	public openSettings(): void {
		const parentScene = this.scene;
		const wasMovementAllowed = this.movementAllowed;
		const wasInteractionAllowed = this.interactionAllowed;

		this.isMovementAllowed = false;
		this.interactionAllowed = false;

		launchSubScene(
			parentScene,
			"Settings",
			{ launchData: { returnSceneKey: parentScene.scene.key }, completionEvent: "resume", listenOn: "parent" },
			() => {
				this.isMovementAllowed = wasMovementAllowed;
				this.interactionAllowed = wasInteractionAllowed;
			}
		);
	}

	// Mostra il balloon "!" sopra al player (figlio del container, sempre presente), per un
	// beat di sorpresa/attenzione: pop-in, piccolo bob, hold, poi fade-out.
	public surprise(): void {
		const balloon = this.surpriseBalloon;
		balloon.setScale(0);
		balloon.setAlpha(1);
		balloon.y = -24;

		this.scene.tweens.add({
			targets: balloon,
			scale: 1,
			duration: 220,
			ease: "Back.easeOut",
			onComplete: () => {
				this.scene.tweens.add({
					targets: balloon,
					y: balloon.y - 3,
					duration: 260,
					yoyo: true,
					repeat: 1,
					ease: "Sine.easeInOut",
					onComplete: () => {
						this.scene.time.delayedCall(400, () => {
							this.scene.tweens.add({
								targets: balloon,
								alpha: 0,
								scale: 0.6,
								duration: 180,
								ease: "Power2.easeIn"
							});
						});
					}
				});
			}
		});
	}

	// Nasconde la UI (ritratto, bottone impostazioni, icone inventario) con un fade, invece di
	// un semplice toggle di visible come playerUiVisible: usato dalla cutscene finale, dove la
	// UI deve sparire gradualmente invece che di colpo.
	public fadeOutUi(duration: number = 500): Promise<void> {
		const elements: Phaser.GameObjects.Image[] = [this.playerUi, this.settingsIcon, ...this.inventoryIcons];
		this.settingsIcon.disableInteractive();

		return new Promise(resolve => {
			this.scene.tweens.add({
				targets: elements,
				alpha: 0,
				duration,
				ease: "Quad.easeInOut",
				onComplete: () => {
					elements.forEach(el => el.visible = false);
					resolve();
				}
			});
		});
	}

	// Dissolve la vignetta darkMask invece dello switch immediato di flashlight().
	public fadeOutFlashlight(duration: number = 500): Promise<void> {
		return new Promise(resolve => {
			this.scene.tweens.add({
				targets: this.darkMask,
				alpha: 0,
				duration,
				ease: "Quad.easeInOut",
				onComplete: () => resolve()
			});
		});
	}

	// Caduta accelerata: il container scende (una discesa netta, non solo un piccolo scarto),
	// si rimpicciolisce e sfuma, con un ease "in" così il movimento accelera invece di essere
	// lineare. Nessun cambio di animazione qui: mantiene l'ultima posa idle impostata da
	// walkTo() invece di un ciclo di camminata, così la caduta legge come "sprofondare", non
	// "camminare all'ingiù". Come jump(), è puramente cosmetica (nessuna fisica reale) — usata
	// per il beat finale in cui il player viene inghiottito dal cratere.
	public fallDown(duration: number = 800): Promise<void> {
		return new Promise(resolve => {
			soundManager.playSfx(this.scene, "cartoon_fall");
			this.scene.tweens.add({
				targets: this,
				y: this.y + 260,
				scaleX: 0.15,
				scaleY: 0.15,
				alpha: 0,
				duration,
				ease: "Cubic.easeIn",
				onComplete: () => resolve()
			});
		});
	}

	// Salto cosmetico (squash-stretch + offset verticale sullo sprite interno): questo è un
	// gioco top-down senza gravità/fisica di salto, quindi non è un vero movimento verticale.
	// Chiamato due volte in sequenza per un "doppio salto" celebrativo (es. attivazione laser).
	public jump(): Promise<void> {
		const sprite = this.player;
		const baseY = sprite.y;

		return new Promise(resolve => {
			this.scene.tweens.add({
				targets: sprite,
				scaleX: 1.15,
				scaleY: 0.85,
				duration: 70,
				ease: "Sine.easeOut",
				onComplete: () => {
					this.scene.tweens.add({
						targets: sprite,
						y: baseY - 10,
						scaleX: 0.95,
						scaleY: 1.1,
						duration: 140,
						ease: "Sine.easeOut",
						yoyo: true,
						onComplete: () => {
							sprite.setScale(1);
							sprite.y = baseY;
							resolve();
						}
					});
				}
			});
		});
	}

	public debug(v : boolean) {
			this.BoundsDebug = v;
			this.leftBound.visible = v;
			this.rightBound.visible = v;
			this.topBound.visible = v;
			this.bottomBound.visible = v;
			this.tLBound.visible = v;
			this.tRBound.visible = v;
			this.bLBound.visible = v;
			this.bRBound.visible = v;
			this.boundaries.forEach(b => b.visible = v);
	}

	// Funzione di movimento
	private movePlayer(time: number) {

        // Condizioni per il movimento:
        if (!this.movementAllowed) return;                          // Input deve essere abilitato
        if (this.player.body === null) return;                      // Player non deve essere null

		const movementMultiplier = this.getMovementMultiplier();
		this.player.anims.timeScale = movementMultiplier;
        const effectiveStepDelay = this.stepDelay / movementMultiplier;
        if (time - this.lastMoveTime < effectiveStepDelay) return;      // Passato il tempo minimo dal passo precedente

        let dx = 0;                                         // Spostamento orizzontale
        let dy = 0;                                         // Spostamento verticale
        let moving = false;                                 // Stato del movimento

		const effectiveStepSize = this.stepSize * movementMultiplier;

        if (this.upKey.isDown && !this.downKey.isDown) {            // Freccia sù
            dy = -effectiveStepSize;                                    // Spostamento
            this.direction = "back";                                // Nuova direzione
            moving = true;                                          // Aggiornamento stato

            if (this.isBlockedInDirection(this.topBound)) dy = 0;      // Collisione: annullo il movimento
        } else if (this.downKey.isDown && !this.upKey.isDown) {
            dy = effectiveStepSize;                                     // Spostamento
            this.direction = "front";                               // Nuova direzione
            moving = true;                                          // Aggiornamento stato

            if (this.isBlockedInDirection(this.bottomBound)) dy = 0;   // Collisione: annullo il movimento
        }

        // Input orizzontale
        if (this.leftKey.isDown && !this.rightKey.isDown) {
            dx = -effectiveStepSize;                                    // Spostamento
            this.direction = "side";                                // Nuova direzione
            this.player.setFlipX(false);                      		// Flip della texture
            moving = true;                                          // Aggiornamento stato

            if (this.isBlockedInDirection(this.leftBound)) dx = 0;     // Collisione: annullo il movimento
        } else if (this.rightKey.isDown && !this.leftKey.isDown) {
            dx = effectiveStepSize;                                    	// Spostamento
            this.direction = "side";                                // Nuova direzione
            this.player.setFlipX(true);                      		// Flip della texture
            moving = true;                                          // Aggiornamento stato

            if (this.isBlockedInDirection(this.rightBound)) dx = 0;    // Collisione: annullo il movimento
        }

        // Input diagonale
        if (this.rightKey.isDown && this.downKey.isDown) {
            ({ dx, dy } = this.resolveDiagonalCollision(this.bRBound, this.rightBound, this.bottomBound, dx, dy));
        }
        if (this.rightKey.isDown && this.upKey.isDown) {
            ({ dx, dy } = this.resolveDiagonalCollision(this.tRBound, this.rightBound, this.topBound, dx, dy));
        }
        if (this.leftKey.isDown && this.downKey.isDown) {
            ({ dx, dy } = this.resolveDiagonalCollision(this.bLBound, this.leftBound, this.bottomBound, dx, dy));
        }
        if (this.leftKey.isDown && this.upKey.isDown) {
            ({ dx, dy } = this.resolveDiagonalCollision(this.tLBound, this.leftBound, this.topBound, dx, dy));
        }
        // Se non mi sto muovendo carico la texture stazionaria
        if (!moving) {
            this.updateIdleTexture();
            return;
        }

        // Normalizzo il movimento diagonale
        if (dx !== 0 && dy !== 0) {
            dx /= Math.sqrt(2);
            dy /= Math.sqrt(2);
        }

        // Altrimenti, aggiorno la posizione e salvo il timestamp dell'ultimo passo
        this.x += dx;
        this.y += dy;

        this.lastMoveTime = time;
        this.updateMoveTexture(); 			// Qui viene invertito lastStep
	}

	private updateIdleTexture() {
		switch (this.direction) {			// Play idle animation based on direction
			case "front":
				this.player.play('idle_front', true);
				break;
			case "back":
				this.player.play('idle_back', true);
				break;
			case "side":
				this.player.play('idle_side', true);
				break;
		}
	}

	private updateMoveTexture() {
		if (this.direction === "front") {
			this.player.play('walk_down', true);
		} else if (this.direction === "back") {
			this.player.play('walk_up', true);
		} else if (this.direction === "side") {
			this.player.play('walk_side', true);
		}

		this.lastStep = !this.lastStep;
	}

	// Muove il player verso (x, y) con l'animazione di camminata corretta per la direzione di
	// spostamento, invece di un semplice tween di posizione senza feedback visivo — usato per
	// farlo "uscire" da un oggetto (es. torretta) prima che un'attivazione proceda.
	public walkTo(x: number, y: number, duration: number): Promise<void> {
		const dx = x - this.x;
		const dy = y - this.y;

		if (Math.abs(dx) > Math.abs(dy)) {
			this.direction = "side";
			this.player.setFlipX(dx > 0);
		} else {
			this.direction = dy < 0 ? "back" : "front";
		}
		this.updateMoveTexture();

		return new Promise(resolve => {
			this.scene.tweens.add({
				targets: this,
				x,
				y,
				duration,
				ease: "Sine.easeInOut",
				onComplete: () => {
					this.updateIdleTexture();
					resolve();
				}
			});
		});
	}

	private controllaInterazioneOggetto() {
		if (!this.interactionAllowed) return;  	// Controlla se l'interazione è permessa
		const oggVector = (this.scene as any).oggVector as { x: number; y: number; set: boolean; interagisci: () => void; interactionRadius?: number; }[] | undefined;

        if (oggVector) for (const ogg of oggVector) {
            const raggio = ogg.interactionRadius ?? 32;
            const distanza = Phaser.Math.Distance.Between(this.x, this.y, ogg.x, ogg.y);
            if (distanza < raggio && ogg.set && typeof ogg.interagisci === "function") {
                ogg.interagisci();
                break;
            }
        }
	}
	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
export default Player;
