// Disegna un pannello/pulsante "8-bit" (bordo spesso + ombra netta + highlight),
// nello stesso stile del box-shadow stack usato in style.css per i bottoni DOM.
export type PixelPanelState = 'idle' | 'hover' | 'press';

export interface PixelPanelOptions {
    fillColor: number;
    hoverColor?: number;
    fillAlpha?: number;
    borderColor?: number;
    borderAlpha?: number;
    shadowColor?: number;
    shadowAlpha?: number;
    borderThickness?: number;
    shadowOffset?: number;
    highlightAlpha?: number;
}

const DEFAULTS: Required<Omit<PixelPanelOptions, 'fillColor' | 'hoverColor'>> = {
    fillAlpha: 1,
    borderColor: 0x000000,
    borderAlpha: 1,
    shadowColor: 0x000000,
    shadowAlpha: 0.25,
    borderThickness: 3,
    shadowOffset: 5,
    highlightAlpha: 0.2,
};

export default class PixelPanel {
    private graphics: Phaser.GameObjects.Graphics;
    private opts: Required<PixelPanelOptions>;
    private x: number;
    private y: number;
    private width: number;
    private height: number;
    private state: PixelPanelState = 'idle';

    constructor(graphics: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, options: PixelPanelOptions) {
        this.graphics = graphics;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.opts = { ...DEFAULTS, hoverColor: options.fillColor, ...options };
        this.redraw('idle');
    }

    // Riposiziona/ridimensiona il pannello senza ricrearlo (es. testo che cambia dimensione)
    public resize(x: number, y: number, width: number, height: number): void {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.redraw(this.state);
    }

    public redraw(state: PixelPanelState): void {
        this.state = state;
        const { fillColor, hoverColor, fillAlpha, borderColor, borderAlpha, shadowColor, shadowAlpha, borderThickness, shadowOffset, highlightAlpha } = this.opts;
        const g = this.graphics;
        const pressed = state === 'press';
        // In pressione il pannello "affonda" nello spazio occupato dall'ombra (come translateY in CSS)
        const sink = pressed ? shadowOffset : 0;

        g.clear();

        if (!pressed) {
            g.fillStyle(shadowColor, shadowAlpha);
            g.fillRect(this.x + shadowOffset, this.y + shadowOffset, this.width, this.height);
        }

        g.fillStyle(borderColor, borderAlpha);
        g.fillRect(
            this.x - borderThickness + sink,
            this.y - borderThickness + sink,
            this.width + borderThickness * 2,
            this.height + borderThickness * 2
        );

        g.fillStyle(state === 'hover' ? hoverColor : fillColor, fillAlpha);
        g.fillRect(this.x + sink, this.y + sink, this.width, this.height);

        g.fillStyle(0xffffff, highlightAlpha * fillAlpha);
        const highlightHeight = Math.max(2, Math.round(this.height * 0.12));
        g.fillRect(this.x + sink, this.y + sink, this.width, highlightHeight);
    }

    // Offset (orizzontale = verticale, il pannello affonda in diagonale nello spazio
    // dell'ombra) corrente in stato "press", utile per riposizionare testo/icone sopra
    // al pannello.
    public get pressSink(): number {
        return this.state === 'press' ? this.opts.shadowOffset : 0;
    }
}
