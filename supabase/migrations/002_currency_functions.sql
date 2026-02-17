-- ============================================================================
-- Currency Management Functions
-- Server-authoritative currency operations
-- ============================================================================

-- Add coins to user account
CREATE OR REPLACE FUNCTION add_coins(user_id UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET coins = coins + amount
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Deduct coins from user account
CREATE OR REPLACE FUNCTION deduct_coins(user_id UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET coins = GREATEST(coins - amount, 0)
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add feathers to user account
CREATE OR REPLACE FUNCTION add_feathers(user_id UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET feathers = feathers + amount
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Deduct feathers from user account
CREATE OR REPLACE FUNCTION deduct_feathers(user_id UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET feathers = GREATEST(feathers - amount, 0)
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
