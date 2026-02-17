import * as THREE from 'three';
import { WORLD } from '../utils/Constants';
import { createToonMaterial } from '../rendering/ToonUtils';

/**
 * Creates the ground plane with bright cartoon-green toon shading.
 */
export function createGround(): THREE.Mesh {
  const size = WORLD.CITY_SIZE * 2.5;
  const geo = new THREE.PlaneGeometry(size, size);
  const mat = createToonMaterial(0x7CCD4B);

  const ground = new THREE.Mesh(geo, mat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = WORLD.GROUND_Y;
  ground.receiveShadow = true;
  return ground;
}
