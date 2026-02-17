import * as THREE from 'three';

/**
 * Shared toon-shading utilities.
 * Creates a 3-step gradient map for MeshToonMaterial and provides
 * factory functions so every object in the game gets consistent cel-shading.
 */

let _gradientMap: THREE.DataTexture | null = null;

/** 3-step gradient map: shadow → mid → lit with NearestFilter for hard bands */
export function getToonGradientMap(): THREE.DataTexture {
  if (_gradientMap) return _gradientMap;
  const colors = new Uint8Array([60, 140, 255]); // shadow, mid, lit luminance
  _gradientMap = new THREE.DataTexture(colors, 3, 1, THREE.RedFormat);
  _gradientMap.needsUpdate = true;
  _gradientMap.magFilter = THREE.NearestFilter;
  _gradientMap.minFilter = THREE.NearestFilter;
  return _gradientMap;
}

export interface ToonOptions {
  side?: THREE.Side;
  transparent?: boolean;
  opacity?: number;
  map?: THREE.Texture | null;
}

/** Create a MeshToonMaterial with the shared gradient map */
export function createToonMaterial(color: number | THREE.Color, opts?: ToonOptions): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: getToonGradientMap(),
    side: opts?.side ?? THREE.FrontSide,
    transparent: opts?.transparent ?? false,
    opacity: opts?.opacity ?? 1,
    map: opts?.map ?? null,
  });
}

/** Traverse an Object3D and swap all Standard/Lambert materials to toon */
export function convertToToon(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const mat = child.material;
    if (!mat || mat instanceof THREE.MeshToonMaterial) return;

    if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshLambertMaterial) {
      const toon = new THREE.MeshToonMaterial({
        color: mat.color.clone(),
        gradientMap: getToonGradientMap(),
        side: mat.side,
        transparent: mat.transparent,
        opacity: mat.opacity,
        map: mat.map ?? null,
      });
      child.material = toon;
      mat.dispose();
    }
  });
}
