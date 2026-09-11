import PixelPanel from "./PixelPanel";
import { soundManager } from "../../audio/SoundManager";

// Define popup preset configuration
interface PopupPreset {
    bgColor: number;
    bgAlpha: number;
    borderColor: number;
    borderAlpha: number;
    textFontSize: string;
    textColor: string;
    buttonWidth: number;
    buttonHeight: number;
    buttonBgColor: number;
    buttonBorderColor: number;
    buttonTextColor: string;
    padding: number;
    buttonMargin: number;
    minWidth: number;
    textWordWrapWidth: number;
    animationDuration: number;
    animationEase: string;
    closeAnimationDuration: number;
    closeAnimationEase: string;
    showButton: boolean;
    allowKeyClose: boolean;
    typewriterEnabled: boolean;
    typewriterDelay: number;
    allowSkipTypewriter: boolean;
    speakerName: string;
    speakerNameColor: string;
    voicePitch: number;
}

// Configurazioni predefinite dei popup
const POPUP_PRESETS: Record<string, PopupPreset> = {
    default: { // preset standard per il personaggio principale
        bgColor: 0x111111,
        bgAlpha: 0.7,
        borderColor: 0xffffff,
        borderAlpha: 0.8,
        textFontSize: '8px',
        textColor: '#ffffff',
        buttonWidth: 40,
        buttonHeight: 10,
        buttonBgColor: 0x4CAF50,
        buttonBorderColor: 0x45a049,
        buttonTextColor: '#ffffff',
        padding: 6,
        buttonMargin: -2.5,
        minWidth: 60,
        textWordWrapWidth: 200,
        animationDuration: 200,
        animationEase: 'Back.easeOut',
        closeAnimationDuration: 150,
        closeAnimationEase: 'Power2.easeIn',
        showButton: true,
        allowKeyClose: true,
        typewriterEnabled: true,
        typewriterDelay: 20,
        allowSkipTypewriter: true,
        speakerName: 'You',
        speakerNameColor: '#000000',
        voicePitch: 1
    },
    dark: { // preset per il narratore, presentato come una figura oscura
        bgColor: 0x000000,
        bgAlpha: 0.8,
        borderColor: 0x663399,
        borderAlpha: 0.7,
        textFontSize: '8px',
        textColor: '#bdc3c7',
        buttonWidth: 40,
        buttonHeight: 10,
        buttonBgColor: 0x663399,
        buttonBorderColor: 0x5e3370,
        buttonTextColor: '#ffffff',
        padding: 6,
        buttonMargin: -2.5,
        minWidth: 60,
        textWordWrapWidth: 200,
        animationDuration: 100,
        animationEase: 'Back.easeOut',
        closeAnimationDuration: 100,
        closeAnimationEase: 'Power2.easeIn',
        showButton: true,
        allowKeyClose: true,
        typewriterEnabled: true,
        typewriterDelay: 40,
        allowSkipTypewriter: true,
        speakerName: '...',
        speakerNameColor: '#ffffff',
        voicePitch: 0.65
    },
    hint: { // preset per suggerimenti e istruzioni
        bgColor: 0x2c3e50,
        bgAlpha: 0.8,
        borderColor: 0xf39c12,
        borderAlpha: 0.65,
        textFontSize: '7px',
        textColor: '#ecf0f1',
        buttonWidth: 35,
        buttonHeight: 9,
        buttonBgColor: 0xf39c12,
        buttonBorderColor: 0xe67e22,
        buttonTextColor: '#ffffff',
        padding: 8,
        buttonMargin: -3,
        minWidth: 70,
        textWordWrapWidth: 220,
        animationDuration: 300,
        animationEase: 'Back.easeOut',
        closeAnimationDuration: 200,
        closeAnimationEase: 'Power2.easeIn',
        showButton: true,
        allowKeyClose: true,
        typewriterEnabled: false,
        typewriterDelay: 0,
        allowSkipTypewriter: false,
        speakerName: 'Tutorial',
        speakerNameColor: '#ffffff',
        voicePitch: 1.35
    },
    shooterYou: { // variante ingrandita di 'default', per i dialoghi del tutorial dello Shooter
        bgColor: 0x111111,
        bgAlpha: 0.7,
        borderColor: 0xffffff,
        borderAlpha: 0.8,
        textFontSize: '13px',
        textColor: '#ffffff',
        buttonWidth: 60,
        buttonHeight: 15,
        buttonBgColor: 0x4CAF50,
        buttonBorderColor: 0x45a049,
        buttonTextColor: '#ffffff',
        padding: 10,
        buttonMargin: -3.5,
        minWidth: 100,
        textWordWrapWidth: 340,
        animationDuration: 200,
        animationEase: 'Back.easeOut',
        closeAnimationDuration: 150,
        closeAnimationEase: 'Power2.easeIn',
        showButton: true,
        allowKeyClose: true,
        typewriterEnabled: true,
        typewriterDelay: 20,
        allowSkipTypewriter: true,
        speakerName: 'You',
        speakerNameColor: '#000000',
        voicePitch: 1
    },
    shooterHint: { // variante ingrandita di 'hint', per i dialoghi del tutorial dello Shooter
        bgColor: 0x2c3e50,
        bgAlpha: 0.8,
        borderColor: 0xf39c12,
        borderAlpha: 0.65,
        textFontSize: '12px',
        textColor: '#ecf0f1',
        buttonWidth: 55,
        buttonHeight: 14,
        buttonBgColor: 0xf39c12,
        buttonBorderColor: 0xe67e22,
        buttonTextColor: '#ffffff',
        padding: 12,
        buttonMargin: -4,
        minWidth: 110,
        textWordWrapWidth: 360,
        animationDuration: 300,
        animationEase: 'Back.easeOut',
        closeAnimationDuration: 200,
        closeAnimationEase: 'Power2.easeIn',
        showButton: true,
        allowKeyClose: true,
        typewriterEnabled: false,
        typewriterDelay: 0,
        allowSkipTypewriter: false,
        speakerName: 'Tutorial',
        speakerNameColor: '#ffffff',
        voicePitch: 1.35
    },
    shooterNarrator: { // narratore dello Shooter: stesso look di 'shooterHint', nome distinto
        bgColor: 0x2c3e50,
        bgAlpha: 0.8,
        borderColor: 0xf39c12,
        borderAlpha: 0.65,
        textFontSize: '12px',
        textColor: '#ecf0f1',
        buttonWidth: 55,
        buttonHeight: 14,
        buttonBgColor: 0xf39c12,
        buttonBorderColor: 0xe67e22,
        buttonTextColor: '#ffffff',
        padding: 12,
        buttonMargin: -4,
        minWidth: 110,
        textWordWrapWidth: 360,
        animationDuration: 300,
        animationEase: 'Back.easeOut',
        closeAnimationDuration: 200,
        closeAnimationEase: 'Power2.easeIn',
        showButton: true,
        allowKeyClose: true,
        typewriterEnabled: false,
        typewriterDelay: 0,
        allowSkipTypewriter: false,
        speakerName: 'Tutorial',
        speakerNameColor: '#ffffff',
        voicePitch: 1.35
    }
};

