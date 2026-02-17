/**
 * Bot Behavior State Machine
 * Drives realistic bird flight patterns that mimic human players.
 * Uses Perlin-like noise for organic movement and weighted state transitions.
 */

import { Vector3 } from './types';

// --- Behavior States ---

export type BotState =
  | 'cruise'      // Fly naturally through the city
  | 'hunt'        // Fly toward a target area, drop poops
  | 'bank'        // Head to Sanctuary to bank coins
  | 'tricks'      // Do flips, barrel rolls, dives
  | 'pvp_chase'   // Chase a nearby player and try to poop on them
  | 'perch'       // Land on a rooftop briefly
  | 'idle_wander'; // Gentle circling, altitude changes

interface BotStateConfig {
  minDuration: number;
  maxDuration: number;
  weight: number; // Relative probability of being chosen
}

const STATE_CONFIGS: Record<BotState, BotStateConfig> = {
  cruise:      { minDuration: 5,  maxDuration: 15, weight: 30 },
  hunt:        { minDuration: 4,  maxDuration: 10, weight: 25 },
  bank:        { minDuration: 3,  maxDuration: 6,  weight: 5 },
  tricks:      { minDuration: 2,  maxDuration: 5,  weight: 15 },
  pvp_chase:   { minDuration: 3,  maxDuration: 8,  weight: 10 },
  perch:       { minDuration: 2,  maxDuration: 6,  weight: 5 },
  idle_wander: { minDuration: 3,  maxDuration: 8,  weight: 10 },
};

// --- Bot Personality Archetypes ---

export type BotArchetype = 'pvp_hunter' | 'explorer' | 'coin_farmer' | 'trick_showoff' | 'chaotic_newbie';

interface ArchetypeProfile {
  stateWeights: Record<BotState, number>;
  speedMultiplier: number;
  aggressionLevel: number;
  poopFrequencyMult: number;
  bankingThreshold: number;
  reactToHit: 'chase' | 'flee' | 'ignore';
  imperfectionScale: number; // Movement jitter: 0.5 = smooth, 1.0 = normal, 2.0 = very jittery
}

const ARCHETYPES: Record<BotArchetype, ArchetypeProfile> = {
  pvp_hunter: {
    stateWeights: { pvp_chase: 35, hunt: 20, cruise: 15, tricks: 10, bank: 5, perch: 5, idle_wander: 5 },
    speedMultiplier: 1.2,
    aggressionLevel: 0.9,
    poopFrequencyMult: 1.5,
    bankingThreshold: 60,
    reactToHit: 'chase',
    imperfectionScale: 0.5, // Smooth, precise flyer
  },
  explorer: {
    stateWeights: { cruise: 35, idle_wander: 25, perch: 15, tricks: 10, hunt: 5, pvp_chase: 3, bank: 7 },
    speedMultiplier: 0.85,
    aggressionLevel: 0.15,
    poopFrequencyMult: 0.5,
    bankingThreshold: 40,
    reactToHit: 'flee',
    imperfectionScale: 1.0, // Average human
  },
  coin_farmer: {
    stateWeights: { hunt: 40, cruise: 20, bank: 15, idle_wander: 10, tricks: 5, pvp_chase: 5, perch: 5 },
    speedMultiplier: 1.0,
    aggressionLevel: 0.3,
    poopFrequencyMult: 1.8,
    bankingThreshold: 25,
    reactToHit: 'flee',
    imperfectionScale: 0.7, // Focused, few mistakes
  },
  trick_showoff: {
    stateWeights: { tricks: 40, cruise: 20, idle_wander: 10, hunt: 10, pvp_chase: 10, bank: 5, perch: 5 },
    speedMultiplier: 1.15,
    aggressionLevel: 0.5,
    poopFrequencyMult: 0.7,
    bankingThreshold: 50,
    reactToHit: 'ignore',
    imperfectionScale: 0.6, // Practiced but flashy
  },
  chaotic_newbie: {
    stateWeights: { idle_wander: 25, cruise: 25, perch: 15, hunt: 10, tricks: 15, pvp_chase: 5, bank: 5 },
    speedMultiplier: 0.75,
    aggressionLevel: 0.2,
    poopFrequencyMult: 0.4,
    bankingThreshold: 15,
    reactToHit: 'flee',
    imperfectionScale: 2.0, // Very jittery, lots of hesitation
  },
};

