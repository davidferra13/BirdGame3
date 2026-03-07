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
  coinGainMultiplier = 1;
  heatGainMultiplier = 1;

  // District bonus (set by Game based on current district)
  districtBonus = 0;
  districtBonusName = '';

  onHitWithValues(coinValue: number, heatValue: number, npcType?: NPCType): void {
    this.streak++;
    this.multiplier = Math.min(
      1 + this.streak * 0.25,
      SCORE.MAX_MULTIPLIER,
    );
    this.streakTimer = SCORE.STREAK_TIMEOUT;

    const heatGain = clamp(heatValue * this.heatGainMultiplier, 0, SCORE.MAX_HEAT);
    this.heat = clamp(this.heat + heatGain, 0, SCORE.MAX_HEAT);

    const heatRewardBonus = this.heatFraction * SCORE.HEAT_REWARD_MULTIPLIER_AT_MAX;
    const totalMultiplier =
      this.multiplier *
      (1 + this.comboBonus) *
      this.coinGainMultiplier *
      (1 + heatRewardBonus) *
      (1 + this.districtBonus);
    const points = coinValue > 0 ? Math.max(1, Math.floor(coinValue * totalMultiplier)) : 0;
    this.coins += points;

    this.lastHitPoints = points;
    this.lastHitMultiplier = totalMultiplier;
    this.lastHitHeat = heatGain;
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

    if (!this.inHotspot && this.heat > 0) {
      this.heat = Math.max(0, this.heat - SCORE.HEAT_DECAY_PER_SECOND * dt);
      if (this.heat < 0.01) {
        this.heat = 0;
      }
    }

    // Update wanted status based on heat threshold
    this.isWanted = this.heat >= SCORE.WANTED_THRESHOLD;
  }

  bank(): number {
    const amount = this.coins;
    if (amount > 0) {
      this.bankedCoins += amount;
      this.xp += Math.floor(amount / 5);
      this.coins = 0;
      this.streak = 0;
      this.multiplier = 1;
      this.heat = 0;
      this.isWanted = false;
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
    this.heat = 0;
    this.isWanted = false;
    return lost;
  }

  get heatFraction(): number {
    if (SCORE.MAX_HEAT <= 0) return 0;
    return clamp(this.heat / SCORE.MAX_HEAT, 0, 1);
  }

  get totalCoins(): number {
    return this.bankedCoins + this.coins;
  }

  get totalWorms(): number {
    return this.bankedWorms + this.worms;
  }
}
