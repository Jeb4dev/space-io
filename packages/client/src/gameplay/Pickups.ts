import Phaser from "phaser";

type PickupType = "xp" | "hp";
type PickupSprite = Phaser.GameObjects.Arc | Phaser.GameObjects.Container;

interface StardustParticle {
  gfx: Phaser.GameObjects.Graphics;
  baseAlpha: number;
  twinkleFreq: number;
  twinklePhase: number;
  baseX: number;
  baseY: number;
  oscA: number;
  oscR: number;
}

export default class Pickups {
  private byId = new Map<string, PickupSprite>();
  private stardustParticles = new Map<string, StardustParticle[]>();

  constructor(private scene: Phaser.Scene) {
    scene.events.on("update", this.updateStardust, this);
  }

  // Create sprite if missing (color by type)
  ensure(id: string, type: PickupType) {
    if (type === "xp") {
      if (!this.byId.has(id)) {
        const container = this.scene.add.container(0, 0).setDepth(2);
        const particles: StardustParticle[] = [];
        const count = 14;
        const maxRadius = 10;
        for (let i = 0; i < count; i++) {
          const t = Math.pow(Math.random(), 1.5);
          const r = maxRadius * t;
          const a = Math.random() * Math.PI * 2;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          const gfx = this.scene.add.graphics({ x, y });
          gfx.fillStyle(0x8ac6ff, 1);
          gfx.fillCircle(0, 0, 1.5 + Math.random() * 1.5);
          container.add(gfx);
          particles.push({
            gfx,
            baseAlpha: 0.5 + Math.random() * 0.5,
            twinkleFreq: 0.5 + Math.random() * 2,
            twinklePhase: Math.random() * Math.PI * 2,
            baseX: x,
            baseY: y,
            oscA: Math.random() * Math.PI * 2,
            oscR: 0.5 + Math.random() * 1.5,
          });
        }
        this.byId.set(id, container);
        this.stardustParticles.set(id, particles);
      }
      return;
    }
    // Only hp is a circle now
    const col = 0xff5b7b;
    let s = this.byId.get(id);
    if (!s) {
      s = this.scene.add.circle(0, 0, 8, col).setDepth(2);
      this.byId.set(id, s);
    } else if (s instanceof Phaser.GameObjects.Arc) {
      (s.fillColor as any) = col;
    }
  }

  // Set screen-space position (computed in Scene from interpolated world coords)
  place(id: string, sx: number, sy: number) {
    const s = this.byId.get(id);
    if (s) {
      // Only render if on screen
      const w = this.scene.scale.width;
      const h = this.scene.scale.height;
      const margin = 32; // allow a small margin for partial visibility
      const visible = sx >= -margin && sx <= w + margin && sy >= -margin && sy <= h + margin;
      s.setVisible(visible);
      if (visible) s.setPosition(sx, sy);
    }
  }

  removeMissing(currentIds: Set<string>) {
    for (const [id, s] of this.byId) {
      if (!currentIds.has(id)) {
        s.destroy();
        this.byId.delete(id);
      }
    }
  }

  private updateStardust(time: number) {
    for (const [id, particles] of this.stardustParticles) {
      for (const p of particles) {
        // Twinkle effect
        const twinkle = (Math.sin(time * 0.002 * p.twinkleFreq + p.twinklePhase) * 0.5 + 0.5) * 0.7;
        const alpha = Phaser.Math.Clamp(p.baseAlpha + twinkle, 0, 1);
        p.gfx.clear();
        p.gfx.fillStyle(0x8ac6ff, alpha);
        p.gfx.fillCircle(0, 0, 2);
        // Oscillate around base position, but do not drift
        const osc = Math.sin(time * 0.001 + p.oscA) * p.oscR;
        p.gfx.x = p.baseX + Math.cos(p.oscA) * osc;
        p.gfx.y = p.baseY + Math.sin(p.oscA) * osc;
      }
    }
  }
}
