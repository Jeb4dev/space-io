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

// Allow your frontend origin(s)
app.use(cors({ origin: config.corsOrigins, credentials: true }));

app.get("/health", (_req, res) =>
  res.json({ ok: true, wells: GRAVITY.wells.length })
);

const server = http.createServer(app);

// ⚠️ Important: set path and the same CORS here too
const io = new Server(server, {
  path: "/socket.io",
  cors: {
    origin: config.corsOrigins,   // can be string | string[]
    credentials: true,
    methods: ["GET", "POST"],
  },
});

const world = createWorld();
setupSocket(io, world);
startLoop(io, world);

// (Optional but handy) log upgrade/origin for debugging
io.on("connection", (socket) => {
  console.log("[io] connect", {
    id: socket.id,
    ns: socket.nsp.name,
    origin: socket.handshake.headers.origin,
  });
  socket.conn.on("upgrade", () =>
    console.log("[io] upgraded to", socket.conn.transport.name)
  );
});

server.listen(config.port, config.host, () => {
  console.log(`[server] listening on ${config.host}:${config.port}`);
});
