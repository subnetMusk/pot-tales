// You can write more code here
import Player from "@/items/Main/Player";
import PopupManager from "../items/UI/PopupManager";
import QuizManager from "../items/UI/QuizManager";
import { playSequence, reloadTranslations } from "../utils";
import OggettoInterattivo from "../items/Main/OggettoInterattivo";
import { APISession } from "../network/APISession";
import { applyInventoryCheckpoints } from "../items/inventoryCheckpoints";
import { allQuizzesSolved, createStage3RunState, isWithinDoorTrigger } from "../items/stageRunState";
import { soundManager } from "../audio/SoundManager";
import type { QuizAnswer } from "../items/UI/QuizManager";

// Metadati di gioco di un quiz, vedi quizConfig.
type QuizEntry = {
	correctIndex: number;
	consumesFrame: number;
	promptKey: string;
	answerCount: number;
	answerImages?: readonly string[];
};

/* START OF COMPILED CODE */

class Stage3 extends Phaser.Scene {

	constructor() {
		super("Stage3");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

		this.add.image(69.5, 68.5, "stage3");

		// rectangle_1..4: mura di confine, appena fuori dai bordi dello sfondo (stesso schema
		// di Stage1.ts/Stage2.ts).
		const rectangle_1 = this.add.rectangle(69.5, -20, 219, 40);
		const rectangle_2 = this.add.rectangle(69.5, 157, 219, 40);
		const rectangle_3 = this.add.rectangle(-20, 68.5, 40, 217);
		const rectangle_4 = this.add.rectangle(159, 68.5, 40, 217);

		// player
		const player = new Player(this, 69, 76);
		this.add.existing(player);

		// lipidi
		const lipidi = new OggettoInterattivo(this, 119, 66, "lipidi");
		lipidi.setVisible(false);
		this.add.existing(lipidi);

		// cellulosa
		const cellulosa = new OggettoInterattivo(this, 54, 95, "cellulosa");
		cellulosa.setVisible(false);
		this.add.existing(cellulosa);

		// carbon
		const carbon = new OggettoInterattivo(this, 18, 66, "carbon");
		carbon.setVisible(false);
		this.add.existing(carbon);

		// c14: Carbon-14 symbol at the top of the map, scaled to 0.25x
		const c14 = this.add.image(89.5, 10, "c14").setScale(0.25);

		const overlay0 = this.add.image(64, 26, "stage3-over0").setOrigin(0, 0);
		const overlay1 = this.add.image(4, 61, "stage3-over1").setOrigin(0, 0);
		const overlay2 = this.add.image(0, 84, "stage3-over2").setOrigin(0, 0);
		const overlay3 = this.add.image(1, 112, "stage3-over3").setOrigin(0, 0);

		const hitbox_0a = this.add.rectangle(32.5, 40, 65, 28);
		const hitbox_0c = this.add.rectangle(110.5, 40, 55, 28);
		const hitbox_1a = this.add.rectangle(21, 70, 34, 4);
		const hitbox_1b = this.add.rectangle(117, 70, 35, 4);
		const hitbox_2a = this.add.rectangle(51.5, 98, 103, 14);
		const hitbox_3a = this.add.rectangle(14.5, 127, 29, 6);
		const hitbox_3b = this.add.rectangle(64.5, 127.5, 23, 5);

		const door = this.add.image(65, 28, "stage3-door").setOrigin(0, 0);
		const doorHitbox = this.add.rectangle(74, 41, 18, 26);

		// lists
		const boundaries = [rectangle_1, rectangle_2, rectangle_3, rectangle_4];
		const oggVector = [lipidi, cellulosa, carbon];
		const overlayVector = [overlay0, overlay1, overlay2, overlay3];
		const furnitureHitboxes = [hitbox_0a, hitbox_0c, hitbox_1a, hitbox_1b, hitbox_2a, hitbox_3a, hitbox_3b];

		this.player = player;
		this.boundaries = boundaries;
		this.oggVector = oggVector;
		this.lipidi = lipidi;
		this.cellulosa = cellulosa;
		this.carbon = carbon;
		this.overlayVector = overlayVector;
		this.furnitureHitboxes = furnitureHitboxes;
		this.door = door;
		this.doorHitbox = doorHitbox;
		this.c14 = c14;

		this.events.emit("scene-awake");
	}

	private player!: Player;
	private boundaries!: Phaser.GameObjects.Rectangle[];
	private oggVector!: OggettoInterattivo[];
	private overlayVector!: Phaser.GameObjects.Image[];
	private furnitureHitboxes!: Phaser.GameObjects.Rectangle[];
	private door!: Phaser.GameObjects.Image;
	private doorHitbox!: Phaser.GameObjects.Rectangle;
	private lipidi!: OggettoInterattivo;
	private cellulosa!: OggettoInterattivo;
	private carbon!: OggettoInterattivo;
	private c14!: Phaser.GameObjects.Image;