export default class PopupManager {
    protected scene: Phaser.Scene;

    protected popupQueue: { message: string; preset: string }[] = [];
    protected currentPopup: Phaser.GameObjects.Container | null = null;
    protected isPopupActive: boolean = false;

    protected enterKey?: Phaser.Input.Keyboard.Key; 

    protected layer: Phaser.GameObjects.Layer;

    protected autoCloseTimer: Phaser.Time.TimerEvent | null = null;
    protected popupDuration: number | 'infinite' = 'infinite';

    protected typewriterTimer: Phaser.Time.TimerEvent | null = null;
    protected isTextComplete: boolean = false;

    // 'bottom' (default) keeps the original bottom-center placement used by Stage1/GraficoGame;
    // 'center' is used by Shooter, whose arcade-screen layout has no room at the bottom for popups.
    protected anchor: 'bottom' | 'center';

    // Zoom della camera al primo popup effettivamente mostrato: da lì in poi i popup vengono
    // ridimensionati per apparire sempre a questa stessa dimensione sullo schermo, anche se lo
    // zoom della camera cambia in seguito (es. lo zoom-out del finale di Stage2). Non viene
    // catturato nel costruttore perché alcune scene (GraficoGame, Stage1_Lab) lo costruiscono
    // prima che lo zoom/fade introduttivo si assesti sul valore "di riposo".
    protected baseZoom: number | null = null;

