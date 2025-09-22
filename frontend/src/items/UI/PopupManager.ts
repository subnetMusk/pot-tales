export default class PopupManager {
    private scene: Phaser.Scene;
    private popupQueue: string[] = [];
    private currentPopup: Phaser.GameObjects.Container | null = null;
    private isPopupActive: boolean = false;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    // Aggiunge un popup alla coda
    public queuePopup(message: string) {
        this.popupQueue.push(message);
    }

    // Mostra il prossimo popup della coda
    public showNextPopup() {
        // Se c'è già un popup attivo o la coda è vuota, non fare nulla
        if (this.isPopupActive || this.popupQueue.length === 0) {
            return;
        }
        
        // Prendi il primo messaggio dalla coda
        const message = this.popupQueue.shift();
        if (message) {
            this.isPopupActive = true;
            this.currentPopup = this.createInteractivePopup(message);
        }
    }

    // Chiamata quando un popup viene chiuso
    private onPopupClosed() {
        this.isPopupActive = false;
        this.currentPopup = null;
        
        // Mostra il prossimo popup se ce ne sono altri
        this.showNextPopup();
    }

    // Crea il popup interattivo
    private createInteractivePopup(message: string): Phaser.GameObjects.Container {
        // Container per il popup (completamente fisso rispetto alla camera)
        const popup = this.scene.add.container(this.scene.scale.width / 2, this.scene.scale.height / 2);
        popup.setScrollFactor(0, 0); // Completamente fisso rispetto alla camera
        popup.setDepth(1000); // Sopra tutto
        
        // Crea il testo prima per misurare le dimensioni
        const text = this.scene.add.text(0, -10, message, {
            fontSize: '8px',
            color: '#ffffff',
            fontStyle: 'bold',
            fontFamily: 'Arial, sans-serif',
            resolution: 2,
            align: 'center',
            wordWrap: { width: 200 } // Larghezza massima per il wrapping
        });
        text.setOrigin(0.5);
        
        // Calcola le dimensioni del contenitore basate sul testo
        const textWidth = text.width;
        const textHeight = text.height;
        const padding = 6; // Padding attorno al testo
        const buttonHeight = 10; // Altezza del pulsante OK
        const buttonMargin = 6; // Spazio tra testo e pulsante
        
        const containerWidth = Math.max(textWidth + padding * 2, 60); // Larghezza minima 60px
        const containerHeight = textHeight + padding + buttonHeight + buttonMargin;
        
        // Sfondo adattivo alle dimensioni del contenuto
        const bg = this.scene.add.graphics();
        bg.fillStyle(0x333333, 0.95);
        bg.fillRoundedRect(-containerWidth/2, -containerHeight/2, containerWidth, containerHeight, 6);
        bg.lineStyle(1, 0xffffff, 1);
        bg.strokeRoundedRect(-containerWidth/2, -containerHeight/2, containerWidth, containerHeight, 6);
        bg.setScrollFactor(0, 0); // Assicurati che il background sia fisso
        
        // Riposiziona il testo al centro dell'area testo
        const textY = -containerHeight/2 + padding + textHeight/2;
        text.setPosition(0, textY);
        text.setScrollFactor(0, 0); // Assicurati che il testo sia fisso

        
        // Pulsante OK adattivo
        const buttonWidth = Math.max(40, containerWidth * 0.3); // Larghezza proporzionale
        const buttonY = containerHeight/2 - buttonHeight/2 - 4; // Posizione in fondo al container
        
        const okButton = this.scene.add.graphics();
        okButton.fillStyle(0x4CAF50, 1);
        okButton.fillRoundedRect(-buttonWidth/2, buttonY - buttonHeight/2, buttonWidth, buttonHeight, 3);
        okButton.lineStyle(1, 0x45a049, 1);
        okButton.strokeRoundedRect(-buttonWidth/2, buttonY - buttonHeight/2, buttonWidth, buttonHeight, 3);
        okButton.setInteractive(new Phaser.Geom.Rectangle(-buttonWidth/2, buttonY - buttonHeight/2, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);
        okButton.setScrollFactor(0, 0); // Assicurati che il pulsante sia fisso
        
        const okText = this.scene.add.text(0, buttonY, 'OK', {
            fontSize: '6px',
            color: '#ffffff',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            resolution: 2
        });
        okText.setOrigin(0.5);
        okText.setScrollFactor(0, 0); // Assicurati che il testo del pulsante sia fisso
        
        // Aggiungi tutto al container
        popup.add([bg, text, okButton, okText]);
        popup.setDepth(1000); // Sopra tutto
        popup.setScale(0.8); // Inizia leggermente piccolo ma visibile
        popup.setAlpha(0); // Inizia invisibile
        
        // Posiziona il popup al centro dello schermo (semplificato)
        popup.setPosition(this.scene.scale.width / 2, this.scene.scale.height / 2);
        
        // Animazione senza scaling per evitare blur
        this.scene.tweens.add({
            targets: popup,
            alpha: 1, // Da 0 a 1
            scale: 1, // Da 0.8 a 1
            duration: 200,
            ease: 'Power2.easeOut'
        });
        
        // Gestione click con animazione più pulita
        okButton.on('pointerdown', () => {
            this.scene.tweens.add({
                targets: popup,
                alpha: 0,
                y: popup.y - 5,
                duration: 150,
                ease: 'Power2.easeIn',
                onComplete: () => {
                    popup.destroy();
                    this.onPopupClosed(); // Chiama il callback per mostrare il prossimo popup
                }
            });
        });
        
        return popup;
    }

    // Metodo per pulire tutto quando necessario
    public destroy() {
        if (this.currentPopup) {
            this.currentPopup.destroy();
            this.currentPopup = null;
        }
        this.popupQueue = [];
        this.isPopupActive = false;
    }

    // Getter per sapere se c'è un popup attivo
    public get isActive(): boolean {
        return this.isPopupActive;
    }

    // Getter per la lunghezza della coda
    public get queueLength(): number {
        return this.popupQueue.length;
    }
}