-- ============================================================================
-- Bird Game 3D - Batch Stats RPC Functions
-- Server-authoritative functions for efficient stats updates
-- ============================================================================

-- ============================================================================
-- BATCH UPDATE FUNCTION
-- Primary method for syncing session stats to database
-- ============================================================================

CREATE OR REPLACE FUNCTION batch_update_stats(
  p_user_id UUID,
  session_data JSONB
)
RETURNS VOID AS $$
DECLARE
  v_npc_hits JSONB;
  v_flips JSONB;
  v_double_flips JSONB;
  v_combos JSONB;
  v_flight JSONB;
  v_collectibles JSONB;
  v_session JSONB;
BEGIN
  -- Extract nested JSONB objects
  v_npc_hits := session_data->'npc_hits';
  v_flips := session_data->'flips';
  v_double_flips := session_data->'double_flips';
  v_combos := session_data->'combos';
  v_flight := session_data->'flight';
  v_collectibles := session_data->'collectibles';
  v_session := session_data->'session';

  -- Update lifetime_stats (aggregate columns)
  UPDATE lifetime_stats SET
    total_npc_hits = total_npc_hits + COALESCE((v_session->>'total_hits')::BIGINT, 0),
    total_flips_performed = total_flips_performed +
      COALESCE((v_flips->>'front')::BIGINT, 0) +
      COALESCE((v_flips->>'back')::BIGINT, 0) +
      COALESCE((v_flips->>'left')::BIGINT, 0) +
      COALESCE((v_flips->>'right')::BIGINT, 0) +
      COALESCE((v_flips->>'corkscrewLeft')::BIGINT, 0) +
      COALESCE((v_flips->>'corkscrewRight')::BIGINT, 0) +
      COALESCE((v_flips->>'sideFlipLeft')::BIGINT, 0) +
      COALESCE((v_flips->>'sideFlipRight')::BIGINT, 0) +
      COALESCE((v_flips->>'inverted')::BIGINT, 0) +
      COALESCE((v_flips->>'aileronRoll')::BIGINT, 0),
    total_double_flips = total_double_flips +
      COALESCE((v_double_flips->>'front')::BIGINT, 0) +
      COALESCE((v_double_flips->>'back')::BIGINT, 0) +
      COALESCE((v_double_flips->>'barrelRoll')::BIGINT, 0),
    total_flight_rings_collected = total_flight_rings_collected + COALESCE((v_collectibles->>'flight_rings')::BIGINT, 0),
    total_golden_feathers_collected = total_golden_feathers_collected + COALESCE((v_collectibles->>'golden_feathers')::BIGINT, 0),
    total_thermal_updrafts_used = total_thermal_updrafts_used + COALESCE((v_collectibles->>'thermal_updrafts')::BIGINT, 0),
    total_boosts_used = total_boosts_used + COALESCE((v_flight->>'boosts_used')::BIGINT, 0),
    total_dives_performed = total_dives_performed + COALESCE((v_flight->>'dives_performed')::BIGINT, 0),
    total_dive_bombs_performed = total_dive_bombs_performed + COALESCE((v_flight->>'dive_bombs_performed')::BIGINT, 0),
    highest_altitude_reached = GREATEST(highest_altitude_reached, COALESCE((v_flight->>'max_altitude')::REAL, 0)),
    total_sessions_played = total_sessions_played + 1,
    longest_session_time = GREATEST(longest_session_time, COALESCE((v_session->>'duration')::INTEGER, 0)),
    total_distance_flown = total_distance_flown + COALESCE((v_flight->>'total_distance')::REAL, 0),
    total_items_grabbed = total_items_grabbed + COALESCE((v_collectibles->>'items_grabbed')::BIGINT, 0),
    highest_heat_reached = GREATEST(highest_heat_reached, COALESCE((v_session->>'highest_heat')::INTEGER, 0))
  WHERE user_id = p_user_id;

  -- Update npc_hit_stats
  UPDATE npc_hit_stats SET
    tourists_hit = tourists_hit + COALESCE((v_npc_hits->>'tourists')::BIGINT, 0),
    business_hit = business_hit + COALESCE((v_npc_hits->>'business')::BIGINT, 0),
    performers_hit = performers_hit + COALESCE((v_npc_hits->>'performers')::BIGINT, 0),
    police_hit = police_hit + COALESCE((v_npc_hits->>'police')::BIGINT, 0),
    chefs_hit = chefs_hit + COALESCE((v_npc_hits->>'chefs')::BIGINT, 0),
    treemen_hit = treemen_hit + COALESCE((v_npc_hits->>'treemen')::BIGINT, 0),
    glamorous_elegance_hit = glamorous_elegance_hit + COALESCE((v_npc_hits->>'glamorous_elegance')::BIGINT, 0)
  WHERE user_id = p_user_id;

  -- Update flip_stats
  UPDATE flip_stats SET
    front_flips = front_flips + COALESCE((v_flips->>'front')::BIGINT, 0),
    back_flips = back_flips + COALESCE((v_flips->>'back')::BIGINT, 0),
    left_barrel_rolls = left_barrel_rolls + COALESCE((v_flips->>'left')::BIGINT, 0),
    right_barrel_rolls = right_barrel_rolls + COALESCE((v_flips->>'right')::BIGINT, 0),
    corkscrew_left = corkscrew_left + COALESCE((v_flips->>'corkscrewLeft')::BIGINT, 0),
    corkscrew_right = corkscrew_right + COALESCE((v_flips->>'corkscrewRight')::BIGINT, 0),
    side_flip_left = side_flip_left + COALESCE((v_flips->>'sideFlipLeft')::BIGINT, 0),
    side_flip_right = side_flip_right + COALESCE((v_flips->>'sideFlipRight')::BIGINT, 0),
    inverted_flips = inverted_flips + COALESCE((v_flips->>'inverted')::BIGINT, 0),
    aileron_rolls = aileron_rolls + COALESCE((v_flips->>'aileronRoll')::BIGINT, 0),
    double_front_flips = double_front_flips + COALESCE((v_double_flips->>'front')::BIGINT, 0),
    double_back_flips = double_back_flips + COALESCE((v_double_flips->>'back')::BIGINT, 0),
    double_barrel_rolls = double_barrel_rolls + COALESCE((v_double_flips->>'barrelRoll')::BIGINT, 0)
  WHERE user_id = p_user_id;

  -- Update combo_stats
  UPDATE combo_stats SET
    double_combos = double_combos + COALESCE((v_combos->>'double')::BIGINT, 0),
    triple_combos = triple_combos + COALESCE((v_combos->>'triple')::BIGINT, 0),
    multi_kill_combos = multi_kill_combos + COALESCE((v_combos->>'multi')::BIGINT, 0),
    mega_combos = mega_combos + COALESCE((v_combos->>'mega')::BIGINT, 0),
    ultra_combos = ultra_combos + COALESCE((v_combos->>'ultra')::BIGINT, 0),
    legendary_combos = legendary_combos + COALESCE((v_combos->>'legendary')::BIGINT, 0),
    highest_streak = GREATEST(highest_streak, COALESCE((v_session->>'highest_streak')::INTEGER, 0))
  WHERE user_id = p_user_id;

  -- Update flight_stats
  UPDATE flight_stats SET
    max_speed_reached = GREATEST(max_speed_reached, COALESCE((v_flight->>'max_speed')::REAL, 0)),
    max_dive_speed_reached = GREATEST(max_dive_speed_reached, COALESCE((v_flight->>'max_speed')::REAL, 0)),
    total_boost_distance = total_boost_distance + COALESCE((v_flight->>'total_distance')::REAL, 0),
    time_diving = time_diving + COALESCE((v_flight->>'time_diving')::INTEGER, 0),
    time_boosting = time_boosting + COALESCE((v_flight->>'time_boosting')::INTEGER, 0)
  WHERE user_id = p_user_id;

  -- Update collectible_stats
  UPDATE collectible_stats SET
    flight_rings_collected = flight_rings_collected + COALESCE((v_collectibles->>'flight_rings')::BIGINT, 0),
    golden_feathers_collected = golden_feathers_collected + COALESCE((v_collectibles->>'golden_feathers')::BIGINT, 0),
    thermal_updrafts_used = thermal_updrafts_used + COALESCE((v_collectibles->>'thermal_updrafts')::BIGINT, 0),
    items_grabbed = items_grabbed + COALESCE((v_collectibles->>'items_grabbed')::BIGINT, 0)
  WHERE user_id = p_user_id;

  -- Update session_stats
  UPDATE session_stats SET
    total_sessions = total_sessions + 1,
    longest_session_seconds = GREATEST(longest_session_seconds, COALESCE((v_session->>'duration')::INTEGER, 0)),
    total_playtime_seconds = total_playtime_seconds + COALESCE((v_session->>'duration')::INTEGER, 0),
    most_coins_single_session = GREATEST(most_coins_single_session, COALESCE((v_session->>'total_coins_earned')::INTEGER, 0)),
    most_hits_single_session = GREATEST(most_hits_single_session, COALESCE((v_session->>'total_hits')::INTEGER, 0)),
    -- Calculate running averages
    avg_coins_per_session = (avg_coins_per_session * total_sessions + COALESCE((v_session->>'total_coins_earned')::REAL, 0)) / (total_sessions + 1),
    avg_hits_per_session = (avg_hits_per_session * total_sessions + COALESCE((v_session->>'total_hits')::REAL, 0)) / (total_sessions + 1),
    avg_flight_time_per_session = (avg_flight_time_per_session * total_sessions + COALESCE((v_session->>'duration')::REAL, 0)) / (total_sessions + 1)
  WHERE user_id = p_user_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GET ALL STATS FUNCTION
