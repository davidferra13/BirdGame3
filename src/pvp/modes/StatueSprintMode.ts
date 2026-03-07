/**
 * StatueSprintMode - Race to cover your assigned platform with poop!
 * Each player gets a large flat platform to bomb. First to 100% coverage wins.
 * Three difficulty levels change how many platforms exist across the map.
 */

import * as THREE from 'three';
import { PvPMode, PvPPlayer, PvPResults, PvPStanding } from '../PvPMode';
import { PVP } from '../../utils/Constants';

// Platform dimensions
const PLATFORM_W = 16;   // Width (X)
const PLATFORM_D = 16;   // Depth (Z)
const PLATFORM_H = 2;    // Height
const RING_INNER = PLATFORM_W / 2 + 0.8;
const RING_OUTER = PLATFORM_W / 2 + 3.2;

// How many platforms per difficulty
const DIFFICULTY_COUNTS: Record<string, number> = { easy: 3, medium: 5, hard: 7 };

// Spread across open areas of the 1500×1500 world
const PLATFORM_SPAWN_POSITIONS = [
  new THREE.Vector3(  0,   0,    0),    // City centre
  new THREE.Vector3(180,   0,   40),    // East plaza
  new THREE.Vector3(-170,  0,  -50),    // West district
  new THREE.Vector3( 30,   0, -190),    // South park
  new THREE.Vector3(-20,   0,  200),    // North open field
  new THREE.Vector3(160,   0, -160),    // SE corner
  new THREE.Vector3(-150,  0,  160),    // NW corner
];

// Shared geometry reused by all splat decals
const SPLAT_GEO = new THREE.CircleGeometry(1.0, 8);

interface ProgressRing {
  fill: THREE.Mesh;
  lastRenderedCoverage: number;
}

interface HitParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class StatueSprintMode extends PvPMode {
  // Per-player coverage tracking: playerId → platformIndex → coverage %
  private coverage = new Map<string, Map<number, number>>();
  // Each player's assigned platform index
  private assignments = new Map<string, number>();

  // Scene objects
  private platformGroups: THREE.Group[] = [];
  private platformPositions: THREE.Vector3[] = [];
  private beaconLights: THREE.PointLight[] = [];
  private beaconPillars: THREE.Mesh[] = [];
  private progressRings: ProgressRing[] = [];
  private splatPools: THREE.Mesh[][] = [];   // splatPools[platformIdx] = array of splat meshes

  // Particles for poop impact bursts
  private hitParticles: HitParticle[] = [];

  // Win state
  private roundComplete = false;
  private winnerName = '';
  private firstWinTime: number | null = null;

  // Difficulty
  private difficulty: 'easy' | 'medium' | 'hard' = 'medium';

  // -------------------------------------------------------------------
  // PvPMode interface
  // -------------------------------------------------------------------

  getModeId(): string { return 'statue-sprint'; }
  getModeName(): string { return 'Statue Sprint'; }
  getModeDescription(): string { return 'Cover your platform with poop! First to 100% wins the round.'; }
  getModeIcon(): string { return '\uD83D\uDCA9'; }
  getRoundDuration(): number { return PVP.SPRINT_ROUND_DURATION; }
  getMinPlayers(): number { return PVP.SPRINT_MIN_PLAYERS; }
  getMaxPlayers(): number { return PVP.SPRINT_MAX_PLAYERS; }

  /** Allows PvPManager to detect early win condition. */
  isComplete(): boolean { return this.roundComplete; }

  // -------------------------------------------------------------------

  onStart(players: PvPPlayer[]): void {
    super.onStart(players);

    this.roundComplete = false;
    this.winnerName = '';
    this.firstWinTime = null;
    this.coverage.clear();
    this.assignments.clear();

    for (const p of players) {
      this.coverage.set(p.id, new Map());
    }

    // Build platforms
    const count = DIFFICULTY_COUNTS[this.difficulty] ?? 5;
    this.spawnPlatforms(Math.min(count, players.length, PLATFORM_SPAWN_POSITIONS.length));

    // Assign each player their own platform (round-robin if more players than platforms)
    players.forEach((p, idx) => {
      this.assignments.set(p.id, idx % this.platformPositions.length);
    });

    this.context.eventBus.on('platform-hit', this.handlePlatformHit);
  }

