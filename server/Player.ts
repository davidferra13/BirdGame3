/**
 * Server-side player representation
 */

import { PlayerState, MidPlayerState, Vector3, PlayerInput } from './types';

/** Poop cooldown in milliseconds (matches client POOP.COOLDOWN * 1000) */
const POOP_COOLDOWN_MS = 400;

/** Banking channel time in milliseconds (matches client SCORE.BANK_CHANNEL_TIME * 1000) */
const BANK_CHANNEL_MS = 2500;

/** Grounding coin loss fraction (matches client SCORE.GROUNDING_LOSS_FRACTION) */
const GROUNDING_LOSS_FRACTION = 0.4;

/** PvP hit immunity cooldown (seconds) */
const PVP_HIT_IMMUNITY_MS = 3000;

export class Player {
  id: string;
  username: string;
  position: Vector3;
  yaw: number;
  pitch: number;
  speed: number;
  heat: number;
  wantedFlag: boolean;
  state: 'NORMAL' | 'WANTED' | 'GROUNDED' | 'BANKING' | 'SANCTUARY' | 'SPAWN_SHIELD' | 'STUNNED';
  lastUpdate: number;

  // Economy
  coins: number;

  // Poop cooldown
  lastPoopTime: number;

  // Banking timing
  bankingStartTime: number;

  // Spawn shield
  spawnShieldUntil: number;

  // PvP stun
  stunnedUntil: number;
  lastPvPHitTime: number;
  private preStunState: 'NORMAL' | 'WANTED' | 'GROUNDED' | 'BANKING' | 'SANCTUARY' | 'SPAWN_SHIELD' | 'STUNNED';

  constructor(id: string, username: string, spawnPosition: Vector3) {
    this.id = id;
    this.username = username;
    this.position = { ...spawnPosition };
    this.yaw = 0;
    this.pitch = 0;
    this.speed = 30;
    this.heat = 0;
    this.wantedFlag = false;
    this.state = 'SPAWN_SHIELD';
    this.lastUpdate = Date.now();
    this.spawnShieldUntil = Date.now() + 3000; // 3 second spawn shield
    this.coins = 0;
    this.lastPoopTime = 0;
    this.bankingStartTime = 0;
    this.stunnedUntil = 0;
    this.lastPvPHitTime = 0;
    this.preStunState = 'NORMAL';
  }

  updateFromInput(input: PlayerInput): void {
    // Can't move while stunned
    if (this.isStunned()) return;

    // Basic validation
    if (!this.isValidPosition(input.position)) {
      console.warn(`Invalid position for player ${this.id}`);
      return;
    }

    this.position = { ...input.position };
    this.yaw = input.yaw;
    this.pitch = input.pitch;
    this.speed = Math.max(0, Math.min(80, input.speed)); // Clamp speed
    this.lastUpdate = Date.now();
  }

  // --- Poop Validation ---

  canPoop(): boolean {
    if (this.state === 'GROUNDED' || this.state === 'BANKING') return false;
    if (this.state === 'SPAWN_SHIELD') return false;
    if (this.isStunned()) return false;
    const now = Date.now();
    return (now - this.lastPoopTime) >= POOP_COOLDOWN_MS;
  }

  recordPoop(): void {
    this.lastPoopTime = Date.now();
  }

  // --- Banking Validation ---

  startBanking(): boolean {
    if (this.coins <= 0) return false;
    if (this.state !== 'NORMAL' && this.state !== 'SANCTUARY') return false;
    this.state = 'BANKING';
    this.bankingStartTime = Date.now();
    return true;
  }

  completeBanking(): { coins: number; xp: number } | null {
    if (this.state !== 'BANKING') return null;

    const elapsed = Date.now() - this.bankingStartTime;
    if (elapsed < BANK_CHANNEL_MS) return null; // Channel time not met

    const bankedCoins = this.coins;
    const xp = Math.floor(bankedCoins / 5);
    this.coins = 0;
    this.heat = 0;
    this.wantedFlag = false;
    this.state = 'NORMAL';
    this.bankingStartTime = 0;
    return { coins: bankedCoins, xp };
  }

  cancelBanking(): void {
    if (this.state === 'BANKING') {
      this.state = 'NORMAL';
      this.bankingStartTime = 0;
    }
  }

  // --- Economy ---

  addCoins(amount: number): void {
    this.coins += amount;
  }

  onGrounded(): number {
    const lost = Math.floor(this.coins * GROUNDING_LOSS_FRACTION);
    this.coins -= lost;
    this.heat = 0;
    this.wantedFlag = false;
    this.state = 'GROUNDED';
    return lost;
  }

  // --- PvP ---

  isStunned(): boolean {
    return Date.now() < this.stunnedUntil;
  }

  canBeHitByPvP(): boolean {
    return Date.now() - this.lastPvPHitTime >= PVP_HIT_IMMUNITY_MS;
  }

  applyStun(durationSeconds: number): void {
    this.preStunState = this.state;
    this.stunnedUntil = Date.now() + durationSeconds * 1000;
    this.state = 'STUNNED';
  }

  updateStun(): void {
    if (this.state === 'STUNNED' && !this.isStunned()) {
      // Stun expired — restore previous state
      if (this.wantedFlag) {
        this.state = 'WANTED';
      } else {
        this.state = 'NORMAL';
      }
    }
  }

  onPvPHit(stolenCoins: number, stunDuration: number): void {
    this.coins = Math.max(0, this.coins - stolenCoins);
    this.lastPvPHitTime = Date.now();
    this.applyStun(stunDuration);
  }

  // --- Heat ---

  updateHeat(delta: number): void {
    this.heat = Math.max(0, Math.min(50, this.heat + delta));
    this.wantedFlag = this.heat >= 15;

    if (this.state === 'STUNNED') return; // don't change state while stunned

    if (this.wantedFlag) {
      this.state = 'WANTED';
    } else if (this.state === 'WANTED') {
      this.state = 'NORMAL';
    }
  }

  decayHeat(dt: number): void {
    const decay = 0.2 * dt;
    this.updateHeat(-decay);
  }

  updateSpawnShield(): void {
    if (this.state === 'SPAWN_SHIELD' && Date.now() > this.spawnShieldUntil) {
      this.state = 'NORMAL';
    }
  }

  private isValidPosition(pos: Vector3): boolean {
    const maxBound = 115;
    if (Math.abs(pos.x) > maxBound || Math.abs(pos.z) > maxBound) {
      return false;
    }
    if (pos.y < 0.5 || pos.y > 200) {
      return false;
    }
    return true;
  }

  toState(): PlayerState {
    return {
      id: this.id,
      username: this.username,
      position: { ...this.position },
      yaw: this.yaw,
      pitch: this.pitch,
      heat: this.heat,
      wantedFlag: this.wantedFlag,
      state: this.state,
      stunned: this.isStunned(),
      lastUpdate: this.lastUpdate,
    };
  }

  toMidState(): MidPlayerState {
    return {
      id: this.id,
      username: this.username,
      position: { ...this.position },
      yaw: this.yaw,
      wantedFlag: this.wantedFlag,
    };
  }
}
