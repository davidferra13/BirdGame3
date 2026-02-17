/**
 * PvPBot - Simple AI bird for solo/practice PvP play.
 * Flies around the city following waypoints with mode-specific behavior.
 * Uses an event callback to relay game events (checkpoints, hits, tag transfers)
 * back to PvPManager so they're properly tracked by the active mode.
 */

import * as THREE from 'three';
import { PvPPlayer } from './PvPMode';
import { PVP, FLIGHT, WORLD } from '../utils/Constants';

const BOT_BIRD_GEO = new THREE.ConeGeometry(0.6, 1.8, 6);
const WAYPOINT_REACH_DIST_SQ = 25; // 5 units squared
const TAG_TRANSFER_DIST_SQ = 25;   // ~5 units — proximity to tag another player

export type BotEventCallback = (type: string, data: any) => void;

export class PvPBot {
  readonly player: PvPPlayer;
  readonly mesh: THREE.Group;
  private bodyMesh: THREE.Mesh;

  private waypoint = new THREE.Vector3();
  private velocity = new THREE.Vector3();
  private forward = new THREE.Vector3(0, 0, -1);
  private speed = FLIGHT.BASE_SPEED * PVP.BOT_SPEED_FACTOR;
  private reactionTimer = 0;

  // Mode-specific
  private modeId = '';
  private modeData: any = {};

  // Event callback for relaying game events to PvPManager
  private eventCallback: BotEventCallback | null = null;

  // Other players (refreshed each frame for AI decisions)
  private otherPlayers: PvPPlayer[] = [];

  // Tag-specific
  private chaseTargetId = '';

  // Race-specific
  private currentCheckpoint = 0;
  private checkpoints: THREE.Vector3[] = [];

  // Cover-specific
  private statuePosition: THREE.Vector3 | null = null;
  private poopCooldown = 0;

