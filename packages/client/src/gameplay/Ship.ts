import Phaser from "phaser";

type ShipOpts = {
  scale?: number;
  angleOffsetRad?: number; // rotate texture so 0 rad means “forward”
  showNose?: boolean;
  ringRadius?: number;
  noseOffsetFactor?: number; // from center to tip as fraction of width (default ~0.48)
};

export default class Ship {
  private scene: Phaser.Scene;
  sprite: Phaser.GameObjects.Image; // PNG sprite
  ring: Phaser.GameObjects.Arc; // invuln/highlight ring
  private _angleOffsetRad: number;
  private _noseR: number; // tip distance from center in world px
  private _lastRot = 0;

  constructor(scene: Phaser.Scene, textureKey: string, opts: ShipOpts = {}) {
    this.scene = scene;

    const {
      scale = 1,
      angleOffsetRad = 0,
      showNose = true,
      ringRadius = 18,
      noseOffsetFactor = 0.48, // ~ (width/2 minus a small margin)
    } = opts;

    this._angleOffsetRad = angleOffsetRad;

    this.sprite = scene.add.image(0, 0, textureKey).setOrigin(0.5, 0.5).setDepth(6).setScale(scale);

    // Distance from center to nose tip (scaled)
    this._noseR = this.sprite.width * scale * Math.min(0.5, Math.max(0, noseOffsetFactor));

    this.ring = scene.add
      .circle(0, 0, ringRadius, 0x000000, 0)
      .setStrokeStyle(1.5, 0xffffff, 0.35)
      .setDepth(5);

    if (showNose) {
      const nose = scene.add.circle(0, 0, 2, 0xffffff, 0.9).setDepth(7);
      nose.setName("nose");
      (this.sprite as any).__nose = nose;
    }
  }

  setPosition(x: number, y: number) {
    this.sprite.setPosition(x, y);
    this.ring.setPosition(x, y);
    this.#syncNose();
  }

  setRotation(rad: number) {
    this._lastRot = rad;
    this.sprite.setRotation(rad + this._angleOffsetRad);
    this.#syncNose();
  }

  setInvuln(on: boolean) {
    this.ring.setAlpha(on ? 1 : 0.35);
    this.ring.setStrokeStyle(on ? 2 : 1.5, 0xffffff, on ? 0.9 : 0.35);
  }

  /** For PNGs, tint is the right API (fills are for vector shapes). */
  setTint(color: number) {
    this.sprite.setTint(color);
  }

  destroy() {
    const nose: Phaser.GameObjects.Arc | undefined = (this.sprite as any).__nose;
    if (nose) nose.destroy();
    this.sprite.destroy();
    this.ring.destroy();
  }

  #syncNose() {
    const nose: Phaser.GameObjects.Arc | undefined = (this.sprite as any).__nose;
    if (!nose) return;
    const ang = this._lastRot + this._angleOffsetRad;
    nose.setPosition(
      this.sprite.x + Math.cos(ang) * this._noseR,
      this.sprite.y + Math.sin(ang) * this._noseR,
    );
  }
}
