import * as THREE from 'three';
import { createBirdModel, animateWings } from '../../entities/BirdModel';
import { Poop } from '../../entities/Poop';
import { clamp } from '../../utils/MathUtils';
import {
  IAbility, AbilityContext,
  FLOCK_FRENZY_TIERS, FlockFrenzyTier,
} from './AbilityTypes';

interface FlockBird {
  mesh: THREE.Group;
  orbitAngle: number;
  orbitRadius: number;
  orbitYOffset: number;
  wingPhaseOffset: number;
  poopDelayTimer: number;
  entranceOrigin: THREE.Vector3;
  exitVelocity: THREE.Vector3;
}

const ORBIT_RADIUS_MIN = 3;
const ORBIT_RADIUS_MAX = 7;
const ORBIT_SPEED = 1.5;
const ORBIT_Y_AMPLITUDE = 1.5;
const JITTER_STRENGTH = 0.3;
const ENTRANCE_DURATION = 1.2;
const EXIT_DURATION = 0.8;
const ENTRANCE_SPAWN_RADIUS = 40;
const EXIT_SCATTER_SPEED = 30;
const POOP_DELAY_MIN = 0.05;
const POOP_DELAY_MAX = 0.3;
const POOP_SPREAD = 3;
const POOP_POOL_SIZE = 20;
const MIMICRY_LAG = 0.15;

export class FlockFrenzyAbility implements IAbility {
  readonly id = 'flock_frenzy' as const;
  readonly group = new THREE.Group();

  private state: 'idle' | 'entering' | 'active' | 'exiting' = 'idle';
  private tier: FlockFrenzyTier = FLOCK_FRENZY_TIERS[0];
  private durationTimer = 0;
  private animTimer = 0;
  private elapsed = 0;

  // Pre-allocated birds (max tier count)
  private allBirds: FlockBird[] = [];
  private activeBirdCount = 0;

  // Flock poop pool
  private flockPoops: Poop[] = [];

  // Mimicry
  private pendingPoop = false;
  private poopMimicTimer = 0;
  private mimicDive = false;
  private mimicFlipType: string | null = null;
  private mimicFlipProgress = 0;

  constructor() {
    // Pre-allocate for max tier bird count (16)
    const maxBirds = FLOCK_FRENZY_TIERS[2].birdCount;
    for (let i = 0; i < maxBirds; i++) {
      const mesh = createBirdModel();
      mesh.visible = false;
      this.group.add(mesh);

      this.allBirds.push({
        mesh,
        orbitAngle: (i / maxBirds) * Math.PI * 2,
        orbitRadius: ORBIT_RADIUS_MIN + Math.random() * (ORBIT_RADIUS_MAX - ORBIT_RADIUS_MIN),
        orbitYOffset: Math.random() * Math.PI * 2,
        wingPhaseOffset: Math.random() * 2,
        poopDelayTimer: 0,
        entranceOrigin: new THREE.Vector3(),
        exitVelocity: new THREE.Vector3(),
      });
    }
  }

  initPool(scene: THREE.Scene): void {
    for (let i = 0; i < POOP_POOL_SIZE; i++) {
      const poop = new Poop();
      scene.add(poop.mesh);
      scene.add(poop.trailLine);
      this.flockPoops.push(poop);
    }
  }

  // ── Activation ────────────────────────────────────────

  activate(tier: number, _ctx: AbilityContext): void {
    this.tier = FLOCK_FRENZY_TIERS[clamp(tier, 0, 2)];
    this.activeBirdCount = this.tier.birdCount;
    this.state = 'entering';
    this.animTimer = 0;
    this.durationTimer = this.tier.duration;

    // Scale birds for this tier
    for (let i = 0; i < this.allBirds.length; i++) {
      const fb = this.allBirds[i];
      if (i < this.activeBirdCount) {
        fb.mesh.scale.setScalar(1.5 * this.tier.birdScale);
        fb.mesh.visible = true;
        fb.orbitAngle = (i / this.activeBirdCount) * Math.PI * 2;
        const angle = fb.orbitAngle + (Math.random() - 0.5) * 0.5;
        fb.entranceOrigin.set(
          Math.cos(angle) * ENTRANCE_SPAWN_RADIUS,
          (Math.random() - 0.5) * 10,
          Math.sin(angle) * ENTRANCE_SPAWN_RADIUS,
        );
      } else {
        fb.mesh.visible = false;
      }
    }
  }

