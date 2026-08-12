import OggettoInterattivo from "@/items/Main/OggettoInterattivo";

type MirrorMode = "rotate" | "move";
type MirrorOrientation = "slash" | "backslash";

interface MirrorOptions {
  mode?: MirrorMode;
  orientation?: MirrorOrientation;
  movePath?: Array<{ x: number; y: number }>;
}

class Mirror extends OggettoInterattivo {
  public kind: "mirror" = "mirror";
  public mode: MirrorMode = "rotate";
  public orientation: MirrorOrientation = "slash";
  public gridX: number = 0;
  public gridY: number = 0;
  public originGridX: number = 0;
  public originGridY: number = 0;
  public movePath?: Array<{ x: number; y: number }>;
  public moveIndex: number = 0;

  private onChanged?: () => void;

  constructor(scene: Phaser.Scene, gridX: number, gridY: number, options?: MirrorOptions) {
    super(scene, 0, 0, "default");
    this.gridX = gridX;
    this.gridY = gridY;
    this.originGridX = gridX;
    this.originGridY = gridY;
    if (options?.mode) this.mode = options.mode;
    if (options?.orientation) this.orientation = options.orientation;
    if (options?.movePath) this.movePath = options.movePath;
    this.moveIndex = 0;
    this.setDisplaySize(42, 42);
    this.applyStyle();
  }

  public setOnChanged(cb: () => void) {
    this.onChanged = cb;
  }

  public applyStyle() {
    this.setAngle(this.orientation === "slash" ? 45 : -45);
    this.setTint(this.mode === "move" ? 0x88d088 : 0x9bb4e6);
  }

  public setGrid(gridX: number, gridY: number) {
    this.gridX = gridX;
    this.gridY = gridY;
    if (this.onChanged) this.onChanged();
  }

  public interagisci() {
    if (this.mode === "rotate") {
      this.orientation = this.orientation === "slash" ? "backslash" : "slash";
      this.applyStyle();
      if (this.onChanged) this.onChanged();
      return;
    }

    if (this.movePath && this.movePath.length > 0) {
      this.moveIndex = (this.moveIndex + 1) % this.movePath.length;
      const next = this.movePath[this.moveIndex];
      if (next) {
        this.gridX = next.x;
        this.gridY = next.y;
      }
      if (this.onChanged) this.onChanged();
    }
  }
}

export default Mirror;
