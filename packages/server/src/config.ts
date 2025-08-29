import "dotenv/config";
import { TICK_HZ, SNAPSHOT_HZ, ROOM } from "@shared/constants";

const n = (v: string | undefined, fallback: number) => {
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  port: n(process.env.PORT, 8080),
  tickHz: n(process.env.TICK_HZ, TICK_HZ),
  snapshotHz: n(process.env.SNAPSHOT_HZ, SNAPSHOT_HZ),
  roomCap: n(process.env.ROOM_CAP, ROOM.cap),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  botsEnabled: (process.env.BOTS_ENABLED ?? "false").toLowerCase() === "true",
  publicUrl: process.env.PUBLIC_URL ?? "http://localhost:8080"
} as const;

