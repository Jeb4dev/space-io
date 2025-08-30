import { nanoid } from "nanoid";
import { WORLD, PLAYER, BULLET, PICKUPS, POWERUPS, ALT_FIRE } from "@shared/constants.js";
import { TICK_HZ } from "@shared/constants.js";
import type { World, Player, Bullet, Pickup } from "./world.js";
import { clamp, dist2, rndRange } from "@shared/math.js";
import { ioSnapshot } from "./loop.js";
import { removeBot } from "./systems/bots.js";
import type { PowerupChoice, PowerupFamily, AltFireType } from "@shared/types.js";

export const addPlayer = (
  world: World,
  id: string,
  pos: { x: number; y: number },
  socketId: string,
): Player => {
  const p: Player = {
    id,
    socketId,
    name: "Anon",
    x: pos.x,
    y: pos.y,
    vx: 0,
    vy: 0,
    r: PLAYER.radius,
    hp: PLAYER.baseHP,
    maxHp: PLAYER.baseHP,
    accel: PLAYER.baseAccel,
    maxSpeed: PLAYER.baseMaxSpeed,
    damage: BULLET.baseDamage,
    fireCooldownMs: BULLET.cooldownMs,
    lastFireAt: 0,
    shield: 0,
    magnetRadius: PICKUPS.magnetBaseRadius,
    xp: 0,
    level: 1,
    xpToNext: xpForLevel(2),
    pendingOffer: false,
    invulnUntil: 0,
    inputQueue: [],
    lastAckSeq: 0,
    score: 0,
    mass: 0,
    // Initialize all powerups at level 0 (no upgrades)
    powerupLevels: {
      Hull: 0,
      Damage: 0,
      Engine: 0,
      FireRate: 0,
      Magnet: 0,
      Shield: 0,
    },
  };
  world.players.set(id, p);
  return p;
};

export const removePlayer = (world: World, id: string) => {
  world.players.delete(id);
  removeBot(id); // Clean up bot data if this was a bot
};

export const setPlayerName = (world: World, id: string, name: string) => {
  const p = world.players.get(id);
  if (p) p.name = name;
};

export const queueInput = (
  world: World,
  id: string,
  frame: {
    seq: number;
    aim: number;
    thrust: { x: number; y: number };
    fire: boolean;
    dtMs: number;
  },
) => {
  const p = world.players.get(id);
  if (!p) return;
  p.inputQueue.push(frame);
};

export const processInputs = (world: World, now: number) => {
  for (const p of world.players.values()) {
    while (p.inputQueue.length) {
      const f = p.inputQueue.shift()!;
      // thrust towards pointer direction scaled by accel
      // Make movement more floaty: reduce acceleration
      const floatyAccel = p.accel * 0.6;
      p.vx += clamp(f.thrust.x, -1, 1) * floatyAccel * (f.dtMs / 1000);
      p.vy += clamp(f.thrust.y, -1, 1) * floatyAccel * (f.dtMs / 1000);
      const spd = Math.hypot(p.vx, p.vy);
      if (spd > p.maxSpeed) {
        const s = p.maxSpeed / (spd || 1);
        p.vx *= s;
        p.vy *= s;
      }
      if (f.fire) tryFire(world, p, f.aim, now);
      p.lastAckSeq = Math.max(p.lastAckSeq, f.seq);
    }
  }
};

export const xpForLevel = (level: number) => Math.floor(POWERUPS.xpBase * Math.pow(level, 1.4));

export const levelUp = (world: World, playerId: string) => {
  const player = world.players.get(playerId);
  if (!player) return;

  // Force level up by setting XP to next level requirement
  player.xp = player.xpToNext;
  player.level++;
  player.xp = 0; // Reset XP for next level
  player.xpToNext = xpForLevel(player.level + 1);
  player.pendingOffer = true;
  sendOffer(world, player);
};

export const giveXP = (world: World, p: Player, value: number) => {
  p.xp += value;
  p.score += value;
  while (p.xp >= p.xpToNext) {
    p.level++;
    p.xp -= p.xpToNext;
    p.xpToNext = xpForLevel(p.level + 1);
    p.pendingOffer = true;
    sendOffer(world, p);
  }
};

const sendOffer = (world: World, p: Player) => {
  const choices = rollChoices(p);
  const socket = world.io?.sockets.sockets.get(p.socketId);
  socket?.emit("event", { type: "LevelUpOffer", choices });
};

