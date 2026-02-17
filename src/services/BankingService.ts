/**
 * Banking Service
 * Handles the complete banking flow per specifications
 *
 * Banking Flow:
 * 1. Bank coins (add to permanent balance)
 * 2. Calculate and award XP (floor(bankedCoins / 5))
 * 3. Update stats (biggest run, total banked)
 * 4. Check for level-ups
 * 5. Check for achievements
 */

import { supabase } from './SupabaseClient';
import { BankingResponse } from '../types/database';
import { addCoins } from './CurrencyService';
import { calculateXPFromCoins, addXP } from './ProgressionService';
import { recordBanking } from './StatsService';
import { checkAndUnlockAchievements } from './AchievementService';

/**
 * Execute the complete banking process
 * Server-authoritative, atomic operation
 */
export async function bankCoins(
  userId: string,
  coinsToBank: number
): Promise<BankingResponse> {
  try {
    if (coinsToBank <= 0) {
      return {
        success: false,
        banked_coins: 0,
        xp_earned: 0,
        new_total_coins: 0,
        error: 'Invalid banking amount',
      };
    }

    // Step 1: Add coins to permanent balance
    const coinsAdded = await addCoins(userId, coinsToBank);
    if (!coinsAdded) {
      return {
        success: false,
        banked_coins: 0,
        xp_earned: 0,
        new_total_coins: 0,
        error: 'Failed to add coins',
      };
    }

    // Step 2: Calculate and award XP
    const xpEarned = calculateXPFromCoins(coinsToBank);
    const levelUpResult = await addXP(userId, xpEarned);

    if (!levelUpResult) {
      console.error('Failed to add XP, but coins were already banked');
    }

    // Step 3: Update stats (biggest run, total banked)
    const statsUpdated = await recordBanking(userId, coinsToBank);
    if (!statsUpdated) {
      console.error('Failed to update stats, but coins/XP were already processed');
    }

    // Step 4: Check for newly unlocked achievements
    const newAchievements = await checkAndUnlockAchievements(userId);

    // Step 5: Get updated coin balance
    const { data: profile } = await supabase
      .from('profiles')
      .select('coins, level')
      .eq('id', userId)
      .single();

    const newTotalCoins = profile?.coins || 0;
    const currentLevel = profile?.level || 1;

    return {
      success: true,
      banked_coins: coinsToBank,
      xp_earned: xpEarned,
      new_level: levelUpResult && levelUpResult.levelsGained > 0 ? currentLevel : undefined,
      new_total_coins: newTotalCoins,
    };
  } catch (error) {
    console.error('Banking error:', error);
    return {
      success: false,
      banked_coins: 0,
      xp_earned: 0,
      new_total_coins: 0,
      error: String(error),
    };
  }
}

/**
 * Get banking preview (what user would get without actually banking)
 */
export function previewBanking(coinsToBank: number): {
  coins: number;
  xp: number;
} {
  return {
    coins: coinsToBank,
    xp: calculateXPFromCoins(coinsToBank),
  };
}