const ALL_ARCHETYPES: BotArchetype[] = ['pvp_hunter', 'explorer', 'coin_farmer', 'trick_showoff', 'chaotic_newbie'];

// --- Sanctuary location (center of city) ---
const SANCTUARY_POS: Vector3 = { x: 0, y: 0, z: 0 };
const SANCTUARY_RADIUS = 12;

// --- World bounds (matching server Player.ts validation) ---
const WORLD_BOUND = 110; // Stay within ±110 to avoid rejection
const MIN_ALTITUDE = 5;
const MAX_ALTITUDE = 150;
const CRUISE_ALTITUDE_MIN = 15;
const CRUISE_ALTITUDE_MAX = 80;

// --- Flight parameters ---
const BASE_SPEED = 30;
const MAX_SPEED = 50;
const DIVE_SPEED = 70;
const TURN_RATE = 1.8; // radians per second max
const PITCH_RATE = 1.2;
const POOP_COOLDOWN = 1.5; // Bots poop less frequently than allowed (more human)
const REACTION_DELAY_MIN = 0.2;
const REACTION_DELAY_MAX = 0.8;

export interface BotMovementOutput {
  position: Vector3;
  yaw: number;
  pitch: number;
  speed: number;
  shouldPoop: boolean;
  shouldBank: boolean;
  shouldCompleteBank: boolean;
  shouldCancelBank: boolean;
}

export class BotBehavior {
  // Current state
  state: BotState = 'cruise';
  private stateTimer = 0;
  private stateDuration = 10;

  // Position & orientation
  posX: number;
  posY: number;
  posZ: number;
  yaw: number;
  pitch: number;
  speed: number;

  // Targets
  private targetYaw = 0;
  private targetPitch = 0;
  private targetSpeed = BASE_SPEED;
  private targetPos: Vector3 = { x: 0, y: 40, z: 0 };

  // Noise for organic movement
  private noisePhaseX: number;
  private noisePhaseZ: number;
  private noisePhaseY: number;
  private noiseSpeed: number;

  // Poop timing
  private poopCooldown = 0;
  poopIntent = false;

  // Banking state
  private isBanking = false;
  private bankingTimer = 0;

  // PvP
  private pvpTargetPos: Vector3 | null = null;

  // Tricks
  private trickTimer = 0;
  private trickCooldown = 0;

  // Reaction delay (makes bots feel less robotic)
  private reactionTimer = 0;
  private pendingStateChange: BotState | null = null;

  // Coins (tracked for banking decisions)
  coins = 0;

  // Personality archetype
  readonly archetype: BotArchetype;
  private archetypeProfile: ArchetypeProfile;

  // Reactive behavior (response to being hit)
  private reactingToHit = false;
  private hitReactionTimer = 0;

  // Humanlike movement imperfections
  private microPauseTimer = 0;
  private microPauseActive = false;
  private overcorrectionYaw = 0;
  private overcorrectionDecay = 0;
  private indecisionTimer = 0;
  private indecisionActive = false;
  private indecisionDir = 1;
  private speedBurstTimer = 0;
  private speedBurstActive = false;

  // Session maturity: 0 = just joined, 1 = veteran (set by BotPlayer)
  sessionMaturity = 0;

  constructor(spawnPos: Vector3, archetype?: BotArchetype) {
    this.posX = spawnPos.x;
    this.posY = spawnPos.y;
    this.posZ = spawnPos.z;
    this.yaw = Math.random() * Math.PI * 2;
    this.pitch = 0;
    this.speed = BASE_SPEED;

    // Randomize noise phases so each bot feels unique
    this.noisePhaseX = Math.random() * 1000;
    this.noisePhaseZ = Math.random() * 1000;
    this.noisePhaseY = Math.random() * 1000;
    this.noiseSpeed = 0.3 + Math.random() * 0.4;

    // Assign personality archetype
    this.archetype = archetype || ALL_ARCHETYPES[Math.floor(Math.random() * ALL_ARCHETYPES.length)];
    this.archetypeProfile = ARCHETYPES[this.archetype];

    this.pickNewState();
  }

  // --- Main Update ---