export const applyLevelChoice = (
  world: World,
  id: string,
  choice: { family: PowerupFamily | "AltFire"; tier?: number; alt?: AltFireType }
) => {
  const p = world.players.get(id);
  if (!p || !p.pendingOffer) return;

  if (choice.family === "AltFire" && p.level >= 10 && choice.alt) {
    p.altFire = choice.alt;
  } else if (choice.family === "Hull" && choice.tier) {
    // Check if Hull is already at max level (5)
    if (p.powerupLevels.Hull < 5) {
      p.powerupLevels.Hull++;
      p.maxHp += 20;
      p.hp = Math.min(p.maxHp, p.hp + 20);
    }
  } else if (choice.family === "Damage" && choice.tier) {
    if (p.powerupLevels.Damage < 5) {
      p.powerupLevels.Damage++;
      p.damage += 4;
    }
  } else if (choice.family === "Engine" && choice.tier) {
    if (p.powerupLevels.Engine < 5) {
      p.powerupLevels.Engine++;
      p.maxSpeed += 40;
      p.accel += 80;
    }
  } else if (choice.family === "FireRate" && choice.tier) {
    if (p.powerupLevels.FireRate < 5) {
      p.powerupLevels.FireRate++;
      p.fireCooldownMs = Math.max(80, p.fireCooldownMs - 25);
    }
  } else if (choice.family === "Magnet" && choice.tier) {
    if (p.powerupLevels.Magnet < 5) {
      p.powerupLevels.Magnet++;
      p.magnetRadius += 30;
    }
  } else if (choice.family === "Shield" && choice.tier) {
    if (p.powerupLevels.Shield < 5) {
      p.powerupLevels.Shield++;
      p.shield += 10;
      p.hp = Math.min(p.maxHp + p.shield, p.hp + 10);
    }
  }

  p.pendingOffer = false;
  const socket = world.io?.sockets.sockets.get(p.socketId);
  socket?.emit("event", {
    type: "LevelUpApplied",
    updated: {
      level: p.level,
      xp: p.xp,
      xpToNext: p.xpToNext,
      maxHp: p.maxHp,
      damage: p.damage,
      accel: p.accel,
      maxSpeed: p.maxSpeed,
      fireCooldownMs: p.fireCooldownMs,
      magnetRadius: p.magnetRadius,
      shield: p.shield,
      altFire: p.altFire,
      powerupLevels: p.powerupLevels,
    },
  });
};

const rollChoices = (p: Player): PowerupChoice[] => {
  const arr: PowerupChoice[] = [];

  // Create pool of available powerups that aren't at max level
  const pool: PowerupChoice[] = [];

  // Only add powerups that aren't at max level (5)
  if (p.powerupLevels.Hull < 5) {
    const nextLevel = p.powerupLevels.Hull + 1;
    pool.push({
      family: "Hull" as const,
      tier: nextLevel,
      label: `Hull Lv${nextLevel}`,
      desc: "+20 Max HP",
    });
  }

  if (p.powerupLevels.Damage < 5) {
    const nextLevel = p.powerupLevels.Damage + 1;
    pool.push({
      family: "Damage" as const,
      tier: nextLevel,
      label: `Damage Lv${nextLevel}`,
      desc: "+4 Damage",
    });
  }

  if (p.powerupLevels.Engine < 5) {
    const nextLevel = p.powerupLevels.Engine + 1;
    pool.push({
      family: "Engine" as const,
      tier: nextLevel,
      label: `Engine Lv${nextLevel}`,
      desc: "+Speed/Accel",
    });
  }

  if (p.powerupLevels.FireRate < 5) {
    const nextLevel = p.powerupLevels.FireRate + 1;
    pool.push({
      family: "FireRate" as const,
      tier: nextLevel,
      label: `Fire Rate Lv${nextLevel}`,
      desc: "-25ms Cooldown",
    });
  }

  if (p.powerupLevels.Magnet < 5) {
    const nextLevel = p.powerupLevels.Magnet + 1;
    pool.push({
      family: "Magnet" as const,
      tier: nextLevel,
      label: `Magnet Lv${nextLevel}`,
      desc: "+30 Pickup Radius",
    });
  }

  if (p.powerupLevels.Shield < 5) {
    const nextLevel = p.powerupLevels.Shield + 1;
    pool.push({
      family: "Shield" as const,
      tier: nextLevel,
      label: `Shield Lv${nextLevel}`,
      desc: "+10 Shield/HP",
    });
  }

  // Select up to 3 different powerup families
  while (arr.length < 3 && pool.length > 0) {
    const randomIndex = Math.floor(Math.random() * pool.length);
    const pick = pool[randomIndex];

    // Check if we already have this family in our selection
    if (!arr.find((c) => c.family === pick.family)) {
      arr.push(pick);
    }

    // Remove the picked item from pool to avoid duplicates
    pool.splice(randomIndex, 1);
  }

  // Add AltFire option if eligible and we have space
  if (p.level >= 10 && !p.altFire && arr.length < 3) {
    arr.push({
      family: "AltFire" as const,
      alt: Math.random() < 0.5 ? "railgun" : "spread",
      label: "Alt Fire",
      desc: "Unlock special weapon",
    });
  }

  return arr;
};

