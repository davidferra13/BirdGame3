/**
 * Progression Service
 * Implements PLAYER_PROGRESSION.md specification
 *
 * Rules:
 * - XP is awarded only when banking succeeds
 * - xpEarned = floor(bankedCoins / 5)
 * - Level curve: nextLevelXpReq = round(prevLevelXpReq * 1.15)
 * - Level cap: 50
 * - Levels unlock cosmetics only (no power)
 */

import { supabase } from './SupabaseClient';
import { PROGRESSION, ECONOMY } from '../utils/Constants';

export interface LevelUpResult {
  levelsGained: number;
  newLevel: number;
  unlockedCosmetics: string[];
}

/**
 * Calculate XP earned from banked coins
 * Per spec: xpEarned = floor(bankedCoins / 5)
 */
export function calculateXPFromCoins(bankedCoins: number): number {
  return Math.floor(bankedCoins / ECONOMY.XP_PER_BANKED_COINS);
}

/**
 * Calculate XP required for a specific level
 * Level 1: 100 XP
 * Level 2: 115 XP (100 * 1.15)
 * Level 3: 132 XP (115 * 1.15)
 * etc.
 */
export function getXPRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level === 2) return PROGRESSION.BASE_XP_REQUIREMENT;

  let xpRequired = PROGRESSION.BASE_XP_REQUIREMENT;
  for (let i = 2; i < level; i++) {
    xpRequired = Math.round(xpRequired * PROGRESSION.LEVEL_EXPONENT);
  }
  return xpRequired;
}

/**
 * Calculate total XP required to reach a level (cumulative)
 */
export function getTotalXPForLevel(level: number): number {
  let total = 0;
  for (let i = 2; i <= level; i++) {
    total += getXPRequiredForLevel(i);
  }
  return total;
}

/**
 * Calculate which level a player should be at given their total XP
 */
export function calculateLevelFromXP(totalXP: number): number {
  let level = 1;

  while (level < PROGRESSION.MAX_LEVEL) {
    const xpForNextLevel = getTotalXPForLevel(level + 1);
    if (totalXP >= xpForNextLevel) {
      level++;
    } else {
      break;
    }
  }

  return level;
}

/**
 * Add XP to user's profile and level them up if needed
 * Returns the number of levels gained and any unlocked cosmetics
 */
export async function addXP(userId: string, xpAmount: number): Promise<LevelUpResult | null> {
  try {
    // Get current profile
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('level, xp')
      .eq('id', userId)
      .single();

    if (fetchError || !profile) {
      console.error('Failed to fetch profile:', fetchError);
      return null;
    }

    const oldLevel = profile.level;
    const oldXP = profile.xp;
    const newXP = oldXP + xpAmount;
    const newLevel = calculateLevelFromXP(newXP);

    // Update profile with new XP and level
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        xp: newXP,
        level: newLevel,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Failed to update XP/level:', updateError);
      return null;
    }

    const levelsGained = newLevel - oldLevel;

    // Get unlocked cosmetics for the new levels
    const unlockedCosmetics: string[] = [];
    if (levelsGained > 0) {
      // Query cosmetics unlocked by reaching these levels
      // This would integrate with the cosmetics system
      for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
        // Placeholder: Add cosmetic IDs that unlock at this level
        // In a full implementation, this would query a cosmetics database
      }
    }

    return {
      levelsGained,
      newLevel,
      unlockedCosmetics,
    };
  } catch (error) {
    console.error('Error adding XP:', error);
    return null;
  }
}

/**
 * Get user's current level progress
 * Returns current level, XP, XP for next level, and progress percentage
 */
export async function getLevelProgress(userId: string) {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('level, xp')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      console.error('Failed to fetch profile:', error);
      return null;
    }

    const currentLevel = profile.level;
    const totalXP = profile.xp;
    const xpForCurrentLevel = getTotalXPForLevel(currentLevel);
    const xpForNextLevel = getTotalXPForLevel(currentLevel + 1);
    const xpInCurrentLevel = totalXP - xpForCurrentLevel;
    const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevel;
    const progress = xpInCurrentLevel / xpNeededForNextLevel;

    return {
      level: currentLevel,
      totalXP,
      xpInCurrentLevel,
      xpNeededForNextLevel,
      progress: Math.min(progress, 1.0),
      isMaxLevel: currentLevel >= PROGRESSION.MAX_LEVEL,
    };
  } catch (error) {
    console.error('Error getting level progress:', error);
    return null;
  }
}

/**
 * Get cosmetics unlocked at a specific level
 * This integrates with the cosmetics system
 */
export async function getCosmeticsUnlockedAtLevel(level: number): Promise<string[]> {
  // Placeholder: Query cosmetics database for items with level_requirement = level
  // In full implementation, this would be:
  // const { data } = await supabase
  //   .from('cosmetic_items')
  //   .select('id')
  //   .eq('level_requirement', level);
  // return data?.map(item => item.id) || [];

  return [];
}
