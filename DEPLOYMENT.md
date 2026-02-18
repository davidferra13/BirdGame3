# Deployment Guide

Production deployment instructions for Bird Game 3D.

## Architecture Overview

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Client    │ ◄─────► │ Game Server  │ ◄─────► │  Supabase   │
│  (Browser)  │  WebSocket  (Node.js)   │   HTTP    │  (Postgres) │
└─────────────┘         └──────────────┘         └─────────────┘
```

## Prerequisites

- Supabase project (free tier works)
- Client hosting (Vercel, Netlify, or static host)
- Server hosting (Railway, Render, Fly.io, or Heroku)
- Domain names (optional but recommended)

## Part 1: Database Setup (Supabase)

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Choose region closest to your users
4. Wait for initialization

### 2. Apply Migrations

**Using Supabase CLI:**
```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

**Using Dashboard:**
1. Go to SQL Editor
2. Run each migration file:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_currency_functions.sql`
   - `supabase/migrations/003_stats_functions.sql`

### 3. Configure Row Level Security (RLS)

RLS is already configured in migrations. Verify:
- Go to Authentication > Policies
- Ensure all tables have RLS enabled
- Check that policies exist for each table

### 4. Set Up Auth (Optional)

For production, enable email/password auth:
1. Go to Authentication > Settings
2. Enable email provider
3. Configure email templates
4. Set redirect URLs

## Part 2: Server Deployment

### Option A: Railway (Recommended)

1. **Create Railway Account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your repository

3. **Configure Environment Variables**
   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-service-key
   JWT_SECRET=your-random-secret
   WORLD_ID=global-1
   WS_PORT=$PORT  # Railway provides PORT automatically
   NODE_ENV=production
   ```

4. **Configure Build Settings**
   - Build Command: `pnpm install`
   - Start Command: `pnpm run server`
   - Root Directory: `/`

5. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Note your server URL (e.g., `wss://your-app.railway.app`)

### Option B: Render

1. Create new Web Service
2. Connect GitHub repository
3. Configure:
   - Environment: Node
   - Build Command: `pnpm install`
   - Start Command: `pnpm run server`
4. Add environment variables (same as Railway)
5. Deploy

### Option C: Fly.io

1. Install Fly CLI
2. Create `fly.toml`:
   ```toml
   app = "bird-game-server"

   [build]

   [env]
   NODE_ENV = "production"

   [[services]]
   internal_port = 3001
   protocol = "tcp"

   [[services.ports]]
   port = 80
   handlers = ["http"]

   [[services.ports]]
   port = 443
   handlers = ["tls", "http"]
   ```

3. Deploy:
   ```bash
   fly deploy
   fly secrets set SUPABASE_URL=...
   fly secrets set SUPABASE_SERVICE_KEY=...
   fly secrets set JWT_SECRET=...
   ```

## Part 3: Client Deployment

### Option A: Vercel (Recommended)

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Configure Environment Variables**
   Create `.env.production`:
   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_WS_URL=wss://your-server.railway.app
   VITE_WORLD_ID=global-1
   ```

3. **Build and Deploy**
   ```bash
   vercel --prod
   ```

4. **Or Deploy from GitHub**
   - Go to [vercel.com](https://vercel.com)
   - Import repository
   - Add environment variables
   - Deploy

### Option B: Netlify

1. **Build the Client**
   ```bash
   pnpm run build
   ```

2. **Deploy**
   - Go to [netlify.com](https://netlify.com)
   - Drag & drop `dist/` folder
   - Or connect GitHub repository

3. **Configure**
   - Build command: `pnpm run build`
   - Publish directory: `dist`
   - Add environment variables
   - Enable Git-based deploys for your default branch

4. **Auto-deploy newest build on every push (recommended)**
   - This repo includes `.github/workflows/netlify-deploy.yml`
   - Add GitHub repository secrets:
     - `NETLIFY_AUTH_TOKEN`
     - `NETLIFY_SITE_ID`
   - Every push to `master` or `main` deploys the latest `dist/` to Netlify production

### Option C: Static Hosting (S3, Cloudflare Pages, etc.)

1. Build:
   ```bash
   pnpm run build
   ```

2. Upload `dist/` folder to your hosting service

3. Configure environment variables before build

## Part 4: DNS & SSL

### SSL/TLS for WebSocket

WebSocket connections require `wss://` (secure) in production.

