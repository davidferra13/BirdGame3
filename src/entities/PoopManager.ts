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
}

interface SplatDecal {
  mesh: THREE.Mesh;
  age: number;
}

export class PoopManager {
  private pool: Poop[] = [];
  private cooldownTimer = 0;
  private scene: THREE.Scene;

  // Persistent splat decals
  private splatDecals: SplatDecal[] = [];
  private static splatDecalGeo = new THREE.CircleGeometry(POOP.SPLAT_RADIUS, 8);

  // Impact particle system
  private static particleGeo = new THREE.SphereGeometry(0.06, 4, 3);
  private activeParticles: ImpactParticle[] = [];
  private particlePool: THREE.Mesh[] = [];

  // Ghost marker — predicted landing spot
  private ghostMarker: THREE.Mesh;
  private crosshairDot: THREE.Mesh;
  private targetingLine: THREE.Line;
  private targetingLineGeo: THREE.BufferGeometry;
  private bombingBlend = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    for (let i = 0; i < POOP.MAX_ACTIVE; i++) {
      const poop = new Poop();
      scene.add(poop.mesh);
      scene.add(poop.trailLine);
      this.pool.push(poop);
    }

    // Pre-allocate particle pool (8 per impact × 5 concurrent)
    for (let i = 0; i < 40; i++) {
      const mesh = new THREE.Mesh(
        PoopManager.particleGeo,
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }),
      );
      mesh.visible = false;
      scene.add(mesh);
      this.particlePool.push(mesh);
    }

    // Ghost marker (translucent ring on ground — larger default)
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
    scene.add(this.ghostMarker);

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
    scene.add(this.crosshairDot);

    // Targeting line (bird → landing spot, visible during bombing mode)
    this.targetingLineGeo = new THREE.BufferGeometry();
    this.targetingLineGeo.setAttribute('position',
      new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
    const lineMat = new THREE.LineDashedMaterial({
      color: 0xffddaa,
      transparent: true,
      opacity: 0,
      dashSize: 1.0,
      gapSize: 0.5,
    });
    this.targetingLine = new THREE.Line(this.targetingLineGeo, lineMat);
    this.targetingLine.visible = false;
    scene.add(this.targetingLine);
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
        poop.kill(); // Free pool slot immediately — decal persists independently
      }
    }

    // Update particles
    this.updateParticles(dt);

    // Update persistent splat decals
    this.updateSplatDecals(dt);

    // Ghost marker — predict landing spot from bird's current state
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
      });
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        this.activeParticles.splice(i, 1);
        continue;
      }

      p.velocity.y -= 15 * dt; // gravity
      p.mesh.position.addScaledVector(p.velocity, dt);

      const t = Math.max(0, p.life / 0.4);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, t);
      p.mesh.scale.setScalar(Math.min(1, t));
    }
  }

  /** Spawn a persistent splat decal on the ground (or at NPC hit position) */
  spawnSplatDecal(position: THREE.Vector3): void {

    const mat = createToonMaterial(0xf0ead6, { side: THREE.DoubleSide, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(PoopManager.splatDecalGeo, mat);
    mesh.position.set(position.x, 0.06, position.z);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.random() * Math.PI * 2; // Random rotation for variety
    const scale = 0.7 + Math.random() * 0.8;
    mesh.scale.setScalar(scale);
    mesh.frustumCulled = false;

    this.scene.add(mesh);
    this.splatDecals.push({ mesh, age: 0 });
  }

  private updateSplatDecals(_dt: number): void {
    // Decals persist forever — no fading or removal
  }

  getActivePoops(): Poop[] {
    return this.pool.filter((p) => p.alive && !p.grounded);
  }

  /** Project where a poop would land if dropped right now. */
  private updateGhostMarker(bird: Bird, dt: number): void {
    const ctrl = bird.controller;

    // Smooth bombing blend for visual transitions
    const wantsBombing = ctrl.isBraking && !ctrl.isGrounded && !ctrl.isDiving;
    if (wantsBombing) {
      this.bombingBlend = moveToward(this.bombingBlend, 1, dt * 2.5);
    } else {
      this.bombingBlend = moveToward(this.bombingBlend, 0, dt * 3.5);
    }

    // Hide when grounded or too low
    if (ctrl.isGrounded || ctrl.position.y < 3) {
      this.ghostMarker.visible = false;
      this.crosshairDot.visible = false;
      this.targetingLine.visible = false;
      return;
    }

    // Poop spawns 0.5 below bird and hits ground at GROUND_Y + 0.05
    const h = ctrl.position.y - 0.5 - (WORLD.GROUND_Y + 0.05);
    const v0 = POOP.INITIAL_DOWN_SPEED;
    const g = POOP.GRAVITY;

    // Time to hit ground: 0.5*g*t² + v0*t - h = 0
    const disc = v0 * v0 + 2 * g * h;
    if (disc < 0) {
      this.ghostMarker.visible = false;
      this.crosshairDot.visible = false;
      this.targetingLine.visible = false;
      return;
    }
    const t = (-v0 + Math.sqrt(disc)) / g;

    // Horizontal velocity = bird forward * speed * inherit fraction
    const fwd = ctrl.getForward();
    const vx = fwd.x * ctrl.forwardSpeed * POOP.INHERIT_FORWARD_FRACTION;
    const vz = fwd.z * ctrl.forwardSpeed * POOP.INHERIT_FORWARD_FRACTION;

    const landX = ctrl.position.x + vx * t;
    const landZ = ctrl.position.z + vz * t;

    this.ghostMarker.position.set(landX, 0.15, landZ);
    this.ghostMarker.visible = true;

    // Bombing mode: scale up, brighter, pulsing
    const b = this.bombingBlend;
    const pulseScale = 1 + Math.sin(Date.now() * 0.006) * 0.15 * b;
    const scale = (1 + b * 1.5) * pulseScale; // 1x default → 2.5x at full bombing
    this.ghostMarker.scale.setScalar(scale);
    const markerMat = this.ghostMarker.material as THREE.MeshBasicMaterial;
    markerMat.opacity = 0.45 + b * 0.3; // 0.45 default → 0.75 at full bombing

    // Crosshair dot follows ghost marker
    this.crosshairDot.position.set(landX, 0.16, landZ);
    this.crosshairDot.visible = true;
    this.crosshairDot.scale.setScalar(scale);
    const dotMat = this.crosshairDot.material as THREE.MeshBasicMaterial;
    dotMat.opacity = 0.45 + b * 0.3;

    // Targeting line: bird → landing spot (visible during bombing)
    if (b > 0.01) {
      const positions = this.targetingLineGeo.getAttribute('position') as THREE.BufferAttribute;
      positions.setXYZ(0, ctrl.position.x, ctrl.position.y - 0.5, ctrl.position.z);
      positions.setXYZ(1, landX, 0.15, landZ);
      positions.needsUpdate = true;
      this.targetingLineGeo.computeBoundingSphere();
      this.targetingLine.computeLineDistances(); // required for dashed lines
      this.targetingLine.visible = true;
      const lineMat = this.targetingLine.material as THREE.LineDashedMaterial;
      lineMat.opacity = clamp(b * 0.5, 0, 0.5);
    } else {
      this.targetingLine.visible = false;
    }
  }

  get cooldownProgress(): number {
    return Math.max(0, 1 - this.cooldownTimer / POOP.COOLDOWN);
  }
}
