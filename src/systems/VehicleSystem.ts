import * as THREE from 'three';
import { VEHICLES } from '../utils/Constants';
import type { Poop } from '../entities/Poop';
import type { NPC } from '../entities/NPC';
import { createToonMaterial } from '../rendering/ToonUtils';

type VehicleType = 'car' | 'taxi' | 'bus';

// Pond obstacle data
const POND_CENTER_X = 300;
const POND_CENTER_Z = 350;
const POND_RADIUS = 45;
const POND_MARGIN = 10;

interface Vehicle {
  mesh: THREE.Group;
  type: VehicleType;
  pathStart: THREE.Vector3;
  pathEnd: THREE.Vector3;
  pathLength: number;
  pathProgress: number;
  speed: number;
  coins: number;
  heat: number;
  hitCooldown: number;
  hitRadius: number;
  direction: 1 | -1;
  flashTimer: number;
}

export interface VehicleHitResult {
  coins: number;
  heat: number;
  position: THREE.Vector3;
}

/**
 * Vehicle System
 * Manages cars, taxis, and buses driving along streets
 */
export class VehicleSystem {
  private vehicles: Vehicle[] = [];
  private spawnTimer = 0;
  private streetPaths: THREE.Vector3[][];
  private npcList: NPC[] = [];
  readonly group = new THREE.Group();

  constructor(streetPaths: THREE.Vector3[][]) {
    // Filter out paths that cross through the pond
    this.streetPaths = streetPaths.filter(p => !this.pathCrossesPond(p));

    // Spawn initial batch
    for (let i = 0; i < Math.min(5, VEHICLES.MAX_COUNT); i++) {
      this.spawnVehicle();
    }
  }

  /** Provide NPC list so vehicles can brake for pedestrians */
  setNPCs(npcs: NPC[]): void {
    this.npcList = npcs;
  }

  /** Check if a street path passes through the pond area */
  private pathCrossesPond(path: THREE.Vector3[]): boolean {
    const p1 = path[0];
    const p2 = path[path.length - 1];
    // Sample several points along the path
    for (let t = 0; t <= 1; t += 0.2) {
      const x = p1.x + (p2.x - p1.x) * t;
      const z = p1.z + (p2.z - p1.z) * t;
      const dx = x - POND_CENTER_X;
      const dz = z - POND_CENTER_Z;
      if (dx * dx + dz * dz < (POND_RADIUS + POND_MARGIN) * (POND_RADIUS + POND_MARGIN)) {
        return true;
      }
    }
    return false;
  }

  private pickType(): VehicleType {
    const r = Math.random();
    if (r < VEHICLES.CAR_RATIO) return 'car';
    if (r < VEHICLES.CAR_RATIO + VEHICLES.TAXI_RATIO) return 'taxi';
    return 'bus';
  }

  private createMesh(type: VehicleType): THREE.Group {
    const group = new THREE.Group();
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.2, 6);
    const wheelMat = createToonMaterial(0x444444);

