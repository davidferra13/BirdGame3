import * as THREE from 'three';
import { createToonMaterial } from '../rendering/ToonUtils';
import { POOP, WORLD } from '../utils/Constants';

const AIR_LIFETIME = 2.0; // spec: despawn after 2s in air

export class Poop {
  readonly mesh: THREE.Mesh;
  readonly trailLine: THREE.Line;
  readonly velocity = new THREE.Vector3();
  alive = false;
  age = 0;
  grounded = false;
  /** Set true on the frame the poop hits the ground */
  splatThisFrame = false;

  private static geometry = new THREE.SphereGeometry(0.15, 6, 4);
  private static material = createToonMaterial(0xf5f5dc);
  private static splatGeometry = new THREE.CircleGeometry(POOP.SPLAT_RADIUS, 8);
  private static splatMaterial = createToonMaterial(0xf0ead6, { side: THREE.DoubleSide });

  private static readonly TRAIL_LENGTH = 8;
  private trailPositions: Float32Array;
  private trailCount = 0;

  constructor() {
    this.mesh = new THREE.Mesh(Poop.geometry, Poop.material);
    this.mesh.visible = false;

    // White streak trail
    this.trailPositions = new Float32Array(Poop.TRAIL_LENGTH * 3);
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3));
    trailGeo.setDrawRange(0, 0);
    this.trailLine = new THREE.Line(
      trailGeo,
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }),
    );
    this.trailLine.visible = false;
    this.trailLine.frustumCulled = false;
  }

  spawn(position: THREE.Vector3, birdForward: THREE.Vector3, birdSpeed: number): void {
    this.alive = true;
    this.grounded = false;
    this.splatThisFrame = false;
    this.age = 0;
    this.mesh.visible = true;
    this.trailLine.visible = true;
    this.trailCount = 0;

    // Reset to sphere shape
    this.mesh.geometry = Poop.geometry;
    this.mesh.material = Poop.material;
    this.mesh.rotation.set(0, 0, 0);
    this.mesh.scale.setScalar(1);

    // Spawn slightly below bird
    this.mesh.position.copy(position);
    this.mesh.position.y -= 0.5;

    // Inherit some forward velocity + initial downward kick
    this.velocity.copy(birdForward).multiplyScalar(birdSpeed * POOP.INHERIT_FORWARD_FRACTION);
    this.velocity.y = -POOP.INITIAL_DOWN_SPEED;

    // Fill trail with spawn position
    for (let i = 0; i < Poop.TRAIL_LENGTH; i++) {
      this.trailPositions[i * 3] = this.mesh.position.x;
      this.trailPositions[i * 3 + 1] = this.mesh.position.y;
      this.trailPositions[i * 3 + 2] = this.mesh.position.z;
    }
    (this.trailLine.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    this.trailLine.geometry.setDrawRange(0, 1);

    // Reset trail material opacity
    (this.trailLine.material as THREE.LineBasicMaterial).opacity = 0.6;
  }

  update(dt: number): void {
    if (!this.alive) return;

    this.splatThisFrame = false;
    this.age += dt;

    if (this.grounded) {
      // Fade trail while grounded
      const mat = this.trailLine.material as THREE.LineBasicMaterial;
      mat.opacity = Math.max(0, 0.6 - this.age * 2);
      if (mat.opacity <= 0) this.trailLine.visible = false;

      if (this.age > POOP.MAX_LIFETIME) {
        this.kill();
      }
      return;
    }

    // In-air lifetime per spec
    if (this.age > AIR_LIFETIME) {
      this.kill();
      return;
    }

    // Wobble — slight rotation so it feels alive
    this.mesh.rotation.x = Math.sin(this.age * 12) * 0.3;
    this.mesh.rotation.z = Math.cos(this.age * 10) * 0.2;

    // Gravity
    this.velocity.y -= POOP.GRAVITY * dt;

    // Move
    this.mesh.position.addScaledVector(this.velocity, dt);

    // Update trail
    this.updateTrail();

    // Ground hit
    if (this.mesh.position.y <= WORLD.GROUND_Y + 0.05) {
      this.mesh.position.y = WORLD.GROUND_Y + 0.05;
      this.grounded = true;
      this.splatThisFrame = true;
      this.age = 0; // reset for grounded splat lifetime
      this.splat();
    }
  }

  private updateTrail(): void {
    // Shift positions back
    for (let i = Poop.TRAIL_LENGTH - 1; i > 0; i--) {
      this.trailPositions[i * 3] = this.trailPositions[(i - 1) * 3];
      this.trailPositions[i * 3 + 1] = this.trailPositions[(i - 1) * 3 + 1];
      this.trailPositions[i * 3 + 2] = this.trailPositions[(i - 1) * 3 + 2];
    }
    // Current position at front
    this.trailPositions[0] = this.mesh.position.x;
    this.trailPositions[1] = this.mesh.position.y;
    this.trailPositions[2] = this.mesh.position.z;

    if (this.trailCount < Poop.TRAIL_LENGTH) this.trailCount++;

    (this.trailLine.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    this.trailLine.geometry.setDrawRange(0, this.trailCount);
  }

  private splat(): void {
    // Switch to flat circle on ground
    this.mesh.geometry = Poop.splatGeometry;
    this.mesh.material = Poop.splatMaterial;
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.scale.setScalar(1);
  }

  kill(): void {
    this.alive = false;
    this.grounded = false;
    this.mesh.visible = false;
    this.trailLine.visible = false;
  }
}