	/* START-USER-CODE */

	private popupManager!: PopupManager;
	private quizManager!: QuizManager;

	// Lingua con cui stage3_i18n è stato caricato l'ultima volta — usata per rilevare un cambio
	// lingua da Settings al resume della scena (stesso schema di Stage1.ts).
	private loadedLang!: string;

	// Metadati di gioco per ogni quiz: quale frame viene consumato dall'inventario nel
	// momento in cui il giocatore interagisce con la luce (deve restare in sync con
	// CHECKPOINT_CONSUMES in inventoryCheckpoints.ts) e quale indice di risposta è corretto.
	// Tenuto nel codice (non nell'i18n) perché è logica di gioco, non contenuto traducibile —
	// stesso schema di GraficoGame.ts.
	// consumesFrame segue la storia: lipidi consuma la fialetta (2, da Stage1), carbon
	// consuma uno dei due oggetti raccolti in Stage2 (4), cellulosa l'altro (5). Nessun
	// frame viene più assegnato in cambio: risolvere il quiz salva solo il checkpoint, la
	// "ricompensa" è l'oggetto stesso che prende il posto della luce pulsante (vedi
	// runQuiz() e setupQuizLights()).
	// promptKey è il prefisso usato dalle chiavi i18n di domanda/risposte del quiz (item_1/2/3,
	// stesso schema di introSequences sotto) — distinto da objKey perché _success/_fail usano
	// invece objKey direttamente (vedi runQuiz()).
	private readonly quizConfig: Record<"lipidi" | "cellulosa" | "carbon", QuizEntry> = {
		lipidi: {
			correctIndex: 2, consumesFrame: 2, promptKey: "item_3", answerCount: 3,
			answerImages: ["grafico1", "grafico2", "grafico3"]
		},
		cellulosa: {
			correctIndex: 2, consumesFrame: 5, promptKey: "item_2", answerCount: 3,
			answerImages: ["sem_fiber_a", "sem_fiber_b", "sem_fiber_c"]
		},
		carbon: { correctIndex: 0, consumesFrame: 4, promptKey: "item_1", answerCount: 4 },
	};

	// Luce pulsante bianca semitrasparente che segnala ciascun punto quiz non ancora
	// "riempito"; rimossa (tween fermato + cerchio distrutto) alla prima interazione, quando
	// l'oggetto le prende il posto (vedi runQuiz()/setupQuizLights()).
	private quizLights: Partial<Record<keyof typeof this.quizConfig, { light: Phaser.GameObjects.Arc; tween: Phaser.Tweens.Tween }>> = {};

	// Sequenze di dialogo introduttivo per ciascun oggetto, giocate prima della domanda del
	// quiz in runQuiz(): a differenza delle due righe fisse _intro_1/_intro_2 di prima, ogni
	// oggetto ha ora un numero diverso di battute (item_1 ne ha 6, item_2/item_3 ne hanno 4).
	private readonly introSequences: Record<"lipidi" | "cellulosa" | "carbon", Array<{ key: string; preset?: string }>> = {
		carbon: [
			{ key: "item_1_narrator", preset: "dark" },
			{ key: "item_1_player_1" },
			{ key: "item_1_player_2" },
			{ key: "item_1_narrator_1b", preset: "dark" },
			{ key: "item_1_player_3" },
			{ key: "item_1_narrator_2", preset: "dark" }
		],
		cellulosa: [
			{ key: "item_2_player" },
			{ key: "item_2_narrator", preset: "dark" },
			{ key: "item_2_player_2" },
			{ key: "item_2_narrator_2", preset: "dark" }
		],
		lipidi: [
			{ key: "item_3_player" },
			{ key: "item_3_narrator", preset: "dark" },
			{ key: "item_3_player_2" },
			{ key: "item_3_narrator_2", preset: "dark" }
		]
	};

	// Flag della partita in corso (recap già mostrato, porta aperta, finale avviata): ricreati
	// in init() a ogni avvio della scena, vedi stageRunState.ts.
	private run = createStage3RunState();

	private apiSession!: APISession;
	private resumeData?: { x?: number; y?: number; checkpoints?: string[] };
	private pingTimer?: Phaser.Time.TimerEvent;

	// Dati di resume passati da Menu.ts via scene.start("Stage3", {...}) quando il
	// giocatore preme "Resume": posizione dell'ultimo ping e traguardi già raggiunti.
	init(data?: { x?: number; y?: number; checkpoints?: string[] }) {
		this.resumeData = data;
		// Phaser riusa questa istanza a ogni scene.start(): senza questo reset una seconda partita
		// nella stessa scheda ritroverebbe recap, porta e finale di quella precedente.
		this.run = createStage3RunState();
		this.quizLights = {};
	}

