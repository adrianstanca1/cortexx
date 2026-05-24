import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';
const roomMap: Map<string, Set<WebSocket>> = new Map();
const clientMap = new WeakMap<WebSocket, { userId: number; rooms: Set<string> }>();

export function setupWebSocket(wss: WebSocketServer) {
  wss.on('connection', (ws, req: any) => {
    const token = new URL(req.url ?? '/', 'http://localhost').searchParams.get('token');
    if (!token) { ws.close(); return; }
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
      clientMap.set(ws, { userId: decoded.userId, rooms: new Set() });
      ws.send(JSON.stringify({ type: 'connected', userId: decoded.userId }));
    } catch { ws.close(); return; }

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'join' && msg.room) {
          if (!roomMap.has(msg.room)) roomMap.set(msg.room, new Set());
          roomMap.get(msg.room)!.add(ws);
          clientMap.get(ws)!.rooms.add(msg.room);
          ws.send(JSON.stringify({ type: 'joined', room: msg.room }));
        }
      } catch { /* ignore */ }
    });

    ws.on('close', () => {
      const c = clientMap.get(ws);
      if (c) c.rooms.forEach(r => roomMap.get(r)?.delete(ws));
    });
  });
}

export function broadcast(room: string, msg: unknown) {
  roomMap.get(room)?.forEach(ws => {
    if (ws.readyState === 1) ws.send(JSON.stringify(msg));
  });
}
