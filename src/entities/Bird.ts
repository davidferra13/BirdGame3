import * as THREE from 'three';
import { FlightController } from './FlightController';
import { createBirdModel, animateWings, animateIdle, updateBirdColor, loadBirdGLB, swapBirdModel } from './BirdModel';
import { InputManager } from '../core/InputManager';

const GOLD_COLOR = 0xffd700;
const TAG_COLOR = 0x4a7a20;
const TAG_GLOW_COLOR = 0x6B9B30;

export class Bird {
  readonly mesh: THREE.Group;
  readonly controller: FlightController;
  private elapsed = 0;

  // Idle animation blend (0 = active, 1 = fully idle)
  private idleBlend = 0;

  // Wanted visual effects
  private wantedOutline: THREE.Group | null = null;
  private wantedGlow: THREE.PointLight | null = null;
  private _isWanted = false;

  // Tagged ("it") visual effects
  private taggedOutline: THREE.Group | null = null;
  private taggedGlow: THREE.PointLight | null = null;
  private _isTagged = false;

  /** Whether the real GLB model has been loaded */
  private glbLoaded = false;

  constructor() {
    // Start with the procedural model (instant, no async needed)
    this.mesh = createBirdModel();
    this.controller = new FlightController();
    this.buildWantedVisuals();
    this.syncMesh();

    // Attempt to load the real GLB model in the background
    this.tryLoadGLB();
  }

  /** Try loading the real bird model — silently falls back to procedural */
  private async tryLoadGLB(): Promise<void> {
    try {
      const glb = await loadBirdGLB('bird.seagull');
      if (glb) {
        swapBirdModel(this.mesh, glb);
        this.glbLoaded = true;
        // Rebuild wanted visuals for the new geometry
        this.buildWantedVisuals();
        console.log('Bird: swapped to GLB model');
      }
    } catch {
      // No GLB available — procedural model continues working
    }
  }

  update(dt: number, input: InputManager): void {
    this.elapsed += dt;
    this.controller.update(dt, input);
    this.syncMesh();
    animateWings(
      this.mesh,
      this.elapsed,
      this.controller.forwardSpeed,
      this.controller.isGrounded,
      this.controller.isBoosting // pass boost state
    );

    // Idle animation — smooth blend in/out
    const idleTime = input.getIdleTime();
    const wantIdle = idleTime > 5 ? 1 : 0;
    const rampSpeed = wantIdle ? 0.5 : 4.0; // gentle fade-in, quick snap-out
    this.idleBlend += (wantIdle - this.idleBlend) * Math.min(1, rampSpeed * dt);
    if (this.idleBlend < 0.01) this.idleBlend = 0;

    if (this.idleBlend > 0) {
      animateIdle(this.mesh, this.elapsed, idleTime, this.idleBlend);
    }

    // Pulse the wanted glow
    if (this._isWanted && this.wantedGlow) {
      this.wantedGlow.intensity = 1.5 + Math.sin(this.elapsed * 4) * 0.8;
    }

    // Pulse the tagged glow
    if (this._isTagged && this.taggedGlow) {
      this.taggedGlow.intensity = 1.0 + Math.sin(this.elapsed * 3) * 0.6;
    }
  }

  /** Toggle gold outline + pulsing glow per Wanted spec §3 */
  setWanted(wanted: boolean): void {
    if (wanted === this._isWanted) return;
    this._isWanted = wanted;

    if (this.wantedOutline) this.wantedOutline.visible = wanted;
    if (this.wantedGlow) this.wantedGlow.visible = wanted;
  }

  /** Toggle brown outline + pulsing glow when this bird is "it" in Poop Tag */
  setTagged(tagged: boolean): void {
    if (tagged === this._isTagged) return;
    this._isTagged = tagged;

    // Build on first use
    if (!this.taggedOutline) this.buildTaggedVisuals();

    if (this.taggedOutline) this.taggedOutline.visible = tagged;
    if (this.taggedGlow) this.taggedGlow.visible = tagged;
  }

  /** Update bird color based on equipped skin cosmetic */
  setColor(color: number): void {
    updateBirdColor(this.mesh, color);
  }

  private buildWantedVisuals(): void {
    const outlineMat = new THREE.MeshBasicMaterial({
      color: GOLD_COLOR,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.45,
    });

    this.wantedOutline = new THREE.Group();

    // Clone each mesh child as a backside-scaled outline
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const outline = new THREE.Mesh(child.geometry.clone(), outlineMat);
        outline.position.copy(child.position);
        outline.rotation.copy(child.rotation);
        outline.scale.copy(child.scale).multiplyScalar(1.15);
        this.wantedOutline!.add(outline);
      }
    });

    this.wantedOutline.visible = false;
    this.mesh.add(this.wantedOutline);

    // Point light for pulsing glow
    this.wantedGlow = new THREE.PointLight(GOLD_COLOR, 1.5, 12);
    this.wantedGlow.visible = false;
    this.mesh.add(this.wantedGlow);
  }

  private buildTaggedVisuals(): void {
    const outlineMat = new THREE.MeshBasicMaterial({
      color: TAG_COLOR,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.4,
    });

    this.taggedOutline = new THREE.Group();

    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const outline = new THREE.Mesh(child.geometry.clone(), outlineMat);
        outline.position.copy(child.position);
        outline.rotation.copy(child.rotation);
        outline.scale.copy(child.scale).multiplyScalar(1.2);
        this.taggedOutline!.add(outline);
      }
    });

    this.taggedOutline.visible = false;
    this.mesh.add(this.taggedOutline);

    this.taggedGlow = new THREE.PointLight(TAG_GLOW_COLOR, 1.0, 10);
    this.taggedGlow.visible = false;
    this.mesh.add(this.taggedGlow);
  }

  private syncMesh(): void {
    this.mesh.position.copy(this.controller.position);
    this.mesh.quaternion.copy(this.controller.getQuaternion());
  }
}