  onUpdate(dt: number): void {
    this.elapsed += dt;

    // Animate beacon pulse (speeds up as platform fills)
    for (let i = 0; i < this.beaconLights.length; i++) {
      const maxCov = this.getMaxCoverageForPlatform(i);
      const speed = 2 + (maxCov / 100) * 6;
      this.beaconLights[i].intensity = 1.5 + Math.sin(this.elapsed * speed) * 1.0;
    }

    // Update hit particles
    this.tickParticles(dt);

    // Update platform progress rings (only when coverage changed)
    this.updateProgressRings();

    // Update player scores to reflect their current platform coverage
    for (const p of this.players) {
      const pidx = this.assignments.get(p.id) ?? 0;
      p.score = Math.round(this.coverage.get(p.id)?.get(pidx) ?? 0);
    }

    // Check win condition
    if (!this.roundComplete) {
      for (const p of this.players) {
        const pidx = this.assignments.get(p.id) ?? 0;
        const cov = this.coverage.get(p.id)?.get(pidx) ?? 0;
        if (cov >= 100) {
          this.triggerWin(p);
          break;
        }
      }
    }
  }

  onEnd(): PvPResults {
    this.context.eventBus.off('platform-hit', this.handlePlatformHit);

    // Sort by coverage on each player's assigned platform
    const sorted = [...this.players].sort((a, b) => {
      const aPidx = this.assignments.get(a.id) ?? 0;
      const bPidx = this.assignments.get(b.id) ?? 0;
      const aCov = this.coverage.get(a.id)?.get(aPidx) ?? 0;
      const bCov = this.coverage.get(b.id)?.get(bPidx) ?? 0;
      return bCov - aCov;
    });

    const standings: PvPStanding[] = sorted.map((p, i) => {
      const pidx = this.assignments.get(p.id) ?? 0;
      const cov = Math.round(this.coverage.get(p.id)?.get(pidx) ?? 0);
      const isWinner = i === 0;

      // Speed bonus for winning quickly
      const speedBonus = isWinner && this.firstWinTime !== null && this.firstWinTime < 60
        ? PVP.SPRINT_SPEED_BONUS : 0;

      return {
        player: p,
        rank: i + 1,
        score: cov,
        reward: isWinner
          ? PVP.SPRINT_WINNER_BONUS + speedBonus
          : PVP.SPRINT_PARTICIPATION_REWARD,
        label: `${cov}% covered${isWinner && speedBonus > 0 ? ' \u26A1 Speed Bonus!' : ''}`,
      };
    });

    this.cleanupVisuals();

    return {
      modeId: this.getModeId(),
      modeName: this.getModeName(),
      standings,
      duration: this.elapsed,
    };
  }

  getModeData(): any {
    const local = this.players.find(p => p.isLocal);
    const localId = local?.id ?? '';
    const localPidx = this.assignments.get(localId) ?? 0;
    const localCov = Math.round(this.coverage.get(localId)?.get(localPidx) ?? 0);

    // Rank by assigned-platform coverage
    const sorted = [...this.players].sort((a, b) => {
      const aPidx = this.assignments.get(a.id) ?? 0;
      const bPidx = this.assignments.get(b.id) ?? 0;
      return (this.coverage.get(b.id)?.get(bPidx) ?? 0)
           - (this.coverage.get(a.id)?.get(aPidx) ?? 0);
    });
    const rank = sorted.findIndex(p => p.isLocal) + 1;
    const ordinal = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;

    const assignedPos = this.platformPositions[localPidx];

    return {
      // Local player perspective
      localCoverage: localCov,
      localRank: ordinal,
      localPlatformIndex: localPidx,
      assignedPlatformPos: assignedPos
        ? { x: assignedPos.x, y: assignedPos.y, z: assignedPos.z }
        : null,
      roundComplete: this.roundComplete,
      winnerName: this.winnerName,

      // Global data (bots and server use these)
      platformPositions: this.platformPositions.map(p => ({ x: p.x, y: p.y, z: p.z })),
      playerAssignments: Object.fromEntries(this.assignments),
    };
  }

