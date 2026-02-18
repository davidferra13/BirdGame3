/**
 * Server-authoritative world state
 * Now with spatial grid for AOI filtering and PvP poop tracking.
 */

import { Player } from './Player';
import { ServerSpatialGrid } from './SpatialGrid';
import { RaceManager } from './RaceManager';
import {
  WorldStateSnapshot, FilteredWorldState, Vector3, NPCState,
  HotspotState, ActivePoop, GameEvent, PvPHitResult,
} from './types';

/** AOI distance tiers (units) */
const AOI_NEAR = 200;
const AOI_MID = 500;

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

let nextPoopId = 0;

export class WorldState {
  private players: Map<string, Player>;
  private npcs: Map<string, NPCState>;
  private hotspots: HotspotState[];
  private currentTick: number;
  private spatialGrid: ServerSpatialGrid;
  private activePoops: ActivePoop[];
  private pendingEvents: Map<string, GameEvent[]>; // playerId -> events for that player
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
      this.players.delete(playerId);
      this.pendingEvents.delete(playerId);
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

    // Update active poops (PvP collision detection)
    this.updateActivePoops(dt);

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

      // Check collision with players
      const nearbyIds = this.spatialGrid.queryRadius(poop.position, POOP_HIT_RADIUS);
      for (const playerId of nearbyIds) {
        if (playerId === poop.ownerId) continue; // can't hit yourself

        const victim = this.players.get(playerId);
        if (!victim) continue;

        // Check protection
        if (victim.state === 'SPAWN_SHIELD') continue;
        if (victim.state === 'BANKING') continue;
        if (victim.isStunned()) continue;
        if (!victim.canBeHitByPvP()) continue;

        // Distance check (precise)
        const dx = victim.position.x - poop.position.x;
        const dy = victim.position.y - poop.position.y;
        const dz = victim.position.z - poop.position.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq > POOP_HIT_RADIUS * POOP_HIT_RADIUS) continue;

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
    this.emitEventToNearby(victim.position, AOI_MID, event);

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
   * Near players get full state every tick.
   * Mid players get reduced state every 2nd tick.
   * Far players are not included.
   */
  getFilteredSnapshot(forPlayer: Player): FilteredWorldState {
    const nearPlayers = [];
    const midPlayers = [];
    const removedPlayerIds: string[] = [];

    for (const other of this.players.values()) {
      if (other.id === forPlayer.id) continue;

      const dx = other.position.x - forPlayer.position.x;
      const dy = other.position.y - forPlayer.position.y;
      const dz = other.position.z - forPlayer.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist <= AOI_NEAR) {
        nearPlayers.push(other.toState());
      } else if (dist <= AOI_MID) {
        // Mid-range: send reduced state every 2nd tick
        if (this.currentTick % 2 === 0) {
          midPlayers.push(other.toMidState());
        }
      }
      // Far: not included at all
    }

    // Gather pending events for this player
    const events = this.pendingEvents.get(forPlayer.id) || [];
    this.pendingEvents.set(forPlayer.id, []); // clear after reading

    return {
      tick: this.currentTick,
      timestamp: Date.now(),
      nearPlayers,
      midPlayers,
      removedPlayerIds,
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
