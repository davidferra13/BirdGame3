import * as THREE from 'three';
import { createToonMaterial } from '../rendering/ToonUtils';
import { Poop } from './Poop';
import { Bird } from './Bird';
import { NPC } from './NPC';
import { InputManager } from '../core/InputManager';
import { POOP, WORLD } from '../utils/Constants';
import { moveToward, clamp } from '../utils/MathUtils';

interface ImpactParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  age: number;
}

interface SplatDecal {
  mesh: THREE.Mesh;
  age: number;
}

interface CcipSolution {
  point: THREE.Vector3;
  timeToImpact: number;
  horizontalVelocity: THREE.Vector2;
}

export class PoopManager {
  public readonly targetReticle: THREE.Object3D;
  private pool: Poop[] = [];
  private cooldownTimer = 0;
  private scene: THREE.Scene;

  // Persistent splat decals (capped to prevent unbounded growth)
  private splatDecals: SplatDecal[] = [];
  private static splatDecalGeo = new THREE.CircleGeometry(POOP.SPLAT_RADIUS, 8);
  private static readonly MAX_SPLAT_DECALS = 60;
  private static readonly SPLAT_FADE_DURATION = POOP.DECAL_FADE_TIME;
  private static readonly SPLAT_FADE_START = Math.max(
    0,
    POOP.DECAL_LIFETIME - PoopManager.SPLAT_FADE_DURATION,
  );
  private static readonly PARTICLE_MAX_AGE = 2.0; // safety cap for any stale particle

  // Impact particle system
  private static particleGeo = new THREE.SphereGeometry(0.06, 4, 3);
  private activeParticles: ImpactParticle[] = [];
  private particlePool: THREE.Mesh[] = [];

  // Ghost marker (CCIP reticle)
  private ghostMarker: THREE.Mesh;
  private crosshairDot: THREE.Mesh;
  private targetingLine: THREE.Line;
  private targetingLineGeo: THREE.BufferGeometry;
  private bombingBlend = 0;

  // CCIP tuning
  private static readonly ARC_SEGMENTS = 24;
  private static readonly RAYCAST_HEIGHT = 400;
  private static readonly RAYCAST_MAX_DISTANCE = 1200;
  private static readonly CCIP_SMOOTHING = 16;
  private static readonly RETICLE_SURFACE_OFFSET = 0.12;
  private static readonly MIN_VALID_ALTITUDE = 0.25;
  private static readonly MAX_PREDICTION_TIME = 8;

  // Equivalent to Rigidbody.drag for ballistic prediction
  private projectileDrag = POOP.AIR_DRAG;
  private drawArcPath = true;

  private raycaster = new THREE.Raycaster();
  private rayOrigin = new THREE.Vector3();
  private rayDirection = new THREE.Vector3(0, -1, 0);
  private raycastTargets: THREE.Object3D[] = [];

  private impactPoint = new THREE.Vector3();
  private smoothedImpactPoint = new THREE.Vector3();
  private hasSmoothedImpactPoint = false;

  private arcPoints = new Float32Array(PoopManager.ARC_SEGMENTS * 3);

  // Scratch
  private _tmpPointA = new THREE.Vector3();
  private _tmpPointB = new THREE.Vector3();
  private _lineStart = new THREE.Vector3();
  private _horizontalVelocity = new THREE.Vector2();

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    for (let i = 0; i < POOP.MAX_ACTIVE; i++) {
      const poop = new Poop();
      poop.mesh.userData.ignoreCcipRaycast = true;
      poop.trailLine.userData.ignoreCcipRaycast = true;
      scene.add(poop.mesh);
      scene.add(poop.trailLine);
      this.pool.push(poop);
    }

