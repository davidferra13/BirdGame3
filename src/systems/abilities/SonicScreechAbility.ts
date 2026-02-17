import * as THREE from 'three';
import { Poop } from '../../entities/Poop';
import { clamp } from '../../utils/MathUtils';
import {
  IAbility, AbilityContext,
  SONIC_SCREECH_TIERS, SonicScreechTier,
} from './AbilityTypes';

/**
 * Sonic Screech — Instant ability.
 * Creates an expanding shockwave ring. NPCs caught in the ring are
 * "stunned" (tracked externally via the stunned set). While stunned,
 * NPCs are worth bonus coins when hit.
 */
export class SonicScreechAbility implements IAbility {
  readonly id = 'sonic_screech' as const;
  readonly group = new THREE.Group();

  private active = false;
  private tier: SonicScreechTier = SONIC_SCREECH_TIERS[0];

  // Shockwave ring VFX
  private ring: THREE.Mesh;
  private ringProgress = 0; // 0 → 1 as ring expands
  private ringDuration = 0.8; // seconds for ring to reach full radius

  // Stun tracking
  private _stunActive = false;
  private _stunRadius = 0;
  private _stunCoinMultiplier = 1;
  private _stunDuration = 0;
  private stunTimer = 0;
  private activationPos = new THREE.Vector3();

  constructor() {
    // Shockwave ring mesh
    const ringGeo = new THREE.RingGeometry(0.5, 1.5, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    this.group.add(this.ring);
  }

  initPool(_scene: THREE.Scene): void {
    // No poop pool needed for screech
  }

  activate(tier: number, ctx: AbilityContext): void {
    this.tier = SONIC_SCREECH_TIERS[clamp(tier, 0, 2)];
    this.active = true;
    this.ringProgress = 0;
    this._stunActive = true;
    this._stunRadius = this.tier.radius;
    this._stunCoinMultiplier = this.tier.coinMultiplier;
    this._stunDuration = this.tier.stunDuration;
    this.stunTimer = this.tier.stunDuration;
    this.activationPos.copy(ctx.playerPosition);
    this.ring.visible = true;
    this.ring.position.copy(ctx.playerPosition);
    this.ring.position.y = 1;
  }

  deactivate(): void {
    this.active = false;
    this._stunActive = false;
    this.ring.visible = false;
  }

  update(dt: number, _ctx: AbilityContext): void {
    if (!this.active) return;

    // Expand the ring
    if (this.ringProgress < 1) {
      this.ringProgress += dt / this.ringDuration;
      if (this.ringProgress > 1) this.ringProgress = 1;

      const currentRadius = this.tier.radius * this.ringProgress;
      const ringScale = currentRadius / 1.5; // base ring outer radius is 1.5
      this.ring.scale.setScalar(ringScale);

      const mat = this.ring.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.7 * (1 - this.ringProgress * 0.6);
    } else {
      this.ring.visible = false;
    }

    // Stun timer
    this.stunTimer -= dt;
    if (this.stunTimer <= 0) {
      this.deactivate();
    }
  }

  updatePoops(): void {}
  getActivePoops(): Poop[] { return []; }

  notifyPlayerPoop(): void {}
  notifyPlayerDive(): void {}
  notifyPlayerFlip(): void {}

  getCoinMultiplier(): number {
    return this._stunActive ? this._stunCoinMultiplier : 1;
  }
  getHeatMultiplier(): number { return 1; }

  get isActive(): boolean { return this.active; }

  get durationProgress(): number {
    if (!this.active) return 0;
    return this.stunTimer / this._stunDuration;
  }

  /** Position where screech was activated (for NPC stun range check) */
  get stunOrigin(): THREE.Vector3 { return this.activationPos; }
  get stunRadius(): number { return this._stunRadius; }
  get isStunActive(): boolean { return this._stunActive; }
}
