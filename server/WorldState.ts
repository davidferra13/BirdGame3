/**
 * Server-authoritative world state
 * Global player visibility with PvP poop tracking.
 */

import { Player } from './Player';
import { ServerSpatialGrid } from './SpatialGrid';
import { RaceManager } from './RaceManager';
import {
  WorldStateSnapshot, FilteredWorldState, Vector3, NPCState,
  HotspotState, ActivePoop, GameEvent, PvPHitResult,
} from './types';

/** Event fanout radius (units) */
const EVENT_BROADCAST_RADIUS = 500;

/** Area-of-Interest radius: only players within this range are included in per-tick state */
const AOI_RADIUS = 600;

/** Lag-compensation: how many ms of position history to keep per player */
const LAG_COMP_HISTORY_MS = 500;
/** Max lag-compensation rewind window for poop hits */
const LAG_COMP_WINDOW_MS = 200;

/** PvP poop settings */
const POOP_HIT_RADIUS = 3;
const POOP_MAX_LIFETIME_MS = 2000;
const POOP_GRAVITY = 15;
const PVP_COIN_STEAL_FRACTION = 0.2;
const PVP_COIN_STEAL_MIN = 5;
const PVP_COIN_STEAL_MAX = 100;
const PVP_STUN_DURATION = 1.5; // seconds
const PVP_HIT_HEAT = 5;
const PVP_DAMAGE_ALTITUDE_MIN = 10;
const PVP_DAMAGE_ALTITUDE_MAX = 200;
const PVP_DAMAGE_MULTIPLIER_MIN = 1.0;
const PVP_DAMAGE_MULTIPLIER_MAX = 2.0;

// Horse lasso (server-authoritative player wrangle)
const LASSO_RANGE = 18;
const LASSO_VERTICAL_WINDOW = 4;
const LASSO_CONE_DOT = 0.78;
const LASSO_WINDUP_MS = 280;
const LASSO_DURATION_MS = 3800;
const LASSO_COOLDOWN_HIT_MS = 2400;
const LASSO_COOLDOWN_MISS_MS = 3800;
const LASSO_TETHER_LENGTH = 9.5;
const LASSO_BREAK_DISTANCE = 34;
const LASSO_PULL_STRENGTH = 22;
const LASSO_BREAKOUT_THRESHOLD = 20;
const LASSO_BREAKOUT_DECAY_PER_SEC = 2.6;
const LASSO_BREAKOUT_IMMUNITY_MS = 3000;
const LASSO_GENERAL_IMMUNITY_MS = 1800;
const LASSO_TARGET_REPEAT_WINDOW_MS = 20000;
const LASSO_TARGET_REPEAT_STEP = 0.22;
const LASSO_TARGET_REPEAT_MIN_MULTIPLIER = 0.45;
const LASSO_TENSION_BREAK_SEC = 1.15;
const LASSO_TENSION_VELOCITY_BREAK = 7;
const LASSO_TENSION_WARNING_THRESHOLD = 0.7;
const LASSO_BREAK_STUN_SECONDS = 0.85;
const LASSO_HEAT_COST_HIT = 2.5;
const LASSO_HEAT_COST_MISS = 1.2;

interface ActiveLassoLink {
  attackerId: string;
  victimId: string;
  expiresAt: number;
  tetherLength: number;
  breakoutProgress: number;
  breakoutDecayPausedUntil: number;
  strain: number;
  previousDistance: number;
  nextWarningAt: number;
}

interface PendingLassoCast {
  attackerId: string;
  victimId: string;
  resolveAt: number;
}

interface LassoRepeatState {
  count: number;
  lastAt: number;
}

let nextPoopId = 0;

