/**
 * Database Type Definitions
 * Matches the schema defined in DATA_MODEL_DATABASE.md
 */

// ============================================================================
// Core Database Tables
// ============================================================================

export interface Profile {
  id: string; // UUID from auth.users
  username: string;
  level: number;
  xp: number;
  coins: number;
  feathers: number;
  worms: number;
  golden_eggs: number;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  user_id: string;
  item_id: string;
  item_type: CosmeticType;
  equipped: boolean;
  acquired_at: string;
}

export interface ChallengeProgress {
  id: string;
  user_id: string;
  challenge_id: string;
  progress: number;
  completed: boolean;
  completed_at: string | null;
}

export interface Purchase {
  id: string;
  user_id: string;
  item_id: string;
  item_type: CosmeticType;
  currency_type: 'coins' | 'feathers' | 'worms' | 'golden_eggs';
  amount: number;
  purchased_at: string;
}

export interface LifetimeStats {
  id: string;
  user_id: string;
  total_npc_hits: number;
  total_player_hits: number;
  total_groundings_dealt: number;
  total_times_grounded: number;
  highest_heat_reached: number;
  biggest_banked_run: number;
  total_banked_coins: number;
  total_time_played: number; // in seconds
  updated_at: string;
}

export interface Achievement {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
}

// ============================================================================
// Cosmetic System Types
// ============================================================================

export type CosmeticType =
  | 'title'
  | 'banner_frame'
  | 'skin'
  | 'trail'
  | 'splat'
  | 'emote';

export type CosmeticTier =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary';

export interface CosmeticItem {
  id: string;
  name: string;
  type: CosmeticType;
  tier: CosmeticTier;
  coin_price: number | null;
  feather_price: number | null;
  level_requirement: number;
  description: string;
  // Visual properties (populated by frontend)
  visual_data?: Record<string, any>;
}

// ============================================================================
// Achievement Definitions
// ============================================================================

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  requirement: number;
  reward_type: 'title' | 'cosmetic_bundle' | null;
  reward_id: string | null;
  hidden: boolean;
}

// ============================================================================
// Database Responses
// ============================================================================

export interface ProfileResponse {
  profile: Profile;
  stats: LifetimeStats;
  inventory: InventoryItem[];
  achievements: Achievement[];
}

export interface PurchaseResponse {
  success: boolean;
  item?: InventoryItem;
  updated_coins?: number;
  updated_feathers?: number;
  updated_worms?: number;
  updated_golden_eggs?: number;
  error?: string;
}

export interface BankingResponse {
  success: boolean;
  banked_coins: number;
  xp_earned: number;
  new_level?: number;
  new_total_coins: number;
  error?: string;
}

// ============================================================================
// Murmuration Tables (Supabase)
// ============================================================================

export type MurmurationPrivacyDB = 'open' | 'invite_only' | 'closed';
export type MurmurationRoleDB = 'alpha' | 'sentinel' | 'fledgling';
export type InviteStatusDB = 'pending' | 'accepted' | 'declined' | 'expired';
export type ChallengeTypeDB = 'daily' | 'weekly' | 'milestone';
export type ChallengeStatusDB = 'active' | 'completed' | 'expired';

export interface MurmurationRow {
  id: string;
  name: string;
  tag: string;
  description: string | null;
  privacy: MurmurationPrivacyDB;
  alpha_id: string;
  formation_level: number;
  formation_xp: number;
  emblem_config: Record<string, unknown>;
  member_count: number;
  total_coins_banked: number;
  season_coins_banked: number;
  mvm_wins: number;
  mvm_losses: number;
  created_at: string;
}

export interface MurmurationMemberRow {
  id: string;
  murmuration_id: string;
  user_id: string;
  role: MurmurationRoleDB;
  joined_at: string;
  coins_contributed: number;
  formation_xp_contributed: number;
}

export interface MurmurationInviteRow {
  id: string;
  murmuration_id: string;
  invited_user_id: string;
  invited_by: string;
  status: InviteStatusDB;
  created_at: string;
}

export interface MurmurationChallengeRow {
  id: string;
  murmuration_id: string;
  type: ChallengeTypeDB;
  objective: Record<string, unknown>;
  progress: Record<string, unknown>;
  status: ChallengeStatusDB;
  expires_at: string | null;
  created_at: string;
}

export interface PlayerMurmurationCooldownRow {
  user_id: string;
  cooldown_expires_at: string;
}