  // -------------------------------------------------------------------
  // Public API for Game.ts hit detection
  // -------------------------------------------------------------------

  /** Returns the 3D centre of the assigned platform for the given player. */
  getAssignedPlatformPosition(playerId: string): THREE.Vector3 | null {
    const pidx = this.assignments.get(playerId);
    if (pidx === undefined) return null;
    return this.platformPositions[pidx] ?? null;
  }

  /** Returns the platform index assigned to the given player. */
  getPlayerPlatformIndex(playerId: string): number {
    return this.assignments.get(playerId) ?? 0;
  }

  // -------------------------------------------------------------------
  // Hit registration (called via event bus from Game.ts → PvPManager)
  // -------------------------------------------------------------------

  registerPlatformHit(playerId: string, platformIndex: number, hitPosition: THREE.Vector3): void {
    if (this.roundComplete) return;

    const playerCov = this.coverage.get(playerId);
    if (!playerCov) return;

    // Only register hits on the player's own assigned platform
    if (this.assignments.get(playerId) !== platformIndex) return;

    const current = playerCov.get(platformIndex) ?? 0;
    if (current >= 100) return;

    const next = Math.min(100, current + PVP.SPRINT_COVERAGE_PER_HIT);
    playerCov.set(platformIndex, next);

    // Place a splat decal on the platform surface
    this.addSplat(platformIndex, playerId);

    // Spawn impact particle burst
    this.spawnImpactParticles(hitPosition, this.getPlayerColor(playerId));

    // Milestone announcements (25 / 50 / 75 / 90 %)
    for (const m of [25, 50, 75, 90]) {
      if (current < m && next >= m) {
        this.context.eventBus.emit('sprint-milestone', { playerId, platformIndex, milestone: m });
      }
    }
  }

  // -------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------

  private handlePlatformHit = (data: {
    playerId: string;
    platformIndex: number;
    hitPosition?: { x: number; y: number; z: number };
  }): void => {
    const pos = data.hitPosition
      ? new THREE.Vector3(data.hitPosition.x, data.hitPosition.y, data.hitPosition.z)
      : (this.platformPositions[data.platformIndex] ?? new THREE.Vector3());
    this.registerPlatformHit(data.playerId, data.platformIndex, pos);
  };

  private triggerWin(winner: PvPPlayer): void {
    this.roundComplete = true;
    this.winnerName = winner.name;
    this.firstWinTime = this.elapsed;

    // Flash the winner's platform gold
    const pidx = this.assignments.get(winner.id) ?? 0;
    const group = this.platformGroups[pidx];
    if (group) {
      group.traverse(obj => {
        if (obj instanceof THREE.Mesh && obj.userData.platformSurface) {
          const mat = obj.material as THREE.MeshStandardMaterial;
          mat.emissive.setHex(winner.color);
          mat.emissiveIntensity = 0.6;
        }
      });
    }
    // Set beacon to winner's colour
    const beacon = this.beaconLights[pidx];
    if (beacon) {
      beacon.color.setHex(winner.color);
      beacon.intensity = 6;
    }
  }

  // ------- Scene construction -------

