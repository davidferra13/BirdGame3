/**
 * PvPManager - Central coordinator for all PvP modes.
 * Handles round lifecycle, player opt-in, bot spawning, and mode registry.
 */

import * as THREE from 'three';
import { PvPEventBus } from './PvPEventBus';
import { PvPMode, PvPPlayer, PvPResults, PvPModeContext } from './PvPMode';
import { PvPBot } from './PvPBot';
import { PvPHub } from './ui/PvPHub';
import { PvPHUD } from './ui/PvPHUD';
import { PvPJoinPrompt } from './ui/PvPJoinPrompt';
import { PvPResultsPanel } from './ui/PvPResultsPanel';
import { PVP } from '../utils/Constants';
import type { Bird } from '../entities/Bird';
import type { CollisionSystem } from '../systems/CollisionSystem';
import type { PoopManager } from '../entities/PoopManager';
import type { FlightRingSystem } from '../systems/FlightRingSystem';
import type { MultiplayerManager } from '../multiplayer/MultiplayerManager';

export type PvPPhase = 'idle' | 'lobby' | 'countdown' | 'active' | 'ending' | 'results';

export interface PvPRoundState {
  mode: string;
  phase: PvPPhase;
  players: PvPPlayer[];
  timeRemaining: number;
  modeData: any;
}

export interface PvPManagerDeps {
  scene: THREE.Scene;
  bird: Bird;
  collisionSystem: CollisionSystem;
  poopManager: PoopManager;
  flightRings: FlightRingSystem;
  multiplayer: MultiplayerManager | null;
}

interface PvPCombatState {
  burstCooldown: number;
  mineCooldown: number;
  slowedUntil: number;
  rootedUntil: number;
}

interface PvPMine {
  ownerId: string;
  position: THREE.Vector3;
  ttl: number;
  armedDelay: number;
}

// Player colors for PvP identification
const PLAYER_COLORS = [
  0xff4444, 0x4488ff, 0x44ff44, 0xffcc00,
  0xff44ff, 0x44ffff, 0xff8844, 0xaa44ff,
];

export class PvPManager {
  readonly eventBus = new PvPEventBus();
  private modes = new Map<string, PvPMode>();
  private activeMode: PvPMode | null = null;
  private phase: PvPPhase = 'idle';
  private players: PvPPlayer[] = [];
  private bots: PvPBot[] = [];
  private roundTimer = 0;
  private countdownTimer = 0;
  private resultsTimer = 0;
  private lastResults: PvPResults | null = null;
  private localPlayerId = 'local';
  private localPlayerName = 'You';
  private nextColorIndex = 0;
  private serverAuthoritative = false;
  private serverModeStarted = false;
  private combatTime = 0;
  private combatState = new Map<string, PvPCombatState>();
  private mines: PvPMine[] = [];

  // Dependencies
  private deps!: PvPManagerDeps;

  // UI components
  private hub: PvPHub;
  private hud: PvPHUD;
  private joinPrompt: PvPJoinPrompt;
  private resultsPanel: PvPResultsPanel;

  // Available events (modes that can be joined)
  private availableEvents: { modeId: string; modeName: string; icon: string; playerCount: number }[] = [];

  constructor() {
    this.hub = new PvPHub(this.eventBus, this);
    this.hud = new PvPHUD(this.eventBus);
    this.joinPrompt = new PvPJoinPrompt(this.eventBus, this);
    this.resultsPanel = new PvPResultsPanel(this.eventBus);
  }

  init(deps: PvPManagerDeps): void {
    this.deps = deps;
    this.buildAvailableEvents();
  }

  registerMode(mode: PvPMode): void {
    this.modes.set(mode.getModeId(), mode);
    this.buildAvailableEvents();
  }

  setLocalPlayer(id: string, name: string): void {
    this.localPlayerId = id;
    this.localPlayerName = name;
  }

  getLocalPlayerId(): string {
    return this.localPlayerId;
  }

