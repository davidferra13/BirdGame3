/**
 * RaceMode - Checkpoint-based flight race through the city.
 * Fly through rings in order. First to complete all checkpoints wins.
 */

import * as THREE from 'three';
import { PvPMode, PvPPlayer, PvPResults, PvPStanding } from '../PvPMode';
import { PVP } from '../../utils/Constants';
import { RACE_ROUTES, RaceCheckpointDef } from './RaceRoutes';

interface PlayerRaceState {
  currentCheckpoint: number;
  completedAt: number; // -1 if not finished
}

export class RaceMode extends PvPMode {
  private checkpoints: RaceCheckpointDef[] = [];
  private routeName = '';
  private playerStates = new Map<string, PlayerRaceState>();
  private raceFinished = false;

  // Visuals
  private ringGroup = new THREE.Group();
  private rings: THREE.Group[] = [];
  private guideLine: THREE.Line | null = null;
  private guideLineGeo: THREE.BufferGeometry | null = null;

  // Per-player ring visibility (local only — each player sees rings they haven't passed)
  private localCheckpoint = 0;

  getModeId(): string { return 'race'; }
  getModeName(): string { return 'Race'; }
  getModeDescription(): string { return 'Fly through checkpoints in order! First to finish wins.'; }
  getModeIcon(): string { return '\uD83C\uDFC1'; }
  getRoundDuration(): number { return PVP.RACE_ROUND_DURATION; }
  getMinPlayers(): number { return PVP.RACE_MIN_PLAYERS; }
  getMaxPlayers(): number { return PVP.RACE_MAX_PLAYERS; }

  onStart(players: PvPPlayer[]): void {
    super.onStart(players);

    // Pick a random route
    const route = RACE_ROUTES[Math.floor(Math.random() * RACE_ROUTES.length)];
    this.checkpoints = route.checkpoints;
    this.routeName = route.name;
    this.raceFinished = false;
    this.localCheckpoint = 0;

    // Init player states
    this.playerStates.clear();
    for (const p of players) {
      this.playerStates.set(p.id, { currentCheckpoint: 0, completedAt: -1 });
    }

    // Create ring visuals
    this.createRings();

    // Create guide line
    this.createGuideLine();

    // Listen for checkpoint events
    this.context.eventBus.on('checkpoint-reached', this.handleCheckpoint);

    this.context.scene.add(this.ringGroup);
  }

  onUpdate(dt: number): void {
    this.elapsed += dt;

    // Check local player checkpoint collisions
    const localPlayer = this.players.find(p => p.isLocal);
    if (localPlayer && this.localCheckpoint < this.checkpoints.length) {
      const cp = this.checkpoints[this.localCheckpoint];
      const dist = localPlayer.position.distanceTo(cp.position);
      if (dist < cp.radius) {
        this.advanceCheckpoint(localPlayer.id);
      }
    }

    // Update ring visuals (hide passed checkpoints for local player)
    for (let i = 0; i < this.rings.length; i++) {
      this.rings[i].visible = i >= this.localCheckpoint;

      // Highlight next checkpoint
      if (i === this.localCheckpoint) {
        const pulse = 1 + Math.sin(this.elapsed * 4) * 0.15;
        this.rings[i].scale.setScalar(pulse);
      } else {
        this.rings[i].scale.setScalar(1);
      }
    }

    // Rotate all rings slowly
    for (const ring of this.rings) {
      ring.rotation.z += 0.5 * dt;
    }

    // Update guide line to next checkpoint
    this.updateGuideLine(localPlayer);

    // Update player scores
    for (const p of this.players) {
      const state = this.playerStates.get(p.id);
      if (state) p.score = state.currentCheckpoint;
    }

    // Check if first player finished
    if (!this.raceFinished) {
      for (const [, state] of this.playerStates) {
        if (state.completedAt >= 0) {
          this.raceFinished = true;
          break;
        }
      }
    }
  }

