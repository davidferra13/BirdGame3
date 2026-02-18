import * as THREE from 'three';
import { PoopManager } from '../entities/PoopManager';
import { NPCManager } from '../entities/NPCManager';
import { ScoreSystem } from './ScoreSystem';
import { PlayerStateMachine } from './PlayerStateMachine';
import { CoinPopupManager } from '../ui/CoinPopup';
import { VFXSystem } from './VFXSystem';
import { ThirdPersonCamera } from '../camera/ThirdPersonCamera';
import { Bird } from '../entities/Bird';
import { SpatialGrid } from '../utils/SpatialGrid';
import { NPC_CONFIG, PVP } from '../utils/Constants';
import type { NPC } from '../entities/NPC';
import type { PvPPlayer } from '../pvp/PvPMode';
import type { Poop } from '../entities/Poop';

export interface ScatterResult {
  npcs: NPC[];
  centerPos: THREE.Vector3;
}

export interface PvPPoopHit {
  shooterId: string;
  targetId: string;
  position: THREE.Vector3;
}

export interface PvPStatueHit {
  playerId: string;
  position: THREE.Vector3;
  accuracy: number;
}

export class CollisionSystem {
  // PHASE 4: Spatial grid for O(n) collision detection instead of O(n²)
  private npcGrid = new SpatialGrid<NPC>(50);

  // Reusable scratch vectors to avoid per-frame allocations
  private _tmpHitPos = new THREE.Vector3();
  private _tmpImpactPos = new THREE.Vector3();

  // Reusable scatter result to avoid per-frame allocation
  private _scatterResult: ScatterResult = { npcs: [], centerPos: new THREE.Vector3() };

  /** Detect bird body colliding with NPCs — scatter them like bowling pins */
  checkBirdScatter(bird: Bird, npcManager: NPCManager, vfx?: VFXSystem): ScatterResult {
    const result = this._scatterResult;
    result.npcs.length = 0;
    result.centerPos.set(0, 0, 0);
    const birdPos = bird.controller.position;
    const birdSpeed = bird.controller.forwardSpeed;
    const birdForward = bird.controller.getForward();

    // Only scatter when flying (not grounded, not super slow)
    if (bird.controller.isGrounded || birdSpeed < 8) return result;

    const radiusSq = NPC_CONFIG.SCATTER_RADIUS * NPC_CONFIG.SCATTER_RADIUS;

    // Query nearby NPCs using the spatial grid (already rebuilt in update())
    const nearbyNPCs = this.npcGrid.queryRadius(birdPos, NPC_CONFIG.SCATTER_RADIUS + 2);

    for (const npc of nearbyNPCs) {
      if (npc.isHit || npc.isScattered || npc.isGrabbed || npc.shouldDespawn) continue;
      if (npc.scatterCooldown > 0) continue;

      const distSq = birdPos.distanceToSquared(npc.mesh.position);
      if (distSq < radiusSq) {
        npc.onScatter(birdForward, birdSpeed);
        result.npcs.push(npc);
        result.centerPos.add(npc.mesh.position);
      }
    }

    // Compute average position for VFX
    if (result.npcs.length > 0) {
      result.centerPos.divideScalar(result.npcs.length);

      if (vfx) {
        vfx.spawnScatterBurst(result.centerPos, birdSpeed, result.npcs.length);
      }
    }

    return result;
  }

