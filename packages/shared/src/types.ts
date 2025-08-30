export type V2 = { x: number; y: number };

export type EntityKind = "player" | "bullet" | "pickup";

export type WellType = "planet" | "sun" | "blackhole";

export type PickupType = "xp" | "hp";

export type AltFireType = "railgun" | "spread";

export type PowerupFamily = "Hull" | "Damage" | "Engine" | "FireRate" | "Magnet" | "Shield";

export type PowerupChoice = {
  family: PowerupFamily | "AltFire";
  tier?: number; // 1..5 for normal families
  alt?: AltFireType;
  label: string;
  desc: string;
};

export type PlayerStats = {
  level: number;
  xp: number;
  xpToNext: number;
  maxHp: number;
  damage: number;
  accel: number;
  maxSpeed: number;
  fireCooldownMs: number;
  magnetRadius: number;
  shield: number; // simple flat extra hp/regen placeholder
  altFire?: AltFireType;
};

export type PlayerEntityState = {
  kind: "player";
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp?: number;
  maxHp?: number;
  xp: number;
  xpToNext: number;
  level: number;
};

export type BulletEntityState = {
  kind: "bullet";
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  ownerId?: string;
};

export type PickupEntityState = {
  kind: "pickup";
  id: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  r?: number;
};

export type EntityState = PlayerEntityState | BulletEntityState | PickupEntityState;

export type PickupState = {
  id: string;
  type: PickupType;
  x: number;
  y: number;
  value: number;
};

export type WellState = {
  id: string;
  x: number;
  y: number;
  mass: number;
  radius: number;
  influenceRadius: number;
  type: WellType;
  maxPull: number;
};

export type ScoreEntry = {
  id: string;
  name: string;
  score: number;
  level: number;
};