	preload() {
		this.load.pack("stage3-pack", "assets/images/stage3-pack.json");
		this.load.pack("player-pack", "assets/images/player-pack.json");
		this.load.pack("icons-pack", "assets/images/icons-pack.json");

		const irSpectra: Record<string, string> = {
			grafico1: "STR_4963",
			grafico2: "C23_lowPress",
			grafico3: "C23_protein"
		};
		for (const [key, file] of Object.entries(irSpectra)) {
			if (!this.textures.exists(key)) {
				this.load.image(key, `assets/images/ui/IR-Spectra/${file}.png`);
			}
		}

		this.loadedLang = localStorage.getItem("lang") || "en";
		this.load.json("stage3_i18n", `assets/i18n/${this.loadedLang}/Stage3.json`);
	}

	create() {

		this.editorCreate();
		this.player.setDepth(10);
		// Sopra al giocatore, così l'effetto "cammina dietro" (vedi updateOverlayOcclusion())
		// può coprirlo quando è visibile.
		this.overlayVector.forEach(overlay => overlay.setDepth(11));
		// c14 è sempre dietro il giocatore
		this.c14.setDepth(5);

		this.player.debug(false);
		// Le hitbox degli arredi e della porta si aggiungono ai soli muri di confine
		// (this.boundaries resta quello) — restano invisibili di default, come i muri,
		// seguendo player.debug().
		this.player.setBoundaries([...this.boundaries, ...this.furnitureHitboxes, this.doorHitbox]);
		this.player.isMovementAllowed = false;
		// Qui dentro c'è luce: niente vignetta della torcia, a differenza di Stage1/Stage2.
		this.player.flashlight(false);

		// Il raggio d'interazione di default (32px) è tarato sulle stanze grandi delle altre
		// scene: qui i tre banchi distano fra loro 46, 71 e 101 px, e con 32 le zone di carbon e
		// cellulosa si sovrapporrebbero facendo partire il quiz sbagliato. Con 20 (< 46/2) sono
		// disgiunte, e resta comunque un'area comoda attorno a sprite da 12x12.
		for (const ogg of this.oggVector) {
			ogg.interactionRadius = 20;
		}

		this.apiSession = new APISession();

		const freshArrival = !this.resumeData?.checkpoints || this.resumeData.checkpoints.length === 0;
		if (freshArrival) {
			// Breve wake-up da nero: il personaggio si sveglia dopo il passaggio dalla stanza
			// precedente, senza far apparire subito il giocatore già attivo.
			this.cameras.main.fadeFrom(700, 0, 0, 0);
		}

		// Se arriviamo qui da un Resume, riposizioniamo il giocatore all'ultimo punto
		// pingato invece dello spawn di default.
		if (this.resumeData?.x !== undefined && this.resumeData?.y !== undefined) {
			this.setPlayerPositionInRoom(this.resumeData.x, this.resumeData.y);
		}

		// Imposta subito l'alpha degli overlay in base alla posizione di partenza (spawn di
		// default o Resume, già applicato sopra), poi la tiene aggiornata mentre il giocatore
		// si muove. Anche la profondità (depth) degli oggetti interattivi è dinamica: se il
		// giocatore è sopra l'oggetto (y minore), esso rimane dietro gli overlay; se sotto,
		// va davanti.
		this.updateOverlayOcclusion();
		this.updateItemDepths();
		const onUpdate = () => {
			this.updateOverlayOcclusion();
			this.updateItemDepths();
			this.checkDoorTrigger();
		};
		this.events.on("update", onUpdate);
		// Gli eventi della scena sopravvivono allo shutdown: senza off() ogni nuova partita
		// aggiungerebbe un listener in più.
		this.events.once("shutdown", () => this.events.off("update", onUpdate));

		const room = this.textures.get("stage3").getSourceImage();
		this.cameras.main.setZoom(10);
		this.cameras.main.roundPixels = true;
		this.cameras.main.setBounds(0, 0, room.width, room.height);
		this.cameras.main.startFollow(this.player);

		this.popupManager = new PopupManager(this);
		this.quizManager = new QuizManager(this);
		soundManager.playMusic(this, "stage3_theme");

		this.events.on("resume", () => {
			const currentLang = localStorage.getItem("lang") || "en";
			if (currentLang !== this.loadedLang) {
				this.loadedLang = currentLang;
				void reloadTranslations(this, "stage3_i18n", `assets/i18n/${currentLang}/Stage3.json`);
			}
		});

		this.lipidi.interagisci = () => this.runQuiz("lipidi", this.lipidi);
		this.cellulosa.interagisci = () => this.runQuiz("cellulosa", this.cellulosa);
		this.carbon.interagisci = () => this.runQuiz("carbon", this.carbon);

		this.applyResumeCheckpoints();
		this.setupQuizLights();

		// Recap e apertura della porta partono solo dalla risposta corretta al terzo quiz (vedi
		// runQuiz()): chi riprende con tutti i quiz già risolti troverebbe la porta chiusa e nessun
		// modo di aprirla. Si apre subito, senza rigiocare il recap.
		if (allQuizzesSolved(this.resumeData?.checkpoints, Object.keys(this.quizConfig))) {
			this.run.recapShown = true;
			this.openDoor({ silent: true });
		}

		// I due oggetti "torretta" (ex Stage2) sono assegnati qui invece che in Stage2, per
		// poter essere eventualmente consumati dai quiz di questa scena (vedi runQuiz()) — ma
		// solo al primo arrivo "fresco" da Stage2, non su Resume: in quel caso li ha già
		// ricostruiti (ed eventualmente consumati) applyResumeCheckpoints() sopra, a partire
		// dai soli checkpoint salvati sul server. Stessa condizione di early-return usata da
		// applyResumeCheckpoints() stesso — un controllo di verità su resumeData da solo non
		// basta, perché Phaser passa data = {} di default a init() anche su uno
		// scene.start("Stage3") senza argomenti.
		if (freshArrival) {
			this.player.addInventoryItem(4);
			this.player.addInventoryItem(5);
		}

		// Ping periodico (5-10s) con la posizione corrente: mantiene aggiornato lo stato
		// autoritativo sul server per il Resume, e passa dal validatore anti-cheat.
		this.pingTimer = this.time.addEvent({ delay: 7000, loop: true, callback: () => this.sendPing() });
		this.events.once("shutdown", () => this.pingTimer?.remove());

		// Niente hint di movimento/interazione qui: il giocatore li ha già visti in Stage1.
		// La battuta d'apertura (risveglio dalla caduta + invito a guardare nello zaino) va
		// invece giocata solo al primo arrivo, non a ogni Resume.
		if (freshArrival) {
			const i18n = this.cache.json.get("stage3_i18n");
			void playSequence(this.popupManager, [
				i18n.workbench_intro_1,
				i18n.workbench_intro_2,
				i18n.workbench_intro_3,
				{ message: i18n.workbench_narrator_1, preset: "dark" },
				i18n.workbench_player_1,
				{ message: i18n.workbench_narrator_2, preset: "dark" }
			]).then(() => {
				this.player.isMovementAllowed = true;
			});
		} else {
			this.player.isMovementAllowed = true;
		}
	}

