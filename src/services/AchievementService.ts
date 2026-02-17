/**
 * Achievement Service
 * Implements STATS_AND_ACHIEVEMENTS.md specification
 *
 * Achievement Examples:
 * - "First Drop" (hit 1 NPC)
 * - "Public Menace" (reach Heat 15)
 * - "High Roller" (bank 1,000 in one run)
 * - "Bounty Hunter" (ground 10 wanted players)
 * - "Paint the Town" (hit 1,000 NPCs)
 *
 * Rewards: title unlocks, cosmetic bundles
 */

import { supabase } from './SupabaseClient';
import { Achievement, LifetimeStats } from '../types/database';
import { ACHIEVEMENTS } from '../utils/Constants';

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  requirement: number;
  stat_key: keyof LifetimeStats;
  reward_type: 'title' | 'cosmetic_bundle' | null;
  reward_id: string | null;
}

export interface AchievementProgress {
  achievement: AchievementDefinition;
  current: number;
  required: number;
  progress: number; // 0.0 to 1.0
  unlocked: boolean;
  unlocked_at?: string;
}

/**
 * Get all achievement definitions
 */
export function getAllAchievementDefinitions(): AchievementDefinition[] {
  return Object.values(ACHIEVEMENTS);
}

/**
 * Get user's unlocked achievements
 */
export async function getUnlockedAchievements(userId: string): Promise<Achievement[]> {
  try {
    const { data, error } = await supabase
      .from('achievements')
      .select('*')
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch achievements:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting achievements:', error);
    return [];
  }
}

/**
 * Check if user has unlocked a specific achievement
 */
export async function hasUnlockedAchievement(
  userId: string,
  achievementId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('achievements')
      .select('id')
      .eq('user_id', userId)
      .eq('achievement_id', achievementId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      console.error('Failed to check achievement:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error checking achievement:', error);
    return false;
  }
}

/**
 * Unlock an achievement for a user
 */
export async function unlockAchievement(
  userId: string,
  achievementId: string
): Promise<boolean> {
  try {
    // Check if already unlocked
    const alreadyUnlocked = await hasUnlockedAchievement(userId, achievementId);
    if (alreadyUnlocked) {
      return true; // Already unlocked, return success
    }

    // Insert achievement
    const { error } = await supabase.from('achievements').insert({
      user_id: userId,
      achievement_id: achievementId,
    });

    if (error) {
      console.error('Failed to unlock achievement:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error unlocking achievement:', error);
    return false;
  }
}

/**
 * Get achievement progress for all achievements
 * Compares user's stats against achievement requirements
 */
export async function getAchievementProgress(
  userId: string
): Promise<AchievementProgress[]> {
  try {
    // Fetch user's stats
    const { data: stats, error: statsError } = await supabase
      .from('lifetime_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (statsError || !stats) {
      console.error('Failed to fetch stats:', statsError);
      return [];
    }

    // Fetch unlocked achievements
    const unlocked = await getUnlockedAchievements(userId);
    const unlockedIds = new Set(unlocked.map(a => a.achievement_id));

    // Calculate progress for each achievement
    const allAchievements = getAllAchievementDefinitions();
    const progress: AchievementProgress[] = allAchievements.map(achievement => {
      const current = stats[achievement.stat_key] as number;
      const required = achievement.requirement;
      const progressValue = Math.min(current / required, 1.0);
      const isUnlocked = unlockedIds.has(achievement.id);
      const unlockedAchievement = unlocked.find(a => a.achievement_id === achievement.id);

      return {
        achievement,
        current,
        required,
        progress: progressValue,
        unlocked: isUnlocked,
        unlocked_at: unlockedAchievement?.unlocked_at,
      };
    });

    return progress;
  } catch (error) {
    console.error('Error getting achievement progress:', error);
    return [];
  }
}

/**
 * Check stats and auto-unlock any newly completed achievements
 * Returns array of newly unlocked achievement IDs
 */
export async function checkAndUnlockAchievements(userId: string): Promise<string[]> {
  try {
    const progress = await getAchievementProgress(userId);
    const newlyUnlocked: string[] = [];

    for (const item of progress) {
      // If achievement is completed but not unlocked, unlock it
      if (item.progress >= 1.0 && !item.unlocked) {
        const success = await unlockAchievement(userId, item.achievement.id);
        if (success) {
          newlyUnlocked.push(item.achievement.id);
        }
      }
    }

    return newlyUnlocked;
  } catch (error) {
    console.error('Error checking achievements:', error);
    return [];
  }
}

/**
 * Get reward for an achievement
 */
export function getAchievementReward(achievementId: string): {
  type: 'title' | 'cosmetic_bundle' | null;
  id: string | null;
} {
  const achievement = getAllAchievementDefinitions().find(a => a.id === achievementId);

  if (!achievement) {
    return { type: null, id: null };
  }

  return {
    type: achievement.reward_type,
    id: achievement.reward_id,
  };
}
