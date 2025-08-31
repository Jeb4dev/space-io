// @client/net/socket.ts
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
    // TIP while debugging: comment out transports to allow polling fallback,
    // then re-enable websocket-only when you're confident WS upgrades work.
    this.socket = io(url, {
      path: "/socket.io",          // must match server + Nginx
      // transports: ["websocket"], // optional: force WS only
      withCredentials: true,       // only matters if you later use cookies
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
    });

    // helpful logging while you test
    this.socket.on("connect", () => console.log("[net] connected", this.socket.id));
    this.socket.on("disconnect", (r) => console.log("[net] disconnect:", r));
    this.socket.on("connect_error", (err: any) => {
      console.error("[net] connect_error:", err?.message ?? err, err?.data);
    });

    return new Promise<ServerWelcome>((resolve, reject) => {
      const onWelcome = (msg: ServerWelcome) => {
        const ok = ServerWelcomeSchema.safeParse(msg);
        if (!ok.success) return;
        this.youId = ok.data.youId;
        this.socket.off("connect_error", onErr);
        resolve(ok.data);
      };
      const onErr = (err: any) => {
        this.socket.off("welcome", onWelcome);
        reject(err);
      };
      this.socket.once("welcome", onWelcome);
      this.socket.once("connect_error", onErr);
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
