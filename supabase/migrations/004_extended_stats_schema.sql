-- ============================================================================
-- Bird Game 3D - Extended Statistics Schema
-- Adds 100+ comprehensive player statistics tracking
-- ============================================================================

-- ============================================================================
-- EXTEND LIFETIME_STATS TABLE
-- Add 20 aggregate columns for frequently accessed stats
-- ============================================================================

ALTER TABLE lifetime_stats
  ADD COLUMN IF NOT EXISTS total_flips_performed BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_double_flips BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_flight_rings_collected BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_golden_feathers_collected BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_thermal_updrafts_used BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_boosts_used BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_dives_performed BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_dive_bombs_performed BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_flight_time INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS highest_altitude_reached REAL NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_crashes BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_safe_landings BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_banks INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS average_banking_amount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS highest_combo_tier_reached INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_combo_tier_achievements BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_sessions_played INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_session_time INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_distance_flown REAL NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_items_grabbed BIGINT NOT NULL DEFAULT 0;

-- Update constraint to include new columns
ALTER TABLE lifetime_stats DROP CONSTRAINT IF EXISTS stats_non_negative;
ALTER TABLE lifetime_stats ADD CONSTRAINT stats_non_negative CHECK (
  total_npc_hits >= 0 AND
  total_player_hits >= 0 AND
  total_groundings_dealt >= 0 AND
  total_times_grounded >= 0 AND
  highest_heat_reached >= 0 AND
  biggest_banked_run >= 0 AND
  total_banked_coins >= 0 AND
  total_time_played >= 0 AND
  total_flips_performed >= 0 AND
  total_double_flips >= 0 AND
  total_flight_rings_collected >= 0 AND
  total_golden_feathers_collected >= 0 AND
  total_thermal_updrafts_used >= 0 AND
  total_boosts_used >= 0 AND
  total_dives_performed >= 0 AND
  total_dive_bombs_performed >= 0 AND
  longest_flight_time >= 0 AND
  highest_altitude_reached >= 0 AND
  total_crashes >= 0 AND
  total_safe_landings >= 0 AND
  total_banks >= 0 AND
  average_banking_amount >= 0 AND
  highest_combo_tier_reached >= 0 AND
  total_combo_tier_achievements >= 0 AND
  total_sessions_played >= 0 AND
  longest_session_time >= 0 AND
  total_distance_flown >= 0 AND
  total_items_grabbed >= 0
);

-- ============================================================================
-- NPC HIT STATS TABLE
-- Detailed tracking of NPC hits by type and context
-- ============================================================================

CREATE TABLE IF NOT EXISTS npc_hit_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- By NPC Type (7 types)
  tourists_hit BIGINT NOT NULL DEFAULT 0,
  business_hit BIGINT NOT NULL DEFAULT 0,
  performers_hit BIGINT NOT NULL DEFAULT 0,
  police_hit BIGINT NOT NULL DEFAULT 0,
  chefs_hit BIGINT NOT NULL DEFAULT 0,
  treemen_hit BIGINT NOT NULL DEFAULT 0,
  glamorous_elegance_hit BIGINT NOT NULL DEFAULT 0,

  -- Hit Context
  hits_while_diving BIGINT NOT NULL DEFAULT 0,
  hits_while_boosting BIGINT NOT NULL DEFAULT 0,
  hits_from_high_altitude BIGINT NOT NULL DEFAULT 0,
  hits_from_low_altitude BIGINT NOT NULL DEFAULT 0,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT npc_hit_stats_non_negative CHECK (
    tourists_hit >= 0 AND
    business_hit >= 0 AND
    performers_hit >= 0 AND
    police_hit >= 0 AND
    chefs_hit >= 0 AND
    treemen_hit >= 0 AND
    glamorous_elegance_hit >= 0 AND
    hits_while_diving >= 0 AND
    hits_while_boosting >= 0 AND
    hits_from_high_altitude >= 0 AND
    hits_from_low_altitude >= 0
  )
);

-- ============================================================================
-- FLIP STATS TABLE
-- Detailed tracking of all flip types and combos
-- ============================================================================

