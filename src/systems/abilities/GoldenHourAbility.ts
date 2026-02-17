import * as THREE from 'three';
import { Poop } from '../../entities/Poop';
import { clamp } from '../../utils/MathUtils';
import {
  IAbility, AbilityContext,
  GOLDEN_HOUR_TIERS, GoldenHourTier,
} from './AbilityTypes';

/**
 * Golden Hour — Duration ability.
 * Pure economy boost: coin multiplier on all hits, reduced heat gain.
 * Bird glows gold with particle sparkles.
 */
export class GoldenHourAbility implements IAbility {
  readonly id = 'golden_hour' as const;
  readonly group = new THREE.Group();

  private active = false;
  private tier: GoldenHourTier = GOLDEN_HOUR_TIERS[0];
  private durationTimer = 0;
  private totalDuration = 0;
  private elapsed = 0;

  // VFX: golden aura ring
  private auraRing: THREE.Mesh;

  // VFX: sparkle particles
  private sparkles: THREE.Mesh[] = [];
  private sparkleVelocities: THREE.Vector3[] = [];
  private sparkleLifes: number[] = [];
  private sparkleTimer = 0;

  constructor() {
    // Aura ring
    const ringGeo = new THREE.TorusGeometry(3, 0.1, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.5,
    });
    this.auraRing = new THREE.Mesh(ringGeo, ringMat);
    this.auraRing.rotation.x = Math.PI / 2;
    this.auraRing.visible = false;
    this.group.add(this.auraRing);

    // Pre-allocate sparkle particles
    const sparkleGeo = new THREE.SphereGeometry(0.08, 4, 3);
    const sparkleMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.8,
    });
    for (let i = 0; i < 20; i++) {
      const mesh = new THREE.Mesh(sparkleGeo, sparkleMat.clone());
      mesh.visible = false;
      this.group.add(mesh);
      this.sparkles.push(mesh);
      this.sparkleVelocities.push(new THREE.Vector3());
      this.sparkleLifes.push(0);
    }
  }

  initPool(_scene: THREE.Scene): void {
    // No poop pool — golden hour doesn't spawn poops
  }

  activate(tier: number, _ctx: AbilityContext): void {
    this.tier = GOLDEN_HOUR_TIERS[clamp(tier, 0, 2)];
    this.active = true;
    this.totalDuration = this.tier.duration;
    this.durationTimer = this.tier.duration;
    this.sparkleTimer = 0;
    this.auraRing.visible = true;
  }

  deactivate(): void {
    this.active = false;
    this.auraRing.visible = false;
    for (const s of this.sparkles) s.visible = false;
  }

  update(dt: number, ctx: AbilityContext): void {
    if (!this.active) return;
    this.elapsed += dt;

    this.durationTimer -= dt;
    if (this.durationTimer <= 0) {
      this.deactivate();
      return;
    }

    // Position aura
    this.auraRing.position.copy(ctx.playerPosition);
    const pulse = 1 + Math.sin(this.elapsed * 4) * 0.1;
    this.auraRing.scale.setScalar(pulse);
    const mat = this.auraRing.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.3 + Math.sin(this.elapsed * 3) * 0.15;

    // Spawn sparkles
    this.sparkleTimer += dt;
    if (this.sparkleTimer > 0.08) {
      this.sparkleTimer = 0;
      this.spawnSparkle(ctx.playerPosition);
    }

    // Update sparkles
    for (let i = 0; i < this.sparkles.length; i++) {
      if (this.sparkleLifes[i] <= 0) continue;
      this.sparkleLifes[i] -= dt;
      const s = this.sparkles[i];
      s.position.addScaledVector(this.sparkleVelocities[i], dt);
      this.sparkleVelocities[i].y -= 3 * dt;
      const t = Math.max(0, this.sparkleLifes[i] / 0.8);
      (s.material as THREE.MeshBasicMaterial).opacity = t * 0.8;
      if (this.sparkleLifes[i] <= 0) s.visible = false;
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

  getHeatMultiplier(): number {
    return this.active ? this.tier.heatMultiplier : 1;
  }

  get isActive(): boolean { return this.active; }

  get durationProgress(): number {
    if (!this.active) return 0;
    return this.durationTimer / this.totalDuration;
  }

  // ── Private ───────────────────────────────────────────

  private spawnSparkle(center: THREE.Vector3): void {
    const idx = this.sparkles.findIndex((_, i) => this.sparkleLifes[i] <= 0);
    if (idx < 0) return;

    const s = this.sparkles[idx];
    const angle = Math.random() * Math.PI * 2;
    const dist = 1.5 + Math.random() * 2;
    s.position.set(
      center.x + Math.cos(angle) * dist,
      center.y + (Math.random() - 0.3) * 2,
      center.z + Math.sin(angle) * dist,
    );
    s.visible = true;
    this.sparkleVelocities[idx].set(
      (Math.random() - 0.5) * 2,
      1 + Math.random() * 2,
      (Math.random() - 0.5) * 2,
    );
    this.sparkleLifes[idx] = 0.5 + Math.random() * 0.3;
  }
}
