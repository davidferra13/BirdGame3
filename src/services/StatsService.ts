/**
 * Stats Tracking Service
 * Implements STATS_AND_ACHIEVEMENTS.md specification
 *
 * Core Lifetime Stats:
 * - total NPC hits
 * - total player hits
 * - total groundings dealt
 * - total times grounded
 * - highest Heat reached
 * - biggest banked run
 * - total banked coins
 * - total time played
 */

import { supabase } from './SupabaseClient';
import { LifetimeStats } from '../types/database';

/**
 * Get user's lifetime stats
 */
export async function getLifetimeStats(userId: string): Promise<LifetimeStats | null> {
  try {
    const { data, error } = await supabase
      .from('lifetime_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Failed to fetch lifetime stats:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error getting lifetime stats:', error);
    return null;
  }
}

/**
 * Increment NPC hits counter
 */
export async function recordNPCHit(userId: string, count: number = 1): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('increment_npc_hits', {
      user_id: userId,
      amount: count,
    });

    if (error) {
      console.error('Failed to record NPC hit:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error recording NPC hit:', error);
    return false;
  }
}

/**
 * Increment player hits counter
 */
export async function recordPlayerHit(userId: string, count: number = 1): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('increment_player_hits', {
      user_id: userId,
      amount: count,
    });

    if (error) {
      console.error('Failed to record player hit:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error recording player hit:', error);
    return false;
  }
}

/**
 * Increment groundings dealt counter
 */
export async function recordGroundingDealt(userId: string, count: number = 1): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('increment_groundings_dealt', {
      user_id: userId,
      amount: count,
    });

    if (error) {
      console.error('Failed to record grounding dealt:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error recording grounding dealt:', error);
    return false;
  }
}

/**
 * Increment times grounded counter
 */
export async function recordTimesGrounded(userId: string, count: number = 1): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('increment_times_grounded', {
      user_id: userId,
      amount: count,
    });

    if (error) {
      console.error('Failed to record times grounded:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error recording times grounded:', error);
    return false;
  }
}

/**
 * Update highest heat reached (if current is higher)
 */
export async function recordHeatReached(userId: string, heatValue: number): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('update_highest_heat', {
      user_id: userId,
      heat_value: heatValue,
    });

    if (error) {
      console.error('Failed to record heat:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error recording heat:', error);
    return false;
  }
}

/**
 * Record a banking event
 * Updates biggest banked run and total banked coins
 */
export async function recordBanking(userId: string, amount: number): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('record_banking', {
      user_id: userId,
      amount: amount,
    });

    if (error) {
      console.error('Failed to record banking:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error recording banking:', error);
    return false;
  }
}

/**
 * Add time played (in seconds)
 */
export async function recordTimePlayed(userId: string, seconds: number): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('add_time_played', {
      user_id: userId,
      seconds: seconds,
    });

    if (error) {
      console.error('Failed to record time played:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error recording time played:', error);
    return false;
  }
}

/**
 * Batch update multiple stats at once (for efficiency)
 */
export async function updateStatsAsync(
  userId: string,
  updates: {
    npcHits?: number;
    playerHits?: number;
    groundingsDealt?: number;
    timesGrounded?: number;
    heatReached?: number;
    bankingAmount?: number;
    timePlayed?: number;
  }
): Promise<boolean> {
  try {
    const promises: Promise<boolean>[] = [];

    if (updates.npcHits) promises.push(recordNPCHit(userId, updates.npcHits));
    if (updates.playerHits) promises.push(recordPlayerHit(userId, updates.playerHits));
    if (updates.groundingsDealt) promises.push(recordGroundingDealt(userId, updates.groundingsDealt));
    if (updates.timesGrounded) promises.push(recordTimesGrounded(userId, updates.timesGrounded));
    if (updates.heatReached !== undefined) promises.push(recordHeatReached(userId, updates.heatReached));
    if (updates.bankingAmount) promises.push(recordBanking(userId, updates.bankingAmount));
    if (updates.timePlayed) promises.push(recordTimePlayed(userId, updates.timePlayed));

    const results = await Promise.all(promises);
    return results.every(result => result === true);
  } catch (error) {
    console.error('Error updating stats:', error);
    return false;
  }
}