  /** Ability 1: short-range shockwave that knocks back and slows opponents. */
  useLocalBurst(): boolean {
    if (this.phase !== 'active') return false;
    if (this.serverAuthoritative) return false;
    const caster = this.players.find(p => p.id === this.localPlayerId);
    if (!caster) return false;

    const state = this.getCombatState(this.localPlayerId);
    if (state.burstCooldown > 0) return false;
    state.burstCooldown = PVP.COMBAT_BURST_COOLDOWN_S;

    const range = PVP.COMBAT_BURST_RANGE;
    for (const target of this.players) {
      if (target.id === caster.id) continue;
      const delta = target.position.clone().sub(caster.position);
      const dist = delta.length();
      if (dist <= 0.001 || dist > range) continue;

      const pushScale = (1 - dist / range) * PVP.COMBAT_BURST_KNOCKBACK;
      delta.normalize().multiplyScalar(pushScale);
      target.position.add(delta);

      this.applySlow(target.id, PVP.COMBAT_BURST_SLOW_S);
    }
    return true;
  }

  /** Ability 2: deploy a proximity mine that roots then slows the first target. */
  useLocalMine(): boolean {
    if (this.phase !== 'active') return false;
    if (this.serverAuthoritative) return false;
    const owner = this.players.find(p => p.id === this.localPlayerId);
    if (!owner) return false;

    const state = this.getCombatState(this.localPlayerId);
    if (state.mineCooldown > 0) return false;
    state.mineCooldown = PVP.COMBAT_MINE_COOLDOWN_S;

    this.mines.push({
      ownerId: owner.id,
      position: owner.position.clone(),
      ttl: PVP.COMBAT_MINE_DURATION_S,
      armedDelay: 0.4,
    });
    return true;
  }

  getLocalMovementModifier(): { speedMultiplier: number; rooted: boolean } {
    const local = this.getCombatState(this.localPlayerId);
    const rooted = local.rootedUntil > this.combatTime;
    const slowed = local.slowedUntil > this.combatTime;
    return {
      rooted,
      speedMultiplier: rooted ? 0 : (slowed ? 0.68 : 1),
    };
  }

  /** Start a new round of the given mode. Fills with bots if solo. */
  startMode(modeId: string): void {
    const mode = this.modes.get(modeId);
    if (!mode || this.phase !== 'idle') return;

    this.activeMode = mode;
    this.nextColorIndex = 0;

    // Set context for the mode
    const context: PvPModeContext = {
      scene: this.deps.scene,
      eventBus: this.eventBus,
      localPlayerId: this.localPlayerId,
    };
    mode.setContext(context);

    // Add local player
    this.players = [];
    this.addPlayer(this.localPlayerId, this.localPlayerName, false, true);

    // Add currently visible remote multiplayer players first (friends > bots)
    const maxPlayers = mode.getMaxPlayers();
    for (const rp of this.getVisibleRemotePlayers()) {
      if (this.players.length >= maxPlayers) break;
      if (!this.players.find(p => p.id === rp.id)) {
        const added = this.addPlayer(rp.id, rp.username, false, false);
        added.position.copy(rp.getPosition());
      }
    }

    // Fill with bots to reach minimum
    const botsNeeded = Math.max(0, mode.getMinPlayers() - this.players.length);
    this.spawnBots(botsNeeded);

    // Enter lobby briefly, then countdown
    this.setPhase('lobby');

    // Auto-start countdown after brief lobby
    setTimeout(() => {
      if (this.phase === 'lobby') {
        this.setPhase('countdown');
        this.countdownTimer = PVP.COUNTDOWN_DURATION;
      }
    }, PVP.LOBBY_DURATION * 1000);
  }

  /** Player opts in to the current round (during lobby phase). */
  joinMode(modeId: string): void {
    // Multiplayer path: server-authoritative PvP sessions.
    if (this.deps.multiplayer?.isConnected()) {
      this.deps.multiplayer.sendPvPJoin(modeId);
      return;
    }

    // Results phase still shows events in the hub; normalize back to idle first
    // so clicking PLAY always starts the selected mode.
    if (this.phase === 'results') {
      this.cleanup();
    }

    if (this.phase === 'idle') {
      this.startMode(modeId);
    } else if (this.phase === 'lobby' && this.activeMode?.getModeId() === modeId) {
      // Already in lobby, just ensure local player is added
      if (!this.players.find(p => p.id === this.localPlayerId)) {
        this.addPlayer(this.localPlayerId, this.localPlayerName, false, true);
      }
    }
  }

