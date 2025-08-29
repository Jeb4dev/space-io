import Phaser from "phaser";

export default class Pickups {
  byId = new Map<string, Phaser.GameObjects.Arc>();
  scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) { this.scene = scene; }

  upsert(id: string, x: number, y: number, type: "xp" | "hp") {
    let s = this.byId.get(id);
    const col = type === "xp" ? 0x6be46b : 0xff5b7b;
    if (!s) {
      s = this.scene.add.circle(x, y, 8, col).setDepth(2);
      this.byId.set(id, s);
    } else {
      s.setPosition(x, y);
      (s.fillColor as any) = col;
    }
  }

  removeMissing(ids: Set<string>) {
    for (const [id, s] of this.byId) {
      if (!ids.has(id)) { s.destroy(); this.byId.delete(id); }
    }
  }
}

