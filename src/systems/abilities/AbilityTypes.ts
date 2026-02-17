import * as THREE from 'three';
import { Poop } from '../../entities/Poop';

// ── Ability IDs ─────────────────────────────────────────

export type AbilityId =
  | 'flock_frenzy'
  | 'poop_storm'
  | 'sonic_screech'
  | 'phantom_trail'
  | 'golden_hour'
  | 'dive_bomb_meteor';

// ── Context passed to abilities each frame ──────────────

export interface AbilityContext {
  playerPosition: THREE.Vector3;
  playerForward: THREE.Vector3;
  playerSpeed: number;
  playerPitch: number;
  playerRoll: number;
  playerAltitude: number;
  scene: THREE.Scene;
}

// ── Ability interface ───────────────────────────────────

export interface IAbility {
  readonly id: AbilityId;
  readonly group: THREE.Group;

  /** Set up any pooled objects (poops, meshes) that need scene access */
  initPool(scene: THREE.Scene): void;

  /** Activate the ability at the given tier (0, 1, or 2) */
  activate(tier: number, ctx: AbilityContext): void;

  /** Force-deactivate (cleanup) */
  deactivate(): void;

  /** Per-frame update */
  update(dt: number, ctx: AbilityContext): void;

  // ── State queries ──

  readonly isActive: boolean;

  /** 1 = full duration remaining, 0 = expired. Instant abilities return 0. */
  readonly durationProgress: number;

  // ── Optional hooks (called by manager when player does things) ──

  notifyPlayerPoop(): void;
  notifyPlayerDive(isDiving: boolean): void;
  notifyPlayerFlip(flipType: string): void;

  // ── Poops managed by this ability ──

  getActivePoops(): Poop[];
  updatePoops(dt: number): void;

  // ── Score modifiers (applied while active) ──

  /** Multiplier applied to all coin gains. Default 1. */
  getCoinMultiplier(): number;

  /** Multiplier applied to heat gain. Default 1. */
  getHeatMultiplier(): number;
}

// ── Tier data per ability ───────────────────────────────

export interface FlockFrenzyTier {
  birdCount: number;
  birdScale: number;
  duration: number;
  mimicPoop: boolean;
  mimicDive: boolean;
  mimicFlip: boolean;
  poopScoreMultiplier: number;
  chargeRateMultiplier: number;
}

export interface PoopStormTier {
  duration: number;
  fireRate: number;        // poops per second
  spread: number;          // horizontal spread
  explodeOnImpact: boolean;
  explosionRadius: number;
  chargeRateMultiplier: number;
}

export interface SonicScreechTier {
  radius: number;
  coinMultiplier: number;
  stunDuration: number;
  chainStun: boolean;      // stun chains to nearby NPCs
  scatterVehicles: boolean;
  chargeRateMultiplier: number;
}

export interface PhantomTrailTier {
  ghostCount: number;
  recordDuration: number;  // seconds of flight path recorded
  ghostsDropPoop: boolean;
  poopScoreMultiplier: number;
  chargeRateMultiplier: number;
}

export interface GoldenHourTier {
  duration: number;
  coinMultiplier: number;
  heatMultiplier: number;  // < 1 means reduced heat
  chargeRateMultiplier: number;
}

export interface DiveBombMeteorTier {
  blastRadius: number;
  coinMultiplier: number;
  launchNPCs: boolean;
  groundCrack: boolean;
  chargeRateMultiplier: number;
}

// ── Ability registry ────────────────────────────────────

export interface AbilityDef {
  id: AbilityId;
  name: string;
  description: string;
  unlockLevel: number;
  tierLevels: [number, number, number]; // level required for tier 1, 2, 3
}

export const ABILITY_DEFS: AbilityDef[] = [
  {
    id: 'flock_frenzy',
    name: 'Flock Frenzy',
    description: 'Summon a swarm of birds that mimic your every move',
    unlockLevel: 5,
    tierLevels: [5, 13, 21],
  },
  {
    id: 'poop_storm',
    name: 'Poop Storm',
    description: 'Unleash a rapid-fire barrage of poop with no cooldown',
    unlockLevel: 10,
    tierLevels: [10, 18, 26],
  },
  {
    id: 'sonic_screech',
    name: 'Sonic Screech',
    description: 'Let out a shockwave that stuns NPCs for bonus coins',
    unlockLevel: 15,
    tierLevels: [15, 23, 31],
  },
  {
    id: 'phantom_trail',
    name: 'Phantom Trail',
    description: 'Ghost copies replay your flight path and drop phantom poop',
    unlockLevel: 20,
    tierLevels: [20, 28, 36],
  },
  {
    id: 'golden_hour',
    name: 'Golden Hour',
    description: 'Everything you touch pays out massively for a short window',
    unlockLevel: 25,
    tierLevels: [25, 33, 41],
  },
  {
    id: 'dive_bomb_meteor',
    name: 'Dive Bomb Meteor',
    description: 'Plummet from the sky and create a massive impact shockwave',
    unlockLevel: 30,
    tierLevels: [30, 38, 46],
  },
];

