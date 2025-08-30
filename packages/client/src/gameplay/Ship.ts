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
  weapon: Phaser.GameObjects.Image;
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
    this.weapon = scene.add.image(0, 0, "raketti/weapon0.png").setOrigin(0.5, 0.5).setDepth(6).setScale(scale);

    // Distance from center to nose tip (scaled)
    this._noseR = this.body.width * scale * Math.min(0.5, Math.max(0, noseOffsetFactor));

    this.ring = scene.add
      .circle(0, 0, ringRadius, 0x000000, 0)
      .setStrokeStyle(1.5, 0xffffff, 0.35)
      .setDepth(6);

    if (showNose) {
      const nose = scene.add.circle(0, 0, 2, 0xffffff, 0.9).setDepth(7);
      nose.setName("nose");
      (this.body as any).__nose = nose;
    }
  }

  setPosition(x: number, y: number) {
    this.body.setPosition(x, y);
    this.wings.setPosition(x, y);
    this.window.setPosition(x, y);
    this.point.setPosition(x, y);
    this.weapon.setPosition(x, y);
    this.ring.setPosition(x, y);
  // Removed nose sync
  }

  setRotation(rad: number) {
    this._lastRot = rad;
    const finalRot = rad + this._angleOffsetRad;
    this.body.setRotation(finalRot);
    this.wings.setRotation(finalRot);
    this.window.setRotation(finalRot);
    this.point.setRotation(finalRot);
    this.weapon.setRotation(finalRot);
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
    this.weapon.setTint(color);
  }

  destroy() {
    this.body.destroy();
    this.wings.destroy();
    this.window.destroy();
    this.weapon.destroy();
    this.point.destroy();
    this.ring.destroy();
  }

  // Update ship textures based on player stats
  updateTextures(stats: {
    maxHp: number;
    damage: number;
    maxSpeed: number;
    accel: number;
    magnetRadius: number;
  }) {
    const { maxHp, damage, maxSpeed, accel, magnetRadius } = stats;
    
    // Body texture based on HP (0: 100HP, 1: 120HP+, 2: 140HP+)
    const bodyLevel = maxHp <= 100 ? 0 : maxHp <= 120 ? 1 : 2;
    this.body.setTexture(`raketti/body${bodyLevel}.png`);
    
    // Weapon texture based on damage (0: 12 damage, 1: 16+, 2: 20+)
    const weaponLevel = damage <= 12 ? 0 : damage <= 16 ? 1 : 2;
    this.weapon.setTexture(`raketti/weapon${weaponLevel}.png`);
    
    // Point texture based on max speed (0: 300 speed, 1: 340+, 2: 380+)
    const pointLevel = maxSpeed <= 300 ? 0 : maxSpeed <= 340 ? 1 : 2;
    this.point.setTexture(`raketti/point${pointLevel}.png`);
    
    // Wings texture based on acceleration (0: 700 accel, 1: 780+, 2: 860+)
    const wingsLevel = accel <= 700 ? 0 : accel <= 780 ? 1 : 2;
    this.wings.setTexture(`raketti/wings${wingsLevel}.png`);
    
    // Window texture based on magnet radius (0: 100 radius, 1: 130+, 2: 160+)
    const windowLevel = magnetRadius <= 100 ? 0 : magnetRadius <= 130 ? 1 : 2;
    this.window.setTexture(`raketti/window${windowLevel}.png`);
  }

  // Removed nose sync method
}
