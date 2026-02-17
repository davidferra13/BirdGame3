/**
 * HeistSlamSystem - Body-slam detection, knockback physics, cooldown tracking.
 * Only activates when one player is carrying the trophy and the other hits them at speed.
 */

import * as THREE from 'three';
import { HEIST } from '../../../utils/Constants';
import { FLIGHT } from '../../../utils/Constants';
import type { PvPPlayer } from '../../PvPMode';

export interface SlamResult {
  attackerId: string;
  carrierId: string;
  impactPoint: THREE.Vector3;
  carrierKnockback: THREE.Vector3;
  attackerRecoil: THREE.Vector3;
}

export class HeistSlamSystem {
  // Cooldown per player (playerId -> remaining seconds)
  private cooldowns = new Map<string, number>();

  // Knockback state per player (playerId -> { velocity, timer })
  private knockbackStates = new Map<string, { velocity: THREE.Vector3; timer: number }>();

  /** Check for a valid slam between two players */
  checkSlam(
    attacker: PvPPlayer,
    carrier: PvPPlayer,
    attackerSpeed: number,
  ): SlamResult | null {
    // Attacker must not be on cooldown
    if ((this.cooldowns.get(attacker.id) ?? 0) > 0) return null;

    // Check speed threshold
    const speedThreshold = FLIGHT.MAX_SPEED * HEIST.SLAM_SPEED_THRESHOLD;
    if (attackerSpeed < speedThreshold) return null;

    // Check collision radius
    const dx = attacker.position.x - carrier.position.x;
    const dy = attacker.position.y - carrier.position.y;
    const dz = attacker.position.z - carrier.position.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    const radiusSq = HEIST.SLAM_COLLISION_RADIUS * HEIST.SLAM_COLLISION_RADIUS;

    if (distSq > radiusSq) return null;

    // Valid slam!
    const impactPoint = new THREE.Vector3().lerpVectors(
      attacker.position, carrier.position, 0.5,
    );

    // Knockback direction: from attacker toward carrier
    const knockDir = new THREE.Vector3()
      .subVectors(carrier.position, attacker.position)
      .normalize();

    const carrierKnockback = knockDir.clone().multiplyScalar(HEIST.SLAM_KNOCKBACK_FORCE);
    carrierKnockback.y = Math.abs(carrierKnockback.y) + 10; // Slight upward pop

    // Attacker recoil: opposite direction
    const attackerRecoil = knockDir.clone().multiplyScalar(-HEIST.SLAM_ATTACKER_RECOIL);
    attackerRecoil.y = 5; // Slight upward bounce

    // Apply cooldown on attacker
    this.cooldowns.set(attacker.id, HEIST.SLAM_COOLDOWN);

    // Apply knockback states
    this.knockbackStates.set(carrier.id, {
      velocity: carrierKnockback.clone(),
      timer: HEIST.SLAM_KNOCKBACK_DURATION,
    });
    this.knockbackStates.set(attacker.id, {
      velocity: attackerRecoil.clone(),
      timer: 0.2, // Brief recoil
    });

    return {
      attackerId: attacker.id,
      carrierId: carrier.id,
      impactPoint,
      carrierKnockback,
      attackerRecoil,
    };
  }

  /** Get remaining slam cooldown for a player (0 = ready) */
  getCooldown(playerId: string): number {
    return this.cooldowns.get(playerId) ?? 0;
  }

  /** Is the player currently in knockback? */
  isKnockedBack(playerId: string): boolean {
    const state = this.knockbackStates.get(playerId);
    return state !== null && state !== undefined && state.timer > 0;
  }

  /** Get knockback velocity to apply to a player's position */
  getKnockbackVelocity(playerId: string): THREE.Vector3 | null {
    const state = this.knockbackStates.get(playerId);
    if (!state || state.timer <= 0) return null;
    return state.velocity;
  }

  update(dt: number): void {
    // Update cooldowns
    for (const [id, cooldown] of this.cooldowns) {
      const newVal = cooldown - dt;
      if (newVal <= 0) {
        this.cooldowns.delete(id);
      } else {
        this.cooldowns.set(id, newVal);
      }
    }

    // Update knockback states
    for (const [id, state] of this.knockbackStates) {
      state.timer -= dt;
      // Decay knockback velocity
      state.velocity.multiplyScalar(Math.max(0, 1 - dt * 3));
      if (state.timer <= 0) {
        this.knockbackStates.delete(id);
      }
    }
  }

  reset(): void {
    this.cooldowns.clear();
    this.knockbackStates.clear();
  }
}
