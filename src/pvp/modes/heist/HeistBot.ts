/**
 * HeistBot - AI opponent for Heist mode solo play.
 * State machine: CHASE_TROPHY -> DELIVER -> ATTACK_CARRIER
 */

import * as THREE from 'three';
import { HEIST, FLIGHT, WORLD } from '../../../utils/Constants';
import type { PvPPlayer } from '../../PvPMode';

type BotState = 'chase_trophy' | 'deliver' | 'attack_carrier' | 'idle';

export type HeistBotEventCallback = (type: string, data: any) => void;

export class HeistBot {
  readonly player: PvPPlayer;
  readonly mesh: THREE.Group;

  private botState: BotState = 'idle';
  private waypoint = new THREE.Vector3();
  private forward = new THREE.Vector3(0, 0, -1);
  private speed: number;
  private reactionTimer = 0;

  private eventCallback: HeistBotEventCallback | null = null;

  // Mode data references (refreshed each frame)
  private trophyPosition = new THREE.Vector3();
  private trophyCarrierId: string | null = null;
  private pedestalPosition = new THREE.Vector3();
  private opponentPosition = new THREE.Vector3();
  private isCarryingTrophy = false;

  constructor(player: PvPPlayer, scene: THREE.Scene) {
    this.player = player;
    this.speed = FLIGHT.BASE_SPEED * HEIST.BOT_SPEED_UTILIZATION;

    // Simple bird mesh with player color
    this.mesh = new THREE.Group();

    const bodyGeo = new THREE.ConeGeometry(0.6, 1.8, 6);
    const mat = new THREE.MeshStandardMaterial({
      color: player.color,
      emissive: player.color,
      emissiveIntensity: 0.3,
    });
    const body = new THREE.Mesh(bodyGeo, mat);
    body.rotation.x = Math.PI / 2;
    this.mesh.add(body);

    const wingGeo = new THREE.BoxGeometry(2.4, 0.1, 0.8);
    const wingMat = new THREE.MeshStandardMaterial({ color: player.color });
    const wings = new THREE.Mesh(wingGeo, wingMat);
    wings.position.y = 0.1;
    this.mesh.add(wings);

    this.mesh.position.copy(player.position);
    scene.add(this.mesh);
  }

  setEventCallback(cb: HeistBotEventCallback): void {
    this.eventCallback = cb;
  }

  /** Update mode data each frame from HeistMode */
  updateModeData(data: {
    trophyPosition: THREE.Vector3;
    trophyCarrierId: string | null;
    pedestalPosition: THREE.Vector3;
    opponentPosition: THREE.Vector3;
    botCarryingTrophy: boolean;
  }): void {
    this.trophyPosition.copy(data.trophyPosition);
    this.trophyCarrierId = data.trophyCarrierId;
    this.pedestalPosition.copy(data.pedestalPosition);
    this.opponentPosition.copy(data.opponentPosition);
    this.isCarryingTrophy = data.botCarryingTrophy;
  }

  update(dt: number): void {
    this.reactionTimer -= dt;

    // Decide state
    if (this.reactionTimer <= 0) {
      this.reactionTimer = HEIST.BOT_REACTION_DELAY;
      this.decideState();
    }

    // Execute state behavior
    switch (this.botState) {
      case 'chase_trophy':
        this.executeChaseTrophy(dt);
        break;
      case 'deliver':
        this.executeDeliver(dt);
        break;
      case 'attack_carrier':
        this.executeAttackCarrier(dt);
        break;
      case 'idle':
        this.executeIdle(dt);
        break;
    }

    // Update visual mesh
    this.mesh.position.copy(this.player.position);
    this.mesh.lookAt(this.player.position.clone().add(this.forward));

    // Wing flap
    const wings = this.mesh.children[1];
    if (wings) {
      wings.rotation.z = Math.sin(Date.now() * 0.01) * 0.3;
    }
  }

  private decideState(): void {
    if (this.isCarryingTrophy) {
      // We have the trophy — deliver it
      this.botState = 'deliver';
    } else if (this.trophyCarrierId && this.trophyCarrierId !== this.player.id) {
      // Opponent has the trophy — attack them
      if (Math.random() < HEIST.BOT_SLAM_ACCURACY) {
        this.botState = 'attack_carrier';
      } else {
        // Sometimes fly indirect to be less predictable
        this.botState = 'chase_trophy';
      }
    } else {
      // Trophy is idle — chase it
      this.botState = 'chase_trophy';
    }
  }