  constructor(player: PvPPlayer, scene: THREE.Scene) {
    this.player = player;

    // Create a simple bird mesh with player color tint
    this.mesh = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: player.color,
      emissive: player.color,
      emissiveIntensity: 0.3,
    });
    this.bodyMesh = new THREE.Mesh(BOT_BIRD_GEO, mat);
    this.bodyMesh.rotation.x = Math.PI / 2; // Point cone forward
    this.mesh.add(this.bodyMesh);

    // Small wings
    const wingGeo = new THREE.BoxGeometry(2.4, 0.1, 0.8);
    const wingMat = new THREE.MeshStandardMaterial({ color: player.color });
    const wings = new THREE.Mesh(wingGeo, wingMat);
    wings.position.y = 0.1;
    this.mesh.add(wings);

    this.mesh.position.copy(player.position);
    scene.add(this.mesh);

    this.pickRandomWaypoint();
  }

  /** Set callback for relaying game events to PvPManager. */
  setEventCallback(cb: BotEventCallback): void {
    this.eventCallback = cb;
  }

  /** Receive fresh mode data and player positions each frame. */
  updateModeData(data: any, players: PvPPlayer[]): void {
    this.modeData = data;
    this.otherPlayers = players.filter(p => p.id !== this.player.id);
  }

  setMode(modeId: string, modeData: any): void {
    this.modeId = modeId;
    this.modeData = modeData;

    if (modeId === 'race' && modeData.checkpoints) {
      this.checkpoints = modeData.checkpoints.map((cp: any) =>
        new THREE.Vector3(cp.x ?? cp.position?.x ?? 0, cp.y ?? cp.position?.y ?? 50, cp.z ?? cp.position?.z ?? 0)
      );
      this.currentCheckpoint = 0;
    }

    if (modeId === 'poop-cover' && modeData.statuePosition) {
      this.statuePosition = new THREE.Vector3(
        modeData.statuePosition.x,
        modeData.statuePosition.y,
        modeData.statuePosition.z,
      );
    }
  }

  update(dt: number): void {
    this.reactionTimer -= dt;
    this.poopCooldown -= dt;

    switch (this.modeId) {
      case 'poop-tag':
        this.updateTagBehavior(dt);
        break;
      case 'race':
        this.updateRaceBehavior(dt);
        break;
      case 'poop-cover':
        this.updateCoverBehavior(dt);
        break;
      default:
        this.updateDefaultBehavior(dt);
        break;
    }

    // Apply movement
    this.mesh.position.copy(this.player.position);
    this.mesh.lookAt(this.player.position.clone().add(this.forward));

    // Wing flap animation
    const wings = this.mesh.children[1];
    if (wings) {
      wings.rotation.z = Math.sin(Date.now() * 0.01) * 0.3;
    }
  }

  private updateDefaultBehavior(dt: number): void {
    this.flyToward(this.waypoint, dt);

    if (this.player.position.distanceToSquared(this.waypoint) < WAYPOINT_REACH_DIST_SQ) {
      this.pickRandomWaypoint();
    }
  }

  private updateTagBehavior(dt: number): void {
    const isTagged = this.modeData.taggedPlayerId === this.player.id;

    if (isTagged) {
      // Chase nearest non-tagged player
      if (this.reactionTimer <= 0) {
        this.reactionTimer = PVP.BOT_REACTION_TIME;
        const target = this.findNearestPlayer();
        if (target) {
          this.waypoint.copy(target);
        }
      }
      this.speed = FLIGHT.BASE_SPEED * PVP.BOT_SPEED_FACTOR * 1.1;

      // Check if close enough to tag someone
      if (this.chaseTargetId && this.eventCallback) {
        const target = this.otherPlayers.find(p => p.id === this.chaseTargetId);
        if (target) {
          const distSq = this.player.position.distanceToSquared(target.position);
          if (distSq < TAG_TRANSFER_DIST_SQ) {
            this.eventCallback('poop-hit-player', {
              shooterId: this.player.id,
              targetId: this.chaseTargetId,
            });
            this.chaseTargetId = '';
            this.reactionTimer = PVP.BOT_REACTION_TIME * 2; // Pause after tagging
          }
        }
      }
    } else {
      // Flee from tagged player
      if (this.reactionTimer <= 0) {
        this.reactionTimer = PVP.BOT_REACTION_TIME * 1.5;
        this.pickFleeWaypoint();
      }
      this.speed = FLIGHT.BASE_SPEED * PVP.BOT_SPEED_FACTOR;
    }

    this.flyToward(this.waypoint, dt);

    if (this.player.position.distanceToSquared(this.waypoint) < WAYPOINT_REACH_DIST_SQ) {
      if (isTagged) {
        const target = this.findNearestPlayer();
        if (target) this.waypoint.copy(target);
      } else {
        this.pickFleeWaypoint();
      }
    }
  }

  private updateRaceBehavior(dt: number): void {
    if (this.currentCheckpoint >= this.checkpoints.length) {
      this.updateDefaultBehavior(dt);
      return;
    }

    const target = this.checkpoints[this.currentCheckpoint];
    // Add slight randomization so bots aren't perfect
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 3,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 3,
    );
    this.waypoint.copy(target).add(offset);
    this.speed = FLIGHT.BASE_SPEED * PVP.BOT_SPEED_FACTOR * (0.9 + Math.random() * 0.2);

    this.flyToward(this.waypoint, dt);

    if (this.player.position.distanceToSquared(target) < (PVP.RACE_RING_RADIUS * PVP.RACE_RING_RADIUS)) {
      // Relay checkpoint through PvPManager so RaceMode tracks it
      if (this.eventCallback) {
        this.eventCallback('checkpoint', {
          playerId: this.player.id,
          checkpointIndex: this.currentCheckpoint,
        });
      }
      this.currentCheckpoint++;
    }
  }

  private updateCoverBehavior(dt: number): void {
    if (!this.statuePosition) {
      this.updateDefaultBehavior(dt);
      return;
    }

    // Fly in circles above the statue and "drop poop" periodically
    const time = Date.now() * 0.001;
    const circleRadius = 15 + Math.sin(time * 0.3) * 5;
    const angle = time * 0.8 + (parseInt(this.player.id.replace(/\D/g, '')) || 0) * 1.5;
    this.waypoint.set(
      this.statuePosition.x + Math.cos(angle) * circleRadius,
      this.statuePosition.y + 15 + Math.sin(time * 0.5) * 5,
      this.statuePosition.z + Math.sin(angle) * circleRadius,
    );

    this.flyToward(this.waypoint, dt);

    // Simulate poop hits — relay through PvPManager so PoopCoverMode tracks them
    if (this.poopCooldown <= 0) {
      this.poopCooldown = 1.5 + Math.random() * 2;
      const dist = this.player.position.distanceTo(this.statuePosition);
      if (dist < PVP.COVER_HIT_RADIUS * 2 && Math.random() < PVP.BOT_ACCURACY) {
        if (this.eventCallback) {
          const accuracy = 1 - (dist / (PVP.COVER_HIT_RADIUS * 2));
          this.eventCallback('statue-hit', {
            playerId: this.player.id,
            accuracy,
            hitPosition: this.player.position.clone(),
          });
        }
      }
    }
  }

  private flyToward(target: THREE.Vector3, dt: number): void {
    const dir = new THREE.Vector3().subVectors(target, this.player.position);
    const dist = dir.length();
    if (dist > 0.1) {
      dir.normalize();
      // Smooth turning
      this.forward.lerp(dir, Math.min(1, 3 * dt));
      this.forward.normalize();
    }

    this.velocity.copy(this.forward).multiplyScalar(this.speed);
    this.player.position.addScaledVector(this.velocity, dt);

    // Keep within world bounds
    const halfBound = WORLD.BOUNDARY_SOFT_EDGE;
    this.player.position.x = Math.max(-halfBound, Math.min(halfBound, this.player.position.x));
    this.player.position.z = Math.max(-halfBound, Math.min(halfBound, this.player.position.z));
    this.player.position.y = Math.max(10, Math.min(FLIGHT.MAX_ALTITUDE - 20, this.player.position.y));
  }

  private pickRandomWaypoint(): void {
    const range = 300;
    this.waypoint.set(
      (Math.random() - 0.5) * range,
      30 + Math.random() * 80,
      (Math.random() - 0.5) * range,
    );
  }

  private pickFleeWaypoint(): void {
    // Flee away from the tagged player if we know where they are
    const taggedPlayer = this.otherPlayers.find(p => p.id === this.modeData?.taggedPlayerId);
    if (taggedPlayer) {
      const fleeDir = new THREE.Vector3()
        .subVectors(this.player.position, taggedPlayer.position)
        .normalize();
      const dist = 60 + Math.random() * 80;
      this.waypoint.set(
        this.player.position.x + fleeDir.x * dist,
        30 + Math.random() * 80,
        this.player.position.z + fleeDir.z * dist,
      );
    } else {
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 80;
      this.waypoint.set(
        this.player.position.x + Math.cos(angle) * dist,
        30 + Math.random() * 80,
        this.player.position.z + Math.sin(angle) * dist,
      );
    }
  }

  private findNearestPlayer(): THREE.Vector3 | null {
    let closest: PvPPlayer | null = null;
    let closestDistSq = Infinity;
    for (const p of this.otherPlayers) {
      const dSq = this.player.position.distanceToSquared(p.position);
      if (dSq < closestDistSq) {
        closestDistSq = dSq;
        closest = p;
      }
    }
    if (closest) {
      this.chaseTargetId = closest.id;
      return closest.position.clone();
    }
    return null;
  }

  getRaceCheckpoint(): number {
    return this.currentCheckpoint;
  }

  dispose(): void {
    this.mesh.parent?.remove(this.mesh);
    // Dispose geometries/materials
    this.mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (obj.material instanceof THREE.Material) obj.material.dispose();
      }
    });
  }
}
