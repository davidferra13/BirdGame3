/**
 * Murmuration System
 * Core system for Formation XP calculation, challenge tracking,
 * and member activity hooks. Registered in Game.ts and updated each frame.
 */

import { MURMURATION } from '@/utils/Constants';
import type {
  Murmuration,
  MurmurationMember,
  MurmurationChallenge,
  MurmurationRole,
  EmblemConfig,
} from '@/types/murmuration';
import { supabase } from '@/services/SupabaseClient';

export class MurmurationSystem {
  // ── Cached state ──────────────────────────────────────────────────────
  currentMurmuration: Murmuration | null = null;
  currentMember: MurmurationMember | null = null;
  members: MurmurationMember[] = [];
  challenges: MurmurationChallenge[] = [];
  playerTag = '';
  playerRole: MurmurationRole | null = null;
  emblemConfig: EmblemConfig | null = null;
  formationLevel = 0;
  isLoaded = false;

  // ── Loading ───────────────────────────────────────────────────────────

  /**
   * Fetch player's murmuration data, members, and challenges from the
   * database. Populates all cached state. Call this on login/join.
   */
  async loadPlayerMurmuration(userId: string): Promise<void> {
    try {
      // 1. Look up the player's membership record
      const { data: memberRow, error: memberError } = await supabase
        .from('murmuration_members')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (memberError) {
        console.error('[MurmurationSystem] Failed to load member:', memberError.message);
        return;
      }

      if (!memberRow) {
        // Player is not in a murmuration
        this.clear();
        this.isLoaded = true;
        return;
      }

      this.currentMember = memberRow as MurmurationMember;
      this.playerRole = this.currentMember.role;

      // 2. Fetch the murmuration itself
      const { data: murm, error: murmError } = await supabase
        .from('murmurations')
        .select('*')
        .eq('id', this.currentMember.murmuration_id)
        .single();

      if (murmError || !murm) {
        console.error('[MurmurationSystem] Failed to load murmuration:', murmError?.message);
        return;
      }

      this.currentMurmuration = murm as Murmuration;
      this.playerTag = `[${this.currentMurmuration.tag}]`;
      this.emblemConfig = this.currentMurmuration.emblem_config;
      this.formationLevel = this.currentMurmuration.formation_level;

      // 3. Fetch all members (with joined profile data)
      const { data: memberRows, error: membersError } = await supabase
        .from('murmuration_members')
        .select('*, profiles:user_id(username, level)')
        .eq('murmuration_id', this.currentMurmuration.id);

      if (membersError) {
        console.error('[MurmurationSystem] Failed to load members:', membersError.message);
      } else {
        this.members = (memberRows ?? []) as MurmurationMember[];
      }

      // 4. Fetch active challenges
      const { data: challengeRows, error: challengesError } = await supabase
        .from('murmuration_challenges')
        .select('*')
        .eq('murmuration_id', this.currentMurmuration.id)
        .in('status', ['active']);

      if (challengesError) {
        console.error('[MurmurationSystem] Failed to load challenges:', challengesError.message);
      } else {
        this.challenges = (challengeRows ?? []) as MurmurationChallenge[];
      }

      this.isLoaded = true;
    } catch (err) {
      console.error('[MurmurationSystem] Unexpected error loading murmuration:', err);
    }
  }

  // ── Clear / Leave ─────────────────────────────────────────────────────

  /** Reset all state when player leaves a murmuration. */
  clear(): void {
    this.currentMurmuration = null;
    this.currentMember = null;
    this.members = [];
    this.challenges = [];
    this.playerTag = '';
    this.playerRole = null;
    this.emblemConfig = null;
    this.formationLevel = 0;
    this.isLoaded = false;
  }

  // ── Capacity ──────────────────────────────────────────────────────────

  /**
   * Returns the maximum number of members allowed based on formation level.
   * Formation level >= 7 unlocks the higher cap.
   */
  getMaxMembers(): number {
    return this.formationLevel >= 7
      ? MURMURATION.MAX_MEMBERS_F7
      : MURMURATION.MAX_MEMBERS;
  }

  // ── Formation Level Calculation ───────────────────────────────────────