export const tryFire = (world: World, p: Player, aim: number, now: number) => {
  if (now - p.lastFireAt < p.fireCooldownMs) return;

  const cos = Math.cos(aim);
  const sin = Math.sin(aim);

  const fireBullet = (
    speed: number,
    damage: number,
    radius: number,
    ttl: number,
    angleOffset = 0,
    pierce = false,
  ) => {
    const id = nanoid();
    const vx = Math.cos(aim + angleOffset) * speed;
    const vy = Math.sin(aim + angleOffset) * speed;
    const muzzleDist = p.r + radius - 50; // spawn at ship nose
    const b: Bullet = {
      id,
      ownerId: p.id,
      x: p.x + Math.cos(aim + angleOffset) * muzzleDist,
      y: p.y + Math.sin(aim + angleOffset) * muzzleDist,
      vx,
      vy,
      r: radius,
      damage,
      ttl,
      pierce,
    };
    world.bullets.set(id, b);
  };

  if (p.altFire === "railgun") {
    fireBullet(
      ALT_FIRE.railgun.speed,
      ALT_FIRE.railgun.damage,
      ALT_FIRE.railgun.radius,
      ALT_FIRE.railgun.lifetimeMs,
      0,
      true,
    );
    p.lastFireAt = now - 0 + ALT_FIRE.railgun.cooldownMs;
    return;
  }
  if (p.altFire === "spread") {
    const s = (ALT_FIRE.spread.spreadDeg * Math.PI) / 180;
    const base = -s;
    for (let i = 0; i < ALT_FIRE.spread.pellets; i++) {
      const off = base + (s * i * 2) / (ALT_FIRE.spread.pellets - 1);
      fireBullet(
        ALT_FIRE.spread.speed,
        ALT_FIRE.spread.damage,
        ALT_FIRE.spread.radius,
        ALT_FIRE.spread.lifetimeMs,
        off,
        false,
      );
    }
    p.lastFireAt = now - 0 + ALT_FIRE.spread.cooldownMs;
    return;
  }

  // primary
  fireBullet(BULLET.speed, p.damage, BULLET.radius, BULLET.lifetimeMs, 0, false);
  p.lastFireAt = now;
};

export const moveAndClamp = (p: Player, dt: number) => {
  // Apply friction/damping for floaty feel
  const damping = 0.98;
  p.vx *= damping;
  p.vy *= damping;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  if (p.x < 0 + p.r) {
    p.x = p.r;
    p.vx = 0;
  }
  if (p.y < 0 + p.r) {
    p.y = p.r;
    p.vy = 0;
  }
  if (p.x > WORLD.w - p.r) {
    p.x = WORLD.w - p.r;
    p.vx = 0;
  }
  if (p.y > WORLD.h - p.r) {
    p.y = WORLD.h - p.r;
    p.vy = 0;
  }
};

export const spawnPickupsIfNeeded = (world: World) => {
  // Add a timer property to world if not present
  if (!("pickupSpawnTimer" in world)) {
    (world as any).pickupSpawnTimer = 0;
  }
  (world as any).pickupSpawnTimer += 1 / TICK_HZ;
  // Spawn a pickup every 0.5 seconds if under target count
  if (world.pickups.size < PICKUPS.targetCount && (world as any).pickupSpawnTimer >= 0.5) {
    (world as any).pickupSpawnTimer = 0;
    const id = nanoid();
    const type = Math.random() < PICKUPS.hpOrbChance ? "hp" : "xp";
    const value =
      type === "hp"
        ? PICKUPS.hpOrbValue
        : Math.floor(rndRange(PICKUPS.xpValueRange[0], PICKUPS.xpValueRange[1]));
    const p: Pickup = {
      id,
      type,
      x: rndRange(40, WORLD.w - 40),
      y: rndRange(40, WORLD.h - 40),
      r: 10,
      value,
    };
    world.pickups.set(id, p);
  }
};

export const collectPickups = (world: World) => {
  for (const p of world.players.values()) {
    for (const k of world.pickups.keys()) {
      const pu = world.pickups.get(k)!;
      // magnet
      const d2 = dist2({ x: p.x, y: p.y }, { x: pu.x, y: pu.y });
      const mr = p.magnetRadius;
      if (d2 < mr * mr) {
        const d = Math.sqrt(d2) || 1;
        const dirx = (p.x - pu.x) / d;
        const diry = (p.y - pu.y) / d;
        pu.x += dirx * 200 * (1 / Math.max(0.2, d / mr)) * (1 / 30);
        pu.y += diry * 200 * (1 / Math.max(0.2, d / mr)) * (1 / 30);
      }
      // collect
      const rad = p.r + pu.r;
      if (d2 < rad * rad) {
        world.pickups.delete(k);
        if (pu.type === "xp") giveXP(world, p, pu.value);
        else p.hp = Math.min(p.maxHp + p.shield, p.hp + pu.value);
        const sock = world.io?.sockets.sockets.get(p.socketId);
        sock?.emit("event", {
          type: "Pickup",
          playerId: p.id,
          pickupId: pu.id,
          value: pu.value,
          kind: pu.type,
        });
      }
    }
  }
};
