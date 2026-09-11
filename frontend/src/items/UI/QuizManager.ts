import PixelPanel from "./PixelPanel";
import { setupPixelButton } from "../../utils";
import { flashBurst, sparkBurst } from "../ParticleFx";
import { soundManager } from "../../audio/SoundManager";

const FONT_FAMILY = "PixelifySans-VariableFont_wght";

export type QuizAnswer = string | { label: string; textureKey: string };

export interface QuizZoomLabels {
	select: string;
	close: string;
}

const BASE_ZOOM = 5;

// Piccolo componente "fratello" di PopupManager: mostra una domanda con 3 o 4 risposte a scelta
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
        answers: QuizAnswer[],
        correctIndex: number,
        zoomLabels?: QuizZoomLabels
    ): Promise<boolean> {
        if (this.active) {
            return Promise.resolve(false);
        }
        this.active = true;

        const camera = this.scene.cameras.main;
        // Tutto il layout è tarato su zoom 5: il container viene scalato per compensare lo zoom
        // reale della scena, così le misure interne restano leggibili come "pixel di schermo / 5".
        const baseScale = BASE_ZOOM / camera.zoom;
        const textResolution = Math.max(BASE_ZOOM, Math.ceil(camera.zoom));

        const imageMode = answers.some(answer => typeof answer !== "string");

        // Rimescola l'ordine delle risposte ad ogni domanda, così la posizione di quella
        // corretta non è prevedibile (in Stage3.ts è sempre l'indice 0 nella config del quiz).
        const order = Array.from({ length: answers.length }, (_, i) => i);
        Phaser.Utils.Array.Shuffle(order);
        const shuffled = order.map(i => answers[i]);
        const shuffledCorrectIndex = order.indexOf(correctIndex);
        correctIndex = shuffledCorrectIndex;

        const labelOf = (answer: QuizAnswer) => typeof answer === "string" ? answer : answer.label;
        const labels = shuffled.map((answer, i) => imageMode ? labelOf(answers[i]) : labelOf(answer));
        const textureKeys = shuffled.map(answer => typeof answer === "string" ? undefined : answer.textureKey);

        return new Promise<boolean>(resolve => {
            const matrixWidth = 200;
            const padding = 6;
            const columnGap = 8;
            const rowGap = 6;
            const blockGap = 10; // tra il popup della domanda e la matrice di risposte
            const buttonPad = 6;
            const columns = imageMode ? answers.length : 2;
            const colWidth = (matrixWidth - columnGap * (columns - 1)) / columns;

            // scale.width/2, scale.height/2 è l'unico punto invariante rispetto allo zoom della
            // camera per un oggetto scrollFactor(0) (stesso motivo per cui l'anchor 'center' di
            // PopupManager non necessita compensazione, vedi PopupManager.ts createInteractivePopup) —
            // qualunque scostamento da questo punto verrebbe amplificato dallo zoom (5x in Stage3),
            // quindi il container resta centrato esattamente su questo punto.
            const container = this.scene.add.container(this.scene.scale.width / 2, this.scene.scale.height / 2);
            this.layer.add(container);

            // --- Testo della domanda, misurato per primo per calcolare l'altezza del popup ---
            const questionText = this.scene.add.text(0, 0, question, {
                fontSize: "7px",
                color: "#ffffff",
                fontFamily: FONT_FAMILY,
                resolution: textResolution,
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
                resolution: textResolution,
                align: "center"
            }).setScrollFactor(0, 0);
            const speakerPad = 2;
            const speakerWidth = speakerText.width + speakerPad * 2;
            const speakerHeight = speakerText.height + speakerPad * 2;

            // --- Testi delle risposte, misurati per primi: ogni riga della matrice è alta
            // quanto serve al contenuto più alto di quella riga, per celle simmetriche ---
            const answerTexts = labels.map(label =>
                this.scene.add.text(0, 0, label, {
                    fontSize: "6px",
                    color: "#ffffff",
                    fontFamily: FONT_FAMILY,
                    resolution: textResolution,
                    align: "center",
                    wordWrap: { width: colWidth - 16 }
                }).setOrigin(0.5, 0.5).setScrollFactor(0, 0)
            );

            // Anteprime: ogni immagine è rimpicciolita per stare dentro la card mantenendo le
            // proporzioni (i dettagli SEM sono quadrati, gli spettri IR 2:1), con la didascalia
            // sotto. captionGap separa i due.
            const captionGap = 3;
            const previewMaxWidth = colWidth - padding;
            const previewMaxHeight = 56;
            const answerImages = textureKeys.map(key => {
                if (!key) return undefined;
                const image = this.scene.add.image(0, 0, key).setScrollFactor(0, 0);
                const fit = Math.min(previewMaxWidth / image.width, previewMaxHeight / image.height);
                image.setDisplaySize(image.width * fit, image.height * fit);
                return image;
            });

            // Altezza di ogni riga: il contenuto più alto fra le celle della riga, più il padding
            // del bottone. Con le immagini c'è una sola riga, con i testi due colonne per riga.
            const cellHeight = (i: number) => {
                const image = answerImages[i];
                return (image ? image.displayHeight + captionGap : 0) + answerTexts[i].height;
            };
            const rowCount = Math.ceil(answers.length / columns);
            const rowHeights = Array.from({ length: rowCount }, (_, row) => {
                let tallest = 0;
                for (let i = row * columns; i < Math.min((row + 1) * columns, answers.length); i++) {
                    tallest = Math.max(tallest, cellHeight(i));
                }
                return tallest + buttonPad;
            });
            const matrixHeight = rowHeights.reduce((sum, h) => sum + h, 0) + rowGap * (rowCount - 1);

            // NB: containerHeight copre solo popup+matrice: come in PopupManager, l'etichetta
            // del parlante sporge sopra il bordo superiore del popup invece di farne parte.
            const containerHeight = popupHeight + blockGap + matrixHeight;
            const top = -containerHeight / 2;

            // Sfondo del popup della domanda (stesso linguaggio visivo di PopupManager: pannello
            // scuro/verde acqua con bordo).
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

            // --- Matrice delle risposte, sotto al popup della domanda ---
            const matrixTop = top + popupHeight + blockGap;
            const colX = Array.from({ length: columns }, (_, col) =>
                -matrixWidth / 2 + colWidth / 2 + col * (colWidth + columnGap)
            );

            const rects: Phaser.GameObjects.Rectangle[] = [];
            const panels: PixelPanel[] = [];

            answerTexts.forEach((text, i) => {
                const row = Math.floor(i / columns);
                const col = i % columns;
                const h = rowHeights[row];
                const cellTop = matrixTop + rowHeights.slice(0, row).reduce((sum, rh) => sum + rh + rowGap, 0);
                const centerY = cellTop + h / 2;
                const centerX = colX[col];
                const image = answerImages[i];

                const rect = this.scene.add.rectangle(centerX, centerY, colWidth, h);

                // Immagine e didascalia sono impilate e centrate insieme nella cella; senza
                // immagine la didascalia è da sola al centro, come da sempre. Vanno posizionate
                // *prima* di setupPixelButton, che memorizza la posizione a riposo per animarle.
                if (image) {
                    const stackHeight = image.displayHeight + captionGap + text.height;
                    image.setPosition(centerX, centerY - stackHeight / 2 + image.displayHeight / 2);
                    text.setPosition(centerX, centerY + stackHeight / 2 - text.height / 2);
                } else {
                    text.setPosition(centerX, centerY);
                }

                // Stessa palette/spessore bordo/ombra del pannello della domanda sopra, così le
                // celle della matrice leggono come parte dello stesso popup invece di un widget
                // diverso incollato sotto.
                const handles = setupPixelButton(this.scene, rect, {
                    fillColor: 0x16a085,
                    hoverColor: 0x1abc9c,
                    borderColor: 0x27ae60,
                    borderThickness: 1,
                    shadowOffset: 2,
                    text,
                    icon: image,
                    // Il default (9, 6) è tarato sui bottoni grandi del menu: qui le card sono
                    // poche decine di pixel e farebbe schizzare l'anteprima fuori dal pannello.
                    iconPressShift: { x: 1, y: 1 }
                });
                rect.setInteractive({ useHandCursor: true }).setScrollFactor(0, 0);

                container.add(image ? [handles.graphics, rect, image, text] : [handles.graphics, rect, text]);
                rects.push(rect);
                panels.push(handles.panel);
            });

            container.setScale(baseScale * 0.85).setAlpha(0);
            this.scene.tweens.add({
                targets: container,
                alpha: 1,
                scale: baseScale,
                duration: 200,
                ease: "Back.easeOut"
            });

            let answered = false;
            const answer = (i: number) => {
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
            };

            rects.forEach((rect, i) => {
                rect.on("pointerup", () => {
                    if (answered) return;

                    // Con le anteprime il click non risponde: apre lo zoom, da cui si conferma.
                    const textureKey = textureKeys[i];
                    if (textureKey) {
                        this.openImageZoom(textureKey, labels[i], zoomLabels, rects, baseScale, textResolution, () => answer(i));
                        return;
                    }

                    answer(i);
                });
            });
        });
    }

    // Zoom a schermo intero di un'anteprima, stessa interazione della Gallery (click fuori o ESC
    // per chiudere) ma dimensionato sullo zoom della camera come Stage2.showImageReveal, dato che
    // qui la scena è inquadrata da vicino. In più porta il bottone di conferma: è da qui che si
    // risponde alle domande a immagine, dopo aver potuto guardare il dettaglio da vicino.
    // Le misure interne sono in "pixel di schermo / 5", come nel resto del componente.
    private openImageZoom(
        textureKey: string,
        caption: string,
        zoomLabels: QuizZoomLabels | undefined,
        answerRects: Phaser.GameObjects.Rectangle[],
        baseScale: number,
        textResolution: number,
        onSelect: () => void
    ): void {
        const camera = this.scene.cameras.main;
        const labels = zoomLabels ?? { select: "Choose this", close: "Close" };

        // Finché lo zoom è aperto le card sotto non devono poter rispondere: il backdrop le
        // copre, ma disabilitarle evita qualunque click che gli sfugga.
        answerRects.forEach(r => r.disableInteractive());

        const container = this.scene.add.container(camera.centerX, camera.centerY);
        container.setScale(baseScale);
        this.layer.add(container); // dopo il container della domanda, quindi sopra di esso

        const backdrop = this.scene.add
            .rectangle(0, 0, camera.width / BASE_ZOOM, camera.height / BASE_ZOOM, 0x000000, 0.85)
            .setScrollFactor(0, 0)
            .setInteractive();
        container.add(backdrop);

        const image = this.scene.add.image(0, 0, textureKey).setScrollFactor(0, 0);
        const fit = Math.min(200 / image.width, 100 / image.height);
        image.setDisplaySize(image.width * fit, image.height * fit);
        container.add(image);

        const captionText = this.scene.add.text(0, 0, caption, {
            fontSize: "7px",
            color: "#ffffff",
            fontFamily: FONT_FAMILY,
            resolution: textResolution,
            align: "center"
        }).setOrigin(0.5, 0.5).setScrollFactor(0, 0);
        container.add(captionText);

        const buttonGap = 6;
        const rowGap = 6;
        captionText.setPosition(0, -(image.displayHeight / 2 + rowGap + captionText.height / 2));

        let closed = false;
        const close = (then?: () => void) => {
            if (closed) return;
            closed = true;
            this.scene.input.keyboard?.off("keydown-ESC", onEscape);
            this.scene.tweens.add({
                targets: container,
                alpha: 0,
                duration: 200,
                ease: "Power2.easeIn",
                onComplete: () => {
                    container.destroy();
                    if (then) {
                        then();
                    } else {
                        answerRects.forEach(r => r.setInteractive({ useHandCursor: true }));
                    }
                }
            });
        };
        const onEscape = () => close();

        // I due bottoni sotto all'immagine: conferma la risposta, oppure torna alla domanda.
        const buttons: Array<{ label: string; onClick: () => void }> = [
            { label: labels.select, onClick: () => close(onSelect) },
            { label: labels.close, onClick: () => close() }
        ];
        const buttonTexts = buttons.map(button =>
            this.scene.add.text(0, 0, button.label, {
                fontSize: "7px",
                color: "#ffffff",
                fontFamily: FONT_FAMILY,
                resolution: textResolution,
                align: "center"
            }).setOrigin(0.5, 0.5).setScrollFactor(0, 0)
        );
        const buttonWidths = buttonTexts.map(text => text.width + 14);
        const buttonHeight = Math.max(...buttonTexts.map(text => text.height)) + 6;
        const buttonsWidth = buttonWidths.reduce((sum, w) => sum + w, 0) + buttonGap * (buttons.length - 1);
        const buttonY = image.displayHeight / 2 + rowGap + buttonHeight / 2;

        let cursorX = -buttonsWidth / 2;
        buttons.forEach((button, i) => {
            const centerX = cursorX + buttonWidths[i] / 2;
            cursorX += buttonWidths[i] + buttonGap;

            const rect = this.scene.add.rectangle(centerX, buttonY, buttonWidths[i], buttonHeight);
            buttonTexts[i].setPosition(centerX, buttonY);

            const handles = setupPixelButton(this.scene, rect, {
                fillColor: 0x16a085,
                hoverColor: 0x1abc9c,
                borderColor: 0x27ae60,
                borderThickness: 1,
                shadowOffset: 2,
                text: buttonTexts[i]
            });
            rect.setInteractive({ useHandCursor: true }).setScrollFactor(0, 0);
            rect.on("pointerup", button.onClick);

            container.add([handles.graphics, rect, buttonTexts[i]]);
        });

        backdrop.on("pointerup", () => close());
        this.scene.input.keyboard?.on("keydown-ESC", onEscape);

        container.setAlpha(0);
        this.scene.tweens.add({ targets: container, alpha: 1, duration: 200, ease: "Sine.easeOut" });
    }

    // Festeggiamento per la risposta corretta: stessa "fireworks" a scoppi multipli usata da
    // GraficoGame per la vittoria finale (ParticleFx.flashBurst + sparkBurst), ma più breve dato
    // che qui si ripete ad ogni domanda invece che una sola volta a fine minigioco. I punti sono
    // scelti dentro camera.worldView (l'area di mondo attualmente visibile) invece che in
    // coordinate schermo fisse, così i fuochi d'artificio appaiono sempre sull'area inquadrata
    // qualunque sia la posizione della camera in quel momento.
    private celebrate(): void {
        soundManager.playSfx(this.scene, "quiz_correct");
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
        soundManager.playSfx(this.scene, "quiz_incorrect");
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
