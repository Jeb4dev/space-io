import Phaser from "phaser";

type BulletRender = {
  sprite: Phaser.GameObjects.Arc;
  wx: number; // world x
  wy: number; // world y
  r: number;
};

export default class Projectiles {
  private byId = new Map<string, BulletRender>();
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // Upsert using WORLD coordinates from the server
  upsert(id: string, wx: number, wy: number, r: number) {
    const existing = this.byId.get(id);
    if (existing) {
      existing.wx = wx;
      existing.wy = wy;
      existing.r = r;
      existing.sprite.setRadius(r);
      return;
    }
    const sprite = this.scene.add.circle(0, 0, r, 0xffe066).setDepth(5);
    this.byId.set(id, { sprite, wx, wy, r });
  }

  render(cx: number, cy: number, youX: number, youY: number) {
    for (const b of this.byId.values()) {
      b.sprite.setPosition(
        cx + (b.wx - youX),
        cy + (b.wy - youY)
      );
    }
  }

  removeMissing(currentIds: Set<string>) {
    for (const [id, b] of this.byId) {
      if (!currentIds.has(id)) {
        b.sprite.destroy();
        this.byId.delete(id);
      }
    }
  }
}