  deactivate(): void {
    this.state = 'idle';
    for (const fb of this.allBirds) fb.mesh.visible = false;
    this.pendingPoop = false;
    this.mimicFlipType = null;
    this.mimicDive = false;
  }

  // ── Update ────────────────────────────────────────────

  update(dt: number, ctx: AbilityContext): void {
    this.elapsed += dt;

    switch (this.state) {
      case 'idle': return;

      case 'entering':
        this.animTimer += dt;
        this.updateEntrance(ctx.playerPosition, ctx.playerSpeed);
        if (this.animTimer >= ENTRANCE_DURATION) this.state = 'active';
        break;

      case 'active':
        this.durationTimer -= dt;
        this.updateActive(dt, ctx);
        if (this.durationTimer <= 0) this.initExit();
        break;

      case 'exiting':
        this.animTimer += dt;
        this.updateExit(dt, ctx.playerSpeed);
        if (this.animTimer >= EXIT_DURATION) this.deactivate();
        break;
    }
  }

  updatePoops(dt: number): void {
    for (const poop of this.flockPoops) poop.update(dt);
  }

  getActivePoops(): Poop[] {
    return this.flockPoops.filter(p => p.alive && !p.grounded);
  }

  // ── Hooks ─────────────────────────────────────────────

  notifyPlayerPoop(): void {
    if (this.state !== 'active' || !this.tier.mimicPoop) return;
    this.pendingPoop = true;
    this.poopMimicTimer = MIMICRY_LAG;
    for (let i = 0; i < this.activeBirdCount; i++) {
      this.allBirds[i].poopDelayTimer = POOP_DELAY_MIN + Math.random() * (POOP_DELAY_MAX - POOP_DELAY_MIN);
    }
  }

  notifyPlayerDive(isDiving: boolean): void {
    if (this.tier.mimicDive) this.mimicDive = isDiving;
  }

  notifyPlayerFlip(_flipType: string): void {
    if (this.state !== 'active' || !this.tier.mimicFlip) return;
    this.mimicFlipType = _flipType;
    this.mimicFlipProgress = 0;
  }

  getCoinMultiplier(): number { return 1; }
  getHeatMultiplier(): number { return 1; }

  // ── State queries ─────────────────────────────────────

  get isActive(): boolean { return this.state !== 'idle'; }

  get durationProgress(): number {
    if (this.state === 'entering') return 1;
    if (this.state === 'active') return this.durationTimer / this.tier.duration;
    return 0;
  }

  get poopScoreMultiplier(): number { return this.tier.poopScoreMultiplier; }

  // ── Private state updates ─────────────────────────────

  private initExit(): void {
    this.state = 'exiting';
    this.animTimer = 0;
    for (let i = 0; i < this.activeBirdCount; i++) {
      const fb = this.allBirds[i];
      const angle = fb.orbitAngle + (Math.random() - 0.5) * 0.5;
      fb.exitVelocity.set(
        Math.cos(angle) * EXIT_SCATTER_SPEED,
        (Math.random() - 0.5) * EXIT_SCATTER_SPEED * 0.5 + 5,
        Math.sin(angle) * EXIT_SCATTER_SPEED,
      );
    }
  }

  private updateEntrance(playerPos: THREE.Vector3, speed: number): void {
    const progress = clamp(this.animTimer / ENTRANCE_DURATION, 0, 1);
    const t = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    for (let i = 0; i < this.activeBirdCount; i++) {
      const fb = this.allBirds[i];
      const tx = playerPos.x + Math.cos(fb.orbitAngle) * fb.orbitRadius;
      const ty = playerPos.y + Math.sin(fb.orbitYOffset) * ORBIT_Y_AMPLITUDE;
      const tz = playerPos.z + Math.sin(fb.orbitAngle) * fb.orbitRadius;
      const sx = playerPos.x + fb.entranceOrigin.x;
      const sy = playerPos.y + fb.entranceOrigin.y;
      const sz = playerPos.z + fb.entranceOrigin.z;

      fb.mesh.position.set(sx + (tx - sx) * t, sy + (ty - sy) * t, sz + (tz - sz) * t);
      fb.mesh.lookAt(playerPos);
      fb.mesh.rotateY(Math.PI);
      animateWings(fb.mesh, this.elapsed + fb.wingPhaseOffset, speed, false);
    }
  }

