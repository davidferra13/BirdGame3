import * as THREE from 'three';
import { createToonMaterial } from '../rendering/ToonUtils';

/**
 * BuildingLOD - Level of Detail system for buildings with procedural window textures.
 *
 * Creates THREE.LOD objects that automatically switch between detail levels
 * based on camera distance. Buildings now have canvas-generated window textures
 * that glow with the bloom post-processing pass.
 *
 * LOD Levels:
 * - Level 0 (0-200 units): Full detail with window textures + emissive glow
 * - Level 1 (200-600 units): Medium detail with window textures
 * - Level 2 (600+ units): Low detail with basic lighting
 */

// ── Shared texture pool (created once, reused by all buildings) ──

interface TexturePair {
  diffuse: THREE.CanvasTexture;
  emissive: THREE.CanvasTexture;
}

let texturePool: TexturePair[] | null = null;
const VARIANTS = 10;

// Per-variant architectural window styles for visual diversity
const WINDOW_STYLES = [
  { winW: 5, winH: 7, spacingX: 10, spacingY: 12, litRatio: 0.65, tint: '#1e2d3d' },  // Standard office
  { winW: 8, winH: 5, spacingX: 12, spacingY: 10, litRatio: 0.50, tint: '#1a3040' },  // Wide ribbon
  { winW: 3, winH: 10, spacingX: 8, spacingY: 14, litRatio: 0.70, tint: '#2a3a50' },  // Tall narrow
  { winW: 6, winH: 6, spacingX: 9, spacingY: 9, litRatio: 0.80, tint: '#102030' },    // Grid curtain wall
  { winW: 4, winH: 8, spacingX: 14, spacingY: 16, litRatio: 0.30, tint: '#1e2d3d' },  // Sparse residential
  { winW: 7, winH: 4, spacingX: 11, spacingY: 8, litRatio: 0.60, tint: '#253545' },   // Horizontal bands
  { winW: 5, winH: 9, spacingX: 8, spacingY: 13, litRatio: 0.55, tint: '#1a2a3a' },   // Classic highrise
  { winW: 6, winH: 7, spacingX: 10, spacingY: 11, litRatio: 0.45, tint: '#2a3540' },  // Modern mixed
  { winW: 4, winH: 6, spacingX: 7, spacingY: 10, litRatio: 0.75, tint: '#1e3040' },   // Dense commercial
  { winW: 8, winH: 8, spacingX: 12, spacingY: 12, litRatio: 0.40, tint: '#203050' },  // Large pane modern
];

function getTexturePool(): TexturePair[] {
  if (texturePool) return texturePool;
  texturePool = [];

  const W = 128;
  const H = 256;

  for (let v = 0; v < VARIANTS; v++) {
    const style = WINDOW_STYLES[v];

    // ── Diffuse canvas ──
    const diffCanvas = document.createElement('canvas');
    diffCanvas.width = W;
    diffCanvas.height = H;
    const dCtx = diffCanvas.getContext('2d')!;

    // White base (material color multiplies through)
    dCtx.fillStyle = '#ffffff';
    dCtx.fillRect(0, 0, W, H);

    // Subtle concrete noise
    for (let i = 0; i < 500; i++) {
      const nx = Math.random() * W;
      const ny = Math.random() * H;
      const b = 200 + Math.floor(Math.random() * 40);
      dCtx.fillStyle = `rgba(${b}, ${b}, ${b}, 0.10)`;
      dCtx.fillRect(nx, ny, 2 + Math.random() * 3, 3 + Math.random() * 4);
    }

    // ── Emissive canvas ──
    const emCanvas = document.createElement('canvas');
    emCanvas.width = W;
    emCanvas.height = H;
    const eCtx = emCanvas.getContext('2d')!;

    eCtx.fillStyle = '#000000';
    eCtx.fillRect(0, 0, W, H);

    // ── Window grid with per-style parameters ──
    const offsetX = 4 + ((v * 3) % 6);

    for (let y = 8; y < H - 6; y += style.spacingY) {
      for (let x = offsetX; x < W - style.winW; x += style.spacingX) {
        const lit = Math.random() < style.litRatio;

        // Diffuse: glass windows
        dCtx.fillStyle = style.tint;
        dCtx.fillRect(x, y, style.winW, style.winH);
        // Glass reflection highlight at top
        dCtx.fillStyle = 'rgba(100, 130, 170, 0.3)';
        dCtx.fillRect(x, y, style.winW, Math.max(2, style.winH * 0.2));

        // Emissive: only lit windows glow
        if (lit) {
          const warmth = 200 + Math.floor(Math.random() * 55);
          eCtx.fillStyle = `rgba(255, ${warmth}, ${Math.floor(warmth * 0.6)}, ${0.5 + Math.random() * 0.5})`;
          eCtx.fillRect(x, y, style.winW, style.winH);
        }
      }
    }

    // Horizontal floor separator lines
    dCtx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    dCtx.lineWidth = 1;
    for (let y = style.spacingY + style.winH; y < H; y += style.spacingY) {
      dCtx.beginPath();
      dCtx.moveTo(0, y);
      dCtx.lineTo(W, y);
      dCtx.stroke();
    }

    // Vertical pilaster lines between window columns for depth
    dCtx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
    for (let x = offsetX + style.spacingX - 1; x < W; x += style.spacingX) {
      dCtx.beginPath();
      dCtx.moveTo(x, 0);
      dCtx.lineTo(x, H);
      dCtx.stroke();
    }

    // Create textures
    const diffTex = new THREE.CanvasTexture(diffCanvas);
    diffTex.wrapS = THREE.RepeatWrapping;
    diffTex.wrapT = THREE.RepeatWrapping;
    diffTex.magFilter = THREE.LinearFilter;
    diffTex.minFilter = THREE.LinearMipmapLinearFilter;

    const emTex = new THREE.CanvasTexture(emCanvas);
    emTex.wrapS = THREE.RepeatWrapping;
    emTex.wrapT = THREE.RepeatWrapping;
    emTex.magFilter = THREE.LinearFilter;
    emTex.minFilter = THREE.LinearMipmapLinearFilter;

    texturePool.push({ diffuse: diffTex, emissive: emTex });
  }

  return texturePool;
}

