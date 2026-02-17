-- ============================================================================
-- Bird Game 3D - Initial Database Schema
-- Implements DATA_MODEL_DATABASE.md specification
-- ============================================================================

-- Enable UUID extension (use gen_random_uuid() which is built-in to PG13+)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PROFILES TABLE
-- Core user profile data
-- ============================================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  coins INTEGER NOT NULL DEFAULT 0,
  feathers INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 20),
  CONSTRAINT level_bounds CHECK (level >= 1 AND level <= 50),
  CONSTRAINT xp_non_negative CHECK (xp >= 0),
  CONSTRAINT coins_non_negative CHECK (coins >= 0),
  CONSTRAINT feathers_non_negative CHECK (feathers >= 0)
);

-- ============================================================================
-- LIFETIME_STATS TABLE
-- Tracks all-time player statistics
-- ============================================================================

CREATE TABLE lifetime_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_npc_hits BIGINT NOT NULL DEFAULT 0,
  total_player_hits BIGINT NOT NULL DEFAULT 0,
  total_groundings_dealt BIGINT NOT NULL DEFAULT 0,
  total_times_grounded BIGINT NOT NULL DEFAULT 0,
  highest_heat_reached INTEGER NOT NULL DEFAULT 0,
  biggest_banked_run INTEGER NOT NULL DEFAULT 0,
  total_banked_coins BIGINT NOT NULL DEFAULT 0,
  total_time_played INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT stats_non_negative CHECK (
    total_npc_hits >= 0 AND
    total_player_hits >= 0 AND
    total_groundings_dealt >= 0 AND
    total_times_grounded >= 0 AND
    highest_heat_reached >= 0 AND
    biggest_banked_run >= 0 AND
    total_banked_coins >= 0 AND
    total_time_played >= 0
  )
);

-- ============================================================================
-- INVENTORY TABLE
-- Items owned by players
-- ============================================================================

CREATE TYPE cosmetic_type AS ENUM ('title', 'banner_frame', 'skin', 'trail', 'splat', 'emote');

CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  item_type cosmetic_type NOT NULL,
  equipped BOOLEAN NOT NULL DEFAULT FALSE,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, item_id, item_type)
);

-- ============================================================================
-- PURCHASES TABLE
-- Purchase history (idempotency & audit trail)
-- ============================================================================

CREATE TYPE currency_type AS ENUM ('coins', 'feathers');

CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  item_type cosmetic_type NOT NULL,
  currency_type currency_type NOT NULL,
  amount INTEGER NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT amount_positive CHECK (amount > 0)
);

CREATE INDEX idx_purchases_user ON purchases(user_id);
CREATE INDEX idx_purchases_user_item ON purchases(user_id, item_id, item_type);

-- ============================================================================
-- ACHIEVEMENTS TABLE
-- Unlocked achievements per user
-- ============================================================================

CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, achievement_id)
);

-- ============================================================================
-- CHALLENGE_PROGRESS TABLE
-- Progress tracking for challenges/quests (future expansion)
-- ============================================================================

CREATE TABLE challenge_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,

  UNIQUE(user_id, challenge_id),
  CONSTRAINT progress_non_negative CHECK (progress >= 0)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_inventory_user ON inventory(user_id);
CREATE INDEX idx_inventory_user_equipped ON inventory(user_id) WHERE equipped = TRUE;
CREATE INDEX idx_achievements_user ON achievements(user_id);
CREATE INDEX idx_challenge_progress_user ON challenge_progress(user_id);
CREATE INDEX idx_lifetime_stats_user ON lifetime_stats(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Users can only read/write their own data
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE lifetime_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_progress ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Lifetime stats policies
CREATE POLICY "Users can view their own stats"
  ON lifetime_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own stats"
  ON lifetime_stats FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stats"
  ON lifetime_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Inventory policies
CREATE POLICY "Users can view their own inventory"
  ON inventory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert to their own inventory"
  ON inventory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own inventory"
  ON inventory FOR UPDATE
  USING (auth.uid() = user_id);

-- Purchases policies (read-only for users)
CREATE POLICY "Users can view their own purchases"
  ON purchases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert purchases"
  ON purchases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Achievements policies
CREATE POLICY "Users can view their own achievements"
  ON achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert achievements"
  ON achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Challenge progress policies
CREATE POLICY "Users can view their own challenge progress"
  ON challenge_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own challenge progress"
  ON challenge_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own challenge progress"
  ON challenge_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lifetime_stats_updated_at
  BEFORE UPDATE ON lifetime_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INITIAL PROFILE CREATION TRIGGER
-- Auto-create profile and stats when user signs up
-- ============================================================================

CREATE OR REPLACE FUNCTION create_profile_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile with default username (user can change later)
  INSERT INTO profiles (id, username)
  VALUES (
    NEW.id,
    'Player_' || substring(NEW.id::text from 1 for 8)
  );

  -- Create stats record
  INSERT INTO lifetime_stats (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_profile_for_new_user();
