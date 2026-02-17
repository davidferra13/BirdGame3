import * as THREE from 'three';
import { createToonMaterial } from '../rendering/ToonUtils';

export const SANCTUARY = {
  POSITION: new THREE.Vector3(0, 0, 0), // center of city
  BANK_RADIUS: 12,
  PILLAR_HEIGHT: 60,
  GLOW_COLOR: 0x44ffaa,
  PULSE_SPEED: 2.0,
};

export class Sanctuary {
  readonly group = new THREE.Group();
  private beam: THREE.Mesh;
  private ring: THREE.Mesh;
  private elapsed = 0;

  constructor() {
    // Base platform — circular stone pad
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(5, 5.5, 0.6, 16),
      createToonMaterial(0xaaaaaa),
    );
    pad.position.y = 0.3;
    pad.receiveShadow = true;
    this.group.add(pad);

    // Inner glow circle
    const glowPad = new THREE.Mesh(
      new THREE.CylinderGeometry(3.5, 3.5, 0.7, 16),
      createToonMaterial(SANCTUARY.GLOW_COLOR),
    );
    glowPad.position.y = 0.35;
    this.group.add(glowPad);

    // Vertical beam of light
    const beamGeo = new THREE.CylinderGeometry(0.8, 1.5, SANCTUARY.PILLAR_HEIGHT, 8);
    const beamMat = new THREE.MeshBasicMaterial({
      color: SANCTUARY.GLOW_COLOR,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });
    this.beam = new THREE.Mesh(beamGeo, beamMat);
    this.beam.position.y = SANCTUARY.PILLAR_HEIGHT / 2;
    this.group.add(this.beam);

    // Floating ring that bobs up and down
    const ringGeo = new THREE.TorusGeometry(4, 0.2, 8, 24);
    const ringMat = createToonMaterial(SANCTUARY.GLOW_COLOR);
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = 8;
    this.group.add(this.ring);

    // Point light for local glow
    const light = new THREE.PointLight(SANCTUARY.GLOW_COLOR, 2, 30);
    light.position.y = 5;
    this.group.add(light);

    this.group.position.copy(SANCTUARY.POSITION);
  }

  update(dt: number): void {
    this.elapsed += dt;

    // Ring bobs up and down
    this.ring.position.y = 8 + Math.sin(this.elapsed * SANCTUARY.PULSE_SPEED) * 1.5;
    this.ring.rotation.z = this.elapsed * 0.3;

    // Beam pulses
    const beamMat = this.beam.material as THREE.MeshBasicMaterial;
    beamMat.opacity = 0.1 + Math.sin(this.elapsed * SANCTUARY.PULSE_SPEED) * 0.05;
  }

  /** Check if a position is within banking range */
  isInRange(position: THREE.Vector3): boolean {
    const dx = position.x - SANCTUARY.POSITION.x;
    const dz = position.z - SANCTUARY.POSITION.z;
    const dist2D = Math.sqrt(dx * dx + dz * dz);
    return dist2D < SANCTUARY.BANK_RADIUS && position.y < SANCTUARY.PILLAR_HEIGHT;
  }
}
