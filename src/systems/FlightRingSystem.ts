import * as THREE from 'three';
import { createToonMaterial } from '../rendering/ToonUtils';
import { FLIGHT_RINGS } from '../utils/Constants';

export interface FlightRing {
  position: THREE.Vector3;
  mesh: THREE.Group;
  collected: boolean;
  respawnTime: number;
  rotationSpeed: number;
}

/**
 * Flight Ring Checkpoint System
 * Creates glowing rings scattered around the city for players to fly through
 * Rewards coins and encourages exploration
 */
export class FlightRingSystem {
  private rings: FlightRing[] = [];
  readonly group = new THREE.Group();

  // Callback for ring collection tracking
  onRingCollected: (() => void) | null = null;

  constructor(cityBounds: { minX: number; maxX: number; minZ: number; maxZ: number }) {
    this.generateRings(cityBounds);
  }

  private generateRings(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }): void {
    const ringGeo = new THREE.TorusGeometry(
      FLIGHT_RINGS.RADIUS,
      FLIGHT_RINGS.THICKNESS,
      16,
      32
    );

    for (let i = 0; i < FLIGHT_RINGS.COUNT; i++) {
      const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
      const z = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);
      const y = 30 + Math.random() * 120; // Between 30 and 150 altitude

      const ringGroup = new THREE.Group();

      // Outer ring (glowing)
      const ringMat = createToonMaterial(0x00ff88, { transparent: true, opacity: 0.7 });

      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringGroup.add(ringMesh);

      // Inner glow sphere for visibility from distance
      const glowSphere = new THREE.Mesh(
        new THREE.SphereGeometry(FLIGHT_RINGS.RADIUS * 0.5, 8, 8),
        new THREE.MeshBasicMaterial({
          color: 0x00ff88,
          transparent: true,
          opacity: 0.3,
        })
      );
      ringGroup.add(glowSphere);

      // Point light for dramatic effect
      const light = new THREE.PointLight(0x00ff88, 1, FLIGHT_RINGS.RADIUS * 3);
      light.position.set(0, 0, 0);
      ringGroup.add(light);

      ringGroup.position.set(x, y, z);

      // Random rotation for variety
      ringGroup.rotation.set(
        (Math.random() - 0.5) * Math.PI,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * Math.PI
      );

      this.group.add(ringGroup);

      this.rings.push({
        position: new THREE.Vector3(x, y, z),
        mesh: ringGroup,
        collected: false,
        respawnTime: 0,
        rotationSpeed: 0.3 + Math.random() * 0.5,
      });
    }
  }

  update(dt: number): void {
    for (const ring of this.rings) {
      // Rotate rings slowly
      ring.mesh.rotation.z += ring.rotationSpeed * dt;

      // Handle respawn
      if (ring.collected) {
        ring.respawnTime -= dt;
        if (ring.respawnTime <= 0) {
          ring.collected = false;
          ring.mesh.visible = true;
        }
      }

      // Gentle bobbing animation
      if (!ring.collected) {
        ring.mesh.position.y = ring.position.y + Math.sin(Date.now() / 1000 + ring.position.x) * 2;
      }
    }
  }

  checkCollision(playerPos: THREE.Vector3, onCollect: (reward: number) => void): boolean {
    for (const ring of this.rings) {
      if (ring.collected) continue;

      const dist = playerPos.distanceTo(ring.position);
      if (dist < FLIGHT_RINGS.RADIUS * 1.2) {
        // Player passed through!
        ring.collected = true;
        ring.respawnTime = FLIGHT_RINGS.RESPAWN_TIME;
        ring.mesh.visible = false;

        onCollect(FLIGHT_RINGS.PASS_THROUGH_REWARD);

        // Notify ring tracker
        this.onRingCollected?.();

        return true;
      }
    }
    return false;
  }

  getVisibleRings(): FlightRing[] {
    return this.rings.filter(r => !r.collected);
  }
}
