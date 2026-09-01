import PixelPanel from "./PixelPanel";
import { setupPixelButton } from "../../utils";
import { flashBurst, sparkBurst } from "../ParticleFx";

const FONT_FAMILY = "PixelifySans-VariableFont_wght";

// Piccolo componente "fratello" di PopupManager: mostra una domanda con 4 risposte a scelta
// multipla usando lo stesso linguaggio visivo "8-bit" (PixelPanel/setupPixelButton, etichetta
// del "parlante" in alto a sinistra), ma non dipende da un'istanza di PopupManager — chi lo usa
// incatena eventuali popup di feedback/dialogo per conto proprio dopo aver atteso askQuestion(),
// esattamente come già incatena più chiamate a playSequence().
export default class QuizManager {
    private scene: Phaser.Scene;
    private layer: Phaser.GameObjects.Layer;
    private active: boolean = false;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;

        // Depth 1001: un livello sopra al layer di PopupManager (1000), così la domanda resta
        // sempre in primo piano anche durante il breve cross-fade tra un popup di dialogo e
        // il pannello della domanda.
        this.layer = scene.add.layer();
        this.layer.setDepth(1001);
    }

    public get isActive(): boolean {
        return this.active;
    }

    // Mostra una domanda con 4 risposte disposte in una matrice 2x2; risolve true/false in base
    // alla scelta del giocatore. Interazione solo via puntatore (niente tasti) per non entrare
    // in conflitto con il tasto Invio globale di PopupManager né con le frecce di movimento del
    // giocatore — che comunque il chiamante disabilita già durante il quiz.
    public askQuestion(
        question: string,
        answers: [string, string, string, string],
        correctIndex: number
    ): Promise<boolean> {
        if (this.active) {
            return Promise.resolve(false);
        }
        this.active = true;

        return new Promise<boolean>(resolve => {
            const matrixWidth = 200;
            const padding = 6;
            const columnGap = 8;
            const rowGap = 6;
            const blockGap = 10; // tra il popup della domanda e la matrice di risposte
            const buttonPad = 6;
            const colWidth = (matrixWidth - columnGap) / 2;

            // scale.width/2, scale.height/2 è l'unico punto invariante rispetto allo zoom della
            // camera per un oggetto scrollFactor(0) (stesso motivo per cui l'anchor 'center' di
            // PopupManager non necessita compensazione, vedi PopupManager.ts createInteractivePopup).
            // Qualunque scostamento da questo punto viene amplificato dallo zoom (5x in Stage3),
            // quindi anche il piccolo offset verso il basso richiesto (0.525 invece di 0.5) si
            // traduce in un salto ben più grande a schermo di quanto sembri qui.
            const container = this.scene.add.container(this.scene.scale.width / 2, this.scene.scale.height * 0.525);
            this.layer.add(container);

            // --- Testo della domanda, misurato per primo per calcolare l'altezza del popup ---
            const questionText = this.scene.add.text(0, 0, question, {
                fontSize: "7px",
                color: "#ffffff",
                fontFamily: FONT_FAMILY,
                resolution: 5,
                align: "center",
                wordWrap: { width: matrixWidth - padding * 2 }
            }).setOrigin(0.5, 0.5).setScrollFactor(0, 0);
            const popupHeight = questionText.height + padding * 2;

            // Etichetta "Quiz" nell'angolo in alto a sinistra del popup, stesso schema della
            // speaker-name tag di PopupManager.createInteractivePopup().
            const speakerText = this.scene.add.text(0, 0, "Quiz", {
                fontSize: "6px",
                color: "#ffffff",
                fontFamily: FONT_FAMILY,
                resolution: 5,
                align: "center"
            }).setScrollFactor(0, 0);
            const speakerPad = 2;
            const speakerWidth = speakerText.width + speakerPad * 2;
            const speakerHeight = speakerText.height + speakerPad * 2;

            // --- Testi delle risposte, misurati per primi: ogni riga della matrice è alta
            // quanto serve al testo più lungo di quella riga, per celle simmetriche ---
            const answerTexts = answers.map(label =>
                this.scene.add.text(0, 0, label, {
                    fontSize: "6px",
                    color: "#ffffff",
                    fontFamily: FONT_FAMILY,
                    resolution: 5,
                    align: "center",
                    wordWrap: { width: colWidth - 16 }
                }).setOrigin(0.5, 0.5).setScrollFactor(0, 0)
            );
            const rowHeights = [
                Math.max(answerTexts[0].height, answerTexts[1].height) + buttonPad,
                Math.max(answerTexts[2].height, answerTexts[3].height) + buttonPad
            ];
            const matrixHeight = rowHeights[0] + rowGap + rowHeights[1];

            // NB: containerHeight copre solo popup+matrice: come in PopupManager, l'etichetta
            // del parlante sporge sopra il bordo superiore del popup invece di farne parte.
            const containerHeight = popupHeight + blockGap + matrixHeight;
            const top = -containerHeight / 2;

            // Sfondo del popup della domanda (stesso linguaggio visivo di PopupManager: pannello
            // scuro/verde acqua con bordo, coerente col preset "minigame" già usato per il
            // feedback del quiz in Stage3).
            const popupBg = this.scene.add.graphics().setScrollFactor(0, 0);
            new PixelPanel(popupBg, -matrixWidth / 2, top, matrixWidth, popupHeight, {
                fillColor: 0x16a085,
                fillAlpha: 0.85,
                borderColor: 0x27ae60,
                borderAlpha: 0.8,
                borderThickness: 1,
                shadowOffset: 2
            });

            const speakerBg = this.scene.add.graphics().setScrollFactor(0, 0);
            new PixelPanel(speakerBg, -matrixWidth / 2 + 2, top - speakerHeight, speakerWidth, speakerHeight, {
                fillColor: 0x27ae60,
                borderThickness: 1,
                shadowOffset: 1
            });
            speakerText.setPosition(-matrixWidth / 2 + 2 + speakerPad, top - speakerHeight + speakerPad).setOrigin(0, 0);

            questionText.setPosition(0, top + popupHeight / 2);

            container.add([popupBg, speakerBg, speakerText, questionText]);

            // --- Matrice 2x2 delle risposte, sotto al popup della domanda ---
            const matrixTop = top + popupHeight + blockGap;
            const colX = [-matrixWidth / 2 + colWidth / 2, matrixWidth / 2 - colWidth / 2];

            const rects: Phaser.GameObjects.Rectangle[] = [];
            const panels: PixelPanel[] = [];

            answerTexts.forEach((text, i) => {
                const row = Math.floor(i / 2);
                const col = i % 2;
                const h = rowHeights[row];
                const cellTop = row === 0 ? matrixTop : matrixTop + rowHeights[0] + rowGap;
                const centerY = cellTop + h / 2;
                const centerX = colX[col];

                const rect = this.scene.add.rectangle(centerX, centerY, colWidth, h);
                text.setPosition(centerX, centerY);

                // Stessa palette/spessore bordo/ombra del pannello della domanda sopra, così le
                // celle della matrice leggono come parte dello stesso popup invece di un widget
                // diverso incollato sotto.
                const handles = setupPixelButton(this.scene, rect, {
                    fillColor: 0x16a085,
                    hoverColor: 0x1abc9c,
                    borderColor: 0x27ae60,
                    borderThickness: 1,
                    shadowOffset: 2,
                    text
                });
                rect.setInteractive({ useHandCursor: true }).setScrollFactor(0, 0);

                container.add([handles.graphics, rect, text]);
                rects.push(rect);
                panels.push(handles.panel);
            });

            container.setScale(0.85).setAlpha(0);
            this.scene.tweens.add({
                targets: container,
                alpha: 1,
                scale: 1,
                duration: 200,
                ease: "Back.easeOut"
            });

            let answered = false;
            rects.forEach((rect, i) => {
                rect.on("pointerup", () => {
                    if (answered) return;
                    answered = true;
                    rects.forEach(r => r.disableInteractive());

                    const isCorrect = i === correctIndex;
                    panels[i].redraw("press");

                    if (isCorrect) {
                        this.celebrate();
                    } else {
                        this.shakeWrong();
                    }

                    this.scene.time.delayedCall(isCorrect ? 900 : 500, () => {
                        this.scene.tweens.add({
                            targets: container,
                            alpha: 0,
                            y: container.y - 5,
                            duration: 200,
                            ease: "Power2.easeIn",
                            onComplete: () => {
                                container.destroy();
                                this.active = false;
                                resolve(isCorrect);
                            }
                        });
                    });
                });
            });
        });
    }

    // Festeggiamento per la risposta corretta: stessa "fireworks" a scoppi multipli usata da
    // GraficoGame per la vittoria finale (ParticleFx.flashBurst + sparkBurst), ma più breve dato
    // che qui si ripete ad ogni domanda invece che una sola volta a fine minigioco. I punti sono
    // scelti dentro camera.worldView (l'area di mondo attualmente visibile) invece che in
    // coordinate schermo fisse, così i fuochi d'artificio appaiono sempre sull'area inquadrata
    // qualunque sia la posizione della camera in quel momento.
    private celebrate(): void {
        const view = this.scene.cameras.main.worldView;
        const bursts = 16;
        // Sopra sia al layer del quiz (1001) che al suo eventuale flash rosso (1002).
        const depth = 1003;

        for (let i = 0; i < bursts; i++) {
            this.scene.time.delayedCall(i * 60, () => {
                const x = Phaser.Math.Between(view.x, view.x + view.width);
                const y = Phaser.Math.Between(view.y, view.y + view.height);
                flashBurst(this.scene, x, y, { scale: 1.3, depth });
                sparkBurst(this.scene, x, y, { count: 6, scale: 1.0, depth });
            });
        }
    }

    // Feedback per la risposta sbagliata: flash rosso a schermo intero (stesso schema del
    // flashScreen() di Stage2, in scala di grigi lì) più uno scatto secco della camera.
    private shakeWrong(): void {
        const cam = this.scene.cameras.main;

        const flash = this.scene.add.rectangle(cam.centerX, cam.centerY, cam.width, cam.height, 0xff0000);
        flash.setScrollFactor(0);
        flash.setDepth(1002); // sopra al layer del quiz (1001)
        flash.setAlpha(0.45);

        cam.shake(150, 0.005);

        this.scene.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 350,
            ease: "Cubic.easeOut",
            onComplete: () => flash.destroy()
        });
    }

    public destroy(): void {
        this.layer.destroy();
    }
}
