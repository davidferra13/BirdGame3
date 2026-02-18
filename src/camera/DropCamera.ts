import * as THREE from 'three';
import { NPC } from '../entities/NPC';

// --- Configuration ---
const PIP_MIN_DROP_HEIGHT = 15;       // Only activate above this altitude
const PIP_SIZE_FRACTION = 0.22;       // 22% of smaller screen dimension
const PIP_MARGIN_LEFT = 16;          // Pixels from left edge (matches HUD alignment)
const PIP_MARGIN_BOTTOM = 200;       // Pixels from bottom edge (clears poop/ability/district HUD)
const CAM_OFFSET_BACK = 8;           // Behind the NPC
const CAM_OFFSET_UP = 4;             // Above the NPC
const FADE_IN_DURATION = 0.3;
const LINGER_AFTER_LAND = 1.2;
const FADE_OUT_DURATION = 0.5;
const ORBIT_SPEED = 0.2;             // Radians/sec slow orbit
const GROUND_Y = 0.1;

type PiPState = 'inactive' | 'tracking' | 'lingering' | 'fading_out';

export class DropCamera {
  readonly camera: THREE.PerspectiveCamera;

  private state: PiPState = 'inactive';
  private trackedNPC: NPC | null = null;
  private dropStartY = 0;

  // Timing
  private activeTimer = 0;
  private lingerTimer = 0;
  private fadeOutTimer = 0;
  private fadeAlpha = 0;

  // Camera orbit
  private orbitAngle = 0;

  // Smoothing
  private smoothedPos = new THREE.Vector3();
  private smoothedLookAt = new THREE.Vector3();
  private posInitialized = false;

  // Landing detection (track Y velocity frame-to-frame)
  private lastNPCY = 0;
  private npcVerticalSpeed = 0;

  // Reusable scratch vectors (avoid per-frame allocation)
  private _idealPos = new THREE.Vector3();
  private _idealLookAt = new THREE.Vector3();

  // Throttle: only render PiP every N frames to cut GPU cost
  private _frameCounter = 0;
  private static readonly PIP_RENDER_INTERVAL = 3; // render every 3rd frame

  // Viewport dimensions (pixels)
  private pipX = 0;
  private pipY = 0;
  pipWidth = 0;
  pipHeight = 0;

