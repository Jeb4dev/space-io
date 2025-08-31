import Phaser from "phaser";
import { Net } from "@client/net/socket";
import { NamePrompt } from "@client/ui/NamePrompt";
import { LevelUpModal } from "@client/ui/LevelUpModal";
import { HUD } from "@client/ui/HUD";
import { GameOverModal } from "@client/ui/GameOverModal";
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
  gameOverModal!: GameOverModal;

  // Run stats
  runStartMs = performance.now();
  distanceTraveled = 0;
  maxSpeedSeen = 0;
  lastScore = 0;
  lastLevel = 1;
  gameEnded = false;

  interp = new Interp();
  recon = new Recon();

  ships = new Map<string, Ship>();
  bullets!: Projectiles;
  pickups!: Pickups;
  parallax!: Parallax;

  // Track ships playing death animations to prevent premature cleanup
  dyingShips = new Set<string>();

  wells: WellState[] = [];
  debugWellsOn = true;
  debugFullView = false; // New debug flag for full arena view
  wellGfx!: Phaser.GameObjects.Graphics;

  // Radar upgrade tracking for zoom functionality
  radarLevel = 0;

  // Planet sprite management
  planetSprites = new Map<string, Phaser.GameObjects.Image>();

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
  altFireHeld = false;

  // camera anchor (interpolated you)
  camX = 0;
  camY = 0;

  // input model
  space!: Phaser.Input.Keyboard.Key; // Spacebar to fire
  alwaysThrust = false; // Desktop: always thrust toward pointer
  isThrusting = false; // Mobile: thrust while touching
  touchFireHeld = false; // Mobile FIRE button

  touchFireBtn!: HTMLDivElement;

  // Audio
  menuMusic!: Phaser.Sound.BaseSound; // start & end screens
  gameMusic!: Phaser.Sound.BaseSound; // in-game background
  playerName = '';

  constructor() {
    super("Game");
  }

  // Calculate camera zoom based on radar level
  updateCameraZoom() {
    if (this.debugFullView) return; // Don't interfere with debug view
    const baseZoom = 0.9; // Base zoom level
    const zoomOutPerLevel = 0.05; // How much to zoom out per radar level
    const calculatedZoom = baseZoom - (this.radarLevel * zoomOutPerLevel);
    this.cameras.main.setZoom(calculatedZoom);
  }

  preload() {
    // Preload custom ship part textures - all upgrade levels (0, 1, 2)
    this.load.image("raketti/body0.png", new URL("../assets/raketti/body0.png", import.meta.url).toString());
    this.load.image("raketti/body1.png", new URL("../assets/raketti/body1.png", import.meta.url).toString());
    this.load.image("raketti/body2.png", new URL("../assets/raketti/body2.png", import.meta.url).toString());

    this.load.image("raketti/wings0.png", new URL("../assets/raketti/wings0.png", import.meta.url).toString());
    this.load.image("raketti/wings1.png", new URL("../assets/raketti/wings1.png", import.meta.url).toString());
    this.load.image("raketti/wings2.png", new URL("../assets/raketti/wings2.png", import.meta.url).toString());

    this.load.image("raketti/window0.png", new URL("../assets/raketti/window0.png", import.meta.url).toString());
    this.load.image("raketti/window1.png", new URL("../assets/raketti/window1.png", import.meta.url).toString());
    this.load.image("raketti/window2.png", new URL("../assets/raketti/window2.png", import.meta.url).toString());

    this.load.image("raketti/point0.png", new URL("../assets/raketti/point0.png", import.meta.url).toString());
    this.load.image("raketti/point1.png", new URL("../assets/raketti/point1.png", import.meta.url).toString());
    this.load.image("raketti/point2.png", new URL("../assets/raketti/point2.png", import.meta.url).toString());

    this.load.image("raketti/weapon0.png", new URL("../assets/raketti/weapon0.png", import.meta.url).toString());
    this.load.image("raketti/weapon1.png", new URL("../assets/raketti/weapon1.png", import.meta.url).toString());
    this.load.image("raketti/weapon2.png", new URL("../assets/raketti/weapon2.png", import.meta.url).toString());

    // Preload fire animation textures
    this.load.image("fire/fire0.png", new URL("../assets/fire/fire0.png", import.meta.url).toString());
    this.load.image("fire/fire1.png", new URL("../assets/fire/fire1.png", import.meta.url).toString());
    this.load.image("fire/fire2.png", new URL("../assets/fire/fire2.png", import.meta.url).toString());
    this.load.image("fire/fire3.png", new URL("../assets/fire/fire3.png", import.meta.url).toString());

    // Preload heart image for HP pickups
    this.load.image("heart", new URL("../assets/muut/heart.png", import.meta.url).toString());
    // Preload planet assets
    this.load.image("EARTH", new URL("../assets/planeetat/EARTH.png", import.meta.url).toString());
    this.load.image("JUPITER", new URL("../assets/planeetat/JUPITER.png", import.meta.url).toString());
    this.load.image("MARS", new URL("../assets/planeetat/MARS.png", import.meta.url).toString());
    this.load.image("NEPTUNUS", new URL("../assets/planeetat/NEPTUNUS.png", import.meta.url).toString());
    this.load.image("SATURNUS", new URL("../assets/planeetat/SATURNUS.png", import.meta.url).toString());
    this.load.image("SUN", new URL("../assets/planeetat/SUN.png", import.meta.url).toString());
    this.load.image("VENUS", new URL("../assets/planeetat/VENUS.png", import.meta.url).toString());

    // Audio assets
    this.load.audio("menuMusic", new URL("../assets/sounds/space-ambient-351305.mp3", import.meta.url).toString());
    this.load.audio("gameMusic", new URL("../assets/sounds/ambient-space-fantasy-music-for-mindful-escapism-141536.mp3", import.meta.url).toString());
  }

  async create(data?: { playerName?: string }) {
    // Reset or initialize core state each (re)create
    this.runStartMs = performance.now();
    this.distanceTraveled = 0;
    this.maxSpeedSeen = 0;
    this.lastScore = 0;
    this.lastLevel = 1;
    this.gameEnded = false;
    this.wells = [];
    this.pickPrev = new Map();
    this.pickCurr = new Map();
    this.pickAlpha = 1;
    this.ships = new Map();
    this.dyingShips.clear();
    this.radarLevel = 0; // Reset radar level for new game
    this.planetSprites.forEach(s => s.destroy());
    this.planetSprites = new Map();

    // Fresh Net instance every restart
    this.net = new Net();

    (window as any).net = this.net;
    this.cameras.main.setBackgroundColor('#05070b');

    // Reuse existing HUD/overlays on restart; only construct if first time
    if (!this.hud || !data?.playerName) {
      this.parallax = new Parallax(this);
      this.bullets = new Projectiles(this);
      this.pickups = new Pickups(this);
      this.hud = new HUD();
      this.levelModal = new LevelUpModal();
      this.gameOverModal = new GameOverModal();
    } else {
      // Ensure HUD cleared
      this.hud.setScoreboard([]);
    }

    // Audio setup (re-create sounds each time to avoid overlap)
    this.menuMusic = this.sound.add('menuMusic', { loop: true, volume: 0 });
    this.gameMusic = this.sound.add('gameMusic', { loop: true, volume: 0.5 });
    (this.menuMusic as any).setVolume?.(0);
    (this.gameMusic as any).setVolume?.(0.5);

    let menuFadedIn = false;
    const fadeInMenu = () => {
      if (menuFadedIn) return;
      menuFadedIn = true;
      this.fadeSound(this.menuMusic, 0, 0.5, 800, false);
    };

    if ((this.sound as any).locked) {
      this.sound.once(Phaser.Sound.Events.UNLOCKED, () => {
        if (!this.menuMusic.isPlaying) { try { this.menuMusic.play(); } catch {} }
        fadeInMenu();
      });
      try { this.menuMusic.play(); } catch {}
    } else {
      try { if (!this.menuMusic.isPlaying) this.menuMusic.play(); } catch {}
      fadeInMenu();
    }

    this.wellGfx = this.add.graphics().setDepth(8);
    this.boundsGfx = this.add.graphics().setDepth(7);

    // Set default camera zoom for better visibility
    this.updateCameraZoom(); // Use radar-based zoom calculation

    // Create fire animation
    if (!this.anims.exists('fire_thruster')) {
      this.anims.create({
        key: 'fire_thruster',
        frames: [
          { key: 'fire/fire0.png' },
          { key: 'fire/fire1.png' },
          { key: 'fire/fire2.png' },
          { key: 'fire/fire3.png' }
        ],
        frameRate: 12,
        repeat: -1
      });
    }

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
        // Reset camera to normal view - center on screen center with radar-based zoom
        this.updateCameraZoom(); // Use radar-based zoom calculation
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

    // Debug key for testing XP - T key gives +25 XP
    this.input.keyboard?.on("keydown-T", () => {
      if (this.net.youId) {
        // Send a debug command to the server to add XP
        this.net.socket.emit("debug", { type: "addXP", amount: 25 });
      }
    });

    // Mobile thrust: hold touch to thrust; release to stop
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!isDesktop) this.isThrusting = true;
      
      // Left mouse button for alternative fire (desktop only)
      if (isDesktop && pointer.leftButtonDown()) {
        this.altFireHeld = true;
      }
    });
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (!isDesktop) {
        this.isThrusting = false;
        this.thrust = { x: 0, y: 0 };
      }
      
      // Release alternative fire when left mouse button is released
      if (isDesktop && pointer.leftButtonReleased()) {
        this.altFireHeld = false;
      }
    });
    // We compute aim/thrust every frame in update() now.

    // Ask for player name (skip prompt on restart)
    let name: string;
    if (data?.playerName) {
      name = data.playerName;
      this.playerName = name;
      // Immediately start game music (skip menu linger)
      this.fadeToGameMusic();
    } else {
      const prompt = new NamePrompt();
      name = await prompt.getName();
      this.playerName = name;
      this.fadeToGameMusic();
    }

    // Start connecting (resolves on 'welcome'), register handlers, then join, then await welcome
    const rawUrl = (import.meta.env as any).VITE_SERVER_URL || "http://localhost:8008";
    let serverUrl: string = rawUrl;
    // If page is https but URL is http, upgrade to avoid mixed content block
    if (window.location.protocol === 'https:' && rawUrl.startsWith('http://')) {
      serverUrl = 'https://' + rawUrl.substring('http://'.length);
    }
    // Final sanity: ensure it has protocol
    if (!/^https?:\/\//i.test(serverUrl)) {
      serverUrl = window.location.origin;
    }
    console.log('[net] connecting to', serverUrl);
    const connectP = this.net.connect(serverUrl);

    this.net.onEvent(async (e) => {
      if (e.type === 'Kill') {
        // Create explosion effect at death location
        this.createExplosion(e.x, e.y);
        // Make the victim ship fade/blink
        this.makeShipDeathEffect(e.victimId);
        // If YOU died, end run (only once)
        if (!this.gameEnded && e.victimId === this.net.youId) {
          this.gameEnded = true;
          const now = performance.now();
          const duration = now - this.runStartMs;
          const stats = {
            score: e.victimScore || this.lastScore, // Use score from kill event if available
            level: e.victimLevel || this.lastLevel, // Use level from kill event if available
            durationMs: duration,
            distance: this.distanceTraveled,
            maxSpeed: this.maxSpeedSeen,
          };
          this.gameOverModal.show(stats);
          // Stop sending inputs
          this.net.socket.disconnect();
          // Wait for user to click respawn -> reload page to get fresh session
          this.gameOverModal.waitRespawn().then(() => {
            this.handleRespawn();
          });
          this.fadeToMenuMusic();
        }
      } else if (e.type === 'LevelUpOffer') {
        // Get current player stats to pass to modal
        const you = this.interp.get(this.net.youId || "");
        const choice = await this.levelModal.choose(e.choices, you);
        this.net.choosePowerup(choice);
      } else if (e.type === 'LevelUpApplied') {
        // Update ship textures when stats change
        const updated = (e as any).updated;
        const ship = this.ships.get(this.net.youId!);
        if (ship && updated) {
          ship.updateTextures({
            maxHp: updated.maxHp,
            damage: updated.damage,
            maxSpeed: updated.maxSpeed,
            accel: updated.accel,
            magnetRadius: updated.magnetRadius,
            fireCooldownMs: updated.fireCooldownMs,
          });
          const youId = this.net.youId;
          if (youId) {
            const you = this.interp.get(youId);
            if (you) {
              Object.assign(you, e.updated);
              // Update radar level and camera zoom
              if (updated.radarLevel !== undefined) {
                this.radarLevel = updated.radarLevel;
                this.updateCameraZoom();
              }
              // Immediately refresh HUD powerups panel from event data
              this.hud.setPowerups({ ...you, powerupLevels: updated.powerupLevels });
            }
          }
        }
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
    // Track score/level for game over stats
    if (typeof (you as any).score === 'number') this.lastScore = (you as any).score;
    if (typeof (you as any).level === 'number') this.lastLevel = (you as any).level;

    // Update radar level from powerupLevels if available
    if ((you as any).powerupLevels?.Radar !== undefined) {
      const newRadarLevel = (you as any).powerupLevels.Radar;
      if (this.radarLevel !== newRadarLevel) {
        this.radarLevel = newRadarLevel;
        this.updateCameraZoom();
      }
    } else if ((you as any).hp === 0 || (you as any).hp === undefined) {
      // Reset radar level when dead (before respawn)
      if (this.radarLevel !== 0) {
        this.radarLevel = 0;
        this.updateCameraZoom();
      }
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

    // Ensure all player sprites exist; tint others; update textures; clean up missing
    for (const e of s.entities) {
      if (e.kind !== "player") continue;
      if (!this.ships.has(e.id)) {
        const ship = new Ship(this, { scale: 0.03, ringRadius: 18, showNose: true });
        ship.setTint(e.id === you.id ? SELF_TINT : OTHER_TINT);
        this.ships.set(e.id, ship);
      }
      
      // Update ship textures if we have the stats
      const ship = this.ships.get(e.id);
      if (ship && e.maxHp && e.damage && e.maxSpeed && e.accel && e.magnetRadius && e.fireCooldownMs) {
        ship.updateTextures({
          maxHp: e.maxHp,
          damage: e.damage,
          maxSpeed: e.maxSpeed,
          accel: e.accel,
          magnetRadius: e.magnetRadius,
          fireCooldownMs: e.fireCooldownMs,
        });
      }
    }
    const ids = new Set(s.entities.filter((e) => e.kind === "player").map((e) => e.id));
    for (const [id, ship] of this.ships) {
      if (!ids.has(id) && !this.dyingShips.has(id)) {
        ship.destroy();
        this.ships.delete(id);
      }
    }

    // Update HUD with current powerup levels
    if ((you as any).powerupLevels) {
      this.hud.setPowerups({ ...you, powerupLevels: (you as any).powerupLevels });
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
    const stopRadius = 120; // px, increased from 80 for bigger deadzone

    if ((this.alwaysThrust || this.isThrusting) && mouseDist > stopRadius) {
      this.thrust = { x: Math.cos(this.aim), y: Math.sin(this.aim) };
    } else {
      this.thrust = { x: 0, y: 0 };
    }

    // Control thruster visibility based on thrust and mouse distance
    const myShip = this.ships.get(this.net.youId!);
    if (myShip) {
      const isThrusting = (this.thrust.x !== 0 || this.thrust.y !== 0) && mouseDist > stopRadius;
      myShip.setThrusterVisible(isThrusting);
    }

    // Fire: Spacebar, mobile FIRE button, or left mouse button
    const spaceDown = this.space?.isDown ?? false;
    this.fireHeld = spaceDown || this.touchFireHeld || this.altFireHeld;

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
      // Update distance & max speed (only while game active)
      if (!this.gameEnded) {
        const speed = Math.hypot(youI.vx, youI.vy);
        this.distanceTraveled += speed * (delta / 1000);
        if (speed > this.maxSpeedSeen) this.maxSpeedSeen = speed;
      }

      // Other players relative to interpolated you
      for (const id of this.interp.ids()) {
        const e = this.interp.get(id)!;
        if (e.kind !== "player" || id === this.net.youId) continue;

        const ship = this.ships.get(id);
        if (!ship) continue;

        ship.setPosition(cx + (e.x - youI.x), cy + (e.y - youI.y));

        // Face their movement direction (guard tiny velocities)
        const spd = Math.hypot(e.vx, e.vy);
        if (spd > 0.001) {
          ship.setRotation(Math.atan2(e.vy, e.vx));
          // Show thruster when moving fast enough
          ship.setThrusterVisible(spd > 50); // Show thruster if speed > 50 units
        } else {
          ship.setThrusterVisible(false);
        }
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
      // Update velocity display
      this.hud.setVelocity(youI.vx, youI.vy);
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

    // Removed client-side planet movement prediction & correction; rely on server authoritative well positions

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

    // Render planet sprites
    this.updatePlanetSprites(youI);

    // Draw arena and gravity overlay (use camX/camY)
    if (document && (document.body.classList.contains('pre-game') || document.body.classList.contains('game-over'))) {
      // Hide world border during name prompt or game over
      this.boundsGfx.clear();
    } else {
      drawArenaBounds(this);
    }
    drawGravityDebug(this);

    // Update bullets movement
    this.bullets.update(delta / 1000);
  }

  /** Ensure planet sprites exist and update their positions */
  private updatePlanetSprites(youI: any) {
    if (!youI) return;

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    // Track current well IDs
    const currentWellIds = new Set(this.wells.map(w => w.id));

    // Remove sprites for wells that no longer exist
    for (const [wellId, sprite] of this.planetSprites) {
      if (!currentWellIds.has(wellId)) {
        sprite.destroy();
        this.planetSprites.delete(wellId);
      }
    }

    // Ensure sprites exist and position them
    for (const well of this.wells) {
      // Only render planets and suns with textures
      if ((well.type === "planet" || well.type === "sun") && well.texture) {
        const textureKey = well.texture;

        // Ensure sprite exists - similar to pickup system
        if (!this.planetSprites.has(well.id)) {
          if (this.textures.exists(textureKey)) {
            const sprite = this.add.image(0, 0, textureKey).setDepth(1); // Below everything (ships 1000+, bullets 5)

            // Scale sprite to match well radius
            const targetDiameter = well.radius * 2;
            const scale = targetDiameter / sprite.width;
            sprite.setScale(scale);

            this.planetSprites.set(well.id, sprite);
          }
        }

        // Position the sprite
        const sprite = this.planetSprites.get(well.id);
        if (sprite) {
          const sx = cx + (well.x - youI.x);
          const sy = cy + (well.y - youI.y);
          sprite.setPosition(sx, sy);
          sprite.rotation += 0.001; // Slow rotation
        }
      }
    }
  }

  /** Create explosion effect at world coordinates */
  createExplosion(worldX: number, worldY: number) {
    // Convert world coordinates to screen coordinates
    const youI = this.interp.get(this.net.youId || "");
    if (!youI) return;

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const sx = cx + (worldX - youI.x);
    const sy = cy + (worldY - youI.y);

    // Create explosion particles
    const particleCount = 12;
    const explosionRadius = 60;
    
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const distance = 20 + Math.random() * explosionRadius;
      
      // Create particle
      const particle = this.add.circle(sx, sy, 3 + Math.random() * 4, 0xff6600)
        .setDepth(1000);
      
      // Animate particle
      this.tweens.add({
        targets: particle,
        x: sx + Math.cos(angle) * distance,
        y: sy + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.3,
        duration: 800 + Math.random() * 500, // Increased from 500+300 to 800+500
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }

    // Create bright flash
    const flash = this.add.circle(sx, sy, 8, 0xffaa00)
      .setDepth(1001);
    
    this.tweens.add({
      targets: flash,
      scale: 4,
      alpha: 0,
      duration: 400, // Increased from 200 to 400
      ease: 'Power2',
      onComplete: () => flash.destroy()
    });

    // Create shockwave ring
    const ring = this.add.circle(sx, sy, 5, 0xffffff, 0)
      .setStrokeStyle(2, 0xff8800)
      .setDepth(999);
    
    this.tweens.add({
      targets: ring,
      radius: explosionRadius,
      alpha: 0,
      duration: 700, // Increased from 400 to 700
      ease: 'Power2',
      onComplete: () => ring.destroy()
    });
  }

  /** Make ship fade and blink during death */
  makeShipDeathEffect(victimId: string) {
    const ship = this.ships.get(victimId);
    if (!ship) return;

    // Mark ship as dying to prevent cleanup during animation
    this.dyingShips.add(victimId);

    // Hide thruster immediately on death
    ship.setThrusterVisible(false);

    // Create a blinking/fading effect
    const shipParts = [ship.body, ship.wings, ship.window, ship.point, ship.weapon, ship.ring];
    
    // First, make the ship blink rapidly
    this.tweens.add({
      targets: shipParts,
      alpha: 0.2,
      duration: 120, // Increased from 80 to 120
      yoyo: true,
      repeat: 5, // Increased from 3 to 5 (6 blinks total)
      ease: 'Power2',
      onComplete: () => {
        // After blinking, fade out completely
        this.tweens.add({
          targets: shipParts,
          alpha: 0,
          scale: 0.7, // Slightly shrink while fading
          duration: 600, // Increased from 300 to 600
          ease: 'Power2',
          onComplete: () => {
            // Remove from dying ships set and clean up
            this.dyingShips.delete(victimId);
            // If the ship is no longer in the active ships (respawned), destroy the old one
            if (this.ships.has(victimId)) {
              const currentShip = this.ships.get(victimId);
              if (currentShip === ship) {
                // This is still the same ship object, so it hasn't respawned yet
                ship.destroy();
                this.ships.delete(victimId);
              }
            }
            // Reset alpha and scale in case ship respawns
            shipParts.forEach(part => {
              if (part && !part.scene) return; // Skip if destroyed
              part.setAlpha(1);
              part.setScale(part.scaleX > 0 ? 0.03 : -0.03); // Restore original scale
            });
          }
        });
      }
    });
  }

  private handleRespawn() {
    // Stop sounds to avoid overlap
    try { this.menuMusic?.stop(); } catch {}
    try { this.gameMusic?.stop(); } catch {}
    // Restart scene with stored player name
    this.scene.restart({ playerName: this.playerName });
  }

  private fadeToGameMusic() {
    if (this.menuMusic?.isPlaying) {
      this.fadeSound(this.menuMusic, 0.5, 0, 600, true);
    }
    if (this.gameMusic && !this.gameMusic.isPlaying) {
      (this.gameMusic as any).setVolume?.(0);
      this.gameMusic.play();
      this.fadeSound(this.gameMusic, 0, 0.5, 900, false);
    }
  }

  private fadeToMenuMusic() {
    if (this.gameMusic?.isPlaying) {
      this.fadeSound(this.gameMusic, 0.5, 0, 800, true);
    }
    if (this.menuMusic && !this.menuMusic.isPlaying) {
      (this.menuMusic as any).setVolume?.(0);
      this.menuMusic.play();
      this.fadeSound(this.menuMusic, 0, 0.5, 1200, false);
    }
  }

  private fadeSound(sound: Phaser.Sound.BaseSound, from: number, to: number, duration: number, stopOnZero: boolean) {
    const proxy = { v: from };
    (sound as any).setVolume?.(from);
    this.tweens.add({
      targets: proxy,
      v: to,
      duration,
      onUpdate: () => (sound as any).setVolume?.(proxy.v),
      onComplete: () => {
        if (stopOnZero && to === 0) sound.stop();
      }
    });
  }
}
