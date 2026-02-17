/**
 * Multiplayer Manager
 * Handles WebSocket connection to game server and state synchronization.
 * Now supports AOI-filtered state, PvP events, and racing.
 */

import * as THREE from 'three';
import { RemotePlayer } from './RemotePlayer';
import type { Bird } from '../entities/Bird';

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface PlayerState {
  id: string;
  username: string;
  position: Vector3;
  yaw: number;
  pitch: number;
  heat: number;
  wantedFlag: boolean;
  state: string;
  stunned?: boolean;
}

interface MidPlayerState {
  id: string;
  username: string;
  position: Vector3;
  yaw: number;
  wantedFlag: boolean;
}

interface GameEvent {
  type: string;
  data: any;
}

interface FilteredWorldState {
  tick: number;
  timestamp: number;
  nearPlayers: PlayerState[];
  midPlayers: MidPlayerState[];
  removedPlayerIds: string[];
  hotspots: any[];
  events: GameEvent[];
}

// Legacy format (from welcome message)
interface WorldStateSnapshot {
  tick: number;
  timestamp: number;
  players: PlayerState[];
  npcs: any[];
  hotspots: any[];
}

interface PvPHitResult {
  attackerId: string;
  attackerName: string;
  victimId: string;
  victimName: string;
  stolenCoins: number;
  victimStunDuration: number;
}

interface RaceCheckpoint {
  position: Vector3;
  radius: number;
}

interface ChatMessage {
  playerId: string;
  username: string;
  message: string;
  timestamp: number;
}

// Event callbacks
export interface MultiplayerEventCallbacks {
  onPvPHitReceived?: (data: PvPHitResult) => void;
  onPvPHitDealt?: (data: PvPHitResult) => void;
  onPvPHitNearby?: (data: PvPHitResult) => void;
  onRaceCreated?: (data: { raceId: string; type: string; checkpoints: RaceCheckpoint[] }) => void;
  onRaceCountdown?: (data: { raceId: string; startTime: number }) => void;
  onRaceStarted?: (data: { raceId: string; checkpoints: RaceCheckpoint[] }) => void;
  onRaceCheckpoint?: (data: { raceId: string; playerId: string; checkpoint: number; total: number }) => void;
  onRaceFinished?: (data: { raceId: string; results: any[] }) => void;
  onChatMessage?: (data: ChatMessage) => void;
  // PvP mode events
  onPvPModeStart?: (data: { mode: string; players: any[] }) => void;
  onPvPModeEnd?: (data: { mode: string; results: any }) => void;
  onPvPStateUpdate?: (data: any) => void;
  onPvPTagTransfer?: (data: { from: string; to: string }) => void;
  onPvPCheckpoint?: (data: { playerId: string; checkpoint: number }) => void;
  onPvPStatueHit?: (data: { playerId: string; points: number }) => void;
  // Heist mode events
  onHeistMatchStart?: (data: any) => void;
  onHeistTrophyGrabbed?: (data: any) => void;
  onHeistSlam?: (data: any) => void;
  onHeistScore?: (data: any) => void;
  onHeistTrophySettled?: (data: any) => void;
  onHeistTrophyReset?: (data: any) => void;
  onHeistOvertime?: (data: any) => void;
  onHeistMatchEnd?: (data: any) => void;
}

export class MultiplayerManager {
  private ws: WebSocket | null = null;
  private connected = false;
  private playerId: string | null = null;
  private remotePlayers: Map<string, RemotePlayer>;
  private hiddenPlayerPool: RemotePlayer[] = []; // pooled hidden players for reuse
  private scene: THREE.Scene;
  private localBird: Bird;
  private serverUrl: string;
  private camera: THREE.Camera | null = null;
  private eventCallbacks: MultiplayerEventCallbacks = {};

  // Track which players are currently visible (in near or mid range)
  private visiblePlayerIds = new Set<string>();

  // Interpolation
  private lastServerUpdate = 0;
  private interpolationDelay = 100;

  constructor(scene: THREE.Scene, localBird: Bird, serverUrl: string, camera?: THREE.Camera) {
    this.scene = scene;
    this.localBird = localBird;
    this.remotePlayers = new Map();
    this.serverUrl = serverUrl;
    this.camera = camera || null;
  }

  setCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }

  setEventCallbacks(callbacks: MultiplayerEventCallbacks): void {
    this.eventCallbacks = callbacks;
  }

  async connect(playerId: string, username: string): Promise<void> {
    const CONNECT_TIMEOUT = 5000;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.ws) {
          this.ws.onopen = null;
          this.ws.onmessage = null;
          this.ws.onerror = null;
          this.ws.onclose = null;
          this.ws.close();
          this.ws = null;
        }
        reject(new Error('Connection timed out after 5s'));
      }, CONNECT_TIMEOUT);

      try {
        this.playerId = playerId;
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          console.log('Connected to game server');
          this.connected = true;

          this.send({
            type: 'join',
            data: { playerId, username },
          });
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleServerMessage(message);

            if (message.type === 'welcome') {
              clearTimeout(timeoutId);
              resolve();
            }
          } catch (error) {
            console.error('Error parsing server message:', error);
          }
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeoutId);
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          clearTimeout(timeoutId);
          console.log('Disconnected from game server');
          this.connected = false;
          this.cleanup();
        };
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  private handleServerMessage(message: any): void {
    switch (message.type) {
      case 'welcome':
        console.log('Welcomed to server:', message.data.playerId);
        // Welcome uses legacy full snapshot for initial load
        if (message.data.worldState) {
          this.handleLegacyWorldState(message.data.worldState);
        }
        break;

      case 'state':
        this.handleFilteredWorldState(message.data);
        break;

      case 'player_joined':
        // Will appear in next state update
        break;

      case 'player_left':
        this.handlePlayerLeft(message.data.playerId);
        break;

      case 'poop':
        // Remote poop visual — handled by Game.ts existing poop system
        break;

      case 'chat':
        this.eventCallbacks.onChatMessage?.(message.data as ChatMessage);
        break;

      case 'pvp-mode-start':
        this.eventCallbacks.onPvPModeStart?.(message.data);
        break;

      case 'pvp-mode-end':
        this.eventCallbacks.onPvPModeEnd?.(message.data);
        break;

      case 'pvp-state-update':
        this.eventCallbacks.onPvPStateUpdate?.(message.data);
        break;

      case 'pvp-tag-transfer':
        this.eventCallbacks.onPvPTagTransfer?.(message.data);
        break;

      case 'pvp-checkpoint':
        this.eventCallbacks.onPvPCheckpoint?.(message.data);
        break;

      case 'pvp-hit':
        this.eventCallbacks.onPvPStatueHit?.(message.data);
        break;

      // Heist mode messages
      case 'heist-match-start':
        this.eventCallbacks.onHeistMatchStart?.(message.data);
        break;
      case 'heist-trophy-grabbed':
        this.eventCallbacks.onHeistTrophyGrabbed?.(message.data);
        break;
      case 'heist-slam':
        this.eventCallbacks.onHeistSlam?.(message.data);
        break;
      case 'heist-score':
        this.eventCallbacks.onHeistScore?.(message.data);
        break;
      case 'heist-trophy-settled':
        this.eventCallbacks.onHeistTrophySettled?.(message.data);
        break;
      case 'heist-trophy-reset':
        this.eventCallbacks.onHeistTrophyReset?.(message.data);
        break;
      case 'heist-overtime':
        this.eventCallbacks.onHeistOvertime?.(message.data);
        break;
      case 'heist-match-end':
        this.eventCallbacks.onHeistMatchEnd?.(message.data);
        break;

      case 'error':
        console.error('Server error:', message.data.message);
        break;

      default:
        // Unknown message types silently ignored
        break;
    }
  }

  /**
   * Handle legacy full world state (used in welcome message).
   */
  private handleLegacyWorldState(snapshot: WorldStateSnapshot): void {
    this.lastServerUpdate = Date.now();

    const currentPlayerIds = new Set<string>();
    for (const playerState of snapshot.players) {
      if (playerState.id === this.playerId) continue;

      currentPlayerIds.add(playerState.id);
      let remotePlayer = this.remotePlayers.get(playerState.id);
      if (!remotePlayer) {
        remotePlayer = this.getOrCreateRemotePlayer(playerState.id, playerState.username);
      }
      remotePlayer.updateFromServer(playerState);
      remotePlayer.setLOD('near');
    }

    // Remove unknown players
    for (const [playerId, remotePlayer] of this.remotePlayers.entries()) {
      if (!currentPlayerIds.has(playerId)) {
        this.recyclePlayer(playerId, remotePlayer);
      }
    }
  }

  /**
   * Handle new AOI-filtered world state.
   */
  private handleFilteredWorldState(state: FilteredWorldState): void {
    this.lastServerUpdate = Date.now();

    const activePlayerIds = new Set<string>();

    // Near players: full detail
    for (const playerState of state.nearPlayers) {
      if (playerState.id === this.playerId) continue;

      activePlayerIds.add(playerState.id);
      let remotePlayer = this.remotePlayers.get(playerState.id);
      if (!remotePlayer) {
        remotePlayer = this.getOrCreateRemotePlayer(playerState.id, playerState.username);
      }
      remotePlayer.updateFromServer(playerState);
      remotePlayer.setLOD('near');
      this.visiblePlayerIds.add(playerState.id);
    }

    // Mid players: reduced detail
    for (const playerState of state.midPlayers) {
      if (playerState.id === this.playerId) continue;

      activePlayerIds.add(playerState.id);
      let remotePlayer = this.remotePlayers.get(playerState.id);
      if (!remotePlayer) {
        remotePlayer = this.getOrCreateRemotePlayer(playerState.id, playerState.username);
      }
      remotePlayer.updatePositionOnly(playerState);
      remotePlayer.setLOD('mid');
      this.visiblePlayerIds.add(playerState.id);
    }

    // Hide players that left AOI range (but don't destroy — they may return)
    for (const removedId of state.removedPlayerIds) {
      const remotePlayer = this.remotePlayers.get(removedId);
      if (remotePlayer) {
        remotePlayer.setLOD('hidden');
        this.visiblePlayerIds.delete(removedId);
      }
    }

    // Also hide any tracked players not in this tick's near/mid lists
    for (const visibleId of this.visiblePlayerIds) {
      if (!activePlayerIds.has(visibleId)) {
        const rp = this.remotePlayers.get(visibleId);
        if (rp) {
          rp.setLOD('hidden');
        }
        this.visiblePlayerIds.delete(visibleId);
      }
    }

    // Process game events
    for (const event of state.events) {
      this.handleGameEvent(event);
    }
  }

  private handleGameEvent(event: GameEvent): void {
    switch (event.type) {
      case 'pvp_hit':
        this.handlePvPHit(event.data as PvPHitResult);
        break;
      case 'race_created':
        this.eventCallbacks.onRaceCreated?.(event.data);
        break;
      case 'race_countdown':
        this.eventCallbacks.onRaceCountdown?.(event.data);
        break;
      case 'race_started':
        this.eventCallbacks.onRaceStarted?.(event.data);
        break;
      case 'race_checkpoint':
        this.eventCallbacks.onRaceCheckpoint?.(event.data);
        break;
      case 'race_finished':
        this.eventCallbacks.onRaceFinished?.(event.data);
        break;
    }
  }

  private handlePvPHit(data: PvPHitResult): void {
    if (data.victimId === this.playerId) {
      // We got hit!
      this.eventCallbacks.onPvPHitReceived?.(data);
    } else if (data.attackerId === this.playerId) {
      // We hit someone!
      this.eventCallbacks.onPvPHitDealt?.(data);
    } else {
      // Nearby hit
      this.eventCallbacks.onPvPHitNearby?.(data);
    }
  }

  private handlePlayerLeft(playerId: string): void {
    const remotePlayer = this.remotePlayers.get(playerId);
    if (remotePlayer) {
      this.recyclePlayer(playerId, remotePlayer);
    }
  }

  // --- Player Pool ---

  private getOrCreateRemotePlayer(id: string, username: string): RemotePlayer {
    // Try to reuse from pool
    // (Pool reuse is limited since RemotePlayer has fixed id/username)
    const remotePlayer = new RemotePlayer(id, username, this.scene);
    this.remotePlayers.set(id, remotePlayer);
    return remotePlayer;
  }

  private recyclePlayer(playerId: string, remotePlayer: RemotePlayer): void {
    remotePlayer.destroy();
    this.remotePlayers.delete(playerId);
    this.visiblePlayerIds.delete(playerId);
  }

  // --- Outgoing Messages ---

  sendPlayerUpdate(): void {
    if (!this.connected || !this.ws) return;

    const pos = this.localBird.controller.position;
    this.send({
      type: 'update',
      data: {
        position: { x: pos.x, y: pos.y, z: pos.z },
        yaw: this.localBird.controller.yawAngle,
        pitch: this.localBird.controller.pitchAngle,
        speed: this.localBird.controller.forwardSpeed,
        timestamp: Date.now(),
      },
    });
  }

  sendPoopDrop(position: THREE.Vector3, velocity: THREE.Vector3): void {
    if (!this.connected || !this.ws) return;

    this.send({
      type: 'poop',
      data: {
        position: { x: position.x, y: position.y, z: position.z },
        velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
      },
    });
  }

  sendBanking(): void {
    if (!this.connected || !this.ws) return;

    this.send({
      type: 'bank',
      data: {},
    });
  }

  sendRaceCreate(type: 'short' | 'medium' | 'long'): void {
    if (!this.connected || !this.ws) return;

    this.send({
      type: 'race_create',
      data: { type },
    });
  }

  sendRaceJoin(raceId: string): void {
    if (!this.connected || !this.ws) return;

    this.send({
      type: 'race_join',
      data: { raceId },
    });
  }

  sendRaceReady(raceId: string): void {
    if (!this.connected || !this.ws) return;

    this.send({
      type: 'race_ready',
      data: { raceId },
    });
  }

  sendChat(message: string): void {
    if (!this.connected || !this.ws) return;

    this.send({
      type: 'chat',
      data: { message },
    });
  }

  // --- PvP Messages ---

  sendPvPJoin(modeId: string): void {
    if (!this.connected || !this.ws) return;
    this.send({ type: 'pvp-join', data: { modeId } });
  }

  sendPvPLeave(): void {
    if (!this.connected || !this.ws) return;
    this.send({ type: 'pvp-leave', data: {} });
  }

  sendPvPTagTransfer(from: string, to: string): void {
    if (!this.connected || !this.ws) return;
    this.send({ type: 'pvp-tag-transfer', data: { from, to } });
  }

  sendPvPCheckpoint(checkpoint: number): void {
    if (!this.connected || !this.ws) return;
    this.send({ type: 'pvp-checkpoint', data: { checkpoint } });
  }

  sendPvPStatueHit(points: number): void {
    if (!this.connected || !this.ws) return;
    this.send({ type: 'pvp-hit', data: { points } });
  }

  // --- Heist Messages ---

  sendHeistJoin(): void {
    if (!this.connected || !this.ws) return;
    this.send({ type: 'heist-join', data: {} });
  }

  sendHeistGrab(position: { x: number; y: number; z: number }): void {
    if (!this.connected || !this.ws) return;
    this.send({ type: 'heist-grab', data: { position } });
  }

  sendHeistSlam(position: { x: number; y: number; z: number }, speed: number): void {
    if (!this.connected || !this.ws) return;
    this.send({ type: 'heist-slam', data: { position, speed } });
  }

  sendHeistScore(position: { x: number; y: number; z: number }): void {
    if (!this.connected || !this.ws) return;
    this.send({ type: 'heist-score', data: { position } });
  }

  // --- Update Loop ---

  update(dt: number): void {
    if (!this.connected) return;

    // Update all visible remote players (interpolation)
    for (const remotePlayer of this.remotePlayers.values()) {
      remotePlayer.update(dt);
    }
  }

  // --- Helpers ---

  private send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private cleanup(): void {
    for (const remotePlayer of this.remotePlayers.values()) {
      remotePlayer.destroy();
    }
    this.remotePlayers.clear();
    this.visiblePlayerIds.clear();
    this.hiddenPlayerPool = [];
  }

  disconnect(): void {
    if (this.ws) {
      this.send({ type: 'leave', data: {} });
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.cleanup();
  }

  isConnected(): boolean {
    return this.connected;
  }

  getRemotePlayers(): RemotePlayer[] {
    return Array.from(this.remotePlayers.values());
  }

  getPlayerId(): string | null {
    return this.playerId;
  }
}
