import * as THREE from 'three';
import { NPC, NPCType } from './NPC';
import { NPC_CONFIG } from '../utils/Constants';
import type { BuildingData } from '../world/City';

// Pond obstacle data (Park & Pond district)
const POND_CENTER_X = 300;
const POND_CENTER_Z = 350;
const POND_RADIUS = 45;
const POND_MARGIN = 8; // Extra buffer so NPCs don't clip the edge

// Spatial hash grid for fast building lookups
const GRID_CELL_SIZE = 50;

class BuildingGrid {
  private cells = new Map<string, BuildingData[]>();

  build(buildings: BuildingData[]): void {
    this.cells.clear();
    for (const b of buildings) {
      const halfW = b.width * 0.5;
      const halfD = b.depth * 0.5;
      const minCX = Math.floor((b.position.x - halfW) / GRID_CELL_SIZE);
      const maxCX = Math.floor((b.position.x + halfW) / GRID_CELL_SIZE);
      const minCZ = Math.floor((b.position.z - halfD) / GRID_CELL_SIZE);
      const maxCZ = Math.floor((b.position.z + halfD) / GRID_CELL_SIZE);
      for (let cx = minCX; cx <= maxCX; cx++) {
        for (let cz = minCZ; cz <= maxCZ; cz++) {
          const key = `${cx},${cz}`;
          let cell = this.cells.get(key);
          if (!cell) { cell = []; this.cells.set(key, cell); }
          cell.push(b);
        }
      }
    }
  }

  query(x: number, z: number): BuildingData[] {
    const key = `${Math.floor(x / GRID_CELL_SIZE)},${Math.floor(z / GRID_CELL_SIZE)}`;
    return this.cells.get(key) || [];
  }
}

// District center points for ambient population spawning
const DISTRICT_CENTERS: { x: number; z: number; radius: number }[] = [
  { x: -375, z: 600, radius: 150 },  // Boardwalk & Beach
  { x: 375,  z: 600, radius: 150 },  // Harbor
  { x: -500, z: 350, radius: 130 },  // Suburbs West
  { x: -50,  z: 350, radius: 120 },  // Downtown Core
  { x: 300,  z: 350, radius: 100 },  // Park & Pond
  { x: 575,  z: 350, radius: 100 },  // University Campus
  { x: -525, z: 50,  radius: 120 },  // Market Street
  { x: -150, z: 50,  radius: 100 },  // Financial District
  { x: 175,  z: 50,  radius: 110 },  // Shopping Plaza
  { x: 545,  z: 50,  radius: 120 },  // Stadium District
  { x: -475, z: -250, radius: 120 }, // Industrial Zone
  { x: 50,   z: -250, radius: 120 }, // Warehouse District
  { x: 525,  z: -250, radius: 120 }, // Cemetery
  { x: -225, z: -550, radius: 180 }, // Airport
  { x: 525,  z: -550, radius: 130 }, // Entertainment
];

export class NPCManager {
  readonly npcs: NPC[] = [];
  private scene: THREE.Scene;
  private streetPaths: THREE.Vector3[][];
  private spawnTimer = 0;
  private ambientTimer = 0;
  private hotspotPositions: THREE.Vector3[] = [];
  private hotspotRadius = 40;
  private playerPosition = new THREE.Vector3();
  private buildings: BuildingData[] = [];
  private buildingGrid = new BuildingGrid();

  constructor(scene: THREE.Scene, streetPaths: THREE.Vector3[][]) {
    this.scene = scene;
    this.streetPaths = streetPaths;

    if (streetPaths.length === 0) {
      console.warn('No street paths available — NPCs will not spawn.');
      return;
    }

    // Spawn initial batch
    for (let i = 0; i < NPC_CONFIG.COUNT; i++) {
      this.spawnNPC();
    }

    console.log(`NPCManager: spawned ${this.npcs.length} initial NPCs across ${streetPaths.length} paths`);
  }

