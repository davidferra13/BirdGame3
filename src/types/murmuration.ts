/**
 * Murmuration (Clan) System Type Definitions
 * All TypeScript interfaces for the Murmurations feature.
 */

// ============================================================================
// Enums & Literals
// ============================================================================

export type MurmurationPrivacy = 'open' | 'invite_only' | 'closed';
export type MurmurationRole = 'alpha' | 'sentinel' | 'fledgling';
export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'expired';
export type ChallengeType = 'daily' | 'weekly' | 'milestone';
export type ChallengeStatus = 'active' | 'completed' | 'expired';
export type MvMMode = 'team_poop_tag' | 'team_race' | 'team_splat_attack' | 'territory_war';
export type MvMTeamSize = 2 | 3 | 5;

// ============================================================================
// Emblem System
// ============================================================================

export type EmblemBackground = 'circle' | 'shield' | 'diamond' | 'hexagon';
export type EmblemBorder = 'thin' | 'thick' | 'ornate' | 'animated';

export interface EmblemConfig {
  background: EmblemBackground;
  icon: string;        // Icon identifier (e.g. 'bird_silhouette', 'wings', 'crown')
  border: EmblemBorder;
  fgColor: string;     // Hex foreground color
  bgColor: string;     // Hex background color
}

// ============================================================================
// Core Murmuration Data
// ============================================================================

export interface Murmuration {
  id: string;
  name: string;
  tag: string;
  description: string | null;
  privacy: MurmurationPrivacy;
  alpha_id: string;
  formation_level: number;
  formation_xp: number;
  emblem_config: EmblemConfig;
  member_count: number;
  total_coins_banked: number;
  season_coins_banked: number;
  mvm_wins: number;
  mvm_losses: number;
  created_at: string;
}

export interface MurmurationMember {
  id: string;
  murmuration_id: string;
  user_id: string;
  role: MurmurationRole;
  joined_at: string;
  coins_contributed: number;
  formation_xp_contributed: number;
  // Joined from profiles for display
  username?: string;
  level?: number;
}

export interface MurmurationInvite {
  id: string;
  murmuration_id: string;
  invited_user_id: string;
  invited_by: string;
  status: InviteStatus;
  created_at: string;
  // Joined for display
  murmuration_name?: string;
  murmuration_tag?: string;
  inviter_username?: string;
}

// ============================================================================
// Challenges
// ============================================================================

export interface ChallengeObjective {
  type: 'bank_coins' | 'hit_npcs' | 'fly_distance' | 'mvm_wins' | 'member_combos' | 'reach_members';
  target: number;
  current: number;
  description: string;
}

export interface ChallengeContribution {
  user_id: string;
  amount: number;
}

export interface ChallengeProgress {
  total: number;
  contributions: ChallengeContribution[];
}

export interface MurmurationChallenge {
  id: string;
  murmuration_id: string;
  type: ChallengeType;
  objective: ChallengeObjective;
  progress: ChallengeProgress;
  status: ChallengeStatus;
  expires_at: string | null;
  created_at: string;
}

// ============================================================================
// Cooldown
// ============================================================================

export interface PlayerMurmurationCooldown {
  user_id: string;
  cooldown_expires_at: string;
}

// ============================================================================
// MvM PvP
// ============================================================================

export interface MvMQueueEntry {
  murmuration_id: string;
  murmuration_name: string;
  murmuration_tag: string;
  formation_level: number;
  mode: MvMMode;
  team_size: MvMTeamSize;
  player_ids: string[];
  queued_at: number;
}

export interface MvMMatch {
  id: string;
  mode: MvMMode;
  team_size: MvMTeamSize;
  team_a: MvMTeam;
  team_b: MvMTeam;
  state: 'countdown' | 'active' | 'ending' | 'finished';
  scores: { a: number; b: number };
  time_remaining: number;
  zones?: TerritoryZone[];     // Territory War only
  started_at: number;
}

export interface MvMTeam {
  murmuration_id: string;
  murmuration_name: string;
  murmuration_tag: string;
  player_ids: string[];
  color: number;               // Hex color for poop tinting, markers
}

export interface TerritoryZone {
  id: number;
  position: { x: number; y: number; z: number };
  controlled_by: 'a' | 'b' | 'none';
  capture_progress: number;    // 0-1 toward capture
  capturing_team: 'a' | 'b' | 'none';
}

export interface MvMRewards {
  coins: number;
  feathers: number;
  formation_xp: number;
  is_mvp: boolean;
}

// ============================================================================
// Leaderboard
// ============================================================================

// LeaderBird
export interface MurmurationLeaderBirdEntry {
  id: string;
  name: string;
  tag: string;
  emblem_config: EmblemConfig;
  formation_level: number;
  member_count: number;
  season_coins_banked: number;
  mvm_wins: number;
}

// ============================================================================
// Murmuration Stats (aggregated)
// ============================================================================

export interface MurmurationStats {
  total_coins_banked: number;
  season_coins_banked: number;
  total_npc_hits: number;
  total_poop_dropped: number;
  highest_combo: number;
  total_flight_distance: number;
  mvm_wins: number;
  mvm_losses: number;
  mvm_win_rate: number;
  challenges_completed: number;
  average_member_level: number;
  most_active_member: string | null;
}

// ============================================================================
// Chat
// ============================================================================

export interface MurmurationChatMessage {
  id?: string;
  murmuration_id: string;
  sender_id: string;
  sender_username: string;
  message: string;
  timestamp: number;
}

// ============================================================================
// WebSocket Message Types
// ============================================================================

export interface MvMQueueJoinMessage {
  type: 'mvm_queue_join';
  data: { mode: MvMMode; teamSize: MvMTeamSize };
}

export interface MvMQueueLeaveMessage {
  type: 'mvm_queue_leave';
  data: Record<string, never>;
}

export interface MvMMatchFoundMessage {
  type: 'mvm_match_found';
  data: { matchId: string; opponent: MvMTeam; mode: MvMMode };
}

export interface MvMRoundUpdateMessage {
  type: 'mvm_round_update';
  data: { scores: { a: number; b: number }; time: number; zones?: TerritoryZone[] };
}

export interface MvMMatchEndMessage {
  type: 'mvm_match_end';
  data: { winner: 'a' | 'b' | 'draw'; rewards: MvMRewards; stats: { a: number; b: number } };
}

export interface MurmurationChatWsMessage {
  type: 'murmuration_chat';
  data: { senderId: string; senderUsername: string; message: string; timestamp: number };
}

export interface MurmurationNotificationMessage {
  type: 'murmuration_notification';
  data: {
    notificationType: 'member_joined' | 'member_left' | 'challenge_completed' | 'mvm_invite' | 'invite_received';
    payload: Record<string, unknown>;
  };
}

// Union type for all MvM/Murmuration client messages
export type MurmurationClientMessage =
  | MvMQueueJoinMessage
  | MvMQueueLeaveMessage
  | MurmurationChatWsMessage;

// Union type for all MvM/Murmuration server messages
export type MurmurationServerMessage =
  | MvMMatchFoundMessage
  | MvMRoundUpdateMessage
  | MvMMatchEndMessage
  | MurmurationChatWsMessage
  | MurmurationNotificationMessage;

// ============================================================================
// Roost
// ============================================================================

export interface RoostData {
  position: { x: number; y: number; z: number };
  murmuration_id: string;
  formation_level: number;
  emblem_config: EmblemConfig;
  tag: string;
}
