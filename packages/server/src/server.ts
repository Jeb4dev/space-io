import { createServer, IncomingMessage } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'node:url';

import {
  APP_NAME,
  makeChat,
  parseClientMessage,
  type ClientToServer,
  type ServerToClient
} from '@game/shared';

const PORT = Number(process.env.PORT ?? 8080);
const WS_PATH = '/ws';

type ClientState = {
  id: string;
  alive: boolean;
  rooms: Set<string>;
};

const clientState = new WeakMap<WebSocket, ClientState>();
const rooms = new Map<string, Set<WebSocket>>();

function send(ws: WebSocket, msg: ServerToClient) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(room: string, msg: ServerToClient) {
  const members = rooms.get(room);
  if (!members) return;
  const payload = JSON.stringify(msg);
  for (const c of members) if (c.readyState === c.OPEN) c.send(payload);
}

function joinRoom(ws: WebSocket, room: string) {
  let members = rooms.get(room);
  if (!members) rooms.set(room, (members = new Set()));
  if (!members.has(ws)) {
    members.add(ws);
    clientState.get(ws)!.rooms.add(room);
  }
  sendRoomCount(room);
}

function leaveRoom(ws: WebSocket, room: string) {
  const members = rooms.get(room);
  if (!members) return;
  members.delete(ws);
  if (members.size === 0) rooms.delete(room);
  clientState.get(ws)!.rooms.delete(room);
  sendRoomCount(room);
}

function leaveAll(ws: WebSocket) {
  const st = clientState.get(ws);
  if (!st) return;
  for (const room of st.rooms) leaveRoom(ws, room);
}

function sendRoomCount(room: string) {
  const members = rooms.get(room);
  if (!members) return;
  broadcast(room, { type: 'room_users', room, count: members.size });
}

// HTTP server for health + upgrade
const server = createServer((req, res) => {
  if (req.url === '/' || req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`${APP_NAME} OK\n`);
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req: IncomingMessage, socket, head) => {
  try {
    const url = new URL(req.url ?? '', `http://${req.headers.host}`);
    if (url.pathname !== WS_PATH) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } catch {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
  }
});

wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
  const id = randomUUID();
  clientState.set(ws, { id, alive: true, rooms: new Set() });
  console.log(`[ws] connected: ${id} (${req.socket.remoteAddress})`);
  send(ws, { type: 'welcome', id });

  ws.on('pong', () => {
    const st = clientState.get(ws);
    if (st) st.alive = true;
  });

  ws.on('message', (data) => {
    const text = typeof data === 'string' ? data : data.toString('utf8');
    const msg = parseClientMessage(text);
    if (!msg) {
      send(ws, { type: 'error', message: 'Invalid message' });
      return;
    }

    const st = clientState.get(ws)!;

    switch (msg.type) {
      case 'join':
        joinRoom(ws, msg.room);
        // Say hi using shared helper
        broadcast(msg.room, makeChat(msg.room, `User ${st.id} joined.`, 'server'));
        break;

      case 'leave':
        if (msg.room) leaveRoom(ws, msg.room);
        else leaveAll(ws);
        break;

      case 'chat':
        if (!st.rooms.has(msg.room)) {
          send(ws, { type: 'error', message: `Not in room ${msg.room}` });
          break;
        }
        broadcast(msg.room, makeChat(msg.room, msg.text, st.id));
        break;

      case 'ping':
        send(ws, { type: 'pong' });
        break;
    }
  });

  ws.on('close', () => {
    console.log(`[ws] closed: ${id}`);
    leaveAll(ws);
    clientState.delete(ws);
  });

  ws.on('error', (err) => {
    console.error(`[ws] error ${id}:`, err);
  });
});

// Heartbeats
const HEARTBEAT_MS = 30_000;
const hb = setInterval(() => {
  for (const ws of wss.clients) {
    const st = clientState.get(ws);
    if (!st) continue;

    if (!st.alive) {
      console.log(`[ws] terminating unresponsive client ${st.id}`);
      ws.terminate();
      continue;
    }

    st.alive = false;
    try { ws.ping(); } catch {}
  }
}, HEARTBEAT_MS);

// Start / shutdown
server.listen(PORT, () => {
  console.log(`${APP_NAME} listening on http://localhost:${PORT}`);
  console.log(`WebSocket endpoint at ws://localhost:${PORT}${WS_PATH}`);
});

function shutdown(signal: string) {
  console.log(`\nReceived ${signal}, shutting down...`);
  clearInterval(hb);
  for (const ws of wss.clients) {
    try { ws.close(1001, 'Server shutdown'); } catch {}
  }
  wss.close(() => server.close(() => process.exit(0)));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
