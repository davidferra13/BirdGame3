import * as THREE from 'three';
import { createToonMaterial } from '../rendering/ToonUtils';
import { COLLECTIBLES } from '../utils/Constants';
import { BuildingData } from '../world/City';

export interface GoldenFeather {
  position: THREE.Vector3;
  mesh: THREE.Group;
  collected: boolean;
  respawnTime: number;
  pulsePhase: number;
}

export interface ThermalUpdraft {
  position: THREE.Vector3;
  particles: THREE.Points;
  active: boolean;
}

export interface Balloon {
  mesh: THREE.Group;
  position: THREE.Vector3;
  color: number;
  coinReward: number;
  riseSpeed: number;
  driftAngle: number;
  driftSpeed: number;
  bobPhase: number;
  collected: boolean;
  popTimer: number; // > 0 means popping animation in progress
}

/**
 * Collectible System
 * Manages golden feathers hidden on rooftops and thermal updrafts
 */
export class CollectibleSystem {
  private goldenFeathers: GoldenFeather[] = [];
  private thermalUpdrafts: ThermalUpdraft[] = [];
  private balloons: Balloon[] = [];
  private balloonSpawnTimer = 0;
  readonly group = new THREE.Group();

  // Callbacks for collectible tracking
  onGoldenFeatherCollected: (() => void) | null = null;
  onThermalUpdraftUsed: (() => void) | null = null;
  onBalloonCollected: (() => void) | null = null;

  constructor(buildings: BuildingData[], cityBounds: { minX: number; maxX: number; minZ: number; maxZ: number }) {
    this.placeGoldenFeathers(buildings);
    this.createThermalUpdrafts(cityBounds);
  }

  private placeGoldenFeathers(buildings: BuildingData[]): void {
    // Sort buildings by height, place feathers on tallest rooftops
    const tallBuildings = buildings
      .filter(b => b.height > 20)
      .sort((a, b) => b.height - a.height)
      .slice(0, COLLECTIBLES.GOLDEN_FEATHERS.COUNT);

    for (const building of tallBuildings) {
      const featherGroup = new THREE.Group();

      // Golden feather geometry
      const featherShape = new THREE.Shape();
      featherShape.moveTo(0, 0);
      featherShape.quadraticCurveTo(0.5, 1, 0, 2);
      featherShape.quadraticCurveTo(-0.5, 1.5, -0.3, 0.5);
      featherShape.quadraticCurveTo(-0.2, 0.2, 0, 0);

      const featherGeo = new THREE.ExtrudeGeometry(featherShape, {
        depth: 0.2,
        bevelEnabled: true,
        bevelThickness: 0.1,
        bevelSize: 0.1,
      });

      const featherMat = createToonMaterial(0xffd700);

      const feather = new THREE.Mesh(featherGeo, featherMat);
      feather.scale.set(1.5, 1.5, 1.5);
      feather.rotation.x = Math.PI / 2;
      featherGroup.add(feather);

      // Glow sphere
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(1, 8, 8),
        new THREE.MeshBasicMaterial({
          color: 0xffd700,
          transparent: true,
          opacity: 0.3,
        })
      );
      featherGroup.add(glow);

      // Point light
      const light = new THREE.PointLight(0xffd700, 1, COLLECTIBLES.GOLDEN_FEATHERS.GLOW_RADIUS);
      featherGroup.add(light);

      // Position on rooftop
      const rooftopY = building.height + 2;
      featherGroup.position.set(building.position.x, rooftopY, building.position.z);

      this.group.add(featherGroup);

      this.goldenFeathers.push({
        position: new THREE.Vector3(building.position.x, rooftopY, building.position.z),
        mesh: featherGroup,
        collected: false,
        respawnTime: 0,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
  }

  private createThermalUpdrafts(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }): void {
    for (let i = 0; i < COLLECTIBLES.THERMAL_UPDRAFTS.COUNT; i++) {
      const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
      const z = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);

      // Create rising particle effect
      const particleCount = 100;
      const positions = new Float32Array(particleCount * 3);
      const velocities: number[] = [];

      for (let j = 0; j < particleCount; j++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * COLLECTIBLES.THERMAL_UPDRAFTS.RADIUS;

        positions[j * 3] = x + Math.cos(angle) * radius;
        positions[j * 3 + 1] = Math.random() * COLLECTIBLES.THERMAL_UPDRAFTS.VISUAL_HEIGHT;
        positions[j * 3 + 2] = z + Math.sin(angle) * radius;

        velocities.push(5 + Math.random() * 10); // Upward velocity
      }

      const particleGeo = new THREE.BufferGeometry();
      particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const particleMat = new THREE.PointsMaterial({
        color: 0xaaccff,
        size: 1.5,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
      });

      const particles = new THREE.Points(particleGeo, particleMat);
      this.group.add(particles);

      this.thermalUpdrafts.push({
        position: new THREE.Vector3(x, 0, z),
        particles,
        active: true,
      });

      // Store velocities for animation
      (particles as any).velocities = velocities;
    }
  }