  /** Player leaves the current round. */
  leaveMode(): void {
    if (this.deps.multiplayer?.isConnected()) {
      this.deps.multiplayer.sendPvPLeave();
      if (this.serverAuthoritative) {
        this.cleanup();
      }
      return;
    }

    if (!this.activeMode) return;

    const localPlayer = this.players.find(p => p.id === this.localPlayerId);
    if (localPlayer) {
      this.activeMode.onPlayerLeave(localPlayer);
      this.players = this.players.filter(p => p.id !== this.localPlayerId);
      this.combatState.delete(localPlayer.id);
    }

    // If no human players left, end the round
    if (!this.players.some(p => !p.isBot)) {
      this.endRound();
    }
  }

  getCurrentMode(): PvPMode | null {
    return this.activeMode;
  }

  getPhase(): PvPPhase {
    return this.phase;
  }

  getRoundState(): PvPRoundState {
    const localCombat = this.getCombatState(this.localPlayerId);
    const baseModeData = this.activeMode?.getModeData() || {};
    const modeData = {
      ...baseModeData,
      combat: {
        burstCooldown: Math.max(0, localCombat.burstCooldown),
        mineCooldown: Math.max(0, localCombat.mineCooldown),
        slowedRemaining: Math.max(0, localCombat.slowedUntil - this.combatTime),
        rootedRemaining: Math.max(0, localCombat.rootedUntil - this.combatTime),
        mineCount: this.mines.filter(m => m.ownerId === this.localPlayerId).length,
      },
    };

    return {
      mode: this.activeMode?.getModeId() || '',
      phase: this.phase,
      players: [...this.players],
      timeRemaining: this.phase === 'active' ? this.roundTimer :
                     this.phase === 'countdown' ? this.countdownTimer : 0,
      modeData,
    };
  }

  getAvailableEvents() {
    return this.availableEvents;
  }

  isInRound(): boolean {
    return this.phase !== 'idle' && this.phase !== 'results';
  }

  toggleHub(): void {
    this.hub.toggle();
  }

  update(dt: number): void {
    this.combatTime += dt;
    this.updateCombatTimers(dt);

    if (this.serverAuthoritative) {
      // In server-authoritative mode, server drives phase/timers.
      if (this.phase === 'active') {
        this.activeMode?.onUpdate(dt);
      } else if (this.phase === 'results') {
        // Fall back to local results timeout in case the server session is gone.
        this.updateResults(dt);
      }
    } else {
      switch (this.phase) {
        case 'countdown':
          this.updateCountdown(dt);
          break;
        case 'active':
          this.updateActive(dt);
          break;
        case 'ending':
          this.updateEnding(dt);
          break;
        case 'results':
          this.updateResults(dt);
          break;
      }
    }

    this.updateMines(dt);

    // Update bots
    for (const bot of this.bots) {
      const state = this.getCombatState(bot.player.id);
      if (state.rootedUntil > this.combatTime) continue;
      const botDt = state.slowedUntil > this.combatTime ? dt * 0.65 : dt;
      bot.update(botDt);
    }

    if (this.phase === 'active') {
      this.updateBotCombatAbilities();
    }

    // Update UI
    this.hub.update(dt);
    this.hud.update(dt, this.getRoundState());
    this.joinPrompt.update(dt);
    this.resultsPanel.update(dt);
  }

  /** Update local player position (called from Game.ts each frame). */
  updateLocalPlayerPosition(position: THREE.Vector3): void {
    const local = this.players.find(p => p.id === this.localPlayerId);
    if (local) {
      local.position.copy(position);
    }
  }

