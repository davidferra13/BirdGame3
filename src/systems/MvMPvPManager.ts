/**
 * MvMPvPManager - Client-side coordinator for Murmuration vs Murmuration PvP.
 * Handles matchmaking queue, round lifecycle, scoring, and rewards.
 *
 * Lifecycle phases: idle -> queuing -> found -> countdown -> active -> ending -> results -> idle
 */

import { MVM } from '@/utils/Constants';
import type {
  MvMMode,
  MvMTeamSize,
  MvMMatch,
  MvMTeam,
  MvMRewards,
  TerritoryZone,
  MvMQueueEntry,
} from '@/types/murmuration';

export class MvMPvPManager {
  // --- Public State ---
  currentMatch: MvMMatch | null = null;
  queueState: 'idle' | 'queuing' | 'found' | 'in_match' = 'idle';
  queueStartTime = 0;
  localTeam: 'a' | 'b' | null = null;

  // --- Private State ---
  private sendMessage: ((msg: any) => void) | null = null;
  private countdownTimer = 0;
  private resultsTimer = 0;
  private lastRewards: MvMRewards | null = null;
  private queueMode: MvMMode | null = null;
  private queueTeamSize: MvMTeamSize | null = null;

  // =========================================================================
  // Configuration
  // =========================================================================

  /**
   * Set the WebSocket send function used to communicate with the server.
   */
  setSendFunction(fn: (msg: any) => void): void {
    this.sendMessage = fn;
  }

  // =========================================================================
  // Queue Management
  // =========================================================================

  /**
   * Join the matchmaking queue for the given mode and team size.
   * Sends an `mvm_queue_join` message to the server and transitions to queuing.
   */
  joinQueue(mode: MvMMode, teamSize: MvMTeamSize): void {
    if (this.queueState !== 'idle') {
      console.warn('[MvMPvP] Cannot join queue: current state is', this.queueState);
      return;
    }

    if (!this.sendMessage) {
      console.error('[MvMPvP] Cannot join queue: no send function configured');
      return;
    }

    this.queueMode = mode;
    this.queueTeamSize = teamSize;
    this.queueStartTime = Date.now();
    this.queueState = 'queuing';

    this.sendMessage({
      type: 'mvm_queue_join',
      data: { mode, teamSize },
    });

    console.log(`[MvMPvP] Joined queue for ${mode} (${teamSize}v${teamSize})`);
  }

  /**
   * Leave the matchmaking queue. Sends an `mvm_queue_leave` message and resets to idle.
   */
  leaveQueue(): void {
    if (this.queueState !== 'queuing') {
      console.warn('[MvMPvP] Cannot leave queue: not currently queuing');
      return;
    }

    if (this.sendMessage) {
      this.sendMessage({
        type: 'mvm_queue_leave',
        data: {},
      });
    }

    this.queueState = 'idle';
    this.queueStartTime = 0;
    this.queueMode = null;
    this.queueTeamSize = null;

    console.log('[MvMPvP] Left matchmaking queue');
  }

  // =========================================================================
  // Server Message Handlers
  // =========================================================================

  /**
   * Handle a match-found message from the server.
   * Creates the MvMMatch structure and begins the countdown phase.
   */
  handleMatchFound(data: { matchId: string; opponent: MvMTeam; mode: MvMMode; localTeam: MvMTeam; teamSide: 'a' | 'b' }): void {
    const mode = data.mode;
    const teamSize = this.queueTeamSize ?? data.localTeam.player_ids.length as MvMTeamSize;

    const teamA: MvMTeam = data.teamSide === 'a' ? data.localTeam : data.opponent;
    const teamB: MvMTeam = data.teamSide === 'b' ? data.localTeam : data.opponent;

    const matchDuration = this.getModeDuration(mode);

    this.currentMatch = {
      id: data.matchId,
      mode,
      team_size: teamSize,
      team_a: teamA,
      team_b: teamB,
      state: 'countdown',
      scores: { a: 0, b: 0 },
      time_remaining: matchDuration,
      zones: mode === 'territory_war' ? this.createInitialZones() : undefined,
      started_at: Date.now(),
    };

    this.localTeam = data.teamSide;
    this.queueState = 'found';
    this.countdownTimer = MVM.COUNTDOWN_DURATION_S;

    console.log(
      `[MvMPvP] Match found: ${data.matchId} | ${mode} | Team ${data.teamSide.toUpperCase()}`,
    );
  }

  /**
   * Handle a round-update message from the server.
   * Updates the current match scores, timer, and territory zones.
   */
  handleRoundUpdate(data: { scores: { a: number; b: number }; time: number; zones?: TerritoryZone[] }): void {
    if (!this.currentMatch) {
      console.warn('[MvMPvP] Received round update but no active match');
      return;
    }

    this.currentMatch.scores = data.scores;
    this.currentMatch.time_remaining = data.time;

    if (data.zones) {
      this.currentMatch.zones = data.zones;
    }
  }

  /**
   * Handle the match-end message from the server.
   * Transitions to the ending phase, stores rewards, and prepares results display.
   */
  handleMatchEnd(data: { winner: 'a' | 'b' | 'draw'; rewards: MvMRewards; stats: { a: number; b: number } }): void {
    if (!this.currentMatch) {
      console.warn('[MvMPvP] Received match end but no active match');
      return;
    }

    this.currentMatch.state = 'ending';
    this.currentMatch.scores = { a: data.stats.a, b: data.stats.b };
    this.queueState = 'in_match'; // stays in_match until results clear

    this.lastRewards = data.rewards;
    this.resultsTimer = MVM.RESULTS_DISPLAY_S;

    const localWon =
      data.winner === this.localTeam
        ? 'WON'
        : data.winner === 'draw'
          ? 'DRAW'
          : 'LOST';

    console.log(
      `[MvMPvP] Match ended: ${localWon} | Winner: ${data.winner} | Coins: ${data.rewards.coins} | Feathers: ${data.rewards.feathers}`,
    );
  }