  private spawnPlatforms(count: number): void {
    this.cleanupVisuals();

    for (let i = 0; i < count; i++) {
      const spawnPos = PLATFORM_SPAWN_POSITIONS[i].clone();
      spawnPos.y = 0;
      this.platformPositions.push(spawnPos);

      const group = new THREE.Group();
      group.position.copy(spawnPos);

      // ---- Platform slab ----
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(PLATFORM_W, PLATFORM_H, PLATFORM_D),
        new THREE.MeshStandardMaterial({ color: 0xc4b49a, roughness: 0.75, metalness: 0.05 }),
      );
      slab.position.y = PLATFORM_H / 2;
      slab.castShadow = true;
      slab.receiveShadow = true;
      slab.userData.platformSurface = true;
      group.add(slab);

      // ---- Edge trim strips ----
      const trimMat = new THREE.MeshStandardMaterial({ color: 0x888877, roughness: 0.6, metalness: 0.2 });
      for (const [dx, dz, rx, rz, w, d] of [
        [0,  PLATFORM_D / 2, 0, 0, PLATFORM_W + 0.4, 0.4],   // front edge
        [0, -PLATFORM_D / 2, 0, 0, PLATFORM_W + 0.4, 0.4],   // back edge
        [ PLATFORM_W / 2, 0, 0, 0, 0.4, PLATFORM_D],          // right edge
        [-PLATFORM_W / 2, 0, 0, 0, 0.4, PLATFORM_D],          // left edge
      ] as [number, number, number, number, number, number][]) {
        const trim = new THREE.Mesh(new THREE.BoxGeometry(w, PLATFORM_H + 0.1, d), trimMat.clone());
        trim.position.set(dx, PLATFORM_H / 2, dz);
        group.add(trim);
      }

      // ---- Platform number disc on top ----
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(1.6, 1.6, 0.15, 16),
        new THREE.MeshStandardMaterial({ color: 0xfafafa, metalness: 0.5, roughness: 0.2 }),
      );
      disc.position.y = PLATFORM_H + 0.08;
      group.add(disc);

      // ---- Dark background ring ----
      const bgRing = new THREE.Mesh(
        new THREE.RingGeometry(RING_INNER, RING_OUTER, 48),
        new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
      );
      bgRing.rotation.x = -Math.PI / 2;
      bgRing.position.y = PLATFORM_H + 0.12;
      group.add(bgRing);

      // ---- Fill ring (starts empty, grows with coverage) ----
      const fillRingMesh = new THREE.Mesh(
        new THREE.RingGeometry(RING_INNER, RING_OUTER, 48, 1, -Math.PI / 2, 0),
        new THREE.MeshBasicMaterial({ color: 0x44ff88, transparent: true, opacity: 0.92, side: THREE.DoubleSide }),
      );
      fillRingMesh.rotation.x = -Math.PI / 2;
      fillRingMesh.position.y = PLATFORM_H + 0.16;
      group.add(fillRingMesh);
      this.progressRings.push({ fill: fillRingMesh, lastRenderedCoverage: -1 });

      // ---- Splat pool (20 decals per platform) ----
      const splats: THREE.Mesh[] = [];
      for (let s = 0; s < 20; s++) {
        const splat = new THREE.Mesh(
          SPLAT_GEO,
          new THREE.MeshBasicMaterial({ color: 0x8b4a10, transparent: true, opacity: 0.88, side: THREE.DoubleSide }),
        );
        splat.rotation.x = -Math.PI / 2;  // flat on platform surface
        splat.position.y = PLATFORM_H + 0.08;
        splat.visible = false;
        group.add(splat);
        splats.push(splat);
      }
      this.splatPools.push(splats);

      this.context.scene.add(group);
      this.platformGroups.push(group);

      // ---- Beacon light ----
      const beaconY = PVP.SPRINT_BEACON_HEIGHT;
      const light = new THREE.PointLight(0xffd700, 2, beaconY * 2.2);
      light.position.set(spawnPos.x, beaconY, spawnPos.z);
      this.context.scene.add(light);
      this.beaconLights.push(light);

