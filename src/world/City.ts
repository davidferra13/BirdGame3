import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BuildingLOD } from './BuildingLOD';
import { createToonMaterial } from '../rendering/ToonUtils';

export interface BuildingData {
  position: THREE.Vector3;
  width: number;
  height: number;
  depth: number;
  district: string;
  mesh?: THREE.Object3D;  // For frustum culling
  cullRadius: number;     // Pre-computed bounding sphere radius for frustum culling
}

export interface DistrictData {
  name: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/*
 * MASSIVE EXPANDED CITY - 1500x1500 units (56x larger than original!)
 *
 * Layout (top-down, +Z = north, +X = east):
 *
 *                    OCEAN (z > 700)
 *    ================================================
 *    |        BOARDWALK & BEACH      | HARBOR       |  z: 500..700
 *    |------------------------------------------------
 *    | SUBURBS  | DOWNTOWN | PARK  | UNIVERSITY     |  z: 200..500
 *    | (West)   | CORE     |       | CAMPUS         |
 *    |------------------------------------------------
 *    | MARKET   | FINANCIAL| SHOP  | STADIUM        |  z: -100..200
 *    | STREET   | DISTRICT | PLAZA | & ARENA        |
 *    |------------------------------------------------
 *    | INDUSTRIAL ZONE   | WAREHOUSE | CEMETERY     |  z: -400..-100
 *    |------------------------------------------------
 *    | AIRPORT                       | ENTERTAINMENT|  z: -700..-400
 *    ================================================
 */
export class City {
  readonly group = new THREE.Group();
  readonly buildings: BuildingData[] = [];
  readonly streetPaths: THREE.Vector3[][] = [];
  readonly districts: DistrictData[] = [];
  private buildingLights: THREE.PointLight[] = [];
  private windowMeshes: THREE.Mesh[] = [];

  constructor() {
    this.defineDistricts();

    // Build all districts
    this.buildDowntownCore();
    this.buildFinancialDistrict();
    this.buildParkAndPond();
    this.buildUniversityCampus();
    this.buildSuburbs();
    this.buildMarketStreet();
    this.buildShoppingPlaza();
    this.buildStadiumDistrict();
    this.buildBoardwalkAndBeach();
    this.buildHarborDistrict();
    this.buildIndustrialZone();
    this.buildWarehouseDistrict();
    this.buildCemetery();
    this.buildAirport();
    this.buildEntertainmentDistrict();
    // Ocean is now handled by the separate Ocean class (animated waves)

    // Major landmarks
    this.buildClocktower();
    this.buildBridge();
    this.buildFerrisWheel();
    this.buildParkStatue();
    this.buildSpaceNeedle();
    this.buildControlTower();
    this.buildLighthouse();
    this.buildGrandStadium();
    this.buildUniversityBellTower();
    this.buildCranes();
    this.buildWaterTower();
    this.buildRadioTowers();
    this.buildMonument();

    // Add major avenues connecting districts across the entire city
    this.buildConnectingAvenues();

    // Render visible street/road geometry along all street paths
    this.buildStreets();
  }

  /* ── District Definitions ────────────────────────────────── */

  private defineDistricts(): void {
    this.districts.push(
      // North (ocean side)
      { name: 'Boardwalk & Beach',   minX: -750, maxX:    0, minZ:  500, maxZ:  700 },
      { name: 'Harbor',              minX:    0, maxX:  750, minZ:  500, maxZ:  700 },

      // Upper middle
      { name: 'Suburbs West',        minX: -750, maxX: -250, minZ:  200, maxZ:  500 },
      { name: 'Downtown Core',       minX: -250, maxX:  150, minZ:  200, maxZ:  500 },
      { name: 'Park & Pond',         minX:  150, maxX:  450, minZ:  200, maxZ:  500 },
      { name: 'University Campus',   minX:  450, maxX:  750, minZ:  200, maxZ:  500 },

      // Middle
      { name: 'Market Street',       minX: -750, maxX: -300, minZ: -100, maxZ:  200 },
      { name: 'Financial District',  minX: -300, maxX:    0, minZ: -100, maxZ:  200 },
      { name: 'Shopping Plaza',      minX:    0, maxX:  350, minZ: -100, maxZ:  200 },
      { name: 'Stadium District',    minX:  350, maxX:  750, minZ: -100, maxZ:  200 },

      // Lower middle
      { name: 'Industrial Zone',     minX: -750, maxX: -200, minZ: -400, maxZ: -100 },
      { name: 'Warehouse District',  minX: -200, maxX:  300, minZ: -400, maxZ: -100 },
      { name: 'Cemetery',            minX:  300, maxX:  750, minZ: -400, maxZ: -100 },

      // South
      { name: 'Airport',             minX: -750, maxX:  300, minZ: -700, maxZ: -400 },
      { name: 'Entertainment',       minX:  300, maxX:  750, minZ: -700, maxZ: -400 },
    );
  }

  /* ── DOWNTOWN CORE (tall skyscrapers, dense grid) ────────── */

  private buildDowntownCore(): void {
    const colors = [0xE8846B, 0x5FB3B3, 0xF5C842, 0x98D4A6, 0xE88FAB];
    const centerX = -50;
    const centerZ = 350;

    // Dense grid of skyscrapers - reduced density for performance
    for (let x = -220; x <= 120; x += 50) {  // Increased spacing from 35 to 50
      for (let z = 230; z <= 470; z += 55) {  // Increased spacing from 40 to 55
        if (Math.random() < 0.25) continue; // More gaps for streets (was 0.15)

        const h = 40 + Math.random() * 80;  // Very tall buildings
        const w = 15 + Math.random() * 12;
        const d = 15 + Math.random() * 12;
        this.addBuilding(x, z, w, h, d, colors, 'Downtown Core');
      }
    }

    // Major streets
    for (let z = 240; z <= 460; z += 60) {
      this.streetPaths.push([
        new THREE.Vector3(-230, 0.1, z),
        new THREE.Vector3(130, 0.1, z),
      ]);
    }
    for (let x = -200; x <= 100; x += 70) {
      this.streetPaths.push([
        new THREE.Vector3(x, 0.1, 220),
        new THREE.Vector3(x, 0.1, 480),
      ]);
    }
  }

