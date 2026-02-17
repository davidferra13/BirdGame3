# Bird Game 3D - Database & Backend Setup Guide

This guide explains how to set up the complete backend system including authentication, progression, economy, and achievements.

## System Overview

The game implements the following systems:

1. **Authentication** (Supabase Auth) - Email/password + magic link
2. **Progression** - XP and levels (50 level cap, cosmetic rewards only)
3. **Economy** - Coins (earned) + Feathers (premium), no conversion
4. **Stats Tracking** - Lifetime statistics for achievements
5. **Achievements** - Unlockable goals with cosmetic rewards
6. **Shop** - Dual currency (coins/feathers) cosmetic store
7. **Inventory** - Cosmetic item management and loadouts

---

## Prerequisites

- [Supabase Account](https://supabase.com) (free tier works)
- Node.js 18+ installed
- pnpm installed

---

## Step 1: Supabase Project Setup

### 1.1 Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Fill in:
   - **Name**: Bird Game 3D
   - **Database Password**: (save this securely)
   - **Region**: Choose closest to you
4. Wait for project to initialize (~2 minutes)

### 1.2 Get Your Credentials

1. In your project dashboard, go to **Settings** → **API**
2. Copy the following:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

### 1.3 Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

---

## Step 2: Database Schema Setup

### 2.1 Run Migrations

In your Supabase project dashboard:

1. Go to **SQL Editor**
2. Create a new query
3. Copy and paste the contents of `supabase/migrations/001_initial_schema.sql`
4. Click **Run**
5. Repeat for `002_currency_functions.sql`
6. Repeat for `003_stats_functions.sql`

### 2.2 Verify Tables

Go to **Table Editor** and verify these tables exist:
- ✅ profiles
- ✅ lifetime_stats
- ✅ inventory
- ✅ purchases
- ✅ achievements
- ✅ challenge_progress

---

## Step 3: Install Dependencies

```bash
pnpm install
```

This installs:
- `@supabase/supabase-js` - Supabase client
- `three` - 3D engine
- Other dependencies

---

## Step 4: Test Authentication

### 4.1 Enable Email Auth

In Supabase dashboard:
1. Go to **Authentication** → **Providers**
2. Enable **Email** provider
3. (Optional) Enable **Magic Link** for passwordless login

### 4.2 Test Sign Up

```typescript
import { signUp } from './src/services/AuthService';

const result = await signUp({
  email: 'test@example.com',
  password: 'secure_password_123',
  username: 'TestPlayer'
});

console.log(result); // { success: true, profile: {...} }
```

---

## Step 5: Understanding the Systems

### Authentication System (`AuthService.ts`)

```typescript
// Sign up
await signUp({ email, password, username });

// Sign in
await signIn({ email, password });

// Sign out
await signOut();

// Delete account (cascades to all data)
await deleteAccount();
```

### Currency System (`CurrencyService.ts`)

```typescript
// Get balance
const balance = await getCurrencyBalance(userId);
// { coins: 1000, feathers: 50 }

// Add coins (server-side only, after banking)
await addCoins(userId, 500);

// Deduct for purchases
await deductCoins(userId, 100);
await deductFeathers(userId, 10);

// ❌ FORBIDDEN - throws error
convertCurrency(); // Never allowed per spec
```

### Banking System (`BankingService.ts`)

**Complete banking flow:**

```typescript
const result = await bankCoins(userId, 500);
// {
//   success: true,
//   banked_coins: 500,
//   xp_earned: 100,  // floor(500 / 5)
//   new_level: 5,    // if leveled up
//   new_total_coins: 1500
// }
```

**Preview before banking:**

```typescript
const preview = previewBanking(500);
// { coins: 500, xp: 100 }
```

### Progression System (`ProgressionService.ts`)

**XP Calculation:**
- `xpEarned = floor(bankedCoins / 5)`
- Only awarded when banking succeeds

**Level Curve:**
- Level 1: 0 XP
- Level 2: 100 XP
- Level 3: 115 XP (100 × 1.15)
- Level 4: 132 XP (115 × 1.15)
- Level 50: Cap

```typescript
// Get level progress
const progress = await getLevelProgress(userId);
// {
//   level: 5,
//   totalXP: 650,
//   xpInCurrentLevel: 50,
//   xpNeededForNextLevel: 132,
//   progress: 0.38,
//   isMaxLevel: false
// }
```

### Stats System (`StatsService.ts`)

```typescript
// Record individual stats
await recordNPCHit(userId, 1);
await recordPlayerHit(userId, 1);
await recordGroundingDealt(userId, 1);
await recordTimesGrounded(userId, 1);
await recordHeatReached(userId, 25);
await recordBanking(userId, 1000); // Auto-called by BankingService
await recordTimePlayed(userId, 600); // 10 minutes

// Get all stats
const stats = await getLifetimeStats(userId);
```

### Achievement System (`AchievementService.ts`)

**Built-in Achievements:**
- "First Drop" - Hit 1 NPC → Title unlock
- "Public Menace" - Reach Heat 15 → Title unlock
- "High Roller" - Bank 1,000 in one run → Cosmetic bundle
- "Bounty Hunter" - Ground 10 wanted players → Title unlock
- "Paint the Town" - Hit 1,000 NPCs → Cosmetic bundle

```typescript
// Get all progress
const progress = await getAchievementProgress(userId);
// [{
//   achievement: { id: 'first_drop', name: 'First Drop', ... },
//   current: 5,
//   required: 1,
//   progress: 1.0,
//   unlocked: true,
//   unlocked_at: '2026-02-13T...'
// }, ...]

// Auto-check and unlock
const newUnlocks = await checkAndUnlockAchievements(userId);
// ['first_drop', 'public_menace']
```

### Shop System (`ShopService.ts`)

```typescript
// Purchase with coins
const result = await purchaseWithCoins(
  userId,
  'skin_seagull_gold',
  'skin',
  500
);
// {
//   success: true,
//   item: { user_id, item_id, item_type, ... },
//   updated_coins: 500
// }

// Purchase with feathers
await purchaseWithFeathers(userId, 'trail_rainbow', 'trail', 50);

// Idempotent - can't buy twice
await purchaseWithCoins(userId, 'skin_seagull_gold', 'skin', 500);
// { success: false, error: 'Item already purchased' }
```

### Inventory System (`InventoryService.ts`)

```typescript
// Get all items
const inventory = await getInventory(userId);

// Get by type
const skins = await getInventoryByType(userId, 'skin');

// Equip item (auto-unequips others of same type)
await equipItem(userId, 'skin_seagull_gold', 'skin');

// Get equipped loadout
const equipped = await getEquippedItems(userId);

// Check ownership
const owns = await ownsItem(userId, 'trail_rainbow', 'trail');
```

---

## Step 6: Integration Examples

### Complete Player Session Flow

```typescript
import {
  signIn,
  bankCoins,
  recordNPCHit,
  recordHeatReached,
  checkAndUnlockAchievements,
} from './src/services';

// 1. Player logs in
const auth = await signIn({
  email: 'player@example.com',
  password: 'password123'
});

if (!auth.success) {
  console.error('Login failed:', auth.error);
  return;
}

const userId = auth.profile!.id;

// 2. Player plays game, hits NPCs
await recordNPCHit(userId, 10);
await recordHeatReached(userId, 20);

// 3. Player banks 1000 coins
const bankResult = await bankCoins(userId, 1000);
console.log(`Banked ${bankResult.banked_coins} coins`);
console.log(`Earned ${bankResult.xp_earned} XP`);

if (bankResult.new_level) {
  console.log(`LEVEL UP! Now level ${bankResult.new_level}`);
}

// 4. Check for new achievements
const newAchievements = await checkAndUnlockAchievements(userId);
if (newAchievements.length > 0) {
  console.log('New achievements unlocked:', newAchievements);
}
```

---

## Design Document References

All systems implement their respective design documents:

- **Database**: `DATA_MODEL_DATABASE.md`
- **Auth**: `AUTH_AND_ACCOUNTS.md`
- **Progression**: `PLAYER_PROGRESSION.md`
- **Stats**: `STATS_AND_ACHIEVEMENTS.md`
- **Economy**: `ECONOMY_COINS_AND_FEATHERS.md`
- **Shop**: `SHOP_SYSTEM.md`

---

## Troubleshooting

### "Missing Supabase environment variables"

**Solution**: Create `.env` file with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

### "Failed to fetch profile"

**Solutions**:
1. Check RLS policies are enabled
2. Verify user is authenticated
3. Check trigger created profile on signup

### "Insufficient coins/feathers"

**Solution**: Normal - user doesn't have enough currency. Handle in UI.

### TypeScript errors with Supabase types

**Solution**: The `database.ts` types file provides all type definitions. Import from there:
```typescript
import { Profile, LifetimeStats } from './types/database';
```

---

## Next Steps

1. ✅ Database schema created
2. ✅ All services implemented
3. ⏭️ Integrate services into game UI
4. ⏭️ Create login/signup screens
5. ⏭️ Add HUD elements for XP/coins/level
6. ⏭️ Build shop UI
7. ⏭️ Create inventory/loadout screen
8. ⏭️ Add achievement notifications

All backend systems are complete and ready to integrate into your game!
