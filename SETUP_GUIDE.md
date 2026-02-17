# Bird Game 3D - Setup Guide

Complete step-by-step setup instructions for development and deployment.

## Prerequisites

- **Node.js**: v18 or higher ([Download](https://nodejs.org/))
- **pnpm**: Fast package manager
  ```bash
  npm install -g pnpm
  ```
- **Supabase Account**: Free tier available at [supabase.com](https://supabase.com)

## Step 1: Clone and Install

```bash
cd "Bird Game 3D"
pnpm install
```

## Step 2: Supabase Setup

### Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for project to initialize (~2 minutes)

### Get Credentials

1. Go to Project Settings > API
2. Copy the following:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)
   - **service_role key** (starts with `eyJ...`, keep secret!)

### Apply Database Migrations

**Option A: Using Supabase CLI (Recommended)**

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
supabase db push
```

**Option B: Manual SQL Execution**

1. Go to Supabase Dashboard > SQL Editor
2. Run each migration file in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_currency_functions.sql`
   - `supabase/migrations/003_stats_functions.sql`

## Step 3: Configure Environment

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in your Supabase credentials:
   ```bash
   # Supabase Configuration
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
   SUPABASE_SERVICE_KEY=YOUR_SERVICE_KEY_HERE

   # Server Configuration
   WS_PORT=3001
   VITE_WS_URL=ws://localhost:3001

   # JWT Secret
   JWT_SECRET=your-random-secret-here

   # Environment
   NODE_ENV=development
   ```

3. **Important**: Never commit `.env` to git! It's already in `.gitignore`.

## Step 4: Run the Game

### Development Mode (Recommended)

Run both client and server together:

```bash
pnpm run dev:all
```

This starts:
- **Client** at http://localhost:5173
- **Server** at ws://localhost:3001

### Run Separately

**Client only:**
```bash
pnpm run dev
```

**Server only:**
```bash
pnpm run server:dev
```

## Step 5: Test Multiplayer

1. Start the server: `pnpm run server:dev`
2. Open two browser windows at `http://localhost:5173`
3. Click "Play" in both windows
4. You should see both players in the game world!

## Step 6: Enable Multiplayer in Code (Optional)

By default, multiplayer is disabled. To enable it:

**Option A: Via Environment Variable**
Add to `.env`:
```bash
VITE_MULTIPLAYER_ENABLED=true
```

**Option B: Via Code**
In `src/Game.ts` constructor, set:
```typescript
this.multiplayerEnabled = true;
```

**Option C: Programmatically**
```typescript
const game = new Game();
game.enableMultiplayer();
```

## Production Deployment

### Client Deployment (Vercel/Netlify)

1. Build the client:
   ```bash
   pnpm run build
   ```

2. Deploy `dist/` folder to your hosting service

3. Set environment variables on hosting platform:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_WS_URL` (your production WebSocket URL)

### Server Deployment (Railway/Render/Heroku)

1. Choose a hosting platform (Railway is easiest)

2. Set environment variables:
   - `WS_PORT` (or use `PORT` provided by platform)
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `JWT_SECRET`
   - `NODE_ENV=production`

3. Set start command:
   ```bash
   pnpm run server
   ```

4. Deploy server code

5. Update client `VITE_WS_URL` to your server's WebSocket URL

## Troubleshooting

### "Cannot connect to server"

- Ensure server is running (`pnpm run server:dev`)
- Check `VITE_WS_URL` in `.env` matches your server port
- Check firewall isn't blocking port 3001

### "Supabase error: Invalid API key"

- Double-check your API keys in `.env`
- Make sure you're using the correct project
- Ensure migrations were applied successfully

### "Database migrations failed"

- Check Supabase dashboard for error messages
- Ensure you're running migrations in order
- Try manual SQL execution in Supabase SQL Editor

### Port 3001 already in use

Change the port in `.env`:
```bash
WS_PORT=3002
VITE_WS_URL=ws://localhost:3002
```

## Development Tips

### Hot Reload

- Client code hot-reloads automatically (Vite)
- Server code auto-restarts when using `server:dev` (tsx watch)

### Testing Without Multiplayer

Set `multiplayerEnabled = false` in `Game.ts` to test single-player only.

### Database Reset

To reset the database:
1. Go to Supabase Dashboard > Database > Tables
2. Truncate all tables (keep schema)
3. Or drop and re-run migrations

## Next Steps

- Read `README.md` for game mechanics
- Check architecture docs in project root (numbered `.md` files)
- Customize game constants in `src/utils/Constants.ts`
- Add cosmetics and unlockables
- Implement achievement rewards
- Add social features (friends, parties)

## Need Help?

- Check the architecture specification documents
- Review the Supabase documentation
- Check server logs for errors
- Ensure all dependencies are installed

Happy flying! 🦅
