import type { World, Player } from "../world";
import { randEdgeSpawn } from "../world";
import { PLAYER } from "@shared/constants";

export const handleDeathsAndRespawn = (world: World, now: number) => {
  for (const p of world.players.values()) {
    if (p.hp > 0) continue;
    if (!p.deadUntil) p.deadUntil = now + 500;
    if (now >= p.deadUntil) {
      const pos = randEdgeSpawn(world);
      p.x = pos.x; p.y = pos.y;
      p.vx = 0; p.vy = 0;
      p.hp = PLAYER.baseHP;
      p.invulnUntil = now + PLAYER.invulnMs;
      p.deadUntil = undefined;
    }
  }
};