  /** Provide building data for NPC collision avoidance */
  setBuildings(buildings: BuildingData[]): void {
    this.buildings = buildings;
    this.buildingGrid.build(buildings);
  }

  /** AABB check: is the given XZ point inside any building footprint? */
  private isInsideBuilding(x: number, z: number): boolean {
    const candidates = this.buildingGrid.query(x, z);
    for (const b of candidates) {
      const halfW = b.width * 0.5;
      const halfD = b.depth * 0.5;
      if (
        x > b.position.x - halfW && x < b.position.x + halfW &&
        z > b.position.z - halfD && z < b.position.z + halfD
      ) {
        return true;
      }
    }
    return false;
  }

  /** Circular check: is the given XZ point inside the pond (with margin)? */
  private isInsidePond(x: number, z: number): boolean {
    const dx = x - POND_CENTER_X;
    const dz = z - POND_CENTER_Z;
    const r = POND_RADIUS + POND_MARGIN;
    return dx * dx + dz * dz < r * r;
  }

  /** Combined obstacle check: building OR pond */
  private isInsideObstacle(x: number, z: number): boolean {
    return this.isInsideBuilding(x, z) || this.isInsidePond(x, z);
  }

  setHotspots(positions: THREE.Vector3[], radius: number): void {
    this.hotspotPositions = positions;
    this.hotspotRadius = radius;

    // Spawn cluster of NPCs at each hotspot
    for (const hotspotPos of positions) {
      const clusterSize = 15 + Math.floor(Math.random() * 15);
      for (let i = 0; i < clusterSize; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * radius * 0.8;
        const pos = new THREE.Vector3(
          hotspotPos.x + Math.cos(angle) * dist,
          0,
          hotspotPos.z + Math.sin(angle) * dist
        );
        const type = Math.random() < 0.3 ? 'performer' : this.pickType();
        this.spawnNPCAt(pos, type);
      }
    }
  }

  /** Alert nearby NPCs to flee from a hit location */
  alertNearby(hitPosition: THREE.Vector3): void {
    const fleeRadiusSq = NPC_CONFIG.FLEE_RADIUS * NPC_CONFIG.FLEE_RADIUS;
    for (const npc of this.npcs) {
      if (npc.isHit || npc.isGrabbed) continue;
      const dx = npc.mesh.position.x - hitPosition.x;
      const dz = npc.mesh.position.z - hitPosition.z;
      if (dx * dx + dz * dz < fleeRadiusSq) {
        npc.flee(hitPosition);
      }
    }
  }

  private pickType(): NPCType {
    const roll = Math.random();
    let cumulative = 0;

    cumulative += NPC_CONFIG.TOURIST_RATIO;
    if (roll < cumulative) return 'tourist';

    cumulative += NPC_CONFIG.BUSINESS_RATIO;
    if (roll < cumulative) return 'business';

    cumulative += NPC_CONFIG.PERFORMER_RATIO;
    if (roll < cumulative) return 'performer';

    cumulative += NPC_CONFIG.POLICE_RATIO;
    if (roll < cumulative) return 'police';

    cumulative += NPC_CONFIG.CHEF_RATIO;
    if (roll < cumulative) return 'chef';

    cumulative += NPC_CONFIG.TREEMAN_RATIO;
    if (roll < cumulative) return 'treeman';

    cumulative += NPC_CONFIG.GLAMOROUS_ELEGANCE_RATIO;
    if (roll < cumulative) return 'glamorous-elegance';

    return 'tourist';
  }

  private getSpeedForType(type: NPCType): number {
    switch (type) {
      case 'tourist': return NPC_CONFIG.TOURIST_SPEED;
      case 'business': return NPC_CONFIG.BUSINESS_SPEED;
      case 'performer': return NPC_CONFIG.PERFORMER_SPEED;
      case 'police': return NPC_CONFIG.POLICE_SPEED;
      case 'chef': return NPC_CONFIG.CHEF_SPEED;
      case 'treeman': return NPC_CONFIG.TREEMAN_SPEED;
      case 'glamorous-elegance': return NPC_CONFIG.GLAMOROUS_ELEGANCE_SPEED;
    }
  }

