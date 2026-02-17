import { PROGRESSION, ECONOMY } from '../utils/Constants';
import { SessionStatsTracker } from '../services/StatsService';
import type { NPCType } from '../entities/NPC';

export interface PlayerStats {
  totalNPCHits: number;
  totalTouristsHit: number;
  totalBusinessHit: number;
  totalPerformersHit: number;
  totalPoliceHit: number;
  totalChefsHit: number;
  totalTreemenHit: number;
  totalTimesGrounded: number;
  highestHeat: number;
  highestStreak: number;
  lifetimeCoinsEarned: number;
  totalDistanceFlown: number;
  totalBanks: number;
  largestBank: number;
}

export interface Challenge {
  id: string;
  description: string;
  target: number;
  current: number;
  reward: { coins?: number; xp?: number; feathers?: number; worms?: number; goldenEggs?: number };
  completed: boolean;
}

export class ProgressionSystem {
  xp = 0;
  level = 1;
  feathers = 0;
  worms = 0;
  goldenEggs = 0;

  // Track which level milestones have been claimed (to avoid double-awarding)
  private claimedMilestones: Set<number> = new Set();

  stats: PlayerStats = {
    totalNPCHits: 0,
    totalTouristsHit: 0,
    totalBusinessHit: 0,
    totalPerformersHit: 0,
    totalPoliceHit: 0,
    totalChefsHit: 0,
    totalTreemenHit: 0,
    totalTimesGrounded: 0,
    highestHeat: 0,
    highestStreak: 0,
    lifetimeCoinsEarned: 0,
    totalDistanceFlown: 0,
    totalBanks: 0,
    largestBank: 0,
  };

  dailyChallenges: Challenge[] = [];
  weeklyChallenges: Challenge[] = [];

  // Session stats tracker for comprehensive statistics
  sessionTracker: SessionStatsTracker;

  constructor() {
    this.generateDailyChallenges();
    this.generateWeeklyChallenges();
    this.sessionTracker = new SessionStatsTracker();
  }

  getXPForLevel(lvl: number): number {
    return Math.round(PROGRESSION.BASE_XP_REQUIREMENT * Math.pow(PROGRESSION.LEVEL_EXPONENT, lvl - 1));
  }

  get xpForCurrentLevel(): number {
    return this.getXPForLevel(this.level);
  }

  get xpProgress(): number {
    let totalXPNeeded = 0;
    for (let i = 1; i < this.level; i++) {
      totalXPNeeded += this.getXPForLevel(i);
    }
    const xpInLevel = this.xp - totalXPNeeded;
    return xpInLevel / this.xpForCurrentLevel;
  }

  addXP(amount: number): number {
    this.xp += amount;
    let levelsGained = 0;

    while (this.level < PROGRESSION.MAX_LEVEL) {
      let totalXPNeeded = 0;
      for (let i = 1; i <= this.level; i++) {
        totalXPNeeded += this.getXPForLevel(i);
      }
      if (this.xp >= totalXPNeeded) {
        this.level++;
        levelsGained++;

        // Award feathers on every level-up
        this.feathers += ECONOMY.FEATHERS_PER_LEVEL_UP;

        // Check for golden egg level milestones
        if (ECONOMY.GOLDEN_EGGS_LEVEL_MILESTONES.includes(this.level) && !this.claimedMilestones.has(this.level)) {
          this.goldenEggs += ECONOMY.GOLDEN_EGGS_PER_MILESTONE;
          this.feathers += ECONOMY.FEATHERS_PER_MILESTONE;
          this.claimedMilestones.add(this.level);
        }
      } else {
        break;
      }
    }

    return levelsGained;
  }

  recordHit(npcType?: NPCType): void {
    this.stats.totalNPCHits++;
    this.updateChallengeProgress('hits', this.stats.totalNPCHits);

    // Track in session tracker
    if (npcType) {
      const typeMap: Record<string, 'tourists' | 'business' | 'performers' | 'police' | 'chefs' | 'treemen'> = {
        'tourist': 'tourists',
        'business': 'business',
        'performer': 'performers',
        'police': 'police',
        'chef': 'chefs',
        'treeman': 'treemen',
      };
      this.sessionTracker.recordNPCHit(typeMap[npcType]);
    }

    if (npcType === 'tourist') {
      this.stats.totalTouristsHit++;
      this.updateChallengeProgress('tourists', this.stats.totalTouristsHit);
    } else if (npcType === 'business') {
      this.stats.totalBusinessHit++;
      this.updateChallengeProgress('business', this.stats.totalBusinessHit);
    } else if (npcType === 'performer') {
      this.stats.totalPerformersHit++;
      this.updateChallengeProgress('performers', this.stats.totalPerformersHit);
    } else if (npcType === 'police') {
      this.stats.totalPoliceHit++;
      this.updateChallengeProgress('police', this.stats.totalPoliceHit);
    } else if (npcType === 'chef') {
      this.stats.totalChefsHit++;
      this.updateChallengeProgress('chefs', this.stats.totalChefsHit);
    } else if (npcType === 'treeman') {
      this.stats.totalTreemenHit++;
      this.updateChallengeProgress('treemen', this.stats.totalTreemenHit);
    }
  }

  recordGrounding(): void {
    this.stats.totalTimesGrounded++;
  }

  recordHeat(heat: number): void {
    if (heat > this.stats.highestHeat) {
      this.stats.highestHeat = heat;
      this.updateChallengeProgress('heat', heat);
    }
  }

  recordStreak(streak: number): void {
    if (streak > this.stats.highestStreak) {
      this.stats.highestStreak = streak;
    }
  }

