import * as THREE from 'three';
import { Poop } from '../../entities/Poop';
import { clamp } from '../../utils/MathUtils';
import {
  AbilityId, AbilityContext, IAbility,
  ABILITY_DEFS, ABILITY_CHARGE,
  FLOCK_FRENZY_TIERS, POOP_STORM_TIERS, SONIC_SCREECH_TIERS,
  PHANTOM_TRAIL_TIERS, GOLDEN_HOUR_TIERS, DIVE_BOMB_METEOR_TIERS,
} from './AbilityTypes';
import { FlockFrenzyAbility } from './FlockFrenzyAbility';
import { PoopStormAbility } from './PoopStormAbility';
import { SonicScreechAbility } from './SonicScreechAbility';
import { PhantomTrailAbility } from './PhantomTrailAbility';
import { GoldenHourAbility } from './GoldenHourAbility';
import { DiveBombMeteorAbility } from './DiveBombMeteorAbility';

const STORAGE_KEY = 'bird-game-equipped-ability';

export class AbilityManager {
  readonly group = new THREE.Group();

  // All abilities
  private abilities: Map<AbilityId, IAbility> = new Map();
  private abilityOrder: AbilityId[] = [
    'flock_frenzy', 'poop_storm', 'sonic_screech',
    'phantom_trail', 'golden_hour', 'dive_bomb_meteor',
  ];

  // State
  private equippedId: AbilityId = 'flock_frenzy';
  private charge = 0;
  private playerLevel = 1;

  constructor() {
    const flock = new FlockFrenzyAbility();
    const storm = new PoopStormAbility();
    const screech = new SonicScreechAbility();
    const phantom = new PhantomTrailAbility();
    const golden = new GoldenHourAbility();
    const meteor = new DiveBombMeteorAbility();

    this.abilities.set('flock_frenzy', flock);
    this.abilities.set('poop_storm', storm);
    this.abilities.set('sonic_screech', screech);
    this.abilities.set('phantom_trail', phantom);
    this.abilities.set('golden_hour', golden);
    this.abilities.set('dive_bomb_meteor', meteor);

    for (const ability of this.abilities.values()) {
      this.group.add(ability.group);
    }

    // Load saved equipped ability
    this.loadEquipped();
  }

  initPools(scene: THREE.Scene): void {
    for (const ability of this.abilities.values()) {
      ability.initPool(scene);
    }
  }

  // ── Level & unlock ────────────────────────────────────

  setPlayerLevel(level: number): void {
    this.playerLevel = level;
  }

  getUnlockedAbilities(): AbilityId[] {
    return ABILITY_DEFS
      .filter(def => this.playerLevel >= def.unlockLevel)
      .map(def => def.id);
  }

  isUnlocked(id: AbilityId): boolean {
    const def = ABILITY_DEFS.find(d => d.id === id);
    return def ? this.playerLevel >= def.unlockLevel : false;
  }

  /** Returns the tier index (0, 1, 2) for an ability based on player level */
  getTier(id: AbilityId): number {
    const def = ABILITY_DEFS.find(d => d.id === id);
    if (!def) return 0;
    if (this.playerLevel >= def.tierLevels[2]) return 2;
    if (this.playerLevel >= def.tierLevels[1]) return 1;
    return 0;
  }

  getTierData(id: AbilityId): { tier: number; maxTier: 2 } {
    return { tier: this.getTier(id), maxTier: 2 };
  }

  // ── Equip ─────────────────────────────────────────────

  getEquippedId(): AbilityId { return this.equippedId; }

  getEquipped(): IAbility | null {
    return this.abilities.get(this.equippedId) || null;
  }

  equip(id: AbilityId): boolean {
    if (!this.isUnlocked(id)) return false;
    const current = this.getEquipped();
    if (current?.isActive) return false; // can't switch while active

    this.equippedId = id;
    this.charge = 0; // Reset charge on switch
    this.saveEquipped();
    return true;
  }

  /** Cycle to the next unlocked ability */
  cycleAbility(direction: 1 | -1 = 1): AbilityId | null {
    const current = this.getEquipped();
    if (current?.isActive) return null;

    const unlocked = this.getUnlockedAbilities();
    if (unlocked.length <= 1) return null;

    const currentIdx = unlocked.indexOf(this.equippedId);
    const nextIdx = (currentIdx + direction + unlocked.length) % unlocked.length;
    this.equip(unlocked[nextIdx]);
    return unlocked[nextIdx];
  }

  // ── Charge ────────────────────────────────────────────

