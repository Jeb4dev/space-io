import { nanoid } from "nanoid";
import { WORLD, PLAYER, BULLET, PICKUPS, POWERUPS, ALT_FIRE } from "@shared/constants";
import type { World, Player, Bullet, Pickup } from "./world";
import { clamp, dist2, rndRange } from "@shared/math";
import { ioSnapshot } from "./loop";
import type { PowerupChoice } from "@shared/types";

export const addPlayer = (world: World, id: string, pos: { x: number; y: number }, socketId: string): Player => {
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
    score: 0
  };
  world.players.set(id, p);
  return p;
};

export const removePlayer = (world: World, id: string) => {
  world.players.delete(id);
};

export const setPlayerName = (world: World, id: string, name: string) => {
  const p = world.players.get(id);
  if (p) p.name = name;
};

export const queueInput = (
  world: World,
  id: string,
  frame: { seq: number; aim: number; thrust: { x: number; y: number }; fire: boolean; dtMs: number }
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
      p.vx += clamp(f.thrust.x, -1, 1) * p.accel * (f.dtMs / 1000);
      p.vy += clamp(f.thrust.y, -1, 1) * p.accel * (f.dtMs / 1000);
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

export const applyLevelChoice = (world: World, id: string, choice: PowerupChoice) => {
  const p = world.players.get(id);
  if (!p || !p.pendingOffer) return;
  if (choice.family === "AltFire" && p.level >= 10 && choice.alt) {
    p.altFire = choice.alt;
  } else if (choice.family === "Hull" && choice.tier) {
    p.maxHp += 20;
    p.hp = Math.min(p.maxHp, p.hp + 20);
  } else if (choice.family === "Damage" && choice.tier) {
    p.damage += 4;
  } else if (choice.family === "Engine" && choice.tier) {
    p.maxSpeed += 40;
    p.accel += 80;
  } else if (choice.family === "FireRate" && choice.tier) {
    p.fireCooldownMs = Math.max(80, p.fireCooldownMs - 25);
  } else if (choice.family === "Magnet" && choice.tier) {
    p.magnetRadius += 30;
  } else if (choice.family === "Shield" && choice.tier) {
    p.shield += 10;
    p.hp = Math.min(p.maxHp + p.shield, p.hp + 10);
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
      altFire: p.altFire
    }
  });
};

const rollChoices = (p: Player): PowerupChoice[] => {
  const arr: PowerupChoice[] = [];
  const families = [...(Array.from({ length: POWERUPS.tiers }).keys())].map((i) => i + 1);
  const pool: PowerupChoice[] = [
    ...families.map((tier) => ({ family: "Hull", tier, label: `Hull T${tier}`, desc: "+20 Max HP" })),
    ...families.map((tier) => ({ family: "Damage", tier, label: `Damage T${tier}`, desc: "+4 Damage" })),
    ...families.map((tier) => ({ family: "Engine", tier, label: `Engine T${tier}`, desc: "+Speed/Accel" })),
    ...families.map((tier) => ({ family: "FireRate", tier, label: `Fire Rate T${tier}`, desc: "-Cooldown" })),
    ...families.map((tier) => ({ family: "Magnet", tier, label: `Magnet T${tier}`, desc: "+Pickup Radius" })),
    ...families.map((tier) => ({ family: "Shield", tier, label: `Shield T${tier}`, desc: "+Shield/HP" }))
  ];
  while (arr.length < 3) {
    // weight: prefer non-repeated families lightly
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!arr.find((c) => c.family === pick.family)) arr.push(pick);
  }
  if (p.level >= 10 && !p.altFire) {
    // replace one with alt-fire choice
    const idx = Math.floor(Math.random() * 3);
    arr[idx] = { family: "AltFire", alt: Math.random() < 0.5 ? "railgun" : "spread", label: "Alt Fire", desc: "Unlock special weapon" };
  }
  return arr;
};

export const tryFire = (world: World, p: Player, aim: number, now: number) => {
  if (now - p.lastFireAt < p.fireCooldownMs) return;

  const cos = Math.cos(aim);
  const sin = Math.sin(aim);

  const fireBullet = (speed: number, damage: number, radius: number, ttl: number, angleOffset = 0, pierce = false) => {
    const id = nanoid();
    const vx = Math.cos(aim + angleOffset) * speed;
    const vy = Math.sin(aim + angleOffset) * speed;
    const b: Bullet = {
      id,
      ownerId: p.id,
      x: p.x + cos * (p.r + 8),
      y: p.y + sin * (p.r + 8),
      vx: vx + p.vx * 0.2,
      vy: vy + p.vy * 0.2,
      r: radius,
      damage,
      ttl,
      pierce
    };
    world.bullets.set(id, b);
  };

  if (p.altFire === "railgun") {
    fireBullet(ALT_FIRE.railgun.speed, ALT_FIRE.railgun.damage, ALT_FIRE.railgun.radius, ALT_FIRE.railgun.lifetimeMs, 0, true);
    p.lastFireAt = now - 0 + ALT_FIRE.railgun.cooldownMs;
    return;
  }
  if (p.altFire === "spread") {
    const s = (ALT_FIRE.spread.spreadDeg * Math.PI) / 180;
    const base = -s;
    for (let i = 0; i < ALT_FIRE.spread.pellets; i++) {
      const off = base + (s * i * 2) / (ALT_FIRE.spread.pellets - 1);
      fireBullet(ALT_FIRE.spread.speed, ALT_FIRE.spread.damage, ALT_FIRE.spread.radius, ALT_FIRE.spread.lifetimeMs, off, false);
    }
    p.lastFireAt = now - 0 + ALT_FIRE.spread.cooldownMs;
    return;
  }

  // primary
  fireBullet(BULLET.speed, p.damage, BULLET.radius, BULLET.lifetimeMs, 0, false);
  p.lastFireAt = now;
};

export const moveAndClamp = (p: Player, dt: number) => {
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  if (p.x < 0 + p.r) { p.x = p.r; p.vx = 0; }
  if (p.y < 0 + p.r) { p.y = p.r; p.vy = 0; }
  if (p.x > WORLD.w - p.r) { p.x = WORLD.w - p.r; p.vx = 0; }
  if (p.y > WORLD.h - p.r) { p.y = WORLD.h - p.r; p.vy = 0; }
};

export const spawnPickupsIfNeeded = (world: World) => {
  while (world.pickups.size < PICKUPS.targetCount) {
    const id = nanoid();
    const type = Math.random() < PICKUPS.hpOrbChance ? "hp" : "xp";
    const value = type === "hp" ? PICKUPS.hpOrbValue : Math.floor(rndRange(...PICKUPS.xpValueRange));
    const p: Pickup = { id, type, x: rndRange(40, WORLD.w - 40), y: rndRange(40, WORLD.h - 40), r: 10, value };
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
        sock?.emit("event", { type: "Pickup", playerId: p.id, pickupId: pu.id, value: pu.value, kind: pu.type });
      }
    }
  }
};

