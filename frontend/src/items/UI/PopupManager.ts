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
}

// Preset configurations
const POPUP_PRESETS: Record<string, PopupPreset> = {
    default: {
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
        buttonMargin: 6,
        minWidth: 60,
        textWordWrapWidth: 200,
        animationDuration: 200,
        animationEase: 'Power2.easeOut',
        closeAnimationDuration: 150,
        closeAnimationEase: 'Power2.easeIn',
        showButton: true,
        allowKeyClose: true,
    },
    hint: {
        bgColor: 0x2c3e50,
        bgAlpha: 0.5,
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
        buttonMargin: 8,
        minWidth: 70,
        textWordWrapWidth: 220,
        animationDuration: 300,
        animationEase: 'Power2.easeOut',
        closeAnimationDuration: 200,
        closeAnimationEase: 'Power2.easeIn',
        showButton: true,
        allowKeyClose: true,
    }
};

export default class PopupManager {
    protected scene: Phaser.Scene;
    protected popupQueue: string[] = [];
    protected currentPopup: Phaser.GameObjects.Container | null = null;
    protected isPopupActive: boolean = false;
    protected enterKey?: Phaser.Input.Keyboard.Key; 
    protected layer: Phaser.GameObjects.Layer;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        // Configura il tasto Invio
        this.enterKey = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

        //creo uno strato per i popup
        this.layer = this.scene.add.layer();
        this.layer.setDepth(1000); // Sopra tutto
        
    }

    // Aggiunge un popup alla coda
    public queuePopup(message: string, preset: string = 'default') {
        this.popupQueue.push(JSON.stringify({ message, preset }));
    }

    // Mostra il prossimo popup della coda
    public showNextPopup() {
        // Se c'è già un popup attivo o la coda è vuota, non fare nulla
        if (this.isPopupActive || this.popupQueue.length === 0) {
            return;
        }
        
        // Prendi il primo messaggio dalla coda
        const popupData = this.popupQueue.shift();
        if (popupData) {
            const { message, preset } = JSON.parse(popupData);
            this.isPopupActive = true;
            this.currentPopup = this.createInteractivePopup(message, preset);
            
            // Emetti l'evento di popup mostrato
            this.scene.events.emit('popup-shown');
        }
    }

    // Chiamata quando un popup viene chiuso
    protected onPopupClosed() {
        this.isPopupActive = false;
        this.currentPopup = null;
        
        // Emetti l'evento di chiusura popup
        this.scene.events.emit('popup-closed');
        
        // Mostra il prossimo popup se ce ne sono altri
        this.showNextPopup();
    }

    // Crea il popup interattivo
    protected createInteractivePopup(message: string, presetName: string = "default"): Phaser.GameObjects.Container {
        const preset = POPUP_PRESETS[presetName] || POPUP_PRESETS.default;

        // Container per il popup
        const popup = this.scene.add.container(this.scene.scale.width / 2, this.scene.scale.height / 2);

        //aggiungo il container al layer
        this.layer.add(popup);
        
        // Crea il testo prima per misurare le dimensioni
        const text = this.scene.add.text(0, -10, message, {
            fontSize: preset.textFontSize,
            color: preset.textColor,
            fontStyle: '',
            fontFamily: 'PixelifySans-VariableFont_wght',
            resolution: 5,
            align: 'center',
            wordWrap: { width: preset.textWordWrapWidth }
        });
        text.setOrigin(0.5);
        
        // Calcola le dimensioni del contenitore basate sul testo
        const textWidth = text.width;
        const textHeight = text.height;
        const padding = preset.padding;
        const buttonWidth = preset.buttonWidth;
        const buttonHeight = preset.buttonHeight;
        const buttonMargin = preset.buttonMargin;
        
        let containerHeight = textHeight + padding * 2;
        if (preset.showButton) {
            containerHeight += buttonHeight + buttonMargin;
        }
        
        const containerWidth = Math.max(textWidth + padding * 2, preset.minWidth);
        const buttonY = textHeight / 2 + padding + buttonMargin + buttonHeight / 2;
        
        const bg = this.scene.add.graphics();
        bg.fillStyle(preset.bgColor, preset.bgAlpha);
        bg.fillRect(-containerWidth/2, -containerHeight/2, containerWidth, containerHeight);
        bg.lineStyle(1, preset.borderColor, preset.borderAlpha);
        bg.strokeRect(-containerWidth/2, -containerHeight/2, containerWidth, containerHeight);
        bg.setScrollFactor(0, 0);
        
        // Riposiziona il testo al centro dell'area testo
        const textY = -containerHeight/2 + padding + textHeight/2;
        text.setPosition(0, textY);
        text.setScrollFactor(0, 0);

        // Crea il pulsante OK solo se showButton è true nel preset
        let okButton: Phaser.GameObjects.Graphics | null = null;
        let okText: Phaser.GameObjects.Text | null = null;

        if (preset.showButton) {
            okButton = this.scene.add.graphics();
            okButton.fillStyle(preset.buttonBgColor, 1);
            okButton.fillRect(-buttonWidth/2, buttonY - buttonHeight/2, buttonWidth, buttonHeight);
            okButton.lineStyle(1, preset.buttonBorderColor, 1);
            okButton.strokeRect(-buttonWidth/2, buttonY - buttonHeight/2, buttonWidth, buttonHeight);
            okButton.setInteractive(new Phaser.Geom.Rectangle(-buttonWidth/2, buttonY - buttonHeight/2, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);
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
        }
        
        // Aggiungi tutto al container
        const items: Phaser.GameObjects.GameObject[] = [bg, text];
        if (okButton) items.push(okButton);
        if (okText) items.push(okText);
        popup.add(items);
        popup.setScale(0.8);
        popup.setAlpha(0);
        
        // Posiziona il popup al basso al centro dello schermo
        popup.setPosition(this.scene.scale.width / 2, (this.scene.scale.height * (1 + 1 / (2 * this.scene.cameras.main.zoom)) - containerHeight - buttonHeight - buttonMargin) * 0.5);
        
        // Animazione
        this.scene.tweens.add({
            targets: popup,
            alpha: 1,
            scale: 1,
            duration: preset.animationDuration,
            ease: preset.animationEase
        });
        
        // Funzione per chiudere il popup (condivisa tra click e tasto Invio)
        const closePopup = () => {
            this.scene.tweens.add({
                targets: popup,
                alpha: 0,
                y: popup.y - 5,
                duration: preset.closeAnimationDuration,
                ease: preset.closeAnimationEase,
                onComplete: () => {
                    popup.destroy();
                    this.onPopupClosed();
                }
            });
        };

        // Gestione click del pulsante OK
        if (okButton) {
            okButton.on('pointerdown', closePopup);
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