  private spawnNPC(): void {
    if (this.streetPaths.length === 0) return;

    const pathTemplate = this.streetPaths[Math.floor(Math.random() * this.streetPaths.length)];
    const path = this.createSubPath(pathTemplate);
    const type = this.pickType();
    const speed = this.varySpeed(this.getSpeedForType(type));

    const npc = new NPC(path, speed, type);
    this.scene.add(npc.mesh);
    this.npcs.push(npc);
  }

  /** Add ±25% random variation to a base speed so same-type NPCs don't walk in lockstep */
  private varySpeed(base: number): number {
    return base * (0.75 + Math.random() * 0.5);
  }

  /** Spawn an NPC on a street path near the player */
  private spawnNearPlayer(): void {
    if (this.streetPaths.length === 0) return;

    // Find street paths within spawn range of the player (XZ only)
    const SPAWN_RANGE = 350;
    const SPAWN_RANGE_SQ = SPAWN_RANGE * SPAWN_RANGE;
    const nearby: THREE.Vector3[][] = [];

    for (const path of this.streetPaths) {
      // Check midpoint of path
      const mid = new THREE.Vector3().lerpVectors(path[0], path[path.length - 1], 0.5);
      const dx = mid.x - this.playerPosition.x;
      const dz = mid.z - this.playerPosition.z;
      if (dx * dx + dz * dz < SPAWN_RANGE_SQ) {
        nearby.push(path);
      }
    }

    if (nearby.length === 0) {
      // Fallback to random path
      this.spawnNPC();
      return;
    }

    const pathTemplate = nearby[Math.floor(Math.random() * nearby.length)];
    const path = this.createSubPath(pathTemplate);
    const type = this.pickType();
    const speed = this.varySpeed(this.getSpeedForType(type));

    const npc = new NPC(path, speed, type);
    this.scene.add(npc.mesh);
    this.npcs.push(npc);
  }

  /** Spawn NPCs scattered across the entire map for ambient population */
  private spawnGlobal(): void {
    if (this.streetPaths.length === 0) return;
    const pathTemplate = this.streetPaths[Math.floor(Math.random() * this.streetPaths.length)];
    const path = this.createSubPath(pathTemplate);
    const type = this.pickType();
    const speed = this.varySpeed(this.getSpeedForType(type));

    const npc = new NPC(path, speed, type);
    this.scene.add(npc.mesh);
    this.npcs.push(npc);
  }

  /** Spawn NPCs in a specific district center area */
  private spawnInDistrict(center: { x: number; z: number; radius: number }): void {
    // Find street paths that pass through this district
    const districtPaths: THREE.Vector3[][] = [];
    for (const path of this.streetPaths) {
      const mid = new THREE.Vector3().lerpVectors(path[0], path[path.length - 1], 0.5);
      const dx = mid.x - center.x;
      const dz = mid.z - center.z;
      if (dx * dx + dz * dz < center.radius * center.radius * 4) {
        districtPaths.push(path);
      }
    }

    if (districtPaths.length === 0) return;

    const pathTemplate = districtPaths[Math.floor(Math.random() * districtPaths.length)];
    const path = this.createSubPath(pathTemplate);
    const type = this.pickType();
    const speed = this.varySpeed(this.getSpeedForType(type));

    const npc = new NPC(path, speed, type);
    this.scene.add(npc.mesh);
    this.npcs.push(npc);
  }