	// Dialogo introduttivo + domanda a scelta multipla per uno dei tre oggetti interagibili.
	// Alla primissima interazione (luce ancora presente): l'oggetto viene tolto
	// dall'inventario e reso visibile al posto della luce, indipendentemente dall'esito del
	// quiz che segue. Risposta corretta: disattiva l'oggetto per sempre e salva il checkpoint,
	// senza assegnare alcun oggetto in cambio. Risposta sbagliata: solo feedback, l'oggetto
	// resta interagibile (e visibile) per un altro tentativo.
	private async runQuiz(objKey: keyof typeof this.quizConfig, ogg: OggettoInterattivo) {
		const i18n = this.cache.json.get("stage3_i18n");
		const cfg = this.quizConfig[objKey];

		this.player.isMovementAllowed = false;
		this.player.interactionAllowed = false;

		const pendingLight = this.quizLights[objKey];
		if (pendingLight) {
			pendingLight.tween.stop();
			pendingLight.light.destroy();
			delete this.quizLights[objKey];
			this.player.removeInventoryItem(cfg.consumesFrame);
			ogg.setVisible(true);
		}

		await playSequence(
			this.popupManager,
			this.introSequences[objKey].map(line => ({ message: i18n[line.key], preset: line.preset }))
		);

		const labels = Array.from({ length: cfg.answerCount }, (_, i) => i18n[`${cfg.promptKey}_answer_${i + 1}`]);
		const answers: QuizAnswer[] = cfg.answerImages
			? labels.map((label, i) => ({ label, textureKey: cfg.answerImages![i] }))
			: labels;

		const correct = await this.quizManager.askQuestion(
			i18n[`${cfg.promptKey}_question`],
			answers,
			cfg.correctIndex,
			{ select: i18n.quiz_zoom_select, close: i18n.quiz_zoom_close }
		);

		if (correct) {
			ogg.set = false;
			void this.apiSession.saveCheckpoint(`stage3_${objKey}_solved`);
			await playSequence(this.popupManager, this.successLines(i18n, objKey));

			if (!this.run.recapShown && this.lipidi.set === false && this.cellulosa.set === false && this.carbon.set === false) {
				this.run.recapShown = true;
				await this.playRecapSequence(i18n);
			}
		} else {
			await playSequence(this.popupManager, [
				{ message: i18n[`${objKey}_fail`], preset: "dark" }
			]);
		}

		this.player.isMovementAllowed = true;
		this.player.interactionAllowed = true;
	}

