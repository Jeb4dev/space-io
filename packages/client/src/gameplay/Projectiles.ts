import Phaser from "phaser";

export default class Projectiles {
  byId = new Map<string, Phaser.GameObjects.Arc>();
  scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  upsert(id: string, x: number, y: number, r: number) {
    let s = this.byId.get(id);
    if (!s) {
      s = this.scene.add.circle(x, y, r, 0xffe066).setDepth(5);
      this.byId.set(id, s);
    } else {
      s.setPosition(x, y);
      s.setRadius(r);
    }
  }

  removeMissing(ids: Set<string>) {
    for (const [id, s] of this.byId) {
      if (!ids.has(id)) { s.destroy(); this.byId.delete(id); }
    }
  }
}