**Railway/Render:** SSL automatically provided

**Custom domain:**
1. Point domain to your server
2. Add SSL certificate (Let's Encrypt via Caddy or nginx)

**Example nginx config:**
```nginx
server {
    listen 443 ssl;
    server_name game.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## Part 5: Monitoring & Scaling

### Logging

**Server logs:**
- Railway: Built-in logs dashboard
- Render: Logs tab
- Custom: Use Winston or Pino

**Client errors:**
- Add Sentry or LogRocket for client-side error tracking

### Monitoring

Monitor these metrics:
- Active WebSocket connections
- Server CPU/memory usage
- Database connection pool
- Player count
- Request latency

### Scaling

**Horizontal scaling:**
- Current setup: Single world instance
- For 100+ concurrent players: Implement world sharding
- Load balance WebSocket connections
- Use Redis for cross-server state

**Database scaling:**
- Supabase auto-scales
- Add read replicas for high traffic
- Index frequently queried columns

## Part 6: Testing Production

### Pre-launch Checklist

- [ ] Database migrations applied
- [ ] RLS policies enabled
- [ ] Server environment variables set
- [ ] Client environment variables set
- [ ] WebSocket URL uses `wss://`
- [ ] SSL certificate valid
- [ ] Auth configured (if using)
- [ ] Error tracking enabled
- [ ] Server logs accessible
- [ ] Backups enabled (Supabase)

### Load Testing

Test with multiple concurrent connections:

```bash
# Install wscat
npm install -g wscat

# Connect to server
wscat -c wss://your-server.railway.app
```

Send test messages:
```json
{"type":"join","data":{"playerId":"test1","username":"TestPlayer"}}
```

### Monitoring Checklist

- [ ] Server responds to WebSocket connections
- [ ] Players can join/leave
- [ ] World state broadcasts work
- [ ] Database updates persist
- [ ] No memory leaks
- [ ] Server stays responsive under load

## Environment Variables Summary

### Server (.env)
```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
JWT_SECRET=random-secret-here
WS_PORT=3001  # or $PORT for Railway/Render
NODE_ENV=production
```

### Client (build time)
```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_WS_URL=wss://your-server.railway.app
```

## Rollback Procedure

If deployment fails:

1. **Client:** Revert to previous Vercel/Netlify deployment
2. **Server:** Rollback Railway/Render deployment
3. **Database:** Restore from Supabase backup

## Cost Estimates (Monthly)

- **Supabase Free Tier:** $0 (up to 500MB DB, 50k auth users)
- **Railway Hobby:** $5 (512MB RAM, 1GB disk)
- **Vercel Hobby:** $0 (100GB bandwidth)
- **Total:** ~$5/month for hobby/development

**Production (1000+ concurrent users):**
- Supabase Pro: $25/month
- Railway Pro: $20-50/month
- Vercel Pro: $20/month
- Total: ~$65-95/month

## Security Best Practices

1. **Never commit secrets**
   - Use environment variables
   - Add `.env` to `.gitignore`

2. **Use HTTPS/WSS only**
   - No plain WebSocket in production

3. **Enable RLS**
   - All Supabase tables must have RLS
   - Test policies thoroughly

4. **Rotate secrets**
   - Change JWT_SECRET periodically
   - Use Supabase secret rotation

5. **Rate limiting**
   - Add rate limiting to server (express-rate-limit)
   - Protect against abuse

6. **Input validation**
   - Server validates all client input
   - Never trust client data

## Troubleshooting

### "WebSocket connection failed"
- Check WSS URL format
- Verify SSL certificate
- Check CORS settings

### "Database connection error"
- Verify Supabase URL and keys
- Check RLS policies
- Ensure migrations applied

### "Server crashes under load"
- Increase server resources
- Add connection limits
- Implement rate limiting

## Support

For deployment issues:
- Railway: [railway.app/help](https://railway.app/help)
- Vercel: [vercel.com/support](https://vercel.com/support)
- Supabase: [supabase.com/docs](https://supabase.com/docs)

---

**Good luck with your deployment! 🚀**