	// Le spiegazioni delle risposte corrette hanno lunghezze molto diverse fra loro: quelle sui
	// fitoliti e sui picchi IR sono troppo lunghe per un popup solo, e sono spezzate in
	// <obj>_success, _success_2, _success_3... Raccoglie le battute finché la chiave esiste,
	// così aggiungerne o toglierne una è solo una modifica all'i18n.
	private successLines(i18n: Record<string, string>, objKey: string): Array<{ message: string; preset: string }> {
		const lines = [{ message: i18n[`${objKey}_success`], preset: "dark" }];
		for (let i = 2; i18n[`${objKey}_success_${i}`]; i++) {
			lines.push({ message: i18n[`${objKey}_success_${i}`], preset: "dark" });
		}
		return lines;
	}

	// Crea la luce pulsante bianca semitrasparente che segnala un punto quiz non ancora
	// "riempito": alpha fissa a 80/255 (~0.31), il "pulsare" è solo sulla scala (in e out),
	// non sull'alpha. Stesso schema procedurale (add.circle + tween yoyo/repeat infinito)
	// già usato altrove nel gioco (es. Stage2.startBeamPulse, Stage1 brightZone) — non esiste
	// nessun asset di glow/luce generico nel progetto, quindi il cerchio è disegnato a runtime.
	private createQuizLight(x: number, y: number): { light: Phaser.GameObjects.Arc; tween: Phaser.Tweens.Tween } {
		// Raggio 7: poco più dello sprite 12x12 che poi ne prende il posto. La stanza è larga
		// 139px, quindi un cerchio più grande coprirebbe mezza scena.
		const light = this.add.circle(x, y, 7, 0xffffff, 80 / 255);

		const tween = this.tweens.add({
			targets: light,
			scale: { from: 0.85, to: 1.15 },
			duration: 1000,
			yoyo: true,
			repeat: -1,
			ease: "Sine.easeInOut"
		});

		return { light, tween };
	}

	// Per ciascun punto quiz, decide lo stato visivo iniziale in base a quanto già risolto
	// (applyResumeCheckpoints() sopra ha già impostato .set = false per i checkpoint presenti):
	// già risolto → l'oggetto è mostrato subito, senza luce; non risolto → luce pulsante al suo
	// posto, oggetto nascosto finché il giocatore non ci interagisce (vedi runQuiz()).
	private setupQuizLights() {
		for (const key of Object.keys(this.quizConfig) as (keyof typeof this.quizConfig)[]) {
			const ogg = this[key];
			if (ogg.set === false) {
				ogg.setVisible(true);
			} else {
				this.quizLights[key] = this.createQuizLight(ogg.x, ogg.y);
			}
		}
	}

	// Epilogo giocato una sola volta, alla risoluzione del terzo e ultimo quiz: ricapitola il
	// significato dei tre reperti raccolti. L'ultima battuta rimanda "all'altra stanza": alla
	// sua fine la porta si apre (scompare, con un click) e lascia il passaggio libero.
	private async playRecapSequence(i18n: Record<string, string>) {
		await playSequence(this.popupManager, [
			{ message: i18n.recap_narrator, preset: "dark" },
			i18n.recap_player,
			{ message: i18n.memory_narrator_1, preset: "dark" },
			{ message: i18n.memory_narrator_2, preset: "dark" },
			i18n.memory_player,
			{ message: i18n.memory_narrator_3, preset: "dark" },
			i18n.memory_player_2,
			{ message: i18n.memory_narrator_4, preset: "dark" }
		]);

		this.openDoor();
	}

	// Apre la porta: la fa sparire e ne azzera la hitbox, così diventa attraversabile, e arma il
	// trigger della cinematica finale. silent toglie il click quando la porta si apre al Resume
	// (stesso schema di Stage2.activateLaser()).
	private openDoor(options: { silent?: boolean } = {}) {
		this.door.setAlpha(0);
		this.doorHitbox.setSize(0, 0);
		if (!options.silent) {
			soundManager.playSfx(this, "ui_click");
		}
		this.run.doorOpened = true;
	}

	// Sorveglia la distanza dal giocatore alla porta ormai aperta: appena il giocatore vi si
	// avvicina fa partire la cinematica finale, una volta sola (finaleStarted). doorHitbox.x/y
	// restano un riferimento di posizione valido anche dopo che openDoor() ne ha
	// azzerato le dimensioni per renderla attraversabile.
	private checkDoorTrigger() {
		if (!this.run.doorOpened || this.run.finaleStarted) return;

		if (isWithinDoorTrigger(this.player.x, this.player.y, this.doorHitbox.x, this.doorHitbox.y)) {
			this.run.finaleStarted = true;
			void this.playFinaleSequence();
		}
	}