  recordBank(amount: number): void {
    this.stats.totalBanks++;
    this.stats.lifetimeCoinsEarned += amount;
    if (amount > this.stats.largestBank) this.stats.largestBank = amount;
    this.updateChallengeProgress('bank', this.stats.lifetimeCoinsEarned);
    this.updateChallengeProgress('bankSingle', amount);
  }

  recordDistance(dist: number): void {
    this.stats.totalDistanceFlown += dist;
  }

  private updateChallengeProgress(type: string, value: number): void {
    const allChallenges = [...this.dailyChallenges, ...this.weeklyChallenges];
    for (const c of allChallenges) {
      if (c.completed) continue;
      if (c.id.startsWith(type)) {
        c.current = Math.min(value, c.target);
        if (c.current >= c.target) {
          c.completed = true;
        }
      }
    }
  }

  private generateDailyChallenges(): void {
    this.dailyChallenges = [
      {
        id: 'tourists_25',
        description: 'Hit 25 tourists',
        target: 25,
        current: 0,
        reward: { coins: 150, xp: 50, worms: 5 },
        completed: false,
      },
      {
        id: 'bankSingle_200',
        description: 'Bank 200 coins in one deposit',
        target: 200,
        current: 0,
        reward: { coins: 100, xp: 50, worms: 3 },
        completed: false,
      },
      {
        id: 'heat_20',
        description: 'Reach Heat 20',
        target: 20,
        current: 0,
        reward: { xp: 75, worms: 8 },
        completed: false,
      },
    ];
  }

  private generateWeeklyChallenges(): void {
    this.weeklyChallenges = [
      {
        id: 'bank_2000',
        description: 'Bank 2,000 coins total',
        target: 2000,
        current: 0,
        reward: { coins: 500, xp: 200, feathers: 3, goldenEggs: 1 },
        completed: false,
      },
      {
        id: 'hits_500',
        description: 'Hit 500 NPCs',
        target: 500,
        current: 0,
        reward: { coins: 300, xp: 250, feathers: 5, goldenEggs: 1 },
        completed: false,
      },
      {
        id: 'heat_35',
        description: 'Reach Heat 35',
        target: 35,
        current: 0,
        reward: { feathers: 8, goldenEggs: 1 },
        completed: false,
      },
      {
        id: 'business_15',
        description: 'Hit 15 business people',
        target: 15,
        current: 0,
        reward: { coins: 200, xp: 150, worms: 10 },
        completed: false,
      },
      {
        id: 'performers_5',
        description: 'Hit 5 street performers',
        target: 5,
        current: 0,
        reward: { coins: 400, xp: 300, feathers: 10, goldenEggs: 1 },
        completed: false,
      },
      {
        id: 'bankSingle_1000',
        description: 'Bank 1,000 coins in one deposit',
        target: 1000,
        current: 0,
        reward: { coins: 800, xp: 400, feathers: 15, goldenEggs: 2 },
        completed: false,
      },
    ];
  }

  collectReward(challenge: Challenge): { coins: number; xp: number; feathers: number; worms: number; goldenEggs: number } {
    if (!challenge.completed) return { coins: 0, xp: 0, feathers: 0, worms: 0, goldenEggs: 0 };
    const r = challenge.reward;
    const result = {
      coins: r.coins || 0,
      xp: r.xp || 0,
      feathers: r.feathers || 0,
      worms: r.worms || 0,
      goldenEggs: r.goldenEggs || 0,
    };
    if (result.xp > 0) this.addXP(result.xp);
    if (result.feathers > 0) this.feathers += result.feathers;
    if (result.worms > 0) this.worms += result.worms;
    if (result.goldenEggs > 0) this.goldenEggs += result.goldenEggs;
    return result;
  }

  // ============================================================================
  // SESSION TRACKER DELEGATE METHODS
  // ============================================================================

  /**
   * Record flip performed
   */
  recordFlip(flipType: string, isDouble: boolean): void {
    this.sessionTracker.recordFlip(flipType as any, isDouble);
  }

  /**
   * Record combo tier achieved
   */
  recordComboTier(tier: string): void {
    const tierMap: Record<string, 'double' | 'triple' | 'multi' | 'mega' | 'ultra' | 'legendary'> = {
      'DOUBLE!': 'double',
      'TRIPLE!': 'triple',
      'MULTI KILL!': 'multi',
      'MEGA COMBO!': 'mega',
      'ULTRA COMBO!': 'ultra',
      'LEGENDARY!!!': 'legendary',
    };
    if (tierMap[tier]) {
      this.sessionTracker.recordCombo(tierMap[tier]);
    }
  }

  /**
   * Record collectible collected
   */
  recordCollectible(type: 'flight_rings' | 'golden_feathers' | 'thermal_updrafts' | 'items_grabbed'): void {
    this.sessionTracker.recordCollectible(type);
  }

  /**
   * Update flight statistics
   */
  updateFlightStats(distance: number, speed: number, altitude: number): void {
    this.sessionTracker.updateFlight(distance, speed, altitude);
  }

  /**
   * Record boost used
   */
  recordBoost(): void {
    this.sessionTracker.recordBoost();
  }

  /**
   * Record dive performed
   */
  recordDive(): void {
    this.sessionTracker.recordDive();
  }

  /**
   * Record dive bomb performed
   */
  recordDiveBomb(): void {
    this.sessionTracker.recordDiveBomb();
  }

  /**
   * Update flight time tracking
   */
  updateFlightTime(diving: boolean, boosting: boolean, dt: number): void {
    this.sessionTracker.updateFlightTime(diving, boosting, dt);
  }

  /**
   * Update session stats
   */
  updateSessionStats(heat: number, streak: number, coins: number): void {
    this.sessionTracker.updateSession(heat, streak, coins);
  }
}