  private updateActive(dt: number, ctx: AbilityContext): void {
    // Poop mimicry
    if (this.pendingPoop) {
      this.poopMimicTimer -= dt;
      if (this.poopMimicTimer <= 0) {
        for (let i = 0; i < this.activeBirdCount; i++) {
          const fb = this.allBirds[i];
          fb.poopDelayTimer -= dt;
          if (fb.poopDelayTimer <= 0 && fb.poopDelayTimer > -dt) {
            this.spawnFlockPoop(fb.mesh.position, ctx.playerForward, ctx.playerSpeed);
          }
        }
        if (this.allBirds.slice(0, this.activeBirdCount).every(fb => fb.poopDelayTimer <= 0)) {
          this.pendingPoop = false;
        }
      }
    }

    // Flip mimicry
    if (this.mimicFlipType) {
      this.mimicFlipProgress += dt / 0.8;
      if (this.mimicFlipProgress >= 1) { this.mimicFlipType = null; this.mimicFlipProgress = 0; }
    }

    // Orbit birds
    for (let i = 0; i < this.activeBirdCount; i++) {
      const fb = this.allBirds[i];
      fb.orbitAngle += ORBIT_SPEED * dt;
      const ox = Math.cos(fb.orbitAngle) * fb.orbitRadius;
      const oy = Math.sin(this.elapsed * 0.8 + fb.orbitYOffset) * ORBIT_Y_AMPLITUDE;
      const oz = Math.sin(fb.orbitAngle) * fb.orbitRadius;
      const jx = (Math.random() - 0.5) * JITTER_STRENGTH * dt;
      const jz = (Math.random() - 0.5) * JITTER_STRENGTH * dt;

      fb.mesh.position.set(ctx.playerPosition.x + ox + jx, ctx.playerPosition.y + oy, ctx.playerPosition.z + oz + jz);

      const tangentAngle = fb.orbitAngle + Math.PI / 2;
      fb.mesh.quaternion.setFromEuler(new THREE.Euler(ctx.playerPitch * 0.7, tangentAngle, ctx.playerRoll * 0.5, 'YXZ'));

      if (this.mimicDive) fb.mesh.rotateX(-0.5);
      if (this.mimicFlipType && this.mimicFlipProgress < 1) {
        const fq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.mimicFlipProgress * Math.PI * 2);
        fb.mesh.quaternion.multiply(fq);
      }

      animateWings(fb.mesh, this.elapsed + fb.wingPhaseOffset, ctx.playerSpeed, false);
    }
  }

  private updateExit(dt: number, speed: number): void {
    const progress = clamp(this.animTimer / EXIT_DURATION, 0, 1);
    for (let i = 0; i < this.activeBirdCount; i++) {
      const fb = this.allBirds[i];
      fb.mesh.position.addScaledVector(fb.exitVelocity, dt);
      fb.mesh.scale.setScalar(Math.max(0.1, (1 - progress) * 1.5 * this.tier.birdScale));
      if (fb.exitVelocity.lengthSq() > 0.1) {
        fb.mesh.rotation.set(0, Math.atan2(fb.exitVelocity.x, fb.exitVelocity.z), 0);
      }
      animateWings(fb.mesh, this.elapsed + fb.wingPhaseOffset, 40, false);
    }
  }

  private spawnFlockPoop(position: THREE.Vector3, forward: THREE.Vector3, speed: number): void {
    const poop = this.flockPoops.find(p => !p.alive);
    if (!poop) return;
    const spawnPos = position.clone();
    spawnPos.x += (Math.random() - 0.5) * POOP_SPREAD;
    spawnPos.z += (Math.random() - 0.5) * POOP_SPREAD;
    poop.spawn(spawnPos, forward, speed);
  }
}