  /** Syncs remote multiplayer participants into the local PvP simulation. */
  syncMultiplayerPlayers(): void {
    const multiplayer = this.deps.multiplayer;
    if (!multiplayer) return;

    const remotes = this.getVisibleRemotePlayers();
    const remoteById = new Map(remotes.map(rp => [rp.id, rp] as const));

    // Update position of any remote participant already tracked by the current round.
    for (const player of this.players) {
      if (player.isLocal || player.isBot) continue;
      const rp = remoteById.get(player.id);
      if (rp) {
        player.position.copy(rp.getPosition());
      }
    }

    if (this.serverAuthoritative) {
      return;
    }

    // Allow joins/leaves only in lobby so active-mode state maps remain consistent.
    if (this.phase !== 'lobby' || !this.activeMode) return;

    const maxPlayers = this.activeMode.getMaxPlayers();

    // Add newly visible remote players to lobby slots (prefer humans over bots).
    for (const rp of remotes) {
      if (this.players.find(p => p.id === rp.id)) continue;
      if (this.players.length >= maxPlayers) {
        const botIndex = this.players.findIndex(p => p.isBot);
        if (botIndex >= 0) {
          const [bot] = this.players.splice(botIndex, 1);
          const botObj = this.bots.find(b => b.player.id === bot.id);
          if (botObj) {
            botObj.dispose();
            this.bots = this.bots.filter(b => b !== botObj);
          }
        }
      }
      if (this.players.length < maxPlayers) {
        const added = this.addPlayer(rp.id, rp.username, false, false);
        added.position.copy(rp.getPosition());
      }
    }

    // Remove disconnected/out-of-visibility remotes from the lobby roster.
    const toRemove = this.players.filter(
      p => !p.isLocal && !p.isBot && !remoteById.has(p.id),
    );
    for (const p of toRemove) {
      this.players = this.players.filter(existing => existing.id !== p.id);
      this.combatState.delete(p.id);
    }

    // Keep minimum player count by backfilling bots if needed.
    const botsNeeded = Math.max(0, this.activeMode.getMinPlayers() - this.players.length);
    if (botsNeeded > 0) this.spawnBots(botsNeeded);
  }

  /** Notify of poop hitting a PvP player (for Poop Tag). */
  onPoopHitPlayer(shooterId: string, targetId: string): void {
    if (this.phase !== 'active' || !this.activeMode) return;

    if (this.serverAuthoritative && this.deps.multiplayer?.isConnected()) {
      this.deps.multiplayer.sendPvPTagTransfer(shooterId, targetId);
      return;
    }

    // Cross-mode combat rider: direct poop hits briefly hinder target mobility.
    this.applySlow(targetId, 1.2);
    this.eventBus.emit('tag-transfer', { shooterId, targetId });
  }

  /** Notify of poop hitting the statue (for Poop Cover). */
  onPoopHitStatue(playerId: string, accuracy: number, hitPosition?: THREE.Vector3): void {
    if (this.phase !== 'active' || !this.activeMode) return;

    if (this.serverAuthoritative && this.deps.multiplayer?.isConnected()) {
      this.deps.multiplayer.sendPvPStatueHit(
        Math.max(1, Math.round(accuracy * 100)),
        accuracy,
        hitPosition ? { x: hitPosition.x, y: hitPosition.y, z: hitPosition.z } : undefined,
      );
      return;
    }

    this.eventBus.emit('statue-hit', { playerId, accuracy, hitPosition });
  }

  /** Notify of checkpoint reached (for Race). */
  onCheckpointReached(playerId: string, checkpointIndex: number): void {
    if (this.phase !== 'active' || !this.activeMode) return;

    if (this.serverAuthoritative && this.deps.multiplayer?.isConnected()) {
      this.deps.multiplayer.sendPvPCheckpoint(checkpointIndex);
      return;
    }

    this.eventBus.emit('checkpoint-reached', { playerId, checkpointIndex });
  }

  /** Server-authoritative mode start payload handler. */
  onServerModeStart(data: any): void {
    const modeId = typeof data?.mode === 'string' ? data.mode : '';
    const phase = (data?.phase as PvPPhase) || 'active';
    const players = Array.isArray(data?.players) ? data.players : [];
    if (!modeId) return;

    this.serverAuthoritative = true;
    this.startModeFromServer(modeId, players, phase, Number(data?.timeRemaining) || 0);
  }

  /** Server-authoritative state sync payload handler. */
  onServerStateUpdate(data: any): void {
    const modeId = typeof data?.mode === 'string' ? data.mode : '';
    const phase = data?.phase as PvPPhase | undefined;
    const players = Array.isArray(data?.players) ? data.players : [];
    const timeRemaining = Number(data?.timeRemaining) || 0;

    // No active server round.
    if (!modeId || phase === 'idle') {
      if (this.serverAuthoritative && this.phase !== 'idle') {
        this.cleanup();
      }
      return;
    }

    this.serverAuthoritative = true;
    this.startModeFromServer(modeId, players, phase || 'lobby', timeRemaining);
  }