	// Cinematica di chiusura del gioco: il giocatore attraversa la porta, "lavora" sullo
	// strumento di datazione disegnato nell'altra stanza, e uno sfondo bianco in espansione fa
	// da transizione verso una pagina scritta che rivela la conclusione (e la battuta finale)
	// della storia, prima di tornare al menu.
	private async playFinaleSequence() {
		const i18n = this.cache.json.get("stage3_i18n");

		this.player.isMovementAllowed = false;
		this.player.interactionAllowed = false;
		void soundManager.fadeOutMusic(this, "stage3_theme", 1200);

		await this.player.walkTo(74, 27, 900);

		await this.playC14Machinery();
		this.player.surprise();

		await this.showImageReveal("stage3-c14graph");
		await playSequence(this.popupManager, [i18n.finale_interesting]);

		await Promise.all([
			this.player.fadeOutUi(500),
			this.expandWhiteLight(this.player.x, this.player.y, 1800)
		]);
		this.cameras.main.stopFollow();

		const pageText = this.createPageText();

		await this.typeOnPage(pageText, i18n.finale_page_1);
		await this.wait(1200);
		soundManager.playSfx(this, "ui_click");
		pageText.setText(pageText.text + "\n\n");

		await playSequence(this.popupManager, [
			{ message: i18n.finale_joke, preset: "dark" }
		]);

		await this.typeOnPage(pageText, i18n.finale_the_end);
		soundManager.playSfx(this, "success");
		await this.wait(3000);

		this.transitionToMenu();
	}

	// Machinery sound + camera shake + blips per 2 secondi, simulando il funzionamento
	// del macchinario di datazione C14 mentre il giocatore armeggia.
	private playC14Machinery(): Promise<void> {
		return new Promise(resolve => {
			soundManager.playSfx(this, "c14_machine");
			this.cameras.main.shake(2000, 0.0002);

			const blipTimes = [300, 600, 900, 1200, 1500];
			for (const time of blipTimes) {
				this.time.delayedCall(time, () => {
					soundManager.playSfx(this, "type_blip", { rate: Phaser.Math.FloatBetween(0.8, 1.3) });
				});
			}

			this.time.delayedCall(2000, resolve);
		});
	}

	// Manciata di blip ravvicinati e a tono leggermente casuale, per simulare il giocatore
	// che armeggia sullo strumento — stesso sfx "type_blip" usato dal typewriter dei popup,
	// unico blip generico disponibile fra gli sfx del gioco.
	private playRandomBlips(count: number): Promise<void> {
		return new Promise(resolve => {
			let played = 0;
			const onTick = () => {
				soundManager.playSfx(this, "type_blip", { rate: Phaser.Math.FloatBetween(0.8, 1.3) });
				played++;
				if (played >= count) {
					timer.remove();
					resolve();
				}
			};
			const timer = this.time.addEvent({ delay: 300, repeat: count - 1, callback: onTick });
		});
	}

	// Piccola attesa Promise-based: non esiste un equivalente generico in utils.ts, e qui serve
	// solo per scandire i tempi della cinematica.
	private wait(ms: number): Promise<void> {
		return new Promise(resolve => this.time.delayedCall(ms, resolve));
	}

	// Cerchio bianco che si espande dal punto (x, y) fino a coprire l'intero viewport (128x72
	// unità mondo, raggio metà-diagonale ≈73.5): stesso schema di createQuizLight() sopra
	// (tween sulla scale di un Arc a raggio fisso, non sul raggio stesso). Resta in coordinate
	// di mondo (niente scrollFactor 0: quei valori sono pensati per coordinate schermo, non per
	// le piccole unità mondo di questa stanza — usarlo qui piazzava il cerchio fuori vista).
	// Il fill va creato opaco (fillAlpha 1): è un valore fisso indipendente dalla proprietà
	// GameObject.alpha, quindi tenerlo a 0 e poi animare solo .alpha (come nel tentativo
	// precedente) lasciava il cerchio sempre invisibile (fillAlpha 0 * qualunque alpha = 0).
	// La trasparenza iniziale/dissolvenza va quindi ottenuta su .alpha stesso via setAlpha(0).
	// L'alpha sale rapidamente all'inizio (sotto-tween separato, breve) così il cerchio è
	// subito visibile invece di restare quasi trasparente per gran parte della crescita lenta
	// (Cubic.easeIn) della scala. depth 50 come flashScreen() in Stage2.ts, sopra a giocatore/
	// overlay/oggetti ma sotto all'hud (900) e al layer dei popup (1000).
	private expandWhiteLight(x: number, y: number, duration: number): Promise<void> {
		const light = this.add.circle(x, y, 1, 0xffffff, 1);
		light.setDepth(50);
		light.setScale(0);
		light.setAlpha(0);

		this.tweens.add({
			targets: light,
			alpha: 1,
			duration: Math.min(400, duration),
			ease: "Sine.easeOut"
		});

		return new Promise(resolve => {
			this.tweens.add({
				targets: light,
				scale: 130,
				duration,
				ease: "Cubic.easeIn",
				onComplete: () => resolve()
			});
		});
	}