  /* ── FINANCIAL DISTRICT (glass towers, plazas) ──────────── */

  private buildFinancialDistrict(): void {
    const colors = [0x7FBBDC, 0xB088D4, 0x5FB3B3, 0xF5C842];

    for (let x = -280; x <= -20; x += 60) {  // Increased spacing from 45 to 60
      for (let z = -80; z <= 180; z += 65) {  // Increased spacing from 50 to 65
        if (Math.random() < 0.3) continue;  // More gaps (was 0.2)

        const h = 50 + Math.random() * 90;  // Extra tall, modern towers
        const w = 18 + Math.random() * 10;
        const d = 18 + Math.random() * 10;
        this.addBuilding(x, z, w, h, d, colors, 'Financial District');
      }
    }

    // Wide boulevards
    this.streetPaths.push(
      [new THREE.Vector3(-290, 0.1, 0), new THREE.Vector3(-10, 0.1, 0)],
      [new THREE.Vector3(-290, 0.1, 100), new THREE.Vector3(-10, 0.1, 100)],
      [new THREE.Vector3(-150, 0.1, -90), new THREE.Vector3(-150, 0.1, 190)],
    );
  }

  /* ── PARK & POND (green space, trees, water) ───────────── */

  private buildParkAndPond(): void {
    // Large grass area
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(280, 280),
      createToonMaterial(0x7CCD4B),
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(300, 0.02, 350);
    grass.receiveShadow = true;
    this.group.add(grass);

    // Large pond
    const pond = new THREE.Mesh(
      new THREE.CircleGeometry(45, 32),
      createToonMaterial(0x48D1CC),
    );
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(300, 0.05, 350);
    this.group.add(pond);

    // Reduced tree count for better performance (was 80)
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 80;
      const tx = 300 + Math.cos(angle) * dist;
      const tz = 350 + Math.sin(angle) * dist;
      this.addTree(tx, tz);
    }

    // Park buildings (cafes, pavilions)
    const facColors = [0xF5DEB3, 0xDEB887, 0xFFD700];
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 110 + Math.random() * 25;
      const bx = 300 + Math.cos(angle) * dist;
      const bz = 350 + Math.sin(angle) * dist;
      this.addBuilding(bx, bz, 8, 4 + Math.random() * 4, 8, facColors, 'Park & Pond');
    }

