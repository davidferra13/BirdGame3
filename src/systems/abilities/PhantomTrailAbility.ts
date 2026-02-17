import * as THREE from 'three';
import { createBirdModel, animateWings } from '../../entities/BirdModel';
import { Poop } from '../../entities/Poop';
import { clamp } from '../../utils/MathUtils';
import {
  IAbility, AbilityContext,
  PHANTOM_TRAIL_TIERS, PhantomTrailTier,
} from './AbilityTypes';

interface PathSnapshot {
  position: THREE.Vector3;
  forward: THREE.Vector3;
  speed: number;
  pitch: number;
  roll: number;
}

interface GhostBird {
  mesh: THREE.Group;
  pathIndex: number;
  poopCooldown: number;
}

const RECORD_INTERVAL = 0.05;   // Record position every 50ms
const GHOST_REPLAY_OFFSET = 0.3; // Seconds between each ghost's start
const GHOST_POOP_INTERVAL = 0.6; // How often ghosts drop poop
const GHOST_POOP_POOL = 20;
const GHOST_SCALE = 0.6;
const GHOST_OPACITY = 0.5;

export class PhantomTrailAbility implements IAbility {
  readonly id = 'phantom_trail' as const;
  readonly group = new THREE.Group();

  private state: 'idle' | 'recording' | 'replaying' = 'idle';
  private tier: PhantomTrailTier = PHANTOM_TRAIL_TIERS[0];

  // Recording
  private recordedPath: PathSnapshot[] = [];
  private recordTimer = 0;
  private recordDuration = 0;

  // Replay
  private ghosts: GhostBird[] = [];
  private allGhostMeshes: THREE.Group[] = [];
  private replayElapsed = 0;
  private elapsed = 0;

  // Poop pool
  private ghostPoops: Poop[] = [];

  constructor() {
    // Pre-allocate ghost meshes (max 4)
    const maxGhosts = PHANTOM_TRAIL_TIERS[2].ghostCount;
    for (let i = 0; i < maxGhosts; i++) {
      const mesh = createBirdModel();
      mesh.scale.setScalar(1.5 * GHOST_SCALE);
      mesh.visible = false;
      // Make translucent
      mesh.traverse(child => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          child.material = child.material.clone();
          child.material.transparent = true;
          child.material.opacity = GHOST_OPACITY;
          child.material.color.setHex(0xaaddff);
        }
      });
      this.group.add(mesh);
      this.allGhostMeshes.push(mesh);
    }
  }

  initPool(scene: THREE.Scene): void {
    for (let i = 0; i < GHOST_POOP_POOL; i++) {
      const poop = new Poop();
      scene.add(poop.mesh);
      scene.add(poop.trailLine);
      this.ghostPoops.push(poop);
    }
  }

  activate(tier: number, _ctx: AbilityContext): void {
    this.tier = PHANTOM_TRAIL_TIERS[clamp(tier, 0, 2)];
    this.state = 'recording';
    this.recordedPath = [];
    this.recordTimer = 0;
    this.recordDuration = this.tier.recordDuration;
  }

  deactivate(): void {
    this.state = 'idle';
    this.ghosts = [];
    for (const mesh of this.allGhostMeshes) mesh.visible = false;
  }

  update(dt: number, ctx: AbilityContext): void {
    this.elapsed += dt;

    if (this.state === 'recording') {
      this.recordTimer += dt;

      // Record snapshots
      const interval = RECORD_INTERVAL;
      if (this.recordedPath.length === 0 || this.recordTimer >= this.recordedPath.length * interval + interval) {
        this.recordedPath.push({
          position: ctx.playerPosition.clone(),
          forward: ctx.playerForward.clone(),
          speed: ctx.playerSpeed,
          pitch: ctx.playerPitch,
          roll: ctx.playerRoll,
        });
      }

      if (this.recordTimer >= this.recordDuration) {
        this.startReplay();
      }
    }

    if (this.state === 'replaying') {
      this.replayElapsed += dt;
      this.updateReplay(dt);

      // Check if all ghosts finished
      const maxPathTime = this.recordedPath.length * RECORD_INTERVAL;
      const lastGhostStart = (this.tier.ghostCount - 1) * GHOST_REPLAY_OFFSET;
      if (this.replayElapsed > maxPathTime + lastGhostStart + 0.5) {
        this.deactivate();
      }
    }
  }

  updatePoops(dt: number): void {
    for (const poop of this.ghostPoops) poop.update(dt);
  }

  getActivePoops(): Poop[] {
    return this.ghostPoops.filter(p => p.alive && !p.grounded);
  }

  notifyPlayerPoop(): void {}
  notifyPlayerDive(): void {}
  notifyPlayerFlip(): void {}

  getCoinMultiplier(): number { return 1; }
  getHeatMultiplier(): number { return 1; }

  get isActive(): boolean { return this.state !== 'idle'; }

  get durationProgress(): number {
    if (this.state === 'recording') return 1 - (this.recordTimer / this.recordDuration);
    if (this.state === 'replaying') {
      const maxTime = this.recordedPath.length * RECORD_INTERVAL + (this.tier.ghostCount - 1) * GHOST_REPLAY_OFFSET + 0.5;
      return Math.max(0, 1 - this.replayElapsed / maxTime);
    }
    return 0;
  }

  get poopScoreMultiplier(): number { return this.tier.poopScoreMultiplier; }

  // ── Private ───────────────────────────────────────────

  private startReplay(): void {
    this.state = 'replaying';
    this.replayElapsed = 0;
    this.ghosts = [];

    for (let i = 0; i < this.tier.ghostCount && i < this.allGhostMeshes.length; i++) {
      const mesh = this.allGhostMeshes[i];
      mesh.visible = true;
      this.ghosts.push({
        mesh,
        pathIndex: 0,
        poopCooldown: GHOST_POOP_INTERVAL * 0.5, // stagger initial poop
      });
    }
  }

  private updateReplay(dt: number): void {
    for (let g = 0; g < this.ghosts.length; g++) {
      const ghost = this.ghosts[g];
      const ghostTime = this.replayElapsed - g * GHOST_REPLAY_OFFSET;
      if (ghostTime < 0) { ghost.mesh.visible = false; continue; }

      const pathIndex = Math.floor(ghostTime / RECORD_INTERVAL);
      if (pathIndex >= this.recordedPath.length) {
        ghost.mesh.visible = false;
        continue;
      }

      ghost.mesh.visible = true;
      const snap = this.recordedPath[pathIndex];

      ghost.mesh.position.copy(snap.position);
      ghost.mesh.quaternion.setFromEuler(new THREE.Euler(snap.pitch, 0, snap.roll, 'YXZ'));
      // Face forward direction
      const yaw = Math.atan2(-snap.forward.x, -snap.forward.z);
      ghost.mesh.rotation.y = yaw;

      animateWings(ghost.mesh, this.elapsed + g * 0.5, snap.speed, false);

      // Ghost poop
      if (this.tier.ghostsDropPoop) {
        ghost.poopCooldown -= dt;
        if (ghost.poopCooldown <= 0) {
          ghost.poopCooldown = GHOST_POOP_INTERVAL;
          const poop = this.ghostPoops.find(p => !p.alive);
          if (poop) {
            poop.spawn(snap.position.clone(), snap.forward, snap.speed);
          }
        }
      }
    }
  }
}
