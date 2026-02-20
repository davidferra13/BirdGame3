# Bird Game 3

A multiplayer arcade seagull flight game with server-authoritative gameplay.

## Architecture

- **Client**: Web browser (Three.js + TypeScript + Vite)
- **Server**: Node.js realtime game server (WebSocket)
- **Database**: Supabase (PostgreSQL + Auth + Storage)

## Features

- Server-authoritative multiplayer (20 ticks/sec)
- Persistent player progression and stats
- Heat system and wanted mechanics
- Banking system with XP rewards
- Cosmetics and unlockables
- Achievements and challenges
- Hotspot system with dynamic world events

## Railway Compliance

If you deploy this project on Railway, review `RAILWAY_COMPLIANCE.md` before each deployment.
It documents prohibited-use categories from Railway Terms/Fair Use and the pre-deploy checks for this repo.

## Setup

### Prerequisites

- Node.js 18+
- pnpm (package manager)
- Supabase account

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your Supabase credentials:
   - `VITE_SUPABASE_URL` - Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - Your Supabase anon/public key
   - `SUPABASE_SERVICE_KEY` - Your Supabase service role key (server only)
   - `WS_PORT` - WebSocket server port (default: 3001)
   - `VITE_WS_URL` - WebSocket URL for client (required in production, e.g. `wss://your-server.railway.app`)
   - `WORLD_ID` / `VITE_WORLD_ID` - Must match exactly across server and client so all players join one world (e.g. `global-1`)

4. Run database migrations:
   ```bash
   # Using Supabase CLI
   supabase db push

   # Or apply migrations manually in Supabase Dashboard > SQL Editor
   ```

### Development

Run the client and server together:
```bash
pnpm run dev:all
```

Or run them separately:

**Client only:**
```bash
pnpm run dev
```

**Server only:**
```bash
pnpm run server:dev
```

The client will be available at `http://localhost:5173`
The server will run on `ws://localhost:3001`

### Docker (Full Stack)

Build and run both server + web containers:
```bash
pnpm run docker:up
```

Services:
- Web client: `http://localhost:8080`
- Game server (WebSocket): `ws://localhost:3300`

Stop containers:
```bash
pnpm run docker:down
```

Run with Cloudflare quick tunnel (optional):
```bash
pnpm run docker:up:tunnel
```
Then check tunnel logs:
```bash
docker compose logs -f tunnel
```

Notes:
- `docker-compose.yml` maps host `WS_PORT` (default `3300`) to container port `3001`.
- `web` image bakes Vite env vars at build time from `.env` (`VITE_*` keys).
- To override the web container WS endpoint for Docker builds only, set `DOCKER_VITE_WS_URL`.
- For production, set `VITE_WS_URL` to your permanent `wss://` backend before building/deploying the web image.

### Production Build

Build the client:
```bash
pnpm run build
```

Run the production server:
```bash
pnpm run server
```

If you deploy via GitHub Actions (`.github/workflows/netlify-deploy.yml`), add these repository secrets:
- `NETLIFY_AUTH_TOKEN` = Netlify personal access token
- `NETLIFY_SITE_ID` = your Netlify site ID
- `VITE_WS_URL` = production websocket endpoint (`wss://...`)
- `VITE_WORLD_ID` = canonical world ID (for example `global-1`)

## Project Structure

```
bird-game-3/
├── src/                      # Client source code
│   ├── entities/             # Game entities (Bird, NPC, etc.)
│   ├── systems/              # Game systems (Score, Banking, etc.)
│   ├── ui/                   # UI components
│   ├── multiplayer/          # Multiplayer client logic
│   ├── services/             # Supabase services
│   └── main.ts               # Client entry point
├── server/                   # Server source code
│   ├── GameServer.ts         # Main game server
│   ├── WorldState.ts         # World state management
│   ├── Player.ts             # Server-side player
│   └── index.ts              # Server entry point
├── supabase/
│   └── migrations/           # Database migrations
└── package.json
```

## Game Mechanics

### Flight Controls
- **WASD / Arrow Keys**: Turn and pitch
- **Space**: Ascend
- **Ctrl**: Fast descent
- **Alt**: Dive
- **Click**: Drop poop
- **T**: Boost (cooldown)

### Scoring
- Hit NPCs to earn coins
- Heat increases with hits
- Higher heat = higher multiplier
- Heat decays over time
- Wanted at Heat 15+ (other players can ground you)

### Banking
- Fly to Sanctuary (green area in center)
- Channel for 2.5 seconds to bank coins
- Earn XP (banked coins / 5)
- Level up and unlock cosmetics

### Grounding
- Flying too low with unbanked coins risks grounding
- Lose 40% of unbanked coins
- Respawn at random safe perch

## Multiplayer

The game uses a server-authoritative model:
- Server validates all game actions
- 20 server ticks per second
- Client interpolates between server updates
- WebSocket for real-time communication

## Database Schema

See `supabase/migrations/` for full schema:
- `profiles` - User profiles and currency
- `lifetime_stats` - Lifetime player statistics
- `inventory` - Owned cosmetics
- `purchases` - Purchase history
- `achievements` - Unlocked achievements

## Contributing

This is a personal project. Feel free to fork and modify!

## License

ISC
