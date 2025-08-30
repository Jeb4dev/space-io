import { WORLD, GRAVITY, PICKUPS } from "@game/shared";
import type { WellState } from "@game/shared";
import type { Server } from "socket.io";
import { rndRange } from "@game/shared";

export type World = {
  w: number;
  h: number;
  tick: number;
  wells: WellState[];
  players: Map<string, Player>;
  bullets: Map<string, Bullet>;
  pickups: Map<string, Pickup>;
  io?: Server; // assigned in loop
};

export type Player = {
  mass: number;
  id: string;
  socketId: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  maxHp: number;
  accel: number;
  maxSpeed: number;
  damage: number;
  fireCooldownMs: number;
  lastFireAt: number;
  shield: number;
  magnetRadius: number;
  xp: number;
  level: number;
  xpToNext: number;
  pendingOffer?: boolean;
  invulnUntil: number;
  altFire?: "railgun" | "spread";
  inputQueue: Array<{
    seq: number;
    aim: number;
    thrust: { x: number; y: number };
    fire: boolean;
    dtMs: number;
  }>;
  lastAckSeq: number;
  deadUntil?: number;
  score: number;
};

export type Bullet = {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  damage: number;
  ttl: number;
  pierce: boolean;
};

export type Pickup = {
  id: string;
  type: "xp" | "hp";
  x: number;
  y: number;
  r: number;
  value: number;
};

export const createWorld = (): World => {
  // Initialize wells from GRAVITY.wells, handling empty array case
  const wells: WellState[] = GRAVITY.wells.map((w) => ({ ...w }));
  return {
    w: WORLD.w,
    h: WORLD.h,
    tick: 0,
    wells,
    players: new Map(),
    bullets: new Map(),
    pickups: new Map(),
  };
};

export const randEdgeSpawn = (world: World) => {
  const side = Math.floor(Math.random() * 4);
  if (side === 0) return { x: rndRange(0, world.w), y: 20 };
  if (side === 1) return { x: rndRange(0, world.w), y: world.h - 20 };
  if (side === 2) return { x: 20, y: rndRange(0, world.h) };
  return { x: world.w - 20, y: rndRange(0, world.h) };
};
