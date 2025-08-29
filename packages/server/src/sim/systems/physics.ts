import type { World, Player, Bullet } from "../world.js";
import { GRAVITY } from "@shared/constants.js";
import { clamp, dist2 } from "@shared/math.js";

export const applyGravity = (world: World, dt: number) => {
  for (const p of world.players.values()) {
    for (const w of world.wells) {
      const dx = w.x - p.x;
      const dy = w.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > w.influenceRadius * w.influenceRadius) continue;
      const force = Math.min(GRAVITY.G * w.mass / (d2 + GRAVITY.epsilon), w.maxPull);
      const d = Math.sqrt(d2) || 1;
      const ax = (dx / d) * (force / Math.max(1, p.mass));
      const ay = (dy / d) * (force / Math.max(1, p.mass));
      p.vx += ax * dt;
      p.vy += ay * dt;

      // heat / edge damage cones
      if (w.type === "sun" && d < w.radius + 60) p.hp -= GRAVITY.sunHeatDps * dt;
      if (w.type === "blackhole" && d < w.radius + 40) p.hp -= GRAVITY.blackHoleEdgeDps * dt;
      if (w.type === "planet" && d < w.radius + p.r) {
        // hard collision bounce
        const nx = dx / d, ny = dy / d;
        const vDotN = p.vx * nx + p.vy * ny;
        if (vDotN > 0) continue;
        p.vx -= 1.8 * vDotN * nx;
        p.vy -= 1.8 * vDotN * ny;
        // clip outside
        p.x = w.x - nx * (w.radius + p.r + 1);
        p.y = w.y - ny * (w.radius + p.r + 1);
      }
    }
  }
  for (const b of world.bullets.values()) {
    for (const w of world.wells) {
      const dx = w.x - b.x;
      const dy = w.y - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > w.influenceRadius * w.influenceRadius) continue;
      const force = Math.min(GRAVITY.G * w.mass / (d2 + GRAVITY.epsilon), w.maxPull);
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
    // world bounds
    if (p.x < p.r) { p.x = p.r; p.vx = 0; }
    if (p.y < p.r) { p.y = p.r; p.vy = 0; }
    if (p.x > world.w - p.r) { p.x = world.w - p.r; p.vx = 0; }
    if (p.y > world.h - p.r) { p.y = world.h - p.r; p.vy = 0; }
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
    if (b.ttl <= 0) { toRemove.push(b.id); continue; }
    for (const p of world.players.values()) {
      if (p.id === b.ownerId) continue;
      const r = p.r + b.r;
      if (dist2({ x: b.x, y: b.y }, { x: p.x, y: p.y }) < r * r) {
        if (now < p.invulnUntil) { toRemove.push(b.id); break; }
        p.hp -= b.damage;
        if (!b.pierce) toRemove.push(b.id);
        if (p.hp <= 0) {
          p.deadUntil = now + 500;
        }
        break;
      }
    }
  }
  for (const id of toRemove) world.bullets.delete(id);
};
