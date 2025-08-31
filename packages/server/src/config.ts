// src/config.ts
import "dotenv/config";
import { TICK_HZ, SNAPSHOT_HZ, ROOM } from "@shared/constants.js";

const n = (v: string | undefined, fallback: number) => {
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseOrigins = (v: string | undefined, fallback: string[]) => {
  if (!v) return fallback;
  return v
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
};

export const config = {
  host: process.env.HOST ?? "0.0.0.0",
  // default to 8080 to align with nginx proxy_pass 127.0.0.1:8080
  port: n(process.env.PORT, 8080),

  tickHz: n(process.env.TICK_HZ, TICK_HZ),
  snapshotHz: n(process.env.SNAPSHOT_HZ, SNAPSHOT_HZ),
  roomCap: n(process.env.ROOM_CAP, ROOM.cap),

  // Allow one or more origins as CSV (no trailing slash)
  corsOrigins: parseOrigins(
    process.env.CORS_ORIGIN,
    ["http://localhost:5173", "https://space-io.jeb4.dev"]
  ),

  botsEnabled: (process.env.BOTS_ENABLED ?? "false").toLowerCase() === "true",

  // Public URL of the WS server (used only if you reference it elsewhere)
  publicUrl: process.env.PUBLIC_URL ?? "http://localhost:8080",
} as const;

export const describeConfig = () => ({
  port: config.port,
  host: config.host,
  corsOrigins: config.corsOrigins,
  publicUrl: config.publicUrl,
  botsEnabled: config.botsEnabled,
});
