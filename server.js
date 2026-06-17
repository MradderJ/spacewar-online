const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// Serve static files
const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
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
        ws.send(JSON.stringify({ type: 'room_created', code }));
        console.log(`Room ${code} created`);
        break;
      }

      case 'join': {
        const code = msg.code.toUpperCase();
        const room = rooms[code];
        if (!room) {
          ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
          return;
        }
        if (room.guest) {
          ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
          return;
        }
        room.guest = ws;
        playerRoom = code;
        playerRole = 'guest';
        // Notify both players
        room.host.send(JSON.stringify({ type: 'matched', role: 'host' }));
        ws.send(JSON.stringify({ type: 'matched', role: 'guest' }));
        console.log(`Player joined room ${code}`);
        break;
      }

      case 'input': {
        // Forward keyboard input to the opponent
        const room = rooms[playerRoom];
        if (!room) return;
        const target = playerRole === 'host' ? room.guest : room.host;
        if (target && target.readyState === WebSocket.OPEN) {
          target.send(JSON.stringify({ type: 'opponent_input', keys: msg.keys }));
        }
        break;
      }

      case 'ping': {
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
      }
    }
  });

  ws.on('close', () => {
    if (playerRoom && rooms[playerRoom]) {
      const room = rooms[playerRoom];
      const other = playerRole === 'host' ? room.guest : room.host;
      if (other && other.readyState === WebSocket.OPEN) {
        other.send(JSON.stringify({ type: 'opponent_disconnected' }));
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
