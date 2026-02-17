import * as THREE from 'three';
import { NPC, NPCType } from '../entities/NPC';
import { NPCManager } from '../entities/NPCManager';
import { FlightController } from '../entities/FlightController';
import type { StreetAnimal } from './StreetLifeSystem';

const GRAB_RANGE_XZ = 6; // Horizontal grab radius (generous for swooping)
const GRAB_HEIGHT_MIN = -2; // Bird can be this far below NPC center (unlikely but allowed)
const GRAB_HEIGHT_MAX = 8; // Bird can be this far above NPC base (covers swooping overhead)
const NPC_CENTER_HEIGHT = 1.2; // Approximate center-mass height of NPCs
const FORWARD_GRAB_BONUS = 4; // Extra range for NPCs in the bird's flight path
const THROW_FORCE_MULTIPLIER = 1.5; // How much bird velocity affects throw
const TALON_OFFSET_Y = -3.5; // How far below bird to position grabbed NPC (clears NPC height)

// Pet protection constants
const PET_TALON_OFFSET_Y = -2.0; // Pets hang closer (they're smaller)
const PET_SAFE_DROP_HEIGHT = 8; // Max altitude to safely place a pet

// Per-type carry weight (speed multiplier: lower = heavier, 1.0 = weightless)
const CARRY_WEIGHTS: Record<string, number> = {
  // Pets — light
  cat:                  0.95,
  dog:                  0.90,
  // NPCs — heavier
  tourist:              0.78,
  performer:            0.78,
  'glamorous-elegance': 0.75,
  business:             0.72,
  chef:                 0.68,
  police:               0.62, // heavy gear
  treeman:              0.55, // bulky costume
};
const DEFAULT_CARRY_WEIGHT = 0.7;

// Event callbacks for Heist mode integration
export type GrabEventCallback = (event: 'grab' | 'release' | 'force-release', data?: any) => void;

export class GrabSystem {
  private grabbedNPC: NPC | null = null;
  private grabbedPet: StreetAnimal | null = null;
  private carryOffset = new THREE.Vector3(0, TALON_OFFSET_Y, 0);
  private petCarryOffset = new THREE.Vector3(0, PET_TALON_OFFSET_Y, 0);

  // Pet protection message state
  petWarningActive = false;
  petWarningTimer = 0;
  private _petWarningShownOnGrab = false;

  // Event hooks for external systems (Heist mode)
  private onGrabCallback: GrabEventCallback | null = null;

  /** Register a callback for grab/release events (used by Heist mode) */
  setGrabEventCallback(cb: GrabEventCallback | null): void {
    this.onGrabCallback = cb;
  }

  /** Check if we can grab an NPC at the current position */
  canGrab(birdPos: THREE.Vector3, npcManager: NPCManager, birdForward?: THREE.Vector3): NPC | null {
    if (this.grabbedNPC || this.grabbedPet) return null; // Already carrying something

    let closestNPC: NPC | null = null;
    let bestScore = Infinity;

    for (const npc of npcManager.npcs) {
      // Can't grab NPCs that are already hit, grabbed, or despawning
      if (npc.isHit || npc.isGrabbed || npc.shouldDespawn) continue;

      // Separate horizontal and vertical distance checks
      const dx = birdPos.x - npc.mesh.position.x;
      const dz = birdPos.z - npc.mesh.position.z;
      const horizontalDist = Math.sqrt(dx * dx + dz * dz);

      // Height check: bird relative to NPC center mass
      const npcCenter = npc.mesh.position.y + NPC_CENTER_HEIGHT;
      const heightDiff = birdPos.y - npcCenter;

      // Skip if outside vertical grab window
      if (heightDiff < GRAB_HEIGHT_MIN || heightDiff > GRAB_HEIGHT_MAX) continue;

      // Calculate effective grab range (bonus for NPCs in flight path)
      let effectiveRange = GRAB_RANGE_XZ;
      if (birdForward) {
        const toNPC = new THREE.Vector3(
          npc.mesh.position.x - birdPos.x, 0,
          npc.mesh.position.z - birdPos.z
        ).normalize();
        const forwardFlat = new THREE.Vector3(birdForward.x, 0, birdForward.z).normalize();
        const dot = forwardFlat.dot(toNPC);
        // NPCs ahead of the bird get bonus range (dot > 0 = in front)
        if (dot > 0.3) {
          effectiveRange += FORWARD_GRAB_BONUS * dot;
        }
      }

      if (horizontalDist < effectiveRange) {
        // Score: prefer closer NPCs, with slight preference for centered height
        const heightPenalty = Math.abs(heightDiff) * 0.3;
        const score = horizontalDist + heightPenalty;
        if (score < bestScore) {
          bestScore = score;
          closestNPC = npc;
        }
      }
    }

    return closestNPC;
  }

