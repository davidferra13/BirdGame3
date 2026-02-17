/**
 * Currency Service
 * Manages the 4-tier currency economy:
 *
 * - Coins: Common currency earned from gameplay (hits × multiplier)
 * - Worms: Uncommon currency earned from skill-based activities
 * - Feathers: Rare currency earned from challenges, level-ups, big banks
 * - Golden Eggs: Legendary currency earned from achievements, mega banks, milestones
 *
 * Rules:
 * - Coins are lost partially when grounded (unbanked only)
 * - Coins become permanent when banked
 * - Worms, Feathers, Golden Eggs are never lost
 * - NO conversion between any currencies
 */

import { supabase } from './SupabaseClient';

export type CurrencyType = 'coins' | 'worms' | 'feathers' | 'golden_eggs';

export interface CurrencyBalance {
  coins: number;
  worms: number;
  feathers: number;
  golden_eggs: number;
}

/**
 * Get user's full currency balance
 */
export async function getCurrencyBalance(userId: string): Promise<CurrencyBalance | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('coins, worms, feathers, golden_eggs')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Failed to fetch currency balance:', error);
      return null;
    }

    return {
      coins: data.coins,
      worms: data.worms ?? 0,
      feathers: data.feathers,
      golden_eggs: data.golden_eggs ?? 0,
    };
  } catch (error) {
    console.error('Error getting currency balance:', error);
    return null;
  }
}

// ============================================================================
// Coins
// ============================================================================

/**
 * Add coins to user's account (server-side only)
 * Used after successful banking
 */
export async function addCoins(userId: string, amount: number): Promise<boolean> {
  if (amount <= 0) {
    console.error('Cannot add negative or zero coins');
    return false;
  }

  try {
    const { error } = await supabase.rpc('add_coins', {
      user_id: userId,
      amount: amount,
    });

    if (error) {
      console.error('Failed to add coins:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error adding coins:', error);
    return false;
  }
}

/**
 * Deduct coins from user's account
 * Used for shop purchases
 */
export async function deductCoins(userId: string, amount: number): Promise<boolean> {
  if (amount <= 0) {
    console.error('Cannot deduct negative or zero coins');
    return false;
  }

  try {
    const balance = await getCurrencyBalance(userId);
    if (!balance || balance.coins < amount) {
      console.error('Insufficient coins');
      return false;
    }

    const { error } = await supabase.rpc('deduct_coins', {
      user_id: userId,
      amount: amount,
    });

    if (error) {
      console.error('Failed to deduct coins:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deducting coins:', error);
    return false;
  }
}

// ============================================================================
// Worms
// ============================================================================

/**
 * Add worms to user's account
 * Earned from skill-based activities (scatter strikes, ring chains, etc.)
 */
export async function addWorms(userId: string, amount: number): Promise<boolean> {
  if (amount <= 0) {
    console.error('Cannot add negative or zero worms');
    return false;
  }

  try {
    const { error } = await supabase.rpc('add_worms', {
      user_id: userId,
      amount: amount,
    });

    if (error) {
      console.error('Failed to add worms:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error adding worms:', error);
    return false;
  }
}

/**
 * Deduct worms from user's account
 * Used for uncommon shop purchases
 */
export async function deductWorms(userId: string, amount: number): Promise<boolean> {
  if (amount <= 0) {
    console.error('Cannot deduct negative or zero worms');
    return false;
  }

  try {
    const balance = await getCurrencyBalance(userId);
    if (!balance || balance.worms < amount) {
      console.error('Insufficient worms');
      return false;
    }

    const { error } = await supabase.rpc('deduct_worms', {
      user_id: userId,
      amount: amount,
    });

    if (error) {
      console.error('Failed to deduct worms:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deducting worms:', error);
    return false;
  }
}

// ============================================================================
// Feathers
// ============================================================================

/**
 * Add feathers to user's account
 * Earned from challenges, level-ups, big banks
 */
export async function addFeathers(userId: string, amount: number): Promise<boolean> {
  if (amount <= 0) {
    console.error('Cannot add negative or zero feathers');
    return false;
  }

  try {
    const { error } = await supabase.rpc('add_feathers', {
      user_id: userId,
      amount: amount,
    });

    if (error) {
      console.error('Failed to add feathers:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error adding feathers:', error);
    return false;
  }
}

/**
 * Deduct feathers from user's account
 * Used for rare shop purchases
 */
export async function deductFeathers(userId: string, amount: number): Promise<boolean> {
  if (amount <= 0) {
    console.error('Cannot deduct negative or zero feathers');
    return false;
  }

  try {
    const balance = await getCurrencyBalance(userId);
    if (!balance || balance.feathers < amount) {
      console.error('Insufficient feathers');
      return false;
    }

    const { error } = await supabase.rpc('deduct_feathers', {
      user_id: userId,
      amount: amount,
    });

    if (error) {
      console.error('Failed to deduct feathers:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deducting feathers:', error);
    return false;
  }
}

// ============================================================================
// Golden Eggs
// ============================================================================

/**
 * Add golden eggs to user's account
 * Earned from achievements, mega banks, level milestones
 */
export async function addGoldenEggs(userId: string, amount: number): Promise<boolean> {
  if (amount <= 0) {
    console.error('Cannot add negative or zero golden eggs');
    return false;
  }

  try {
    const { error } = await supabase.rpc('add_golden_eggs', {
      user_id: userId,
      amount: amount,
    });

    if (error) {
      console.error('Failed to add golden eggs:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error adding golden eggs:', error);
    return false;
  }
}

/**
 * Deduct golden eggs from user's account
 * Used for legendary shop purchases
 */
export async function deductGoldenEggs(userId: string, amount: number): Promise<boolean> {
  if (amount <= 0) {
    console.error('Cannot deduct negative or zero golden eggs');
    return false;
  }

  try {
    const balance = await getCurrencyBalance(userId);
    if (!balance || balance.golden_eggs < amount) {
      console.error('Insufficient golden eggs');
      return false;
    }

    const { error } = await supabase.rpc('deduct_golden_eggs', {
      user_id: userId,
      amount: amount,
    });

    if (error) {
      console.error('Failed to deduct golden eggs:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deducting golden eggs:', error);
    return false;
  }
}

// ============================================================================
// Conversion Prevention
// ============================================================================

/**
 * FORBIDDEN: Conversion between any currencies
 */
export function convertCurrency(): never {
  throw new Error(
    'Currency conversion is forbidden. Each currency must be earned through its designated activities.'
  );
}