  private createSubPath(fullPath: THREE.Vector3[]): THREE.Vector3[] {
    const start = fullPath[0].clone();
    const end = fullPath[fullPath.length - 1].clone();
    const dir = new THREE.Vector3().subVectors(end, start);
    const length = dir.length();

    const segmentLength = 15 + Math.random() * 30;
    const segmentStart = Math.random() * Math.max(0, length - segmentLength);

    dir.normalize();

    // Add slight angular deviation (±15°) so NPCs don't all walk perfectly parallel
    const angleDeviation = (Math.random() - 0.5) * 0.52; // ~±15 degrees in radians
    const cosA = Math.cos(angleDeviation);
    const sinA = Math.sin(angleDeviation);
    const devDir = new THREE.Vector3(
      dir.x * cosA - dir.z * sinA,
      0,
      dir.x * sinA + dir.z * cosA,
    ).normalize();

    const perp = new THREE.Vector3(-devDir.z, 0, devDir.x);

    // Much wider lateral spread (~24-unit band) to break single-file lines
    let lateralOffset = (Math.random() - 0.5) * 24;

    // Validate against buildings AND pond with more attempts
    let valid = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      const testA = start.clone().addScaledVector(devDir, segmentStart).addScaledVector(perp, lateralOffset);
      const testB = start.clone().addScaledVector(devDir, segmentStart + segmentLength).addScaledVector(perp, lateralOffset);
      if (!this.isInsideObstacle(testA.x, testA.z) && !this.isInsideObstacle(testB.x, testB.z)) {
        valid = true;
        break;
      }
      // Try a new random offset, shrinking range each attempt
      lateralOffset = (Math.random() - 0.5) * (24 - attempt * 2);
    }
    if (!valid) lateralOffset = 0;

    // Build a meandering multi-waypoint path with generous lateral wander
    const waypointCount = 3 + Math.floor(Math.random() * 3); // 3-5 waypoints
    const waypoints: THREE.Vector3[] = [];
    for (let i = 0; i < waypointCount; i++) {
      const t = i / (waypointCount - 1); // 0 to 1
      const along = segmentStart + t * segmentLength;
      // Each waypoint wanders more aggressively from the base offset
      const wander = lateralOffset + (Math.random() - 0.5) * 10;
      const wp = start.clone()
        .addScaledVector(devDir, along)
        .addScaledVector(perp, wander);
      wp.y = 0.1;

      // Skip waypoints that land inside any obstacle
      if (this.isInsideObstacle(wp.x, wp.z)) {
        const fallback = start.clone()
          .addScaledVector(devDir, along)
          .addScaledVector(perp, lateralOffset);
        fallback.y = 0.1;
        if (!this.isInsideObstacle(fallback.x, fallback.z)) {
          waypoints.push(fallback);
        } else {
          // Last resort: use the path center
          const center = start.clone().addScaledVector(devDir, along);
          center.y = 0.1;
          waypoints.push(center);
        }
      } else {
        waypoints.push(wp);
      }
    }

