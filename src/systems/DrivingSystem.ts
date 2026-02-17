import * as THREE from 'three';
import { DrivableCar } from '../entities/DrivableCar';
import { Bird } from '../entities/Bird';
import { InputManager } from '../core/InputManager';
import { BuildingData } from '../world/City';
import { DRIVING, FLIGHT } from '../utils/Constants';
import { clamp } from '../utils/MathUtils';

export interface DrivingUpdateResult {
  entered: boolean;
  exited: boolean;
  isDriving: boolean;
}

export class DrivingSystem {
  private cars: DrivableCar[] = [];
  readonly group = new THREE.Group();

  private activeCar: DrivableCar | null = null;
  private nearestCar: DrivableCar | null = null;

  constructor(buildings: BuildingData[], streetPaths: THREE.Vector3[][]) {
    this.spawnParkedCars(buildings, streetPaths);
  }

  get isNearCar(): boolean {
    return this.nearestCar !== null && this.activeCar === null;
  }

  get promptText(): string {
    return this.nearestCar && !this.activeCar ? '[Z] Drive' : '';
  }

  getActiveCar(): DrivableCar | null {
    return this.activeCar;
  }

  update(dt: number, bird: Bird, input: InputManager): DrivingUpdateResult {
    const result: DrivingUpdateResult = {
      entered: false,
      exited: false,
      isDriving: this.activeCar !== null,
    };

    if (this.activeCar) {
      // Currently driving
      if (input.wasInteractPressed()) {
        this.exitCar(bird);
        result.exited = true;
        result.isDriving = false;
        return result;
      }

      // Update car physics
      this.activeCar.update(dt, input);

      // Sync bird to seat
      this.syncBirdToCar(bird);
    } else {
      // Not driving — check proximity
      this.nearestCar = this.findNearestCar(bird);

      if (this.nearestCar && input.wasInteractPressed()) {
        const birdPos = bird.controller.position;
        if (birdPos.y < DRIVING.ENTER_MAX_ALTITUDE) {
          this.enterCar(this.nearestCar, bird);
          result.entered = true;
          result.isDriving = true;
        }
      }
    }

    return result;
  }

  private findNearestCar(bird: Bird): DrivableCar | null {
    const birdPos = bird.controller.position;
    if (birdPos.y > DRIVING.ENTER_MAX_ALTITUDE) return null;

    let nearest: DrivableCar | null = null;
    let bestDist = DRIVING.ENTER_DISTANCE;

    for (const car of this.cars) {
      if (car.occupied) continue;
      const dist = car.distanceTo(birdPos);
      if (dist < bestDist) {
        bestDist = dist;
        nearest = car;
      }
    }

    return nearest;
  }

  private enterCar(car: DrivableCar, bird: Bird): void {
    // Zero bird flight physics
    bird.controller.forwardSpeed = 0;
    bird.controller.pitchAngle = 0;
    bird.controller.rollAngle = 0;

    car.occupied = true;
    this.activeCar = car;

    // Snap bird to seat
    this.syncBirdToCar(bird);
  }

  private exitCar(bird: Bird): void {
    if (!this.activeCar) return;

    const car = this.activeCar;

    // Place bird beside the car, slightly elevated for takeoff
    const sideDir = new THREE.Vector3(
      Math.cos(car.heading), 0, -Math.sin(car.heading),
    );
    const exitPos = car.position.clone().add(sideDir.multiplyScalar(DRIVING.EXIT_OFFSET));
    exitPos.y = 2.0;

    bird.controller.position.copy(exitPos);
    bird.controller.yawAngle = car.heading;
    bird.controller.forwardSpeed = FLIGHT.GROUND_TAKEOFF_SPEED;
    bird.controller.pitchAngle = 0.2; // Slight upward pitch for takeoff feel
    bird.controller.rollAngle = 0;
    bird.controller.isGrounded = false;

    car.occupied = false;
    car.speed = 0;
    this.activeCar = null;
  }

  private syncBirdToCar(bird: Bird): void {
    const car = this.activeCar!;
    const seatWorld = car.getSeatWorldPos();
    bird.controller.position.copy(seatWorld);
    bird.controller.yawAngle = car.heading;
    bird.controller.pitchAngle = 0;
    bird.controller.rollAngle = 0;
    bird.controller.isGrounded = true;
  }

  private spawnParkedCars(buildings: BuildingData[], streetPaths: THREE.Vector3[][]): void {
    // Pick points along streets that aren't inside buildings
    const candidates: { pos: THREE.Vector3; heading: number }[] = [];

    for (const path of streetPaths) {
      if (path.length < 2) continue;
      const start = path[0];
      const end = path[path.length - 1];

      // Sample at 25%, 50%, 75% along the path
      for (const t of [0.25, 0.5, 0.75]) {
        const pos = new THREE.Vector3().lerpVectors(start, end, t);
        pos.y = 0.01;

        // Offset slightly to the side of the street (parked, not blocking)
        const dir = new THREE.Vector3().subVectors(end, start).normalize();
        const side = new THREE.Vector3(-dir.z, 0, dir.x); // perpendicular
        pos.add(side.multiplyScalar(3)); // 3 units to the side

        const heading = Math.atan2(-dir.x, -dir.z);

        if (!this.isInsideBuilding(pos, buildings)) {
          candidates.push({ pos, heading });
        }
      }
    }

    // Shuffle and pick up to CAR_COUNT, spread out
    this.shuffleArray(candidates);

    const MIN_SPACING_SQ = 100 * 100; // At least 100 units apart
    const chosen: { pos: THREE.Vector3; heading: number }[] = [];

    for (const c of candidates) {
      if (chosen.length >= DRIVING.CAR_COUNT) break;

      // Check spacing
      let tooClose = false;
      for (const existing of chosen) {
        const dx = c.pos.x - existing.pos.x;
        const dz = c.pos.z - existing.pos.z;
        if (dx * dx + dz * dz < MIN_SPACING_SQ) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      chosen.push(c);
    }

    // Fallback: if not enough candidates from streets, add manual positions
    if (chosen.length === 0) {
      chosen.push(
        { pos: new THREE.Vector3(50, 0.01, 30), heading: 0 },
        { pos: new THREE.Vector3(-120, 0.01, 80), heading: Math.PI / 2 },
        { pos: new THREE.Vector3(200, 0.01, -50), heading: -Math.PI / 4 },
      );
    }

    for (const sp of chosen) {
      const car = new DrivableCar(sp.pos, sp.heading);
      car.setBuildings(buildings);
      this.cars.push(car);
      this.group.add(car.mesh);
    }
  }

  private isInsideBuilding(pos: THREE.Vector3, buildings: BuildingData[]): boolean {
    const margin = 3.0;
    for (const b of buildings) {
      const halfW = b.width / 2 + margin;
      const halfD = b.depth / 2 + margin;
      if (
        pos.x >= b.position.x - halfW && pos.x <= b.position.x + halfW &&
        pos.z >= b.position.z - halfD && pos.z <= b.position.z + halfD
      ) {
        return true;
      }
    }
    return false;
  }

  private shuffleArray<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}
