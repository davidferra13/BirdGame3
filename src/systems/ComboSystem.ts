import { SCORE } from '../utils/Constants';

export type ComboTier = 'none' | 'double' | 'triple' | 'multi' | 'mega' | 'ultra' | 'legendary';

export interface ComboTierInfo {
  name: string;
  color: string;
  minStreak: number;
  bonusMultiplier: number;
  glowIntensity: number;
}

const COMBO_TIERS: Record<ComboTier, ComboTierInfo> = {
  none: { name: '', color: '#fff', minStreak: 0, bonusMultiplier: 0, glowIntensity: 0 },
  double: { name: 'DOUBLE!', color: '#ffdd44', minStreak: 2, bonusMultiplier: 0.1, glowIntensity: 5 },
  triple: { name: 'TRIPLE!', color: '#ff8833', minStreak: 3, bonusMultiplier: 0.15, glowIntensity: 8 },
  multi: { name: 'MULTI KILL!', color: '#ff4444', minStreak: 5, bonusMultiplier: 0.25, glowIntensity: 12 },
  mega: { name: 'MEGA COMBO!', color: '#ff00ff', minStreak: 8, bonusMultiplier: 0.35, glowIntensity: 15 },
  ultra: { name: 'ULTRA COMBO!', color: '#00ffff', minStreak: 12, bonusMultiplier: 0.5, glowIntensity: 20 },
  legendary: { name: 'LEGENDARY!!!', color: '#ffd700', minStreak: 20, bonusMultiplier: 1.0, glowIntensity: 30 }
};

export class ComboSystem {
  private currentTier: ComboTier = 'none';
  private lastTier: ComboTier = 'none';
  private tierChangeTime = 0;
  private comboActive = false;

  // Track combo timing for rapid hits
  private rapidHitWindow = 0.8; // seconds for "rapid" detection
  private lastHitTime = 0;
  private rapidHitCount = 0;

  // Combo announcer animation
  announcerText = '';
  announcerColor = '#fff';
  announcerOpacity = 0;
  announcerScale = 1;
  private announcerDuration = 1.5;
  private announcerTimer = 0;

  // Callback for combo tier tracking
  onComboTierAchieved: ((tierName: string) => void) | null = null;

  update(dt: number, currentStreak: number, currentTime: number): void {
    // Update tier based on streak
    const newTier = this.getTierFromStreak(currentStreak);

    if (newTier !== this.currentTier) {
      this.lastTier = this.currentTier;
      this.currentTier = newTier;
      this.tierChangeTime = currentTime;

      // Trigger announcer on tier up (not on tier down)
      if (this.getTierIndex(newTier) > this.getTierIndex(this.lastTier) && newTier !== 'none') {
        this.triggerAnnouncer(newTier);
      }
    }

    // Update announcer animation
    if (this.announcerTimer > 0) {
      this.announcerTimer -= dt;
      const progress = 1 - (this.announcerTimer / this.announcerDuration);

      if (progress < 0.2) {
        // Zoom in
        this.announcerScale = 0.5 + (progress / 0.2) * 0.7;
        this.announcerOpacity = progress / 0.2;
      } else if (progress < 0.8) {
        // Hold
        this.announcerScale = 1.2;
        this.announcerOpacity = 1;
      } else {
        // Fade out
        const fadeProgress = (progress - 0.8) / 0.2;
        this.announcerScale = 1.2 + fadeProgress * 0.3;
        this.announcerOpacity = 1 - fadeProgress;
      }

      if (this.announcerTimer <= 0) {
        this.announcerOpacity = 0;
      }
    }

    // Reset rapid hit counter if too much time passed
    if (currentTime - this.lastHitTime > this.rapidHitWindow) {
      this.rapidHitCount = 0;
    }
  }

  onHit(currentTime: number): void {
    // Track rapid hits
    if (currentTime - this.lastHitTime <= this.rapidHitWindow) {
      this.rapidHitCount++;
    } else {
      this.rapidHitCount = 1;
    }
    this.lastHitTime = currentTime;
  }

  private triggerAnnouncer(tier: ComboTier): void {
    const info = COMBO_TIERS[tier];
    this.announcerText = info.name;
    this.announcerColor = info.color;
    this.announcerTimer = this.announcerDuration;
    this.announcerOpacity = 0;
    this.announcerScale = 0.5;

    // Notify combo tracker
    this.onComboTierAchieved?.(info.name);
  }

  private getTierFromStreak(streak: number): ComboTier {
    if (streak >= 20) return 'legendary';
    if (streak >= 12) return 'ultra';
    if (streak >= 8) return 'mega';
    if (streak >= 5) return 'multi';
    if (streak >= 3) return 'triple';
    if (streak >= 2) return 'double';
    return 'none';
  }

  private getTierIndex(tier: ComboTier): number {
    const tiers: ComboTier[] = ['none', 'double', 'triple', 'multi', 'mega', 'ultra', 'legendary'];
    return tiers.indexOf(tier);
  }

  getCurrentTier(): ComboTier {
    return this.currentTier;
  }

  getCurrentTierInfo(): ComboTierInfo {
    return COMBO_TIERS[this.currentTier];
  }

  getBonusMultiplier(): number {
    return COMBO_TIERS[this.currentTier].bonusMultiplier;
  }

  getGlowIntensity(): number {
    return COMBO_TIERS[this.currentTier].glowIntensity;
  }

  isRapidFire(): boolean {
    return this.rapidHitCount >= 3;
  }

  reset(): void {
    this.currentTier = 'none';
    this.lastTier = 'none';
    this.rapidHitCount = 0;
    this.announcerOpacity = 0;
  }
}
