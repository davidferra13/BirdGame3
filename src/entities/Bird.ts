import * as THREE from 'three';
import { FlightController } from './FlightController';
import { createBirdModel, animateWings, animateIdle, updateBirdColor, loadBirdGLB, swapBirdModel } from './BirdModel';
import { InputManager } from '../core/InputManager';

const GOLD_COLOR = 0xffd700;
const TAG_COLOR = 0x4a7a20;
const TAG_GLOW_COLOR = 0x6B9B30;
const LEG_GROUND_EPSILON = 0.01;

export class Bird {
  readonly mesh: THREE.Group;
  readonly controller: FlightController;
  private elapsed = 0;
  private gunAttachment: THREE.Group | null = null;
  private gunVisible = false;
  private legBounds = new THREE.Box3();

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
    this.ensureGunAttachment();
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
        this.ensureGunAttachment();
        this.setGunVisible(this.gunVisible);
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
    animateWings(
      this.mesh,
      this.elapsed,
      this.controller.forwardSpeed,
      this.controller.isGrounded,
      this.controller.isBoosting // pass boost state
    );
    this.syncMesh();

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

  setGunVisible(visible: boolean): void {
    this.gunVisible = visible;
    if (!this.gunAttachment) this.ensureGunAttachment();
    if (this.gunAttachment) this.gunAttachment.visible = visible;
  }

  hasGun(): boolean {
    return this.gunVisible;
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
    this.mesh.updateMatrixWorld(true);

    if (this.controller.isGrounded) {
      // Snap the animated leg rig so its lowest point sits on the ground.
      const legRig = this.mesh.getObjectByName('ridiculousLegRig');
      if (legRig && legRig.visible) {
        this.legBounds.setFromObject(legRig);
        const lift = (this.controller.position.y + LEG_GROUND_EPSILON) - this.legBounds.min.y;
        if (Number.isFinite(lift) && lift > 0) {
          this.mesh.position.y += lift;
          this.mesh.updateMatrixWorld(true);
        }
      }
    }
  }

  private ensureGunAttachment(): void {
    if (this.gunAttachment) {
      this.mesh.remove(this.gunAttachment);
    }

    const gun = new THREE.Group();
    gun.name = 'gunAttachment';

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.14, 0.12),
      new THREE.MeshToonMaterial({ color: 0x2a2a2a }),
    );
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.42, 10),
      new THREE.MeshToonMaterial({ color: 0x111111 }),
    );
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(0.45, 0, 0); // tip of barrel in gun-local space (+X)

    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.24, 0.09),
      new THREE.MeshToonMaterial({ color: 0x4a3420 }),
    );
    grip.position.set(-0.08, -0.16, 0);
    grip.rotation.z = -0.28;

    gun.add(body);
    gun.add(barrel);
    gun.add(grip);

    // Approximate right-wing/hand position for both procedural and GLB birds.
    // Rotate Y = -PI/2 so the barrel (local +X) points forward (bird local -Z).
    gun.position.set(0.65, 0.35, -0.5);
    gun.rotation.set(0.1, -Math.PI / 2, -0.1);
    gun.visible = this.gunVisible;

    this.mesh.add(gun);
    this.gunAttachment = gun;
  }
}