-- Fetch all stats for a user in a single query (for UI display)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_all_stats(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'lifetime', to_jsonb(ls.*),
    'npc_hits', to_jsonb(nhs.*),
    'flips', to_jsonb(fs.*),
    'combos', to_jsonb(cs.*),
    'flight', to_jsonb(fls.*),
    'collectibles', to_jsonb(cols.*),
    'sessions', to_jsonb(ss.*)
  )
  INTO v_result
  FROM lifetime_stats ls
  LEFT JOIN npc_hit_stats nhs ON nhs.user_id = ls.user_id
  LEFT JOIN flip_stats fs ON fs.user_id = ls.user_id
  LEFT JOIN combo_stats cs ON cs.user_id = ls.user_id
  LEFT JOIN flight_stats fls ON fls.user_id = ls.user_id
  LEFT JOIN collectible_stats cols ON cols.user_id = ls.user_id
  LEFT JOIN session_stats ss ON ss.user_id = ls.user_id
  WHERE ls.user_id = p_user_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- INDIVIDUAL INCREMENT FUNCTIONS (Optional - for real-time updates)
-- ============================================================================

-- Record a flip
CREATE OR REPLACE FUNCTION record_flip(
  p_user_id UUID,
  flip_type TEXT,
  is_double BOOLEAN DEFAULT FALSE
)
RETURNS VOID AS $$
BEGIN
  -- Update aggregate
  UPDATE lifetime_stats
  SET total_flips_performed = total_flips_performed + 1,
      total_double_flips = total_double_flips + CASE WHEN is_double THEN 1 ELSE 0 END
  WHERE user_id = p_user_id;

  -- Update specific flip type
  IF flip_type = 'front' THEN
    IF is_double THEN
      UPDATE flip_stats SET double_front_flips = double_front_flips + 1 WHERE user_id = p_user_id;
    ELSE
      UPDATE flip_stats SET front_flips = front_flips + 1 WHERE user_id = p_user_id;
    END IF;
  ELSIF flip_type = 'back' THEN
    IF is_double THEN
      UPDATE flip_stats SET double_back_flips = double_back_flips + 1 WHERE user_id = p_user_id;
    ELSE
      UPDATE flip_stats SET back_flips = back_flips + 1 WHERE user_id = p_user_id;
    END IF;
  ELSIF flip_type = 'left' THEN
    IF is_double THEN
      UPDATE flip_stats SET double_barrel_rolls = double_barrel_rolls + 1 WHERE user_id = p_user_id;
    ELSE
      UPDATE flip_stats SET left_barrel_rolls = left_barrel_rolls + 1 WHERE user_id = p_user_id;
    END IF;
  ELSIF flip_type = 'right' THEN
    IF is_double THEN
      UPDATE flip_stats SET double_barrel_rolls = double_barrel_rolls + 1 WHERE user_id = p_user_id;
    ELSE
      UPDATE flip_stats SET right_barrel_rolls = right_barrel_rolls + 1 WHERE user_id = p_user_id;
    END IF;
  ELSIF flip_type = 'corkscrewLeft' THEN
    UPDATE flip_stats SET corkscrew_left = corkscrew_left + 1 WHERE user_id = p_user_id;
  ELSIF flip_type = 'corkscrewRight' THEN
    UPDATE flip_stats SET corkscrew_right = corkscrew_right + 1 WHERE user_id = p_user_id;
  ELSIF flip_type = 'sideFlipLeft' THEN
    UPDATE flip_stats SET side_flip_left = side_flip_left + 1 WHERE user_id = p_user_id;
  ELSIF flip_type = 'sideFlipRight' THEN
    UPDATE flip_stats SET side_flip_right = side_flip_right + 1 WHERE user_id = p_user_id;
  ELSIF flip_type = 'inverted' THEN
    UPDATE flip_stats SET inverted_flips = inverted_flips + 1 WHERE user_id = p_user_id;
  ELSIF flip_type = 'aileronRoll' THEN
    UPDATE flip_stats SET aileron_rolls = aileron_rolls + 1 WHERE user_id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record combo tier achieved
