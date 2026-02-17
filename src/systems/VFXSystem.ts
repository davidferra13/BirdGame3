import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh | THREE.Line;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  scale?: number;
}

export class VFXSystem {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private readonly MAX_PARTICLES = 50;  // Limit total particles for performance

  private static sphereGeo = new THREE.SphereGeometry(0.1, 4, 3);  // Reduced geometry detail
  private static ringGeo = new THREE.RingGeometry(0.5, 0.7, 12);  // Reduced geometry detail
  private static shockRingGeo = new THREE.RingGeometry(0.5, 0.8, 24);

  private sanctuaryBoundary: THREE.Line | null = null;
  private shimmerTime = 0;

  // PHASE 5: Camera reference for distance-based particle culling
  private camera: THREE.Camera | null = null;

  // Pre-allocated mesh pool to avoid material/mesh allocation during gameplay
  private meshPool: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.preallocatePool();
  }

  /** Pre-create reusable meshes to eliminate per-frame allocation */
  private preallocatePool(): void {
    for (let i = 0; i < this.MAX_PARTICLES; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
      const mesh = new THREE.Mesh(VFXSystem.sphereGeo, mat);
      mesh.visible = false;
      this.meshPool.push(mesh);
    }
  }

  private acquireMesh(color: number, geometry: THREE.BufferGeometry, side?: THREE.Side, depthWrite?: boolean): THREE.Mesh {
    const mesh = this.meshPool.pop();
    if (mesh) {
      mesh.geometry = geometry;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(color);
      mat.opacity = 1;
      mat.side = side ?? THREE.FrontSide;
      mat.depthWrite = depthWrite ?? true;
      mesh.scale.setScalar(1);
      mesh.rotation.set(0, 0, 0);
      mesh.visible = true;
      return mesh;
    }
    // Fallback: create new if pool is exhausted (shouldn't happen with MAX_PARTICLES cap)
    return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      color, transparent: true, side: side ?? THREE.FrontSide, depthWrite: depthWrite ?? true,
    }));
  }

  private releaseMesh(mesh: THREE.Mesh): void {
    mesh.visible = false;
    this.meshPool.push(mesh);
  }

  setCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        if (p.mesh instanceof THREE.Mesh) {
          this.releaseMesh(p.mesh);
        }
        this.particles.splice(i, 1);
        continue;
      }

      p.velocity.y -= 20 * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);

      const t = p.life / p.maxLife;
      if (p.mesh instanceof THREE.Mesh) {
        const mat = p.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = t;
        if (p.scale) {
          p.mesh.scale.setScalar(p.scale * (1 + (1 - t) * 0.5));
        }
      }
    }

    if (this.sanctuaryBoundary) {
      this.shimmerTime += dt;
      const mat = this.sanctuaryBoundary.material as THREE.LineBasicMaterial;
      mat.opacity = 0.2 + Math.sin(this.shimmerTime * 2) * 0.15;
    }
  }

  spawnWantedPulse(_position: THREE.Vector3): void {
    // No-op — heat/wanted system removed
  }

  hideWantedPulse(): void {
    // No-op — heat/wanted system removed
  }

  spawnBankingBurst(position: THREE.Vector3, coinAmount: number): void {
    // Limit particle count for performance
    if (this.particles.length >= this.MAX_PARTICLES) return;
    const count = Math.min(10, Math.floor(coinAmount / 20) + 3);  // Reduced particle count

    for (let i = 0; i < count; i++) {
      const mesh = this.acquireMesh(0xffd700, VFXSystem.sphereGeo);

      mesh.position.copy(position);
      mesh.position.x += (Math.random() - 0.5) * 8;
      mesh.position.y += Math.random() * 4;
      mesh.position.z += (Math.random() - 0.5) * 8;

      this.scene.add(mesh);

      const toCenterX = position.x - mesh.position.x;
      const toCenterZ = position.z - mesh.position.z;
      const dist = Math.sqrt(toCenterX * toCenterX + toCenterZ * toCenterZ);
      const pullSpeed = 8;

      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(
          (toCenterX / dist) * pullSpeed,
          6 + Math.random() * 4,
          (toCenterZ / dist) * pullSpeed,
        ),
        life: 0.8 + Math.random() * 0.4,
        maxLife: 1.0,
        scale: 1,
      });
    }
  }

  spawnGroundedShockRing(position: THREE.Vector3): void {
    // Limit particle count for performance
    if (this.particles.length >= this.MAX_PARTICLES) return;
    const ringCount = 2;  // Reduced from 3

    for (let i = 0; i < ringCount; i++) {
      const ring = this.acquireMesh(0xFFD700, VFXSystem.shockRingGeo, THREE.DoubleSide, false);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.6;

      ring.position.copy(position);
      ring.position.y = 0.1;
      ring.rotation.x = -Math.PI / 2;

      this.scene.add(ring);

      const delay = i * 0.1;
      const maxLife = 0.6;

      this.particles.push({
        mesh: ring,
        velocity: new THREE.Vector3(0, 0, 0),
        life: maxLife - delay,
        maxLife,
        scale: 1 + i * 3,
      });
    }
  }

  createSanctuaryShimmer(radius: number, height: number, position: THREE.Vector3): void {
    const points: THREE.Vector3[] = [];
    const segments = 64;

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius,
      ));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0x44ffaa,
      transparent: true,
      opacity: 0.3,
      linewidth: 2,
    });

    this.sanctuaryBoundary = new THREE.Line(geometry, material);
    this.sanctuaryBoundary.position.copy(position);
    this.scene.add(this.sanctuaryBoundary);
  }

  updateWantedPulse(_position: THREE.Vector3): void {
    // No-op — heat/wanted system removed
  }

  /** Spawn scatter burst when bird flies through NPCs — feather-like outward burst */
  spawnScatterBurst(position: THREE.Vector3, birdSpeed: number, npcCount: number): void {
    if (this.camera) {
      const distToCamera = position.distanceTo(this.camera.position);
      if (distToCamera > 300) return;
    }
    if (this.particles.length >= this.MAX_PARTICLES) return;

    const speedFactor = Math.min(birdSpeed / 50, 2.0);
    const count = Math.min(12, 3 + npcCount * 2 + Math.floor(speedFactor * 3));

    // Mix of bright cartoony colors
    const colors = [0xffffff, 0xFF69B4, 0x87CEEB, 0xFFD700];

    for (let i = 0; i < count; i++) {
      const color = colors[i % colors.length];
      const mesh = this.acquireMesh(color, VFXSystem.sphereGeo);

      mesh.position.copy(position);
      mesh.position.x += (Math.random() - 0.5) * 2;
      mesh.position.y += Math.random() * 2;
      mesh.position.z += (Math.random() - 0.5) * 2;

      this.scene.add(mesh);

      // Burst outward in all directions, more horizontal than vertical
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const outSpeed = (4 + Math.random() * 4) * speedFactor;

      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(
          Math.cos(angle) * outSpeed,
          2 + Math.random() * 3,
          Math.sin(angle) * outSpeed,
        ),
        life: 0.6 + Math.random() * 0.4,
        maxLife: 0.9,
        scale: 0.6 + speedFactor * 0.4,
      });
    }
  }

  /** Spawn hit impact burst particles */
  spawnHitImpact(position: THREE.Vector3, coinValue: number, speed: number = 30, altitude: number = 50): void {
    // PHASE 5: Don't spawn particles for hits far from camera (saves draw calls)
    if (this.camera) {
      const distToCamera = position.distanceTo(this.camera.position);
      if (distToCamera > 300) return;  // Skip particles beyond 300 units
    }

    // Limit particle count for performance
    if (this.particles.length >= this.MAX_PARTICLES) return;

    // Momentum impact: speed + height = bigger burst
    const momentumFactor = (speed / 80) * 0.7 + (altitude / 100) * 0.3;
    const count = Math.min(18, 5 + Math.floor(coinValue / 10) + Math.floor(momentumFactor * 10));
    const speedMultiplier = 1.3 + momentumFactor * 2.5;
    const color = coinValue >= 20 ? 0xffd700 : 0xffffff;

    for (let i = 0; i < count; i++) {
      const mesh = this.acquireMesh(color, VFXSystem.sphereGeo);

      mesh.position.copy(position);
      this.scene.add(mesh);

      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const baseSpeed = 5 * speedMultiplier;
      const spd = baseSpeed + Math.random() * 4;

      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(
          Math.cos(angle) * spd,
          4 + Math.random() * 3 + momentumFactor * 4,
          Math.sin(angle) * spd,
        ),
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.7,
        scale: 1.0 + momentumFactor * 0.6,
      });
    }
  }
}
