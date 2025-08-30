import { Server, Socket } from "socket.io";
import { nanoid } from "nanoid";
import {
  ClientInputSchema,
  ClientJoinSchema,
  LevelChoiceSchema,
  ServerWelcome,
} from "@shared/messages.js";
import type { World } from "../sim/world.js";
import {
  addPlayer,
  removePlayer,
  setPlayerName,
  queueInput,
  applyLevelChoice,
} from "../sim/entities.js";
import { config } from "../config.js";
import { WORLD } from "@shared/constants.js";
import { randSafeSpawn } from "../sim/world.js";
import { filterName } from "../util/nameFilter.js";

export const setupSocket = (io: Server, world: World) => {
  io.on("connection", (socket: Socket) => {
    if (world.players.size >= config.roomCap) {
      socket.disconnect(true);
      return;
    }
    const playerId = nanoid();
    const spawnPos = randSafeSpawn(world);
    const player = addPlayer(
      world,
      playerId,
      spawnPos,
      socket.id,
    );

    socket.on("join", (raw) => {
      const parsed = ClientJoinSchema.safeParse(raw);
      const safeName = filterName(parsed.success ? parsed.data.name : "Anon");
      setPlayerName(world, playerId, safeName);

      const welcome: ServerWelcome = {
        youId: playerId,
        tickRate: config.tickHz,
        snapshotRate: config.snapshotHz,
        world: { w: WORLD.w, h: WORLD.h },
      };
      socket.emit("welcome", welcome);
    });

    socket.on("input", (raw) => {
      const parsed = ClientInputSchema.safeParse(raw);
      if (!parsed.success) return;
      if (parsed.data.id !== playerId) return;
      queueInput(world, playerId, parsed.data);
    });

    socket.on("choosePowerup", (raw) => {
      const parsed = LevelChoiceSchema.safeParse(raw);
      if (!parsed.success) return;
      // Defensive: only accept valid choices
      const chosen = parsed.data.chosen as import("@shared/types.js").PowerupChoice;
      applyLevelChoice(world, playerId, chosen);
    });

    socket.on("disconnect", () => {
      removePlayer(world, playerId);
    });
  });
};
