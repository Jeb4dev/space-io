// src/index.ts
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { config } from "./config.js";
import { setupSocket } from "./net/socket.js";
import { createWorld } from "./sim/world.js";
import { startLoop } from "./sim/loop.js";
import type { Request, Response } from "express";
import { GRAVITY } from "@game/shared";

const app = express();
// app.use(cors({ origin: config.corsOrigin, credentials: true }));

// app.get("/health", (_req: Request, res: Response) => {
//   return res.status(200).json({ ok: true});
// });

const server = http.createServer(app);
// const io = new Server(server, { cors: { origin: config.corsOrigin } });
//
// const world = createWorld();
// setupSocket(io, world);
// startLoop(io, world);

server.listen(config.port, () => {
  console.log(`[server] listening on :${config.port}`);
});