  /** Server-authoritative mode end payload handler. */
  onServerModeEnd(_data: any): void {
    if (!this.serverAuthoritative) return;
    this.setPhase('results');
    this.resultsTimer = PVP.RESULTS_DISPLAY_DURATION;
  }

  /** Apply server-relayed Poop Tag transfer. */
  onServerTagTransfer(data: any): void {
    if (this.phase !== 'active' || !this.activeMode) return;
    const shooterId = typeof data?.from === 'string' ? data.from : '';
    const targetId = typeof data?.to === 'string' ? data.to : '';
    if (!shooterId || !targetId) return;
    this.eventBus.emit('tag-transfer', { shooterId, targetId });
  }

  /** Apply server-relayed Race checkpoint event. */
  onServerCheckpoint(data: any): void {
    if (this.phase !== 'active' || !this.activeMode) return;
    const playerId = typeof data?.playerId === 'string' ? data.playerId : '';
    const checkpointIndex = Number(data?.checkpoint);
    if (!playerId || !Number.isFinite(checkpointIndex)) return;
    this.eventBus.emit('checkpoint-reached', { playerId, checkpointIndex });
  }

  /** Apply server-relayed Poop Cover statue hit event. */
  onServerStatueHit(data: any): void {
    if (this.phase !== 'active' || !this.activeMode) return;
    const playerId = typeof data?.playerId === 'string' ? data.playerId : '';
    if (!playerId) return;
    const accuracy = Number(data?.accuracy);
    this.eventBus.emit('statue-hit', {
      playerId,
      accuracy: Number.isFinite(accuracy) ? accuracy : 0.5,
      hitPosition: data?.hitPosition,
    });
  }

  // --- Private Methods ---

  private getCombatState(playerId: string): PvPCombatState {
    let state = this.combatState.get(playerId);
    if (!state) {
      state = { burstCooldown: 0, mineCooldown: 0, slowedUntil: 0, rootedUntil: 0 };
      this.combatState.set(playerId, state);
    }
    return state;
  }

  private applySlow(playerId: string, duration: number): void {
    const state = this.getCombatState(playerId);
    state.slowedUntil = Math.max(state.slowedUntil, this.combatTime + duration);
  }

  private applyRoot(playerId: string, duration: number): void {
    const state = this.getCombatState(playerId);
    state.rootedUntil = Math.max(state.rootedUntil, this.combatTime + duration);
  }

  private updateCombatTimers(dt: number): void {
    for (const s of this.combatState.values()) {
      s.burstCooldown = Math.max(0, s.burstCooldown - dt);
      s.mineCooldown = Math.max(0, s.mineCooldown - dt);
    }
  }

  private updateMines(dt: number): void {
    if (this.phase !== 'active') {
      this.mines = [];
      return;
    }

    for (let i = this.mines.length - 1; i >= 0; i--) {
      const mine = this.mines[i];
      mine.ttl -= dt;
      mine.armedDelay = Math.max(0, mine.armedDelay - dt);
      if (mine.ttl <= 0) {
        this.mines.splice(i, 1);
        continue;
      }
      if (mine.armedDelay > 0) continue;

      let triggered = false;
      for (const p of this.players) {
        if (p.id === mine.ownerId) continue;
        if (p.position.distanceToSquared(mine.position) > PVP.COMBAT_MINE_RADIUS * PVP.COMBAT_MINE_RADIUS) continue;
        this.applyRoot(p.id, PVP.COMBAT_MINE_ROOT_S);
        this.applySlow(p.id, PVP.COMBAT_MINE_ROOT_S + PVP.COMBAT_MINE_SLOW_S);
        triggered = true;
        break;
      }
      if (triggered) {
        this.mines.splice(i, 1);
      }
    }
  }

