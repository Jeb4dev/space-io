import Phaser from "phaser";

type BulletSprite = Phaser.GameObjects.Arc;

export default class Projectiles {
  private byId = new Map<string, BulletSprite>();

  constructor(private scene: Phaser.Scene) {}

  // Create sprite if missing (radius can change)
  ensure(id: string, r: number) {
    let s = this.byId.get(id);
    if (!s) {
      s = this.scene.add.circle(0, 0, r, 0xffe066).setDepth(5);
      this.byId.set(id, s);
    } else {
      s.setRadius(r);
    }
  }

  // Set screen-space position (computed in Scene from interpolated world coords)
  place(id: string, sx: number, sy: number) {
    const s = this.byId.get(id);
    if (s) s.setPosition(sx, sy);
  }

  removeMissing(currentIds: Set<string>) {
    for (const [id, s] of this.byId) {
      if (!currentIds.has(id)) {
        s.destroy();
        this.byId.delete(id);
      }
    }
  }
}