    // Pre-allocate particle pool (8 per impact x 5 concurrent)
    for (let i = 0; i < 40; i++) {
      const mesh = new THREE.Mesh(
        PoopManager.particleGeo,
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }),
      );
      mesh.visible = false;
      mesh.userData.ignoreCcipRaycast = true;
      scene.add(mesh);
      this.particlePool.push(mesh);
    }

    // Ghost marker (translucent ring on ground)
    const ringGeo = new THREE.RingGeometry(0.8, 1.3, 20);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffddaa,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
    this.ghostMarker = new THREE.Mesh(ringGeo, ringMat);
    this.ghostMarker.rotation.x = -Math.PI / 2;
    this.ghostMarker.visible = false;
    this.ghostMarker.userData.ignoreCcipRaycast = true;
    scene.add(this.ghostMarker);
    this.targetReticle = this.ghostMarker;

    // Crosshair dot in center of ghost marker
    const dotGeo = new THREE.CircleGeometry(0.15, 8);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0xffddaa,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
    this.crosshairDot = new THREE.Mesh(dotGeo, dotMat);
    this.crosshairDot.rotation.x = -Math.PI / 2;
    this.crosshairDot.visible = false;
    this.crosshairDot.userData.ignoreCcipRaycast = true;
    scene.add(this.crosshairDot);

    // Arc line (bird -> predicted impact)
    this.targetingLineGeo = new THREE.BufferGeometry();
    this.targetingLineGeo.setAttribute('position',
      new THREE.BufferAttribute(this.arcPoints, 3));
    this.targetingLineGeo.setDrawRange(0, PoopManager.ARC_SEGMENTS);

    const lineMat = new THREE.LineDashedMaterial({
      color: 0xffddaa,
      transparent: true,
      opacity: 0,
      dashSize: 1.4,
      gapSize: 0.7,
    });

    this.targetingLine = new THREE.Line(this.targetingLineGeo, lineMat);
    this.targetingLine.visible = false;
    this.targetingLine.userData.ignoreCcipRaycast = true;
    scene.add(this.targetingLine);

    this.raycaster.far = PoopManager.RAYCAST_MAX_DISTANCE;
  }

  update(dt: number, bird: Bird, input: InputManager, carriedNPC?: NPC | null): void {
    // Cooldown
    if (this.cooldownTimer > 0) {
      this.cooldownTimer -= dt;
    }

    // Spawn on input
    if (input.isPoop() && this.cooldownTimer <= 0) {
      if (carriedNPC) {
        // Poop sticks to the carried NPC instead of falling
        this.poopOnNPC(carriedNPC);
      } else {
        this.spawn(bird);
      }
      this.cooldownTimer = POOP.COOLDOWN;
    }

    // Update active poops
    for (const poop of this.pool) {
      poop.update(dt);
      // Spawn impact particles + persistent decal on ground splat, then free pool slot
      if (poop.splatThisFrame) {
        this.spawnImpact(poop.mesh.position);
        this.spawnSplatDecal(poop.mesh.position);
        poop.kill(); // Free pool slot immediately, decal persists independently
      }
    }

    // Update particles
    this.updateParticles(dt);

    // Update persistent splat decals
    this.updateSplatDecals(dt);

    // CCIP reticle update
    this.updateGhostMarker(bird, dt);
  }

  private spawn(bird: Bird): void {
    // Find an inactive poop, or reclaim the oldest
    let target = this.pool.find((p) => !p.alive);
    if (!target) {
      // Reclaim oldest (first in pool since they cycle)
      target = this.pool[0];
      target.kill();
    }

    const ctrl = bird.controller;
    target.spawn(ctrl.position, ctrl.getForward(), ctrl.forwardSpeed);
  }

  /** Stick a poop blob onto a carried NPC */
  private poopOnNPC(npc: NPC): void {
    if (!npc.addPoopBlob()) return; // NPC fully covered
    // Small impact burst for satisfying feedback
    this.spawnImpact(npc.mesh.position);
  }

  /** Spawn a burst of white particles at a position (ground splat or NPC hit) */
  spawnImpact(position: THREE.Vector3): void {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const mesh = this.particlePool.find((p) => !p.visible);
      if (!mesh) break;

      mesh.visible = true;
      mesh.position.copy(position);
      mesh.position.y += 0.15;
      mesh.scale.setScalar(1);
      (mesh.material as THREE.MeshBasicMaterial).opacity = 1;

      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 2 + Math.random() * 3;
      this.activeParticles.push({
        mesh,
        velocity: new THREE.Vector3(
          Math.cos(angle) * speed,
          3 + Math.random() * 2,
          Math.sin(angle) * speed,
        ),
        life: 0.3 + Math.random() * 0.15,
        age: 0,
      });
    }
  }

  private updateParticles(dt: number): void {
    let i = this.activeParticles.length;
    while (i-- > 0) {
      const p = this.activeParticles[i];
      p.life -= dt;
      p.age += dt;
      if (!Number.isFinite(p.life) || !Number.isFinite(p.age) || p.life <= 0 || p.age >= PoopManager.PARTICLE_MAX_AGE) {
        p.mesh.visible = false;
        // Swap-and-pop: O(1) removal
        const last = this.activeParticles.length - 1;
        if (i !== last) this.activeParticles[i] = this.activeParticles[last];
        this.activeParticles.length = last;
        continue;
      }

      p.velocity.y -= 15 * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);

      const t = Math.max(0, p.life / 0.4);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, t);
      p.mesh.scale.setScalar(Math.min(1, t));
    }
  }

  /** Spawn a persistent splat decal on the ground (or at NPC hit position) */
  spawnSplatDecal(position: THREE.Vector3): void {
    // Evict oldest decal if at capacity
    if (this.splatDecals.length >= PoopManager.MAX_SPLAT_DECALS) {
      const oldest = this.splatDecals.shift()!;
      this.scene.remove(oldest.mesh);
      (oldest.mesh.material as THREE.Material).dispose();
    }

    const mat = createToonMaterial(0xf0ead6, { side: THREE.DoubleSide, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(PoopManager.splatDecalGeo, mat);
    mesh.position.set(position.x, 0.06, position.z);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.random() * Math.PI * 2;
    const scale = 0.7 + Math.random() * 0.8;
    mesh.scale.setScalar(scale);
    mesh.frustumCulled = false;
    mesh.userData.ignoreCcipRaycast = true;

    this.scene.add(mesh);
    this.splatDecals.push({ mesh, age: 0 });
  }

  private updateSplatDecals(dt: number): void {
    let i = this.splatDecals.length;
    while (i-- > 0) {
      const decal = this.splatDecals[i];
      decal.age += dt;

      // Fade out old decals
      if (decal.age > PoopManager.SPLAT_FADE_START) {
        const fadeProgress = (decal.age - PoopManager.SPLAT_FADE_START) / PoopManager.SPLAT_FADE_DURATION;
        if (fadeProgress >= 1) {
          this.scene.remove(decal.mesh);
          (decal.mesh.material as THREE.Material).dispose();
          const last = this.splatDecals.length - 1;
          if (i !== last) this.splatDecals[i] = this.splatDecals[last];
          this.splatDecals.length = last;
        } else {
          (decal.mesh.material as THREE.MeshStandardMaterial).opacity = 1 - fadeProgress;
        }
      }
    }
  }

  // Reusable array to avoid per-call allocation from .filter()
  private _activePoopsCache: Poop[] = [];

  getActivePoops(): Poop[] {
    const result = this._activePoopsCache;
    result.length = 0;
    for (const p of this.pool) {
      if (p.alive && !p.grounded) result.push(p);
    }
    return result;
  }

  setProjectileDrag(drag: number): void {
    this.projectileDrag = Math.max(0, drag);
  }

  setArcPathEnabled(enabled: boolean): void {
    this.drawArcPath = enabled;
  }

  getImpactPoint(): THREE.Vector3 {
    return this.impactPoint.clone();
  }

  /** Project where a poop would land if dropped right now. */
  private updateGhostMarker(bird: Bird, dt: number): void {
    const ctrl = bird.controller;

    // Smooth bombing blend for visual transitions
    const wantsBombing = ctrl.isBomberMode && !ctrl.isGrounded && !ctrl.isDiving;
    if (wantsBombing) {
      this.bombingBlend = moveToward(this.bombingBlend, 1, dt * 2.5);
    } else {
      this.bombingBlend = moveToward(this.bombingBlend, 0, dt * 3.5);
    }

    // Hide when grounded or too low
    if (ctrl.isGrounded || ctrl.position.y < 3) {
      this.hideCcip();
      return;
    }

    // Poop release point (same spawn offset used in Poop.spawn)
    this._lineStart.set(ctrl.position.x, ctrl.position.y - 0.5, ctrl.position.z);

    // Altitude baseline under player
    const raycastStartY = ctrl.position.y + PoopManager.RAYCAST_HEIGHT;
    if (!this.findSurfaceY(ctrl.position.x, ctrl.position.z, raycastStartY, bird.mesh, this._tmpPointA)) {
      this.hideCcip();
      return;
    }

    // First pass CCIP solve
    const first = this.calculateImpactPoint(this._lineStart, this._tmpPointA.y, ctrl, bird.mesh, this._tmpPointA);
    if (!first) {
      this.hideCcip();
      return;
    }

    // Refinement pass for uneven terrain/rooftops
    const refined = this.calculateImpactPoint(this._lineStart, first.point.y, ctrl, bird.mesh, this._tmpPointB) ?? first;
    this.impactPoint.copy(refined.point);

    // Anti-jitter smoothing
    const alpha = 1 - Math.exp(-PoopManager.CCIP_SMOOTHING * dt);
    if (!this.hasSmoothedImpactPoint) {
      this.smoothedImpactPoint.copy(this.impactPoint);
      this.hasSmoothedImpactPoint = true;
    } else {
      this.smoothedImpactPoint.lerp(this.impactPoint, alpha);
    }

    const reticleY = this.smoothedImpactPoint.y + PoopManager.RETICLE_SURFACE_OFFSET;
    this.ghostMarker.position.set(this.smoothedImpactPoint.x, reticleY, this.smoothedImpactPoint.z);
    this.ghostMarker.visible = true;

    // Bombing mode: scale up, brighter, pulsing
    const b = this.bombingBlend;
    const pulseScale = 1 + Math.sin(Date.now() * 0.006) * 0.15 * b;
    const scale = (1 + b * 1.5) * pulseScale;
    this.ghostMarker.scale.setScalar(scale);
    const markerMat = this.ghostMarker.material as THREE.MeshBasicMaterial;
    markerMat.opacity = 0.45 + b * 0.3;

    // Crosshair dot follows ghost marker
    this.crosshairDot.position.set(this.smoothedImpactPoint.x, reticleY + 0.01, this.smoothedImpactPoint.z);
    this.crosshairDot.visible = true;
    this.crosshairDot.scale.setScalar(scale);
    const dotMat = this.crosshairDot.material as THREE.MeshBasicMaterial;
    dotMat.opacity = 0.45 + b * 0.3;

    // Optional parabolic arc (line renderer equivalent)
    if (b > 0.01 && this.drawArcPath) {
      this.updateArcPath(this._lineStart, refined);
      this.targetingLine.visible = true;
      const lineMat = this.targetingLine.material as THREE.LineDashedMaterial;
      lineMat.opacity = clamp(b * 0.5, 0, 0.5);
    } else {
      this.targetingLine.visible = false;
    }
  }

  private calculateImpactPoint(
    releasePoint: THREE.Vector3,
    groundYForAltitude: number,
    controller: Bird['controller'],
    ignoreRoot: THREE.Object3D,
    outPoint: THREE.Vector3,
  ): CcipSolution | null {
    const altitude = releasePoint.y - groundYForAltitude;
    if (!Number.isFinite(altitude) || altitude <= PoopManager.MIN_VALID_ALTITUDE) {
      return null;
    }

    // Required equations:
    // t = sqrt(2h/g)
    const t = clamp(Math.sqrt((2 * altitude) / POOP.GRAVITY), 0, PoopManager.MAX_PREDICTION_TIME);
    if (!Number.isFinite(t) || t <= 0) return null;

    // Horizontal velocity Vxy
    const forward = controller.getForward();
    const vx = forward.x * controller.forwardSpeed * POOP.INHERIT_FORWARD_FRACTION;
    const vz = forward.z * controller.forwardSpeed * POOP.INHERIT_FORWARD_FRACTION;
    this._horizontalVelocity.set(vx, vz);

    // d = Vxy * t (drag-aware variant when drag > 0)
    const dx = this.computeHorizontalDisplacement(vx, t);
    const dz = this.computeHorizontalDisplacement(vz, t);
    const predictedX = releasePoint.x + dx;
    const predictedZ = releasePoint.z + dz;

    // Vertical raycast at predicted XZ to find actual impact height
    const raycastStartY = Math.max(releasePoint.y + PoopManager.RAYCAST_HEIGHT, PoopManager.RAYCAST_HEIGHT);
    if (!this.findSurfaceY(predictedX, predictedZ, raycastStartY, ignoreRoot, outPoint)) {
      return null;
    }

    outPoint.set(predictedX, outPoint.y, predictedZ);
    return {
      point: outPoint.clone(),
      timeToImpact: t,
      horizontalVelocity: this._horizontalVelocity.clone(),
    };
  }

  private computeHorizontalDisplacement(v: number, t: number): number {
    if (this.projectileDrag <= 0.0001) {
      return v * t;
    }

    // Linear drag model for horizontal travel
    return (v / this.projectileDrag) * (1 - Math.exp(-this.projectileDrag * t));
  }

  private updateArcPath(start: THREE.Vector3, solution: CcipSolution): void {
    const positions = this.targetingLineGeo.getAttribute('position') as THREE.BufferAttribute;
    const totalTime = Math.max(solution.timeToImpact, 0.0001);
    const vx = solution.horizontalVelocity.x;
    const vz = solution.horizontalVelocity.y;

    for (let i = 0; i < PoopManager.ARC_SEGMENTS; i++) {
      const u = i / (PoopManager.ARC_SEGMENTS - 1);
      const t = u * totalTime;
      const x = start.x + this.computeHorizontalDisplacement(vx, t);
      const z = start.z + this.computeHorizontalDisplacement(vz, t);
      const y = Math.max(
        solution.point.y + PoopManager.RETICLE_SURFACE_OFFSET,
        start.y - 0.5 * POOP.GRAVITY * t * t,
      );
      positions.setXYZ(i, x, y, z);
    }

    positions.needsUpdate = true;
    this.targetingLineGeo.computeBoundingSphere();
    this.targetingLine.computeLineDistances();
  }

  private findSurfaceY(
    x: number,
    z: number,
    startY: number,
    ignoreRoot: THREE.Object3D,
    out: THREE.Vector3,
  ): boolean {
    this.rayOrigin.set(x, startY, z);
    this.raycaster.set(this.rayOrigin, this.rayDirection);
    this.collectRaycastTargets();
    const hits = this.raycaster.intersectObjects(this.raycastTargets, false);

    for (const hit of hits) {
      if (hit.point.y < WORLD.GROUND_Y - 2) continue;
      if (this.shouldIgnoreRaycastHit(hit.object, ignoreRoot)) continue;
      // Reject wall/facade hits. Keep mostly-upward surfaces.
      if (hit.face && hit.face.normal.y < 0.2) continue;
      out.copy(hit.point);
      return true;
    }

    return false;
  }

  /**
   * Collect only mesh-like scene objects for CCIP raycast.
   * Excludes sprites, which require raycaster.camera and can throw when null.
   */
  private collectRaycastTargets(): void {
    this.raycastTargets.length = 0;
    this.scene.traverseVisible((object) => {
      const anyObject = object as any;
      if (anyObject.isMesh || anyObject.isInstancedMesh) {
        this.raycastTargets.push(object);
      }
    });
  }

  private shouldIgnoreRaycastHit(object: THREE.Object3D, ignoreRoot: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current === ignoreRoot) return true;
      if (current.userData?.ignoreCcipRaycast) return true;
      current = current.parent;
    }
    return false;
  }

  private hideCcip(): void {
    this.ghostMarker.visible = false;
    this.crosshairDot.visible = false;
    this.targetingLine.visible = false;
    this.hasSmoothedImpactPoint = false;
  }

  get cooldownProgress(): number {
    return Math.max(0, 1 - this.cooldownTimer / POOP.COOLDOWN);
  }
}