// ============================================================================
// EXTENDED STATS TRACKING
// Comprehensive session-based statistics tracking system
// ============================================================================

/**
 * Session Statistics Structure
 * Tracks all in-game events during a single play session
 */
export interface SessionStats {
  // NPC Hits by Type
  npc_hits: {
    tourists: number;
    business: number;
    performers: number;
    police: number;
    chefs: number;
    treemen: number;
    glamorous_elegance: number;
  };

  // Flip Types
  flips: {
    front: number;
    back: number;
    left: number;
    right: number;
    corkscrewLeft: number;
    corkscrewRight: number;
    sideFlipLeft: number;
    sideFlipRight: number;
    inverted: number;
    aileronRoll: number;
  };

  // Double Flips
  double_flips: {
    front: number;
    back: number;
    barrelRoll: number;
  };

  // Combo Tiers
  combos: {
    double: number;
    triple: number;
    multi: number;
    mega: number;
    ultra: number;
    legendary: number;
  };

  // Flight Performance
  flight: {
    total_distance: number;
    max_speed: number;
    max_altitude: number;
    boosts_used: number;
    dives_performed: number;
    dive_bombs_performed: number;
    time_diving: number;
    time_boosting: number;
  };

  // Collectibles
  collectibles: {
    flight_rings: number;
    golden_feathers: number;
    thermal_updrafts: number;
    items_grabbed: number;
  };

  // Session Metadata
  session: {
    duration: number;
    total_coins_earned: number;
    total_hits: number;
    highest_heat: number;
    highest_streak: number;
  };
}

/**
 * Session Stats Tracker
 * In-memory tracker for current play session
 */
export class SessionStatsTracker {
  private stats: SessionStats;
  private sessionStartTime: number;

  constructor() {
    this.stats = this.createEmptyStats();
    this.sessionStartTime = Date.now();
  }

  private createEmptyStats(): SessionStats {
    return {
      npc_hits: {
        tourists: 0,
        business: 0,
        performers: 0,
        police: 0,
        chefs: 0,
        treemen: 0,
        glamorous_elegance: 0,
      },
      flips: {
        front: 0,
        back: 0,
        left: 0,
        right: 0,
        corkscrewLeft: 0,
        corkscrewRight: 0,
        sideFlipLeft: 0,
        sideFlipRight: 0,
        inverted: 0,
        aileronRoll: 0,
      },
      double_flips: { front: 0, back: 0, barrelRoll: 0 },
      combos: { double: 0, triple: 0, multi: 0, mega: 0, ultra: 0, legendary: 0 },
      flight: {
        total_distance: 0,
        max_speed: 0,
        max_altitude: 0,
        boosts_used: 0,
        dives_performed: 0,
        dive_bombs_performed: 0,
        time_diving: 0,
        time_boosting: 0,
      },
      collectibles: {
        flight_rings: 0,
        golden_feathers: 0,
        thermal_updrafts: 0,
        items_grabbed: 0,
      },
      session: {
        duration: 0,
        total_coins_earned: 0,
        total_hits: 0,
        highest_heat: 0,
        highest_streak: 0,
      },
    };
  }

  /**
   * Record NPC hit by type
   */
  recordNPCHit(type: keyof SessionStats['npc_hits']): void {
    this.stats.npc_hits[type]++;
    this.stats.session.total_hits++;
  }

  /**
   * Record flip performed
   */
  recordFlip(type: keyof SessionStats['flips'], isDouble: boolean): void {
    this.stats.flips[type]++;
    if (isDouble) {
      // Map flip types to double flip categories
      if (type === 'front') this.stats.double_flips.front++;
      else if (type === 'back') this.stats.double_flips.back++;
      else if (type === 'left' || type === 'right') this.stats.double_flips.barrelRoll++;
    }
  }

