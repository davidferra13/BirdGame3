import * as THREE from 'three';
import { Bird } from '../entities/Bird';
import { NPC } from '../entities/NPC';
import { NPCManager } from '../entities/NPCManager';
import { PoopManager } from '../entities/PoopManager';
import { ScoreSystem } from './ScoreSystem';
import { CoinPopupManager } from '../ui/CoinPopup';
import { VFXSystem } from './VFXSystem';
import { AudioSystem } from './AudioSystem';

const _origin = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _toTarget = new THREE.Vector3();
const _closest = new THREE.Vector3();
const _quat = new THREE.Quaternion();

export class FirearmSystem {
  private unlocked = false;
  private cooldownTimer = 0;

  private readonly fireCooldown = 0.12;
  private readonly range = 85;

  constructor(_scene: THREE.Scene) {
    // scene reserved for future use
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  unlock(): void {
    this.unlocked = true;
  }

  update(dt: number): void {
    if (this.cooldownTimer > 0) this.cooldownTimer -= dt;
  }

  canAttemptFire(bird: Bird): boolean {
    return this.unlocked;
  }

  tryFire(
    bird: Bird,
    npcManager: NPCManager,
    scoreSystem: ScoreSystem,
    coinPopups: CoinPopupManager,
    vfx: VFXSystem,
    audio: AudioSystem,
    poopManager: PoopManager,
  ): boolean {
    if (!this.canAttemptFire(bird) || this.cooldownTimer > 0) return false;

    this.cooldownTimer = this.fireCooldown;
    this.getMuzzleTransform(bird, _origin, _forward, _right, _up);

    const hit = this.findClosestNPCAlongRay(_origin, _forward, npcManager);
    if (hit) {
      const hitData = hit.onHit();
      scoreSystem.onHitWithValues(hitData.coins, hitData.heat, hit.npcType);
      _tmp.copy(hit.mesh.position);
      _tmp.y += 2;
      coinPopups.spawn(_tmp, scoreSystem.lastHitPoints, scoreSystem.lastHitMultiplier, 'PEW!');
      vfx.spawnBankingBurst(hit.mesh.position, 14);
      audio.playHit(20);
      npcManager.alertNearby(hit.mesh.position);
    }

    // Fire a fast poop projectile from the muzzle (same asset as regular poop)
    poopManager.fireBullet(_origin, _forward);
    return true;
  }

  private getMuzzleTransform(
    bird: Bird,
    outOrigin: THREE.Vector3,
    outForward: THREE.Vector3,
    outRight: THREE.Vector3,
    outUp: THREE.Vector3,
  ): void {
    _quat.copy(bird.controller.getQuaternion());
    outForward.set(0, 0, -1).applyQuaternion(_quat).normalize();
    outRight.set(1, 0, 0).applyQuaternion(_quat).normalize();
    outUp.set(0, 1, 0).applyQuaternion(_quat).normalize();

    outOrigin
      .copy(bird.controller.position)
      .addScaledVector(outUp, 0.6)
      .addScaledVector(outRight, 0.65)
      .addScaledVector(outForward, 0.8);
  }

  private findClosestNPCAlongRay(origin: THREE.Vector3, dir: THREE.Vector3, npcManager: NPCManager): NPC | null {
    let bestNpc: NPC | null = null;
    let bestT = this.range + 1;

    for (const npc of npcManager.npcs) {
      if (npc.shouldDespawn || npc.isGrabbed || npc.isHit) continue;

      _toTarget.subVectors(npc.mesh.position, origin);
      const t = _toTarget.dot(dir);
      if (t < 0 || t > this.range) continue;

      _closest.copy(origin).addScaledVector(dir, t);
      const radius = npc.boundingRadius * 1.35;
      const distSq = _closest.distanceToSquared(npc.mesh.position);
      if (distSq > radius * radius) continue;

      if (t < bestT) {
        bestT = t;
        bestNpc = npc;
      }
    }

    return bestNpc;
  }

}
