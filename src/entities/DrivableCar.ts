import * as THREE from 'three';
import { InputManager } from '../core/InputManager';
import { BuildingData } from '../world/City';
import { DRIVING, WORLD } from '../utils/Constants';
import { clamp, moveToward, remap } from '../utils/MathUtils';
import { createToonMaterial } from '../rendering/ToonUtils';

export class DrivableCar {
  readonly mesh: THREE.Group;
  readonly position = new THREE.Vector3();
  heading = 0;
  speed = 0;
  steerAngle = 0;

  occupied = false;

  readonly seatOffset = new THREE.Vector3(0, 1.4, -0.3);

  private wheels: THREE.Mesh[] = [];
  private frontWheelPivots: THREE.Group[] = [];
  private taillights: THREE.Mesh[] = [];
  private buildings: BuildingData[] = [];

  constructor(spawnPos: THREE.Vector3, spawnHeading: number) {
    this.mesh = this.createMesh();
    this.position.copy(spawnPos);
    this.heading = spawnHeading;
    this.mesh.position.copy(spawnPos);
    this.mesh.rotation.y = spawnHeading;
  }

  setBuildings(buildings: BuildingData[]): void {
    this.buildings = buildings;
  }

  private createMesh(): THREE.Group {
    const group = new THREE.Group();

    const bodyColor = 0xFF4444; // Red convertible
    const bodyMat = createToonMaterial(bodyColor);

    // Lower body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.8, 4.2),
      bodyMat,
    );
    body.position.y = 0.6;
    group.add(body);

