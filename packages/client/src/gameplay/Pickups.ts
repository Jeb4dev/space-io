import Phaser from "phaser";

type PickupRender = {
  sprite: Phaser.GameObjects.Arc;
  wx: number;
  wy: number;
  type: "xp" | "hp";
};

export default class Pickups {
  private byId = new Map<string, PickupRender>();
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // Upsert using WORLD coordinates from the server
  upsert(id: string, wx: number, wy: number, type: "xp" | "hp") {
    const col = type === "xp" ? 0x6be46b : 0xff5b7b;
    const existing = this.byId.get(id);
    if (existing) {
      existing.wx = wx;
      existing.wy = wy;
      existing.type = type;
      (existing.sprite.fillColor as any) = col;
      return;
    }
    const sprite = this.scene.add.circle(0, 0, 8, col).setDepth(2);
    this.byId.set(id, { sprite, wx, wy, type });
  }

  render(cx: number, cy: number, youX: number, youY: number) {
    for (const p of this.byId.values()) {
      p.sprite.setPosition(
        cx + (p.wx - youX),
        cy + (p.wy - youY)
      );
    }
  }

  removeMissing(currentIds: Set<string>) {
    for (const [id, p] of this.byId) {
      if (!currentIds.has(id)) {
        p.sprite.destroy();
        this.byId.delete(id);
      }
    }
  }
}