  private static readonly BALLOON_COLORS = [
    0xff4444, // red
    0x44aaff, // blue
    0xffdd44, // yellow
    0x44ff88, // green
    0xff88dd, // pink
    0xffaa44, // orange
    0xdd44ff, // purple
  ];

  private createBalloonMesh(color: number): THREE.Group {
    const group = new THREE.Group();

    // Balloon body (elongated sphere)
    const balloonGeo = new THREE.SphereGeometry(1.2, 8, 6);
    balloonGeo.scale(1, 1.3, 1);
    const balloonMat = createToonMaterial(color);
    const balloonMesh = new THREE.Mesh(balloonGeo, balloonMat);
    balloonMesh.position.y = 1.5;
    group.add(balloonMesh);

    // Highlight (shiny spot)
    const highlightGeo = new THREE.SphereGeometry(0.4, 6, 4);
    const highlightMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
    });
    const highlight = new THREE.Mesh(highlightGeo, highlightMat);
    highlight.position.set(0.3, 2.0, 0.5);
    group.add(highlight);

    // Knot at bottom
    const knotGeo = new THREE.SphereGeometry(0.15, 4, 4);
    const knotMat = createToonMaterial(color);
    const knot = new THREE.Mesh(knotGeo, knotMat);
    knot.position.y = 0.2;
    group.add(knot);

    // String
    const stringGeo = new THREE.CylinderGeometry(0.02, 0.02, 2, 3);
    const stringMat = new THREE.MeshBasicMaterial({ color: 0x888888 });
    const string = new THREE.Mesh(stringGeo, stringMat);
    string.position.y = -0.8;
    group.add(string);

    return group;
  }

  spawnBalloon(playerPos: THREE.Vector3): void {
    const cfg = COLLECTIBLES.BALLOONS;
    if (this.balloons.length >= cfg.MAX_COUNT) return;

    // Spawn at random position around the player
    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * (cfg.SPAWN_RADIUS - 30);
    const x = playerPos.x + Math.cos(angle) * dist;
    const z = playerPos.z + Math.sin(angle) * dist;
    const y = cfg.MIN_ALTITUDE + Math.random() * 20; // Start at low-ish altitude

    const color = CollectibleSystem.BALLOON_COLORS[
      Math.floor(Math.random() * CollectibleSystem.BALLOON_COLORS.length)
    ];

    const coinReward = cfg.COIN_REWARD_MIN +
      Math.floor(Math.random() * (cfg.COIN_REWARD_MAX - cfg.COIN_REWARD_MIN + 1));

    const mesh = this.createBalloonMesh(color);
    mesh.position.set(x, y, z);
    this.group.add(mesh);

    this.balloons.push({
      mesh,
      position: new THREE.Vector3(x, y, z),
      color,
      coinReward,
      riseSpeed: cfg.RISE_SPEED * (0.7 + Math.random() * 0.6),
      driftAngle: Math.random() * Math.PI * 2,
      driftSpeed: cfg.DRIFT_SPEED * (0.5 + Math.random()),
      bobPhase: Math.random() * Math.PI * 2,
      collected: false,
      popTimer: 0,
    });
  }

  update(dt: number, playerPos?: THREE.Vector3): void {
    // Animate golden feathers
    for (const feather of this.goldenFeathers) {
      if (feather.collected) {
        feather.respawnTime -= dt;
        if (feather.respawnTime <= 0) {
          feather.collected = false;
          feather.mesh.visible = true;
        }
      } else {
        // Gentle rotation and pulse
        feather.mesh.rotation.y += dt;
        feather.pulsePhase += dt * 2;
        const scale = 1 + Math.sin(feather.pulsePhase) * 0.2;
        feather.mesh.scale.set(scale, scale, scale);
      }
    }

    // Spawn balloons periodically near the player
    if (playerPos) {
      this.balloonSpawnTimer += dt;
      if (this.balloonSpawnTimer >= COLLECTIBLES.BALLOONS.SPAWN_INTERVAL) {
        this.balloonSpawnTimer = 0;
        this.spawnBalloon(playerPos);
      }
    }

    // Update balloons
    const cfg = COLLECTIBLES.BALLOONS;
    for (let i = this.balloons.length - 1; i >= 0; i--) {
      const balloon = this.balloons[i];

      // Pop animation
      if (balloon.popTimer > 0) {
        balloon.popTimer -= dt;
        const t = balloon.popTimer / 0.3; // 0.3s pop animation
        balloon.mesh.scale.set(1 + (1 - t) * 2, 1 + (1 - t) * 2, 1 + (1 - t) * 2);
        balloon.mesh.children.forEach(child => {
          if ((child as THREE.Mesh).material) {
            const mat = (child as THREE.Mesh).material as THREE.Material;
            if ('opacity' in mat) {
              mat.opacity = t;
              mat.transparent = true;
            }
          }
        });
        if (balloon.popTimer <= 0) {
          this.group.remove(balloon.mesh);
          this.balloons.splice(i, 1);
        }
        continue;
      }

      // Float upward
      balloon.position.y += balloon.riseSpeed * dt;

      // Gentle horizontal drift
      balloon.position.x += Math.cos(balloon.driftAngle) * balloon.driftSpeed * dt;
      balloon.position.z += Math.sin(balloon.driftAngle) * balloon.driftSpeed * dt;

      // Gentle bob
      balloon.bobPhase += dt * 1.5;
      const bobOffset = Math.sin(balloon.bobPhase) * 0.3;

      // Slight sway
      balloon.mesh.rotation.z = Math.sin(balloon.bobPhase * 0.7) * 0.1;

      balloon.mesh.position.set(
        balloon.position.x,
        balloon.position.y + bobOffset,
        balloon.position.z,
      );

      // Despawn if too high or too far from player
      if (balloon.position.y > cfg.MAX_ALTITUDE) {
        this.group.remove(balloon.mesh);
        this.balloons.splice(i, 1);
        continue;
      }

      // Despawn if very far from player (cleanup)
      if (playerPos) {
        const dx = balloon.position.x - playerPos.x;
        const dz = balloon.position.z - playerPos.z;
        if (dx * dx + dz * dz > 400 * 400) {
          this.group.remove(balloon.mesh);
          this.balloons.splice(i, 1);
        }
      }
    }

    // Animate thermal updrafts
    for (const updraft of this.thermalUpdrafts) {
      if (!updraft.active) continue;

      const positions = updraft.particles.geometry.attributes.position.array as Float32Array;
      const velocities = (updraft.particles as any).velocities as number[];

      for (let i = 0; i < velocities.length; i++) {
        positions[i * 3 + 1] += velocities[i] * dt;

        // Reset particles that go too high
        if (positions[i * 3 + 1] > COLLECTIBLES.THERMAL_UPDRAFTS.VISUAL_HEIGHT) {
          positions[i * 3 + 1] = 0;

          // Randomize position within radius
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * COLLECTIBLES.THERMAL_UPDRAFTS.RADIUS;
          positions[i * 3] = updraft.position.x + Math.cos(angle) * radius;
          positions[i * 3 + 2] = updraft.position.z + Math.sin(angle) * radius;
        }
      }

      updraft.particles.geometry.attributes.position.needsUpdate = true;
    }
  }

  checkFeatherCollection(playerPos: THREE.Vector3, onCollect: (coins: number, feathers: number) => void): boolean {
    for (const feather of this.goldenFeathers) {
      if (feather.collected) continue;

      const dist = playerPos.distanceTo(feather.position);
      if (dist < 3) {
        feather.collected = true;
        feather.respawnTime = COLLECTIBLES.GOLDEN_FEATHERS.RESPAWN_TIME;
        feather.mesh.visible = false;

        onCollect(
          COLLECTIBLES.GOLDEN_FEATHERS.COLLECTION_REWARD,
          COLLECTIBLES.GOLDEN_FEATHERS.PREMIUM_REWARD
        );

        // Notify collectible tracker
        this.onGoldenFeatherCollected?.();

        return true;
      }
    }
    return false;
  }

  checkThermalUpdraft(playerPos: THREE.Vector3): { lift: number; spiralAngle: number; spiralStrength: number } {
    for (const updraft of this.thermalUpdrafts) {
      if (!updraft.active) continue;

      const dx = playerPos.x - updraft.position.x;
      const dz = playerPos.z - updraft.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < COLLECTIBLES.THERMAL_UPDRAFTS.RADIUS) {
        // Player is in thermal! Calculate lift and spiral
        const edgeFactor = dist / COLLECTIBLES.THERMAL_UPDRAFTS.RADIUS;
        const liftStrength = (1 - edgeFactor) * COLLECTIBLES.THERMAL_UPDRAFTS.LIFT_STRENGTH;

        // IMPROVEMENT #7: Thermal auto-banking (spiral mechanics)
        // Spiral banking force: pulls into circular motion
        const angle = Math.atan2(dz, dx);
        const spiralAngle = angle + Math.PI / 2; // Perpendicular = circular motion
        const spiralStrength = (1 - edgeFactor) * 0.8; // Stronger near center

        return { lift: liftStrength, spiralAngle, spiralStrength };
      }
    }
    return { lift: 0, spiralAngle: 0, spiralStrength: 0 };
  }

  checkBalloonCollection(playerPos: THREE.Vector3, onCollect: (coins: number) => void): boolean {
    const collectRadius = COLLECTIBLES.BALLOONS.COLLECT_RADIUS;
    const collectRadiusSq = collectRadius * collectRadius;

    for (const balloon of this.balloons) {
      if (balloon.collected || balloon.popTimer > 0) continue;

      const dx = playerPos.x - balloon.position.x;
      const dy = playerPos.y - balloon.position.y;
      const dz = playerPos.z - balloon.position.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < collectRadiusSq) {
        balloon.collected = true;
        balloon.popTimer = 0.3; // Start pop animation
        onCollect(balloon.coinReward);
        this.onBalloonCollected?.();
        return true;
      }
    }
    return false;
  }

  getFeatherCount(): { collected: number; total: number } {
    const collected = this.goldenFeathers.filter(f => f.collected).length;
    return { collected, total: this.goldenFeathers.length };
  }
}
