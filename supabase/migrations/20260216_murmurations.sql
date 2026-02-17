-- ============================================================================
-- Murmurations Feature — Database Migration
-- Creates 5 new tables for the clan/group system.
-- ============================================================================

-- ============================================================================
-- 1. murmurations — Main group table
-- ============================================================================
CREATE TABLE IF NOT EXISTS murmurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tag text NOT NULL,
  description text,
  privacy text NOT NULL DEFAULT 'open' CHECK (privacy IN ('open', 'invite_only', 'closed')),
  alpha_id uuid NOT NULL REFERENCES auth.users(id),
  formation_level integer NOT NULL DEFAULT 1 CHECK (formation_level BETWEEN 1 AND 10),
  formation_xp bigint NOT NULL DEFAULT 0,
  emblem_config jsonb NOT NULL DEFAULT '{"background":"circle","icon":"bird_silhouette","border":"thin","fgColor":"#ffffff","bgColor":"#4488ff"}'::jsonb,
  member_count integer NOT NULL DEFAULT 1,
  total_coins_banked bigint NOT NULL DEFAULT 0,
  season_coins_banked bigint NOT NULL DEFAULT 0,
  mvm_wins integer NOT NULL DEFAULT 0,
  mvm_losses integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive unique indexes for name and tag
CREATE UNIQUE INDEX IF NOT EXISTS murmurations_name_lower_idx ON murmurations (LOWER(name));
CREATE UNIQUE INDEX IF NOT EXISTS murmurations_tag_lower_idx ON murmurations (LOWER(tag));

-- Constraint: name length 3-24
ALTER TABLE murmurations ADD CONSTRAINT murmurations_name_length CHECK (char_length(name) BETWEEN 3 AND 24);

-- Constraint: tag length 2-4, stored uppercase
ALTER TABLE murmurations ADD CONSTRAINT murmurations_tag_length CHECK (char_length(tag) BETWEEN 2 AND 4);
ALTER TABLE murmurations ADD CONSTRAINT murmurations_tag_uppercase CHECK (tag = UPPER(tag));

-- Constraint: description max 200 chars
ALTER TABLE murmurations ADD CONSTRAINT murmurations_desc_length CHECK (description IS NULL OR char_length(description) <= 200);

-- ============================================================================
-- 2. murmuration_members — Member roster
-- ============================================================================
CREATE TABLE IF NOT EXISTS murmuration_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  murmuration_id uuid NOT NULL REFERENCES murmurations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL DEFAULT 'fledgling' CHECK (role IN ('alpha', 'sentinel', 'fledgling')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  coins_contributed bigint NOT NULL DEFAULT 0,
  formation_xp_contributed bigint NOT NULL DEFAULT 0
);

-- One murmuration per player
CREATE UNIQUE INDEX IF NOT EXISTS murmuration_members_user_unique ON murmuration_members (user_id);

-- Index for fast roster lookups
CREATE INDEX IF NOT EXISTS murmuration_members_murmuration_idx ON murmuration_members (murmuration_id);

-- ============================================================================
-- 3. murmuration_invites — Invite management
-- ============================================================================
CREATE TABLE IF NOT EXISTS murmuration_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  murmuration_id uuid NOT NULL REFERENCES murmurations(id) ON DELETE CASCADE,
  invited_user_id uuid NOT NULL REFERENCES auth.users(id),
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS murmuration_invites_user_idx ON murmuration_invites (invited_user_id, status);
CREATE INDEX IF NOT EXISTS murmuration_invites_murmuration_idx ON murmuration_invites (murmuration_id, status);

-- ============================================================================
-- 4. murmuration_challenges — Group challenges
-- ============================================================================
CREATE TABLE IF NOT EXISTS murmuration_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  murmuration_id uuid NOT NULL REFERENCES murmurations(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('daily', 'weekly', 'milestone')),
  objective jsonb NOT NULL DEFAULT '{}'::jsonb,
  progress jsonb NOT NULL DEFAULT '{"total":0,"contributions":[]}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS murmuration_challenges_active_idx ON murmuration_challenges (murmuration_id, status) WHERE status = 'active';

-- ============================================================================
-- 5. player_murmuration_cooldowns — Join cooldown tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS player_murmuration_cooldowns (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  cooldown_expires_at timestamptz NOT NULL
);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE murmurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE murmuration_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE murmuration_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE murmuration_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_murmuration_cooldowns ENABLE ROW LEVEL SECURITY;

-- murmurations: anyone can read, only alpha can update, authenticated can insert
CREATE POLICY "murmurations_select" ON murmurations FOR SELECT USING (true);
CREATE POLICY "murmurations_insert" ON murmurations FOR INSERT WITH CHECK (auth.uid() = alpha_id);
CREATE POLICY "murmurations_update" ON murmurations FOR UPDATE USING (auth.uid() = alpha_id);
CREATE POLICY "murmurations_delete" ON murmurations FOR DELETE USING (auth.uid() = alpha_id);

