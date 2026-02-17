import { SCORE } from '../utils/Constants';
import { clamp } from '../utils/MathUtils';
import type { NPCType } from '../entities/NPC';

export class ScoreSystem {
  coins = 0;
  bankedCoins = 0;
  worms = 0;
  bankedWorms = 0;
  xp = 0;
  streak = 0;
  multiplier = 1;
  heat = 0;
  isWanted = false;
  private streakTimer = 0;

  lastHitPoints = 0;
  lastHitMultiplier = 0;
  lastHitHeat = 0;
  lastHitNPCType: NPCType | null = null;

  inHotspot = false;

  // Combo bonus (set by ComboSystem)
  comboBonus = 0;

  onHitWithValues(coinValue: number, _heatValue: number, npcType?: NPCType): void {
    this.streak++;
    this.multiplier = Math.min(
      1 + this.streak * 0.25,
      SCORE.MAX_MULTIPLIER,
    );
    this.streakTimer = SCORE.STREAK_TIMEOUT;

    // Apply combo bonus on top of multiplier
    const totalMultiplier = this.multiplier * (1 + this.comboBonus);
    const points = Math.floor(coinValue * totalMultiplier);
    this.coins += points;

    this.lastHitPoints = points;
    this.lastHitMultiplier = totalMultiplier;
    this.lastHitHeat = 0;
    this.lastHitNPCType = npcType || null;
  }

  onHit(): void {
    this.onHitWithValues(SCORE.BASE_POINTS, 0);
  }

  update(dt: number): void {
    if (this.streakTimer > 0) {
      this.streakTimer -= dt;
      if (this.streakTimer <= 0) {
        this.streak = 0;
        this.multiplier = 1;
      }
    }
  }

  bank(): number {
    const amount = this.coins;
    if (amount > 0) {
      this.bankedCoins += amount;
      this.xp += Math.floor(amount / 5);
      this.coins = 0;
      this.streak = 0;
      this.multiplier = 1;
    }
    // Also bank any session worms (worms are never lost, just accumulated)
    if (this.worms > 0) {
      this.bankedWorms += this.worms;
      this.worms = 0;
    }
    return amount;
  }

  onGrounded(): number {
    const lost = Math.floor(this.coins * SCORE.GROUNDING_LOSS_FRACTION);
    this.coins -= lost;
    this.streak = 0;
    this.multiplier = 1;
    return lost;
  }

  get heatFraction(): number {
    return 0;
  }

  get totalCoins(): number {
    return this.bankedCoins + this.coins;
  }

  get totalWorms(): number {
    return this.bankedWorms + this.worms;
  }
}
