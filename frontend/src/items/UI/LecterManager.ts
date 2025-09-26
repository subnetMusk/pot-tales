export default class LecterManager {
    private scene: Phaser.Scene;
    private popupQueue: string[] = [];
    private currentPopup: Phaser.GameObjects.Container | null = null;
    private isPopupActive: boolean = false;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    // Aggiunge una lettera alla coda
    public queueLetter(message: string) {
        this.popupQueue.push(message);
    }

    // Mostra la prossima lettera della coda
    public showNextLetter() {
        // Se c'è già una lettera attiva o la coda è vuota, non fare nulla
        if (this.isPopupActive || this.popupQueue.length === 0) {
            return;
        }
        
        // Prendi il primo messaggio dalla coda
        const message = this.popupQueue.shift();
        if (message) {
            this.isPopupActive = true;
            this.currentPopup = this.createInteractiveLetter(message);
        }
    }

    // Chiamata quando una lettera viene chiusa
    private onLetterClosed() {
        this.isPopupActive = false;
        this.currentPopup = null;
        
        // Mostra la prossima lettera se ce ne sono altre
        this.showNextLetter();
    }

    // Crea la lettera interattiva
    private createInteractiveLetter(message: string): Phaser.GameObjects.Container {
        // Container per la lettera (completamente fisso rispetto alla camera)
        const popup = this.scene.add.container(this.scene.scale.width / 2, this.scene.scale.height / 2);
        popup.setScrollFactor(0, 0); // Completamente fisso rispetto alla camera
        popup.setDepth(1000); // Sopra tutto
        
        // Crea il testo prima per misurare le dimensioni
        const text = this.scene.add.text(0, -10, message, {
            fontSize: '7px',
            color: '#2F4F2F', // Verde scuro per contrasto su sfondo beige
            fontStyle: 'bold',
            fontFamily: 'Arial, sans-serif',
            resolution: 2,
            align: 'center',
            wordWrap: { width: 180 } // Larghezza massima aumentata per testo più grande
        });
        text.setOrigin(0.5);
        
        // Calcola le dimensioni del contenitore basate sul testo
        const textWidth = text.width;
        const textHeight = text.height;
        const padding = 10; // Padding aumentato per testo più grande
        const buttonHeight = 8; // Altezza del pulsante aumentata
        const buttonMargin = 6; // Spazio tra testo e pulsante aumentato
        
        const containerWidth = Math.max(textWidth + padding * 2, 70); // Larghezza minima aumentata
        const containerHeight = textHeight + padding + buttonHeight + buttonMargin;
        
        // Sfondo beige adattivo alle dimensioni del contenuto
        const bg = this.scene.add.graphics();
        bg.fillStyle(0xF5F5DC, 0.95); // Beige
        bg.fillRoundedRect(-containerWidth/2, -containerHeight/2, containerWidth, containerHeight, 6);
        bg.lineStyle(1, 0xD2B48C, 1); // Bordo beige più scuro (tan)
        bg.strokeRoundedRect(-containerWidth/2, -containerHeight/2, containerWidth, containerHeight, 6);
        bg.setScrollFactor(0, 0); // Assicurati che il background sia fisso
        
        // Riposiziona il testo al centro dell'area testo
        const textY = -containerHeight/2 + padding + textHeight/2;
        text.setPosition(0, textY);
        text.setScrollFactor(0, 0); // Assicurati che il testo sia fisso

        
        // Pulsante Chiudi adattivo - colori rosso e beige
        const buttonWidth = Math.max(35, containerWidth * 0.3); // Larghezza proporzionale aumentata
        const buttonY = containerHeight/2 - buttonHeight/2 - 4; // Posizione in fondo al container
        
        const closeButton = this.scene.add.graphics();
        closeButton.fillStyle(0xCD5C5C, 1); // Rosso (Indian Red)
        closeButton.fillRoundedRect(-buttonWidth/2, buttonY - buttonHeight/2, buttonWidth, buttonHeight, 3);
        closeButton.lineStyle(1, 0xB22222, 1); // Rosso più scuro per il bordo
        closeButton.strokeRoundedRect(-buttonWidth/2, buttonY - buttonHeight/2, buttonWidth, buttonHeight, 3);
        closeButton.setInteractive(new Phaser.Geom.Rectangle(-buttonWidth/2, buttonY - buttonHeight/2, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);
        closeButton.setScrollFactor(0, 0); // Assicurati che il pulsante sia fisso
        
        const closeText = this.scene.add.text(0, buttonY, 'Chiudi', {
            fontSize: '5px',
            color: '#F5F5DC', // Beige
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            resolution: 2
        });
        closeText.setOrigin(0.5);
        closeText.setScrollFactor(0, 0); // Assicurati che il testo del pulsante sia fisso
        
        // Aggiungi tutto al container
        popup.add([bg, text, closeButton, closeText]);
        popup.setDepth(1000); // Sopra tutto
        popup.setScale(0.7); // Inizia più grande per migliore leggibilità
        popup.setAlpha(0); // Inizia invisibile
        
        // Posiziona la lettera al centro dello schermo (semplificato)
        popup.setPosition(this.scene.scale.width / 2, this.scene.scale.height / 2);
        
        // Animazione senza scaling per evitare blur
        this.scene.tweens.add({
            targets: popup,
            alpha: 1, // Da 0 a 1
            scale: 1.0, // Da 0.7 a 1.0 (dimensione normale per leggibilità)
            duration: 200,
            ease: 'Power2.easeOut'
        });
        
        // Gestione click con animazione più pulita
        closeButton.on('pointerdown', () => {
            this.scene.tweens.add({
                targets: popup,
                alpha: 0,
                y: popup.y - 5,
                duration: 150,
                ease: 'Power2.easeIn',
                onComplete: () => {
                    popup.destroy();
                    this.onLetterClosed(); // Chiama il callback per mostrare la prossima lettera
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

    // Getter per sapere se c'è una lettera attiva
    public get isActive(): boolean {
        return this.isPopupActive;
    }

    // Getter per la lunghezza della coda di lettere
    public get queueLength(): number {
        return this.popupQueue.length;
    }
}