  private updateBotCombatAbilities(): void {
    if (this.serverAuthoritative) return;

    for (const bot of this.bots) {
      const botPlayer = bot.player;
      const state = this.getCombatState(botPlayer.id);
      const local = this.players.find(p => p.id === this.localPlayerId);
      if (!local) continue;

      const dist = botPlayer.position.distanceTo(local.position);

      if (state.burstCooldown <= 0 && dist <= PVP.COMBAT_BURST_RANGE * 0.9 && Math.random() < 0.02) {
        state.burstCooldown = PVP.COMBAT_BURST_COOLDOWN_S;
        const delta = local.position.clone().sub(botPlayer.position);
        const d = Math.max(0.001, delta.length());
        const pushScale = (1 - Math.min(1, d / PVP.COMBAT_BURST_RANGE)) * PVP.COMBAT_BURST_KNOCKBACK;
        const push = delta.normalize().multiplyScalar(pushScale);
        local.position.add(push);
        this.deps.bird.controller.position.add(push);
        this.applySlow(local.id, PVP.COMBAT_BURST_SLOW_S);
      }

      if (state.mineCooldown <= 0 && dist <= 40 && Math.random() < 0.012) {
        state.mineCooldown = PVP.COMBAT_MINE_COOLDOWN_S;
        this.mines.push({
          ownerId: botPlayer.id,
          position: botPlayer.position.clone(),
          ttl: PVP.COMBAT_MINE_DURATION_S,
          armedDelay: 0.35,
        });
      }
    }
  }

  private startModeFromServer(
    modeId: string,
    participants: Array<{ id: string; username?: string; name?: string }>,
    phase: PvPPhase,
    timeRemaining: number,
  ): void {
    const mode = this.modes.get(modeId);
    if (!mode) return;

    const isSameMode = this.activeMode?.getModeId() === modeId;
    if (!isSameMode) {
      // Fresh server round or mode switch.
      this.cleanup();
      this.serverAuthoritative = true;
      this.activeMode = mode;
      this.nextColorIndex = 0;

      const context: PvPModeContext = {
        scene: this.deps.scene,
        eventBus: this.eventBus,
        localPlayerId: this.localPlayerId,
      };
      mode.setContext(context);
    }

    this.syncServerPlayers(participants);

    if (phase !== this.phase) {
      this.setPhase(phase);
    } else {
      this.phase = phase;
    }

    if (phase === 'countdown') {
      this.countdownTimer = timeRemaining;
      this.serverModeStarted = false;
    } else if (phase === 'active') {
      this.roundTimer = timeRemaining;
      // Ensure mode initialization happened exactly once for this session.
      if (!this.serverModeStarted) {
        this.activeMode?.onStart(this.players);
        this.serverModeStarted = true;
      }
    } else if (phase === 'results') {
      this.resultsTimer = timeRemaining || PVP.RESULTS_DISPLAY_DURATION;
      this.serverModeStarted = false;
    }
  }

  private syncServerPlayers(participants: Array<{ id: string; username?: string; name?: string }>): void {
    if (!this.activeMode) return;

    const byId = new Map(participants.map(p => [p.id, p] as const));
    const existingById = new Map(this.players.map(p => [p.id, p] as const));

    for (const [id, p] of byId) {
      const existing = existingById.get(id);
      const displayName = (p.username || p.name || id).trim();
      if (existing) {
        existing.name = displayName;
      } else {
        this.addPlayer(id, displayName, false, id === this.localPlayerId);
      }
    }

    // Remove players not in latest authoritative payload.
    const toRemove = this.players.filter(p => !byId.has(p.id));
    for (const p of toRemove) {
      this.activeMode.onPlayerLeave(p);
      this.players = this.players.filter(existing => existing.id !== p.id);
      this.combatState.delete(p.id);
    }
  }

  private setPhase(phase: PvPPhase): void {
    this.phase = phase;
    this.eventBus.emit('round-phase-change', {
      phase,
      modeId: this.activeMode?.getModeId(),
      modeName: this.activeMode?.getModeName(),
    });
  }

  private addPlayer(id: string, name: string, isBot: boolean, isLocal: boolean): PvPPlayer {
    const color = PLAYER_COLORS[this.nextColorIndex % PLAYER_COLORS.length];
    this.nextColorIndex++;

    const player: PvPPlayer = {
      id,
      name,
      isBot,
      score: 0,
      isLocal,
      color,
      position: new THREE.Vector3(),
    };
    this.players.push(player);
    this.combatState.set(id, {
      burstCooldown: 0,
      mineCooldown: 0,
      slowedUntil: 0,
      rootedUntil: 0,
    });
    this.eventBus.emit('player-joined', player);
    return player;
  }

