/**
 * Roost — Murmuration home base world object.
 * A physical perch/nest location in the city with Formation-based visuals.
 * Unlocked at Formation 4. Upgrades to full nest at Formation 8.
 * Follows existing world object patterns (City, Sanctuary, etc.)
 */

import * as THREE from 'three';
import { createToonMaterial } from '../rendering/ToonUtils';
import type { EmblemConfig, RoostData } from '@/types/murmuration';

export class Roost {
  readonly group: THREE.Group;
  readonly position: THREE.Vector3;
  private murmurationId: string;
  private tag: string;
  private formationLevel: number;
  private bannerMesh: THREE.Mesh | null = null;
  private nestMesh: THREE.Group | null = null;
  private glowLight: THREE.PointLight | null = null;
  private tagSprite: THREE.Sprite | null = null;

  constructor(data: RoostData) {
    this.murmurationId = data.murmuration_id;
    this.tag = data.tag;
    this.formationLevel = data.formation_level;
    this.position = new THREE.Vector3(data.position.x, data.position.y, data.position.z);

    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    this.buildStructure();
    this.buildBanner();
    this.buildTagLabel();
  }

  private buildStructure(): void {
    if (this.formationLevel >= 8) {
      // Full nest structure (Formation 8+)
      this.buildFullNest();
    } else {
      // Basic perch (Formation 4-7)
      this.buildPerch();
    }

    // Glow light
    this.glowLight = new THREE.PointLight(0x44aaff, 0.5, 30);
    this.glowLight.position.set(0, 3, 0);
    this.group.add(this.glowLight);
  }

  private buildPerch(): void {
    // Post
    const postGeo = new THREE.CylinderGeometry(0.2, 0.3, 4, 8);
    const postMat = createToonMaterial(0x8B4513);
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.y = 2;
    this.group.add(post);

    // Perch bar
    const barGeo = new THREE.CylinderGeometry(0.1, 0.1, 2, 8);
    const barMat = createToonMaterial(0x8B4513);
    const bar = new THREE.Mesh(barGeo, barMat);
    bar.position.y = 4;
    bar.rotation.z = Math.PI / 2;
    this.group.add(bar);

    // Platform
    const platGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.2, 16);
    const platMat = createToonMaterial(0x654321);
    const platform = new THREE.Mesh(platGeo, platMat);
    platform.position.y = 0.1;
    this.group.add(platform);
  }

  private buildFullNest(): void {
    this.nestMesh = new THREE.Group();

    // Nest base (torus for woven nest look)
    const nestGeo = new THREE.TorusGeometry(1.5, 0.4, 8, 16);
    const nestMat = createToonMaterial(0x8B6914);
    const nestBase = new THREE.Mesh(nestGeo, nestMat);
    nestBase.rotation.x = Math.PI / 2;
    nestBase.position.y = 3.5;
    this.nestMesh.add(nestBase);

    // Inner padding
    const padGeo = new THREE.CylinderGeometry(1.3, 1.0, 0.5, 16);
    const padMat = createToonMaterial(0xD2B48C);
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.y = 3.3;
    this.nestMesh.add(pad);

    // Support post
    const postGeo = new THREE.CylinderGeometry(0.3, 0.5, 4, 8);
    const postMat = createToonMaterial(0x654321);
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.y = 1.5;
    this.nestMesh.add(post);

    // Platform base
    const baseGeo = new THREE.CylinderGeometry(2, 2.5, 0.5, 16);
    const baseMat = createToonMaterial(0x555555);
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.25;
    this.nestMesh.add(base);

    this.group.add(this.nestMesh);
  }

  private buildBanner(): void {
    // Banner flag on a pole
    const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 3, 6);
    const poleMat = createToonMaterial(0xcccccc);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    const bannerY = this.formationLevel >= 8 ? 6.5 : 5.5;
    pole.position.set(0, bannerY, 0);
    this.group.add(pole);

    // Banner flag (simple plane)
    const flagGeo = new THREE.PlaneGeometry(1.2, 0.8);
    const flagMat = createToonMaterial(0x4488ff, { side: THREE.DoubleSide });
    this.bannerMesh = new THREE.Mesh(flagGeo, flagMat);
    this.bannerMesh.position.set(0.7, bannerY + 0.8, 0);
    this.group.add(this.bannerMesh);
  }

  private buildTagLabel(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`[${this.tag}] ROOST`, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    this.tagSprite = new THREE.Sprite(material);
    this.tagSprite.scale.set(5, 1.25, 1);
    const labelY = this.formationLevel >= 8 ? 9 : 7.5;
    this.tagSprite.position.set(0, labelY, 0);
    this.group.add(this.tagSprite);
  }

  update(dt: number): void {
    // Gentle banner wave animation
    if (this.bannerMesh) {
      this.bannerMesh.rotation.y = Math.sin(Date.now() * 0.002) * 0.15;
    }

    // Glow pulse
    if (this.glowLight) {
      this.glowLight.intensity = 0.4 + Math.sin(Date.now() * 0.003) * 0.1;
    }
  }

  setFormationLevel(level: number): void {
    if (level !== this.formationLevel) {
      this.formationLevel = level;
      // Rebuild if crossing the F8 threshold
      this.group.clear();
      this.buildStructure();
      this.buildBanner();
      this.buildTagLabel();
    }
  }

  /** Get minimap icon position */
  getMinimapPosition(): { x: number; z: number } {
    return { x: this.position.x, z: this.position.z };
  }

  destroy(): void {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (obj.material instanceof THREE.Material) obj.material.dispose();
      }
      if (obj instanceof THREE.Sprite) {
        obj.material.dispose();
        obj.material.map?.dispose();
      }
    });
    if (this.glowLight) this.glowLight.dispose();
    this.group.removeFromParent();
  }
}
