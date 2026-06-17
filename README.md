# Spacewar! Online

Multiplayer Spacewar! clone with WebSocket networking. Ready to deploy on Railway.

## How to deploy on Railway

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USER/spacewar-online.git
git push -u origin main
```

### 2. Deploy on Railway
1. Go to https://railway.app and log in
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your repo
4. Railway auto-detects Node.js and runs `npm start`
5. Done! Your URL will be `https://spacewar-online.up.railway.app`

### 3. Play!
- Open the URL in two browser tabs/windows
- One clicks **HOST ONLINE**, gets a 4-letter code
- The other clicks **JOIN ONLINE**, enters the code
- Battle!

## Local play
Open `public/index.html` in any browser for local two-player.

## Controls
| Action | P1 | P2 |
|--------|----|----|
| Rotate left | A / ← | J |
| Rotate right | D / → | L |
| Thrust | W / ↑ | I |
| Torpedo | Space / Z | K |
| Laser | X | U |

## Technical
- Node.js + `ws` WebSocket server
- Pure client-side physics (inputs only sent over network)
- Single HTML file, no build step
