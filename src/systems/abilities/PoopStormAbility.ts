import * as THREE from 'three';
import { Poop } from '../../entities/Poop';
import { clamp } from '../../utils/MathUtils';
import {
  IAbility, AbilityContext,
  POOP_STORM_TIERS, PoopStormTier,
} from './AbilityTypes';

const POOP_POOL_SIZE = 30;

export class PoopStormAbility implements IAbility {
  readonly id = 'poop_storm' as const;
  readonly group = new THREE.Group();

  private active = false;
  private tier: PoopStormTier = POOP_STORM_TIERS[0];
  private durationTimer = 0;
  private totalDuration = 0;
  private fireTimer = 0;

  // Storm poop pool
  private stormPoops: Poop[] = [];

  // VFX: swirling ring around player
  private stormRing: THREE.Mesh;
  private ringRotation = 0;

  constructor() {
    // Visual indicator: a translucent swirling ring
    const ringGeo = new THREE.TorusGeometry(4, 0.15, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffcc44,
      transparent: true,
      opacity: 0.4,
    });
    this.stormRing = new THREE.Mesh(ringGeo, ringMat);
    this.stormRing.rotation.x = Math.PI / 2;
    this.stormRing.visible = false;
    this.group.add(this.stormRing);
  }

  initPool(scene: THREE.Scene): void {
    for (let i = 0; i < POOP_POOL_SIZE; i++) {
      const poop = new Poop();
      scene.add(poop.mesh);
      scene.add(poop.trailLine);
      this.stormPoops.push(poop);
    }
  }

  activate(tier: number, _ctx: AbilityContext): void {
    this.tier = POOP_STORM_TIERS[clamp(tier, 0, 2)];
    this.active = true;
    this.totalDuration = this.tier.duration;
    this.durationTimer = this.tier.duration;
    this.fireTimer = 0;
    this.stormRing.visible = true;
  }

  deactivate(): void {
    this.active = false;
    this.stormRing.visible = false;
  }

  update(dt: number, ctx: AbilityContext): void {
    if (!this.active) return;

    this.durationTimer -= dt;
    if (this.durationTimer <= 0) {
      this.deactivate();
      return;
    }

    // Position ring around player
    this.ringRotation += dt * 3;
    this.stormRing.position.copy(ctx.playerPosition);
    this.stormRing.position.y -= 1;
    this.stormRing.rotation.z = this.ringRotation;

    // Pulse ring opacity based on remaining time
    const mat = this.stormRing.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.3 + Math.sin(this.ringRotation * 2) * 0.15;

    // Auto-fire poops at the tier's fire rate
    this.fireTimer += dt;
    const fireInterval = 1 / this.tier.fireRate;
    while (this.fireTimer >= fireInterval) {
      this.fireTimer -= fireInterval;
      this.spawnStormPoop(ctx);
    }
  }

  updatePoops(dt: number): void {
    for (const poop of this.stormPoops) poop.update(dt);
  }

  getActivePoops(): Poop[] {
    return this.stormPoops.filter(p => p.alive && !p.grounded);
  }

  // ── Hooks (poop storm doesn't mimic — it auto-fires) ──

  notifyPlayerPoop(): void {}
  notifyPlayerDive(): void {}
  notifyPlayerFlip(): void {}

  getCoinMultiplier(): number { return 1; }
  getHeatMultiplier(): number { return 1; }

  get isActive(): boolean { return this.active; }

  get durationProgress(): number {
    if (!this.active) return 0;
    return this.durationTimer / this.totalDuration;
  }

  // ── Private ───────────────────────────────────────────

  private spawnStormPoop(ctx: AbilityContext): void {
    const poop = this.stormPoops.find(p => !p.alive);
    if (!poop) return;

    const spread = this.tier.spread;
    const spawnPos = ctx.playerPosition.clone();
    spawnPos.x += (Math.random() - 0.5) * spread;
    spawnPos.z += (Math.random() - 0.5) * spread;

    poop.spawn(spawnPos, ctx.playerForward, ctx.playerSpeed);
  }
}
