import { io, Socket } from "socket.io-client";
import type { ClientInput, ServerSnapshot, ServerEvent, ServerWelcome } from "@shared/messages";
import {
  ClientInputSchema,
  ServerEventSchema,
  ServerSnapshotSchema,
  ServerWelcomeSchema,
} from "@shared/messages";

export class Net {
  socket!: Socket;
  youId: string | null = null;
  lastAckSeq = 0;

  connect(url: string) {
    this.socket = io(url, { transports: ["websocket"] });
    return new Promise<ServerWelcome>((resolve) => {
      this.socket.on("welcome", (msg: ServerWelcome) => {
        const ok = ServerWelcomeSchema.safeParse(msg);
        if (ok.success) {
          this.youId = ok.data.youId;
          resolve(ok.data);
        }
      });
    });
  }

  join(name: string) {
    this.socket.emit("join", { name });
  }

  onSnapshot(cb: (s: ServerSnapshot) => void) {
    this.socket.on("snapshot", (s: ServerSnapshot) => {
      const ok = ServerSnapshotSchema.safeParse(s);
      if (!ok.success) return;
      this.lastAckSeq = ok.data.acks.seq;
      cb(ok.data);
    });
  }

  onEvent(cb: (e: ServerEvent) => void) {
    this.socket.on("event", (e: ServerEvent) => {
      const ok = ServerEventSchema.safeParse(e);
      if (!ok.success) return;
      cb(ok.data);
    });
  }

  sendInput(input: ClientInput) {
    const msg = ClientInputSchema.parse(input);
    this.socket.emit("input", msg);
  }

  choosePowerup(payload: { family: any; tier?: number; alt?: any }) {
    this.socket.emit("choosePowerup", { chosen: payload });
  }
}
