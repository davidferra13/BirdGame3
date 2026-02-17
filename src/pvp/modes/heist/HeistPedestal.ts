/**
 * HeistPedestal - Scoring pedestal for a player in Heist mode.
 * Elevated platform with player-colored glow and trigger zone.
 */

import * as THREE from 'three';
import { HEIST } from '../../../utils/Constants';

export class HeistPedestal {
  readonly group: THREE.Group;
  readonly playerId: string;
  readonly playerColor: number;
  readonly position: THREE.Vector3;
  private glowLight: THREE.PointLight;
  private ringMesh: THREE.Mesh;

  // Celebration VFX state
  private celebrationTimer = 0;
  private celebrationParticles: THREE.Mesh[] = [];

  constructor(
    scene: THREE.Scene,
    playerId: string,
    playerColor: number,
    worldPosition: THREE.Vector3,
  ) {
    this.playerId = playerId;
    this.playerColor = playerColor;
    this.position = worldPosition.clone();

    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    // Platform base (cylinder)
    const platformGeo = new THREE.CylinderGeometry(4, 5, 1.5, 12);
    const platformMat = new THREE.MeshStandardMaterial({
      color: playerColor,
      emissive: playerColor,
      emissiveIntensity: 0.3,
      metalness: 0.5,
      roughness: 0.4,
    });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    this.group.add(platform);

    // Glowing ring on top
    const ringGeo = new THREE.TorusGeometry(3.5, 0.3, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: playerColor,
      transparent: true,
      opacity: 0.6,
    });
    this.ringMesh = new THREE.Mesh(ringGeo, ringMat);
    this.ringMesh.rotation.x = -Math.PI / 2;
    this.ringMesh.position.y = 0.8;
    this.group.add(this.ringMesh);

    // Vertical accent pillars (4 corners)
    const pillarGeo = new THREE.CylinderGeometry(0.2, 0.2, 4, 6);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: playerColor,
      emissive: playerColor,
      emissiveIntensity: 0.2,
    });
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(Math.cos(angle) * 4, 2, Math.sin(angle) * 4);
      this.group.add(pillar);
    }

    // Point light for glow
    this.glowLight = new THREE.PointLight(playerColor, 1.5, 30);
    this.glowLight.position.y = 3;
    this.group.add(this.glowLight);

    scene.add(this.group);
  }

  /** Check if a position is within the scoring trigger zone */
  isInTriggerZone(pos: THREE.Vector3): boolean {
    const dx = pos.x - this.position.x;
    const dy = pos.y - this.position.y;
    const dz = pos.z - this.position.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    return distSq <= HEIST.PEDESTAL_TRIGGER_RADIUS * HEIST.PEDESTAL_TRIGGER_RADIUS;
  }

  /** Trigger celebration VFX on score */
  playCelebration(scene: THREE.Scene): void {
    this.celebrationTimer = 1.5;

    // Spawn confetti/sparkle particles
    const particleCount = 20;
    for (let i = 0; i < particleCount; i++) {
      const geo = new THREE.SphereGeometry(0.3, 4, 3);
      const color = i % 2 === 0 ? 0xffd700 : this.playerColor;
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(this.position);
      mesh.position.x += (Math.random() - 0.5) * 6;
      mesh.position.y += Math.random() * 4 + 2;
      mesh.position.z += (Math.random() - 0.5) * 6;
      mesh.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 15,
        5 + Math.random() * 10,
        (Math.random() - 0.5) * 15,
      );
      mesh.userData.life = 1.0 + Math.random() * 0.5;
      scene.add(mesh);
      this.celebrationParticles.push(mesh);
    }
  }

  update(dt: number): void {
    // Pulsing ring animation
    const pulse = 0.5 + Math.sin(performance.now() / 1000 * 2) * 0.15;
    (this.ringMesh.material as THREE.MeshBasicMaterial).opacity = pulse;

    // Light pulse
    this.glowLight.intensity = 1.2 + Math.sin(performance.now() / 1000 * 3) * 0.3;

    // Celebration particles
    if (this.celebrationTimer > 0) {
      this.celebrationTimer -= dt;
    }

    for (let i = this.celebrationParticles.length - 1; i >= 0; i--) {
      const p = this.celebrationParticles[i];
      const vel = p.userData.velocity as THREE.Vector3;
      vel.y -= 20 * dt; // gravity
      p.position.addScaledVector(vel, dt);
      p.userData.life -= dt;

      const mat = p.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, p.userData.life);

      if (p.userData.life <= 0) {
        p.parent?.remove(p);
        p.geometry.dispose();
        mat.dispose();
        this.celebrationParticles.splice(i, 1);
      }
    }
  }

  dispose(): void {
    // Clean up celebration particles
    for (const p of this.celebrationParticles) {
      p.parent?.remove(p);
      p.geometry.dispose();
      (p.material as THREE.Material).dispose();
    }
    this.celebrationParticles = [];

    this.group.parent?.remove(this.group);
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (obj.material instanceof THREE.Material) obj.material.dispose();
      }
    });
  }
}