// ── Shared detail materials (created once, reused by all buildings) ──

let sharedMaterials: {
  concrete: THREE.MeshToonMaterial;
  metal: THREE.MeshToonMaterial;
  dark: THREE.MeshToonMaterial;
} | null = null;

function getSharedMaterials() {
  if (sharedMaterials) return sharedMaterials;
  sharedMaterials = {
    concrete: createToonMaterial(0xBBBBBB),
    metal: createToonMaterial(0xAAAABB),
    dark: createToonMaterial(0x666666),
  };
  return sharedMaterials;
}

export class BuildingLOD {
  /**
   * Create a LOD building with three detail levels and procedural window textures.
   * LOD Level 0 now includes randomized architectural details (parapets, antennas, etc.)
   *
   * Coordinate system: LOD is placed at (x, h/2, z) by City.addBuilding(),
   * so within the group: y=0 = center, y=-h/2 = ground, y=h/2 = rooftop.
   */
  static create(
    width: number,
    height: number,
    depth: number,
    color: number
  ): THREE.LOD {
    const lod = new THREE.LOD();
    const pool = getTexturePool();
    const texPair = pool[Math.floor(Math.random() * pool.length)];

    // Only add windows to buildings taller than 8 units (skip tiny structures)
    const hasWindows = height > 8;

    // Level 0 (0-100 units): Full detail GROUP with base box + architectural details
    const highGroup = new THREE.Group();

    const highGeo = new THREE.BoxGeometry(width, height, depth);
    const highMat = createToonMaterial(color, hasWindows ? { map: texPair.diffuse } : undefined);
    const highMesh = new THREE.Mesh(highGeo, highMat);
    highMesh.castShadow = true;
    highMesh.receiveShadow = true;
    highGroup.add(highMesh);

    lod.addLevel(highGroup, 0);

    // Level 1 (200-600 units): Medium detail with textures
    const medGeo = new THREE.BoxGeometry(width, height, depth);
    const medMat = createToonMaterial(color, hasWindows ? { map: texPair.diffuse } : undefined);
    const medMesh = new THREE.Mesh(medGeo, medMat);
    medMesh.castShadow = false;
    medMesh.receiveShadow = true;
    lod.addLevel(medMesh, 200);

    // Level 2 (600+ units): Low detail, no textures
    const lowMat = createToonMaterial(color);
    const lowMesh = new THREE.Mesh(medGeo.clone(), lowMat);
    lowMesh.castShadow = false;
    lowMesh.receiveShadow = false;
    lod.addLevel(lowMesh, 600);

    return lod;
  }