  /** Check if we can grab a nearby street animal (cat/dog) */
  canGrabAnimal(birdPos: THREE.Vector3, animals: StreetAnimal[], birdForward?: THREE.Vector3): StreetAnimal | null {
    if (this.grabbedNPC || this.grabbedPet) return null;

    let closest: StreetAnimal | null = null;
    let bestScore = Infinity;

    for (const animal of animals) {
      if (animal.isGrabbed || animal.state === 'hit') continue;
      if (!animal.mesh.visible) continue;

      const dx = birdPos.x - animal.position.x;
      const dz = birdPos.z - animal.position.z;
      const horizontalDist = Math.sqrt(dx * dx + dz * dz);

      // Animals are on the ground, center is ~0.4
      const heightDiff = birdPos.y - 0.4;
      if (heightDiff < GRAB_HEIGHT_MIN || heightDiff > GRAB_HEIGHT_MAX) continue;

      let effectiveRange = GRAB_RANGE_XZ;
      if (birdForward) {
        const toAnimal = new THREE.Vector3(
          animal.position.x - birdPos.x, 0,
          animal.position.z - birdPos.z
        ).normalize();
        const forwardFlat = new THREE.Vector3(birdForward.x, 0, birdForward.z).normalize();
        const dot = forwardFlat.dot(toAnimal);
        if (dot > 0.3) {
          effectiveRange += FORWARD_GRAB_BONUS * dot;
        }
      }

      if (horizontalDist < effectiveRange) {
        const heightPenalty = Math.abs(heightDiff) * 0.3;
        const score = horizontalDist + heightPenalty;
        if (score < bestScore) {
          bestScore = score;
          closest = animal;
        }
      }
    }

    return closest;
  }

  /** Grab an NPC with talons */
  grab(npc: NPC): void {
    if (this.grabbedNPC || this.grabbedPet) return; // Already carrying something

    this.grabbedNPC = npc;
    console.log(`Grabbed ${npc.npcType}!`);

    // Mark NPC as grabbed (freezes all NPC update logic — no despawn timer)
    npc.isGrabbed = true;
    this.onGrabCallback?.('grab', { type: 'npc', npcType: npc.npcType });
  }

  /** Grab a street animal (cat/dog) — triggers pet protection mode */
  grabAnimal(animal: StreetAnimal): void {
    if (this.grabbedNPC || this.grabbedPet) return;

    this.grabbedPet = animal;
    animal.isGrabbed = true;
    this._petWarningShownOnGrab = false;
    console.log(`Picked up a ${animal.type}!`);
  }

  /** Release/throw the grabbed NPC. Returns hit result for scoring. */
  release(birdController: FlightController): { coins: number; heat: number; multiplierBonus: number; npcType: NPCType; throwPos: THREE.Vector3; heightBonus: number } | null {
    if (!this.grabbedNPC) return null;

    console.log(`Threw ${this.grabbedNPC.npcType}!`);

    // Calculate throw velocity based on bird's movement
    const birdVelocity = birdController.getForward().multiplyScalar(birdController.forwardSpeed);
    const throwVelocity = birdVelocity.clone().multiplyScalar(THROW_FORCE_MULTIPLIER);

    // Add downward component
    throwVelocity.y = Math.max(-20, throwVelocity.y - 10);

    // Apply throw physics to NPC
    const npc = this.grabbedNPC;
    const npcType = npc.npcType;
    npc.isGrabbed = false; // Unfreeze NPC before triggering hit
    npc.mesh.position.copy(birdController.position);
    npc.mesh.position.add(this.carryOffset);

    const throwPos = npc.mesh.position.clone();

    // Height bonus: the higher you drop from, the more points you earn
    // Drop height = throw position Y (ground is ~0.1)
    // Below 5 units: no bonus. Each unit above 5 adds 4%, capped at 3.0x
    const dropHeight = Math.max(0, throwPos.y - 0.1);
    const heightBonus = Math.min(1 + Math.max(0, dropHeight - 5) * 0.04, 3.0);

    // Trigger NPC's existing knockback system for the throw
    const throwResult = npc.onHit();

    // Override knockback with our throw velocity
    const knockbackDir = new THREE.Vector3(throwVelocity.x, 0, throwVelocity.z).normalize();
    (npc as any).knockbackVel.copy(knockbackDir.multiplyScalar(Math.min(throwVelocity.length(), 15)));
    (npc as any).jumpVel = Math.abs(throwVelocity.y) * 0.5;
    (npc as any).baseY = 0.1; // Fall to ground, not float at throw height

    this.grabbedNPC = null;
    this.onGrabCallback?.('release', { type: 'npc', npcType });

    return { ...throwResult, npcType, throwPos, heightBonus };
  }