	// Rivelazione a schermo di un'immagine di analisi (qui il grafico di calibrazione C14),
	// stesso schema di Stage2.showImageReveal(): appare al centro (alpha-in + scale-down da
	// sovradimensionata), resta visibile qualche secondo, poi sfuma. L'immagine è anche una
	// card permanente in Gallery.ts (stessa texture key), come già per EDS/XRD di Stage2.
	private showImageReveal(textureKey: string): Promise<void> {
		const camera = this.cameras.main;
		const naturalWidth = this.textures.get(textureKey).getSourceImage().width;
		const naturalHeight = this.textures.get(textureKey).getSourceImage().height;
		const desiredScreenWidth = 640;
		const worldWidth = desiredScreenWidth / camera.zoom;
		const worldHeight = worldWidth * (naturalHeight / naturalWidth);

		const image = this.add.image(camera.centerX, camera.centerY, textureKey);
		image.setScrollFactor(0);
		image.setDepth(60);
		image.setDisplaySize(worldWidth, worldHeight);

		const targetScaleX = image.scaleX;
		const targetScaleY = image.scaleY;
		image.setScale(targetScaleX * 1.3, targetScaleY * 1.3);
		image.setAlpha(0);

		return new Promise<void>(resolve => {
			this.tweens.add({
				targets: image,
				alpha: 1,
				scaleX: targetScaleX,
				scaleY: targetScaleY,
				duration: 400,
				ease: "Cubic.easeOut",
				onComplete: () => {
					this.time.delayedCall(1600, () => {
						this.tweens.add({
							targets: image,
							alpha: 0,
							duration: 300,
							ease: "Power2.easeIn",
							onComplete: () => {
								image.destroy();
								resolve();
							}
						});
					});
				}
			});
		});
	}

	// Testo della "pagina" scritta, riusato sia per la conclusione sulla datazione che per "The
	// End": ancorato in alto a sinistra del viewport corrente (la camera è già ferma, vedi
	// playFinaleSequence), con un margine, e si estende su quasi tutta la larghezza dello
	// schermo. Usa worldView (non il centro del mondo) per restare corretto anche se il clamp
	// di setBounds avesse spostato la camera rispetto al giocatore. depth 51: sopra al cerchio
	// bianco (50), sotto al layer dei popup (1000).
	private createPageText(): Phaser.GameObjects.Text {
		const view = this.cameras.main.worldView;
		const margin = 10;
		const text = this.add.text(view.x + margin, view.y + margin, "", {
			fontSize: "7px",
			color: "#000000",
			fontFamily: "PixelifySans-VariableFont_wght",
			resolution: 5,
			align: "left",
			wordWrap: { width: view.width - margin * 2 }
		});
		text.setOrigin(0, 0);
		text.setDepth(51);
		text.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
		return text;
	}

	private pageCursor?: Phaser.GameObjects.Rectangle;
	// Effetto typewriter minimale per il testo della pagina: stesso schema (tick a intervalli
	// fissi, blip ogni due caratteri non-spazio) del typewriter di PopupManager, semplificato
	// perché qui non serve alcun markup di formattazione/pausa. Include anche un cursore che si
	// posiziona alla fine del testo e rimane visibile anche dopo il completamento. Digita
	// AGGIUNGENDO a quanto già presente in textObject (il chiamante può quindi lasciare la
	// pagina intatta fra due chiamate, es. per andare a capo invece di cancellare) invece di
	// sovrascriverlo.
	private typeOnPage(textObject: Phaser.GameObjects.Text, message: string): Promise<void> {
		const prefix = textObject.text;

		return new Promise(resolve => {
			let charIndex = 0;
			this.pageCursor?.destroy();
			const cursor = this.add.rectangle(0, 0, 1, 8, 0x000000);
			cursor.setDepth(52);
			this.pageCursor = cursor;

			// Testo di scratch, invisibile, usato solo per misurare la larghezza dell'ULTIMA riga
			// digitata (stesso stile di textObject): getBounds() su textObject dà invece il bordo
			// destro del blocco intero, cioè la riga PIÙ LARGA fra tutte quelle avvolte finora —
			// con più righe di lunghezza diversa il cursore finiva nel punto sbagliato appena si
			// passava a una riga più corta di una precedente.
			const measure = this.add.text(0, 0, "", {
				fontSize: "7px",
				fontFamily: "PixelifySans-VariableFont_wght",
				resolution: 5
			});
			measure.setVisible(false);

			const timer = this.time.addEvent({
				delay: 40,
				loop: true,
				callback: () => {
					const char = message[charIndex];
					textObject.setText(prefix + message.substring(0, charIndex + 1));

					const lines = textObject.getWrappedText();
					const lineCount = Math.max(1, lines.length);
					const lineHeight = textObject.height / lineCount;
					measure.setText(lines[lineCount - 1] ?? "");
					cursor.setPosition(
						textObject.x + measure.width + 1,
						textObject.y + textObject.height - lineHeight / 2
					);

					if (char !== " " && charIndex % 2 === 0) {
						soundManager.playSfx(this, "type_blip");
					}
					charIndex++;
					if (charIndex >= message.length) {
						timer.remove();
						measure.destroy();
						resolve();
					}
				}
			});
		});
	}