CREATE OR REPLACE FUNCTION record_combo_tier(
  p_user_id UUID,
  tier_name TEXT,
  streak_value INTEGER
)
RETURNS VOID AS $$
BEGIN
  -- Update highest streak
  UPDATE combo_stats
  SET highest_streak = GREATEST(highest_streak, streak_value)
  WHERE user_id = p_user_id;

  -- Increment specific tier counter
  IF tier_name = 'double' THEN
    UPDATE combo_stats SET double_combos = double_combos + 1 WHERE user_id = p_user_id;
  ELSIF tier_name = 'triple' THEN
    UPDATE combo_stats SET triple_combos = triple_combos + 1 WHERE user_id = p_user_id;
  ELSIF tier_name = 'multi' THEN
    UPDATE combo_stats SET multi_kill_combos = multi_kill_combos + 1 WHERE user_id = p_user_id;
  ELSIF tier_name = 'mega' THEN
    UPDATE combo_stats SET mega_combos = mega_combos + 1 WHERE user_id = p_user_id;
  ELSIF tier_name = 'ultra' THEN
    UPDATE combo_stats SET ultra_combos = ultra_combos + 1 WHERE user_id = p_user_id;
  ELSIF tier_name = 'legendary' THEN
    UPDATE combo_stats SET legendary_combos = legendary_combos + 1 WHERE user_id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record collectible collected
