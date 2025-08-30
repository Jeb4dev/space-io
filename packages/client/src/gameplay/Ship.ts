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
  body: Phaser.GameObjects.Image;
  wings: Phaser.GameObjects.Image;
  window: Phaser.GameObjects.Image;
  point: Phaser.GameObjects.Image;
  ring: Phaser.GameObjects.Arc;
  private _angleOffsetRad: number;
  private _noseR: number;
  private _lastRot = 0;

  constructor(scene: Phaser.Scene, opts: ShipOpts = {}) {
    this.scene = scene;
    const {
      scale = 0.03,
      angleOffsetRad = 1.57,
      showNose = true,
      ringRadius = 18,
      noseOffsetFactor = 0.48,
    } = opts;
    this._angleOffsetRad = angleOffsetRad;

    // Create each part, body at the bottom
    this.body = scene.add.image(0, 0, "raketti/body0.png").setOrigin(0.5, 0.5).setDepth(2).setScale(scale);
    this.wings = scene.add.image(0, 0, "raketti/wings0.png").setOrigin(0.5, 0.5).setDepth(3).setScale(scale);
    this.window = scene.add.image(0, 0, "raketti/window0.png").setOrigin(0.5, 0.5).setDepth(4).setScale(scale);
    this.point = scene.add.image(0, 0, "raketti/point0.png").setOrigin(0.5, 0.5).setDepth(5).setScale(scale);

    // Distance from center to nose tip (scaled)
    this._noseR = this.body.width * scale * Math.min(0.5, Math.max(0, noseOffsetFactor));

    this.ring = scene.add
      .circle(0, 0, ringRadius, 0x000000, 0)
      .setStrokeStyle(1.5, 0xffffff, 0.35)
      .setDepth(6);
  }

  setPosition(x: number, y: number) {
    this.body.setPosition(x, y);
    this.wings.setPosition(x, y);
    this.window.setPosition(x, y);
    this.point.setPosition(x, y);
    this.ring.setPosition(x, y);
  // Removed nose sync
  }

  setRotation(rad: number) {
    this._lastRot = rad;
    this.body.setRotation(rad + this._angleOffsetRad);
    this.wings.setRotation(rad + this._angleOffsetRad);
    this.window.setRotation(rad + this._angleOffsetRad);
    this.point.setRotation(rad + this._angleOffsetRad);
  // Removed nose sync
  }

  setInvuln(on: boolean) {
    this.ring.setAlpha(on ? 1 : 0.35);
    this.ring.setStrokeStyle(on ? 2 : 1.5, 0xffffff, on ? 0.9 : 0.35);
  }

  setTint(color: number) {
    this.body.setTint(color);
    this.wings.setTint(color);
    this.window.setTint(color);
    this.point.setTint(color);
  }

  destroy() {
    this.body.destroy();
    this.wings.destroy();
    this.window.destroy();
    this.point.destroy();
    this.ring.destroy();
  }

  // Removed nose sync method
}