  addCharge(amount: number): void {
    const equipped = this.getEquipped();
    if (!equipped || equipped.isActive) return;
    if (!this.isUnlocked(this.equippedId)) return;

    // Apply tier charge rate multiplier
    const tier = this.getTier(this.equippedId);
    const multiplier = this.getChargeRateMultiplier(this.equippedId, tier);
    this.charge = clamp(this.charge + amount * multiplier, 0, ABILITY_CHARGE.MAX);
  }

  /** Passive charge decay */
  decayCharge(dt: number): void {
    const equipped = this.getEquipped();
    if (!equipped || equipped.isActive) return;
    if (this.charge > 0) {
      this.charge = Math.max(0, this.charge - ABILITY_CHARGE.DECAY_RATE * dt);
    }
  }

  // ── Activation ────────────────────────────────────────

  tryActivate(ctx: AbilityContext): boolean {
    const equipped = this.getEquipped();
    if (!equipped) return false;
    if (equipped.isActive) return false;
    if (!this.isUnlocked(this.equippedId)) return false;
    if (this.charge < ABILITY_CHARGE.MAX) return false;

    const tier = this.getTier(this.equippedId);
    this.charge = 0;
    equipped.activate(tier, ctx);
    return true;
  }

  // ── Update ────────────────────────────────────────────

  update(dt: number, ctx: AbilityContext): void {
    this.decayCharge(dt);

    // Update all abilities (some may have lingering VFX)
    for (const ability of this.abilities.values()) {
      ability.update(dt, ctx);
      ability.updatePoops(dt);
    }
  }

  // ── Hooks (forwarded to equipped ability) ─────────────

  notifyPlayerPoop(): void { this.getEquipped()?.notifyPlayerPoop(); }
  notifyPlayerDive(isDiving: boolean): void { this.getEquipped()?.notifyPlayerDive(isDiving); }
  notifyPlayerFlip(flipType: string): void { this.getEquipped()?.notifyPlayerFlip(flipType); }

  // ── Score modifiers ───────────────────────────────────

  getCoinMultiplier(): number { return this.getEquipped()?.getCoinMultiplier() ?? 1; }
  getHeatMultiplier(): number { return this.getEquipped()?.getHeatMultiplier() ?? 1; }

  // ── Active poops from all abilities ───────────────────

  getAllActivePoops(): Poop[] {
    const poops: Poop[] = [];
    for (const ability of this.abilities.values()) {
      poops.push(...ability.getActivePoops());
    }
    return poops;
  }

  // ── State queries (for HUD) ───────────────────────────

  get chargeProgress(): number { return this.charge / ABILITY_CHARGE.MAX; }
  get isReady(): boolean { return this.charge >= ABILITY_CHARGE.MAX && this.isUnlocked(this.equippedId); }
  get isActive(): boolean { return this.getEquipped()?.isActive ?? false; }
  get durationProgress(): number { return this.getEquipped()?.durationProgress ?? 0; }

  get equippedName(): string {
    const def = ABILITY_DEFS.find(d => d.id === this.equippedId);
    return def?.name ?? '';
  }

  get equippedTier(): number { return this.getTier(this.equippedId); }

  get hasAbilityUnlocked(): boolean {
    return this.getUnlockedAbilities().length > 0;
  }

  // ── Specific ability access (for Game.ts special handling) ──

  getAbility<T extends IAbility>(id: AbilityId): T | null {
    return (this.abilities.get(id) as T) || null;
  }

  // ── Private helpers ───────────────────────────────────

  private getChargeRateMultiplier(id: AbilityId, tier: number): number {
    switch (id) {
      case 'flock_frenzy': return FLOCK_FRENZY_TIERS[tier]?.chargeRateMultiplier ?? 1;
      case 'poop_storm': return POOP_STORM_TIERS[tier]?.chargeRateMultiplier ?? 1;
      case 'sonic_screech': return SONIC_SCREECH_TIERS[tier]?.chargeRateMultiplier ?? 1;
      case 'phantom_trail': return PHANTOM_TRAIL_TIERS[tier]?.chargeRateMultiplier ?? 1;
      case 'golden_hour': return GOLDEN_HOUR_TIERS[tier]?.chargeRateMultiplier ?? 1;
      case 'dive_bomb_meteor': return DIVE_BOMB_METEOR_TIERS[tier]?.chargeRateMultiplier ?? 1;
      default: return 1;
    }
  }

  private loadEquipped(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && this.abilities.has(stored as AbilityId)) {
        this.equippedId = stored as AbilityId;
      }
    } catch { /* ignore */ }
  }

  private saveEquipped(): void {
    try {
      localStorage.setItem(STORAGE_KEY, this.equippedId);
    } catch { /* ignore */ }
  }
}
