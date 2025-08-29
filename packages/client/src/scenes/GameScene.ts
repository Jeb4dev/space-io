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
  touchFireBtn!: HTMLDivElement;

  constructor() { super("Game"); }

  async create() {
    (window as any).net = this.net; // for recon ack access
    this.cameras.main.setBackgroundColor("#05070b");
    this.parallax = new Parallax(this);
    this.bullets = new Projectiles(this);
    this.pickups = new Pickups(this);
    this.hud = new HUD();
    this.levelModal = new LevelUpModal();

    // touch fire
    this.touchFireBtn = document.createElement("div");
    this.touchFireBtn.className = "touch-fire";
    this.touchFireBtn.innerText = "FIRE";
    document.body.appendChild(this.touchFireBtn);
    this.touchFireBtn.onpointerdown = () => (this.fireHeld = true);
    this.touchFireBtn.onpointerup = () => (this.fireHeld = false);
    this.touchFireBtn.onpointercancel = () => (this.fireHeld = false);

    // inputs
    this.input.on("pointerdown", () => (this.fireHeld = true));
    this.input.on("pointerup", () => (this.fireHeld = false));
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      const cx = this.scale.width / 2;
      const cy = this.scale.height / 2;
      this.aim = Math.atan2(p.worldY - cy, p.worldX - cx);
      this.thrust = { x: Math.cos(this.aim), y: Math.sin(this.aim) };
    });

    const prompt = new NamePrompt();
    const name = await prompt.getName();

    await this.net.connect(import.meta.env.VITE_SERVER_URL || "http://localhost:8080");
    this.net.join(name);

    this.net.onEvent(async (e) => {
      if (e.type === "LevelUpOffer") {
        const choice = await this.levelModal.choose(e.choices);
        this.net.choosePowerup(choice);
      }
    });

    this.net.onSnapshot((s) => this.onSnapshot(s));
  }

  onSnapshot(s: ServerSnapshot) {
    // snapshot cadence for interpolation
    this.snapshotInterval = 1000 / s.scoreboard.length; // not correct; will set below if needed
    // actually, derive from env (12 Hz). We'll leave snapshotInterval default for interp timing.
    this.interp.push(s.entities);
    const you = s.entities.find((e) => e.id === s.youId)!;
    if (!this.ships.has(s.youId)) this.ships.set(s.youId, new Ship(this, 0x8ac6ff));
    this.recon.setYouState(you);

    // scoreboard & bars
    this.hud.setScoreboard(s.scoreboard);
    if (you.maxHp) this.hud.setHP(you.hp ?? 0, you.maxHp);
    // XP: we don't have xp directly in snapshot; update on LevelUpApplied/Pickup-XP events. Keep bar static.

    // wells (optional to render as circles)
    // draw once per scene start – skipped for brevity

    // bullets & pickups
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

    // spawn other ships
    for (const e of s.entities) {
      if (e.kind !== "player") continue;
      if (!this.ships.has(e.id)) this.ships.set(e.id, new Ship(this, 0x4aa3ff));
    }
    // remove despawned
    const ids = new Set(s.entities.filter((e) => e.kind === "player").map((e) => e.id));
    for (const [id, ship] of this.ships) {
      if (!ids.has(id)) { ship.destroy(); this.ships.delete(id); }
    }

    // center camera; we draw ships at screen space centered
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
      if (e.kind === "player" && ship) {
        if (id === this.net.youId) continue; // we'll render predicted self below
        ship.setPosition(this.scale.width / 2 + (e.x - this.recon.you.x), this.scale.height / 2 + (e.y - this.recon.you.y));
      }
    }

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

