import * as THREE from 'three';
import { HOTSPOT, WORLD } from '../utils/Constants';

export interface HotspotData {
  position: THREE.Vector3;
  radius: number;
}

export class HotspotSystem {
  readonly group = new THREE.Group();
  readonly hotspots: HotspotData[] = [];
  private beacons: THREE.Mesh[] = [];
  private rings: THREE.Mesh[] = [];
  private rotationTimer = 0;
  private elapsed = 0;

  constructor() {
    this.generateHotspots();
  }

  private generateHotspots(): void {
    for (let i = 0; i < HOTSPOT.COUNT; i++) {
      const pos = this.randomPosition(i);
      const data: HotspotData = { position: pos, radius: HOTSPOT.RADIUS };
      this.hotspots.push(data);

      // Visual beacon
      const beamGeo = new THREE.CylinderGeometry(1, 2, HOTSPOT.BEACON_HEIGHT, 6);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide,
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(pos.x, HOTSPOT.BEACON_HEIGHT / 2, pos.z);
      this.group.add(beam);
      this.beacons.push(beam);

      // Ground ring
      const ringGeo = new THREE.RingGeometry(HOTSPOT.RADIUS - 1, HOTSPOT.RADIUS, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(pos.x, 0.2, pos.z);
      this.group.add(ring);
      this.rings.push(ring);
    }
  }

  private randomPosition(index: number): THREE.Vector3 {
    const halfSize = WORLD.CITY_SIZE / 2;
    const margin = HOTSPOT.RADIUS + 10;
    // Place hotspots in different quadrants
    const quadrants = [
      { x: 1, z: 1 },
      { x: -1, z: -1 },
      { x: 1, z: -1 },
      { x: -1, z: 1 },
    ];
    const q = quadrants[index % quadrants.length];
    const x = q.x * (HOTSPOT.MIN_DISTANCE_FROM_SANCTUARY + Math.random() * (halfSize - margin - HOTSPOT.MIN_DISTANCE_FROM_SANCTUARY));
    const z = q.z * (HOTSPOT.MIN_DISTANCE_FROM_SANCTUARY + Math.random() * (halfSize - margin - HOTSPOT.MIN_DISTANCE_FROM_SANCTUARY));
    return new THREE.Vector3(x, 0, z);
  }

  isInsideHotspot(position: THREE.Vector3): boolean {
    for (const hs of this.hotspots) {
      const dx = position.x - hs.position.x;
      const dz = position.z - hs.position.z;
      if (Math.sqrt(dx * dx + dz * dz) < hs.radius) return true;
    }
    return false;
  }

  getPositions(): THREE.Vector3[] {
    return this.hotspots.map(h => h.position.clone());
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.rotationTimer += dt;

    // Rotate hotspots every 10 minutes
    if (this.rotationTimer >= HOTSPOT.ROTATION_INTERVAL) {
      this.rotationTimer = 0;
      this.rotateHotspots();
    }

    // Animate beacons
    for (let i = 0; i < this.beacons.length; i++) {
      const mat = this.beacons[i].material as THREE.MeshBasicMaterial;
      mat.opacity = 0.08 + Math.sin(this.elapsed * 2 + i) * 0.04;
    }

    for (let i = 0; i < this.rings.length; i++) {
      const mat = this.rings[i].material as THREE.MeshBasicMaterial;
      mat.opacity = 0.2 + Math.sin(this.elapsed * 3 + i) * 0.1;
    }
  }

  private rotateHotspots(): void {
    for (let i = 0; i < this.hotspots.length; i++) {
      const pos = this.randomPosition(i + Math.floor(Math.random() * 4));
      this.hotspots[i].position.copy(pos);
      this.beacons[i].position.set(pos.x, HOTSPOT.BEACON_HEIGHT / 2, pos.z);
      this.rings[i].position.set(pos.x, 0.2, pos.z);
    }
  }
}