    // Door panels (raised sides, NO roof — convertible!)
    const doorMat = createToonMaterial(0xDD2222);
    for (const side of [-1, 1]) {
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.5, 2.4),
        doorMat,
      );
      door.position.set(side * 1.05, 1.15, -0.2);
      group.add(door);
    }

    // Windshield (small, angled, translucent)
    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.6, 0.08),
      createToonMaterial(0x88ccff, { transparent: true, opacity: 0.4 }),
    );
    windshield.position.set(0, 1.3, -1.3);
    windshield.rotation.x = -0.3;
    group.add(windshield);

    // Dashboard
    const dash = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.2, 0.4),
      createToonMaterial(0x444444),
    );
    dash.position.set(0, 1.0, -1.1);
    group.add(dash);

    // Seat (where the bird sits)
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.3, 0.6),
      createToonMaterial(0x8B6914),
    );
    seat.position.set(0, 0.95, -0.3);
    group.add(seat);

    // Trunk / rear
    const rear = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.5, 0.8),
      bodyMat,
    );
    rear.position.set(0, 0.85, 1.5);
    group.add(rear);

    // Hood (front)
    const hood = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.3, 1.2),
      bodyMat,
    );
    hood.position.set(0, 0.85, -1.8);
    group.add(hood);

    // Headlights
    const lightMat = createToonMaterial(0xFFFFCC);
    for (const side of [-0.7, 0.7]) {
      const light = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 6, 4),
        lightMat,
      );
      light.position.set(side, 0.7, -2.35);
      group.add(light);
    }

    // Taillights
    const tailMat = createToonMaterial(0xFF4400);
    for (const side of [-0.7, 0.7]) {
      const tl = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 4),
        tailMat,
      );
      tl.position.set(side, 0.7, 1.95);
      group.add(tl);
      this.taillights.push(tl);
    }

    // Wheels with steering pivots
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.25, 8);
    const wheelMat = createToonMaterial(0x444444);

    const wheelPositions: [number, number, boolean][] = [
      [-0.95, -1.3, true],   // front-left
      [0.95, -1.3, true],    // front-right
      [-0.95, 1.3, false],   // rear-left
      [0.95, 1.3, false],    // rear-right
    ];

    for (const [x, z, isFront] of wheelPositions) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.4, z);

      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      pivot.add(wheel);

      group.add(pivot);
      this.wheels.push(wheel);
      if (isFront) this.frontWheelPivots.push(pivot);
    }

    return group;
  }

  update(dt: number, input: InputManager): void {
    if (!this.occupied) return;

    const steerInput = input.getAxis('horizontal');
    const throttleInput = input.getAxis('vertical');
    const handbrakeInput = input.isAscending(); // Space = handbrake

    // --- Throttle / Braking ---
    if (throttleInput > 0) {
      this.speed += DRIVING.ACCELERATION * dt;
    } else if (throttleInput < 0) {
      if (this.speed > 0.5) {
        // Brake while moving forward
        this.speed -= DRIVING.BRAKE_FORCE * dt;
      } else {
        // Reverse
        this.speed -= DRIVING.REVERSE_ACCELERATION * dt;
      }
    } else {
      // Coast — friction
      this.speed = moveToward(this.speed, 0, DRIVING.FRICTION * dt);
    }

    // Handbrake
    if (handbrakeInput) {
      this.speed = moveToward(this.speed, 0, DRIVING.HANDBRAKE_FORCE * dt);
    }

    // Clamp speed
    this.speed = clamp(this.speed, -DRIVING.MAX_REVERSE_SPEED, DRIVING.MAX_SPEED);

    // --- Steering ---
    const speedFactor = remap(Math.abs(this.speed), 0, DRIVING.MAX_SPEED, 1.0, 0.4);
    const targetSteer = -steerInput * DRIVING.MAX_STEER_ANGLE * speedFactor;
    this.steerAngle = moveToward(this.steerAngle, targetSteer, DRIVING.STEER_SPEED * dt);

    // Return steering to center when no input
    if (Math.abs(steerInput) < 0.01) {
      this.steerAngle = moveToward(this.steerAngle, 0, DRIVING.STEER_SPEED * 2 * dt);
    }

    // --- Bicycle model turning ---
    if (Math.abs(this.steerAngle) > 0.001 && Math.abs(this.speed) > 0.1) {
      const turnRadius = DRIVING.WHEELBASE / Math.tan(this.steerAngle);
      const angularVelocity = this.speed / turnRadius;
      this.heading += angularVelocity * dt;
    }

    // --- Movement ---
    const forward = new THREE.Vector3(
      -Math.sin(this.heading),
      0,
      -Math.cos(this.heading),
    );
    const displacement = forward.multiplyScalar(this.speed * dt);

    this.moveWithCollision(displacement);

    // Keep on ground
    this.position.y = 0.01;

    // Soft boundary
    this.applySoftBoundary(dt);

    // --- Sync mesh ---
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.heading;

    // --- Wheel animation ---
    const wheelRadius = 0.4;
    const wheelSpin = (this.speed / wheelRadius) * dt;
    for (const w of this.wheels) {
      w.rotation.x += wheelSpin;
    }
    for (const pivot of this.frontWheelPivots) {
      pivot.rotation.y = this.steerAngle * 0.5;
    }

    // --- Brake lights glow when braking ---
    const braking = throttleInput < 0 && this.speed > 0.5 || handbrakeInput;
    for (const tl of this.taillights) {
      const mat = tl.material as THREE.MeshToonMaterial;
      mat.color.setHex(braking ? 0xFF0000 : 0xFF4400);
    }
  }

  getSeatWorldPos(): THREE.Vector3 {
    const seat = this.seatOffset.clone();
    seat.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
    return this.position.clone().add(seat);
  }

  getQuaternion(): THREE.Quaternion {
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.heading, 0));
  }

  distanceTo(pos: THREE.Vector3): number {
    const dx = pos.x - this.position.x;
    const dz = pos.z - this.position.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  // --- Collision (adapted from FlightController pattern) ---

  private moveWithCollision(displacement: THREE.Vector3): void {
    const SUBSTEP_SIZE = 1.5;
    const totalDist = displacement.length();
    if (totalDist < 0.0001) return;

    const numSteps = Math.max(1, Math.ceil(totalDist / SUBSTEP_SIZE));
    const stepDisplacement = displacement.clone().divideScalar(numSteps);

    for (let i = 0; i < numSteps; i++) {
      const newPosition = this.position.clone().add(stepDisplacement);
      const collision = this.checkBuildingCollision(newPosition);

      if (collision.hit) {
        // Try sliding along wall
        const slide = this.calculateSlideMovement(stepDisplacement, collision.normal);
        const slidePos = this.position.clone().add(slide);
        const slideCheck = this.checkBuildingCollision(slidePos);

        if (!slideCheck.hit) {
          this.position.copy(slidePos);
        } else {
          // Blocked — bounce stop
          this.speed *= 0.3;
          break;
        }
      } else {
        this.position.add(stepDisplacement);
      }
    }

    this.depenetrate();
  }

  private checkBuildingCollision(newPos: THREE.Vector3): { hit: boolean; normal: THREE.Vector3 } {
    const carRadius = DRIVING.COLLISION_RADIUS;

    for (const b of this.buildings) {
      if (b.height < 0.5) continue;
      const halfW = b.width / 2;
      const halfD = b.depth / 2;

      const closestX = clamp(newPos.x, b.position.x - halfW, b.position.x + halfW);
      const closestZ = clamp(newPos.z, b.position.z - halfD, b.position.z + halfD);

      const dx = newPos.x - closestX;
      const dz = newPos.z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < carRadius * carRadius) {
        const normal = new THREE.Vector3(dx, 0, dz);
        if (normal.lengthSq() > 0.0001) normal.normalize();
        else normal.set(1, 0, 0);
        return { hit: true, normal };
      }
    }

    return { hit: false, normal: new THREE.Vector3() };
  }

  private calculateSlideMovement(displacement: THREE.Vector3, normal: THREE.Vector3): THREE.Vector3 {
    const dot = displacement.dot(normal);
    if (dot < 0) {
      const slide = displacement.clone();
      slide.addScaledVector(normal, -dot);
      return slide.multiplyScalar(0.6);
    }
    return displacement;
  }

  private depenetrate(): void {
    const carRadius = DRIVING.COLLISION_RADIUS;
    const px = this.position.x;
    const pz = this.position.z;

    for (const b of this.buildings) {
      if (b.height < 0.5) continue;
      const halfW = b.width / 2;
      const halfD = b.depth / 2;

      const closestX = clamp(px, b.position.x - halfW, b.position.x + halfW);
      const closestZ = clamp(pz, b.position.z - halfD, b.position.z + halfD);

      const dx = px - closestX;
      const dz = pz - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < carRadius * carRadius) {
        if (distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const pushDist = carRadius - dist + 0.1;
          this.position.x += (dx / dist) * pushDist;
          this.position.z += (dz / dist) * pushDist;
        } else {
          // Fully inside — push to nearest face
          const distToLeft = Math.abs(px - (b.position.x - halfW));
          const distToRight = Math.abs(px - (b.position.x + halfW));
          const distToFront = Math.abs(pz - (b.position.z - halfD));
          const distToBack = Math.abs(pz - (b.position.z + halfD));
          const minDist = Math.min(distToLeft, distToRight, distToFront, distToBack);

          if (minDist === distToLeft) this.position.x = b.position.x - halfW - carRadius - 0.1;
          else if (minDist === distToRight) this.position.x = b.position.x + halfW + carRadius + 0.1;
          else if (minDist === distToFront) this.position.z = b.position.z - halfD - carRadius - 0.1;
          else this.position.z = b.position.z + halfD + carRadius + 0.1;
        }

        this.speed *= 0.3;
        return;
      }
    }
  }

  private applySoftBoundary(dt: number): void {
    const soft = WORLD.BOUNDARY_SOFT_EDGE;
    const hard = WORLD.BOUNDARY_HARD_EDGE;
    const strength = WORLD.BOUNDARY_PUSH_STRENGTH;

    const pushAxis = (val: number): number => {
      if (val > soft) {
        const t = clamp((val - soft) / (hard - soft), 0, 1);
        return -t * t * strength * dt;
      }
      if (val < -soft) {
        const t = clamp((-val - soft) / (hard - soft), 0, 1);
        return t * t * strength * dt;
      }
      return 0;
    };

    this.position.x += pushAxis(this.position.x);
    this.position.z += pushAxis(this.position.z);
    this.position.x = clamp(this.position.x, -hard, hard);
    this.position.z = clamp(this.position.z, -hard, hard);
  }
}
