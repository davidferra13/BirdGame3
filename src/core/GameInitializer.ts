/**
 * GameInitializer — Factory functions for creating the renderer, scene, and lighting.
 * Extracted from Game.ts constructor to reduce file size and separate concerns.
 */

import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

export function createRenderer(): THREE.WebGLRenderer {
  // Replace only the game canvas; preserve unrelated previews and interface canvases
  const oldCanvases = document.body.querySelectorAll('canvas#game-canvas');
  oldCanvases.forEach((c) => c.parentNode?.removeChild(c));

  const renderer = new THREE.WebGLRenderer({
    antialias: true, // Direct rendering has no FXAA pass; request hardware edge smoothing.
    powerPreference: 'high-performance',
    stencil: false,
    depth: true,
    logarithmicDepthBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.domElement.id = 'game-canvas';
  document.body.appendChild(renderer.domElement);
  return renderer;
}

export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  // Sky blue background — kept as fallback behind the Sky shader mesh
  scene.background = new THREE.Color(0x87ceeb);
  // Fog for distance culling — fades distant geometry to reduce overdraw
  scene.fog = new THREE.Fog(0x87ceeb, 260, 720);
  return scene;
}

export function setupLighting(scene: THREE.Scene): THREE.DirectionalLight {
  // Warm, soft sunlight for cartoon feel
  const sun = new THREE.DirectionalLight(0xfff4e6, 0.8);
  sun.position.set(50, 100, 50);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 200;
  sun.shadow.camera.left = -80;
  sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 80;
  sun.shadow.camera.bottom = -80;
  sun.shadow.bias = -0.002;
  scene.add(sun);

  // Warm ambient so nothing is too dark
  scene.add(new THREE.AmbientLight(0xfff8f0, 0.6));

  // Hemisphere: sky blue top, warm sand bottom
  scene.add(new THREE.HemisphereLight(0x87ceeb, 0xf5deb3, 0.5));

  return sun;
}

/**
 * Create a physically-based atmospheric sky with sun disc.
 * Returns the Sky mesh and a helper to update sun position.
 */
export function createSky(scene: THREE.Scene): { sky: Sky; setSunPosition: (elevation: number, azimuth: number) => void } {
  const sky = new Sky();
  sky.scale.setScalar(4500);
  // Ensure sky always renders (never culled) and renders behind everything
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);

  const skyUniforms = sky.material.uniforms;
  skyUniforms['turbidity'].value = 2;
  skyUniforms['rayleigh'].value = 3;
  skyUniforms['mieCoefficient'].value = 0.003;
  skyUniforms['mieDirectionalG'].value = 0.8;

  // Initial sun position (noon)
  const sunPosition = new THREE.Vector3();
  const phi = THREE.MathUtils.degToRad(90 - 45);
  const theta = THREE.MathUtils.degToRad(180);
  sunPosition.setFromSphericalCoords(1, phi, theta);
  skyUniforms['sunPosition'].value.copy(sunPosition);

  // Keep scene.background as sky blue fallback — the Sky mesh renders on top of it.
  // This prevents black flashing if the sky mesh ever fails to fully cover the viewport.

  const setSunPosition = (elevation: number, azimuth: number) => {
    const p = THREE.MathUtils.degToRad(90 - elevation);
    const t = THREE.MathUtils.degToRad(azimuth);
    sunPosition.setFromSphericalCoords(1, p, t);
    skyUniforms['sunPosition'].value.copy(sunPosition);
  };

  return { sky, setSunPosition };
}

/** Keep resolution and shadow quality in sync with the existing player setting. */
export function applyGraphicsQuality(
  renderer: THREE.WebGLRenderer,
  sun: THREE.DirectionalLight,
  quality: 'low' | 'medium' | 'high',
): void {
  const low = quality === 'low';
  const medium = quality === 'medium';
  const dpr = Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0
    ? window.devicePixelRatio : 1;
  renderer.setPixelRatio(Math.min(dpr, low ? 1 : medium ? 1.5 : 2));
  const requestedSize = low ? 512 : medium ? 1024 : 2048;
  const size = Math.min(requestedSize, renderer.capabilities.maxTextureSize);
  const filter = THREE.PCFSoftShadowMap;
  const changed = sun.shadow.mapSize.x !== size || sun.shadow.mapSize.y !== size
    || renderer.shadowMap.type !== filter;
  if (changed) {
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
    sun.shadow.mapSize.set(size, size);
    renderer.shadowMap.type = filter;
    sun.shadow.needsUpdate = true;
    renderer.shadowMap.needsUpdate = true;
  }
}
