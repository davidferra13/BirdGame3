/**
 * Remote Player Entity
 * Represents another player in the multiplayer world.
 * Supports 3-tier LOD: near (full), mid (simple), hidden (removed from scene).
 */

import * as THREE from 'three';
import { createBirdModel, animateWings, loadBirdGLB, swapBirdModel } from '../entities/BirdModel';

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface Snapshot {
  position: Vector3;
  yaw: number;
  pitch: number;
  timestamp: number;
}

interface PlayerState {
  id: string;
  username: string;
  position: Vector3;
  yaw: number;
  pitch: number;
  heat: number;
  wantedFlag: boolean;
  state: string;
  stunned?: boolean;
}

interface MidPlayerState {
  id: string;
  username: string;
  position: Vector3;
  yaw: number;
  wantedFlag: boolean;
}

type LODLevel = 'near' | 'mid' | 'hidden';

export class RemotePlayer {
  readonly id: string;
  readonly username: string;
  private scene: THREE.Scene;

  // Full model (near LOD)
  private fullMesh: THREE.Group;
  private nameTag: THREE.Sprite;
  private animTime = 0;

  // Simple model (mid LOD)
  private simpleMesh: THREE.Mesh;

  // Current active mesh in scene
  private activeMesh: THREE.Object3D | null = null;
  private lodLevel: LODLevel = 'hidden';

  // Snapshot interpolation buffer
  private snapshots: Snapshot[] = [];
  private readonly INTERP_DELAY_MS = 100; // render 100ms behind server for smooth interp
  private readonly MAX_SNAPSHOTS = 30;

  // Interpolated render state
  private currentPosition: THREE.Vector3;
  private currentYaw = 0;
  private currentPitch = 0;

  // For wing animation speed estimation
  private prevFramePosition: THREE.Vector3;

  // State
  private heat = 0;
  private wantedFlag = false;
  private state = 'NORMAL';
  private stunned = false;
  private lastWantedFlag = false; // track changes for nameplate updates
  private taggedFlag = false;
  private lastTaggedFlag = false;

  // Murmuration
  private murmurationTag: string | null = null;
  private murmurationColor: number | null = null;

  // Stun visual
  private stunSprite: THREE.Sprite | null = null;
  private stunTime = 0;

  constructor(id: string, username: string, scene: THREE.Scene) {
    this.id = id;
    this.username = username;
    this.scene = scene;

    // Full bird model (procedural first, then try GLB)
    this.fullMesh = createBirdModel();
    this.tryLoadGLB();

    // Name tag
    this.nameTag = this.createNameTag(username, false);
    this.fullMesh.add(this.nameTag);

    // Simple mesh for mid-range LOD (small colored diamond)
    const simpleGeo = new THREE.OctahedronGeometry(1.5, 0);
    const simpleMat = new THREE.MeshBasicMaterial({ color: 0x44aaff });
    this.simpleMesh = new THREE.Mesh(simpleGeo, simpleMat);

    // Small nameplate for simple mesh
    const simpleTag = this.createNameTag(username, false);
    simpleTag.scale.set(2, 0.5, 1);
    simpleTag.position.y = 3;
    this.simpleMesh.add(simpleTag);

    this.currentPosition = new THREE.Vector3();
    this.prevFramePosition = new THREE.Vector3();

    // Start hidden — will be set by MultiplayerManager
  }

  private async tryLoadGLB(): Promise<void> {
    try {
      const glb = await loadBirdGLB('bird.seagull');
      if (glb) {
        const nameTag = this.nameTag;
        swapBirdModel(this.fullMesh, glb);
        this.fullMesh.add(nameTag);
      }
    } catch {
      // No GLB available — procedural model continues
    }
  }

  private createNameTag(username: string, wanted: boolean): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = wanted ? 'rgba(255, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(username, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(4, 1, 1);
    sprite.position.y = 3;

