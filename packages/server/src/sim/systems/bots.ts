import { nanoid } from "nanoid";
import type { World, Player } from "../world.js";
import { addPlayer, queueInput } from "../entities.js";
import { randSafeSpawn } from "../world.js";
import { rndRange } from "@shared/math.js";

const BOT_NAMES = [
  "Alpha Bot",
  "Beta Drone",
  "Gamma AI",
  "Delta Unit",
  "Echo Bot",
  "Foxtrot AI",
  "Golf Drone",
  "Hotel Unit",
  "India Bot",
  "Juliet AI",
];

export type Bot = {
  playerId: string;
  target?: { x: number; y: number };
  lastThinkAt: number;
  aggressiveness: number; // 0-1, how likely to seek players vs pickups
  aimOffset: number; // aim error in radians
};

const bots = new Map<string, Bot>();

export const spawnBot = (world: World): void => {
  if (world.players.size >= 20) return; // Don't spam too many bots

  const botId = nanoid();
  const spawn = randSafeSpawn(world);

  // Use empty socketId for bots - they don't have real sockets
  const player = addPlayer(world, botId, spawn, "");

  // Give bot a random name
  const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
  player.name = botName;

  const bot: Bot = {
    playerId: botId,
    lastThinkAt: 0,
    aggressiveness: Math.random() * 0.8 + 0.2, // 0.2 to 1.0
    aimOffset: (Math.random() - 0.5) * 0.3, // -0.15 to 0.15 radians
  };

  bots.set(botId, bot);
  console.log(`[bots] spawned bot: ${botName}`);
};

export const updateBots = (world: World, now: number): void => {
  const THINK_INTERVAL = 200; // ms between AI decisions

  for (const [botId, bot] of bots) {
    const player = world.players.get(botId);
    if (!player) {
      bots.delete(botId);
      continue;
    }

    // Skip if bot is dead
    if (player.deadUntil && now < player.deadUntil) continue;

    // AI thinking interval
    if (now - bot.lastThinkAt < THINK_INTERVAL) continue;
    bot.lastThinkAt = now;

    // Find targets
    const nearbyPlayers = Array.from(world.players.values())
      .filter(p => p.id !== botId && (!p.deadUntil || now >= p.deadUntil))
      .map(p => ({
        player: p,
        dist: Math.hypot(p.x - player.x, p.y - player.y)
      }))
      .filter(({ dist }) => dist < 400) // Only consider nearby players
      .sort((a, b) => a.dist - b.dist);

    const nearbyPickups = Array.from(world.pickups.values())
      .map(p => ({
        pickup: p,
        dist: Math.hypot(p.x - player.x, p.y - player.y)
      }))
      .filter(({ dist }) => dist < 300)
      .sort((a, b) => a.dist - b.dist);

    // Decide target based on aggressiveness and what's available
    let targetX = player.x;
    let targetY = player.y;
    let shouldFire = false;

    if (nearbyPlayers.length > 0 && Math.random() < bot.aggressiveness) {
      // Target nearest player
      const target = nearbyPlayers[0].player;
      targetX = target.x;
      targetY = target.y;
      shouldFire = nearbyPlayers[0].dist < 200; // Fire if close enough
    } else if (nearbyPickups.length > 0) {
      // Target nearest pickup
      const target = nearbyPickups[0].pickup;
      targetX = target.x;
      targetY = target.y;
    } else {
      // Wander towards center or random direction
      const centerX = world.w / 2;
      const centerY = world.h / 2;
      const toCenterDist = Math.hypot(centerX - player.x, centerY - player.y);

      if (toCenterDist > 300) {
        targetX = centerX + rndRange(-200, 200);
        targetY = centerY + rndRange(-200, 200);
      } else {
        targetX = player.x + rndRange(-200, 200);
        targetY = player.y + rndRange(-200, 200);
      }
    }

    // Clamp target to world bounds with margin
    targetX = Math.max(50, Math.min(world.w - 50, targetX));
    targetY = Math.max(50, Math.min(world.h - 50, targetY));

    // Calculate aim and thrust
    const dx = targetX - player.x;
    const dy = targetY - player.y;
    const dist = Math.hypot(dx, dy);

    let aim = Math.atan2(dy, dx) + bot.aimOffset;
    let thrust = { x: 0, y: 0 };

    // Only thrust if target is far enough away
    if (dist > 30) {
      thrust.x = dx / dist;
      thrust.y = dy / dist;
    }

    // Generate bot input
    const input = {
      id: botId,
      seq: Math.floor(now / 25), // Simple sequence based on time
      aim,
      thrust,
      fire: shouldFire,
      dtMs: THINK_INTERVAL,
    };

    queueInput(world, botId, input);
  }
};

export const removeBot = (botId: string): void => {
  bots.delete(botId);
};

export const getBotCount = (): number => {
  return bots.size;
};

export const cleanupBots = (world: World): void => {
  // Remove bots for players that no longer exist
  for (const botId of bots.keys()) {
    if (!world.players.has(botId)) {
      bots.delete(botId);
    }
  }
};
