import Phaser from "phaser";
import { Net } from "@client/net/socket";
import { NamePrompt } from "@client/ui/NamePrompt";
import { LevelUpModal } from "@client/ui/LevelUpModal";
import { HUD } from "@client/ui/HUD";
import type { ServerSnapshot } from "@shared/messages";
import type { WellState } from "@shared/types";
import { Interp } from "@client/state/interp";
import { Recon } from "@client/state/recon";
import Ship from "@client/gameplay/Ship";
import Projectiles from "@client/gameplay/Projectiles";
import Pickups from "@client/gameplay/Pickups";
import Parallax from "@client/gameplay/Parallax";
import { drawArenaBounds, drawGravityDebug } from "@client/debug";

const SNAPSHOT_HZ = 12;
const SELF_TINT = 0x8ac6ff;
const OTHER_TINT = 0x4aa3ff;
const SHIP_TEX_KEY = "ship_png"; // loaded from packages/assets/spaceship.png

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

  wells: WellState[] = [];
  debugWellsOn = true;
  debugFullView = false; // New debug flag for full arena view
  wellGfx!: Phaser.GameObjects.Graphics;
  lastWellUpdateTime = 0; // Track time for client-side planet movement prediction

  // arena/bounds
  worldW = 4000; // overwritten by welcome
  worldH = 3000;
  boundsGfx!: Phaser.GameObjects.Graphics;

  // pickup interpolation (snapshot to snapshot)
  pickPrev = new Map<string, { x: number; y: number; type: "xp" | "hp" }>();
  pickCurr = new Map<string, { x: number; y: number; type: "xp" | "hp" }>();
  pickAlpha = 1;

  // input state
  seq = 0;
  lastInputAt = 0;
  aim = 0;
  thrust = { x: 0, y: 0 };
  fireHeld = false;

  // camera anchor (interpolated you)
  camX = 0;
  camY = 0;

  // input model
  space!: Phaser.Input.Keyboard.Key; // Spacebar to fire
  alwaysThrust = false; // Desktop: always thrust toward pointer
  isThrusting = false; // Mobile: thrust while touching
  touchFireHeld = false; // Mobile FIRE button

  touchFireBtn!: HTMLDivElement;

  constructor() {
    super("Game");
  }

  preload() {
  // Preload custom ship part textures
  this.load.image("raketti/body0.png", new URL("../assets/raketti/body0.png", import.meta.url).toString());
  this.load.image("raketti/wings0.png", new URL("../assets/raketti/wings0.png", import.meta.url).toString());
  this.load.image("raketti/window0.png", new URL("../assets/raketti/window0.png", import.meta.url).toString());
  this.load.image("raketti/point0.png", new URL("../assets/raketti/point0.png", import.meta.url).toString());
  this.load.image("raketti/weapon0.png", new URL("../assets/raketti/weapon0.png", import.meta.url).toString());
 
    // Preload custom ship part textures
    this.load.image("raketti/body0.png", new URL("../assets/raketti/body0.png", import.meta.url).toString());
    this.load.image("raketti/wings0.png", new URL("../assets/raketti/wings0.png", import.meta.url).toString());
    this.load.image("raketti/window0.png", new URL("../assets/raketti/window0.png", import.meta.url).toString());
    this.load.image("raketti/point0.png", new URL("../assets/raketti/point0.png", import.meta.url).toString());
    // Preload heart image for HP pickups
    this.load.image("heart", new URL("../assets/muut/heart.png", import.meta.url).toString());
        this.load.image("raketti/weapon0.png", new URL("../assets/raketti/weapon0.png", import.meta.url).toString());
        this.load.image("EARTH", "/assets/planeetat/EARTH.png");
        this.load.image("MARS", "/assets/planeetat/MARS.png");
        this.load.image("SATURNUS", "/assets/planeetat/SATURNUS.png");
        this.load.image("NEPTUNUS", "/assets/planeetat/NEPTUNUS.png");
        this.load.image("JUPITER", "/assets/planeetat/JUPITER.png");
        this.load.image("VENUS", "/assets/planeetat/VENUS.png");
  }

  async create() {
    (window as any).net = this.net;
    this.cameras.main.setBackgroundColor("#05070b");

    this.parallax = new Parallax(this);
    this.bullets = new Projectiles(this);
    this.pickups = new Pickups(this);
    this.hud = new HUD();
    this.levelModal = new LevelUpModal();

    this.wellGfx = this.add.graphics().setDepth(8);
    this.boundsGfx = this.add.graphics().setDepth(7); // below gravity overlay, above stars
    this.input.keyboard?.on("keydown-F3", () => {
      this.debugWellsOn = !this.debugWellsOn;
      this.wellGfx.clear();
    });

    // Debug key "I" to toggle full arena view
    this.input.keyboard?.on("keydown-I", () => {
      this.debugFullView = !this.debugFullView;
      if (this.debugFullView) {
        // Set camera to show entire arena
        const scaleX = this.scale.width / this.worldW;
        const scaleY = this.scale.height / this.worldH;
        const scale = Math.min(scaleX, scaleY) * 0.9; // 0.9 for some padding
        this.cameras.main.setZoom(scale);

        // Center camera on arena center, but offset by player position to maintain relative positioning
        const youI = this.interp.get(this.net.youId || "") ?? this.interp.current.get(this.net.youId || "");
        if (youI) {
          // Calculate offset from arena center to keep player entities in correct relative positions
          const arenaCenterX = this.worldW / 2;
          const arenaCenterY = this.worldH / 2;
          this.cameras.main.centerOn(arenaCenterX - youI.x, arenaCenterY - youI.y);
        } else {
          this.cameras.main.centerOn(0, 0);
        }
      } else {
        // Reset camera to normal view - center on screen center
        this.cameras.main.setZoom(1);
        this.cameras.main.centerOn(this.scale.width / 2, this.scale.height / 2);
      }
    });

    // Touch FIRE button (mobile)
    this.touchFireBtn = document.createElement("div");
    this.touchFireBtn.className = "touch-fire";
    this.touchFireBtn.innerText = "FIRE";
    document.body.appendChild(this.touchFireBtn);
    this.touchFireBtn.onpointerdown = () => (this.touchFireHeld = true);
    this.touchFireBtn.onpointerup = () => (this.touchFireHeld = false);
    this.touchFireBtn.onpointercancel = () => (this.touchFireHeld = false);

    // Input mode: desktop vs mobile
    const isDesktop = this.sys.game.device.os.desktop;
    this.alwaysThrust = isDesktop;

    // Spacebar fires
    this.space = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    ) as Phaser.Input.Keyboard.Key;

    // Mobile thrust: hold touch to thrust; release to stop
    this.input.on("pointerdown", () => {
      if (!isDesktop) this.isThrusting = true;
    });
    this.input.on("pointerup", () => {
      if (!isDesktop) {
        this.isThrusting = false;
        this.thrust = { x: 0, y: 0 };
      }
    });
    // We compute aim/thrust every frame in update() now.

    // Ask for player name
    const prompt = new NamePrompt();
    const name = await prompt.getName();

    // Start connecting (resolves on 'welcome'), register handlers, then join, then await welcome
    const connectP = this.net.connect(import.meta.env.VITE_SERVER_URL || "http://localhost:8080");

    this.net.onEvent(async (e) => {
      if (e.type === "LevelUpOffer") {
        const choice = await this.levelModal.choose(e.choices);
        this.net.choosePowerup(choice);
      }
    });
    this.net.onSnapshot((s) => this.onSnapshot(s));

    this.net.join(name);
    const welcome = await connectP;
    this.worldW = welcome.world.w;
    this.worldH = welcome.world.h;

    // Ensure your ship exists immediately (in case no snapshot yet)
    const youId = this.net.youId!;
    if (!this.ships.has(youId)) {
      const ship = new Ship(this, { scale: 0.03, ringRadius: 18, showNose: true });
      ship.body.setDepth(1000);
      ship.wings.setDepth(1001);
      ship.window.setDepth(1002);
      ship.point.setDepth(1003);
      ship.ring.setDepth(1004);
      ship.setTint(SELF_TINT);
      this.ships.set(youId, ship);
    }
  }

  onSnapshot(s: ServerSnapshot) {
    this.interp.push(s.entities);

    // Store previous wells for interpolation
    const prevWells = this.wells;
    this.wells = s.wells;

    // If we have previous wells, set up interpolation
    if (prevWells.length > 0) {
      for (let i = 0; i < this.wells.length && i < prevWells.length; i++) {
        const curr = this.wells[i];
        const prev = prevWells[i];

        // Check if this is the same planet (by ID) and if the movement is reasonable
        const isSamePlanet = curr.id === prev.id;
        const movementDistance = Math.hypot(curr.x - prev.x, curr.y - prev.y);
        const maxReasonableMovement = 200; // Max pixels a planet should move between snapshots

        // Only interpolate if it's the same planet and movement is reasonable
        if (isSamePlanet && movementDistance < maxReasonableMovement) {
          (curr as any)._prevX = prev.x;
          (curr as any)._prevY = prev.y;
          (curr as any)._interpAlpha = 0;
        } else {
          // Don't interpolate for respawned planets or large jumps
          (curr as any)._prevX = curr.x;
          (curr as any)._prevY = curr.y;
          (curr as any)._interpAlpha = 1;
        }
      }
    }

    const you = s.entities.find((e) => e.id === (this.net.youId || s.youId));
    if (!you) return;

    if (!this.ships.has(you.id)) {
      const me = new Ship(this, { scale: 0.03, ringRadius: 18, showNose: true });
      me.setTint(SELF_TINT);
      this.ships.set(you.id, me);
    }
    this.recon.setYouState(you);

    // HUD
    this.hud.setScoreboard(s.scoreboard);
    if (you.maxHp) this.hud.setHP(you.hp ?? 0, you.maxHp);
    if (typeof (you as any).xp === "number" && typeof (you as any).xpToNext === "number") {
      this.hud.setXP((you as any).xp, (you as any).xpToNext);
    }

    // Bullets: ensure sprites now (placement each frame from interpolated entities)
    const bulletIds = new Set<string>();
    for (const e of s.entities) {
      if (e.kind === "bullet") {
        this.bullets.ensure(e.id, e.r, e.vx, e.vy); // Pass velocity here
        bulletIds.add(e.id);
      }
    }
    this.bullets.removeMissing(bulletIds);

    // Pickups: store prev/curr for interpolation; ensure sprites
    this.pickPrev = this.pickCurr;
    this.pickCurr = new Map(s.pickups.map((p) => [p.id, { x: p.x, y: p.y, type: p.type }]));
    this.pickAlpha = 0;

    const pickupIds = new Set<string>();
    for (const [id, p] of this.pickCurr) {
      this.pickups.ensure(id, p.type);
      pickupIds.add(id);
    }
    this.pickups.removeMissing(pickupIds);

    // Ensure all player sprites exist; tint others; clean up missing
    for (const e of s.entities) {
      if (e.kind !== "player") continue;
      if (!this.ships.has(e.id)) {
        const ship = new Ship(this, { scale: 0.03, ringRadius: 18, showNose: true });
        ship.setTint(e.id === you.id ? SELF_TINT : OTHER_TINT);
        this.ships.set(e.id, ship);
      }
    }
    const ids = new Set(s.entities.filter((e) => e.kind === "player").map((e) => e.id));
    for (const [id, ship] of this.ships) {
      if (!ids.has(id)) {
        ship.destroy();
        this.ships.delete(id);
      }
    }
  }

  update(_time: number, delta: number) {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    // Compute aim toward current pointer each frame (camera fixed at center)
    const pointer = this.input.activePointer;
    this.aim = Math.atan2(pointer.worldY - cy, pointer.worldX - cx);

    // If mouse is near the ship (center), stop acceleration
    const mouseDist = Math.hypot(pointer.worldX - cx, pointer.worldY - cy);
    const stopRadius = 80; // px, tweak as needed

    if ((this.alwaysThrust || this.isThrusting) && mouseDist > stopRadius) {
      this.thrust = { x: Math.cos(this.aim), y: Math.sin(this.aim) };
    } else {
      this.thrust = { x: 0, y: 0 };
    }

    // Fire: Spacebar or mobile FIRE button
    const spaceDown = this.space?.isDown ?? false;
    this.fireHeld = spaceDown || this.touchFireHeld;

    // Send input at ~40 Hz
    const dtMs = delta;
    const now = performance.now();
    if (now - this.lastInputAt > 1000 / 40 && this.net.youId) {
      const payload = {
        id: this.net.youId!,
        seq: ++this.seq,
        aim: this.aim,
        thrust: this.thrust,
        fire: this.fireHeld,
        dtMs,
      } as const;
      this.net.sendInput(payload as any);
      this.recon.record(payload as any);
      this.lastInputAt = now;
    }

    // Interpolated "you" for smooth rendering/camera base
    const youI =
      this.interp.get(this.net.youId || "") ?? this.interp.current.get(this.net.youId || "");

    if (youI) {
      // Other players relative to interpolated you
      for (const id of this.interp.ids()) {
        const e = this.interp.get(id)!;
        if (e.kind !== "player" || id === this.net.youId) continue;

        const ship = this.ships.get(id);
        if (!ship) continue;

        ship.setPosition(cx + (e.x - youI.x), cy + (e.y - youI.y));

        // Face their movement direction (guard tiny velocities)
        const spd = Math.hypot(e.vx, e.vy);
        if (spd > 0.001) ship.setRotation(Math.atan2(e.vy, e.vx));
      }

      // Your ship stays centered and faces aim
      const myShip = this.ships.get(this.net.youId!);
      if (myShip) {
        myShip.setPosition(cx, cy);
        myShip.setRotation(this.aim);
      }

      // Parallax + HUD from interpolated you (dt for framerate independence)
      if (!this.debugFullView) {
        this.parallax.update(youI.vx, youI.vy, delta, this.cameras.main.zoom);
      } else {
        // In debug mode, still update parallax but with camera zoom for proper scaling
        this.parallax.update(youI.vx, youI.vy, delta, this.cameras.main.zoom);
      }
      if (youI.maxHp) this.hud.setHP(youI.hp ?? 0, youI.maxHp);
    }

    // Bullets: place via interpolated entities
    if (youI) {
      for (const id of this.interp.ids()) {
        const e = this.interp.get(id)!;
        if (e.kind === "bullet") {
          this.bullets.place(id, cx + (e.x - youI.x), cy + (e.y - youI.y));
        }
      }
    }

    // Pickups: interpolate between snapshots
    this.pickAlpha = Math.min(1, this.pickAlpha + delta / (1000 / SNAPSHOT_HZ));
    if (youI) {
      for (const [id, cur] of this.pickCurr) {
        const prev = this.pickPrev.get(id) || cur;
        const x = prev.x + (cur.x - prev.x) * this.pickAlpha;
        const y = prev.y + (cur.y - prev.y) * this.pickAlpha;
        this.pickups.place(id, cx + (x - youI.x), cy + (y - youI.y));
      }
    }

    // Client-side planet movement prediction - move planets independently of server updates
    // This ensures smooth constant movement regardless of player position or server lag
    const currentTime = performance.now();
    if (this.lastWellUpdateTime === 0) {
      this.lastWellUpdateTime = currentTime;
    }

    const timeDelta = (currentTime - this.lastWellUpdateTime) / 1000; // Convert to seconds
    const planetScrollSpeed = 50; // Match server GRAVITY.planetScrollSpeed

    // Move planets down at constant speed on client side
    for (const well of this.wells) {
      if (well.type === "planet" || well.type === "sun") {
        well.y += planetScrollSpeed * timeDelta;
      }
    }

    this.lastWellUpdateTime = currentTime;

    // Interpolate wells (planets) between snapshots for smooth movement
    // This is now only used for correction, not primary movement
    for (const well of this.wells) {
      const wellAny = well as any;
      if (wellAny._prevX !== undefined && wellAny._prevY !== undefined) {
        wellAny._interpAlpha = Math.min(1, wellAny._interpAlpha + delta / (1000 / SNAPSHOT_HZ));

        // Only apply small corrections, don't override the client-side prediction
        const serverX = wellAny._prevX + (well.x - wellAny._prevX) * wellAny._interpAlpha;
        const serverY = wellAny._prevY + (well.y - wellAny._prevY) * wellAny._interpAlpha;

        // Apply gentle correction if there's a significant difference
        const correctionStrength = 0.1; // 10% correction per frame
        well.x = well.x + (serverX - well.x) * correctionStrength;
        // Don't correct Y position as we're predicting movement
      }
    }

    // Camera anchor for debug drawers
    if (youI) {
      this.camX = youI.x;
      this.camY = youI.y;
    } else if (this.recon.you) {
      this.camX = this.recon.you.x;
      this.camY = this.recon.you.y;
    }

    // Advance entity interpolation
    this.interp.step(delta / 1000, 1000 / SNAPSHOT_HZ);

    // Draw arena and gravity overlay (use camX/camY)
    drawArenaBounds(this);
    drawGravityDebug(this);

    // Update bullets movement
    this.bullets.update(delta / 1000);
  }
}