  // HTML overlay elements
  private overlay: HTMLDivElement;
  private heightLabel: HTMLDivElement;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(50, 4 / 3, 1, 2000);
    this.injectStyles();
    this.overlay = this.createOverlay();
    this.heightLabel = this.createHeightLabel();
    this.createBorderFrame();
    this.calculateViewport();
  }

  /** Minimum drop height to trigger the PiP. */
  static get MIN_HEIGHT(): number {
    return PIP_MIN_DROP_HEIGHT;
  }

  /** Activate the PiP to track a falling NPC. */
  activate(npc: NPC, throwDirection: THREE.Vector3, dropHeight: number): void {
    this.trackedNPC = npc;
    this.dropStartY = dropHeight;
    this.state = 'tracking';
    this.activeTimer = 0;
    this.lingerTimer = 0;
    this.fadeOutTimer = 0;
    this.fadeAlpha = 0;
    this.posInitialized = false;
    this.lastNPCY = npc.mesh.position.y;
    this.npcVerticalSpeed = 0;

    // Start camera behind the throw direction
    this.orbitAngle = Math.atan2(-throwDirection.x, -throwDirection.z);

    this.overlay.style.display = 'block';
    this.overlay.style.opacity = '0';
  }

  /** Immediately shut down the PiP. */
  deactivate(): void {
    this.state = 'inactive';
    this.trackedNPC = null;
    this.overlay.style.display = 'none';
    this.overlay.style.opacity = '0';
  }

  /** Whether the PiP is currently rendering. */
  isActive(): boolean {
    return this.state !== 'inactive';
  }

  /** Whether the PiP should actually draw this frame (throttled to every Nth frame). */
  shouldRenderThisFrame(): boolean {
    if (this.state === 'inactive') return false;
    this._frameCounter++;
    return this._frameCounter % DropCamera.PIP_RENDER_INTERVAL === 0;
  }

  /** Called every frame. Returns true if PiP should be rendered. */
  update(dt: number): boolean {
    if (this.state === 'inactive') return false;

    // Check if NPC is gone
    if (!this.trackedNPC || this.trackedNPC.shouldDespawn || !this.trackedNPC.mesh.parent) {
      if (this.state !== 'fading_out') {
        this.state = 'fading_out';
        this.fadeOutTimer = 0;
      }
    }

    switch (this.state) {
      case 'tracking':
        return this.updateTracking(dt);
      case 'lingering':
        return this.updateLingering(dt);
      case 'fading_out':
        return this.updateFadingOut(dt);
      default:
        return false;
    }
  }

  private updateTracking(dt: number): boolean {
    this.activeTimer += dt;
    this.fadeAlpha = Math.min(this.activeTimer / FADE_IN_DURATION, 1);
    this.overlay.style.opacity = String(this.fadeAlpha);

    const npc = this.trackedNPC!;
    const pos = npc.mesh.position;

    // Track vertical speed for landing detection
    this.npcVerticalSpeed = (pos.y - this.lastNPCY) / Math.max(dt, 0.001);
    this.lastNPCY = pos.y;

    // Landing detection
    const nearGround = pos.y <= GROUND_Y + 0.5;
    const slowVertical = Math.abs(this.npcVerticalSpeed) < 2.0;
    const minTimeElapsed = this.activeTimer > 0.5;

    if (nearGround && slowVertical && minTimeElapsed) {
      this.state = 'lingering';
      this.lingerTimer = 0;
      this.heightLabel.textContent = 'IMPACT!';
      this.heightLabel.style.color = '#FF4444';
      this.heightLabel.style.fontSize = '16px';
    } else {
      // Update height label
      const currentHeight = Math.max(0, pos.y - GROUND_Y);
      this.heightLabel.textContent = `${currentHeight.toFixed(0)}m`;
      this.heightLabel.style.color = '#FFD700';
      this.heightLabel.style.fontSize = '14px';
    }

    this.updateCameraPosition(dt);
    return true;
  }

  private updateLingering(dt: number): boolean {
    this.lingerTimer += dt;

    // Keep updating camera (no orbit rotation during linger)
    if (this.trackedNPC && !this.trackedNPC.shouldDespawn && this.trackedNPC.mesh.parent) {
      this.updateCameraPosition(dt, false);
    }

    if (this.lingerTimer >= LINGER_AFTER_LAND) {
      this.state = 'fading_out';
      this.fadeOutTimer = 0;
    }
    return true;
  }

  private updateFadingOut(dt: number): boolean {
    this.fadeOutTimer += dt;
    this.fadeAlpha = 1 - Math.min(this.fadeOutTimer / FADE_OUT_DURATION, 1);
    this.overlay.style.opacity = String(this.fadeAlpha);

    // Hold camera in last position (no updates)

    if (this.fadeOutTimer >= FADE_OUT_DURATION) {
      this.deactivate();
      return false;
    }
    return true;
  }

  private updateCameraPosition(dt: number, orbit = true): void {
    if (!this.trackedNPC) return;
    const npcPos = this.trackedNPC.mesh.position;

    // Slow orbit for cinematic feel
    if (orbit) {
      this.orbitAngle += ORBIT_SPEED * dt;
    }

    // Ideal camera position: orbiting behind + above the NPC (reuse scratch vector)
    this._idealPos.set(
      npcPos.x + Math.sin(this.orbitAngle) * CAM_OFFSET_BACK,
      Math.max(npcPos.y + CAM_OFFSET_UP, 2.0),
      npcPos.z + Math.cos(this.orbitAngle) * CAM_OFFSET_BACK,
    );

    // Look slightly below NPC center (reuse scratch vector)
    this._idealLookAt.set(npcPos.x, npcPos.y - 1, npcPos.z);

    // Exponential smoothing
    if (!this.posInitialized) {
      this.smoothedPos.copy(this._idealPos);
      this.smoothedLookAt.copy(this._idealLookAt);
      this.posInitialized = true;
    } else {
      const posAlpha = 1 - Math.exp(-6.0 * dt);
      this.smoothedPos.lerp(this._idealPos, posAlpha);
      const lookAlpha = 1 - Math.exp(-8.0 * dt);
      this.smoothedLookAt.lerp(this._idealLookAt, lookAlpha);
    }

    this.camera.position.copy(this.smoothedPos);
    this.camera.lookAt(this.smoothedLookAt);
  }

  /** Get the WebGL viewport rect for the PiP (Y from bottom). */
  getViewport(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.pipX,
      y: PIP_MARGIN_BOTTOM, // WebGL Y is from bottom
      width: this.pipWidth,
      height: this.pipHeight,
    };
  }

  /** Recalculate viewport dimensions on resize. */
  calculateViewport(): void {
    const minDim = Math.min(window.innerWidth, window.innerHeight);
    this.pipWidth = Math.floor(minDim * PIP_SIZE_FRACTION);
    this.pipHeight = Math.floor(this.pipWidth * 0.75); // 4:3 aspect
    this.pipX = PIP_MARGIN_LEFT;
    this.pipY = window.innerHeight - this.pipHeight - PIP_MARGIN_BOTTOM;

    this.camera.aspect = this.pipWidth / this.pipHeight;
    this.camera.updateProjectionMatrix();

    // Sync overlay size and position
    this.overlay.style.width = `${this.pipWidth}px`;
    this.overlay.style.height = `${this.pipHeight}px`;
    this.overlay.style.left = `${PIP_MARGIN_LEFT}px`;
    this.overlay.style.bottom = `${PIP_MARGIN_BOTTOM}px`;
  }

  /** Clean up DOM elements. */
  dispose(): void {
    this.overlay.remove();
    const style = document.getElementById('pip-drop-cam-styles');
    if (style) style.remove();
  }

  // --- DOM creation ---

  private injectStyles(): void {
    if (document.getElementById('pip-drop-cam-styles')) return;
    const style = document.createElement('style');
    style.id = 'pip-drop-cam-styles';
    style.textContent = `
      @keyframes pip-rec-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  private createOverlay(): HTMLDivElement {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed;
      bottom: ${PIP_MARGIN_BOTTOM}px;
      left: ${PIP_MARGIN_LEFT}px;
      pointer-events: none;
      z-index: 900;
      display: none;
      opacity: 0;
    `;
    document.body.appendChild(el);
    return el;
  }

  private createBorderFrame(): void {
    const frame = document.createElement('div');
    frame.style.cssText = `
      position: absolute;
      top: -3px; left: -3px; right: -3px; bottom: -3px;
      border: 3px solid rgba(255, 255, 255, 0.7);
      border-radius: 8px;
      box-shadow: 0 0 20px rgba(0, 0, 0, 0.8), inset 0 0 10px rgba(0, 0, 0, 0.3);
      pointer-events: none;
    `;

    // "DROP CAM" label
    const label = document.createElement('div');
    label.textContent = 'DROP CAM';
    label.style.cssText = `
      position: absolute;
      top: -1px; left: 8px;
      background: rgba(255, 60, 60, 0.9);
      color: white;
      font-size: 10px;
      font-weight: bold;
      font-family: 'Segoe UI', system-ui, sans-serif;
      padding: 1px 6px;
      border-radius: 0 0 4px 4px;
      letter-spacing: 1px;
    `;
    frame.appendChild(label);

    // Blinking REC dot
    const recDot = document.createElement('div');
    recDot.style.cssText = `
      position: absolute;
      top: 4px; right: 8px;
      width: 8px; height: 8px;
      background: #ff3333;
      border-radius: 50%;
      animation: pip-rec-blink 1s infinite;
    `;
    frame.appendChild(recDot);

    this.overlay.appendChild(frame);
  }

  private createHeightLabel(): HTMLDivElement {
    const label = document.createElement('div');
    label.style.cssText = `
      position: absolute;
      bottom: 8px; right: 8px;
      background: rgba(0, 0, 0, 0.6);
      color: #FFD700;
      font-size: 14px;
      font-weight: bold;
      font-family: 'Segoe UI', system-ui, monospace;
      padding: 2px 8px;
      border-radius: 4px;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
    `;
    this.overlay.appendChild(label);
    return label;
  }
}
