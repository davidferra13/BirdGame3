/**
 * Player State Machine
 *
 * States:     NORMAL, SANCTUARY, BANKING, GROUNDED, RESPAWNING, SPAWN_SHIELD, DRIVING, HEIST
 * Priority:   GROUNDED > BANKING > SANCTUARY > SPAWN_SHIELD > NORMAL
 */

export type PlayerState =
  | 'NORMAL'
  | 'SANCTUARY'
  | 'BANKING'
  | 'GROUNDED'
  | 'RESPAWNING'
  | 'SPAWN_SHIELD'
  | 'DRIVING'
  | 'HEIST';

export interface StateTimers {
  grounded: number;
  respawning: number;
  spawnShield: number;
}

const GROUNDED_DURATION = 3.0;
const RESPAWN_TRANSITION = 0; // instant transition from GROUNDED to RESPAWNING
const SPAWN_SHIELD_DURATION = 3.0;
const GROUNDING_IMMUNITY_WINDOW = 10.0; // can't be grounded twice in 10s

export class PlayerStateMachine {
  state: PlayerState = 'NORMAL';
  isWanted = false; // kept for API compat — always false

  private timers: StateTimers = { grounded: 0, respawning: 0, spawnShield: 0 };
  private groundingImmunityTimer = 0;

  /** Can the player score NPC hits? */
  get canScore(): boolean {
    return this.state === 'NORMAL' && !this.isShielded;
  }

  /** Can the player drop poop? Disabled during HEIST. */
  get canDrop(): boolean {
    if (this.state === 'HEIST') return false;
    return this.state === 'NORMAL' || this.state === 'SANCTUARY';
  }

  /** Can the player move (flight controls)? Allowed during HEIST. */
  get canMove(): boolean {
    return this.state !== 'GROUNDED' && this.state !== 'RESPAWNING' && this.state !== 'DRIVING';
  }

  /** Is the player driving a car? */
  get isDriving(): boolean {
    return this.state === 'DRIVING';
  }

  /** Is the player in spawn shield? */
  get isShielded(): boolean {
    return this.state === 'SPAWN_SHIELD';
  }

  /** Is the player in Heist mode? */
  get inHeist(): boolean {
    return this.state === 'HEIST';
  }

  /** Seconds remaining on grounded timer (for HUD countdown) */
  get groundedTimeRemaining(): number {
    return this.state === 'GROUNDED' ? Math.max(0, this.timers.grounded) : 0;
  }

  /** Can this player be grounded? (disabled — heat/wanted removed) */
  get canBeGrounded(): boolean {
    return false;
  }

  /** Is the player inside Sanctuary zone? */
  get inSanctuary(): boolean {
    return this.state === 'SANCTUARY' || this.state === 'BANKING';
  }

  /** Current state label for HUD */
  get stateLabel(): string {
    switch (this.state) {
      case 'GROUNDED': return 'GROUNDED';
      case 'RESPAWNING': return 'RESPAWNING';
      case 'SPAWN_SHIELD': return 'SHIELDED';
      case 'BANKING': return 'BANKING';
      case 'SANCTUARY': return 'SANCTUARY';
      case 'NORMAL': return '';
      case 'DRIVING': return 'DRIVING';
      case 'HEIST': return 'HEIST';
    }
  }

  update(dt: number): void {
    this.groundingImmunityTimer = Math.max(0, this.groundingImmunityTimer - dt);

    switch (this.state) {
      case 'GROUNDED':
        this.timers.grounded -= dt;
        if (this.timers.grounded <= 0) {
          this.transitionTo('RESPAWNING');
        }
        break;

      case 'RESPAWNING':
        // Immediate transition to SPAWN_SHIELD (respawn teleport happens externally)
        this.transitionTo('SPAWN_SHIELD');
        break;

      case 'SPAWN_SHIELD':
        this.timers.spawnShield -= dt;
        if (this.timers.spawnShield <= 0) {
          this.transitionTo('NORMAL');
        }
        break;
    }
  }

  // --- Transitions ---

  enterSanctuary(): void {
    if (this.state === 'NORMAL') {
      this.transitionTo('SANCTUARY');
    }
  }

  exitSanctuary(): void {
    if (this.state === 'SANCTUARY') {
      this.transitionTo('NORMAL');
    }
  }

  startBanking(): void {
    if (this.state === 'SANCTUARY') {
      this.transitionTo('BANKING');
    }
  }

  cancelBanking(): void {
    if (this.state === 'BANKING') {
      this.transitionTo('SANCTUARY');
    }
  }

  completeBanking(): void {
    if (this.state === 'BANKING') {
      this.transitionTo('NORMAL');
    }
  }

  triggerGrounding(): void {
    if (!this.canBeGrounded) return;

    this.groundingImmunityTimer = GROUNDING_IMMUNITY_WINDOW;
    this.timers.grounded = GROUNDED_DURATION;
    this.transitionTo('GROUNDED');
  }

  enterDriving(): void {
    if (this.state === 'NORMAL') {
      this.transitionTo('DRIVING');
    }
  }

  exitDriving(): void {
    if (this.state === 'DRIVING') {
      this.transitionTo('NORMAL');
    }
  }

  enterHeist(): void {
    // Heist overrides most states (except GROUNDED/RESPAWNING)
    if (this.state === 'NORMAL' || this.state === 'SANCTUARY' || this.state === 'SPAWN_SHIELD') {
      this.transitionTo('HEIST');
    }
  }

  exitHeist(): void {
    if (this.state === 'HEIST') {
      this.transitionTo('NORMAL');
    }
  }

  setWanted(_wanted: boolean): void {
    // No-op — heat/wanted system removed
  }

  private transitionTo(newState: PlayerState): void {
    const prevState = this.state;
    this.state = newState;

    if (newState === 'SPAWN_SHIELD') {
      this.timers.spawnShield = SPAWN_SHIELD_DURATION;
    }

    // Clear wanted on non-NORMAL states
    if (newState !== 'NORMAL') {
      // Wanted persists as a flag but is only "active" during NORMAL
      // The isWanted flag is managed by ScoreSystem via heat
    }

    void prevState; // consumed for debugging if needed
  }
}