  // =========================================================================
  // Frame Update
  // =========================================================================

  /**
   * Per-frame update. Manages phase transitions, timers, and timeout checks.
   * @param dt Delta time in seconds.
   */
  update(dt: number): void {
    switch (this.queueState) {
      case 'queuing':
        this.updateQueuing();
        break;

      case 'found':
        this.updateCountdown(dt);
        break;

      case 'in_match':
        this.updateInMatch(dt);
        break;
    }
  }

  private updateQueuing(): void {
    const elapsed = Date.now() - this.queueStartTime;

    if (elapsed >= MVM.MATCHMAKING_TIMEOUT_MS) {
      console.log('[MvMPvP] Matchmaking timed out after', MVM.MATCHMAKING_TIMEOUT_MS, 'ms');
      this.queueState = 'idle';
      this.queueStartTime = 0;
      this.queueMode = null;
      this.queueTeamSize = null;
    }
    // Otherwise: "searching..." state continues — UI reads queueState + getQueueTimeElapsed()
  }

  private updateCountdown(dt: number): void {
    this.countdownTimer -= dt;

    if (this.countdownTimer <= 0) {
      // Transition from countdown to active
      if (this.currentMatch) {
        this.currentMatch.state = 'active';
        this.currentMatch.started_at = Date.now();
      }
      this.queueState = 'in_match';
      this.countdownTimer = 0;

      console.log('[MvMPvP] Countdown complete — match is now active');
    }
  }

  private updateInMatch(dt: number): void {
    if (!this.currentMatch) return;

    if (this.currentMatch.state === 'active') {
      // Track match timer locally (authoritative time comes from server via handleRoundUpdate)
      this.currentMatch.time_remaining -= dt;

      if (this.currentMatch.time_remaining <= 0) {
        this.currentMatch.time_remaining = 0;
        // Server should send match_end; we just clamp locally
      }
    } else if (this.currentMatch.state === 'ending') {
      // Show results for RESULTS_DISPLAY_S seconds then reset
      this.resultsTimer -= dt;

      if (this.resultsTimer <= 0) {
        this.currentMatch.state = 'finished';
        this.reset();
      }
    }
  }

  // =========================================================================
  // Accessors
  // =========================================================================

  /**
   * Get the remaining time in the current match, in seconds.
   */
  getMatchTimeRemaining(): number {
    if (!this.currentMatch) return 0;
    return Math.max(0, this.currentMatch.time_remaining);
  }

  /**
   * Get how long the local player has been in the matchmaking queue, in milliseconds.
   */
  getQueueTimeElapsed(): number {
    if (this.queueState !== 'queuing' || this.queueStartTime === 0) return 0;
    return Date.now() - this.queueStartTime;
  }

  /**
   * Whether the local player is currently in an active (or ending) match.
   */
  isInMatch(): boolean {
    return (
      this.queueState === 'in_match' &&
      this.currentMatch !== null &&
      (this.currentMatch.state === 'active' || this.currentMatch.state === 'ending')
    );
  }

  /**
   * Whether the local player is currently in the matchmaking queue.
   */
  isQueuing(): boolean {
    return this.queueState === 'queuing';
  }

  /**
   * Get rewards from the last completed match, or null if none.
   */
  getRewards(): MvMRewards | null {
    return this.lastRewards;
  }

  /**
   * Get the current match scores, or null if no active match.
   */
  getScores(): { a: number; b: number } | null {
    if (!this.currentMatch) return null;
    return { a: this.currentMatch.scores.a, b: this.currentMatch.scores.b };
  }

  // =========================================================================
  // Reset
  // =========================================================================

  /**
   * Full reset back to idle. Clears all match and queue state.
   */
  reset(): void {
    this.currentMatch = null;
    this.queueState = 'idle';
    this.queueStartTime = 0;
    this.localTeam = null;
    this.countdownTimer = 0;
    this.resultsTimer = 0;
    this.lastRewards = null;
    this.queueMode = null;
    this.queueTeamSize = null;

    console.log('[MvMPvP] State reset to idle');
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  /**
   * Get the round duration for a given MvM mode, in seconds.
   */
  private getModeDuration(mode: MvMMode): number {
    switch (mode) {
      case 'team_poop_tag':
        return MVM.TEAM_TAG_DURATION_S;
      case 'team_race':
        return MVM.TEAM_RACE_DURATION_S;
      case 'team_splat_attack':
        return MVM.TEAM_SPLAT_DURATION_S;
      case 'territory_war':
        return MVM.TERRITORY_MATCH_TIME_S;
      default:
        return 180; // Fallback: 3 minutes
    }
  }

  /**
   * Create initial territory zones for a Territory War match.
   */
  private createInitialZones(): TerritoryZone[] {
    const zones: TerritoryZone[] = [];
    const zoneCount = MVM.TERRITORY_ZONE_COUNT;

    for (let i = 0; i < zoneCount; i++) {
      zones.push({
        id: i,
        position: { x: 0, y: 0, z: 0 }, // Server will provide real positions
        controlled_by: 'none',
        capture_progress: 0,
        capturing_team: 'none',
      });
    }

    return zones;
  }
}
