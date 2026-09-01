// You can write more code here
import Player from "@/items/Main/Player";
import PopupManager from "../items/UI/PopupManager";
import QuizManager from "../items/UI/QuizManager";
import { playSequence, reloadTranslations } from "../utils";
import OggettoInterattivo from "../items/Main/OggettoInterattivo";
import { APISession } from "../network/APISession";
import { applyInventoryCheckpoints } from "../items/inventoryCheckpoints";

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
		const lipidi = new OggettoInterattivo(this, 700, 450, "lipidi");
		this.add.existing(lipidi);

		// cellulosa
		const cellulosa = new OggettoInterattivo(this, 1000, 300, "cellulosa");
		this.add.existing(cellulosa);

		// carbon
		const carbon = new OggettoInterattivo(this, 1300, 450, "carbon");
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

	// Metadati di gioco per ogni quiz: quale frame di player_items viene assegnato e quale
	// indice di risposta è corretto. Tenuto nel codice (non nell'i18n) perché è logica di
	// gioco, non contenuto traducibile — stesso schema di GraficoGame.ts.
	private readonly quizConfig = {
		lipidi: { frame: 6, correctIndex: 0 },
		cellulosa: { frame: 7, correctIndex: 0 },
		carbon: { frame: 8, correctIndex: 0 },
	} as const;

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

		// Ping periodico (5-10s) con la posizione corrente: mantiene aggiornato lo stato
		// autoritativo sul server per il Resume, e passa dal validatore anti-cheat.
		this.pingTimer = this.time.addEvent({ delay: 7000, loop: true, callback: () => this.sendPing() });
		this.events.once("shutdown", () => this.pingTimer?.remove());

		const i18n = this.cache.json.get("stage3_i18n");

		void playSequence(this.popupManager, [
			{ message: i18n.movement_hint, preset: "hint" },
			{ message: i18n.interact_hint, preset: "hint" }
		]).then(() => {
			this.player.isMovementAllowed = true;
		});
	}

	// Dialogo introduttivo + domanda a scelta multipla per uno dei tre oggetti interagibili.
	// Risposta corretta: assegna l'oggetto all'inventario e disattiva l'oggetto per sempre.
	// Risposta sbagliata: solo feedback, l'oggetto resta interagibile per un altro tentativo.
	private async runQuiz(objKey: keyof typeof this.quizConfig, ogg: OggettoInterattivo) {
		const i18n = this.cache.json.get("stage3_i18n");
		const cfg = this.quizConfig[objKey];

		this.player.isMovementAllowed = false;
		this.player.interactionAllowed = false;

		await playSequence(this.popupManager, [
			{ message: i18n[`${objKey}_intro_1`], preset: "dark" },
			{ message: i18n[`${objKey}_intro_2`], preset: "dark" }
		]);

		const correct = await this.quizManager.askQuestion(
			i18n[`${objKey}_question`],
			[
				i18n[`${objKey}_answer_1`],
				i18n[`${objKey}_answer_2`],
				i18n[`${objKey}_answer_3`],
				i18n[`${objKey}_answer_4`]
			],
			cfg.correctIndex
		);

		if (correct) {
			this.player.addInventoryItem(cfg.frame);
			ogg.set = false;
			void this.apiSession.saveCheckpoint(`stage3_${objKey}_solved`);
			await playSequence(this.popupManager, [
				{ message: i18n[`${objKey}_success`], preset: "minigame" }
			]);
		} else {
			await playSequence(this.popupManager, [
				{ message: i18n[`${objKey}_fail`], preset: "minigame" }
			]);
		}

		this.player.isMovementAllowed = true;
		this.player.interactionAllowed = true;
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