  update(dt: number, nearbyPlayerPositions: Vector3[]): BotMovementOutput {
    // Update noise phases
    this.noisePhaseX += dt * this.noiseSpeed;
    this.noisePhaseZ += dt * this.noiseSpeed * 0.7;
    this.noisePhaseY += dt * this.noiseSpeed * 0.5;

    // Handle reaction delay for state changes
    if (this.pendingStateChange !== null) {
      this.reactionTimer -= dt;
      if (this.reactionTimer <= 0) {
        this.state = this.pendingStateChange;
        this.pendingStateChange = null;
        this.onStateEnter();
      }
    }

    // Update state timer
    this.stateTimer += dt;
    if (this.stateTimer >= this.stateDuration && this.pendingStateChange === null) {
      this.scheduleStateChange();
    }

    // Poop cooldown
    this.poopCooldown = Math.max(0, this.poopCooldown - dt);
    this.poopIntent = false;

    // Trick cooldown
    this.trickCooldown = Math.max(0, this.trickCooldown - dt);

    // Update humanlike movement imperfections
    this.updateMovementImperfections(dt);

    // Update hit reaction timer
    if (this.reactingToHit) {
      this.hitReactionTimer -= dt;
      if (this.hitReactionTimer <= 0) {
        this.reactingToHit = false;
      }
    }

    // Run state-specific behavior
    switch (this.state) {
      case 'cruise':
        this.updateCruise(dt);
        break;
      case 'hunt':
        this.updateHunt(dt);
        break;
      case 'bank':
        this.updateBank(dt);
        break;
      case 'tricks':
        this.updateTricks(dt);
        break;
      case 'pvp_chase':
        this.updatePvPChase(dt, nearbyPlayerPositions);
        break;
      case 'perch':
        this.updatePerch(dt);
        break;
      case 'idle_wander':
        this.updateIdleWander(dt);
        break;
    }

    // Evasive movement when fleeing from attacker (zigzag + climb)
    if (this.reactingToHit && this.archetypeProfile.reactToHit === 'flee') {
      this.targetYaw += Math.sin(this.stateTimer * 4) * 0.6 * dt;
      this.targetPitch = clamp(this.targetPitch + 0.15, -0.3, 0.5);
      this.targetSpeed = MAX_SPEED;
    }

    // --- Smoothly interpolate toward targets (with imperfections layered on) ---

    // Overcorrection offset on yaw
    this.yaw = lerpAngle(this.yaw, this.targetYaw + this.overcorrectionYaw, TURN_RATE * dt);
    if (this.overcorrectionDecay > 0) {
      this.overcorrectionDecay -= dt;
      if (this.overcorrectionDecay <= 0) this.overcorrectionYaw = 0;
    }

    // Indecision: wobble target direction
    if (this.indecisionActive) {
      this.targetYaw += this.indecisionDir * 0.8 * dt;
    }

    this.pitch = lerpAngle(this.pitch, this.targetPitch, PITCH_RATE * dt);

    // Apply archetype speed multiplier + session maturity scaling
    const maturitySpeedMod = 0.7 + this.sessionMaturity * 0.3;
    const effectiveTargetSpeed = this.targetSpeed * this.archetypeProfile.speedMultiplier * maturitySpeedMod;
    this.speed += (effectiveTargetSpeed - this.speed) * 3 * dt;

    // Micro-pause: briefly cut speed as if distracted
    if (this.microPauseActive) {
      this.speed *= 0.15;
    }

    // Speed burst: short acceleration then coast
    if (this.speedBurstActive) {
      this.speed = Math.min(MAX_SPEED, this.speed * 1.4);
    }

    // Move forward based on yaw/pitch
    const cosP = Math.cos(this.pitch);
    const vx = -Math.sin(this.yaw) * cosP * this.speed;
    const vy = Math.sin(this.pitch) * this.speed * 0.3; // Pitch affects altitude gently
    const vz = -Math.cos(this.yaw) * cosP * this.speed;

    this.posX += vx * dt;
    this.posY += vy * dt;
    this.posZ += vz * dt;

    // Add Perlin-like noise for organic feel
    const noiseX = Math.sin(this.noisePhaseX) * 0.5;
    const noiseZ = Math.sin(this.noisePhaseZ * 1.3) * 0.5;
    const noiseY = Math.sin(this.noisePhaseY * 0.8) * 0.2;
    this.posX += noiseX * dt;
    this.posZ += noiseZ * dt;
    this.posY += noiseY * dt;

    // Clamp to world bounds
    this.clampPosition();

    // Banking output
    let shouldBank = false;
    let shouldCompleteBank = false;
    let shouldCancelBank = false;

    if (this.isBanking) {
      this.bankingTimer += dt;
      if (this.bankingTimer >= 3.0) {
        shouldCompleteBank = true;
        this.isBanking = false;
        this.bankingTimer = 0;
        this.coins = 0;
      }
    }

    if (this.state === 'bank' && !this.isBanking) {
      const dx = this.posX - SANCTUARY_POS.x;
      const dz = this.posZ - SANCTUARY_POS.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < SANCTUARY_RADIUS && this.posY < 10 && this.coins > 0) {
        shouldBank = true;
        this.isBanking = true;
        this.bankingTimer = 0;
      }
    }