  private executeChaseTrophy(dt: number): void {
    // Add imprecision based on BOT_FLIGHT_PRECISION
    const imprecision = (1 - HEIST.BOT_FLIGHT_PRECISION) * 10;
    this.waypoint.copy(this.trophyPosition);
    this.waypoint.x += (Math.random() - 0.5) * imprecision;
    this.waypoint.z += (Math.random() - 0.5) * imprecision;

    this.speed = FLIGHT.BASE_SPEED * HEIST.BOT_SPEED_UTILIZATION;
    this.flyToward(this.waypoint, dt);

    // Check if close enough to grab
    const distSq = this.player.position.distanceToSquared(this.trophyPosition);
    if (distSq < 36) { // ~6 units
      this.eventCallback?.('heist-grab', { playerId: this.player.id });
    }
  }

  private executeDeliver(dt: number): void {
    this.waypoint.copy(this.pedestalPosition);
    this.speed = FLIGHT.BASE_SPEED * HEIST.BOT_SPEED_UTILIZATION * 1.05; // Slightly faster when delivering
    this.flyToward(this.waypoint, dt);

    // Check if reached pedestal
    const distSq = this.player.position.distanceToSquared(this.pedestalPosition);
    if (distSq < HEIST.PEDESTAL_TRIGGER_RADIUS * HEIST.PEDESTAL_TRIGGER_RADIUS) {
      this.eventCallback?.('heist-score', { playerId: this.player.id });
    }
  }

  private executeAttackCarrier(dt: number): void {
    // Fly toward the carrier (opponent) at high speed for a slam
    this.waypoint.copy(this.opponentPosition);

    // Predict where opponent will be (lead the target slightly)
    const leadFactor = 0.5;
    const toOpponent = new THREE.Vector3().subVectors(this.opponentPosition, this.player.position);
    if (toOpponent.length() > 20) {
      // Add lead offset when far away
      this.waypoint.addScaledVector(toOpponent.normalize(), leadFactor * 10);
    }

    // Fly fast for slam (need to be above speed threshold)
    this.speed = FLIGHT.MAX_SPEED * 0.9;
    this.flyToward(this.waypoint, dt);

    // Check for slam collision
    const distSq = this.player.position.distanceToSquared(this.opponentPosition);
    if (distSq < HEIST.SLAM_COLLISION_RADIUS * HEIST.SLAM_COLLISION_RADIUS) {
      this.eventCallback?.('heist-slam', {
        attackerId: this.player.id,
        speed: this.speed,
      });
    }
  }

  private executeIdle(dt: number): void {
    // Drift toward center
    this.waypoint.set(0, HEIST.TROPHY_HOVER_HEIGHT, 0);
    this.speed = FLIGHT.BASE_SPEED * 0.5;
    this.flyToward(this.waypoint, dt);
  }

  private flyToward(target: THREE.Vector3, dt: number): void {
    const dir = new THREE.Vector3().subVectors(target, this.player.position);
    const dist = dir.length();
    if (dist > 0.1) {
      dir.normalize();
      this.forward.lerp(dir, Math.min(1, 3 * dt));
      this.forward.normalize();
    }

    const velocity = this.forward.clone().multiplyScalar(this.speed);
    this.player.position.addScaledVector(velocity, dt);

    // Clamp to world bounds
    const halfBound = WORLD.BOUNDARY_SOFT_EDGE;
    this.player.position.x = Math.max(-halfBound, Math.min(halfBound, this.player.position.x));
    this.player.position.z = Math.max(-halfBound, Math.min(halfBound, this.player.position.z));
    this.player.position.y = Math.max(10, Math.min(FLIGHT.MAX_ALTITUDE - 20, this.player.position.y));
  }

  dispose(): void {
    this.mesh.parent?.remove(this.mesh);
    this.mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (obj.material instanceof THREE.Material) obj.material.dispose();
      }
    });
  }
}
