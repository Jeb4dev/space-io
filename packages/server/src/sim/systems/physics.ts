import type { World, Player, Bullet } from "../world.js";
import { GRAVITY } from "@shared/constants.js";
import { clamp, dist2 } from "@shared/math.js";
import { spawnDeathPickups } from "./deathDrops.js";

export const applyGravity = (world: World, dt: number) => {
  for (const p of world.players.values()) {
    for (const w of world.wells) {
      const dx = w.x - p.x;
      const dy = w.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > w.influenceRadius * w.influenceRadius) continue;
      const force = Math.min((GRAVITY.G * w.mass) / (d2 + GRAVITY.epsilon), w.maxPull);
      const d = Math.sqrt(d2) || 1;
      const ax = (dx / d) * (force / Math.max(1, p.mass));
      const ay = (dy / d) * (force / Math.max(1, p.mass));
      p.vx += ax * dt;
      p.vy += ay * dt;

      // heat / edge damage cones
      if (w.type === "sun" && d < w.radius + 60) {
        const prevHp = p.hp;
        p.hp -= GRAVITY.sunHeatDps * dt;
        if (prevHp > 0 && p.hp <= 0) {
          p.deadUntil = Date.now() + 500;
          world.io?.emit("event", {
            type: "Kill",
            killerId: null, // Environmental death
            victimId: p.id,
            x: p.x,
            y: p.y,
          });
          spawnDeathPickups(world, p);
        }
      }
      if (w.type === "blackhole" && d < w.radius + 40) {
        const prevHp = p.hp;
        p.hp -= GRAVITY.blackHoleEdgeDps * dt;
        if (prevHp > 0 && p.hp <= 0) {
          p.deadUntil = Date.now() + 500;
          world.io?.emit("event", {
            type: "Kill",
            killerId: null, // Environmental death
            victimId: p.id,
            x: p.x,
            y: p.y,
          });
          spawnDeathPickups(world, p);
        }
      }
      if (w.type === "planet" && d < w.radius + p.r + 30) { // Increased collision radius by 30
        // Apply collision damage based on impact speed
        const impactSpeed = Math.hypot(p.vx, p.vy);
        const damageThreshold = 80; // Minimum speed to cause damage
        const prevHp = p.hp;
        
        if (impactSpeed > damageThreshold) {
          const baseDamage = 15;
          const speedMultiplier = Math.min(2.5, impactSpeed / 150); // Cap damage multiplier
          const damage = baseDamage * speedMultiplier;
          p.hp -= damage;
          
          // Check for death
          if (prevHp > 0 && p.hp <= 0) {
            p.deadUntil = Date.now() + 500;
            world.io?.emit("event", {
              type: "Kill",
              killerId: null, // Environmental death
              victimId: p.id,
              x: p.x,
              y: p.y,
            });
            spawnDeathPickups(world, p);
          }
        }
        
        // hard collision bounce
        const nx = dx / d,
          ny = dy / d;
        const vDotN = p.vx * nx + p.vy * ny;
        if (vDotN > 0) continue;
        p.vx -= 1.8 * vDotN * nx;
        p.vy -= 1.8 * vDotN * ny;
        // clip outside (using the larger collision radius)
        p.x = w.x - nx * (w.radius + p.r + 30 + 1);
        p.y = w.y - ny * (w.radius + p.r + 30 + 1);
      }
    }
  }
  for (const b of world.bullets.values()) {
    for (const w of world.wells) {
      const dx = w.x - b.x;
      const dy = w.y - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > w.influenceRadius * w.influenceRadius) continue;
      const force = Math.min((GRAVITY.G * w.mass) / (d2 + GRAVITY.epsilon), w.maxPull);
      const d = Math.sqrt(d2) || 1;
      const ax = (dx / d) * force * 0.2;
      const ay = (dy / d) * force * 0.2;
      b.vx += ax * dt;
      b.vy += ay * dt;
    }
  }
};

export const integrate = (world: World, dt: number) => {
  for (const p of world.players.values()) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    // World edge bounce
    const bounceRestitution = 0.9; // energy retained (1 = perfect, <1 loses speed)
    const minBounceSpeed = 140; // ensure a noticeable kick away
    // Left
    if (p.x < p.r) {
      p.x = p.r;
      const speed = Math.max(minBounceSpeed, Math.abs(p.vx) * bounceRestitution);
      p.vx = speed; // push right
    }
    // Right
    if (p.x > world.w - p.r) {
      p.x = world.w - p.r;
      const speed = Math.max(minBounceSpeed, Math.abs(p.vx) * bounceRestitution);
      p.vx = -speed; // push left
    }
    // Top
    if (p.y < p.r) {
      p.y = p.r;
      const speed = Math.max(minBounceSpeed, Math.abs(p.vy) * bounceRestitution);
      p.vy = speed; // push down
    }
    // Bottom
    if (p.y > world.h - p.r) {
      p.y = world.h - p.r;
      const speed = Math.max(minBounceSpeed, Math.abs(p.vy) * bounceRestitution);
      p.vy = -speed; // push up
    }
  }
  for (const b of world.bullets.values()) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
};

export const bulletHits = (world: World, dt: number, now: number) => {
  const toRemove: string[] = [];
  for (const b of world.bullets.values()) {
    b.ttl -= dt * 1000;
    if (b.ttl <= 0) {
      toRemove.push(b.id);
      continue;
    }
    for (const p of world.players.values()) {
      if (p.id === b.ownerId) continue;
      const r = p.r + b.r;
      if (dist2({ x: b.x, y: b.y }, { x: p.x, y: p.y }) < r * r) {
        if (now < p.invulnUntil) {
          toRemove.push(b.id);
          break;
        }
        p.hp -= b.damage;
        if (!b.pierce) toRemove.push(b.id);
        if (p.hp <= 0) {
          p.deadUntil = now + 500;
          // Emit kill event for explosion effect
          const socket = world.io?.sockets.sockets.get(p.socketId);
          if (socket) {
            world.io?.emit("event", {
              type: "Kill",
              killerId: b.ownerId,
              victimId: p.id,
              x: p.x,
              y: p.y,
            });
          }
          spawnDeathPickups(world, p);
        }
        break;
      }
    }
  }
  for (const id of toRemove) world.bullets.delete(id);
};