    return sprite;
  }

  // --- LOD Management ---

  setLOD(level: LODLevel): void {
    if (level === this.lodLevel) return;

    // Remove current mesh from scene
    if (this.activeMesh) {
      this.scene.remove(this.activeMesh);
      this.activeMesh = null;
    }

    this.lodLevel = level;

    switch (level) {
      case 'near':
        this.fullMesh.position.copy(this.currentPosition);
        this.scene.add(this.fullMesh);
        this.activeMesh = this.fullMesh;
        break;
      case 'mid':
        this.simpleMesh.position.copy(this.currentPosition);
        this.scene.add(this.simpleMesh);
        this.activeMesh = this.simpleMesh;
        break;
      case 'hidden':
        // Nothing added to scene
        break;
    }
  }

  getLOD(): LODLevel {
    return this.lodLevel;
  }

  // --- State Updates ---

  updateFromServer(state: PlayerState): void {
    // Push snapshot for interpolation
    this.snapshots.push({
      position: { x: state.position.x, y: state.position.y, z: state.position.z },
      yaw: state.yaw,
      pitch: state.pitch,
      timestamp: Date.now(),
    });
    if (this.snapshots.length > this.MAX_SNAPSHOTS) this.snapshots.shift();

    // Non-positional state applies immediately
    this.heat = state.heat;
    this.state = state.state;
    this.stunned = state.stunned || false;

    if (state.wantedFlag !== this.lastWantedFlag) {
      this.lastWantedFlag = state.wantedFlag;
      this.wantedFlag = state.wantedFlag;
      this.updateNameplate();
    } else {
      this.wantedFlag = state.wantedFlag;
    }

    if (this.stunned) {
      this.showStunEffect();
    }
  }

  updatePositionOnly(state: MidPlayerState): void {
    this.snapshots.push({
      position: { x: state.position.x, y: state.position.y, z: state.position.z },
      yaw: state.yaw,
      pitch: 0,
      timestamp: Date.now(),
    });
    if (this.snapshots.length > this.MAX_SNAPSHOTS) this.snapshots.shift();

    if (state.wantedFlag !== this.lastWantedFlag) {
      this.lastWantedFlag = state.wantedFlag;
      this.wantedFlag = state.wantedFlag;
    }
  }

  // --- Tag State (Poop Tag) ---

  setTagged(tagged: boolean): void {
    this.taggedFlag = tagged;
    if (tagged !== this.lastTaggedFlag) {
      this.lastTaggedFlag = tagged;
      this.updateNameplate();
    }
  }

  // --- Frame Update ---

  update(dt: number): void {
    if (this.lodLevel === 'hidden') return;

    this.prevFramePosition.copy(this.currentPosition);

    // --- Snapshot interpolation ---
    // Render at (now - INTERP_DELAY_MS) to always have two bracketing snapshots
    const renderTime = Date.now() - this.INTERP_DELAY_MS;

    let interpolated = false;
    if (this.snapshots.length >= 2) {
      // Find the pair of snapshots bracketing renderTime
      for (let i = 0; i < this.snapshots.length - 1; i++) {
        const a = this.snapshots[i];
        const b = this.snapshots[i + 1];
        if (a.timestamp <= renderTime && b.timestamp >= renderTime) {
          const span = b.timestamp - a.timestamp;
          const t = span > 0 ? (renderTime - a.timestamp) / span : 1;
          this.currentPosition.set(
            a.position.x + (b.position.x - a.position.x) * t,
            a.position.y + (b.position.y - a.position.y) * t,
            a.position.z + (b.position.z - a.position.z) * t,
          );
          this.currentYaw = this.lerpAngle(a.yaw, b.yaw, t);
          this.currentPitch = this.lerpAngle(a.pitch, b.pitch, t);
          interpolated = true;
          break;
        }
      }
    }

    if (!interpolated && this.snapshots.length > 0) {
      // Buffer hasn't filled or we're ahead of history — LERP toward latest snapshot
      const latest = this.snapshots[this.snapshots.length - 1];
      const lerpSpeed = Math.min(1, 15 * dt);
      this.currentPosition.lerp(
        new THREE.Vector3(latest.position.x, latest.position.y, latest.position.z),
        lerpSpeed,
      );
      this.currentYaw = this.lerpAngle(this.currentYaw, latest.yaw, lerpSpeed);
      this.currentPitch = this.lerpAngle(this.currentPitch, latest.pitch, lerpSpeed);
    }

    if (this.lodLevel === 'near' && this.activeMesh === this.fullMesh) {
      this.fullMesh.position.copy(this.currentPosition);
      this.fullMesh.rotation.y = this.currentYaw;
      this.fullMesh.rotation.x = this.currentPitch;

      // Wing animation at near LOD — speed derived from actual movement this frame
      this.animTime += dt;
      const frameDist = this.currentPosition.distanceTo(this.prevFramePosition);
      const speed = frameDist / Math.max(dt, 0.001);
      const isGrounded = this.currentPosition.y <= 2.0;
      animateWings(this.fullMesh, this.animTime, speed, isGrounded);

      // Nametag faces camera
      this.nameTag.rotation.y = -this.currentYaw;
    } else if (this.lodLevel === 'mid' && this.activeMesh === this.simpleMesh) {
      this.simpleMesh.position.copy(this.currentPosition);
      this.simpleMesh.rotation.y = this.currentYaw;

      // Color based on tagged / wanted status
      const mat = this.simpleMesh.material as THREE.MeshBasicMaterial;
      mat.color.set(this.taggedFlag ? 0x6B9B30 : this.wantedFlag ? 0xff4444 : 0x44aaff);
    }

    // Update stun visual
    if (this.stunSprite && this.stunned) {
      this.stunTime += dt;
      this.stunSprite.position.y = 4 + Math.sin(this.stunTime * 8) * 0.3;
      this.stunSprite.material.rotation += dt * 5;
    } else if (this.stunSprite && !this.stunned) {
      this.hideStunEffect();
    }
  }

  // --- Nameplate ---

  private updateNameplate(): void {
    const canvas = (this.nameTag.material as THREE.SpriteMaterial).map!.source.data as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const bgColor = this.taggedFlag
      ? 'rgba(74, 122, 32, 0.7)'
      : this.wantedFlag
        ? 'rgba(255, 0, 0, 0.6)'
        : 'rgba(0, 0, 0, 0.6)';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const tagPrefix = this.murmurationTag ? `[${this.murmurationTag}] ` : '';
    const prefix = this.taggedFlag ? '[IT] ' : tagPrefix;
    const suffix = this.stunned ? ' [STUNNED]' : '';
    ctx.fillText(`${prefix}${this.username}${suffix}`, canvas.width / 2, canvas.height / 2);

    (this.nameTag.material as THREE.SpriteMaterial).map!.needsUpdate = true;
  }

  // --- Stun Effects ---

  private showStunEffect(): void {
    if (this.stunSprite) return; // already showing

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Draw stars
    ctx.fillStyle = '#ffdd00';
    ctx.font = '40px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('*', 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    this.stunSprite = new THREE.Sprite(material);
    this.stunSprite.scale.set(2, 2, 1);
    this.stunSprite.position.y = 4;
    this.stunTime = 0;

    if (this.activeMesh) {
      this.activeMesh.add(this.stunSprite);
    }
  }

  private hideStunEffect(): void {
    if (this.stunSprite) {
      this.stunSprite.parent?.remove(this.stunSprite);
      this.stunSprite.material.map?.dispose();
      this.stunSprite.material.dispose();
      this.stunSprite = null;
    }
  }

  // --- Helpers ---

  private lerpAngle(from: number, to: number, t: number): number {
    let diff = to - from;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return from + diff * t;
  }

  destroy(): void {
    this.setLOD('hidden');
    this.hideStunEffect();

    // Dispose full mesh
    this.fullMesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (obj.material instanceof THREE.Material) {
          obj.material.dispose();
        }
      }
    });
    this.nameTag.material.dispose();
    if (this.nameTag.material.map) {
      this.nameTag.material.map.dispose();
    }

    // Dispose simple mesh
    this.simpleMesh.geometry.dispose();
    (this.simpleMesh.material as THREE.Material).dispose();
    this.simpleMesh.traverse((obj) => {
      if (obj instanceof THREE.Sprite) {
        obj.material.dispose();
        obj.material.map?.dispose();
      }
    });
  }

  setMurmurationInfo(tag: string | null, color: number | null): void {
    const changed = tag !== this.murmurationTag || color !== this.murmurationColor;
    this.murmurationTag = tag;
    this.murmurationColor = color;
    if (changed) {
      this.updateNameplate();
      // Apply color tint to simple mesh
      if (color !== null) {
        (this.simpleMesh.material as THREE.MeshBasicMaterial).color.set(color);
      }
    }
  }

  getPosition(): THREE.Vector3 {
    return this.currentPosition.clone();
  }
}