CREATE TABLE IF NOT EXISTS flip_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- By Flip Type (10 types)
  front_flips BIGINT NOT NULL DEFAULT 0,
  back_flips BIGINT NOT NULL DEFAULT 0,
  left_barrel_rolls BIGINT NOT NULL DEFAULT 0,
  right_barrel_rolls BIGINT NOT NULL DEFAULT 0,
  corkscrew_left BIGINT NOT NULL DEFAULT 0,
  corkscrew_right BIGINT NOT NULL DEFAULT 0,
  side_flip_left BIGINT NOT NULL DEFAULT 0,
  side_flip_right BIGINT NOT NULL DEFAULT 0,
  inverted_flips BIGINT NOT NULL DEFAULT 0,
  aileron_rolls BIGINT NOT NULL DEFAULT 0,

  -- Double Flip Variants
  double_front_flips BIGINT NOT NULL DEFAULT 0,
  double_back_flips BIGINT NOT NULL DEFAULT 0,
  double_barrel_rolls BIGINT NOT NULL DEFAULT 0,

  -- Flip Combos
  max_flip_combo INTEGER NOT NULL DEFAULT 0,
  total_flip_combos BIGINT NOT NULL DEFAULT 0,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT flip_stats_non_negative CHECK (
    front_flips >= 0 AND
    back_flips >= 0 AND
    left_barrel_rolls >= 0 AND
    right_barrel_rolls >= 0 AND
    corkscrew_left >= 0 AND
    corkscrew_right >= 0 AND
    side_flip_left >= 0 AND
    side_flip_right >= 0 AND
    inverted_flips >= 0 AND
    aileron_rolls >= 0 AND
    double_front_flips >= 0 AND
    double_back_flips >= 0 AND
    double_barrel_rolls >= 0 AND
    max_flip_combo >= 0 AND
    total_flip_combos >= 0
  )
);

-- ============================================================================
-- COMBO STATS TABLE
-- Detailed tracking of combo tiers and streaks
-- ============================================================================

CREATE TABLE IF NOT EXISTS combo_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- By Combo Tier (6 tiers)
  double_combos BIGINT NOT NULL DEFAULT 0,      -- 2x streak
  triple_combos BIGINT NOT NULL DEFAULT 0,      -- 3x streak
  multi_kill_combos BIGINT NOT NULL DEFAULT 0,  -- 5x streak
  mega_combos BIGINT NOT NULL DEFAULT 0,        -- 8x streak
  ultra_combos BIGINT NOT NULL DEFAULT 0,       -- 12x streak
  legendary_combos BIGINT NOT NULL DEFAULT 0,   -- 20x streak

  -- Combo Performance
  highest_streak INTEGER NOT NULL DEFAULT 0,
  total_streak_breaks BIGINT NOT NULL DEFAULT 0,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT combo_stats_non_negative CHECK (
    double_combos >= 0 AND
    triple_combos >= 0 AND
    multi_kill_combos >= 0 AND
    mega_combos >= 0 AND
    ultra_combos >= 0 AND
    legendary_combos >= 0 AND
    highest_streak >= 0 AND
    total_streak_breaks >= 0
  )
);

-- ============================================================================
-- FLIGHT STATS TABLE
-- Detailed tracking of flight performance and states
-- ============================================================================

CREATE TABLE IF NOT EXISTS flight_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Speed Records
  max_speed_reached REAL NOT NULL DEFAULT 0,
  max_dive_speed_reached REAL NOT NULL DEFAULT 0,
  total_boost_distance REAL NOT NULL DEFAULT 0,

  -- Time in Air States (seconds)
  time_diving INTEGER NOT NULL DEFAULT 0,
  time_boosting INTEGER NOT NULL DEFAULT 0,
  time_hovering INTEGER NOT NULL DEFAULT 0,
  time_perched INTEGER NOT NULL DEFAULT 0,

  -- Altitude Stats (seconds)
  time_above_100m INTEGER NOT NULL DEFAULT 0,
  time_below_20m INTEGER NOT NULL DEFAULT 0,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT flight_stats_non_negative CHECK (
    max_speed_reached >= 0 AND
    max_dive_speed_reached >= 0 AND
    total_boost_distance >= 0 AND
    time_diving >= 0 AND
    time_boosting >= 0 AND
    time_hovering >= 0 AND
    time_perched >= 0 AND
    time_above_100m >= 0 AND
    time_below_20m >= 0
  )
);

-- ============================================================================
-- COLLECTIBLE STATS TABLE
-- Detailed tracking of collectibles and grabs
-- ============================================================================

