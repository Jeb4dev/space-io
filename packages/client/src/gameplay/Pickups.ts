import Phaser from "phaser";

type PickupType = "xp" | "hp";
type PickupSprite = Phaser.GameObjects.Arc;

export default class Pickups {
  private byId = new Map<string, PickupSprite>();

  constructor(private scene: Phaser.Scene) {}

  // Create sprite if missing (color by type)
  ensure(id: string, type: PickupType) {
    const col = type === "xp" ? 0x6be46b : 0xff5b7b;
    let s = this.byId.get(id);
    if (!s) {
      s = this.scene.add.circle(0, 0, 8, col).setDepth(2);
      this.byId.set(id, s);
    } else {
      (s.fillColor as any) = col;
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
