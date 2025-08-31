import type { World, Player } from "../world.js";
import { randEdgeSpawn } from "../world.js";
import { PLAYER, BULLET, PICKUPS } from "@shared/constants.js";
import { xpForLevel } from "../entities.js";
import { spawnDeathPickups } from "./deathDrops.js";

export const handleDeathsAndRespawn = (world: World, now: number) => {
  for (const p of world.players.values()) {
    if (p.hp > 0) continue;
    // Safety: if deadUntil not set (some death path missed), set & spawn drops now
    if (!p.deadUntil) {
      spawnDeathPickups(world, p);
      p.deadUntil = now + PLAYER.respawnDelayMs;
    }
    if (!p.deadUntil) p.deadUntil = now + PLAYER.respawnDelayMs;
    if (now >= p.deadUntil) {
      const pos = randEdgeSpawn(world);
      p.x = pos.x;
      p.y = pos.y;
      p.vx = 0;
      p.vy = 0;
      // Base respawn stats
      p.hp = PLAYER.baseHP;
      p.invulnUntil = now + PLAYER.invulnMs;
      p.deadUntil = undefined;

      // If this is a bot (no socket), reset all progression so bots don't snowball
      if (!p.socketId) {
        p.level = 1;
        p.xp = 0;
        p.xpToNext = xpForLevel(2);
        p.score = 0;
        p.pendingOffer = false;
        p.altFire = undefined;
        p.powerupLevels = { Hull: 0, Damage: 0, Engine: 0, FireRate: 0, Magnet: 0, Radar: 0 };
        // Reset derived stats
        p.maxHp = PLAYER.baseHP;
        p.damage = BULLET.baseDamage;
        p.accel = PLAYER.baseAccel;
        p.maxSpeed = PLAYER.baseMaxSpeed;
        p.fireCooldownMs = BULLET.cooldownMs;
        p.magnetRadius = PICKUPS.magnetBaseRadius;
        p.shield = 0;
      }
    }
  }
};