  onEnd(): PvPResults {
    this.context.eventBus.off('checkpoint-reached', this.handleCheckpoint);

    // Sort: finished players first (by time), then by checkpoint count
    const sorted = [...this.players].sort((a, b) => {
      const sa = this.playerStates.get(a.id)!;
      const sb = this.playerStates.get(b.id)!;

      // Both finished: sort by completion time
      if (sa.completedAt >= 0 && sb.completedAt >= 0) {
        return sa.completedAt - sb.completedAt;
      }
      // Finished beats unfinished
      if (sa.completedAt >= 0) return -1;
      if (sb.completedAt >= 0) return 1;
      // Neither finished: most checkpoints wins
      return sb.currentCheckpoint - sa.currentCheckpoint;
    });

    const rewards = [PVP.RACE_1ST_REWARD, PVP.RACE_2ND_REWARD, PVP.RACE_3RD_REWARD];
    const standings: PvPStanding[] = sorted.map((p, i) => {
      const state = this.playerStates.get(p.id)!;
      const finished = state.completedAt >= 0;
      const reward = rewards[i] ?? PVP.RACE_PARTICIPATION_REWARD;

      return {
        player: p,
        rank: i + 1,
        score: state.currentCheckpoint,
        reward,
        label: finished
          ? `Finished in ${state.completedAt.toFixed(1)}s`
          : `${state.currentCheckpoint}/${this.checkpoints.length} checkpoints`,
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
    const localPlayer = this.players.find(p => p.isLocal);
    const localState = localPlayer ? this.playerStates.get(localPlayer.id) : null;

    // Compute rank
    const sorted = [...this.players].sort((a, b) => {
      const sa = this.playerStates.get(a.id);
      const sb = this.playerStates.get(b.id);
      return (sb?.currentCheckpoint || 0) - (sa?.currentCheckpoint || 0);
    });
    const rank = sorted.findIndex(p => p.isLocal) + 1;
    const ordinal = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;

    return {
      checkpoints: this.checkpoints.map(cp => ({
        x: cp.position.x, y: cp.position.y, z: cp.position.z,
      })),
      totalCheckpoints: this.checkpoints.length,
      localCheckpoint: localState?.currentCheckpoint || 0,
      localRank: ordinal,
      routeName: this.routeName,
    };
  }

  private advanceCheckpoint(playerId: string): void {
    const state = this.playerStates.get(playerId);
    if (!state) return;

    state.currentCheckpoint++;

    // Check if finished
    if (state.currentCheckpoint >= this.checkpoints.length) {
      state.completedAt = this.elapsed;
    }

    // Update local checkpoint tracking
    const localPlayer = this.players.find(p => p.isLocal);
    if (localPlayer && playerId === localPlayer.id) {
      this.localCheckpoint = state.currentCheckpoint;
    }

    this.context.eventBus.emit('score-update', {
      type: 'checkpoint',
      playerId,
      checkpoint: state.currentCheckpoint,
      total: this.checkpoints.length,
    });
  }

  private handleCheckpoint = (data: { playerId: string; checkpointIndex: number }): void => {
    // External checkpoint events (from bots or multiplayer)
    const state = this.playerStates.get(data.playerId);
    if (state && data.checkpointIndex === state.currentCheckpoint) {
      this.advanceCheckpoint(data.playerId);
    }
  };

  private createRings(): void {
    const ringGeo = new THREE.TorusGeometry(PVP.RACE_RING_RADIUS, 0.5, 8, 24);

    for (let i = 0; i < this.checkpoints.length; i++) {
      const cp = this.checkpoints[i];
      const isLast = i === this.checkpoints.length - 1;

      const group = new THREE.Group();

      // Main ring
      const mat = new THREE.MeshStandardMaterial({
        color: isLast ? 0xffd700 : 0x00ff88,
        emissive: isLast ? 0xffd700 : 0x00ff88,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.7,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      group.add(mesh);

      // Inner glow
      const glowGeo = new THREE.SphereGeometry(PVP.RACE_RING_RADIUS * 0.4, 8, 8);
      const glowMat = new THREE.MeshBasicMaterial({
        color: isLast ? 0xffd700 : 0x00ff88,
        transparent: true,
        opacity: 0.2,
      });
      group.add(new THREE.Mesh(glowGeo, glowMat));

      // Checkpoint number
      // (Number displayed via sprite would be complex; using point light color instead)
      const light = new THREE.PointLight(isLast ? 0xffd700 : 0x00ff88, 0.8, PVP.RACE_RING_RADIUS * 3);
      group.add(light);

      group.position.copy(cp.position);
      this.ringGroup.add(group);
      this.rings.push(group);
    }
  }

  private createGuideLine(): void {
    // Dashed line from player to next checkpoint
    this.guideLineGeo = new THREE.BufferGeometry();
    this.guideLineGeo.setAttribute('position',
      new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));

    const mat = new THREE.LineDashedMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.3,
      dashSize: 2,
      gapSize: 1,
    });
    this.guideLine = new THREE.Line(this.guideLineGeo, mat);
    this.guideLine.visible = false;
    this.ringGroup.add(this.guideLine);
  }

  private updateGuideLine(localPlayer: PvPPlayer | undefined): void {
    if (!this.guideLine || !this.guideLineGeo || !localPlayer) return;

    if (this.localCheckpoint >= this.checkpoints.length) {
      this.guideLine.visible = false;
      return;
    }

    const nextCp = this.checkpoints[this.localCheckpoint];
    const positions = this.guideLineGeo.getAttribute('position') as THREE.BufferAttribute;
    positions.setXYZ(0, localPlayer.position.x, localPlayer.position.y, localPlayer.position.z);
    positions.setXYZ(1, nextCp.position.x, nextCp.position.y, nextCp.position.z);
    positions.needsUpdate = true;
    this.guideLineGeo.computeBoundingSphere();
    this.guideLine.computeLineDistances();
    this.guideLine.visible = true;
  }

  private cleanupVisuals(): void {
    this.ringGroup.parent?.remove(this.ringGroup);
    this.ringGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (obj.material instanceof THREE.Material) obj.material.dispose();
      }
      if (obj instanceof THREE.Line) {
        obj.geometry?.dispose();
        if (obj.material instanceof THREE.Material) obj.material.dispose();
      }
    });
    this.rings = [];
    this.guideLine = null;
    this.guideLineGeo = null;
    this.ringGroup = new THREE.Group();
  }

  dispose(): void {
    this.cleanupVisuals();
    this.context?.eventBus.off('checkpoint-reached', this.handleCheckpoint);
  }
}
