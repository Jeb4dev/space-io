import { z } from "zod";
import type { AltFireType, EntityState, PickupState, PowerupChoice, ScoreEntry, WellState } from "./types";

export const V2Schema = z.object({ x: z.number(), y: z.number() });

export const ClientInputSchema = z.object({
  id: z.string(),
  seq: z.number().int().nonnegative(),
  aim: z.number(), // radians
  thrust: V2Schema,
  fire: z.boolean(),
  dtMs: z.number().positive()
});
export type ClientInput = z.infer<typeof ClientInputSchema>;

export const ClientJoinSchema = z.object({
  name: z.string().min(1).max(24)
});
export type ClientJoin = z.infer<typeof ClientJoinSchema>;

export const ServerWelcomeSchema = z.object({
  youId: z.string(),
  tickRate: z.number(),
  snapshotRate: z.number(),
  world: z.object({ w: z.number(), h: z.number() })
});
export type ServerWelcome = z.infer<typeof ServerWelcomeSchema>;

export const ServerSnapshotSchema = z.object({
  tick: z.number().int().nonnegative(),
  youId: z.string(),
  acks: z.object({ seq: z.number().int().nonnegative() }),
  entities: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(["player", "bullet", "pickup"]),
      x: z.number(),
      y: z.number(),
      vx: z.number(),
      vy: z.number(),
      r: z.number(),
      hp: z.number().optional(),
      maxHp: z.number().optional(),
      ownerId: z.string().optional()
    })
  ),
  pickups: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["xp", "hp"]),
      x: z.number(),
      y: z.number(),
      value: z.number()
    })
  ),
  wells: z.array(
    z.object({
      id: z.string(),
      x: z.number(),
      y: z.number(),
      mass: z.number(),
      radius: z.number(),
      influenceRadius: z.number(),
      type: z.enum(["planet", "sun", "blackhole"]),
      maxPull: z.number()
    })
  ),
  scoreboard: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      score: z.number(),
      level: z.number()
    })
  )
});
export type ServerSnapshot = z.infer<typeof ServerSnapshotSchema>;

export const ServerEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Kill"), killerId: z.string().nullable(), victimId: z.string() }),
  z.object({ type: z.literal("Pickup"), playerId: z.string(), pickupId: z.string(), value: z.number(), kind: z.enum(["xp", "hp"]) }),
  z.object({
    type: z.literal("LevelUpOffer"),
    choices: z.array(
      z.object({
        family: z.union([z.enum(["Hull", "Damage", "Engine", "FireRate", "Magnet", "Shield"]), z.literal("AltFire")]),
        tier: z.number().int().min(1).max(5).optional(),
        alt: z.enum(["railgun", "spread"]).optional(),
        label: z.string(),
        desc: z.string()
      })
    )
  }),
  z.object({
    type: z.literal("LevelUpApplied"),
    updated: z.object({
      level: z.number().int(),
      xp: z.number(),
      xpToNext: z.number(),
      maxHp: z.number(),
      damage: z.number(),
      accel: z.number(),
      maxSpeed: z.number(),
      fireCooldownMs: z.number(),
      magnetRadius: z.number(),
      shield: z.number(),
      altFire: z.enum(["railgun", "spread"]).optional()
    })
  })
]);
export type ServerEvent = z.infer<typeof ServerEventSchema>;

export const LevelChoiceSchema = z.object({
  chosen: z.object({
    family: z.union([z.enum(["Hull", "Damage", "Engine", "FireRate", "Magnet", "Shield"]), z.literal("AltFire")]),
    tier: z.number().int().min(1).max(5).optional(),
    alt: z.enum(["railgun", "spread"]).optional()
  })
});
export type LevelChoice = z.infer<typeof LevelChoiceSchema>;

// Re-exports for consumers
export type {
  EntityState,
  PickupState,
  WellState,
  ScoreEntry,
  PowerupChoice,
  AltFireType
};