  /**
   * Calculate formation level from a given XP total using
   * FORMATION_XP_THRESHOLDS. Returns the highest level whose threshold
   * has been met.
   */
  getFormationLevel(xp: number): number {
    const thresholds = MURMURATION.FORMATION_XP_THRESHOLDS;
    let level = 1;
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (xp >= thresholds[i]) {
        level = i + 1;
        break;
      }
    }
    return level;
  }

  // ── Activity Hooks (Formation XP contributors) ────────────────────────

  /**
   * Called when player banks coins.
   * Returns the Formation XP to contribute (amount * XP_BANK_PERCENT).
   * Does NOT call any service — the caller is responsible for that.
   */
  onCoinsBanked(amount: number): number {
    return Math.floor(amount * MURMURATION.XP_BANK_PERCENT);
  }

  /** Called when player levels up. Returns the Formation XP to contribute. */
  onLevelUp(): number {
    return MURMURATION.XP_LEVEL_UP;
  }

  /** Called when player completes a personal challenge. Returns Formation XP. */
  onPersonalChallengeComplete(): number {
    return MURMURATION.XP_PERSONAL_CHALLENGE;
  }

  /** Called when a group challenge is completed. Returns Formation XP. */
  onGroupChallengeComplete(): number {
    return MURMURATION.XP_GROUP_CHALLENGE;
  }

  /** Called when the murmuration wins an MvM match. Returns Formation XP. */
  onMvMWin(): number {
    return MURMURATION.XP_MVM_WIN;
  }

  /** Called when the murmuration loses an MvM match. Returns Formation XP. */
  onMvMLoss(): number {
    return MURMURATION.XP_MVM_LOSS;
  }

  /** Called when the player wins a PvP match. Returns Formation XP. */
  onPvPWin(): number {
    return MURMURATION.XP_PVP_WIN;
  }

  // ── Creation Eligibility ──────────────────────────────────────────────

  /**
   * Check whether the player is eligible to create a new murmuration.
   * Validates level requirement, banked coins, and that they are not
   * already in one.
   */
  canCreateMurmuration(
    playerLevel: number,
    bankedCoins: number,
  ): { allowed: boolean; reason?: string } {
    if (this.currentMurmuration) {
      return { allowed: false, reason: 'You are already in a murmuration.' };
    }

    if (playerLevel < MURMURATION.MIN_LEVEL) {
      return {
        allowed: false,
        reason: `You must be at least level ${MURMURATION.MIN_LEVEL} to create a murmuration.`,
      };
    }

    if (bankedCoins < MURMURATION.CREATE_COST) {
      return {
        allowed: false,
        reason: `You need ${MURMURATION.CREATE_COST} banked coins to create a murmuration.`,
      };
    }

    return { allowed: true };
  }

  // ── Formation Unlocks ─────────────────────────────────────────────────

  /** Feature-to-formation-level mapping. */
  private static readonly FEATURE_LEVELS: Record<string, number> = {
    chat: 2,
    challenges: 3,
    roost: 4,
    mvm: 5,
    trail: 6,
    splat: 7,
    skin: 9,
    golden_border: 10,
  };

  /**
   * Return a list of features/perks that are unlocked at the given
   * formation level.
   */
  getFormationUnlocks(level: number): string[] {
    const unlocks: string[] = [];

    if (level >= 2) unlocks.push('Murmuration Chat');
    if (level >= 3) unlocks.push('Group Challenges');
    if (level >= 4) unlocks.push('Roost (shared spawn point)');
    if (level >= 5) unlocks.push('MvM Matchmaking');
    if (level >= 6) unlocks.push('Formation Trail VFX');
    if (level >= 7) unlocks.push('Splat Customization', `Max members increased to ${MURMURATION.MAX_MEMBERS_F7}`);
    if (level >= 8) unlocks.push('Emblem Animated Border');
    if (level >= 9) unlocks.push('Exclusive Bird Skin');
    if (level >= 10) unlocks.push('Golden Border & Leaderboard Badge');
  // Change to LeaderBird Badge
  if (level >= 10) unlocks.push('Golden Border & LeaderBird Badge');

    return unlocks;
  }

  // ── Feature Gating ────────────────────────────────────────────────────

  /**
   * Check whether the current formation level unlocks a specific feature.
   */
  hasFeature(
    feature: 'chat' | 'challenges' | 'roost' | 'mvm' | 'trail' | 'splat' | 'skin' | 'golden_border',
  ): boolean {
    const requiredLevel = MurmurationSystem.FEATURE_LEVELS[feature];
    if (requiredLevel === undefined) return false;
    return this.formationLevel >= requiredLevel;
  }

  // ── Frame Update ──────────────────────────────────────────────────────

  /**
   * Called each frame. Currently lightweight — reserved for periodic
   * refresh timers (challenge expiry checks, etc.) and future expansion.
   */
  update(_dt: number): void {
    // Placeholder for future per-frame logic such as:
    // - Periodic challenge refresh timers
    // - Challenge expiry checks
    // - Formation XP animation ticking
    // - Roost proximity detection
  }
}
