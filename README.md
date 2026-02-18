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

### Production Build

Build the client:
```bash
pnpm run build
```

Run the production server:
```bash
pnpm run server
```

If you deploy the client to Netlify via GitHub Actions, add a repository secret:
- `VITE_WS_URL` = your production websocket endpoint (`wss://...`)

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
- **Shift**: Dive
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