-- murmuration_members: anyone can read roster, members can insert/delete own
CREATE POLICY "members_select" ON murmuration_members FOR SELECT USING (true);
CREATE POLICY "members_insert" ON murmuration_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "members_delete" ON murmuration_members FOR DELETE USING (
  auth.uid() = user_id  -- leave yourself
  OR auth.uid() IN (     -- or alpha/sentinel can kick
    SELECT mm.user_id FROM murmuration_members mm
    WHERE mm.murmuration_id = murmuration_members.murmuration_id
    AND mm.role IN ('alpha', 'sentinel')
  )
);
CREATE POLICY "members_update" ON murmuration_members FOR UPDATE USING (
  auth.uid() IN (
    SELECT mm.user_id FROM murmuration_members mm
    WHERE mm.murmuration_id = murmuration_members.murmuration_id
    AND mm.role = 'alpha'
  )
);

-- murmuration_invites: invited user and murmuration members can read
CREATE POLICY "invites_select" ON murmuration_invites FOR SELECT USING (
  auth.uid() = invited_user_id
  OR auth.uid() = invited_by
  OR auth.uid() IN (
    SELECT mm.user_id FROM murmuration_members mm
    WHERE mm.murmuration_id = murmuration_invites.murmuration_id
    AND mm.role IN ('alpha', 'sentinel')
  )
);
CREATE POLICY "invites_insert" ON murmuration_invites FOR INSERT WITH CHECK (
  auth.uid() IN (
    SELECT mm.user_id FROM murmuration_members mm
    WHERE mm.murmuration_id = murmuration_invites.murmuration_id
    AND mm.role IN ('alpha', 'sentinel')
  )
);
CREATE POLICY "invites_update" ON murmuration_invites FOR UPDATE USING (
  auth.uid() = invited_user_id
  OR auth.uid() = invited_by
);

-- murmuration_challenges: anyone can read, members can update progress
CREATE POLICY "challenges_select" ON murmuration_challenges FOR SELECT USING (true);
CREATE POLICY "challenges_update" ON murmuration_challenges FOR UPDATE USING (
  auth.uid() IN (
    SELECT mm.user_id FROM murmuration_members mm
    WHERE mm.murmuration_id = murmuration_challenges.murmuration_id
  )
);
CREATE POLICY "challenges_insert" ON murmuration_challenges FOR INSERT WITH CHECK (
  auth.uid() IN (
    SELECT mm.user_id FROM murmuration_members mm
    WHERE mm.murmuration_id = murmuration_challenges.murmuration_id
    AND mm.role IN ('alpha', 'sentinel')
  )
);

-- player_murmuration_cooldowns: players can read/write own cooldown
CREATE POLICY "cooldowns_select" ON player_murmuration_cooldowns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cooldowns_insert" ON player_murmuration_cooldowns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cooldowns_update" ON player_murmuration_cooldowns FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- Atomic increment functions (for race-condition-safe updates)
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_formation_xp(mur_id uuid, amount bigint)
RETURNS void AS $$
BEGIN
  UPDATE murmurations
  SET formation_xp = formation_xp + amount
  WHERE id = mur_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_murmuration_coins(mur_id uuid, coins_amount bigint, season_amount bigint)
RETURNS void AS $$
BEGIN
  UPDATE murmurations
  SET total_coins_banked = total_coins_banked + coins_amount,
      season_coins_banked = season_coins_banked + season_amount
  WHERE id = mur_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_member_contribution(member_user_id uuid, coins bigint, xp bigint)
RETURNS void AS $$
BEGIN
  UPDATE murmuration_members
  SET coins_contributed = coins_contributed + coins,
      formation_xp_contributed = formation_xp_contributed + xp
  WHERE user_id = member_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_mvm_result(mur_id uuid, is_win boolean)
RETURNS void AS $$
BEGIN
  IF is_win THEN
    UPDATE murmurations SET mvm_wins = mvm_wins + 1 WHERE id = mur_id;
  ELSE
    UPDATE murmurations SET mvm_losses = mvm_losses + 1 WHERE id = mur_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_murmuration_member_count(mur_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE murmurations
  SET member_count = (
    SELECT COUNT(*) FROM murmuration_members WHERE murmuration_id = mur_id
  )
  WHERE id = mur_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Season reset function (call via cron or manual trigger)
-- ============================================================================

CREATE OR REPLACE FUNCTION reset_murmuration_season()
RETURNS void AS $$
BEGIN
  UPDATE murmurations SET season_coins_banked = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