    return {
      position: { x: this.posX, y: this.posY, z: this.posZ },
      yaw: this.yaw,
      pitch: this.pitch,
      speed: this.speed,
      shouldPoop: this.poopIntent && this.poopCooldown <= 0,
      shouldBank,
      shouldCompleteBank,
      shouldCancelBank,
    };
  }

  // --- State Behaviors ---

  private updateCruise(dt: number): void {
    // Fly toward a waypoint with gentle curves
    const dx = this.targetPos.x - this.posX;
    const dz = this.targetPos.z - this.posZ;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 15) {
      // Pick new waypoint
      this.targetPos = this.randomWaypoint(CRUISE_ALTITUDE_MIN, CRUISE_ALTITUDE_MAX);
    }

    this.targetYaw = Math.atan2(-dx, -dz);
    this.targetSpeed = BASE_SPEED + Math.sin(this.noisePhaseX * 0.5) * 8;

    // Maintain altitude
    const altDiff = this.targetPos.y - this.posY;
    this.targetPitch = clamp(altDiff * 0.05, -0.4, 0.4);

    // Occasionally poop while cruising (scaled by archetype)
    if (Math.random() < 0.005 * this.archetypeProfile.poopFrequencyMult && this.poopCooldown <= 0) {
      this.poopIntent = true;
      this.poopCooldown = POOP_COOLDOWN + Math.random() * 2;
      this.coins += 10; // Simulate earning coins
    }
  }

  private updateHunt(dt: number): void {
    // Fly toward target area with dive-bomb pattern
    const dx = this.targetPos.x - this.posX;
    const dz = this.targetPos.z - this.posZ;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 10) {
      this.targetPos = this.randomWaypoint(15, 40);
    }

    this.targetYaw = Math.atan2(-dx, -dz);

    // Dive-bomb cycle: cruise high → dive to poop → pull up
    const cyclePeriod = 6 + Math.sin(this.noisePhaseY) * 2;
    const cyclePhase = (this.stateTimer % cyclePeriod) / cyclePeriod;

    if (cyclePhase < 0.55) {
      // Cruise phase: hold moderate-high altitude, build speed
      const targetAlt = 30 + Math.sin(this.noisePhaseY) * 10;
      const altDiff = targetAlt - this.posY;
      this.targetPitch = clamp(altDiff * 0.08, -0.6, 0.4);
      this.targetSpeed = BASE_SPEED + 5;

      // Occasional casual poop during cruise (less frequent)
      if (Math.random() < 0.005 * this.archetypeProfile.poopFrequencyMult && this.poopCooldown <= 0) {
        this.poopIntent = true;
        this.poopCooldown = POOP_COOLDOWN + Math.random() * 2;
        this.coins += 10;
      }
    } else if (cyclePhase < 0.8) {
      // Dive phase: nose down, accelerate, poop when low enough
      this.targetPitch = -0.6;
      this.targetSpeed = DIVE_SPEED;

      if (this.posY < 20 && this.poopCooldown <= 0
          && Math.random() < 0.1 * this.archetypeProfile.poopFrequencyMult) {
        this.poopIntent = true;
        this.poopCooldown = POOP_COOLDOWN + Math.random();
        this.coins += 10;
      }
    } else {
      // Pull-up phase: climb back to altitude
      this.targetPitch = 0.4;
      this.targetSpeed = BASE_SPEED + 10;
    }
  }

  private updateBank(dt: number): void {
    if (this.isBanking) {
      // Hover near sanctuary
      this.targetSpeed = 2;
      this.targetPitch = 0;
      return;
    }

    // Fly toward sanctuary
    const dx = SANCTUARY_POS.x - this.posX;
    const dz = SANCTUARY_POS.z - this.posZ;
    const dist = Math.sqrt(dx * dx + dz * dz);

    this.targetYaw = Math.atan2(-dx, -dz);

    if (dist > 20) {
      this.targetSpeed = MAX_SPEED;
      const altDiff = 8 - this.posY;
      this.targetPitch = clamp(altDiff * 0.1, -0.8, 0.3);
    } else {
      // Slow down approaching sanctuary
      this.targetSpeed = Math.max(5, dist * 0.5);
      const altDiff = 5 - this.posY;
      this.targetPitch = clamp(altDiff * 0.15, -0.8, 0.3);
    }
  }

  private updateTricks(dt: number): void {
    // Fly around doing flips (no actual flip animation on server, just speed/pitch changes)
    this.targetSpeed = MAX_SPEED;

    if (this.trickCooldown <= 0) {
      // Simulate a trick: sudden pitch and speed change
      this.targetPitch = (Math.random() - 0.5) * 1.5;
      this.targetSpeed = BASE_SPEED + Math.random() * 20;
      this.trickCooldown = 1.5 + Math.random() * 2;
    }

    // Auto-level after trick
    if (this.trickCooldown > 0 && this.trickCooldown < 0.5) {
      this.targetPitch = 0;
    }

    // Gentle turn while doing tricks
    this.targetYaw += Math.sin(this.noisePhaseX * 2) * TURN_RATE * 0.3 * dt;
  }

  private updatePvPChase(dt: number, nearbyPlayers: Vector3[]): void {
    if (nearbyPlayers.length === 0) {
      // No players to chase, cruise instead
      this.updateCruise(dt);
      return;
    }

    // Pick closest player as target
    if (!this.pvpTargetPos || Math.random() < 0.01) {
      let closestDist = Infinity;
      for (const p of nearbyPlayers) {
        const dx = p.x - this.posX;
        const dy = p.y - this.posY;
        const dz = p.z - this.posZ;
        const dist = dx * dx + dy * dy + dz * dz;
        if (dist < closestDist) {
          closestDist = dist;
          this.pvpTargetPos = { ...p };
        }
      }
    }

    if (this.pvpTargetPos) {
      const dx = this.pvpTargetPos.x - this.posX;
      const dz = this.pvpTargetPos.z - this.posZ;
      const dy = this.pvpTargetPos.y - this.posY;
      const dist = Math.sqrt(dx * dx + dz * dz);

      this.targetYaw = Math.atan2(-dx, -dz);
      this.targetSpeed = Math.min(MAX_SPEED, BASE_SPEED + dist * 0.3);

      // Match target altitude (slightly above for pooping advantage)
      const altDiff = (this.pvpTargetPos.y + 8) - this.posY;
      this.targetPitch = clamp(altDiff * 0.1, -0.6, 0.6);

      // Poop when close and above target (aggression extends range)
      const poopRange = 20 + this.archetypeProfile.aggressionLevel * 10;
      if (dist < poopRange && this.posY > this.pvpTargetPos.y + 2 && this.poopCooldown <= 0) {
        this.poopIntent = true;
        this.poopCooldown = POOP_COOLDOWN + Math.random() * 0.5;
      }
    }
  }

  private updatePerch(dt: number): void {
    // Descend to a rooftop-like altitude and slow down
    const targetAlt = 12 + Math.sin(this.noisePhaseX) * 5;
    const altDiff = targetAlt - this.posY;
    this.targetPitch = clamp(altDiff * 0.1, -0.5, 0.2);
    this.targetSpeed = Math.max(3, this.targetSpeed - 5 * dt);

    // Gentle circling
    this.targetYaw += 0.3 * dt;
  }

  private updateIdleWander(dt: number): void {
    // Gentle lazy circles with altitude variation
    this.targetYaw += (0.5 + Math.sin(this.noisePhaseX) * 0.3) * dt;
    this.targetSpeed = BASE_SPEED * 0.7 + Math.sin(this.noisePhaseZ) * 5;

    const targetAlt = 30 + Math.sin(this.noisePhaseY * 0.5) * 20;
    const altDiff = targetAlt - this.posY;
    this.targetPitch = clamp(altDiff * 0.04, -0.3, 0.3);
  }

  // --- State Transitions ---

  private scheduleStateChange(): void {
    const nextState = this.pickNextState();
    this.reactionTimer = REACTION_DELAY_MIN + Math.random() * (REACTION_DELAY_MAX - REACTION_DELAY_MIN);
    this.pendingStateChange = nextState;
  }

  private pickNextState(): BotState {
    // Start with archetype-specific weights instead of defaults
    const weights: Record<BotState, number> = { ...this.archetypeProfile.stateWeights };

    // Session maturity adjustments
    if (this.sessionMaturity < 0.2) {
      // Fresh player: more exploring, less PvP
      weights.idle_wander += 10;
      weights.cruise += 5;
      weights.pvp_chase = Math.max(1, weights.pvp_chase - 5);
    } else if (this.sessionMaturity > 0.6) {
      // Veteran: more confident — PvP + banking
      weights.pvp_chase += 8;
      weights.bank += 5;
    }

    // If we have coins, increase bank probability (using archetype threshold)
    if (this.coins >= this.archetypeProfile.bankingThreshold) {
      weights.bank = 25;
    }
    if (this.coins >= this.archetypeProfile.bankingThreshold * 2) {
      weights.bank = 50;
    }

    // Don't pick the same state twice in a row (unless banking with coins)
    if (this.state !== 'bank') {
      weights[this.state] = Math.max(1, weights[this.state] * 0.3);
    }

    return weightedRandom(weights);
  }

  private pickNewState(): void {
    this.state = this.pickNextState();
    this.onStateEnter();
  }

  private onStateEnter(): void {
    const config = STATE_CONFIGS[this.state];
    this.stateTimer = 0;
    this.stateDuration = config.minDuration + Math.random() * (config.maxDuration - config.minDuration);

    switch (this.state) {
      case 'cruise':
      case 'hunt':
      case 'idle_wander':
        this.targetPos = this.randomWaypoint(CRUISE_ALTITUDE_MIN, CRUISE_ALTITUDE_MAX);
        break;
      case 'bank':
        // Only bank if we have coins
        if (this.coins <= 0) {
          this.state = 'cruise';
          this.targetPos = this.randomWaypoint(CRUISE_ALTITUDE_MIN, CRUISE_ALTITUDE_MAX);
        }
        break;
      case 'tricks':
        this.trickCooldown = 0;
        break;
      case 'pvp_chase':
        this.pvpTargetPos = null;
        break;
    }
  }

  // --- Reactive Behavior ---

  /** Called when this bot gets hit by a poop / stunned */
  onHit(attackerPos: Vector3 | null): void {
    const reaction = this.archetypeProfile.reactToHit;
    if (reaction === 'chase' && attackerPos) {
      // Aggressive: chase the attacker
      this.pvpTargetPos = { ...attackerPos };
      this.state = 'pvp_chase';
      this.stateTimer = 0;
      this.stateDuration = 5 + Math.random() * 5;
      this.reactingToHit = true;
      this.hitReactionTimer = this.stateDuration;
      this.pendingStateChange = null;
    } else if (reaction === 'flee') {
      // Passive: flee in opposite direction
      if (attackerPos) {
        const dx = this.posX - attackerPos.x;
        const dz = this.posZ - attackerPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz) || 1;
        this.targetPos = {
          x: clamp(this.posX + (dx / dist) * 50, -WORLD_BOUND, WORLD_BOUND),
          y: this.posY + 10 + Math.random() * 20,
          z: clamp(this.posZ + (dz / dist) * 50, -WORLD_BOUND, WORLD_BOUND),
        };
      }
      this.state = 'cruise';
      this.targetSpeed = MAX_SPEED;
      this.stateTimer = 0;
      this.stateDuration = 4 + Math.random() * 4;
      this.reactingToHit = true;
      this.hitReactionTimer = this.stateDuration;
      this.pendingStateChange = null;
    }
    // 'ignore' — do nothing beyond the chat
  }

  /** Called when this bot's poop hits another player */
  onPoopHitPlayer(): void {
    // Behavioral follow-up: pvp_hunters extend their aggression streak
    if (this.archetype === 'pvp_hunter' && this.state === 'pvp_chase') {
      this.stateDuration += 3;
    }
  }

  /** Called when banking completes successfully */
  onBankComplete(): void {
    this.coins = 0;
  }

  // --- Humanlike Movement Imperfections ---

  private updateMovementImperfections(dt: number): void {
    const scale = this.archetypeProfile.imperfectionScale;

    // Micro-pause: brief stop as if player got distracted
    if (this.microPauseActive) {
      this.microPauseTimer -= dt;
      if (this.microPauseTimer <= 0) {
        this.microPauseActive = false;
      }
    } else if (Math.random() < 0.003 * scale) {
      this.microPauseActive = true;
      this.microPauseTimer = 0.2 + Math.random() * 0.4;
    }

    // Overcorrection: overshoot turns slightly then correct
    if (this.overcorrectionDecay <= 0 && Math.random() < 0.005 * scale) {
      this.overcorrectionYaw = (Math.random() - 0.5) * 0.4 * scale;
      this.overcorrectionDecay = 0.3 + Math.random() * 0.5;
    }

    // Indecision: hover and wobble direction before committing
    if (this.indecisionActive) {
      this.indecisionTimer -= dt;
      this.indecisionDir = Math.floor(this.indecisionTimer * 3) % 2 === 0 ? 1 : -1;
      if (this.indecisionTimer <= 0) {
        this.indecisionActive = false;
      }
    } else if (Math.random() < 0.002 * scale) {
      this.indecisionActive = true;
      this.indecisionTimer = 0.8 + Math.random() * 1.0;
    }

    // Speed burst: brief acceleration followed by coasting
    if (this.speedBurstActive) {
      this.speedBurstTimer -= dt;
      if (this.speedBurstTimer <= 0) {
        this.speedBurstActive = false;
      }
    } else if (Math.random() < 0.004 * scale) {
      this.speedBurstActive = true;
      this.speedBurstTimer = 0.5 + Math.random() * 1.0;
    }
  }

  // --- Helpers ---

  private randomWaypoint(minAlt: number, maxAlt: number): Vector3 {
    return {
      x: (Math.random() - 0.5) * WORLD_BOUND * 1.8,
      y: minAlt + Math.random() * (maxAlt - minAlt),
      z: (Math.random() - 0.5) * WORLD_BOUND * 1.8,
    };
  }

  private clampPosition(): void {
    this.posX = clamp(this.posX, -WORLD_BOUND, WORLD_BOUND);
    this.posZ = clamp(this.posZ, -WORLD_BOUND, WORLD_BOUND);
    this.posY = clamp(this.posY, MIN_ALTITUDE, MAX_ALTITUDE);

    // Gentle push-back from edges
    const edgePush = 0.5;
    if (Math.abs(this.posX) > WORLD_BOUND * 0.85) {
      this.targetYaw = Math.atan2(this.posX, this.posZ) + Math.PI;
    }
    if (Math.abs(this.posZ) > WORLD_BOUND * 0.85) {
      this.targetYaw = Math.atan2(this.posX, this.posZ) + Math.PI;
    }
  }

  /** Notify behavior that coins were earned (e.g. from PvP hit) */
  addCoins(amount: number): void {
    this.coins += amount;
  }

  /** Get position as Vector3 */
  getPosition(): Vector3 {
    return { x: this.posX, y: this.posY, z: this.posZ };
  }
}

// --- Utility Functions ---

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function lerpAngle(from: number, to: number, maxDelta: number): number {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const clamped = clamp(diff, -maxDelta, maxDelta);
  return from + clamped;
}

function weightedRandom(weights: Record<string, number>): BotState {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + (typeof w === 'number' ? w : 0), 0);
  let roll = Math.random() * total;
  for (const [state, weight] of entries) {
    if (typeof weight !== 'number') continue;
    roll -= weight;
    if (roll <= 0) return state as BotState;
  }
  return 'cruise';
}
