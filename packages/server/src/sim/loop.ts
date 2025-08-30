import type { Server } from "socket.io";
import type { World } from "./world.js";
import { config } from "../config.js";
import { applyGravity, bulletHits, integrate } from "./systems/physics.js";
import { processInputs, moveAndClamp } from "./entities.js";
import { updatePickups } from "./systems/pickups.js";
import { handleDeathsAndRespawn } from "./systems/combat.js";
import { getScoreboard } from "./systems/scoreboard.js";
import { spawnBot, updateBots, cleanupBots, getBotCount } from "./systems/bots.js";
import { updatePlanetMovement } from "./systems/planetMovement.js";
import { handlePlayerCollisions } from "./systems/playerCollisions.js";
import { BULLET } from "@shared/constants.js";

let snapshotAccumulator = 0;
let botSpawnAccumulator = 0;

export const startLoop = (io: Server, world: World) => {
  world.io = io;
  const tickMs = 1000 / config.tickHz;
  let last = Date.now();

  setInterval(() => {
    const now = Date.now();
    const dt = Math.min(0.05, (now - last) / 1000); // safety cap
    last = now;

    world.tick++;

    // Bot management
    if (config.botsEnabled) {
      updateBots(world, now);
      cleanupBots(world);

      // Spawn bots periodically to maintain population
      botSpawnAccumulator += dt * 1000;
      if (botSpawnAccumulator >= 3000) {
        botSpawnAccumulator = 0;
        const humanPlayers = Array.from(world.players.values()).filter((p) => p.socketId !== "");
        const targetBotCount = Math.min(8, Math.max(2, humanPlayers.length * 2)); // 2x human players, max 8

        if (getBotCount() < targetBotCount) {
          spawnBot(world);
        }
      }
    }

    // Update planet positions for infinite scrolling effect
    updatePlanetMovement(world, dt);

    processInputs(world, now);
    applyGravity(world, dt);
    integrate(world, dt);
    handlePlayerCollisions(world, dt);
    bulletHits(world, dt, now);
    updatePickups(world);
    handleDeathsAndRespawn(world, now);

    // prune offscreen bullets (cheap)
    for (const [id, b] of world.bullets) {
      if (b.x < -100 || b.y < -100 || b.x > world.w + 100 || b.y > world.h + 100) {
        world.bullets.delete(id);
      }
    }

    snapshotAccumulator += dt * 1000;
    if (snapshotAccumulator >= 1000 / config.snapshotHz) {
      snapshotAccumulator = 0;
      ioSnapshot(io, world);
    }
  }, tickMs);
};

export const ioSnapshot = (io: Server, world: World) => {
  const snapshot = {
    tick: world.tick,
    acks: undefined as unknown as { seq: number }, // per-player fill
    youId: "", // per-player fill
    entities: [] as any[],
    pickups: Array.from(world.pickups.values()).map((p) => ({
      id: p.id,
      type: p.type,
      x: p.x,
      y: p.y,
      value: p.value,
    })),
    wells: world.wells.map((w) => ({ ...w })),
    scoreboard: getScoreboard(world),
  };

  // Only send snapshots to real players (those with socket connections)
  for (const p of world.players.values()) {
    if (!p.socketId) continue; // Skip bots - they don't have sockets

    const ents = [
      ...Array.from(world.players.values()).map((op) => ({
        id: op.id,
        kind: "player",
        x: op.x,
        y: op.y,
        vx: op.vx,
        vy: op.vy,
        r: op.r,
        hp: op.hp,
        maxHp: op.maxHp,
      })),
      ...Array.from(world.bullets.values()).map((b) => ({
        id: b.id,
        kind: "bullet",
        x: b.x,
        y: b.y,
        vx: b.vx,
        vy: b.vy,
        r: b.r,
        ownerId: b.ownerId,
      })),
    ];
    const sock = io.sockets.sockets.get(p.socketId);
    if (!sock) continue;
    sock.emit("snapshot", {
      ...snapshot,
      youId: p.id,
      entities: ents,
      acks: { seq: p.lastAckSeq },
    });
  }
};