    return waypoints;
  }

  isInHotspot(pos: THREE.Vector3): boolean {
    for (const hp of this.hotspotPositions) {
      const dx = pos.x - hp.x;
      const dz = pos.z - hp.z;
      if (Math.sqrt(dx * dx + dz * dz) < this.hotspotRadius) return true;
    }
    return false;
  }

  /** Spawn a specific NPC at a position (for scripted tutorial moments) */
  spawnNPCAt(position: THREE.Vector3, type: NPCType = 'tourist'): void {
    const halfSeg = 5 + Math.random() * 10;
    const p1 = position.clone();
    p1.y = 0.1;
    // Random walk direction instead of always +X
    const angle = Math.random() * Math.PI * 2;
    const p2 = p1.clone();
    p2.x += Math.cos(angle) * halfSeg;
    p2.z += Math.sin(angle) * halfSeg;
    const path = [p1, p2];

    const speed = this.getSpeedForType(type);
    const npc = new NPC(path, speed, type);
    npc.mesh.position.copy(p1);
    this.scene.add(npc.mesh);
    this.npcs.push(npc);
  }

  update(dt: number, playerPosition?: THREE.Vector3): void {
    if (playerPosition) {
      this.playerPosition.copy(playerPosition);
    }

    // Continuous spawning — prefer spawning near the player
    let spawnRate = NPC_CONFIG.BASE_SPAWN_RATE;

    // Boost spawn rate near hotspots
    if (this.hotspotPositions.length > 0) {
      for (const hp of this.hotspotPositions) {
        const dx = this.playerPosition.x - hp.x;
        const dz = this.playerPosition.z - hp.z;
        if (dx * dx + dz * dz < (this.hotspotRadius * 3) * (this.hotspotRadius * 3)) {
          spawnRate = NPC_CONFIG.HOTSPOT_SPAWN_RATE;
          break;
        }
      }
    }

    this.spawnTimer += dt;
    const batchSize = (NPC_CONFIG as any).BATCH_SPAWN_COUNT || 4;
    if (this.spawnTimer >= 1 / spawnRate && this.npcs.length < NPC_CONFIG.MAX_PER_DISTRICT) {
      this.spawnTimer = 0;
      for (let b = 0; b < batchSize && this.npcs.length < NPC_CONFIG.MAX_PER_DISTRICT; b++) {
        // 60% near player, 25% global spread, 15% targeted district fill
        const roll = Math.random();
        if (roll < 0.60) {
          this.spawnNearPlayer();
        } else if (roll < 0.85) {
          this.spawnGlobal();
        } else {
          const district = DISTRICT_CENTERS[Math.floor(Math.random() * DISTRICT_CENTERS.length)];
          this.spawnInDistrict(district);
        }
      }
    }

    // Ambient population maintenance: periodically top off districts
    this.ambientTimer += dt;
    if (this.ambientTimer >= 2.0 && this.npcs.length < NPC_CONFIG.MAX_PER_DISTRICT) {
      this.ambientTimer = 0;
      // Spawn 2-3 NPCs in random districts to keep the world feeling alive
      const ambientCount = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < ambientCount && this.npcs.length < NPC_CONFIG.MAX_PER_DISTRICT; i++) {
        const district = DISTRICT_CENTERS[Math.floor(Math.random() * DISTRICT_CENTERS.length)];
        this.spawnInDistrict(district);
      }
    }

    // Update and cull
    const VISIBLE_DISTANCE_SQ = 350 * 350;
    const UPDATE_DISTANCE_SQ = 500 * 500;
    const DESPAWN_DISTANCE_SQ = NPC_CONFIG.DESPAWN_DISTANCE * NPC_CONFIG.DESPAWN_DISTANCE;

    for (let i = this.npcs.length - 1; i >= 0; i--) {
      const npc = this.npcs[i];

      // Grabbed NPCs are fully managed by GrabSystem — skip culling and updates
      if (npc.isGrabbed) {
        npc.mesh.visible = true;
        continue;
      }

      const distSq = npc.mesh.position.distanceToSquared(this.playerPosition);

      if (npc.shouldDespawn || distSq > DESPAWN_DISTANCE_SQ) {
        this.scene.remove(npc.mesh);
        // Swap-and-pop: O(1) removal instead of O(n) splice
        const last = this.npcs.length - 1;
        if (i !== last) this.npcs[i] = this.npcs[last];
        this.npcs.length = last;
      } else if (distSq > UPDATE_DISTANCE_SQ) {
        npc.mesh.visible = false;
      } else if (distSq > VISIBLE_DISTANCE_SQ) {
        npc.mesh.visible = false;
        npc.update(dt);
      } else {
        npc.mesh.visible = true;
        npc.update(dt);
      }

      // Obstacle collision: if NPC walked into a building or the pond, roll back and reverse
      if (!npc.isHit && !npc.isGrabbed) {
        if (this.isInsideObstacle(npc.mesh.position.x, npc.mesh.position.z)) {
          npc.mesh.position.copy(npc.prevPosition);
          npc.reverseDirection();
        }
      }
    }
  }
}