    if (type === 'bus') {
      const bodyColor = [0xFF6B6B, 0x87CEEB, 0x77DD77][Math.floor(Math.random() * 3)];
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 2.2, 7),
        createToonMaterial(bodyColor),
      );
      body.position.y = 1.6;
      group.add(body);

      // Windows
      const windows = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.8, 6.5),
        createToonMaterial(0x88ccff, { transparent: true, opacity: 0.5 }),
      );
      windows.position.y = 2.4;
      group.add(windows);

      // 4 wheels
      for (const [x, z] of [[-1.1, 2.2], [1.1, 2.2], [-1.1, -2.2], [1.1, -2.2]]) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(x, 0.35, z);
        group.add(w);
      }
    } else {
      // Car or Taxi
      const bodyColor = type === 'taxi' ? 0xffcc00 :
        [0xFFFFFF, 0xFF6B6B, 0x87CEEB, 0xFFD700, 0x98FB98][Math.floor(Math.random() * 5)];

      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2, 1, 4),
        createToonMaterial(bodyColor),
      );
      body.position.y = 0.8;
      group.add(body);

      // Cabin
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.8, 2.2),
        createToonMaterial(0x88ccff, { transparent: true, opacity: 0.5 }),
      );
      cabin.position.set(0, 1.6, -0.2);
      group.add(cabin);

      if (type === 'taxi') {
        const taxiLight = new THREE.Mesh(
          new THREE.BoxGeometry(0.4, 0.2, 0.6),
          createToonMaterial(0xFFFF00),
        );
        taxiLight.position.y = 2.1;
        group.add(taxiLight);
      }

      // 4 wheels
      for (const [x, z] of [[-0.9, 1.3], [0.9, 1.3], [-0.9, -1.3], [0.9, -1.3]]) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(x, 0.35, z);
        group.add(w);
      }
    }

    return group;
  }

  private spawnVehicle(nearPos?: THREE.Vector3): void {
    if (this.vehicles.length >= VEHICLES.MAX_COUNT || this.streetPaths.length === 0) return;

    let pathTemplate: THREE.Vector3[];
    if (nearPos) {
      const RANGE_SQ = VEHICLES.SPAWN_DISTANCE * VEHICLES.SPAWN_DISTANCE;
      const nearby = this.streetPaths.filter(p => {
        const mid = new THREE.Vector3().lerpVectors(p[0], p[p.length - 1], 0.5);
        const dx = mid.x - nearPos.x;
        const dz = mid.z - nearPos.z;
        return dx * dx + dz * dz < RANGE_SQ;
      });
      pathTemplate = nearby.length > 0
        ? nearby[Math.floor(Math.random() * nearby.length)]
        : this.streetPaths[Math.floor(Math.random() * this.streetPaths.length)];
    } else {
      pathTemplate = this.streetPaths[Math.floor(Math.random() * this.streetPaths.length)];
    }

    const type = this.pickType();
    const mesh = this.createMesh(type);

    const p1 = pathTemplate[0].clone();
    const p2 = pathTemplate[pathTemplate.length - 1].clone();
    p1.y = 0.01;
    p2.y = 0.01;

    mesh.position.copy(p1);

    // Face direction of travel
    const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
    mesh.rotation.y = Math.atan2(dir.x, dir.z);

    this.group.add(mesh);

    let speed: number, coins: number, heat: number, hitRadius: number;
    switch (type) {
      case 'car': speed = VEHICLES.CAR_SPEED; coins = VEHICLES.CAR_COINS; heat = VEHICLES.CAR_HEAT; hitRadius = VEHICLES.HIT_RADIUS; break;
      case 'taxi': speed = VEHICLES.TAXI_SPEED; coins = VEHICLES.TAXI_COINS; heat = VEHICLES.TAXI_HEAT; hitRadius = VEHICLES.HIT_RADIUS; break;
      case 'bus': speed = VEHICLES.BUS_SPEED; coins = VEHICLES.BUS_COINS; heat = VEHICLES.BUS_HEAT; hitRadius = VEHICLES.BUS_HIT_RADIUS; break;
    }

    this.vehicles.push({
      mesh, type,
      pathStart: p1, pathEnd: p2,
      pathLength: p1.distanceTo(p2),
      pathProgress: 0,
      speed, coins, heat, hitRadius,
      hitCooldown: 0,
      direction: 1,
      flashTimer: 0,
    });
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    // Spawn near player
    this.spawnTimer += dt;
    if (this.spawnTimer >= VEHICLES.SPAWN_INTERVAL && this.vehicles.length < VEHICLES.MAX_COUNT) {
      this.spawnTimer = 0;
      this.spawnVehicle(playerPos);
    }

    const DESPAWN_SQ = VEHICLES.DESPAWN_DISTANCE * VEHICLES.DESPAWN_DISTANCE;

    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];

      if (v.hitCooldown > 0) v.hitCooldown -= dt;

      // Flash timer
      if (v.flashTimer > 0) {
        v.flashTimer -= dt;
        // Blink effect
        v.mesh.visible = Math.sin(v.flashTimer * 20) > 0;
        if (v.flashTimer <= 0) v.mesh.visible = true;
      }

      // Check for NPCs ahead and brake (only for vehicles near the player)
      let speedMult = 1.0;
      const pdx = v.mesh.position.x - playerPos.x;
      const pdz = v.mesh.position.z - playerPos.z;
      if (pdx * pdx + pdz * pdz < 150 * 150) {
        const BRAKE_DIST_SQ = 10 * 10;
        const STOP_DIST_SQ = 4 * 4;
        let tdx = v.pathEnd.x - v.pathStart.x;
        let tdz = v.pathEnd.z - v.pathStart.z;
        const tdLen = Math.sqrt(tdx * tdx + tdz * tdz);
        if (tdLen > 0) { tdx /= tdLen; tdz /= tdLen; }
        if (v.direction < 0) { tdx = -tdx; tdz = -tdz; }

        for (let n = 0; n < this.npcList.length; n++) {
          const npc = this.npcList[n];
          if (npc.isHit || npc.isGrabbed) continue;
          const ndx = npc.mesh.position.x - v.mesh.position.x;
          const ndz = npc.mesh.position.z - v.mesh.position.z;
          const nDistSq = ndx * ndx + ndz * ndz;
          if (nDistSq < STOP_DIST_SQ) {
            speedMult = 0;
            npc.flee(v.mesh.position);
            break;
          } else if (nDistSq < BRAKE_DIST_SQ) {
            const dot = ndx * tdx + ndz * tdz;
            if (dot > 0) {
              const factor = nDistSq / BRAKE_DIST_SQ;
              speedMult = Math.min(speedMult, 0.2 + 0.8 * factor);
            }
          }
        }
      }

      // Move along path
      if (v.pathLength > 0) {
        v.pathProgress += (v.speed * speedMult * dt / v.pathLength) * v.direction;
      }

      // Bounce at ends
      if (v.pathProgress >= 1) { v.direction = -1; v.pathProgress = 1; }
      if (v.pathProgress <= 0) { v.direction = 1; v.pathProgress = 0; }

      // Interpolate position
      v.mesh.position.lerpVectors(v.pathStart, v.pathEnd, v.pathProgress);

      // Face travel direction
      const dir = new THREE.Vector3().subVectors(v.pathEnd, v.pathStart).normalize();
      if (v.direction < 0) dir.negate();
      v.mesh.rotation.y = Math.atan2(dir.x, dir.z);

      // Despawn if too far
      if (pdx * pdx + pdz * pdz > DESPAWN_SQ) {
        this.group.remove(v.mesh);
        this.vehicles.splice(i, 1);
      }
    }
  }

  checkPoopHits(activePoops: Poop[], onHit: (result: VehicleHitResult) => void): void {
    for (const poop of activePoops) {
      if (!poop.alive) continue;
      const poopPos = poop.mesh.position;

      for (const v of this.vehicles) {
        if (v.hitCooldown > 0) continue;

        const dx = poopPos.x - v.mesh.position.x;
        const dy = poopPos.y - v.mesh.position.y - 1; // Center is above ground
        const dz = poopPos.z - v.mesh.position.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < v.hitRadius * v.hitRadius) {
          v.hitCooldown = VEHICLES.HIT_COOLDOWN;
          v.flashTimer = 0.5;
          poop.kill();

          onHit({
            coins: v.coins,
            heat: v.heat,
            position: v.mesh.position.clone(),
          });
          break;
        }
      }
    }
  }
}
