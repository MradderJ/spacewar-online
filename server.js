const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

function safeSend(ws, data) {
  try { if (ws && ws.readyState === WebSocket.OPEN) ws.send(data); } catch {}
}
const PUBLIC_DIR = path.join(__dirname, 'public');

// Serve static files
const server = http.createServer((req, res) => {
  let requestPath;
  try {
    requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  const fileName = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const filePath = path.normalize(path.join(PUBLIC_DIR, fileName));
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });

// Room management
const rooms = {};
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode() {
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
    }
  } while (rooms[code]);
  return code;
}

wss.on('connection', (ws) => {
  let playerRoom = null;
  let playerRole = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.type) {

      case 'host': {
        const code = generateRoomCode();
        rooms[code] = { host: ws, guest: null, code };
        playerRoom = code;
        playerRole = 'host';
        safeSend(ws, JSON.stringify({ type: 'room_created', code }));
        console.log(`Room ${code} created`);
        break;
      }

      case 'join': {
        const code = String(msg.code || '').trim().toUpperCase();
        if (!/^[A-Z2-9]{4}$/.test(code)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid room code' }));
          return;
        }
        const room = rooms[code];
        if (!room) {
          safeSend(ws, JSON.stringify({ type: 'error', message: 'Room not found' }));
          return;
        }
        if (room.guest) {
          safeSend(ws, JSON.stringify({ type: 'error', message: 'Room is full' }));
          return;
        }
        room.guest = ws;
        playerRoom = code;
        playerRole = 'guest';
        // Generera gemensamt frö för deterministisk slump
        const seed = Math.floor(Math.random() * 2147483647);
        // Notify both players
        safeSend(room.host, JSON.stringify({ type: 'matched', role: 'host', seed }));
        safeSend(ws, JSON.stringify({ type: 'matched', role: 'guest', seed }));
        console.log(`Player joined room ${code}`);
        break;
      }

      case 'input': {
        // Forward game state to the opponent
        if (!msg.state || typeof msg.state !== 'object') return;
        const room = rooms[playerRoom];
        if (!room) return;
        const target = playerRole === 'host' ? room.guest : room.host;
        if (target && target.readyState === WebSocket.OPEN) {
          safeSend(target, JSON.stringify({ type: 'opponent_input', state: msg.state }));
        }
        break;
      }

      case 'ping': {
        safeSend(ws, JSON.stringify({ type: 'pong' }));
        break;
      }
    }
  });

  ws.on('close', () => {
    if (playerRoom && rooms[playerRoom]) {
      const room = rooms[playerRoom];
      const other = playerRole === 'host' ? room.guest : room.host;
      if (other && other.readyState === WebSocket.OPEN) {
        safeSend(other, JSON.stringify({ type: 'opponent_disconnected' }));
      }
      delete rooms[playerRoom];
      console.log(`Room ${playerRoom} closed`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Spacewar! server running on port ${PORT}`);
});

// Heartbeat — ping alla klienter var 30:e sekund för att hålla anslutningen vid liv
setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.ping();
  });
}, 30000);