  /**
   * Record combo tier achieved
   */
  recordCombo(tier: keyof SessionStats['combos']): void {
    this.stats.combos[tier]++;
  }

  /**
   * Record collectible collected
   */
  recordCollectible(type: keyof SessionStats['collectibles']): void {
    this.stats.collectibles[type]++;
  }

  /**
   * Update flight statistics
   */
  updateFlight(distance: number, speed: number, altitude: number): void {
    this.stats.flight.total_distance = Math.max(this.stats.flight.total_distance, distance);
    this.stats.flight.max_speed = Math.max(this.stats.flight.max_speed, speed);
    this.stats.flight.max_altitude = Math.max(this.stats.flight.max_altitude, altitude);
  }

  /**
   * Record boost used
   */
  recordBoost(): void {
    this.stats.flight.boosts_used++;
  }

  /**
   * Record dive performed
   */
  recordDive(): void {
    this.stats.flight.dives_performed++;
  }

  /**
   * Record dive bomb performed
   */
  recordDiveBomb(): void {
    this.stats.flight.dive_bombs_performed++;
  }

  /**
   * Update time spent in flight states (call with delta time)
   */
  updateFlightTime(diving: boolean, boosting: boolean, dt: number): void {
    if (diving) this.stats.flight.time_diving += dt;
    if (boosting) this.stats.flight.time_boosting += dt;
  }

  /**
   * Update session metadata
   */
  updateSession(heat: number, streak: number, coins: number): void {
    this.stats.session.highest_heat = Math.max(this.stats.session.highest_heat, heat);
    this.stats.session.highest_streak = Math.max(this.stats.session.highest_streak, streak);
    this.stats.session.total_coins_earned = coins;
  }

  /**
   * Get current session stats snapshot
   */
  getStats(): SessionStats {
    const now = Date.now();
    this.stats.session.duration = Math.floor((now - this.sessionStartTime) / 1000);
    return this.stats;
  }

  /**
   * Reset tracker for new session
   */
  reset(): void {
    this.stats = this.createEmptyStats();
    this.sessionStartTime = Date.now();
  }
}

// ============================================================================
// BACKEND SYNC FUNCTIONS
// ============================================================================

/**
 * Sync session stats to backend (PRIMARY METHOD)
 * Call this at end of session or periodically
 */
export async function syncSessionStats(
  userId: string,
  sessionStats: SessionStats
): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('batch_update_stats', {
      p_user_id: userId,
      session_data: sessionStats,
    });

    if (error) {
      console.error('Failed to sync session stats:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error syncing session stats:', error);
    return false;
  }
}

/**
 * Get all stats for display in UI
 */
export async function getAllStats(userId: string): Promise<any | null> {
  try {
    const { data, error } = await supabase.rpc('get_all_stats', {
      p_user_id: userId,
    });

    if (error) {
      console.error('Failed to get all stats:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error getting all stats:', error);
    return null;
  }
}

// ============================================================================
// GUEST PLAYER SUPPORT (LocalStorage)
// ============================================================================

const GUEST_STATS_KEY = 'bird_game_guest_stats';

/**
 * Save guest player stats to localStorage
 */
export function saveGuestStats(stats: SessionStats): void {
  try {
    localStorage.setItem(GUEST_STATS_KEY, JSON.stringify(stats));
  } catch (error) {
    console.error('Failed to save guest stats:', error);
  }
}

/**
 * Load guest player stats from localStorage
 */
export function loadGuestStats(): SessionStats | null {
  try {
    const saved = localStorage.getItem(GUEST_STATS_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error('Failed to load guest stats:', error);
    return null;
  }
}

/**
 * Clear guest player stats
 */
export function clearGuestStats(): void {
  localStorage.removeItem(GUEST_STATS_KEY);
}
