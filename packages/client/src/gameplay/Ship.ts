import Phaser from "phaser";

export default class Ship {
  sprite: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, color = 0x4aa3ff) {
    this.sprite = scene.add.circle(0, 0, 18, color).setDepth(10);
    this.ring = scene.add.circle(0, 0, 24).setStrokeStyle(2, 0xffffff, 0.25).setDepth(9);
  }

  setPosition(x: number, y: number) {
    this.sprite.setPosition(x, y);
    this.ring.setPosition(x, y);
  }

  setInvuln(on: boolean) {
    this.sprite.setAlpha(on ? 0.5 : 1);
    this.ring.setAlpha(on ? 0.6 : 0.25);
  }

  destroy() {
    this.sprite.destroy();
    this.ring.destroy();
  }
}