	// Torna al menu principale: stesso schema (fade a nero su un Rectangle a schermo intero,
	// poi scene.start) di Stage2.transitionToStage3(), qui verso "Menu" invece che "Stage3".
	// Salva anche il checkpoint di completamento, che a Stage3 mancava (stage1_complete/
	// stage2_complete esistono già, vedi inventoryCheckpoints.ts).
	private transitionToMenu() {
		void this.apiSession.saveCheckpoint("stage3_complete");
		localStorage.setItem("gameFinished", "true");

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
			onComplete: () => {
				this.scene.start("Menu");
			}
		});
	}

	// Ricostruisce lo stato della scena a partire dai checkpoint opachi salvati sul server,
	// così un giocatore che riprende da qui non deve ripetere i quiz già risolti.
	private applyResumeCheckpoints() {
		const checkpoints = this.resumeData?.checkpoints;
		if (!checkpoints || checkpoints.length === 0) {
			return;
		}

		// Copre anche gli oggetti di Stage1/Stage2 (arrivare a Stage3 implica averli già
		// ottenuti) oltre ai quiz di questa scena.
		applyInventoryCheckpoints(this.player, checkpoints);

		for (const key of Object.keys(this.quizConfig) as (keyof typeof this.quizConfig)[]) {
			if (checkpoints.includes(`stage3_${key}_solved`)) {
				this[key].set = false;
			}
		}
	}

	// Riposiziona il giocatore tenendolo dentro la stanza. Serve perché le posizioni che
	// arrivano da fuori (salvataggio di un Resume, correzione autoritativa del server) possono
	// essere state scritte quando questa scena aveva uno sfondo di tutt'altra misura: senza il
	// clamp il giocatore finirebbe fuori dalla stanza, e con la camera ferma nemmeno si vedrebbe.
	private setPlayerPositionInRoom(x: number, y: number) {
		const room = this.textures.get("stage3").getSourceImage();
		this.player.setPosition(
			Phaser.Math.Clamp(x, 0, room.width),
			Phaser.Math.Clamp(y, 0, room.height)
		);
	}

	// Effetto "cammina dietro" gli arredi: gli overlay 1..3 rappresentano il lembo frontale
	// di mobili disegnati nello sfondo, e vanno sopra al giocatore (alpha 1) solo mentre è
	// "dietro" l'arredo (y minore della soglia). Overlay 0 è strutturale/permanente e resta
	// sempre visibile.
	private updateOverlayOcclusion() {
		// overlay 0 è sempre visibile
		this.overlayVector[0].setAlpha(1);
		// overlay 1..3 si mostrano solo quando il giocatore è dietro (y < soglia)
		for (let i = 1; i < this.overlayVector.length; i++) {
			const overlay = this.overlayVector[i];
			overlay.setAlpha(this.player.y < overlay.y ? 1 : 0);
		}
	}

	// Profondità dinamica degli oggetti interattivi e delle loro luci: se il giocatore è sopra
	// (y minore), l'oggetto e la sua luce vanno davanti agli overlay (profondità 12);
	// se sotto (y maggiore), rimangono dietro il giocatore (profondità 5).
	private updateItemDepths() {
		for (const item of this.oggVector) {
			const depth = this.player.y < item.y ? 12 : 5;
			item.setDepth(depth);
			const light = this.quizLights[item.name as keyof typeof this.quizConfig]?.light;
			if (light) {
				light.setDepth(depth);
			}
		}
	}

	// Invia la posizione corrente al server; se il server rifiuta il movimento (lag/cheat)
	// o rileva un ban, allinea il client allo stato autoritativo restituito.
	private async sendPing() {
		try {
			const result = await this.apiSession.ping("Stage3", this.player.x, this.player.y);
			if (result.action === "rubberband" || result.action === "kick") {
				this.setPlayerPositionInRoom(parseFloat(result.x), parseFloat(result.y));
			} else if (result.action === "ban") {
				this.pingTimer?.remove();
				this.scene.start("Menu");
			}
		} catch (error) {
			console.error("Ping fallito:", error);
		}
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

export default Stage3;
