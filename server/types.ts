/**
 * Shared types between server and client for multiplayer
 */

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface PlayerState {
  id: string;
  username: string;
  position: Vector3;
  yaw: number;
  pitch: number;
  heat: number;
  wantedFlag: boolean;
  state: 'NORMAL' | 'WANTED' | 'GROUNDED' | 'BANKING' | 'SANCTUARY' | 'SPAWN_SHIELD' | 'STUNNED';
  stunned: boolean;
  lastUpdate: number;
}

export interface MidPlayerState {
  id: string;
  username: string;
  position: Vector3;
  yaw: number;
  wantedFlag: boolean;
}

export interface NPCState {
  id: string;
  type: 'walker' | 'runner' | 'crowd';
  position: Vector3;
  frozen: boolean;
}

export interface HotspotState {
  id: string;
  position: Vector3;
  radius: number;
  active: boolean;
}

// Legacy full snapshot (used for welcome message)
export interface WorldStateSnapshot {
  tick: number;
  timestamp: number;
  players: PlayerState[];
  npcs: NPCState[];
  hotspots: HotspotState[];
}

// AOI-filtered state sent per-client each tick
export interface FilteredWorldState {
  tick: number;
  timestamp: number;
  nearPlayers: PlayerState[];
  midPlayers: MidPlayerState[];
  removedPlayerIds: string[];
  hotspots: HotspotState[];
  events: GameEvent[];
}

// Game events (PvP, races, etc.)
export interface GameEvent {
  type: 'pvp_hit' | 'race_created' | 'race_countdown' | 'race_started' | 'race_checkpoint' | 'race_update' | 'race_finished';
  data: any;
}

// PvP hit result
export interface PvPHitResult {
  attackerId: string;
  attackerName: string;
  victimId: string;
  victimName: string;
  stolenCoins: number;
  victimStunDuration: number;
}

// Race types
export interface RaceCheckpoint {
  position: Vector3;
  radius: number;
}

export interface RaceParticipant {
  playerId: string;
  username: string;
  currentCheckpoint: number;
  finishTime: number | null;
}

export interface RaceState {
  id: string;
  creatorId: string;
  type: 'short' | 'medium' | 'long';
  participants: RaceParticipant[];
  checkpoints: RaceCheckpoint[];
  state: 'waiting' | 'countdown' | 'racing' | 'finished';
  createdAt: number;
  startTime: number;
  results: { playerId: string; username: string; time: number; place: number }[];
}

// Chat message
export interface ChatMessage {
  playerId: string;
  username: string;
  message: string;
  timestamp: number;
}

export interface ClientMessage {
  type: 'join' | 'update' | 'poop' | 'bank' | 'bank_complete' | 'bank_cancel' | 'leave'
    | 'race_create' | 'race_join' | 'race_ready' | 'chat'
    | 'pvp-join' | 'pvp-leave' | 'pvp-tag-transfer' | 'pvp-checkpoint' | 'pvp-hit'
    | 'mvm_queue_join' | 'mvm_queue_leave' | 'murmuration_chat'
    | 'heist-join' | 'heist-grab' | 'heist-slam' | 'heist-score';
  data?: any;
}

export interface ServerMessage {
  type: 'welcome' | 'state' | 'player_joined' | 'player_left' | 'poop' | 'player_banked' | 'error' | 'chat'
    | 'pvp-mode-start' | 'pvp-mode-end' | 'pvp-state-update' | 'pvp-tag-transfer' | 'pvp-checkpoint' | 'pvp-hit'
    | 'mvm_match_found' | 'mvm_round_update' | 'mvm_match_end' | 'murmuration_chat' | 'murmuration_notification'
    | 'heist-match-start' | 'heist-round-start' | 'heist-trophy-grabbed' | 'heist-slam'
    | 'heist-score' | 'heist-trophy-settled' | 'heist-trophy-reset' | 'heist-overtime' | 'heist-match-end';
  data?: any;
}

export interface PlayerInput {
  position: Vector3;
  yaw: number;
  pitch: number;
  speed: number;
  timestamp: number;
}

// Active poop tracked on server for PvP collision
export interface ActivePoop {
  id: string;
  ownerId: string;
  position: Vector3;
  velocity: Vector3;
  spawnAltitude: number;
  spawnTime: number;
}