  /**
   * Try to release a pet. Returns 'placed' if safely placed, 'blocked' if too high.
   * Pets cannot be dropped from height — this is the wholesome easter egg!
   */
  tryReleasePet(birdController: FlightController): 'placed' | 'blocked' {
    if (!this.grabbedPet) return 'placed';

    const altitude = birdController.position.y;

    if (altitude > PET_SAFE_DROP_HEIGHT) {
      // Too high! Show the warning and block the drop
      this.petWarningActive = true;
      this.petWarningTimer = 1.5; // Show message briefly
      return 'blocked';
    }

    // Safe to place! Gently set the pet down
    return 'placed';
  }

  /** Get the currently held pet for safe placement by the StreetLifeSystem */
  releasePet(): StreetAnimal | null {
    if (!this.grabbedPet) return null;
    const pet = this.grabbedPet;
    this.grabbedPet = null;
    this._petWarningShownOnGrab = false;
    return pet;
  }

  /** Update carried NPC or pet position */
  update(dt: number, birdController: FlightController): void {
    // Pet warning timer
    if (this.petWarningTimer > 0) {
      this.petWarningTimer -= dt;
      if (this.petWarningTimer <= 0) {
        this.petWarningActive = false;
      }
    }

    if (this.grabbedNPC) {
      // Position NPC below bird (in talons)
      const carryPos = birdController.position.clone();
      carryPos.add(this.carryOffset);
      this.grabbedNPC.mesh.position.copy(carryPos);

      // Rotate NPC to face same direction as bird
      this.grabbedNPC.mesh.rotation.y = birdController.yawAngle;

      // Add slight sway/dangle animation
      const swayTime = performance.now() / 1000;
      const sway = Math.sin(swayTime * 3) * 0.2;
      this.grabbedNPC.mesh.position.x += sway;
      this.grabbedNPC.mesh.position.z += Math.cos(swayTime * 3) * 0.1;
    }

    if (this.grabbedPet) {
      // Position pet below bird (closer since they're smaller)
      const carryPos = birdController.position.clone();
      carryPos.add(this.petCarryOffset);
      this.grabbedPet.mesh.position.copy(carryPos);

      // Face forward
      this.grabbedPet.mesh.rotation.y = birdController.yawAngle;

      // Cute dangling animation — pets swing a bit more
      const swayTime = performance.now() / 1000;
      const sway = Math.sin(swayTime * 4) * 0.15;
      this.grabbedPet.mesh.position.x += sway;
      this.grabbedPet.mesh.position.z += Math.cos(swayTime * 2.5) * 0.08;

      // Wag tail faster when carried (they're excited/nervous!)
      this.grabbedPet.tailPhase += dt * 15;

      // Show initial pickup message once after grabbing
      if (!this._petWarningShownOnGrab) {
        this._petWarningShownOnGrab = true;
        this.petWarningActive = true;
        this.petWarningTimer = 1.8;
      }
    }
  }

  /** Apply weight penalty to bird speed when carrying */
  getSpeedMultiplier(): number {
    if (this.grabbedNPC) return CARRY_WEIGHTS[this.grabbedNPC.npcType] ?? DEFAULT_CARRY_WEIGHT;
    if (this.grabbedPet) return CARRY_WEIGHTS[this.grabbedPet.type] ?? DEFAULT_CARRY_WEIGHT;
    return 1.0;
  }

  /** Check if currently carrying something */
  isCarrying(): boolean {
    return this.grabbedNPC !== null || this.grabbedPet !== null;
  }

  /** Check if carrying a pet specifically */
  isCarryingPet(): boolean {
    return this.grabbedPet !== null;
  }

  /** Get the pet type being carried */
  getCarriedPetType(): 'cat' | 'dog' | null {
    return this.grabbedPet?.type ?? null;
  }

  /** Get the currently grabbed NPC */
  getGrabbedNPC(): NPC | null {
    return this.grabbedNPC;
  }

  /** Force release (for when NPC despawns or gets hit) */
  forceRelease(): void {
    const hadItem = this.grabbedNPC || this.grabbedPet;
    if (this.grabbedNPC) {
      console.log(`Force released ${this.grabbedNPC.npcType}`);
      this.grabbedNPC.isGrabbed = false;
      this.grabbedNPC = null;
    }
    if (this.grabbedPet) {
      console.log(`Force released ${this.grabbedPet.type}`);
      this.grabbedPet.isGrabbed = false;
      this.grabbedPet = null;
      this._petWarningShownOnGrab = false;
    }
    if (hadItem) {
      this.onGrabCallback?.('force-release');
    }
  }
}
