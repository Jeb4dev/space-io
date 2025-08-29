import Phaser from "phaser";
import { Net } from "@client/net/socket";
import { NamePrompt } from "@client/ui/NamePrompt";
import { LevelUpModal } from "@client/ui/LevelUpModal";
import { HUD } from "@client/ui/HUD";
import type { EntityState, ServerSnapshot } from "@shared/messages";
import { Interp } from "@client/state/interp";
import { Recon } from "@client/state/recon";
import Ship from "@client/gameplay/Ship";
import Projectiles from "@client/gameplay/Projectiles";
import Pickups from "@client/gameplay/Pickups";
import Parallax from "@client/gameplay/Parallax";
import type { WellState } from "@shared/types";
import { GRAVITY } from "@shared/constants";


export default class GameScene extends Phaser.Scene {
  net = new Net();
  hud!: HUD;
  levelModal!: LevelUpModal;
  interp = new Interp();
  recon = new Recon();
  ships = new Map<string, Ship>();
  bullets!: Projectiles;
  pickups!: Pickups;
  parallax!: Parallax;

  seq = 0;
  lastInputAt = 0;
  snapshotInterval = 1000 / 12;
  aim = 0;
  thrust = { x: 0, y: 0 };
  fireHeld = false;
  isThrusting = false;
  touchFireBtn!: HTMLDivElement;
  wells: WellState[] = [];
  debugWellsOn = true;
  wellGfx!: Phaser.GameObjects.Graphics;

  constructor() { super("Game"); }

  async create() {
    (window as any).net = this.net;
    this.cameras.main.setBackgroundColor("#05070b");
    this.parallax = new Parallax(this);
    this.bullets = new Projectiles(this);
    this.pickups = new Pickups(this);
    this.hud = new HUD();
    this.levelModal = new LevelUpModal();

    // touch FIRE button
    this.touchFireBtn = document.createElement("div");
    this.touchFireBtn.className = "touch-fire";
    this.touchFireBtn.innerText = "FIRE";
    document.body.appendChild(this.touchFireBtn);
    this.touchFireBtn.onpointerdown = () => (this.fireHeld = true);
    this.touchFireBtn.onpointerup = () => (this.fireHeld = false);
    this.touchFireBtn.onpointercancel = () => (this.fireHeld = false);

    this.wellGfx = this.add.graphics().setDepth(8); // above stars, below ships

// Toggle with F3 (or press 'G' if you prefer)
    this.input.keyboard?.on("keydown-G", () => {
      this.debugWellsOn = !this.debugWellsOn;
      this.wellGfx.clear();
    });


    // pointer -> aim/thrust
    // pointer -> aim/thrust (drag to thrust toward pointer)
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.fireHeld = true;          // click/touch also fires
      this.isThrusting = true;       // start thrusting while held
      const cx = this.scale.width / 2;
      const cy = this.scale.height / 2;
      this.aim = Math.atan2(p.worldY - cy, p.worldX - cx);
      this.thrust = { x: Math.cos(this.aim), y: Math.sin(this.aim) };
    });

    this.input.on("pointerup", () => {
      this.fireHeld = false;
      this.isThrusting = false;      // stop thrust when released
      this.thrust = { x: 0, y: 0 };
    });

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      const cx = this.scale.width / 2;
      const cy = this.scale.height / 2;
      this.aim = Math.atan2(p.worldY - cy, p.worldX - cx);
      // only apply thrust vector while dragging
      if (this.isThrusting) {
        this.thrust = { x: Math.cos(this.aim), y: Math.sin(this.aim) };
      }
    });

    // Ask name
    const prompt = new NamePrompt();
    const name = await prompt.getName();

    // 1) Connect and register handlers BEFORE join
    // Start the connection (resolves when 'welcome' arrives)
    const connectP = this.net.connect(import.meta.env.VITE_SERVER_URL || "http://localhost:8080");

