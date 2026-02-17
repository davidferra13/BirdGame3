import * as THREE from 'three';
import { Poop } from '../../entities/Poop';
import { clamp } from '../../utils/MathUtils';
import {
  IAbility, AbilityContext,
  DIVE_BOMB_METEOR_TIERS, DiveBombMeteorTier,
} from './AbilityTypes';

/**
 * Dive Bomb Meteor — Instant ability.
 * Creates a massive AoE shockwave at the player's position.
 * The shockwave expands outward and "hits" all NPCs in range.
 * Game.ts handles the actual NPC damage; this provides the VFX and state.
 */
export class DiveBombMeteorAbility implements IAbility {
  readonly id = 'dive_bomb_meteor' as const;
  readonly group = new THREE.Group();

  private active = false;
  private tier: DiveBombMeteorTier = DIVE_BOMB_METEOR_TIERS[0];

  // Impact state
  private _impactTriggered = false;
  private impactPos = new THREE.Vector3();
  private impactTimer = 0;
  private impactDuration = 1.5;

  // VFX: expanding shockwave ring
  private shockRing: THREE.Mesh;

  // VFX: ground crack circle (tier 2+)
  private crackDecal: THREE.Mesh;
  private crackLife = 0;

  // VFX: debris particles
  private debris: THREE.Mesh[] = [];
  private debrisVelocities: THREE.Vector3[] = [];
  private debrisLifes: number[] = [];

  constructor() {
    // Shockwave ring
    const ringGeo = new THREE.RingGeometry(0.5, 2, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    this.shockRing = new THREE.Mesh(ringGeo, ringMat);
    this.shockRing.rotation.x = -Math.PI / 2;
    this.shockRing.visible = false;
    this.group.add(this.shockRing);

    // Ground crack decal
    const crackGeo = new THREE.CircleGeometry(1, 24);
    const crackMat = new THREE.MeshBasicMaterial({
      color: 0x332200,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    this.crackDecal = new THREE.Mesh(crackGeo, crackMat);
    this.crackDecal.rotation.x = -Math.PI / 2;
    this.crackDecal.visible = false;
    this.group.add(this.crackDecal);

    // Debris particles
    const debrisGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    for (let i = 0; i < 24; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x886644 : 0x555555,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(debrisGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.debris.push(mesh);
      this.debrisVelocities.push(new THREE.Vector3());
      this.debrisLifes.push(0);
    }
  }

  initPool(_scene: THREE.Scene): void {
    // No poop pool for meteor
  }

  activate(tier: number, ctx: AbilityContext): void {
    this.tier = DIVE_BOMB_METEOR_TIERS[clamp(tier, 0, 2)];
    this.active = true;
    this._impactTriggered = true;
    this.impactPos.copy(ctx.playerPosition);
    this.impactPos.y = 0.5; // Ground level impact
    this.impactTimer = 0;

    // Show shockwave
    this.shockRing.visible = true;
    this.shockRing.position.copy(this.impactPos);
    this.shockRing.position.y = 0.3;
    this.shockRing.scale.setScalar(0.1);

    // Ground crack (tier 2+)
    if (this.tier.groundCrack) {
      this.crackDecal.visible = true;
      this.crackDecal.position.copy(this.impactPos);
      this.crackDecal.position.y = 0.05;
      this.crackDecal.scale.setScalar(this.tier.blastRadius * 0.5);
      this.crackLife = 5; // crack persists for 5 seconds
    }

    // Spawn debris
    this.spawnDebris();
  }

  deactivate(): void {
    this.active = false;
    this._impactTriggered = false;
    this.shockRing.visible = false;
    for (const d of this.debris) d.visible = false;
  }

  update(dt: number, _ctx: AbilityContext): void {
    if (!this.active && this.crackLife <= 0) return;

    // Expand shockwave ring
    if (this.active) {
      this.impactTimer += dt;
      const progress = clamp(this.impactTimer / this.impactDuration, 0, 1);

      if (progress < 1) {
        const currentRadius = this.tier.blastRadius * progress;
        const ringScale = currentRadius / 2; // base outer radius is 2
        this.shockRing.scale.setScalar(ringScale);
        const mat = this.shockRing.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.8 * (1 - progress);
      } else {
        this.shockRing.visible = false;
      }

      // Update debris
      for (let i = 0; i < this.debris.length; i++) {
        if (this.debrisLifes[i] <= 0) continue;
        this.debrisLifes[i] -= dt;
        const d = this.debris[i];
        d.position.addScaledVector(this.debrisVelocities[i], dt);
        this.debrisVelocities[i].y -= 20 * dt;
        d.rotation.x += dt * 8;
        d.rotation.z += dt * 5;
        const t = Math.max(0, this.debrisLifes[i] / 1.0);
        (d.material as THREE.MeshBasicMaterial).opacity = t;
        if (this.debrisLifes[i] <= 0) d.visible = false;
      }

      if (this.impactTimer >= this.impactDuration) {
        this.active = false;
        this._impactTriggered = false;
      }
    }

    // Fade crack decal
    if (this.crackLife > 0) {
      this.crackLife -= dt;
      if (this.crackLife < 1) {
        (this.crackDecal.material as THREE.MeshBasicMaterial).opacity = this.crackLife * 0.6;
      }
      if (this.crackLife <= 0) {
        this.crackDecal.visible = false;
      }
    }
  }

  updatePoops(): void {}
  getActivePoops(): Poop[] { return []; }

  notifyPlayerPoop(): void {}
  notifyPlayerDive(): void {}
  notifyPlayerFlip(): void {}

  getCoinMultiplier(): number {
    return this.active ? this.tier.coinMultiplier : 1;
  }
  getHeatMultiplier(): number { return 1; }

  get isActive(): boolean { return this.active; }

  get durationProgress(): number {
    if (!this.active) return 0;
    return 1 - this.impactTimer / this.impactDuration;
  }

  /** True on the frame the impact happens (for Game.ts to apply AoE damage) */
  get impactTriggered(): boolean { return this._impactTriggered; }

  get impactPosition(): THREE.Vector3 { return this.impactPos; }
  get blastRadius(): number { return this.tier.blastRadius; }

  consumeImpact(): void { this._impactTriggered = false; }

  // ── Private ───────────────────────────────────────────

  private spawnDebris(): void {
    for (let i = 0; i < this.debris.length; i++) {
      const d = this.debris[i];
      const angle = (i / this.debris.length) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const speed = 8 + Math.random() * 12;
      d.position.copy(this.impactPos);
      d.position.y += 0.5;
      d.visible = true;
      this.debrisVelocities[i].set(
        Math.cos(angle) * speed,
        5 + Math.random() * 10,
        Math.sin(angle) * speed,
      );
      this.debrisLifes[i] = 0.6 + Math.random() * 0.4;
      (d.material as THREE.MeshBasicMaterial).opacity = 1;
    }
  }
}