export class WorldState {
  private players: Map<string, Player>;
  private npcs: Map<string, NPCState>;
  private hotspots: HotspotState[];
  private currentTick: number;
  private spatialGrid: ServerSpatialGrid;
  private activePoops: ActivePoop[];
  private pendingEvents: Map<string, GameEvent[]>; // playerId -> events for that player
  private activeLassos: Map<string, ActiveLassoLink>; // attackerId -> link
  private lassoCooldownUntil: Map<string, number>; // attackerId -> timestamp
  private pendingLassoCasts: Map<string, PendingLassoCast>; // attackerId -> pending cast
  private lassoVictimImmunityUntil: Map<string, number>; // victimId -> timestamp
  private lassoRepeatByPair: Map<string, LassoRepeatState>; // attacker|victim -> repeat state
  private positionHistory: Map<string, { pos: Vector3; ts: number }[]>; // playerId -> ring buffer
  readonly raceManager: RaceManager;

  // PvP hit callback (used by BotManager to notify bots)
  onPvPHit: ((result: PvPHitResult) => void) | null = null;

  // Server tick rate: 20 ticks/sec
  readonly TICK_RATE = 20;
  readonly TICK_INTERVAL = 1000 / this.TICK_RATE; // 50ms

  constructor() {
    this.players = new Map();
    this.npcs = new Map();
    this.hotspots = [];
    this.currentTick = 0;
    this.spatialGrid = new ServerSpatialGrid(100);
    this.activePoops = [];
    this.pendingEvents = new Map();
    this.activeLassos = new Map();
    this.lassoCooldownUntil = new Map();
    this.pendingLassoCasts = new Map();
    this.lassoVictimImmunityUntil = new Map();
    this.lassoRepeatByPair = new Map();
    this.positionHistory = new Map();
    this.raceManager = new RaceManager();

    this.initializeHotspots();
  }

  private initializeHotspots(): void {
    for (let i = 0; i < 2; i++) {
      this.hotspots.push({
        id: `hotspot_${i}`,
        position: this.randomHotspotPosition(),
        radius: 40,
        active: true,
      });
    }
  }

  private randomHotspotPosition(): Vector3 {
    const angle = Math.random() * Math.PI * 2;
    const distance = 50 + Math.random() * 50;
    return {
      x: Math.cos(angle) * distance,
      y: 0,
      z: Math.sin(angle) * distance,
    };
  }

  addPlayer(player: Player): void {
    this.players.set(player.id, player);
    console.log(`Player ${player.username} joined. Total players: ${this.players.size}`);
  }

  removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      this.pendingLassoCasts.delete(playerId);
      this.releaseLassoByAttacker(playerId, 'disconnect');
      this.releaseLassoByVictim(playerId, 'disconnect');
      for (const cast of Array.from(this.pendingLassoCasts.values())) {
        if (cast.victimId === playerId) {
          this.pendingLassoCasts.delete(cast.attackerId);
        }
      }
      this.players.delete(playerId);
      this.pendingEvents.delete(playerId);
      this.positionHistory.delete(playerId);
      this.raceManager.removePlayer(playerId);
      console.log(`Player ${player.username} left. Total players: ${this.players.size}`);
    }
  }

  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  // --- Active Poop Tracking (PvP) ---

  addActivePoop(ownerId: string, position: Vector3, velocity: Vector3): void {
    this.activePoops.push({
      id: `poop_${nextPoopId++}`,
      ownerId,
      position: { ...position },
      velocity: { ...velocity },
      spawnAltitude: position.y,
      spawnTime: Date.now(),
    });
  }

  /** Admin: remove all in-flight poop projectiles */
  clearActivePoops(): void {
    this.activePoops.length = 0;
  }

  /** Admin: count of in-flight poop projectiles */
  getActivePoopCount(): number {
    return this.activePoops.length;
  }

  // --- Events ---

  private emitEventToPlayer(playerId: string, event: GameEvent): void {
    let events = this.pendingEvents.get(playerId);
    if (!events) {
      events = [];
      this.pendingEvents.set(playerId, events);
    }
    events.push(event);
  }

  private emitEventToNearby(position: Vector3, radius: number, event: GameEvent): void {
    const nearbyIds = this.spatialGrid.queryRadius(position, radius);
    for (const id of nearbyIds) {
      this.emitEventToPlayer(id, event);
    }
  }

  // --- Main Update ---

  update(dt: number): void {
    this.currentTick++;

    // Rebuild spatial grid
    this.spatialGrid.rebuild(this.players);

    // Update all players
    for (const player of this.players.values()) {
      player.decayHeat(dt);
      player.updateSpawnShield();
      player.updateStun();
    }

    // Record position history for lag compensation
    const nowMs = Date.now();
    for (const player of this.players.values()) {
      let history = this.positionHistory.get(player.id);
      if (!history) {
        history = [];
        this.positionHistory.set(player.id, history);
      }
      history.push({ pos: { ...player.position }, ts: nowMs });
      // Trim entries older than LAG_COMP_HISTORY_MS
      const cutoff = nowMs - LAG_COMP_HISTORY_MS;
      let trimIdx = 0;
      while (trimIdx < history.length - 1 && history[trimIdx].ts < cutoff) trimIdx++;
      if (trimIdx > 0) history.splice(0, trimIdx);
    }

    // Update active poops (PvP collision detection)
    this.updateActivePoops(dt);

    // Resolve pending lasso windups into actual casts
    this.updatePendingLassoCasts();

    // Update active lasso links (player wrangle)
    this.updateLassos(dt);

    // Update races
    this.updateRaces();

    // Rotate hotspots every 600 seconds (10 minutes)
    if (this.currentTick % (this.TICK_RATE * 600) === 0) {
      this.rotateHotspots();
    }
  }

  private updateActivePoops(dt: number): void {
    const now = Date.now();
    const toRemove: number[] = [];

    for (let i = 0; i < this.activePoops.length; i++) {
      const poop = this.activePoops[i];

      // Remove expired poops
      if (now - poop.spawnTime > POOP_MAX_LIFETIME_MS) {
        toRemove.push(i);
        continue;
      }

      // Apply gravity
      poop.velocity.y -= POOP_GRAVITY * dt;

      // Move poop
      poop.position.x += poop.velocity.x * dt;
      poop.position.y += poop.velocity.y * dt;
      poop.position.z += poop.velocity.z * dt;

      // Remove if below ground
      if (poop.position.y < 0) {
        toRemove.push(i);
        continue;
      }

      // Check collision with players (current position, then lag-compensated history)
      const nearbyIds = this.spatialGrid.queryRadius(poop.position, POOP_HIT_RADIUS * 2);
      for (const playerId of nearbyIds) {
        if (playerId === poop.ownerId) continue; // can't hit yourself

        const victim = this.players.get(playerId);
        if (!victim) continue;

        // Check protection
        if (victim.state === 'SPAWN_SHIELD') continue;
        if (victim.state === 'BANKING') continue;
        if (victim.isStunned()) continue;
        if (!victim.canBeHitByPvP()) continue;

        // Current-position check (precise)
        let hit = false;
        {
          const dx = victim.position.x - poop.position.x;
          const dy = victim.position.y - poop.position.y;
          const dz = victim.position.z - poop.position.z;
          if (dx * dx + dy * dy + dz * dz <= POOP_HIT_RADIUS * POOP_HIT_RADIUS) hit = true;
        }

        // Lag-compensation: check historical positions up to LAG_COMP_WINDOW_MS ago
        if (!hit) {
          const history = this.positionHistory.get(playerId);
          if (history) {
            const cutoff = now - LAG_COMP_WINDOW_MS;
            for (let h = history.length - 1; h >= 0 && history[h].ts >= cutoff; h--) {
              const hp = history[h].pos;
              const dx = hp.x - poop.position.x;
              const dy = hp.y - poop.position.y;
              const dz = hp.z - poop.position.z;
              if (dx * dx + dy * dy + dz * dz <= POOP_HIT_RADIUS * POOP_HIT_RADIUS) {
                hit = true;
                break;
              }
            }
          }
        }

        if (!hit) continue;

        // HIT! Process PvP hit
        const attacker = this.players.get(poop.ownerId);
        if (!attacker) continue;

        const result = this.processPvPHit(attacker, victim, poop.spawnAltitude);
        toRemove.push(i);
        break; // poop consumed
      }
    }

    // Remove consumed/expired poops (reverse order to preserve indices)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.activePoops.splice(toRemove[i], 1);
    }
  }

  private getAltitudeDamageMultiplier(spawnAltitude: number): number {
    const t = (spawnAltitude - PVP_DAMAGE_ALTITUDE_MIN)
      / (PVP_DAMAGE_ALTITUDE_MAX - PVP_DAMAGE_ALTITUDE_MIN);
    const clamped = Math.max(0, Math.min(1, t));
    return PVP_DAMAGE_MULTIPLIER_MIN
      + (PVP_DAMAGE_MULTIPLIER_MAX - PVP_DAMAGE_MULTIPLIER_MIN) * clamped;
  }

  private processPvPHit(attacker: Player, victim: Player, spawnAltitude: number): PvPHitResult {
    const damageMultiplier = this.getAltitudeDamageMultiplier(spawnAltitude);

    // Calculate stolen coins (scaled by drop altitude)
    let stolenCoins = Math.floor(victim.coins * PVP_COIN_STEAL_FRACTION * damageMultiplier);
    const minSteal = Math.floor(PVP_COIN_STEAL_MIN * damageMultiplier);
    const maxSteal = Math.floor(PVP_COIN_STEAL_MAX * damageMultiplier);
    stolenCoins = Math.max(minSteal, Math.min(maxSteal, stolenCoins));
    if (stolenCoins > victim.coins) stolenCoins = victim.coins;

    // Apply effects
    victim.onPvPHit(stolenCoins, PVP_STUN_DURATION);
    attacker.addCoins(stolenCoins);
    attacker.updateHeat(PVP_HIT_HEAT);

    const result: PvPHitResult = {
      attackerId: attacker.id,
      attackerName: attacker.username,
      victimId: victim.id,
      victimName: victim.username,
      stolenCoins,
      victimStunDuration: PVP_STUN_DURATION,
    };

    // Emit event to nearby players
    const event: GameEvent = { type: 'pvp_hit', data: result };
    this.emitEventToNearby(victim.position, EVENT_BROADCAST_RADIUS, event);

    // Notify external systems (e.g. BotManager for reactive behavior)
    this.onPvPHit?.(result);

    console.log(`💩 PvP HIT! ${attacker.username} splatted ${victim.username} (stole ${stolenCoins} coins @ ${spawnAltitude.toFixed(1)}y, x${damageMultiplier.toFixed(2)})`);
    return result;
  }

  private updateRaces(): void {
    const raceEvents = this.raceManager.update(this.players);
    for (const event of raceEvents) {
      // Send race events to all participants + nearby players
      const race = this.raceManager.getRaceForEvent(event);
      if (race) {
        for (const participant of race.participants) {
          this.emitEventToPlayer(participant.playerId, event);
        }
        // Also notify nearby non-participants
        if (race.checkpoints.length > 0) {
          const raceCenter = race.checkpoints[0].position;
          const nearbyIds = this.spatialGrid.queryRadius(raceCenter, 300);
          for (const id of nearbyIds) {
            const alreadyParticipant = race.participants.some(p => p.playerId === id);
            if (!alreadyParticipant) {
              this.emitEventToPlayer(id, event);
            }
          }
        }
      }
    }
  }

  // --- Horse Lasso (player wrangle) ---

  requestPlayerLasso(attackerId: string, victimId: string): { ok: boolean; reason?: string } {
    return this.requestPlayerLassoCast(attackerId, victimId);
  }

  requestPlayerLassoCast(attackerId: string, victimId: string): { ok: boolean; reason?: string } {
    if (attackerId === victimId) return { ok: false, reason: 'self' };

    const attacker = this.players.get(attackerId);
    const victim = this.players.get(victimId);
    if (!attacker || !victim) return { ok: false, reason: 'missing-player' };

    const now = Date.now();
    const cooldownUntil = this.lassoCooldownUntil.get(attackerId) || 0;
    if (now < cooldownUntil) {
      this.emitLassoFeedback(attackerId, {
        status: 'cooldown',
        reason: 'cooldown',
        cooldownMs: Math.max(0, cooldownUntil - now),
      });
      return { ok: false, reason: 'cooldown' };
    }
    if (this.pendingLassoCasts.has(attackerId)) {
      return { ok: false, reason: 'windup-active' };
    }

    this.pendingLassoCasts.set(attackerId, {
      attackerId,
      victimId,
      resolveAt: now + LASSO_WINDUP_MS,
    });

    const windupEvent: GameEvent = {
      type: 'lasso_windup',
      data: {
        attackerId,
        victimId,
        windupMs: LASSO_WINDUP_MS,
      },
    };
    this.emitEventToNearby(attacker.position, EVENT_BROADCAST_RADIUS, windupEvent);
    this.emitEventToPlayer(attackerId, windupEvent);
    this.emitEventToPlayer(victimId, windupEvent);
    return { ok: true };
  }

  registerLassoBreakoutPulse(victimId: string, pulse: number): boolean {
    const clampedPulse = Math.max(0.25, Math.min(2.5, pulse));
    for (const link of this.activeLassos.values()) {
      if (link.victimId !== victimId) continue;
      link.breakoutProgress = Math.min(LASSO_BREAKOUT_THRESHOLD + 4, link.breakoutProgress + clampedPulse);
      link.breakoutDecayPausedUntil = Date.now() + 250;
      this.emitLassoFeedback(victimId, {
        status: 'breakout_progress',
        attackerId: link.attackerId,
        victimId,
        breakoutProgress: link.breakoutProgress,
        breakoutTarget: LASSO_BREAKOUT_THRESHOLD,
      });
      if (link.breakoutProgress >= LASSO_BREAKOUT_THRESHOLD) {
        this.applyVictimLassoImmunity(victimId, LASSO_BREAKOUT_IMMUNITY_MS);
        this.releaseLassoByAttacker(link.attackerId, 'breakout');
      }
      return true;
    }
    return false;
  }

  private updatePendingLassoCasts(): void {
    const now = Date.now();
    for (const cast of Array.from(this.pendingLassoCasts.values())) {
      if (now < cast.resolveAt) continue;
      this.pendingLassoCasts.delete(cast.attackerId);
      this.resolvePendingLassoCast(cast);
    }
  }

  private resolvePendingLassoCast(cast: PendingLassoCast): void {
    const now = Date.now();
    const attacker = this.players.get(cast.attackerId);
    const victim = this.players.get(cast.victimId);
    if (!attacker || !victim) {
      this.applyLassoMissCooldown(cast.attackerId, 'missing-player');
      return;
    }
    if (cast.attackerId === cast.victimId) {
      this.applyLassoMissCooldown(cast.attackerId, 'self');
      return;
    }

    const victimImmuneUntil = this.lassoVictimImmunityUntil.get(cast.victimId) || 0;
    if (now < victimImmuneUntil) {
      this.applyLassoMissCooldown(cast.attackerId, 'victim-immune');
      this.emitLassoFeedback(cast.attackerId, {
        status: 'immune',
        reason: 'victim-immune',
        cooldownMs: Math.max(0, victimImmuneUntil - now),
        victimId: cast.victimId,
      });
      return;
    }

    const dx = victim.position.x - attacker.position.x;
    const dy = victim.position.y - attacker.position.y;
    const dz = victim.position.z - attacker.position.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq > LASSO_RANGE * LASSO_RANGE) {
      this.applyLassoMissCooldown(cast.attackerId, 'out-of-range');
      return;
    }
    if (Math.abs(dy) > LASSO_VERTICAL_WINDOW) {
      this.applyLassoMissCooldown(cast.attackerId, 'vertical-window');
      return;
    }

    const planarDist = Math.sqrt(dx * dx + dz * dz);
    if (planarDist < 0.001) {
      this.applyLassoMissCooldown(cast.attackerId, 'too-close');
      return;
    }
    const toVictimX = dx / planarDist;
    const toVictimZ = dz / planarDist;
    const attackerForwardX = -Math.sin(attacker.yaw);
    const attackerForwardZ = -Math.cos(attacker.yaw);
    const coneDot = attackerForwardX * toVictimX + attackerForwardZ * toVictimZ;
    if (coneDot < LASSO_CONE_DOT) {
      this.applyLassoMissCooldown(cast.attackerId, 'aim');
      return;
    }

    this.releaseLassoByAttacker(cast.attackerId, 'recast');

    const repeatMult = this.getRepeatDurationMultiplier(cast.attackerId, cast.victimId, now);
    const durationMs = Math.floor(LASSO_DURATION_MS * repeatMult);
    const link: ActiveLassoLink = {
      attackerId: cast.attackerId,
      victimId: cast.victimId,
      expiresAt: now + durationMs,
      tetherLength: LASSO_TETHER_LENGTH,
      breakoutProgress: 0,
      breakoutDecayPausedUntil: 0,
      strain: 0,
      previousDistance: Math.sqrt(distSq),
      nextWarningAt: 0,
    };
    this.activeLassos.set(cast.attackerId, link);
    this.lassoCooldownUntil.set(cast.attackerId, now + LASSO_COOLDOWN_HIT_MS);
    attacker.updateHeat(LASSO_HEAT_COST_HIT);

    const attachEvent: GameEvent = {
      type: 'lasso_attach',
      data: {
        attackerId: cast.attackerId,
        victimId: cast.victimId,
        durationMs,
        tetherLength: LASSO_TETHER_LENGTH,
        breakoutTarget: LASSO_BREAKOUT_THRESHOLD,
      },
    };
    this.emitEventToNearby(victim.position, EVENT_BROADCAST_RADIUS, attachEvent);
    this.emitEventToPlayer(cast.attackerId, attachEvent);
    this.emitEventToPlayer(cast.victimId, attachEvent);
  }

  releaseLassoByAttacker(attackerId: string, reason: string = 'released'): boolean {
    const link = this.activeLassos.get(attackerId);
    if (!link) {
      if (this.pendingLassoCasts.has(attackerId)) {
        this.pendingLassoCasts.delete(attackerId);
        return true;
      }
      return false;
    }

    this.activeLassos.delete(attackerId);
    if (reason === 'breakout') {
      this.applyVictimLassoImmunity(link.victimId, LASSO_BREAKOUT_IMMUNITY_MS);
      this.emitLassoFeedback(link.victimId, {
        status: 'breakout_success',
        attackerId: link.attackerId,
        victimId: link.victimId,
      });
      this.emitLassoFeedback(link.attackerId, {
        status: 'victim_escaped',
        attackerId: link.attackerId,
        victimId: link.victimId,
      });
    } else if (reason === 'broken') {
      this.applyVictimLassoImmunity(link.victimId, LASSO_GENERAL_IMMUNITY_MS);
      const attacker = this.players.get(link.attackerId);
      if (attacker) {
        attacker.applyStun(LASSO_BREAK_STUN_SECONDS);
      }
      this.emitLassoFeedback(link.attackerId, {
        status: 'snapback_stun',
        attackerId: link.attackerId,
        victimId: link.victimId,
      });
    } else if (reason !== 'disconnect' && reason !== 'recast') {
      this.applyVictimLassoImmunity(link.victimId, LASSO_GENERAL_IMMUNITY_MS);
    }

    const releaseEvent: GameEvent = {
      type: 'lasso_release',
      data: {
        attackerId: link.attackerId,
        victimId: link.victimId,
        reason,
      },
    };

    const victim = this.players.get(link.victimId);
    if (victim) this.emitEventToNearby(victim.position, EVENT_BROADCAST_RADIUS, releaseEvent);
    this.emitEventToPlayer(link.attackerId, releaseEvent);
    this.emitEventToPlayer(link.victimId, releaseEvent);

    return true;
  }

  releaseLassoByVictim(victimId: string, reason: string = 'released'): boolean {
    let released = false;
    for (const link of Array.from(this.activeLassos.values())) {
      if (link.victimId !== victimId) continue;
      this.releaseLassoByAttacker(link.attackerId, reason);
      released = true;
    }
    return released;
  }

  private emitLassoFeedback(playerId: string, data: any): void {
    const event: GameEvent = {
      type: 'lasso_feedback',
      data: { ...data, playerId },
    };
    this.emitEventToPlayer(playerId, event);
  }

  private applyLassoMissCooldown(attackerId: string, reason: string): void {
    const until = Date.now() + LASSO_COOLDOWN_MISS_MS;
    this.lassoCooldownUntil.set(attackerId, until);
    const attacker = this.players.get(attackerId);
    if (attacker) attacker.updateHeat(LASSO_HEAT_COST_MISS);
    this.emitLassoFeedback(attackerId, {
      status: 'miss',
      reason,
      cooldownMs: LASSO_COOLDOWN_MISS_MS,
    });
  }

  private applyVictimLassoImmunity(victimId: string, durationMs: number): void {
    const now = Date.now();
    const current = this.lassoVictimImmunityUntil.get(victimId) || 0;
    this.lassoVictimImmunityUntil.set(victimId, Math.max(current, now + durationMs));
  }

  private getRepeatDurationMultiplier(attackerId: string, victimId: string, now: number): number {
    const key = `${attackerId}|${victimId}`;
    const prev = this.lassoRepeatByPair.get(key);
    let count = 1;
    if (prev && now - prev.lastAt <= LASSO_TARGET_REPEAT_WINDOW_MS) {
      count = prev.count + 1;
    }
    this.lassoRepeatByPair.set(key, { count, lastAt: now });

    const rawMultiplier = 1 - (count - 1) * LASSO_TARGET_REPEAT_STEP;
    return Math.max(LASSO_TARGET_REPEAT_MIN_MULTIPLIER, rawMultiplier);
  }

  private updateLassos(dt: number): void {
    const now = Date.now();

    for (const link of Array.from(this.activeLassos.values())) {
      const attacker = this.players.get(link.attackerId);
      const victim = this.players.get(link.victimId);

      if (!attacker || !victim) {
        this.releaseLassoByAttacker(link.attackerId, 'disconnect');
        continue;
      }

      if (now >= link.expiresAt) {
        this.releaseLassoByAttacker(link.attackerId, 'expired');
        continue;
      }

      if (link.breakoutProgress > 0 && now > link.breakoutDecayPausedUntil) {
        link.breakoutProgress = Math.max(0, link.breakoutProgress - LASSO_BREAKOUT_DECAY_PER_SEC * dt);
      }

      const toAttacker = {
        x: attacker.position.x - victim.position.x,
        y: attacker.position.y - victim.position.y,
        z: attacker.position.z - victim.position.z,
      };
      const distSq = toAttacker.x * toAttacker.x + toAttacker.y * toAttacker.y + toAttacker.z * toAttacker.z;
      const dist = Math.sqrt(distSq);
      const relativeSeparationSpeed = Math.max(0, (dist - link.previousDistance) / Math.max(dt, 0.001));
      link.previousDistance = dist;

      if (dist > LASSO_BREAK_DISTANCE) {
        this.releaseLassoByAttacker(link.attackerId, 'broken');
        continue;
      }

      const tensionRatio = Math.max(
        0,
        Math.min(1, (dist - link.tetherLength) / Math.max(0.001, LASSO_BREAK_DISTANCE - link.tetherLength)),
      );
      const strainGain = tensionRatio * dt + Math.max(0, (relativeSeparationSpeed - 2.4) * 0.06 * dt);
      if (strainGain > 0) {
        link.strain = Math.min(LASSO_TENSION_BREAK_SEC + 0.8, link.strain + strainGain);
      } else {
        link.strain = Math.max(0, link.strain - 0.6 * dt);
      }

      if (link.strain >= LASSO_TENSION_BREAK_SEC || relativeSeparationSpeed >= LASSO_TENSION_VELOCITY_BREAK) {
        this.releaseLassoByAttacker(link.attackerId, 'broken');
        continue;
      }

      if (tensionRatio >= LASSO_TENSION_WARNING_THRESHOLD && now >= link.nextWarningAt) {
        link.nextWarningAt = now + 220;
        this.emitLassoFeedback(link.attackerId, {
          status: 'tension_warning',
          attackerId: link.attackerId,
          victimId: link.victimId,
          tension: tensionRatio,
          strain: link.strain,
        });
        this.emitLassoFeedback(link.victimId, {
          status: 'tension_warning',
          attackerId: link.attackerId,
          victimId: link.victimId,
          tension: tensionRatio,
          strain: link.strain,
        });
      }

      if (dist <= link.tetherLength || dist < 0.001) continue;

      const nx = toAttacker.x / dist;
      const ny = toAttacker.y / dist;
      const nz = toAttacker.z / dist;
      const tension = Math.max(0, dist - link.tetherLength);
      const pull = Math.min(LASSO_PULL_STRENGTH * dt, tension * 0.35);

      victim.position.x += nx * pull;
      victim.position.y += ny * pull * 0.5; // gentler vertical pull
      victim.position.z += nz * pull;
      victim.speed = Math.max(0, victim.speed * (1 - 0.8 * dt));

      // Keep inside server world bounds to avoid runaway pulls.
      victim.position.x = Math.max(-1000, Math.min(1000, victim.position.x));
      victim.position.z = Math.max(-1000, Math.min(1000, victim.position.z));
      victim.position.y = Math.max(2, Math.min(250, victim.position.y));
    }
  }

  private rotateHotspots(): void {
    for (const hotspot of this.hotspots) {
      hotspot.position = this.randomHotspotPosition();
    }
    console.log('Hotspots rotated');
  }

  // --- Snapshots ---

  /**
   * Full snapshot for welcome message.
   */
  getSnapshot(): WorldStateSnapshot {
    return {
      tick: this.currentTick,
      timestamp: Date.now(),
      players: this.getAllPlayers().map(p => p.toState()),
      npcs: Array.from(this.npcs.values()),
      hotspots: this.hotspots.map(h => ({ ...h })),
    };
  }

  /**
   * AOI-filtered snapshot for a specific player.
   * Only includes players within AOI_RADIUS — eliminates O(N²) bandwidth growth.
   */
  getFilteredSnapshot(forPlayer: Player): FilteredWorldState {
    const nearbyIds = this.spatialGrid.queryRadius(forPlayer.position, AOI_RADIUS);
    const nearbySet = new Set(nearbyIds);

    const players = [];
    for (const other of this.players.values()) {
      if (other.id === forPlayer.id) continue;
      if (!nearbySet.has(other.id)) continue; // outside AOI — skip
      players.push(other.toState());
    }

    // Gather pending events for this player
    const events = this.pendingEvents.get(forPlayer.id) || [];
    this.pendingEvents.set(forPlayer.id, []); // clear after reading

    return {
      tick: this.currentTick,
      timestamp: Date.now(),
      players,
      hotspots: this.hotspots.map(h => ({ ...h })),
      events,
    };
  }

  // --- NPC Management ---

  addNPC(npc: NPCState): void {
    this.npcs.set(npc.id, npc);
  }

  removeNPC(npcId: string): void {
    this.npcs.delete(npcId);
  }

  freezeNPC(npcId: string, duration: number): void {
    const npc = this.npcs.get(npcId);
    if (npc) {
      npc.frozen = true;
      setTimeout(() => {
        npc.frozen = false;
      }, duration * 1000);
    }
  }

  // --- Spawn ---

  getSpawnPosition(): Vector3 {
    const angle = Math.random() * Math.PI * 2;
    const distance = 80 + Math.random() * 20;
    return {
      x: Math.cos(angle) * distance,
      y: 20 + Math.random() * 10,
      z: Math.sin(angle) * distance,
    };
  }
}