      // ---- Beacon pillar ----
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.25, beaconY, 6),
        new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.13 }),
      );
      pillar.position.set(spawnPos.x, beaconY / 2, spawnPos.z);
      this.context.scene.add(pillar);
      this.beaconPillars.push(pillar);
    }
  }

  private addSplat(platformIndex: number, playerId: string): void {
    const pool = this.splatPools[platformIndex];
    if (!pool) return;
    const splat = pool.find(m => !m.visible);
    if (!splat) return;

    (splat.material as THREE.MeshBasicMaterial).color.setHex(this.getPlayerColor(playerId));

    const halfW = PLATFORM_W / 2 - 1.5;
    const halfD = PLATFORM_D / 2 - 1.5;
    splat.position.set(
      (Math.random() * 2 - 1) * halfW,
      PLATFORM_H + 0.09,
      (Math.random() * 2 - 1) * halfD,
    );
    splat.rotation.z = Math.random() * Math.PI * 2;
    const sc = 0.7 + Math.random() * 1.2;
    splat.scale.set(sc, sc, 1);
    splat.visible = true;
  }

  private updateProgressRings(): void {
    for (let i = 0; i < this.platformPositions.length; i++) {
      const pr = this.progressRings[i];
      if (!pr) continue;

      // Find the player assigned to this platform and their coverage
      let cov = 0;
      let color = 0x44ff88;
      for (const p of this.players) {
        if (this.assignments.get(p.id) === i) {
          cov = this.coverage.get(p.id)?.get(i) ?? 0;
          color = p.color;
          break;
        }
      }

      // Only rebuild geometry when coverage changed meaningfully
      if (Math.abs(cov - pr.lastRenderedCoverage) < 0.5) continue;
      pr.lastRenderedCoverage = cov;

      const angle = (cov / 100) * Math.PI * 2;
      const old = pr.fill.geometry;
      pr.fill.geometry = new THREE.RingGeometry(RING_INNER, RING_OUTER, 48, 1, -Math.PI / 2, angle);
      old.dispose();

      (pr.fill.material as THREE.MeshBasicMaterial).color.setHex(color);

      // Glow intensifies with coverage
      const beacon = this.beaconLights[i];
      if (beacon && !this.roundComplete) {
        beacon.color.setHex(color);
        beacon.intensity = 1.5 + (cov / 100) * 4;
      }
    }
  }

  // ------- Particles -------

  private spawnImpactParticles(position: THREE.Vector3, color: number): void {
    const count = 6;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 4, 4),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1.0 }),
      );
      mesh.position.copy(position);
      this.context.scene.add(mesh);

      const angle = (i / count) * Math.PI * 2;
      const speed = 3 + Math.random() * 4;
      this.hitParticles.push({
        mesh,
        vel: new THREE.Vector3(
          Math.cos(angle) * speed,
          3 + Math.random() * 5,
          Math.sin(angle) * speed,
        ),
        life: 0.55,
        maxLife: 0.55,
      });
    }
  }

  private tickParticles(dt: number): void {
    for (let i = this.hitParticles.length - 1; i >= 0; i--) {
      const p = this.hitParticles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.y -= 14 * dt;
      const t = 1 - p.life / p.maxLife;
      p.mesh.scale.setScalar(Math.max(0.01, 1 - t));
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
      if (p.life <= 0) {
        p.mesh.parent?.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.hitParticles.splice(i, 1);
      }
    }
  }

  // ------- Utils -------

  private getMaxCoverageForPlatform(platformIndex: number): number {
    let max = 0;
    for (const p of this.players) {
      if (this.assignments.get(p.id) === platformIndex) {
        max = Math.max(max, this.coverage.get(p.id)?.get(platformIndex) ?? 0);
      }
    }
    return max;
  }

  private getPlayerColor(playerId: string): number {
    return this.players.find(p => p.id === playerId)?.color ?? 0xffffff;
  }

  // ------- Cleanup -------

  private cleanupVisuals(): void {
    for (const group of this.platformGroups) {
      group.parent?.remove(group);
      group.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => (m as THREE.Material).dispose());
          } else {
            (obj.material as THREE.Material)?.dispose();
          }
        }
      });
    }
    this.platformGroups = [];
    this.platformPositions = [];
    this.splatPools = [];
    this.progressRings = [];

    for (const light of this.beaconLights) {
      light.parent?.remove(light);
    }
    this.beaconLights = [];

    for (const pillar of this.beaconPillars) {
      pillar.parent?.remove(pillar);
      pillar.geometry?.dispose();
      (pillar.material as THREE.Material)?.dispose();
    }
    this.beaconPillars = [];

    for (const p of this.hitParticles) {
      p.mesh.parent?.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    }
    this.hitParticles = [];
  }

  dispose(): void {
    this.cleanupVisuals();
    this.context?.eventBus.off('platform-hit', this.handlePlatformHit);
  }
}