// ── Tier data tables ────────────────────────────────────

export const FLOCK_FRENZY_TIERS: FlockFrenzyTier[] = [
  { birdCount: 8,  birdScale: 0.65, duration: 6,  mimicPoop: true,  mimicDive: false, mimicFlip: false, poopScoreMultiplier: 0.3, chargeRateMultiplier: 1.0 },
  { birdCount: 12, birdScale: 0.7,  duration: 8,  mimicPoop: true,  mimicDive: true,  mimicFlip: false, poopScoreMultiplier: 0.4, chargeRateMultiplier: 1.2 },
  { birdCount: 16, birdScale: 0.7,  duration: 10, mimicPoop: true,  mimicDive: true,  mimicFlip: true,  poopScoreMultiplier: 0.5, chargeRateMultiplier: 1.5 },
];

export const POOP_STORM_TIERS: PoopStormTier[] = [
  { duration: 5, fireRate: 5,  spread: 2,   explodeOnImpact: false, explosionRadius: 0,   chargeRateMultiplier: 1.0 },
  { duration: 7, fireRate: 8,  spread: 3,   explodeOnImpact: false, explosionRadius: 0,   chargeRateMultiplier: 1.2 },
  { duration: 9, fireRate: 12, spread: 4.5, explodeOnImpact: true,  explosionRadius: 3.0, chargeRateMultiplier: 1.5 },
];

export const SONIC_SCREECH_TIERS: SonicScreechTier[] = [
  { radius: 30, coinMultiplier: 1.5, stunDuration: 3,   chainStun: false, scatterVehicles: false, chargeRateMultiplier: 1.0 },
  { radius: 45, coinMultiplier: 2.0, stunDuration: 4,   chainStun: false, scatterVehicles: true,  chargeRateMultiplier: 1.2 },
  { radius: 60, coinMultiplier: 2.5, stunDuration: 5.5, chainStun: true,  scatterVehicles: true,  chargeRateMultiplier: 1.5 },
];

export const PHANTOM_TRAIL_TIERS: PhantomTrailTier[] = [
  { ghostCount: 2, recordDuration: 4, ghostsDropPoop: false, poopScoreMultiplier: 0,   chargeRateMultiplier: 1.0 },
  { ghostCount: 3, recordDuration: 6, ghostsDropPoop: true,  poopScoreMultiplier: 0.3, chargeRateMultiplier: 1.2 },
  { ghostCount: 4, recordDuration: 8, ghostsDropPoop: true,  poopScoreMultiplier: 0.5, chargeRateMultiplier: 1.5 },
];

export const GOLDEN_HOUR_TIERS: GoldenHourTier[] = [
  { duration: 6,  coinMultiplier: 2.0, heatMultiplier: 1.0, chargeRateMultiplier: 1.0 },
  { duration: 8,  coinMultiplier: 2.5, heatMultiplier: 0.5, chargeRateMultiplier: 1.2 },
  { duration: 10, coinMultiplier: 3.0, heatMultiplier: 0.0, chargeRateMultiplier: 1.5 },
];

export const DIVE_BOMB_METEOR_TIERS: DiveBombMeteorTier[] = [
  { blastRadius: 20, coinMultiplier: 2.0, launchNPCs: false, groundCrack: false, chargeRateMultiplier: 1.0 },
  { blastRadius: 30, coinMultiplier: 3.0, launchNPCs: false, groundCrack: true,  chargeRateMultiplier: 1.2 },
  { blastRadius: 40, coinMultiplier: 4.0, launchNPCs: true,  groundCrack: true,  chargeRateMultiplier: 1.5 },
];

// ── Shared ability constants ────────────────────────────

export const ABILITY_CHARGE = {
  MAX: 100,
  PER_NPC_HIT: 8,
  PER_VEHICLE_HIT: 5,
  PER_FLIP: 3,
  DECAY_RATE: 0.5,
};
