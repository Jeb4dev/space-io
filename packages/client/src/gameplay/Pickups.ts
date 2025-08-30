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
        const count = 9; // more particles for a fuller look
        const maxRadius = 16; // larger radius for a bigger pickup
        for (let i = 0; i < count; i++) {
          const t = Math.pow(Math.random(), 1.2); // slightly less bias for more spread
          const r = maxRadius * t;
          const a = Math.random() * Math.PI * 2;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          const gfx = this.scene.add.graphics({ x, y });
          // Glowing yellow: use a radial gradient effect
          const color = 0xffe066; // warm yellow
          const glow = 0xfff7b2; // soft outer glow
          // Draw glow
          gfx.fillStyle(glow, 0.25);
          gfx.fillCircle(0, 0, 8);
          // Draw main star
          gfx.fillStyle(color, 1);
          gfx.fillCircle(0, 0, 2.5 + Math.random() * 2);
          container.add(gfx);
          particles.push({
            gfx,
            baseAlpha: 0.7 + Math.random() * 0.3, // brighter base
            twinkleFreq: 0.8 + Math.random() * 2.2, // more twinkle variation
            twinklePhase: Math.random() * Math.PI * 2,
            baseX: x,
            baseY: y,
            oscA: Math.random() * Math.PI * 2,
            oscR: 1.2 + Math.random() * 2.2, // more movement
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
        // Twinkle effect: more intense and glowing
        const twinkle = (Math.sin(time * 0.001 * p.twinkleFreq + p.twinklePhase) * 0.5 + 0.5) * 1.1;
        const alpha = Phaser.Math.Clamp(p.baseAlpha + twinkle, 0.5, 1.2);
        p.gfx.clear();
        // Glow
        p.gfx.fillStyle(0xfff7b2, .5 * alpha);
        p.gfx.fillCircle(0, 0, 6);
        // Main star
        p.gfx.fillStyle(0xFFFBEA, alpha);
        p.gfx.fillCircle(0, 0, 2.5);
        // Oscillate around base position, but do not drift
        const osc = Math.sin(time * 0.002 + p.oscA) * p.oscR;
        p.gfx.x = p.baseX + Math.cos(p.oscA) * osc;
        p.gfx.y = p.baseY + Math.sin(p.oscA) * osc;
      }
    }
  }
}