  update(
    poopManager: PoopManager,
    npcManager: NPCManager,
    scoreSystem: ScoreSystem,
    playerState: PlayerStateMachine,
    coinPopups: CoinPopupManager,
    bird: Bird,
    vfx?: VFXSystem,
    camera?: ThirdPersonCamera,
  ): void {
    if (!playerState.canScore) return;

    // PHASE 4: Rebuild spatial grid each frame with active NPCs
    // This is cheap - O(n) for ~40 NPCs
    this.npcGrid.clear();
    for (const npc of npcManager.npcs) {
      if (!npc.isHit && !npc.isGrabbed && !npc.shouldDespawn) {
        this.npcGrid.insert(npc.mesh.position, npc);
      }
    }

    const activePoops = poopManager.getActivePoops();

    for (const poop of activePoops) {
      const poopPos = poop.mesh.position;

      // PHASE 4: Query only nearby NPCs (10-unit radius)
      // Typically returns 1-5 NPCs instead of all 40
      const nearbyNPCs = this.npcGrid.queryRadius(poopPos, 10);

      for (const npc of nearbyNPCs) {
        // Use squared distance for faster comparison (avoid sqrt)
        const distSq = poopPos.distanceToSquared(npc.mesh.position);
        const hitRadiusSq = (npc.boundingRadius + 0.3) ** 2;

        if (distSq < hitRadiusSq) {
          this._tmpHitPos.copy(npc.mesh.position);
          this._tmpHitPos.y += 2;
          const hitPos = this._tmpHitPos;

          this._tmpImpactPos.copy(poop.mesh.position);
          const impactPos = this._tmpImpactPos;
          const hitResult = npc.onHit();
          const { coins, heat, multiplierBonus = 0 } = hitResult;
          const npcType = npc.npcType;
          poop.kill();
          poopManager.spawnImpact(impactPos);
          poopManager.spawnSplatDecal(impactPos);

          // Alert nearby NPCs to flee
          npcManager.alertNearby(impactPos);

          // Apply performer multiplier bonus before scoring
          if (multiplierBonus > 0) {
            scoreSystem.multiplier += multiplierBonus;
          }

          scoreSystem.onHitWithValues(coins, heat, npcType);

          coinPopups.spawn(hitPos, scoreSystem.lastHitPoints, scoreSystem.lastHitMultiplier);

          // IMPROVEMENT #4: Enhanced hit feedback with momentum
          const speed = bird.controller.forwardSpeed;
          const altitude = bird.controller.position.y;
          const momentumFactor = (speed / 80) * 0.7 + (altitude / 100) * 0.3;

          if (vfx) {
            vfx.spawnHitImpact(impactPos, coins, speed, altitude);
          }

          if (camera) {
            // Screen shake scales with momentum + coin value + streak
            const baseShake = 0.05 + Math.min(coins / 100, 0.2) + (scoreSystem.streak * 0.01);
            const shakeIntensity = baseShake + momentumFactor * 0.3;
            camera.triggerShake(shakeIntensity, 0.15);
          }

          break;
        }
      }
    }
  }

  /**
   * Check if active poops hit any PvP player (for Poop Tag mode).
   * Returns array of hits: which player's poop hit which other player.
   */
  checkPvPPoopHits(
    activePoops: Poop[],
    localPlayerId: string,
    pvpPlayers: PvPPlayer[],
    hitRadius: number = 3,
  ): PvPPoopHit[] {
    const hits: PvPPoopHit[] = [];

    for (const poop of activePoops) {
      if (!poop.alive) continue;
      const poopPos = poop.mesh.position;
      const hitRadiusSq = hitRadius * hitRadius;

      for (const player of pvpPlayers) {
        // Don't self-hit (poop from local player hitting local player)
        if (player.id === localPlayerId) continue;

        const distSq = poopPos.distanceToSquared(player.position);
        if (distSq < hitRadiusSq) {
          hits.push({
            shooterId: localPlayerId,
            targetId: player.id,
            position: poopPos.clone(),
          });
          poop.kill();
          break;
        }
      }
    }

    return hits;
  }

  /**
   * Check if active poops hit a statue target position (for Poop Cover mode).
   * Returns array of hits with accuracy info.
   */
  checkPvPStatueHits(
    activePoops: Poop[],
    localPlayerId: string,
    statuePosition: THREE.Vector3,
    hitRadius: number = PVP.COVER_HIT_RADIUS,
  ): PvPStatueHit[] {
    const hits: PvPStatueHit[] = [];

    for (const poop of activePoops) {
      if (!poop.alive) continue;
      const poopPos = poop.mesh.position;

      const dist = poopPos.distanceTo(statuePosition);
      if (dist < hitRadius) {
        const accuracy = 1 - (dist / hitRadius); // 1 = center, 0 = edge
        hits.push({
          playerId: localPlayerId,
          position: poopPos.clone(),
          accuracy,
        });
        poop.kill();
      }
    }

    return hits;
  }
}
