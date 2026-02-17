/**
 * PvPMode - Abstract base class for all PvP game modes.
 * Each mode (Poop Tag, Race, Poop Cover) extends this.
 */

import * as THREE from 'three';
import type { PvPEventBus } from './PvPEventBus';

export interface PvPPlayer {
  id: string;
  name: string;
  isBot: boolean;
  score: number;
  isLocal: boolean;
  color: number;
  position: THREE.Vector3;
}

export interface PvPResults {
  modeId: string;
  modeName: string;
  standings: PvPStanding[];
  duration: number;
}

export interface PvPStanding {
  player: PvPPlayer;
  rank: number;
  score: number;
  reward: number;
  label: string;
}

export interface PvPModeContext {
  scene: THREE.Scene;
  eventBus: PvPEventBus;
  localPlayerId: string;
}

export abstract class PvPMode {
  protected players: PvPPlayer[] = [];
  protected context!: PvPModeContext;
  protected elapsed = 0;

  abstract getModeId(): string;
  abstract getModeName(): string;
  abstract getModeDescription(): string;
  abstract getModeIcon(): string;
  abstract getRoundDuration(): number;
  abstract getMinPlayers(): number;
  abstract getMaxPlayers(): number;

  setContext(context: PvPModeContext): void {
    this.context = context;
  }

  onStart(players: PvPPlayer[]): void {
    this.players = [...players];
    this.elapsed = 0;
  }

  abstract onUpdate(dt: number): void;

  abstract onEnd(): PvPResults;

  onPlayerJoin(player: PvPPlayer): void {
    if (!this.players.find(p => p.id === player.id)) {
      this.players.push(player);
    }
  }

  onPlayerLeave(player: PvPPlayer): void {
    this.players = this.players.filter(p => p.id !== player.id);
  }

  getPlayers(): PvPPlayer[] {
    return this.players;
  }

  getElapsed(): number {
    return this.elapsed;
  }

  abstract getModeData(): any;

  dispose(): void {
    // Override in subclasses to clean up Three.js objects
  }
}