  private spawnBots(count: number): void {
    const botNames = ['Birdy', 'Flappy', 'Squawk', 'Pecky', 'Wingnut', 'Ruffles', 'Feathers'];
    for (let i = 0; i < count; i++) {
      const name = botNames[i % botNames.length];
      const player = this.addPlayer(`bot_${i}`, name, true, false);

      const bot = new PvPBot(player, this.deps.scene);
      bot.setEventCallback((type, data) => {
        if (type === 'poop-hit-player') this.onPoopHitPlayer(data.shooterId, data.targetId);
        if (type === 'checkpoint') this.onCheckpointReached(data.playerId, data.checkpointIndex);
        if (type === 'statue-hit') this.onPoopHitStatue(data.playerId, data.accuracy, data.hitPosition);
      });
      // Set initial position near city center
      player.position.set(
        (Math.random() - 0.5) * 200,
        40 + Math.random() * 60,
        (Math.random() - 0.5) * 200,
      );
      this.bots.push(bot);
    }
  }

  private updateCountdown(dt: number): void {
    this.countdownTimer -= dt;
    this.eventBus.emit('countdown-tick', { timeRemaining: Math.ceil(this.countdownTimer) });

    if (this.countdownTimer <= 0) {
      this.beginRound();
    }
  }

  private beginRound(): void {
    if (!this.activeMode) return;

    this.setPhase('active');
    this.roundTimer = this.activeMode.getRoundDuration();
    this.activeMode.onStart(this.players);

    // Set bot mode
    for (const bot of this.bots) {
      bot.setMode(this.activeMode.getModeId(), this.activeMode.getModeData());
    }
  }

  private updateActive(dt: number): void {
    if (!this.activeMode) return;

    this.roundTimer -= dt;
    this.activeMode.onUpdate(dt);

    // Sync bots with fresh mode data and player positions each frame
    if (this.bots.length > 0) {
      const freshData = this.activeMode.getModeData();
      for (const bot of this.bots) {
        bot.updateModeData(freshData, this.players);
      }
    }

    if (this.roundTimer <= 0) {
      this.setPhase('ending');
    }

    // Check if the mode has its own completion condition (e.g., Heist first-to-3)
    if ('isComplete' in this.activeMode && (this.activeMode as any).isComplete()) {
      this.setPhase('ending');
    }
  }

  private updateEnding(_dt: number): void {
    this.endRound();
  }

  private endRound(): void {
    if (!this.activeMode) return;

    this.lastResults = this.activeMode.onEnd();
    this.setPhase('results');
    this.resultsTimer = PVP.RESULTS_DISPLAY_DURATION;
    this.resultsPanel.showResults(this.lastResults);
    this.eventBus.emit('round-results', this.lastResults);
  }

  private updateResults(dt: number): void {
    this.resultsTimer -= dt;
    if (this.resultsTimer <= 0) {
      this.cleanup();
    }
  }

  private cleanup(): void {
    // Clean up bots
    for (const bot of this.bots) {
      bot.dispose();
    }
    this.bots = [];

    // Clean up mode
    this.activeMode?.dispose();
    this.activeMode = null;
    this.players = [];
    this.lastResults = null;
    this.nextColorIndex = 0;
    this.serverAuthoritative = false;
    this.serverModeStarted = false;
    this.mines = [];
    this.combatState.clear();
    this.combatTime = 0;

    this.setPhase('idle');
    this.buildAvailableEvents();
  }

  private buildAvailableEvents(): void {
    this.availableEvents = [];
    for (const [id, mode] of this.modes) {
      this.availableEvents.push({
        modeId: id,
        modeName: mode.getModeName(),
        icon: mode.getModeIcon(),
        playerCount: 0,
      });
    }
    this.eventBus.emit('event-available', this.availableEvents);
  }

  private getVisibleRemotePlayers() {
    const multiplayer = this.deps.multiplayer;
    if (!multiplayer || !multiplayer.isConnected()) return [];

    return multiplayer
      .getRemotePlayers()
      .filter(rp => rp.getLOD() !== 'hidden' && rp.id !== this.localPlayerId);
  }

  dispose(): void {
    this.cleanup();
    this.eventBus.clear();
    this.hub.dispose();
    this.hud.dispose();
    this.joinPrompt.dispose();
    this.resultsPanel.dispose();
  }
}
