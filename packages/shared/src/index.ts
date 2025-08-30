export * from "./constants.js";
export * from "./types.js";
export * from "./messages.js";
export * from "./math.js";

// Shared types used by both server and clients
export type ClientToServer =
    | { type: 'join'; room: string }
    | { type: 'leave'; room?: string }
    | { type: 'chat'; room: string; text: string }
    | { type: 'ping' };

export type ServerToClient =
    | { type: 'welcome'; id: string }
    | { type: 'chat'; room: string; text: string; from: string; ts: number }
    | { type: 'room_users'; room: string; count: number }
    | { type: 'error'; message: string }
    | { type: 'pong' };

export const APP_NAME = 'Game WS';

// Helper to build a chat payload
export function makeChat(
    room: string,
    text: string,
    from: string,
    ts: number = Date.now()
): ServerToClient {
    return { type: 'chat', room, text, from, ts };
}

// Robust JSON -> message parser shared by server / tools
export function parseClientMessage(raw: string): ClientToServer | null {
    try {
        const obj = JSON.parse(raw);
        if (!obj || typeof obj !== 'object') return null;

        switch (obj.type) {
            case 'join':
                if (typeof obj.room === 'string') return obj as ClientToServer;
                break;
            case 'leave':
                if (obj.room === undefined || typeof obj.room === 'string') return obj as ClientToServer;
                break;
            case 'chat':
                if (typeof obj.room === 'string' && typeof obj.text === 'string') return obj as ClientToServer;
                break;
            case 'ping':
                return { type: 'ping' };
        }
        return null;
    } catch {
        return null;
    }
}