CREATE OR REPLACE FUNCTION record_collectible(
  p_user_id UUID,
  collectible_type TEXT
)
RETURNS VOID AS $$
BEGIN
  IF collectible_type = 'flight_rings' THEN
    UPDATE collectible_stats SET flight_rings_collected = flight_rings_collected + 1 WHERE user_id = p_user_id;
    UPDATE lifetime_stats SET total_flight_rings_collected = total_flight_rings_collected + 1 WHERE user_id = p_user_id;
  ELSIF collectible_type = 'golden_feathers' THEN
    UPDATE collectible_stats SET golden_feathers_collected = golden_feathers_collected + 1 WHERE user_id = p_user_id;
    UPDATE lifetime_stats SET total_golden_feathers_collected = total_golden_feathers_collected + 1 WHERE user_id = p_user_id;
  ELSIF collectible_type = 'thermal_updrafts' THEN
    UPDATE collectible_stats SET thermal_updrafts_used = thermal_updrafts_used + 1 WHERE user_id = p_user_id;
    UPDATE lifetime_stats SET total_thermal_updrafts_used = total_thermal_updrafts_used + 1 WHERE user_id = p_user_id;
  ELSIF collectible_type = 'items_grabbed' THEN
    UPDATE collectible_stats SET items_grabbed = items_grabbed + 1 WHERE user_id = p_user_id;
    UPDATE lifetime_stats SET total_items_grabbed = total_items_grabbed + 1 WHERE user_id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
