-- ============================================================================
-- Stats Tracking Functions
-- Server-authoritative stat updates
-- ============================================================================

-- Increment NPC hits
CREATE OR REPLACE FUNCTION increment_npc_hits(user_id UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE lifetime_stats
  SET total_npc_hits = total_npc_hits + amount
  WHERE lifetime_stats.user_id = increment_npc_hits.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment player hits
CREATE OR REPLACE FUNCTION increment_player_hits(user_id UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE lifetime_stats
  SET total_player_hits = total_player_hits + amount
  WHERE lifetime_stats.user_id = increment_player_hits.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment groundings dealt
CREATE OR REPLACE FUNCTION increment_groundings_dealt(user_id UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE lifetime_stats
  SET total_groundings_dealt = total_groundings_dealt + amount
  WHERE lifetime_stats.user_id = increment_groundings_dealt.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment times grounded
CREATE OR REPLACE FUNCTION increment_times_grounded(user_id UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE lifetime_stats
  SET total_times_grounded = total_times_grounded + amount
  WHERE lifetime_stats.user_id = increment_times_grounded.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update highest heat (only if higher than current)
CREATE OR REPLACE FUNCTION update_highest_heat(user_id UUID, heat_value INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE lifetime_stats
  SET highest_heat_reached = GREATEST(highest_heat_reached, heat_value)
  WHERE lifetime_stats.user_id = update_highest_heat.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record banking (updates both biggest run and total)
CREATE OR REPLACE FUNCTION record_banking(user_id UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE lifetime_stats
  SET
    biggest_banked_run = GREATEST(biggest_banked_run, amount),
    total_banked_coins = total_banked_coins + amount
  WHERE lifetime_stats.user_id = record_banking.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add time played
CREATE OR REPLACE FUNCTION add_time_played(user_id UUID, seconds INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE lifetime_stats
  SET total_time_played = total_time_played + seconds
  WHERE lifetime_stats.user_id = add_time_played.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