    constructor(scene: Phaser.Scene, options?: { anchor?: 'bottom' | 'center' }) {
        this.scene = scene;
        this.anchor = options?.anchor ?? 'bottom';
        // Configura il tasto Invio
        this.enterKey = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

        //creo uno strato per i popup
        this.layer = this.scene.add.layer();
        this.layer.setDepth(1000); // Sopra tutto

    }

    // Cancella il timer dell'effetto typewriter, se attivo
    protected clearTypewriterTimer() {
        if (this.typewriterTimer) {
            this.scene.time.removeEvent(this.typewriterTimer);
            this.typewriterTimer = null;
        }
    }

    // Cancella il timer di auto-chiusura, se attivo
    protected clearAutoCloseTimer() {
        if (this.autoCloseTimer) {
            this.scene.time.removeEvent(this.autoCloseTimer);
            this.autoCloseTimer = null;
        }
    }

    // Aggiunge un popup alla coda
    public queuePopup(message: string, preset: string = 'default') {
        this.popupQueue.push({ message, preset });
    }

    // Mostra il prossimo popup della coda
    public showNextPopup(autoCloseDelay: number | 'infinite' = 'infinite') {
        // Se c'è già un popup attivo o la coda è vuota, non fare nulla
        if (this.isPopupActive || this.popupQueue.length === 0) {
            return;
        }

        this.popupDuration = autoCloseDelay;
        
        // Prendi il primo messaggio dalla coda
        const popupData = this.popupQueue.shift();
        if (popupData) {
            const { message, preset } = popupData;
            this.isPopupActive = true;
            this.currentPopup = this.createInteractivePopup(message, preset, autoCloseDelay);
            
            // Emetti l'evento di popup mostrato
            this.scene.events.emit('popup-shown');
        }
    }

    // Chiamata quando un popup viene chiuso
    protected onPopupClosed() {
        // Pulisci i timer
        this.clearTypewriterTimer();

        this.isPopupActive = false;
        this.currentPopup = null;
        this.isTextComplete = false;
        
        // Emetti l'evento di chiusura popup
        this.scene.events.emit('popup-closed');
        
        // Mostra il prossimo popup se ce ne sono altri
        this.showNextPopup(this.popupDuration);
    }

    // Pre-calcola i word wrap inserendo \n dove necessario per evitare overflow durante il typewriter
    protected preWrapText(message: string, maxWidth: number, fontSize: string): string {
        // Crea un text object temporaneo per misurare
        const tempText = this.scene.add.text(0, 0, '', {
            fontSize: fontSize,
            fontFamily: 'PixelifySans-VariableFont_wght',
            resolution: 5
        });

        const words = message.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const testLine = currentLine === '' ? word : currentLine + ' ' + word;
            
            // Misura la larghezza della linea di test
            tempText.setText(testLine);
            const testWidth = tempText.width;

            if (testWidth > maxWidth && currentLine !== '') {
                // La parola eccede, aggiungi la linea corrente e inizia una nuova
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }

        // Aggiungi l'ultima linea
        if (currentLine !== '') {
            lines.push(currentLine);
        }

        tempText.destroy();
        return lines.join('\n');
    }

