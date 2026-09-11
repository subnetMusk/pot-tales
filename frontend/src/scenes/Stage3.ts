// You can write more code here
import Player from "@/items/Main/Player";
import PopupManager from "../items/UI/PopupManager";
import QuizManager from "../items/UI/QuizManager";
import { playSequence, reloadTranslations } from "../utils";
import OggettoInterattivo from "../items/Main/OggettoInterattivo";
import { APISession } from "../network/APISession";
import { applyInventoryCheckpoints } from "../items/inventoryCheckpoints";
import { soundManager } from "../audio/SoundManager";

/* START OF COMPILED CODE */

class Stage3 extends Phaser.Scene {

	constructor() {
		super("Stage3");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

		// background
		this.add.image(1000, 515, "stage3");

		// rectangle_1..4: mura di confine, appena fuori dai bordi dello sfondo (stesso schema
		// di Stage1.ts/Stage2.ts).
		const rectangle_1 = this.add.rectangle(1000, -20, 2080, 40);
		const rectangle_2 = this.add.rectangle(1000, 1050, 2080, 40);
		const rectangle_3 = this.add.rectangle(-20, 515, 40, 1110);
		const rectangle_4 = this.add.rectangle(2020, 515, 40, 1110);

		// player
		const player = new Player(this, 1000, 600);
		this.add.existing(player);

		// lipidi
		const lipidi = new OggettoInterattivo(this, 940, 430, "lipidi");
		lipidi.setVisible(false);
		this.add.existing(lipidi);

		// cellulosa
		const cellulosa = new OggettoInterattivo(this, 1000, 350, "cellulosa");
		cellulosa.setVisible(false);
		this.add.existing(cellulosa);

		// carbon
		const carbon = new OggettoInterattivo(this, 1060, 430, "carbon");
		carbon.setVisible(false);
		this.add.existing(carbon);

		// lists
		const boundaries = [rectangle_1, rectangle_2, rectangle_3, rectangle_4];
		const oggVector = [lipidi, cellulosa, carbon];

		this.player = player;
		this.boundaries = boundaries;
		this.oggVector = oggVector;
		this.lipidi = lipidi;
		this.cellulosa = cellulosa;
		this.carbon = carbon;

		this.events.emit("scene-awake");
	}

	private player!: Player;
	private boundaries!: Phaser.GameObjects.Rectangle[];
	private oggVector!: OggettoInterattivo[];
	private lipidi!: OggettoInterattivo;
	private cellulosa!: OggettoInterattivo;
	private carbon!: OggettoInterattivo;

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
	private readonly quizConfig = {
		lipidi: { correctIndex: 0, consumesFrame: 2, promptKey: "item_3" },
		cellulosa: { correctIndex: 0, consumesFrame: 5, promptKey: "item_2" },
		carbon: { correctIndex: 0, consumesFrame: 4, promptKey: "item_1" },
	} as const;

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

	// Evita di rigiocare il recap più di una volta nella stessa sessione di scena.
	private recapShown: boolean = false;

	private apiSession!: APISession;
	private resumeData?: { x?: number; y?: number; checkpoints?: string[] };
	private pingTimer?: Phaser.Time.TimerEvent;

	// Dati di resume passati da Menu.ts via scene.start("Stage3", {...}) quando il
	// giocatore preme "Resume": posizione dell'ultimo ping e traguardi già raggiunti.
	init(data?: { x?: number; y?: number; checkpoints?: string[] }) {
		this.resumeData = data;
	}

	preload() {
		this.load.pack("stage3-pack", "assets/images/stage3-pack.json");
		this.load.pack("player-pack", "assets/images/player-pack.json");
		this.load.pack("icons-pack", "assets/images/icons-pack.json");

		this.loadedLang = localStorage.getItem("lang") || "en";
		this.load.json("stage3_i18n", `assets/i18n/${this.loadedLang}/Stage3.json`);
	}

	create() {

		this.editorCreate();
		this.player.setDepth(10);

		this.player.debug(false);
		this.player.setBoundaries(this.boundaries);
		this.player.isMovementAllowed = false;

		this.apiSession = new APISession();

		// Se arriviamo qui da un Resume, riposizioniamo il giocatore all'ultimo punto
		// pingato invece dello spawn di default.
		if (this.resumeData?.x !== undefined && this.resumeData?.y !== undefined) {
			this.player.setPosition(this.resumeData.x, this.resumeData.y);
		}

		this.cameras.main.setZoom(5.0);
		this.cameras.main.roundPixels = true;
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

		// I due oggetti "torretta" (ex Stage2) sono assegnati qui invece che in Stage2, per
		// poter essere eventualmente consumati dai quiz di questa scena (vedi runQuiz()) — ma
		// solo al primo arrivo "fresco" da Stage2, non su Resume: in quel caso li ha già
		// ricostruiti (ed eventualmente consumati) applyResumeCheckpoints() sopra, a partire
		// dai soli checkpoint salvati sul server. Stessa condizione di early-return usata da
		// applyResumeCheckpoints() stesso — un controllo di verità su resumeData da solo non
		// basta, perché Phaser passa data = {} di default a init() anche su uno
		// scene.start("Stage3") senza argomenti.
		const freshArrival = !this.resumeData?.checkpoints || this.resumeData.checkpoints.length === 0;
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

		const correct = await this.quizManager.askQuestion(
			i18n[`${cfg.promptKey}_question`],
			[
				i18n[`${cfg.promptKey}_answer_1`],
				i18n[`${cfg.promptKey}_answer_2`],
				i18n[`${cfg.promptKey}_answer_3`],
				i18n[`${cfg.promptKey}_answer_4`]
			],
			cfg.correctIndex
		);

		if (correct) {
			ogg.set = false;
			void this.apiSession.saveCheckpoint(`stage3_${objKey}_solved`);
			await playSequence(this.popupManager, [
				{ message: i18n[`${objKey}_success`], preset: "dark" }
			]);

			if (!this.recapShown && this.lipidi.set === false && this.cellulosa.set === false && this.carbon.set === false) {
				this.recapShown = true;
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

	// Crea la luce pulsante bianca semitrasparente che segnala un punto quiz non ancora
	// "riempito": alpha fissa a 32/255 (~0.125), il "pulsare" è solo sulla scala (in e out),
	// non sull'alpha. Stesso schema procedurale (add.circle + tween yoyo/repeat infinito)
	// già usato altrove nel gioco (es. Stage2.startBeamPulse, Stage1 brightZone) — non esiste
	// nessun asset di glow/luce generico nel progetto, quindi il cerchio è disegnato a runtime.
	private createQuizLight(x: number, y: number): { light: Phaser.GameObjects.Arc; tween: Phaser.Tweens.Tween } {
		const light = this.add.circle(x, y, 22, 0xffffff, 32 / 255);

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
	// significato dei tre reperti raccolti. L'ultima battuta rimanda "all'altra stanza", una
	// scena/meccanica non ancora costruita — qui si ferma senza alcuna transizione.
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

	// Invia la posizione corrente al server; se il server rifiuta il movimento (lag/cheat)
	// o rileva un ban, allinea il client allo stato autoritativo restituito.
	private async sendPing() {
		try {
			const result = await this.apiSession.ping("Stage3", this.player.x, this.player.y);
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

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

export default Stage3;
