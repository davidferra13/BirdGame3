/**
 * RaceRoutes - Pre-defined race routes through the city.
 * Each route is an array of checkpoint positions.
 */

import * as THREE from 'three';

export interface RaceCheckpointDef {
  position: THREE.Vector3;
  radius: number;
}

export interface RaceRouteDef {
  name: string;
  checkpoints: RaceCheckpointDef[];
}

/**
 * 5 race routes winding through the city.
 * City is 1500x1500 centered at origin, buildings up to ~100 tall.
 * Routes go through interesting areas: between buildings, around landmarks, varied altitudes.
 */
export const RACE_ROUTES: RaceRouteDef[] = [
  {
    name: 'Downtown Sprint',
    checkpoints: [
      { position: new THREE.Vector3(0, 40, 0), radius: 6 },
      { position: new THREE.Vector3(60, 35, -40), radius: 6 },
      { position: new THREE.Vector3(120, 50, -20), radius: 6 },
      { position: new THREE.Vector3(150, 30, 40), radius: 6 },
      { position: new THREE.Vector3(100, 60, 100), radius: 6 },
      { position: new THREE.Vector3(40, 45, 120), radius: 6 },
      { position: new THREE.Vector3(-30, 35, 80), radius: 6 },
      { position: new THREE.Vector3(-80, 50, 30), radius: 6 },
      { position: new THREE.Vector3(-100, 40, -40), radius: 6 },
      { position: new THREE.Vector3(-60, 55, -100), radius: 6 },
      { position: new THREE.Vector3(0, 45, -80), radius: 6 },
      { position: new THREE.Vector3(0, 40, 0), radius: 6 },
    ],
  },
  {
    name: 'Skyline Loop',
    checkpoints: [
      { position: new THREE.Vector3(0, 80, 0), radius: 7 },
      { position: new THREE.Vector3(80, 90, -60), radius: 7 },
      { position: new THREE.Vector3(160, 70, 0), radius: 7 },
      { position: new THREE.Vector3(200, 100, 80), radius: 7 },
      { position: new THREE.Vector3(140, 60, 160), radius: 7 },
      { position: new THREE.Vector3(60, 80, 200), radius: 7 },
      { position: new THREE.Vector3(-40, 110, 160), radius: 7 },
      { position: new THREE.Vector3(-120, 75, 80), radius: 7 },
      { position: new THREE.Vector3(-160, 90, -20), radius: 7 },
      { position: new THREE.Vector3(-100, 70, -100), radius: 7 },
      { position: new THREE.Vector3(-20, 85, -60), radius: 7 },
      { position: new THREE.Vector3(0, 80, 0), radius: 7 },
    ],
  },
  {
    name: 'Low Rider',
    checkpoints: [
      { position: new THREE.Vector3(0, 20, 0), radius: 6 },
      { position: new THREE.Vector3(50, 15, -30), radius: 6 },
      { position: new THREE.Vector3(100, 25, -60), radius: 6 },
      { position: new THREE.Vector3(140, 18, -20), radius: 6 },
      { position: new THREE.Vector3(120, 22, 60), radius: 6 },
      { position: new THREE.Vector3(70, 15, 100), radius: 6 },
      { position: new THREE.Vector3(20, 28, 80), radius: 6 },
      { position: new THREE.Vector3(-40, 18, 50), radius: 6 },
      { position: new THREE.Vector3(-80, 22, -10), radius: 6 },
      { position: new THREE.Vector3(-50, 16, -60), radius: 6 },
      { position: new THREE.Vector3(0, 20, -30), radius: 6 },
      { position: new THREE.Vector3(0, 20, 0), radius: 6 },
    ],
  },
  {
    name: 'Rollercoaster',
    checkpoints: [
      { position: new THREE.Vector3(0, 50, 0), radius: 6 },
      { position: new THREE.Vector3(70, 20, -50), radius: 6 },
      { position: new THREE.Vector3(130, 90, -30), radius: 6 },
      { position: new THREE.Vector3(160, 25, 30), radius: 6 },
      { position: new THREE.Vector3(120, 100, 100), radius: 6 },
      { position: new THREE.Vector3(50, 15, 130), radius: 6 },
      { position: new THREE.Vector3(-20, 80, 90), radius: 6 },
      { position: new THREE.Vector3(-80, 20, 40), radius: 6 },
      { position: new THREE.Vector3(-120, 95, -30), radius: 6 },
      { position: new THREE.Vector3(-70, 25, -80), radius: 6 },
      { position: new THREE.Vector3(-10, 70, -50), radius: 6 },
      { position: new THREE.Vector3(0, 50, 0), radius: 6 },
    ],
  },
  {
    name: 'Grand Tour',
    checkpoints: [
      { position: new THREE.Vector3(0, 50, 0), radius: 7 },
      { position: new THREE.Vector3(100, 45, -80), radius: 7 },
      { position: new THREE.Vector3(200, 60, -150), radius: 7 },
      { position: new THREE.Vector3(280, 50, -50), radius: 7 },
      { position: new THREE.Vector3(250, 70, 80), radius: 7 },
      { position: new THREE.Vector3(150, 40, 180), radius: 7 },
      { position: new THREE.Vector3(50, 60, 250), radius: 7 },
      { position: new THREE.Vector3(-80, 45, 180), radius: 7 },
      { position: new THREE.Vector3(-180, 65, 80), radius: 7 },
      { position: new THREE.Vector3(-220, 50, -40), radius: 7 },
      { position: new THREE.Vector3(-140, 55, -130), radius: 7 },
      { position: new THREE.Vector3(-50, 50, -80), radius: 7 },
      { position: new THREE.Vector3(0, 50, 0), radius: 7 },
    ],
  },
];