    // Walking paths — start from pond edge (radius 45 + 5 margin), NOT the center
    const pondCX = 300, pondCZ = 350, pondEdge = 52;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      this.streetPaths.push([
        new THREE.Vector3(pondCX + Math.cos(angle) * pondEdge, 0.1, pondCZ + Math.sin(angle) * pondEdge),
        new THREE.Vector3(pondCX + Math.cos(angle) * 130, 0.1, pondCZ + Math.sin(angle) * 130),
      ]);
    }
  }

  /* ── UNIVERSITY CAMPUS (academic buildings, quads) ─────── */

  private buildUniversityCampus(): void {
    const brickColors = [0xE08870, 0xD4765A, 0xCC8866];

    // Academic buildings in organized layout
    const buildingPositions: [number, number, number, number][] = [
      [500, 250, 40, 25],  // Library
      [580, 250, 35, 20],  // Science Hall
      [650, 250, 30, 18],  // Arts Building
      [500, 350, 32, 22],  // Student Center
      [580, 350, 28, 16],  // Admin Building
      [650, 350, 35, 24],  // Engineering
      [500, 450, 30, 20],  // Dorms
      [580, 450, 30, 20],  // Dorms
      [650, 450, 25, 15],  // Gym
    ];

    for (const [x, z, h, w] of buildingPositions) {
      this.addBuilding(x, z, w, h, w, brickColors, 'University Campus');
    }

    // Quad paths
    this.streetPaths.push(
      [new THREE.Vector3(480, 0.1, 230), new THREE.Vector3(670, 0.1, 230)],
      [new THREE.Vector3(480, 0.1, 470), new THREE.Vector3(670, 0.1, 470)],
      [new THREE.Vector3(480, 0.1, 230), new THREE.Vector3(480, 0.1, 470)],
      [new THREE.Vector3(670, 0.1, 230), new THREE.Vector3(670, 0.1, 470)],
    );
  }

  /* ── SUBURBS (residential houses, low density) ──────────── */

  private buildSuburbs(): void {
    const houseColors = [0xFFB347, 0xFF6B6B, 0x77DD77, 0x85C1E9, 0xC39BD3];

    // Grid of small houses - reduced density for performance
    for (let x = -720; x <= -280; x += 40) {  // Increased spacing from 25 to 40
      for (let z = 220; z <= 480; z += 40) {  // Increased spacing from 25 to 40
        if (Math.random() < 0.4) continue; // More yards/gaps (was 0.3)

        const h = 5 + Math.random() * 4;  // Small houses
        const w = 8 + Math.random() * 4;
        const d = 8 + Math.random() * 4;
        this.addBuilding(x, z, w, h, d, houseColors, 'Suburbs West');
      }
    }

    // Residential streets
    for (let z = 230; z <= 470; z += 50) {
      this.streetPaths.push([
        new THREE.Vector3(-730, 0.1, z),
        new THREE.Vector3(-270, 0.1, z),
      ]);
    }
  }

  /* ── MARKET STREET (colorful stalls, busy) ──────────────── */

  private buildMarketStreet(): void {
    const stallColors = [0xFF6B6B, 0x77DD77, 0x85C1E9, 0xFFD700, 0xFF69B4, 0xDDA0DD];
    const bgColors = [0xDEB887, 0xF5DEB3, 0xD2B48C];

    // Market stalls in rows - reduced density for performance
    for (let x = -720; x <= -340; x += 25) {  // Increased spacing from 15 to 25
      for (let z = -80; z <= 180; z += 35) {  // Increased spacing from 20 to 35
        if (Math.random() < 0.3) continue;  // Skip some stalls
        this.addBuilding(x, z, 6, 3 + Math.random() * 3, 6, stallColors, 'Market Street');
      }
    }

    // Background buildings
    for (let z = -70; z <= 170; z += 40) {
      this.addBuilding(-730, z, 12, 12 + Math.random() * 8, 12, bgColors, 'Market Street');
      this.addBuilding(-320, z, 12, 10 + Math.random() * 8, 12, bgColors, 'Market Street');
    }

    // Market streets
    for (let z = -70; z <= 170; z += 50) {
      this.streetPaths.push([
        new THREE.Vector3(-740, 0.1, z),
        new THREE.Vector3(-310, 0.1, z),
      ]);
    }
  }

  /* ── SHOPPING PLAZA (malls, stores) ─────────────────────── */

  private buildShoppingPlaza(): void {
    const mallColors = [0xFFB6C1, 0xFFDAB9, 0xFFA07A];

    // Large mall complex
    this.addBuilding(100, 50, 80, 15, 120, mallColors, 'Shopping Plaza');
    this.addBuilding(220, 50, 70, 12, 100, mallColors, 'Shopping Plaza');

    // Smaller stores - reduced density for performance
    for (let x = 20; x <= 320; x += 50) {  // Increased spacing from 35 to 50
      for (let z = -80; z <= -20; z += 45) {  // Increased spacing from 30 to 45
        if (Math.random() < 0.2) continue;
        this.addBuilding(x, z, 20, 8 + Math.random() * 5, 20, mallColors, 'Shopping Plaza');
      }
    }

    // Parking lot paths
    this.streetPaths.push(
      [new THREE.Vector3(10, 0.1, 0), new THREE.Vector3(330, 0.1, 0)],
      [new THREE.Vector3(10, 0.1, 100), new THREE.Vector3(330, 0.1, 100)],
    );
  }

  /* ── STADIUM DISTRICT (arena, sports complex) ───────────── */

  private buildStadiumDistrict(): void {
    const concreteColors = [0xB0C4DE, 0xA9C4D7, 0xC0D8E8];

    // Surrounding buildings - reduced density for performance
    for (let x = 370; x <= 720; x += 70) {  // Increased spacing from 50 to 70
      for (let z = -80; z <= 180; z += 70) {  // Increased spacing from 50 to 70
        if (x > 450 && x < 650 && z > -20 && z < 120) continue; // Leave space for stadium
        this.addBuilding(x, z, 25, 15 + Math.random() * 12, 25, concreteColors, 'Stadium District');
      }
    }

    // Stadium streets
    this.streetPaths.push(
      [new THREE.Vector3(360, 0.1, -60), new THREE.Vector3(730, 0.1, -60)],
      [new THREE.Vector3(360, 0.1, 50), new THREE.Vector3(730, 0.1, 50)],
      [new THREE.Vector3(360, 0.1, 160), new THREE.Vector3(730, 0.1, 160)],
      [new THREE.Vector3(400, 0.1, -80), new THREE.Vector3(400, 0.1, 180)],
      [new THREE.Vector3(550, 0.1, -80), new THREE.Vector3(550, 0.1, 180)],
      [new THREE.Vector3(700, 0.1, -80), new THREE.Vector3(700, 0.1, 180)],
    );
  }

  /* ── BOARDWALK & BEACH (seaside, tourism) ───────────────── */

  private buildBoardwalkAndBeach(): void {
    const boardwalkColors = [0xFFD700, 0xFFA500, 0xFFB347];

    // Boardwalk platform
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(700, 2, 80),
      createToonMaterial(0xDEB887),
    );
    plank.position.set(-375, 1, 620);
    plank.receiveShadow = true;
    this.group.add(plank);

    // Beach sand
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(700, 100),
      createToonMaterial(0xFFE4B5),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(-375, 0.01, 540);
    sand.receiveShadow = true;
    this.group.add(sand);

    // Boardwalk shops - reduced density for performance
    for (let x = -700; x <= -50; x += 60) {  // Increased spacing from 40 to 60
      if (Math.random() < 0.3) continue;
      this.addBuilding(x, 590, 12, 8 + Math.random() * 6, 15, boardwalkColors, 'Boardwalk & Beach');
      this.addBuilding(x, 650, 10, 6 + Math.random() * 5, 12, boardwalkColors, 'Boardwalk & Beach');
    }

    // Boardwalk path
    this.streetPaths.push([
      new THREE.Vector3(-710, 0.1, 620),
      new THREE.Vector3(-40, 0.1, 620),
    ]);
  }

  /* ── HARBOR (docks, ships, cranes) ──────────────────────── */

  private buildHarborDistrict(): void {
    const warehouseColors = [0xCD853F, 0xD2956A, 0xC4885A];

    // Warehouses along docks - reduced density for performance
    for (let x = 50; x <= 700; x += 120) {  // Increased spacing from 80 to 120
      for (let z = 520; z <= 680; z += 100) {  // Increased spacing from 70 to 100
        if (Math.random() < 0.2) continue;
        this.addBuilding(x, z, 30, 15 + Math.random() * 10, 40, warehouseColors, 'Harbor');
      }
    }

    // Dock platforms
    for (let x = 100; x <= 650; x += 120) {
      const dock = new THREE.Mesh(
        new THREE.BoxGeometry(100, 1, 30),
        createToonMaterial(0xA0886A),
      );
      dock.position.set(x, 0.5, 690);
      this.group.add(dock);
    }

    // Harbor streets and dock paths
    this.streetPaths.push(
      [new THREE.Vector3(40, 0.1, 540), new THREE.Vector3(710, 0.1, 540)],
      [new THREE.Vector3(40, 0.1, 620), new THREE.Vector3(710, 0.1, 620)],
      [new THREE.Vector3(40, 0.1, 680), new THREE.Vector3(710, 0.1, 680)],
      [new THREE.Vector3(100, 0.1, 520), new THREE.Vector3(100, 0.1, 690)],
      [new THREE.Vector3(300, 0.1, 520), new THREE.Vector3(300, 0.1, 690)],
      [new THREE.Vector3(500, 0.1, 520), new THREE.Vector3(500, 0.1, 690)],
    );
  }

  /* ── INDUSTRIAL ZONE (factories, smokestacks) ───────────── */

  private buildIndustrialZone(): void {
    const industrialColors = [0xF0A050, 0xE87040, 0xD4A050, 0xC0A060];

    // Large factory buildings - reduced density for performance
    for (let x = -720; x <= -240; x += 80) {  // Increased spacing from 60 to 80
      for (let z = -380; z <= -120; z += 80) {  // Increased spacing from 60 to 80
        if (Math.random() < 0.2) continue;
        const h = 20 + Math.random() * 25;
        const w = 35 + Math.random() * 15;
        const d = 35 + Math.random() * 15;
        this.addBuilding(x, z, w, h, d, industrialColors, 'Industrial Zone');
      }
    }

    // Smokestacks
    for (let i = 0; i < 15; i++) {
      const x = -700 + Math.random() * 440;
      const z = -370 + Math.random() * 240;
      const smokestack = new THREE.Mesh(
        new THREE.CylinderGeometry(3, 4, 60, 8),
        createToonMaterial(0x8B7355),
      );
      smokestack.position.set(x, 30, z);
      smokestack.castShadow = true;
      this.group.add(smokestack);
    }

    // Industrial roads
    this.streetPaths.push(
      [new THREE.Vector3(-730, 0.1, -250), new THREE.Vector3(-230, 0.1, -250)],
      [new THREE.Vector3(-730, 0.1, -150), new THREE.Vector3(-230, 0.1, -150)],
      [new THREE.Vector3(-730, 0.1, -350), new THREE.Vector3(-230, 0.1, -350)],
      [new THREE.Vector3(-600, 0.1, -390), new THREE.Vector3(-600, 0.1, -110)],
      [new THREE.Vector3(-400, 0.1, -390), new THREE.Vector3(-400, 0.1, -110)],
    );
  }

  /* ── WAREHOUSE DISTRICT (storage, shipping) ─────────────── */

  private buildWarehouseDistrict(): void {
    const colors = [0xD4A76A, 0xC49660, 0xE0B87A];

    for (let x = -180; x <= 280; x += 75) {  // Increased spacing from 55 to 75
      for (let z = -380; z <= -120; z += 70) {  // Increased spacing from 50 to 70
        if (Math.random() < 0.2) continue;
        const h = 12 + Math.random() * 12;
        const w = 30 + Math.random() * 15;
        const d = 30 + Math.random() * 15;
        this.addBuilding(x, z, w, h, d, colors, 'Warehouse District');
      }
    }

    // Warehouse roads
    this.streetPaths.push(
      [new THREE.Vector3(-190, 0.1, -250), new THREE.Vector3(290, 0.1, -250)],
      [new THREE.Vector3(-190, 0.1, -150), new THREE.Vector3(290, 0.1, -150)],
      [new THREE.Vector3(-190, 0.1, -350), new THREE.Vector3(290, 0.1, -350)],
      [new THREE.Vector3(0, 0.1, -390), new THREE.Vector3(0, 0.1, -110)],
      [new THREE.Vector3(200, 0.1, -390), new THREE.Vector3(200, 0.1, -110)],
    );
  }

  /* ── CEMETERY (graves, mausoleums, gothic) ──────────────── */

  private buildCemetery(): void {
    // Grass
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 280),
      createToonMaterial(0x5DBB63),
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(525, 0.02, -250);
    grass.receiveShadow = true;
    this.group.add(grass);

    const tombColors = [0xB0B0B0, 0xC0C0C0, 0xA0A0A0];

    // Small tombstones scattered - reduced for performance (was 150)
    for (let i = 0; i < 50; i++) {
      const x = 330 + Math.random() * 390;
      const z = -380 + Math.random() * 260;
      const tomb = new THREE.Mesh(
        new THREE.BoxGeometry(1, 2, 0.3),
        createToonMaterial(tombColors[Math.floor(Math.random() * tombColors.length)]),
      );
      tomb.position.set(x, 1, z);
      this.group.add(tomb);
    }

    // Mausoleums
    for (let i = 0; i < 8; i++) {
      const x = 350 + Math.random() * 350;
      const z = -360 + Math.random() * 220;
      this.addBuilding(x, z, 8, 6, 8, [0x666666], 'Cemetery');
    }

    // Trees - reduced for performance (was 40)
    for (let i = 0; i < 15; i++) {
      const x = 330 + Math.random() * 390;
      const z = -380 + Math.random() * 260;
      this.addTree(x, z);
    }

    // Cemetery paths
    this.streetPaths.push(
      [new THREE.Vector3(320, 0.1, -250), new THREE.Vector3(730, 0.1, -250)],
      [new THREE.Vector3(320, 0.1, -350), new THREE.Vector3(730, 0.1, -350)],
      [new THREE.Vector3(320, 0.1, -150), new THREE.Vector3(730, 0.1, -150)],
      [new THREE.Vector3(450, 0.1, -390), new THREE.Vector3(450, 0.1, -110)],
      [new THREE.Vector3(600, 0.1, -390), new THREE.Vector3(600, 0.1, -110)],
    );
  }

  /* ── AIRPORT (runways, terminals, hangars) ──────────────── */

  private buildAirport(): void {
    // Runways
    const runway1 = new THREE.Mesh(
      new THREE.PlaneGeometry(1000, 60),
      createToonMaterial(0xA0A0A0),
    );
    runway1.rotation.x = -Math.PI / 2;
    runway1.position.set(-225, 0.05, -550);
    this.group.add(runway1);

    const runway2 = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 600),
      createToonMaterial(0xA0A0A0),
    );
    runway2.rotation.x = -Math.PI / 2;
    runway2.position.set(-450, 0.05, -500);
    this.group.add(runway2);

    // Terminal
    const terminalColors = [0xE0E0E0, 0xD0D0D0];
    this.addBuilding(0, -550, 120, 18, 80, terminalColors, 'Airport');

    // Hangars
    for (let x = -600; x <= -300; x += 80) {
      this.addBuilding(x, -650, 40, 15, 50, [0x888888], 'Airport');
    }

    // Airport roads and walkways
    this.streetPaths.push(
      [new THREE.Vector3(-730, 0.1, -500), new THREE.Vector3(280, 0.1, -500)],
      [new THREE.Vector3(-730, 0.1, -600), new THREE.Vector3(280, 0.1, -600)],
      [new THREE.Vector3(-730, 0.1, -680), new THREE.Vector3(280, 0.1, -680)],
      [new THREE.Vector3(-500, 0.1, -700), new THREE.Vector3(-500, 0.1, -420)],
      [new THREE.Vector3(-200, 0.1, -700), new THREE.Vector3(-200, 0.1, -420)],
      [new THREE.Vector3(100, 0.1, -700), new THREE.Vector3(100, 0.1, -420)],
    );
  }

  /* ── ENTERTAINMENT DISTRICT (theaters, clubs) ───────────── */

  private buildEntertainmentDistrict(): void {
    const neonColors = [0xFF69B4, 0x87CEEB, 0xFFD700, 0xDDA0DD, 0x98FB98];

    for (let x = 330; x <= 720; x += 70) {  // Increased spacing from 50 to 70
      for (let z = -680; z <= -420; z += 70) {  // Increased spacing from 50 to 70
        if (Math.random() < 0.25) continue;
        const h = 15 + Math.random() * 20;
        const w = 20 + Math.random() * 12;
        const d = 20 + Math.random() * 12;
        this.addBuilding(x, z, w, h, d, neonColors, 'Entertainment');
      }
    }

    // Entertainment streets
    this.streetPaths.push(
      [new THREE.Vector3(320, 0.1, -500), new THREE.Vector3(730, 0.1, -500)],
      [new THREE.Vector3(320, 0.1, -600), new THREE.Vector3(730, 0.1, -600)],
      [new THREE.Vector3(320, 0.1, -680), new THREE.Vector3(730, 0.1, -680)],
      [new THREE.Vector3(400, 0.1, -700), new THREE.Vector3(400, 0.1, -410)],
      [new THREE.Vector3(550, 0.1, -700), new THREE.Vector3(550, 0.1, -410)],
      [new THREE.Vector3(700, 0.1, -700), new THREE.Vector3(700, 0.1, -410)],
    );
  }

  /* ── CONNECTING AVENUES (major roads linking districts) ──── */

  private buildConnectingAvenues(): void {
    // North-South main avenues spanning the full city height
    this.streetPaths.push(
      // Western avenue (x = -500)
      [new THREE.Vector3(-500, 0.1, -690), new THREE.Vector3(-500, 0.1, 690)],
      // Center-west avenue (x = -150)
      [new THREE.Vector3(-150, 0.1, -690), new THREE.Vector3(-150, 0.1, 690)],
      // Center avenue (x = 50)
      [new THREE.Vector3(50, 0.1, -690), new THREE.Vector3(50, 0.1, 690)],
      // Center-east avenue (x = 300)
      [new THREE.Vector3(300, 0.1, -690), new THREE.Vector3(300, 0.1, 690)],
      // Eastern avenue (x = 550)
      [new THREE.Vector3(550, 0.1, -690), new THREE.Vector3(550, 0.1, 690)],
    );

    // East-West main avenues spanning the full city width
    this.streetPaths.push(
      // Far south (z = -550)
      [new THREE.Vector3(-730, 0.1, -550), new THREE.Vector3(730, 0.1, -550)],
      // Lower-mid (z = -250)
      [new THREE.Vector3(-730, 0.1, -250), new THREE.Vector3(730, 0.1, -250)],
      // Center (z = 50)
      [new THREE.Vector3(-730, 0.1, 50), new THREE.Vector3(730, 0.1, 50)],
      // Upper-mid (z = 350)
      [new THREE.Vector3(-730, 0.1, 350), new THREE.Vector3(730, 0.1, 350)],
      // Far north (z = 550)
      [new THREE.Vector3(-730, 0.1, 550), new THREE.Vector3(730, 0.1, 550)],
    );
  }

  /* ── STREETS (visible road surfaces) ─────────────────────── */

  private buildStreets(): void {
    const roadMaterial = createToonMaterial(0xC0B8A8);
    const sidewalkMaterial = createToonMaterial(0xD4C9B8);

    const roadGeometries: THREE.BufferGeometry[] = [];
    const sidewalkGeometries: THREE.BufferGeometry[] = [];

    for (const path of this.streetPaths) {
      if (path.length < 2) continue;

      const start = path[0];
      const end = path[path.length - 1];
      const dx = end.x - start.x;
      const dz = end.z - start.z;
      const length = Math.sqrt(dx * dx + dz * dz);
      if (length < 5) continue;

      const angle = Math.atan2(dx, dz);
      const cx = (start.x + end.x) / 2;
      const cz = (start.z + end.z) / 2;
      const roadWidth = 8;
      const sidewalkWidth = 2;

      // Road surface
      const roadGeo = new THREE.PlaneGeometry(roadWidth, length);
      const roadMatrix = new THREE.Matrix4()
        .makeRotationX(-Math.PI / 2)
        .premultiply(new THREE.Matrix4().makeRotationY(angle))
        .premultiply(new THREE.Matrix4().makeTranslation(cx, 0.03, cz));
      roadGeo.applyMatrix4(roadMatrix);
      roadGeometries.push(roadGeo);

      // Sidewalks on both sides
      const perpX = Math.cos(angle);
      const perpZ = -Math.sin(angle);
      for (const side of [-1, 1]) {
        const offset = (roadWidth / 2 + sidewalkWidth / 2) * side;
        const swGeo = new THREE.PlaneGeometry(sidewalkWidth, length);
        const swMatrix = new THREE.Matrix4()
          .makeRotationX(-Math.PI / 2)
          .premultiply(new THREE.Matrix4().makeRotationY(angle))
          .premultiply(new THREE.Matrix4().makeTranslation(
            cx + perpX * offset,
            0.04,
            cz + perpZ * offset,
          ));
        swGeo.applyMatrix4(swMatrix);
        sidewalkGeometries.push(swGeo);
      }
    }

    // Merge all roads into a single mesh for minimal draw calls
    if (roadGeometries.length > 0) {
      const merged = mergeGeometries(roadGeometries);
      if (merged) {
        const roadMesh = new THREE.Mesh(merged, roadMaterial);
        roadMesh.receiveShadow = true;
        this.group.add(roadMesh);
      }
    }
    if (sidewalkGeometries.length > 0) {
      const merged = mergeGeometries(sidewalkGeometries);
      if (merged) {
        const swMesh = new THREE.Mesh(merged, sidewalkMaterial);
        swMesh.receiveShadow = true;
        this.group.add(swMesh);
      }
    }
  }

  /* ── LANDMARKS ──────────────────────────────────────────── */

  private buildClocktower(): void {
    const towerH = 85;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(8, towerH, 8),
      createToonMaterial(0xB0C4DE),
    );
    body.position.set(-100, towerH / 2, 350);
    body.castShadow = true;
    this.group.add(body);

    // Clock faces
    const clockGeo = new THREE.CircleGeometry(4, 16);
    const clockMat = createToonMaterial(0xFFFFF0);

    for (let i = 0; i < 4; i++) {
      const face = new THREE.Mesh(clockGeo, clockMat);
      const angle = (i / 4) * Math.PI * 2;
      face.position.set(
        -100 + Math.sin(angle) * 4.5,
        towerH - 10,
        350 + Math.cos(angle) * 4.5
      );
      face.rotation.y = angle;
      this.group.add(face);
    }

    // Roof
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(6, 12, 4),
      createToonMaterial(0xE8846B),
    );
    roof.position.set(-100, towerH + 6, 350);
    this.group.add(roof);
  }

  private buildBridge(): void {
    const deckY = 25;
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(80, 2, 20),
      createToonMaterial(0xB0C4DE)
    );
    deck.position.set(-50, deckY, 490);
    deck.castShadow = true;
    this.group.add(deck);

    // Pillars
    for (const x of [-70, -30]) {
      for (const z of [482, 498]) {
        const pillar = new THREE.Mesh(
          new THREE.BoxGeometry(3, deckY, 3),
          createToonMaterial(0xA9B4C2)
        );
        pillar.position.set(x, deckY / 2, z);
        pillar.castShadow = true;
        this.group.add(pillar);
      }
    }
  }

  private buildFerrisWheel(): void {
    const cx = -600;
    const cz = 620;
    const radius = 25;
    const hubY = radius + 5;

    // Support legs
    for (const dz of [-3, 3]) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(2, hubY + 3, 2),
        createToonMaterial(0xC0C0C0)
      );
      leg.position.set(cx, (hubY + 3) / 2, cz + dz);
      leg.castShadow = true;
      this.group.add(leg);
    }

    // Hub
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 2, 3, 8),
      createToonMaterial(0xE0E0E0)
    );
    hub.rotation.x = Math.PI / 2;
    hub.position.set(cx, hubY, cz);
    this.group.add(hub);

    // Rim
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.8, 8, 32),
      createToonMaterial(0xFF6B6B)
    );
    rim.position.set(cx, hubY, cz);
    this.group.add(rim);

    // Spokes
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, radius * 2, 0.4),
        createToonMaterial(0xD0D0D0)
      );
      spoke.position.set(cx, hubY, cz);
      spoke.rotation.z = angle;
      this.group.add(spoke);
    }

    // Gondolas
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const gx = cx + Math.cos(angle) * radius;
      const gy = hubY + Math.sin(angle) * radius;
      const gondola = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 3, 2.5),
        createToonMaterial(0x87CEEB)
      );
      gondola.position.set(gx, gy, cz);
      this.group.add(gondola);
    }
  }

  private buildParkStatue(): void {
    const sx = 300;
    const sz = 350;

    const pedestal = new THREE.Mesh(
      new THREE.BoxGeometry(6, 8, 6),
      createToonMaterial(0xC0C0C0)
    );
    pedestal.position.set(sx, 4, sz);
    pedestal.castShadow = true;
    this.group.add(pedestal);

    const figureBody = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 2, 10, 8),
      createToonMaterial(0x98D4A6)
    );
    figureBody.position.set(sx, 13, sz);
    figureBody.castShadow = true;
    this.group.add(figureBody);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 8, 6),
      createToonMaterial(0x98D4A6)
    );
    head.position.set(sx, 19, sz);
    this.group.add(head);
  }

  private buildSpaceNeedle(): void {
    // Iconic tall observation tower in downtown
    const x = -50;
    const z = 300;
    const h = 150;

    // Base
    const base = new THREE.Mesh(
      new THREE.ConeGeometry(15, 30, 6),
      createToonMaterial(0xB0B0B0)
    );
    base.position.set(x, 15, z);
    this.group.add(base);

    // Shaft
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 3, h - 50, 8),
      createToonMaterial(0xC0C0C0)
    );
    shaft.position.set(x, 55, z);
    shaft.castShadow = true;
    this.group.add(shaft);

    // Observation deck
    const deck = new THREE.Mesh(
      new THREE.CylinderGeometry(12, 8, 15, 16),
      createToonMaterial(0xE0E0E0)
    );
    deck.position.set(x, h - 15, z);
    this.group.add(deck);

    // Top spire
    const spire = new THREE.Mesh(
      new THREE.ConeGeometry(2, 20, 8),
      createToonMaterial(0xB0B0B0)
    );
    spire.position.set(x, h + 5, z);
    this.group.add(spire);
  }

  private buildControlTower(): void {
    // Airport control tower
    const x = 50;
    const z = -550;
    const h = 60;

    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 5, h, 8),
      createToonMaterial(0xF0F0F0)
    );
    tower.position.set(x, h / 2, z);
    tower.castShadow = true;
    this.group.add(tower);

    // Control room (glass)
    const controlRoom = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 6, 12, 8),
      createToonMaterial(0x87CEEB, { transparent: true, opacity: 0.7 })
    );
    controlRoom.position.set(x, h + 6, z);
    this.group.add(controlRoom);
  }

  private buildLighthouse(): void {
    const x = 700;
    const z = 650;
    const h = 45;

    const lighthouse = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 5, h, 12),
      createToonMaterial(0xFFE4E1)
    );
    lighthouse.position.set(x, h / 2, z);
    lighthouse.castShadow = true;
    this.group.add(lighthouse);

    // Light (glowing top)
    const light = new THREE.Mesh(
      new THREE.CylinderGeometry(5, 5, 6, 12),
      createToonMaterial(0xFFFF88, { transparent: true, opacity: 0.9 })
    );
    light.position.set(x, h + 3, z);
    this.group.add(light);

    // Point light
    const pointLight = new THREE.PointLight(0xffffaa, 2, 100);
    pointLight.position.set(x, h + 3, z);
    this.group.add(pointLight);
  }

  private buildGrandStadium(): void {
    // Massive sports stadium
    const x = 550;
    const z = 50;

    // Outer ring
    const outerRing = new THREE.Mesh(
      new THREE.CylinderGeometry(90, 95, 40, 32, 1, false),
      createToonMaterial(0xD0D0D0)
    );
    outerRing.position.set(x, 20, z);
    outerRing.castShadow = true;
    this.group.add(outerRing);

    // Inner field (green)
    const field = new THREE.Mesh(
      new THREE.CircleGeometry(70, 32),
      createToonMaterial(0x7CCD4B)
    );
    field.rotation.x = -Math.PI / 2;
    field.position.set(x, 0.1, z);
    this.group.add(field);
  }

  private buildUniversityBellTower(): void {
    const x = 600;
    const z = 350;
    const h = 70;

    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(8, h, 8),
      createToonMaterial(0xE08870)
    );
    tower.position.set(x, h / 2, z);
    tower.castShadow = true;
    this.group.add(tower);

    // Bell chamber
    const bellChamber = new THREE.Mesh(
      new THREE.BoxGeometry(10, 8, 10),
      createToonMaterial(0xD4926A)
    );
    bellChamber.position.set(x, h + 4, z);
    this.group.add(bellChamber);

    // Roof
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(7, 10, 4),
      createToonMaterial(0xB07050)
    );
    roof.position.set(x, h + 13, z);
    this.group.add(roof);
  }

  private buildCranes(): void {
    // Harbor cranes
    const cranePositions: [number, number][] = [
      [150, 680], [350, 680], [550, 680],
    ];

    for (const [x, z] of cranePositions) {
      // Base
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(12, 5, 12),
        createToonMaterial(0xFFD700)
      );
      base.position.set(x, 2.5, z);
      this.group.add(base);

      // Vertical tower
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(3, 50, 3),
        createToonMaterial(0xFFA500)
      );
      tower.position.set(x, 25, z);
      tower.castShadow = true;
      this.group.add(tower);

      // Horizontal boom
      const boom = new THREE.Mesh(
        new THREE.BoxGeometry(60, 2, 2),
        createToonMaterial(0xFFA500)
      );
      boom.position.set(x + 20, 48, z);
      this.group.add(boom);
    }
  }

  private buildWaterTower(): void {
    const x = -500;
    const z = 350;

    // Support legs
    for (const dx of [-6, 6]) {
      for (const dz of [-6, 6]) {
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.8, 1.2, 35, 8),
          createToonMaterial(0xB0B0B0)
        );
        leg.position.set(x + dx, 17.5, z + dz);
        leg.castShadow = true;
        this.group.add(leg);
      }
    }

    // Tank
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(12, 12, 15, 16),
      createToonMaterial(0xC0C0C0)
    );
    tank.position.set(x, 42, z);
    this.group.add(tank);
  }

  private buildRadioTowers(): void {
    const towerPositions: [number, number, number][] = [
      [-650, -150, 80],
      [650, -550, 75],
      [-200, 450, 70],
    ];

    for (const [x, z, h] of towerPositions) {
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 2, h, 4),
        createToonMaterial(0xFF4444)
      );
      tower.position.set(x, h / 2, z);
      tower.castShadow = true;
      this.group.add(tower);

      // Blinking red light on top
      const light = new THREE.PointLight(0xff0000, 1, 50);
      light.position.set(x, h + 2, z);
      this.group.add(light);
    }
  }

  private buildMonument(): void {
    // Large monument in financial district
    const x = -150;
    const z = 50;

    const obelisk = new THREE.Mesh(
      new THREE.ConeGeometry(8, 80, 4),
      createToonMaterial(0xB0C4DE)
    );
    obelisk.position.set(x, 40, z);
    obelisk.castShadow = true;
    this.group.add(obelisk);
  }

  /* ── Helpers ────────────────────────────────────────────── */

  private addBuilding(
    x: number, z: number,
    w: number, h: number, d: number,
    colors: number[], district: string,
  ): void {
    const color = colors[Math.floor(Math.random() * colors.length)];

    // PHASE 2: Use LOD system for buildings (reduces polygon count 60-80% for distant buildings)
    const lod = BuildingLOD.create(w, h, d, color);
    lod.position.set(x, h / 2, z);
    this.group.add(lod);

    // PERFORMANCE: Windows disabled to reduce draw calls (was creating thousands of individual meshes)
    // TODO: Replace with texture-based windows or instanced rendering if needed
    // if (h > 10) {
    //   this.addBuildingWindows(x, h, z, w, d);
    // }

    this.buildings.push({
      position: lod.position.clone(),
      width: w,
      height: h,
      depth: d,
      district,
      mesh: lod,  // Store LOD object for frustum culling (acts like Mesh)
      cullRadius: Math.sqrt(w * w + h * h + d * d) * 0.5,
    });
  }

  private addBuildingWindows(x: number, h: number, z: number, w: number, d: number): void {
    // Create window grid on building faces
    const windowSize = 0.4;
    const windowSpacing = 3;
    const floorsCount = Math.floor(h / windowSpacing);

    for (let floor = 1; floor < floorsCount; floor++) {
      const y = floor * windowSpacing;

      // Random chance for this floor to be lit
      const isLit = Math.random() > 0.3;

      // Front and back faces
      for (let wx = -w / 2 + 1; wx < w / 2; wx += windowSpacing) {
        this.addWindow(x + wx, y, z + d / 2 + 0.01, windowSize, isLit);
        this.addWindow(x + wx, y, z - d / 2 - 0.01, windowSize, isLit);
      }

      // Left and right faces
      for (let wz = -d / 2 + 1; wz < d / 2; wz += windowSpacing) {
        this.addWindow(x + w / 2 + 0.01, y, z + wz, windowSize, isLit);
        this.addWindow(x - w / 2 - 0.01, y, z + wz, windowSize, isLit);
      }
    }
  }

  private addWindow(x: number, y: number, z: number, size: number, isLit: boolean): void {
    const windowGeo = new THREE.PlaneGeometry(size, size * 1.5);
    const windowMat = createToonMaterial(
      isLit ? 0xffffcc : 0x333333,
      { transparent: true, opacity: 0.8 },
    );

    const window = new THREE.Mesh(windowGeo, windowMat);
    window.position.set(x, y, z);

    // Orient window to face outward
    if (Math.abs(z - Math.floor(z)) < 0.1) {
      window.rotation.y = z > 0 ? 0 : Math.PI;
    } else {
      window.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;
    }

    this.group.add(window);
    this.windowMeshes.push(window);

    // Store whether this window can be lit
    (window as any).canLight = isLit;
  }

  setNightMode(_isNight: boolean): void {
    // No-op: toon materials don't use emissive
  }

  private addTree(x: number, z: number): void {
    const treeType = Math.random();
    const height = 4 + Math.random() * 4;
    const lean = (Math.random() - 0.5) * 0.08;

    // Varied bark color
    const barkColor = new THREE.Color().setHSL(0.08, 0.45, 0.18 + Math.random() * 0.1);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.5, height, 5),
      createToonMaterial(barkColor),
    );
    trunk.position.set(x, height / 2, z);
    trunk.rotation.z = lean;
    trunk.castShadow = true;
    this.group.add(trunk);

    // Varied canopy color (greens with occasional warm tones)
    const canopyHue = 0.25 + Math.random() * 0.15;
    const canopySat = 0.4 + Math.random() * 0.3;
    const canopyLight = 0.22 + Math.random() * 0.15;
    const canopyColor = new THREE.Color().setHSL(canopyHue, canopySat, canopyLight);
    const canopyMat = createToonMaterial(canopyColor);

    if (treeType < 0.35) {
      // Evergreen (cone shape)
      const r = 2 + Math.random() * 1.5;
      const coneH = height * 0.8;
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(r, coneH, 6), canopyMat);
      canopy.position.set(x, height + coneH * 0.3, z);
      canopy.castShadow = true;
      this.group.add(canopy);
    } else if (treeType < 0.7) {
      // Full deciduous (2-3 overlapping spheres)
      const count = 2 + Math.floor(Math.random() * 2);
      for (let s = 0; s < count; s++) {
        const r = 2 + Math.random() * 1.5;
        const canopy = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 5), canopyMat);
        canopy.position.set(
          x + (Math.random() - 0.5) * 1.5,
          height + r * 0.3 + s * 0.5,
          z + (Math.random() - 0.5) * 1.5,
        );
        canopy.castShadow = true;
        this.group.add(canopy);
      }
    } else {
      // Bushy irregular (icosahedron)
      const r = 2.5 + Math.random() * 2;
      const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), canopyMat);
      canopy.position.set(x, height + r * 0.4, z);
      canopy.castShadow = true;
      this.group.add(canopy);
    }
  }

  getDistrict(position: THREE.Vector3): DistrictData | null {
    for (const d of this.districts) {
      if (
        position.x >= d.minX && position.x <= d.maxX &&
        position.z >= d.minZ && position.z <= d.maxZ
      ) {
        return d;
      }
    }
    return null;
  }
}
