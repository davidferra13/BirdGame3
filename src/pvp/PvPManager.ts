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
    if (!this.activeMode) return;

    const localPlayer = this.players.find(p => p.id === this.localPlayerId);
    if (localPlayer) {
      this.activeMode.onPlayerLeave(localPlayer);
      this.players = this.players.filter(p => p.id !== this.localPlayerId);
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
    return {
      mode: this.activeMode?.getModeId() || '',
      phase: this.phase,
      players: [...this.players],
      timeRemaining: this.phase === 'active' ? this.roundTimer :
                     this.phase === 'countdown' ? this.countdownTimer : 0,
      modeData: this.activeMode?.getModeData() || {},
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

    // Update bots
    for (const bot of this.bots) {
      bot.update(dt);
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

  /** Notify of poop hitting a PvP player (for Poop Tag). */
  onPoopHitPlayer(shooterId: string, targetId: string): void {
    if (this.phase === 'active' && this.activeMode) {
      this.eventBus.emit('tag-transfer', { shooterId, targetId });
    }
  }

  /** Notify of poop hitting the statue (for Poop Cover). */
  onPoopHitStatue(playerId: string, accuracy: number, hitPosition?: THREE.Vector3): void {
    if (this.phase === 'active' && this.activeMode) {
      this.eventBus.emit('statue-hit', { playerId, accuracy, hitPosition });
    }
  }

  /** Notify of checkpoint reached (for Race). */
  onCheckpointReached(playerId: string, checkpointIndex: number): void {
    if (this.phase === 'active' && this.activeMode) {
      this.eventBus.emit('checkpoint-reached', { playerId, checkpointIndex });
    }
  }

  // --- Private Methods ---

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

  dispose(): void {
    this.cleanup();
    this.eventBus.clear();
    this.hub.dispose();
    this.hud.dispose();
    this.joinPrompt.dispose();
    this.resultsPanel.dispose();
  }
}
