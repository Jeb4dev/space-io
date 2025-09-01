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
  giveXP,
} from "../sim/entities.js";
import { config } from "../config.js";
import { WORLD } from "@shared/constants.js";
import { randSafeSpawn, resetWorld } from "../sim/world.js";
import { clearBots } from "../sim/systems/bots.js";
import { filterName } from "../util/nameFilter.js";

export const setupSocket = (io: Server, world: World) => {
  io.on("connection", (socket: Socket) => {
    if (world.players.size >= config.roomCap) {
      socket.disconnect(true);
      return;
    }
    const playerId = nanoid();
    let playerAdded = false;

    socket.on("join", (raw) => {
      // If this is the first human after an idle period, reset the world fresh
      if (world.awaitingFirstHuman) {
        resetWorld(world); // clears entities & unpauses
        clearBots();
      }
      const spawnPos = randSafeSpawn(world);
      addPlayer(world, playerId, spawnPos, socket.id);
      playerAdded = true;
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
      if (!playerAdded) return; // ignore inputs before join
      const parsed = ClientInputSchema.safeParse(raw);
      if (!parsed.success) return;
      if (parsed.data.id !== playerId) return;
      queueInput(world, playerId, parsed.data);
    });

    socket.on("choosePowerup", (data: unknown) => {
      const parsed = LevelChoiceSchema.safeParse(data);
      if (!parsed.success) return;
      const { chosen } = parsed.data;
      applyLevelChoice(world, playerId, chosen);
    });

    // Debug command handler for adding XP (T key)
    socket.on("debug", (data: any) => {
      if (data.type === "addXP" && typeof data.amount === "number") {
        const player = world.players.get(playerId);
        if (player) {
          console.log(`Debug: Adding ${data.amount} XP to player ${player.name} (${playerId})`);
          giveXP(world, player, data.amount);
        }
      }
    });

    socket.on("disconnect", () => {
      if (playerAdded) removePlayer(world, playerId);
      // If no more humans connected, pause world until next join
      const anyHuman = Array.from(world.players.values()).some(p => p.socketId);
      if (!anyHuman) {
        world.awaitingFirstHuman = true;
        clearBots();
      }
    });
  });
};