// Register handlers now
    this.net.onEvent(async (e) => {
      if (e.type === "LevelUpOffer") {
        const choice = await this.levelModal.choose(e.choices);
        this.net.choosePowerup(choice);
      }
    });
    this.net.onSnapshot((s) => this.onSnapshot(s));

// Send join so the server can emit 'welcome'
    this.net.join(name);

// Wait for 'welcome' (sets net.youId)
    await connectP;

// Ensure your ship exists immediately
    const youId = this.net.youId!;
    if (!this.ships.has(youId)) {
      const ship = new Ship(this, 0x8ac6ff);
      ship.sprite.setDepth(1000);
      ship.ring.setDepth(1001);
      this.ships.set(youId, ship);
    }

  }

  onSnapshot(s: ServerSnapshot) {
    this.interp.push(s.entities);
    this.wells = s.wells;

    // Find "you" in this snapshot; if missing (rare first-frame race), bail gracefully
    const you = s.entities.find((e) => e.id === (this.net.youId || s.youId));
    if (!you) return;

    // Ensure your ship exists
    if (!this.ships.has(you.id)) this.ships.set(you.id, new Ship(this, 0x8ac6ff));

    this.recon.setYouState(you);

    // HUD: scoreboard + HP
    this.hud.setScoreboard(s.scoreboard);
    if (you.maxHp) this.hud.setHP(you.hp ?? 0, you.maxHp);

    // Bullets & pickups
    const bulletIds = new Set<string>();
    const pickupIds = new Set<string>();

    for (const e of s.entities) {
      if (e.kind === "bullet") {
        this.bullets.upsert(e.id, e.x, e.y, e.r);
        bulletIds.add(e.id);
      }
    }
    for (const p of s.pickups) {
      this.pickups.upsert(p.id, p.x, p.y, p.type);
      pickupIds.add(p.id);
    }
    this.bullets.removeMissing(bulletIds);
    this.pickups.removeMissing(pickupIds);

    // Ensure all player sprites exist
    for (const e of s.entities) {
      if (e.kind !== "player") continue;
      if (!this.ships.has(e.id)) this.ships.set(e.id, new Ship(this, e.id === you.id ? 0x8ac6ff : 0x4aa3ff));
    }
    // Remove despawned
    const ids = new Set(s.entities.filter((e) => e.kind === "player").map((e) => e.id));
    for (const [id, ship] of this.ships) {
      if (!ids.has(id)) { ship.destroy(); this.ships.delete(id); }
    }
  }

  private drawGravityDebug() {
    const g = this.wellGfx;
    g.clear();
    if (!this.debugWellsOn) return;
    if (!this.recon.you) return;

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    // Sum net acceleration toward wells (for the center arrow)
    let ax = 0, ay = 0;

    for (const w of this.wells) {
      // World->screen transform relative to your ship (camera fixed)
      const sx = cx + (w.x - this.recon.you.x);
      const sy = cy + (w.y - this.recon.you.y);

      // Colors per well type
      const colCore =
        w.type === "planet" ? 0x4caf50 :
          w.type === "sun" ? 0xffc107 :
            0x9c27b0; // black hole

      const colInfl =
        w.type === "planet" ? 0x81c784 :
          w.type === "sun" ? 0xffecb3 :
            0xce93d8;

      // Influence radius (stroke)
      g.lineStyle(1, colInfl, 0.7);
      g.strokeCircle(sx, sy, w.influenceRadius);

      // Core radius (filled)
      g.fillStyle(colCore, 0.25);
      g.fillCircle(sx, sy, w.radius);

      // Hazard rings
      if (w.type === "sun") {
        g.lineStyle(2, 0xff7043, 0.9); // orange
        g.strokeCircle(sx, sy, w.radius + 60);
      } else if (w.type === "blackhole") {
        g.lineStyle(2, 0xe91e63, 0.9); // magenta/red
        g.strokeCircle(sx, sy, w.radius + 40);
      }

      // Net accel contribution (only if within influence)
      const dx = w.x - this.recon.you.x;
      const dy = w.y - this.recon.you.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= w.influenceRadius * w.influenceRadius) {
        const d = Math.sqrt(d2) || 1;
        const force = Math.min((GRAVITY.G * w.mass) / (d2 + GRAVITY.epsilon), w.maxPull);
        ax += (dx / d) * force;
        ay += (dy / d) * force;
      }
    }

    // Draw net gravity arrow at your ship (screen center)
    const mag = Math.hypot(ax, ay);
    if (mag > 0.0001) {
      const scale = 0.03; // tweak length scaling for readability
      const len = Math.min(140, mag * scale);
      const nx = ax / mag;
      const ny = ay / mag;
      const ex = cx + nx * len;
      const ey = cy + ny * len;

      g.lineStyle(3, 0xffffff, 0.9);
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(ex, ey);
      g.strokePath();

      // Arrowhead
      const ah = 10;
      const ang = Math.atan2(ny, nx);
      const left = { x: ex - Math.cos(ang - Math.PI / 6) * ah, y: ey - Math.sin(ang - Math.PI / 6) * ah };
      const right = { x: ex - Math.cos(ang + Math.PI / 6) * ah, y: ey - Math.sin(ang + Math.PI / 6) * ah };
      g.lineBetween(ex, ey, left.x, left.y);
      g.lineBetween(ex, ey, right.x, right.y);
    }

    // Small legend
    g.fillStyle(0xffffff, 0.9);
    g.fillRect(10, 10, 190, 54);
    g.fillStyle(0x000000, 1);
    g.fillRect(12, 12, 186, 50);
    g.lineStyle(1, 0xffffff, 1);
    g.strokeRect(12, 12, 186, 50);

    const txt = [
      "GRAVITY DEBUG (F3)",
      "Circle = core, Ring = hazard, Large ring = influence",
      "White arrow = net pull on you"
    ];
    // Draw text quickly using simple strokes as lines (no Text objects to avoid churn)
    // (Cheap labels using lines; skip real text for zero-GC HUD.)
    // If you prefer real text, replace with this.add.text(...) once at create() and update its content.
    g.lineStyle(1, 0xffffff, 1);
    // just draw three short lines as placeholders (keeps it super light)
    // (Alternatively comment this block out.)
  }


  update(time: number, delta: number) {
    // send input at ~30-60 Hz
    const dtMs = delta;
    const now = performance.now();
    if (now - this.lastInputAt > 1000 / 40 && this.net.youId) {
      const payload = {
        id: this.net.youId!,
        seq: ++this.seq,
        aim: this.aim,
        thrust: this.thrust,
        fire: this.fireHeld,
        dtMs
      } as const;
      this.net.sendInput(payload as any);
      this.recon.record(payload as any);
      this.lastInputAt = now;
    }

    // interpolate others and render
    const ents = this.interp.current;
    for (const id of this.interp.ids()) {
      const e = this.interp.get(id)!;
      const ship = this.ships.get(id);
      if (e.kind === "player" && ship && id !== this.net.youId) {
        ship.setPosition(
          this.scale.width / 2 + (e.x - this.recon.you.x),
          this.scale.height / 2 + (e.y - this.recon.you.y)
        );
      }
    }

    // after we know recon.you and before drawGravityDebug():
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    if (this.recon.you) {
      this.bullets.render(cx, cy, this.recon.you.x, this.recon.you.y);
      this.pickups.render(cx, cy, this.recon.you.x, this.recon.you.y);
    }


    this.drawGravityDebug();

    // reconcile self
    const meServer = this.interp.current.get(this.net.youId || "");
    if (meServer) {
      this.recon.reconcile(meServer);
      const myShip = this.ships.get(this.net.youId!);
      if (myShip) {
        myShip.setPosition(this.scale.width / 2, this.scale.height / 2);
      }
      // parallax by velocity
      this.parallax.update(meServer.vx, meServer.vy);
      // hp bar
      if (meServer.maxHp) this.hud.setHP(meServer.hp ?? 0, meServer.maxHp);
    }

    // simple interp timer
    this.interp.step(delta / 1000, 1000 / 12);
  }
}