  /** Add randomized architectural details to a building's LOD 0 group */
  private static addDetails(
    group: THREE.Group,
    w: number, h: number, d: number,
    _color: number,
  ): void {
    const mats = getSharedMaterials();
    const roofY = h / 2; // top of building (in local coords)
    const groundY = -h / 2; // bottom of building

    // ── Ground-floor base (wider podium) ──
    if (h > 10 && Math.random() < 0.5) {
      const baseH = 3 + Math.random() * 2;
      const baseW = w + 1.5;
      const baseD = d + 1.5;
      const baseGeo = new THREE.BoxGeometry(baseW, baseH, baseD);
      const base = new THREE.Mesh(baseGeo, mats.dark);
      base.position.y = groundY + baseH / 2;
      base.receiveShadow = true;
      group.add(base);
    }

    // ── Setback tower (narrower upper section on very tall buildings) ──
    if (h > 40 && Math.random() < 0.4) {
      const towerH = 8 + Math.random() * 12;
      const towerW = w * (0.4 + Math.random() * 0.2);
      const towerD = d * (0.4 + Math.random() * 0.2);
      const towerGeo = new THREE.BoxGeometry(towerW, towerH, towerD);
      const tower = new THREE.Mesh(towerGeo, mats.concrete);
      tower.position.y = roofY + towerH / 2;
      tower.castShadow = true;
      group.add(tower);
    }

    // Skip rooftop details for short buildings
    if (h <= 15) return;

    const roll = Math.random();

    if (roll < 0.25) {
      // ── Parapet walls (4 thin boxes on rooftop edge) ──
      const parapetH = 0.8 + Math.random() * 0.6;
      const thick = 0.3;

      // Front & back
      const fbGeo = new THREE.BoxGeometry(w, parapetH, thick);
      const front = new THREE.Mesh(fbGeo, mats.concrete);
      front.position.set(0, roofY + parapetH / 2, d / 2);
      group.add(front);
      const back = new THREE.Mesh(fbGeo, mats.concrete);
      back.position.set(0, roofY + parapetH / 2, -d / 2);
      group.add(back);

      // Left & right
      const lrGeo = new THREE.BoxGeometry(thick, parapetH, d);
      const left = new THREE.Mesh(lrGeo, mats.concrete);
      left.position.set(-w / 2, roofY + parapetH / 2, 0);
      group.add(left);
      const right = new THREE.Mesh(lrGeo, mats.concrete);
      right.position.set(w / 2, roofY + parapetH / 2, 0);
      group.add(right);
    } else if (roll < 0.45) {
      // ── Rooftop equipment (HVAC box + vent cylinder) ──
      const boxSize = 1.5 + Math.random() * 1.5;
      const eqGeo = new THREE.BoxGeometry(boxSize, boxSize * 0.7, boxSize);
      const eq = new THREE.Mesh(eqGeo, mats.metal);
      eq.position.set(
        (Math.random() - 0.5) * w * 0.5,
        roofY + boxSize * 0.35,
        (Math.random() - 0.5) * d * 0.5,
      );
      eq.castShadow = true;
      group.add(eq);

      const ventR = 0.3 + Math.random() * 0.3;
      const ventH = 1 + Math.random() * 1.5;
      const ventGeo = new THREE.CylinderGeometry(ventR, ventR, ventH, 6);
      const vent = new THREE.Mesh(ventGeo, mats.metal);
      vent.position.set(
        (Math.random() - 0.5) * w * 0.4,
        roofY + ventH / 2,
        (Math.random() - 0.5) * d * 0.4,
      );
      group.add(vent);
    } else if (roll < 0.6) {
      // ── Antenna / spire ──
      const spireR = 0.1 + Math.random() * 0.1;
      const spireH = 4 + Math.random() * 8;
      const spireGeo = new THREE.CylinderGeometry(spireR * 0.3, spireR, spireH, 5);
      const spire = new THREE.Mesh(spireGeo, mats.metal);
      spire.position.set(0, roofY + spireH / 2, 0);
      spire.castShadow = true;
      group.add(spire);
    } else if (roll < 0.7 && w > 12) {
      // ── Peaked roof (cone) ──
      const peakH = 3 + Math.random() * 4;
      const peakR = Math.min(w, d) * 0.45;
      const peakGeo = new THREE.ConeGeometry(peakR, peakH, 4);
      const peak = new THREE.Mesh(peakGeo, mats.dark);
      peak.position.y = roofY + peakH / 2;
      peak.rotation.y = Math.PI / 4; // align corners with building edges
      peak.castShadow = true;
      group.add(peak);
    }
    // else: flat roof (no detail) — remaining 30%
  }
}
