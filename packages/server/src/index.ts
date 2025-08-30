// src/index.ts
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { config } from "./config.js";
import { setupSocket } from "./net/socket.js";
import { createWorld } from "./sim/world.js";
import { startLoop } from "./sim/loop.js";
import { GRAVITY } from "@shared/constants.js";

const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.get("/health", (_req, res) => res.json({ ok: true, wells: GRAVITY.wells.length }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: config.corsOrigin } });

const world = createWorld();
setupSocket(io, world);
startLoop(io, world);

server.listen(config.port, config.host, () => {
  console.log(`[server] listening on ${config.host}:${config.port}`);
});