CREATE TABLE IF NOT EXISTS collectible_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Collectibles
  flight_rings_collected BIGINT NOT NULL DEFAULT 0,
  golden_feathers_collected BIGINT NOT NULL DEFAULT 0,
  thermal_updrafts_used BIGINT NOT NULL DEFAULT 0,

  -- Grab System
  items_grabbed BIGINT NOT NULL DEFAULT 0,
  grabs_missed BIGINT NOT NULL DEFAULT 0,
  longest_grab_chain INTEGER NOT NULL DEFAULT 0,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT collectible_stats_non_negative CHECK (
    flight_rings_collected >= 0 AND
    golden_feathers_collected >= 0 AND
    thermal_updrafts_used >= 0 AND
    items_grabbed >= 0 AND
    grabs_missed >= 0 AND
    longest_grab_chain >= 0
  )
);

-- ============================================================================
-- SESSION STATS TABLE
-- Detailed tracking of session performance
-- ============================================================================

CREATE TABLE IF NOT EXISTS session_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Session Tracking
  total_sessions INTEGER NOT NULL DEFAULT 0,
  longest_session_seconds INTEGER NOT NULL DEFAULT 0,
  total_playtime_seconds INTEGER NOT NULL DEFAULT 0,

  -- Performance Averages
  avg_coins_per_session REAL NOT NULL DEFAULT 0,
  avg_hits_per_session REAL NOT NULL DEFAULT 0,
  avg_flight_time_per_session REAL NOT NULL DEFAULT 0,

  -- Best Session Records
  most_coins_single_session INTEGER NOT NULL DEFAULT 0,
  most_hits_single_session INTEGER NOT NULL DEFAULT 0,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT session_stats_non_negative CHECK (
    total_sessions >= 0 AND
    longest_session_seconds >= 0 AND
    total_playtime_seconds >= 0 AND
    avg_coins_per_session >= 0 AND
    avg_hits_per_session >= 0 AND
    avg_flight_time_per_session >= 0 AND
    most_coins_single_session >= 0 AND
    most_hits_single_session >= 0
  )
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_npc_hit_stats_user ON npc_hit_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_flip_stats_user ON flip_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_combo_stats_user ON combo_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_flight_stats_user ON flight_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_collectible_stats_user ON collectible_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_session_stats_user ON session_stats(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- NPC Hit Stats
ALTER TABLE npc_hit_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own npc hit stats"
  ON npc_hit_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own npc hit stats"
  ON npc_hit_stats FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own npc hit stats"
  ON npc_hit_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Flip Stats
ALTER TABLE flip_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own flip stats"
  ON flip_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own flip stats"
  ON flip_stats FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own flip stats"
  ON flip_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Combo Stats
ALTER TABLE combo_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own combo stats"
  ON combo_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own combo stats"
  ON combo_stats FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own combo stats"
  ON combo_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Flight Stats
ALTER TABLE flight_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own flight stats"
  ON flight_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own flight stats"
  ON flight_stats FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own flight stats"
  ON flight_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Collectible Stats
ALTER TABLE collectible_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own collectible stats"
  ON collectible_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own collectible stats"
  ON collectible_stats FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own collectible stats"
  ON collectible_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Session Stats
ALTER TABLE session_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own session stats"
  ON session_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own session stats"
  ON session_stats FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own session stats"
  ON session_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamps
CREATE TRIGGER update_npc_hit_stats_updated_at
  BEFORE UPDATE ON npc_hit_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_flip_stats_updated_at
  BEFORE UPDATE ON flip_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_combo_stats_updated_at
  BEFORE UPDATE ON combo_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_flight_stats_updated_at
  BEFORE UPDATE ON flight_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collectible_stats_updated_at
  BEFORE UPDATE ON collectible_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_session_stats_updated_at
  BEFORE UPDATE ON session_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- UPDATE PROFILE CREATION TRIGGER
-- Auto-create all stats tables when user signs up
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

  -- Create lifetime stats record
  INSERT INTO lifetime_stats (user_id)
  VALUES (NEW.id);

  -- Create all new stats records
  INSERT INTO npc_hit_stats (user_id) VALUES (NEW.id);
  INSERT INTO flip_stats (user_id) VALUES (NEW.id);
  INSERT INTO combo_stats (user_id) VALUES (NEW.id);
  INSERT INTO flight_stats (user_id) VALUES (NEW.id);
  INSERT INTO collectible_stats (user_id) VALUES (NEW.id);
  INSERT INTO session_stats (user_id) VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- BACKFILL EXISTING USERS
-- Create stats records for users who already exist
-- ============================================================================

INSERT INTO npc_hit_stats (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO flip_stats (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO combo_stats (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO flight_stats (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO collectible_stats (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO session_stats (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
