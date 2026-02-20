import * as THREE from 'three';
import { DrivableCar, DrivableVehicleType } from '../entities/DrivableCar';
import { Bird } from '../entities/Bird';
import { InputManager } from '../core/InputManager';
import { BuildingData } from '../world/City';
import type { NPC } from '../entities/NPC';
import { DRIVING, FLIGHT } from '../utils/Constants';

export interface DrivingNPCHit {
  npc: NPC;
  position: THREE.Vector3;
  impactSpeed: number;
}

export interface DrivingUpdateResult {
  entered: boolean;
  exited: boolean;
  isDriving: boolean;
  npcHits: DrivingNPCHit[];
}

export class DrivingSystem {
  private vehicles: DrivableCar[] = [];
  private npcList: NPC[] = [];
  private streetPaths: THREE.Vector3[][];
  readonly group = new THREE.Group();

  private activeCar: DrivableCar | null = null;
  private nearestCar: DrivableCar | null = null;
  private roamingHorse: DrivableCar | null = null;
  private roamingPath: {
    start: THREE.Vector3;
    end: THREE.Vector3;
    length: number;
    progress: number;
    direction: 1 | -1;
    speed: number;
  } | null = null;
  private horseRelocateTimer = 0;

  constructor(buildings: BuildingData[], streetPaths: THREE.Vector3[][]) {
    this.streetPaths = streetPaths;
    this.spawnParkedVehicles(buildings, streetPaths);
    this.assignRoamingHorse();
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

  setNPCs(npcs: NPC[]): void {
    this.npcList = npcs;
  }

  update(dt: number, bird: Bird, input: InputManager): DrivingUpdateResult {
    const result: DrivingUpdateResult = {
      entered: false,
      exited: false,
      isDriving: this.activeCar !== null,
      npcHits: [],
    };

    if (this.activeCar) {
      if (input.wasInteractPressed()) {
        this.exitCar(bird);
        result.exited = true;
        result.isDriving = false;
        return result;
      }

      this.activeCar.update(dt, input);
      this.syncBirdToCar(bird);
      this.collectNPCHitsForActiveVehicle(result.npcHits);
    } else {
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

    this.updateRoamingHorse(dt, bird.controller.position);

    return result;
  }

  private collectNPCHitsForActiveVehicle(outHits: DrivingNPCHit[]): void {
    const car = this.activeCar;
    if (!car) return;

    const impactSpeed = car.getImpactSpeed();
    if (impactSpeed < 2.5) return;

    const carPos = car.position;
    const carRadius = car.getCollisionRadius();

    for (let i = 0; i < this.npcList.length; i++) {
      const npc = this.npcList[i];
      if (npc.isHit || npc.isGrabbed || npc.shouldDespawn) continue;

      const npcPos = npc.mesh.position;
      if (Math.abs(carPos.y - npcPos.y) > 4.5) continue;

      const dx = npcPos.x - carPos.x;
      const dz = npcPos.z - carPos.z;
      const hitRadius = carRadius + npc.boundingRadius;
      if (dx * dx + dz * dz > hitRadius * hitRadius) continue;

      outHits.push({
        npc,
        position: npcPos.clone(),
        impactSpeed,
      });
    }
  }

  private findNearestCar(bird: Bird): DrivableCar | null {
    const birdPos = bird.controller.position;
    if (birdPos.y > DRIVING.ENTER_MAX_ALTITUDE) return null;

    let nearest: DrivableCar | null = null;
    let bestDist = DRIVING.ENTER_DISTANCE;

    for (const car of this.vehicles) {
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
    bird.controller.forwardSpeed = 0;
    bird.controller.pitchAngle = 0;
    bird.controller.rollAngle = 0;

    car.occupied = true;
    this.activeCar = car;

    this.syncBirdToCar(bird);
  }

  private exitCar(bird: Bird): void {
    if (!this.activeCar) return;

    const car = this.activeCar;

    const sideDir = new THREE.Vector3(
      Math.cos(car.heading), 0, -Math.sin(car.heading),
    );
    const exitPos = car.position.clone().add(sideDir.multiplyScalar(DRIVING.EXIT_OFFSET));
    exitPos.y = Math.max(2.0, car.position.y + 1.0);

    bird.controller.position.copy(exitPos);
    bird.controller.yawAngle = car.heading;
    bird.controller.forwardSpeed = FLIGHT.GROUND_TAKEOFF_SPEED;
    bird.controller.pitchAngle = 0.2;
    bird.controller.rollAngle = 0;
    bird.controller.isGrounded = false;

    car.occupied = false;
    car.speed = 0;
    car.verticalSpeed = 0;
    if (car === this.roamingHorse) {
      this.configureRoamingPath(car.position);
    }
    this.activeCar = null;
  }

  private assignRoamingHorse(): void {
    this.roamingHorse = this.vehicles.find((v) => v.type === 'horse') ?? null;
    if (!this.roamingHorse) return;
    this.roamingHorse.speed = 0;
    this.configureRoamingPath(this.roamingHorse.position);
  }

  private updateRoamingHorse(dt: number, playerPos: THREE.Vector3): void {
    if (!this.roamingHorse) return;
    if (this.activeCar === this.roamingHorse) return;
    if (!this.roamingPath) this.configureRoamingPath(this.roamingHorse.position);
    if (!this.roamingPath) return;

    this.horseRelocateTimer -= dt;

    const horsePos = this.roamingHorse.position;
    const dx = horsePos.x - playerPos.x;
    const dz = horsePos.z - playerPos.z;
    const distSq = dx * dx + dz * dz;

    // Keep the horse discoverable by relocating it onto a nearby street if it drifts too far.
    if (this.horseRelocateTimer <= 0 && distSq > 450 * 450) {
      this.configureRoamingPath(playerPos);
      this.horseRelocateTimer = 8;
    }

    const path = this.roamingPath;
    path.progress += (path.speed * dt / Math.max(path.length, 0.001)) * path.direction;
    if (path.progress >= 1) {
      path.progress = 1;
      path.direction = -1;
    } else if (path.progress <= 0) {
      path.progress = 0;
      path.direction = 1;
    }

    horsePos.lerpVectors(path.start, path.end, path.progress);
    horsePos.y = 0.01;
    this.roamingHorse.speed = path.speed * path.direction;

    const dir = new THREE.Vector3().subVectors(path.end, path.start).normalize();
    if (path.direction < 0) dir.negate();
    this.roamingHorse.heading = Math.atan2(-dir.x, -dir.z);
    this.roamingHorse.mesh.position.copy(horsePos);
    this.roamingHorse.mesh.rotation.y = this.roamingHorse.heading;
  }

  private configureRoamingPath(anchor: THREE.Vector3): void {
    if (!this.roamingHorse || this.streetPaths.length === 0) return;

    let bestPath: THREE.Vector3[] | null = null;
    let bestDistSq = Number.POSITIVE_INFINITY;

    for (const path of this.streetPaths) {
      if (path.length < 2) continue;
      const p1 = path[0];
      const p2 = path[path.length - 1];
      const midX = (p1.x + p2.x) * 0.5;
      const midZ = (p1.z + p2.z) * 0.5;
      const dx = midX - anchor.x;
      const dz = midZ - anchor.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestPath = path;
      }
    }

    if (!bestPath) return;

    const start = bestPath[0].clone();
    const end = bestPath[bestPath.length - 1].clone();
    start.y = 0.01;
    end.y = 0.01;

    const segX = end.x - start.x;
    const segZ = end.z - start.z;
    const segLenSq = segX * segX + segZ * segZ;
    let progress = 0.5;
    if (segLenSq > 0.0001) {
      const t = ((anchor.x - start.x) * segX + (anchor.z - start.z) * segZ) / segLenSq;
      progress = Math.max(0, Math.min(1, t));
    }

    this.roamingPath = {
      start,
      end,
      length: Math.max(start.distanceTo(end), 0.001),
      progress,
      direction: Math.random() < 0.5 ? 1 : -1,
      speed: 10 + Math.random() * 3,
    };

    this.roamingHorse.position.lerpVectors(start, end, progress);
    this.roamingHorse.position.y = 0.01;
    this.roamingHorse.mesh.position.copy(this.roamingHorse.position);
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

  private spawnParkedVehicles(buildings: BuildingData[], streetPaths: THREE.Vector3[][]): void {
    const totalCount =
      DRIVING.CAR_COUNT +
      DRIVING.MOTORCYCLE_COUNT +
      DRIVING.HELICOPTER_COUNT +
      DRIVING.PROP_PLANE_COUNT +
      DRIVING.HORSE_COUNT;

    const candidates: { pos: THREE.Vector3; heading: number }[] = [];

    for (const path of streetPaths) {
      if (path.length < 2) continue;
      const start = path[0];
      const end = path[path.length - 1];

      for (const t of [0.2, 0.35, 0.5, 0.65, 0.8]) {
        const pos = new THREE.Vector3().lerpVectors(start, end, t);
        pos.y = 0.01;

        const dir = new THREE.Vector3().subVectors(end, start).normalize();
        const side = new THREE.Vector3(-dir.z, 0, dir.x);
        pos.add(side.multiplyScalar(3));

        const heading = Math.atan2(-dir.x, -dir.z);

        if (!this.isInsideBuilding(pos, buildings)) {
          candidates.push({ pos, heading });
        }
      }
    }

    this.shuffleArray(candidates);

    const MIN_SPACING_SQ = 70 * 70;
    const chosen: { pos: THREE.Vector3; heading: number }[] = [];

    for (const c of candidates) {
      if (chosen.length >= totalCount) break;

      const tooClose = chosen.some((existing) => {
        const dx = c.pos.x - existing.pos.x;
        const dz = c.pos.z - existing.pos.z;
        return dx * dx + dz * dz < MIN_SPACING_SQ;
      });
      if (tooClose) continue;

      chosen.push(c);
    }

    if (chosen.length < totalCount) {
      const RELAXED_SPACING_SQ = 35 * 35;
      for (const c of candidates) {
        if (chosen.length >= totalCount) break;
        if (chosen.some((existing) => {
          const dx = c.pos.x - existing.pos.x;
          const dz = c.pos.z - existing.pos.z;
          return dx * dx + dz * dz < RELAXED_SPACING_SQ;
        })) {
          continue;
        }
        chosen.push(c);
      }
    }

    if (chosen.length < totalCount) {
      const fallbackSpawns = [
        { pos: new THREE.Vector3(50, 0.01, 30), heading: 0 },
        { pos: new THREE.Vector3(-120, 0.01, 80), heading: Math.PI / 2 },
        { pos: new THREE.Vector3(200, 0.01, -50), heading: -Math.PI / 4 },
        { pos: new THREE.Vector3(-220, 0.01, -120), heading: Math.PI / 3 },
        { pos: new THREE.Vector3(120, 0.01, 180), heading: -Math.PI / 2 },
        { pos: new THREE.Vector3(-40, 0.01, -220), heading: Math.PI },
        { pos: new THREE.Vector3(260, 0.01, 140), heading: -Math.PI * 0.65 },
        { pos: new THREE.Vector3(-290, 0.01, 40), heading: Math.PI * 0.2 },
        { pos: new THREE.Vector3(20, 0.01, 260), heading: Math.PI },
      ];

      for (const fallback of fallbackSpawns) {
        if (chosen.length >= totalCount) break;
        if (this.isInsideBuilding(fallback.pos, buildings)) continue;
        chosen.push({ pos: fallback.pos.clone(), heading: fallback.heading });
      }
    }

    const vehicleTypes = this.buildVehicleTypeList(chosen.length);

    for (let i = 0; i < chosen.length && i < vehicleTypes.length; i++) {
      const sp = chosen[i];
      const type = vehicleTypes[i];
      const car = new DrivableCar(sp.pos, sp.heading, type);
      car.setBuildings(buildings);
      this.vehicles.push(car);
      this.group.add(car.mesh);
    }
  }

  private buildVehicleTypeList(maxSlots: number): DrivableVehicleType[] {
    const out: DrivableVehicleType[] = [];
    const remaining = new Map<DrivableVehicleType, number>([
      ['car', DRIVING.CAR_COUNT],
      ['motorcycle', DRIVING.MOTORCYCLE_COUNT],
      ['helicopter', DRIVING.HELICOPTER_COUNT],
      ['prop_plane', DRIVING.PROP_PLANE_COUNT],
      ['horse', DRIVING.HORSE_COUNT],
    ]);

    const tryPush = (type: DrivableVehicleType): boolean => {
      if (out.length >= maxSlots) return false;
      const left = remaining.get(type) ?? 0;
      if (left <= 0) return false;
      out.push(type);
      remaining.set(type, left - 1);
      return true;
    };

    // Guarantee these "special" drivable types when slots are constrained.
    tryPush('helicopter');
    tryPush('prop_plane');
    tryPush('horse');

    const fillOrder: DrivableVehicleType[] = ['car', 'motorcycle', 'helicopter', 'prop_plane', 'horse'];
    while (out.length < maxSlots) {
      let pushedAny = false;
      for (const type of fillOrder) {
        if (tryPush(type)) {
          pushedAny = true;
          if (out.length >= maxSlots) break;
        }
      }
      if (!pushedAny) break;
    }

    this.shuffleArray(out);
    return out;
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