    // Ricerca nel testo le varie formattazioni e pause e suddivide in segmenti il testo, accompagnati dalle proprietà che ne definiscono lo stile
    protected parseTextEffects(message: string): Array<{text: string, isBold: boolean, speedMultiplier: number, instant: boolean, pauseDuration?: number}> {
        const segments: Array<{text: string, isBold: boolean, speedMultiplier: number, instant: boolean, pauseDuration?: number}> = [];
        let currentPos = 0;
        
        // REGEX per i diversi pattern da riconoscere
        const patterns = [
            { regex: /\*\*(.*?)\*\*/g, isBold: true, speedMultiplier: 1, instant: true }, // **MAIUSCOLO**
            { regex: /<<(.*?)<</g, isBold: false, speedMultiplier: 2, instant: false }, // <<lento<<
            { regex: />>(.*?)>>/g, isBold: false, speedMultiplier: 0.5, instant: false }, // >>veloce>>
            { regex: /\|\|/g, isBold: false, speedMultiplier: 1, instant: false, isPause: true } // || pausa
        ];

        // Trova tutte le corrispondenze per tutti i pattern
        const matches: Array<{start: number, end: number, text: string, isBold: boolean, speedMultiplier: number, instant: boolean, isPause?: boolean}> = [];
        patterns.forEach(pattern => {
            const regex = new RegExp(pattern.regex.source, 'g');
            let match;
            while ((match = regex.exec(message)) !== null) {
                matches.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    text: match[1] || '', // For pause pattern (||), there's no capture group
                    isBold: pattern.isBold,
                    speedMultiplier: pattern.speedMultiplier,
                    instant: pattern.instant,
                    isPause: (pattern as any).isPause
                });
            }
        });
        // Ordina le corrispondenze per posizione nel testo
        matches.sort((a, b) => a.start - b.start);

        // Costruisce i segmenti attraverso le corrispondenze trovate
        matches.forEach(match => {
            // Aggiunge eventuale testo normale prima di questa corrispondenza
            if (currentPos < match.start) {
                const plainText = message.substring(currentPos, match.start);
                if (plainText) {
                    segments.push({text: plainText, isBold: false, speedMultiplier: 1, instant: false});
                }
            }
            
            // Gestisce il separatore di pausa (||)
            if (match.isPause) {
                segments.push({text: '', isBold: false, speedMultiplier: 1, instant: false, pauseDuration: 500});
                currentPos = match.end;
                return;
            }
            
            //  Aggiungi pausa prima del testo in grassetto
            if (match.isBold && match.instant) {
                segments.push({text: '', isBold: false, speedMultiplier: 1, instant: false, pauseDuration: 300});
            }
            
            // Aggiungi il segmento formattato
            segments.push({
                text: match.text,
                isBold: match.isBold,
                speedMultiplier: match.speedMultiplier,
                instant: match.instant
            });
            
            // Aggiungi pausa dopo il testo in grassetto
            if (match.isBold && match.instant) {
                segments.push({text: '', isBold: false, speedMultiplier: 1, instant: false, pauseDuration: 300});
            }
            
            currentPos = match.end;
        });

        // Aggiunge eventuale testo normale rimanente dopo l'ultima corrispondenza
        if (currentPos < message.length) {
            const plainText = message.substring(currentPos);
            if (plainText) {
                segments.push({text: plainText, isBold: false, speedMultiplier: 1, instant: false});
            }
        }

        // Se non sono stati trovati segmenti, aggiungi l'intero messaggio come testo normale
        if (segments.length === 0) {
            segments.push({text: message, isBold: false, speedMultiplier: 1, instant: false});
        }

        return segments;
    }

    // Effetto typewriter con supporto per formattazioni e pause
    protected typewriterEffect(
        textObject: Phaser.GameObjects.Text,
        fullMessage: string,
        preset: PopupPreset,
        onComplete: () => void
    ): Phaser.Time.TimerEvent | null {
        if (!preset.typewriterEnabled) {
            textObject.setText(fullMessage);
            onComplete();
            return null;
        }

        // Pre-calcola il word wrap per evitare overflow durante la digitazione
        const wrappedMessage = this.preWrapText(fullMessage, preset.textWordWrapWidth - preset.padding, preset.textFontSize);
        const textSegments = this.parseTextEffects(wrappedMessage);
        let segmentIndex = 0;
        let charIndex = 0;
        let completedText = '';
        const tickMs = 10;
        let waitMs = 0;

        const processNextChar = () => {
            // Evita crash se il popup/testo è già stato distrutto
            if (!textObject.active || !textObject.scene) {
                timer.remove();
                return;
            }

            if (waitMs > 0) {
                waitMs -= tickMs;
                return;
            }

            if (segmentIndex >= textSegments.length) {
                timer.remove();
                onComplete();
                return;
            }

            const segment = textSegments[segmentIndex];
            
            // Pausa tra segmenti
            if (segment.pauseDuration) {
                segmentIndex++;
                charIndex = 0;
                waitMs = segment.pauseDuration;
                return;
            }
            
            // Gestisce i segmenti con visualizzazione istantanea
            if (segment.instant) {
                completedText += segment.isBold ? segment.text.toUpperCase() : segment.text;
                textObject.setText(completedText);
                if (segment.isBold) soundManager.playSfx(this.scene, "vine_boom");
                segmentIndex++;
                charIndex = 0;
                waitMs = preset.typewriterDelay;
                return;
            }

            // Gestisce la visualizzazione carattere per carattere
            if (charIndex < segment.text.length) {
                const currentChar = segment.text[charIndex];
                const styledChar = segment.isBold ? currentChar.toUpperCase() : currentChar;
                
                textObject.setText(completedText + styledChar);
                completedText += styledChar;
                // Throttled to every other non-space character - a per-char blip at a ~10-40ms
                // tick would otherwise machine-gun the same short sample.
                if (currentChar !== ' ' && charIndex % 2 === 0) soundManager.playSfx(this.scene, "type_blip", { rate: preset.voicePitch });
                charIndex++;

                waitMs = Math.max(10, preset.typewriterDelay * segment.speedMultiplier);
            } else {
                segmentIndex++;
                charIndex = 0;
                waitMs = preset.typewriterDelay;
            }
        };

        const timer = this.scene.time.addEvent({
            delay: tickMs,
            callback: processNextChar,
            loop: true
        });

        return timer;
    }

    // Crea il popup interattivo
    protected createInteractivePopup(message: string, presetName: string = "default", autoCloseDelay: number | 'infinite' = 'infinite'): Phaser.GameObjects.Container {
        const preset = POPUP_PRESETS[presetName] || POPUP_PRESETS.default;

        const zoom = this.scene.cameras.main.zoom;
        if (this.baseZoom === null) {
            this.baseZoom = zoom;
        }
        const zoomCompensation = this.baseZoom / zoom;

        // Container per il popup
        const popup = this.scene.add.container(this.scene.scale.width / 2, this.scene.scale.height / 2);

        //aggiungo il container al layer
        this.layer.add(popup);
        
        // Pulisce il messaggio dai caratteri jolly di formattazione
        const cleanMessage = message
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/<<(.*?)<</g, '$1')
            .replace(/>>(.*?)>>/g, '$1')
            .replace(/\|\|/g, '');
        
        // Crea il testo prima per misurare le dimensioni (con testo completo per layout)
        const text = this.scene.add.text(0, -10, cleanMessage, {
            fontSize: preset.textFontSize,
            color: preset.textColor,
            fontStyle: '',
            fontFamily: 'PixelifySans-VariableFont_wght',
            resolution: 5,
            align: 'left',
            wordWrap: { width: preset.textWordWrapWidth }
        });
        text.setOrigin(0, 0.5);
        
        text.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);

        // Calcola le dimensioni del contenitore basate sul testo
        const textWidth = text.width;
        const textHeight = text.height;
        const padding = preset.padding;
        const buttonWidth = preset.buttonWidth;
        const buttonHeight = preset.buttonHeight;
        const buttonMargin = preset.buttonMargin;
        
        let containerHeight = textHeight + padding * 2;
        
        const containerWidth = Math.max(textWidth + padding * 2, preset.minWidth);
        const buttonY = textHeight / 2 + padding + buttonMargin + buttonHeight / 2;
        
        const bg = this.scene.add.graphics();
        bg.setScrollFactor(0, 0);
        new PixelPanel(bg, -containerWidth/2, -containerHeight/2, containerWidth, containerHeight, {
            fillColor: preset.bgColor,
            fillAlpha: preset.bgAlpha,
            borderColor: preset.borderColor,
            borderAlpha: preset.borderAlpha,
            borderThickness: 1,
            shadowOffset: 2,
        });
        
        // Create speaker name box in top-left corner
        const speakerBoxPadding = 2;
        const speakerText = this.scene.add.text(0, 0, preset.speakerName, {
            fontSize: '6px',
            color: preset.speakerNameColor,
            fontFamily: 'PixelifySans-VariableFont_wght',
            resolution: 5,
            align: 'center'
        });
        speakerText.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
        const speakerBoxWidth = speakerText.width + speakerBoxPadding * 2;
        const speakerBoxHeight = speakerText.height + speakerBoxPadding * 2;
        
        const speakerBox = this.scene.add.graphics();
        speakerBox.setScrollFactor(0, 0);
        new PixelPanel(speakerBox, -containerWidth/2 + 2, -containerHeight/2 - speakerBoxHeight, speakerBoxWidth, speakerBoxHeight, {
            fillColor: preset.borderColor,
            borderThickness: 1,
            shadowOffset: 1,
        });
        
        speakerText.setPosition(-containerWidth/2 + speakerBoxPadding + 2, -containerHeight/2 - speakerBoxHeight + speakerBoxPadding);
        speakerText.setOrigin(0, 0);
        speakerText.setScrollFactor(0, 0);
        
        // Riposiziona il testo al centro dell'area testo
        const textY = -containerHeight/2 + padding + textHeight/2;
        const textX = -containerWidth/2 + padding;
        text.setPosition(textX, textY);
        text.setScrollFactor(0, 0);

        // Crea il pulsante OK solo se showButton è true nel preset
        let okButton: Phaser.GameObjects.Graphics | null = null;
        let okText: Phaser.GameObjects.Text | null = null;
        let okPanel: PixelPanel | null = null;

        if (preset.showButton) {
            okButton = this.scene.add.graphics();
            // Il graphics viene posizionato sul centro del bottone (invece che sull'origine del popup)
            // così scale/tween di hover-press ruotano attorno al centro visivo del bottone, non del popup.
            okButton.setPosition(0, buttonY);
            okPanel = new PixelPanel(okButton, -buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, {
                fillColor: preset.buttonBgColor,
                borderColor: preset.buttonBorderColor,
                borderThickness: 1,
                shadowOffset: 2,
            });
            okButton.setInteractive(new Phaser.Geom.Rectangle(-buttonWidth/2 - 3, -buttonHeight/2 - 3, buttonWidth + 6, buttonHeight + 6), Phaser.Geom.Rectangle.Contains);
            okButton.setScrollFactor(0, 0);
            
            okText = this.scene.add.text(0, buttonY, 'OK', {
                fontSize: preset.textFontSize,
                color: preset.buttonTextColor,
                fontFamily: 'PixelifySans-VariableFont_wght',
                fontStyle: 'bold',
                resolution: 5,
                align: 'center',
            });
            okText.setOrigin(0.5);
            okText.setScrollFactor(0, 0);
            okText.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
        }
        
        // Aggiungi tutto al container
        const items: Phaser.GameObjects.GameObject[] = [bg, speakerBox, speakerText, text];
        if (okButton) items.push(okButton);
        if (okText) items.push(okText);
        popup.add(items);
        popup.setScale(0.8 * zoomCompensation);
        popup.setAlpha(0);
        
        // Posiziona il popup al basso al centro dello schermo (o al centro, per le scene con anchor 'center').
        // scale.width/2 e scale.height/2 sono il punto fisso della camera (invariante rispetto allo zoom, dato
        // scrollX/scrollY = 0), quindi per l'anchor 'center' bastano senza alcuna compensazione dello zoom.
        const targetY = this.anchor === 'center'
            ? this.scene.scale.height / 2
            : (this.scene.scale.height * (1 + 1 / (2 * this.scene.cameras.main.zoom)) - containerHeight - buttonHeight - buttonMargin) * 0.5;
        popup.setPosition(this.scene.scale.width / 2, targetY);
        
        // Animazione
        this.scene.tweens.add({
            targets: popup,
            alpha: 1,
            scale: zoomCompensation,
            duration: preset.animationDuration,
            ease: preset.animationEase
        });

        // Inizializza stato typewriter
        this.isTextComplete = !preset.typewriterEnabled;

        // Avvia typewriter dopo l'animazione del popup
        if (preset.typewriterEnabled) {
            text.setText(''); // Inizia con testo vuoto
            this.scene.time.delayedCall(preset.animationDuration, () => {
                if (!popup.active || this.currentPopup !== popup || !text.active) {
                    return;
                }

                this.typewriterTimer = this.typewriterEffect(text, message, preset, () => {
                    this.isTextComplete = true;
                    this.typewriterTimer = null;

                    // Avvia auto-close DOPO che il testo è completo
                    if (autoCloseDelay !== 'infinite' && typeof autoCloseDelay === 'number' && autoCloseDelay > 0) {
                        this.autoCloseTimer = this.scene.time.delayedCall(autoCloseDelay, closePopup);
                    }
                });
            });
        } else {
            // Se typewriter è disabilitato, avvia auto-close subito dopo l'animazione
            if (autoCloseDelay !== 'infinite' && typeof autoCloseDelay === 'number' && autoCloseDelay > 0) {
                this.scene.time.delayedCall(preset.animationDuration, () => {
                    this.autoCloseTimer = this.scene.time.delayedCall(autoCloseDelay, closePopup);
                });
            }
        }
        
        // Funzione per chiudere il popup (condivisa tra click e tasto Invio)
        let isClosing = false;
        const closePopup = () => {
            if (isClosing || !popup.active) {
                return;
            }

            // Se il typewriter è attivo e skip è permesso, completa il testo invece di chiudere
            if (!this.isTextComplete && preset.allowSkipTypewriter && this.typewriterTimer) {
                this.clearTypewriterTimer();
                // Apply bold to the full message
                const segments = this.parseTextEffects(message);
                const fullStyledText = segments.map(seg => seg.isBold ? seg.text.toUpperCase() : seg.text).join('');
                if (text.active) {
                    text.setText(fullStyledText);
                }
                this.isTextComplete = true;

                // Avvia auto-close dopo aver completato il testo
                if (autoCloseDelay !== 'infinite' && typeof autoCloseDelay === 'number' && autoCloseDelay > 0) {
                    this.autoCloseTimer = this.scene.time.delayedCall(autoCloseDelay, closePopup);
                }
                return; // Non chiudere, solo completa il testo
            }

            isClosing = true;

            // Cancella i timer se esistono
            if (this.autoCloseTimer) {
                this.clearAutoCloseTimer();

                if (this.popupQueue.length == 0) {
                    this.popupDuration = 'infinite'; // resetto la durata del popup alla fine della coda
                }
            }

            this.clearTypewriterTimer();

            this.scene.tweens.add({
                targets: popup,
                alpha: 0,
                y: popup.y - 5,
                duration: preset.closeAnimationDuration,
                ease: preset.closeAnimationEase,
                onComplete: () => {
                    popup.destroy();
                    this.onPopupClosed();
                    isClosing = false;
                }
            });
        };

        // Gestione feedback hover/press e click del pulsante OK
        if (okButton && okPanel) {
            const panel = okPanel;
            const scaleTargets: Phaser.GameObjects.GameObject[] = okText ? [okButton, okText] : [okButton];
            const tweenOkScale = (scale: number) => {
                this.scene.tweens.add({ targets: scaleTargets, scale, duration: 90, ease: 'Sine.easeOut' });
            };

            okButton.on('pointerover', () => { panel.redraw('hover'); tweenOkScale(1.08); });
            okButton.on('pointerout', () => { panel.redraw('idle'); tweenOkScale(1); });
            okButton.on('pointerdown', () => { panel.redraw('press'); tweenOkScale(0.92); });
            okButton.on('pointerup', () => {
                panel.redraw('hover');
                tweenOkScale(1.08);
                closePopup();
            });
        }

        // Gestione tasto Invio
        const onEnterDown = () => {
            if (preset.allowKeyClose && this.isPopupActive && this.currentPopup === popup) {
                closePopup();
            }
        };

        // Aggiungi listener per il tasto Invio
        this.enterKey?.on('down', onEnterDown);

        // Rimuovi il listener quando il popup viene distrutto
        const originalDestroy = popup.destroy.bind(popup);
        popup.destroy = () => {
            this.enterKey?.off('down', onEnterDown);
            this.clearAutoCloseTimer();
            this.clearTypewriterTimer();
            originalDestroy();
        };

        return popup;
    }

    //metodo hasnext 
    public hasNext(): boolean {
        return this.popupQueue.length > 0;
    }

    // Metodo per pulire tutto quando necessario
    public destroy() {
        this.clearAutoCloseTimer();
        this.clearTypewriterTimer();

        if (this.currentPopup) {
            this.currentPopup.destroy();
            this.currentPopup = null;
        }
        this.popupQueue = [];
        this.isPopupActive = false;
        // Rimuovi tutti i listener del tasto Invio
        this.enterKey?.removeAllListeners();
    }

    // Getter per sapere se c'è un popup attivo
    public get isActive(): boolean {
        return this.isPopupActive;
    }

    // Getter per la lunghezza della coda
    public get queueLength(): number {
        return this.popupQueue.length;
    }

    //avvia un evento quando la coda è vuota
    public on(event: 'queueEmpty' | 'popupClosed' | 'popupShown', callback: () => void) {
        if (event === 'queueEmpty') {
            const checkQueue = () => {
                if (this.popupQueue.length === 0 && !this.isPopupActive) {
                    callback();
                    this.scene.events.off('update', checkQueue); // Rimuovi il listener dopo la chiamata
                }
            };
            this.scene.events.on('update', checkQueue);
        } else if (event === 'popupClosed') {
            // Evento che si attiva ogni volta che un popup viene chiuso
            this.scene.events.on('popup-closed', callback);
        } else if (event === 'popupShown') {
            // Evento che si attiva ogni volta che un popup viene mostrato
            this.scene.events.on('popup-shown', callback);
        }
    }

}