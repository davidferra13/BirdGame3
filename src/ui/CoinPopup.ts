import * as THREE from 'three';
import { SCORE } from '../utils/Constants';

interface PopupEntry {
  element: HTMLElement;
  worldPos: THREE.Vector3;
  age: number;
  lifetime: number;
  totalPoints: number;
  multiplier: number;
  label?: string;
}

/** Color tiers per spec: white < 1.5x, yellow < 2.0x, orange < 2.5x, red >= 2.5x */
function getPopupColor(multiplier: number): string {
  if (multiplier >= 2.5) return '#ff3333';
  if (multiplier >= 2.0) return '#ff8833';
  if (multiplier >= 1.5) return '#ffdd44';
  return '#ffffff';
}

export class CoinPopupManager {
  private container: HTMLElement;
  private popups: PopupEntry[] = [];
  private camera: THREE.PerspectiveCamera | null = null;

  /** Pending merge: accumulates hits within POPUP_MERGE_WINDOW */
  private pendingPoints = 0;
  private pendingMultiplier = 0;
  private pendingPos = new THREE.Vector3();
  private pendingHasPos = false;
  private pendingTimer = 0;
  private pendingLabel?: string;

  // Reusable vector for screen projection (avoids per-frame allocation)
  private _projVec = new THREE.Vector3();

  constructor() {
    this.container = document.getElementById('hud')!;
  }

  setCamera(camera: THREE.PerspectiveCamera): void {
    this.camera = camera;
  }

  spawn(worldPos: THREE.Vector3, points: number, multiplier: number, label?: string): void {
    // Stack merging: if a hit arrives within POPUP_MERGE_WINDOW, combine
    if (this.pendingTimer > 0) {
      this.pendingPoints += points;
      this.pendingMultiplier = Math.max(this.pendingMultiplier, multiplier);
      this.pendingPos.copy(worldPos);
      this.pendingPos.y += 2;
      if (label) this.pendingLabel = label;
      return;
    }

    // Start new merge window
    this.pendingPoints = points;
    this.pendingMultiplier = multiplier;
    this.pendingPos.copy(worldPos);
    this.pendingPos.y += 2;
    this.pendingHasPos = true;
    this.pendingLabel = label;
    this.pendingTimer = SCORE.POPUP_MERGE_WINDOW;
  }

  private flushPending(): void {
    if (!this.pendingHasPos || this.pendingPoints <= 0) return;

    const points = this.pendingPoints;
    const multiplier = this.pendingMultiplier;
    const label = this.pendingLabel;

    const el = document.createElement('div');
    const color = getPopupColor(multiplier);
    const fontSize = Math.min(20 + multiplier * 4, 36);

    el.style.cssText = `position:absolute;pointer-events:none;font-weight:bold;text-shadow:2px 2px 4px rgba(0,0,0,0.8);white-space:nowrap;font-size:${fontSize}px;color:${color};text-align:center;`;

    let text = multiplier > 1 ? `+${points} x${multiplier.toFixed(1)}` : `+${points}`;
    if (label) {
      text += `<br><span style="font-size:${Math.max(12, fontSize - 6)}px;color:#ffaa00;">${label}</span>`;
    }
    el.innerHTML = text;

    el.style.transform = 'translate(-50%, -50%) scale(0.8)';

    this.container.appendChild(el);

    this.popups.push({
      element: el,
      worldPos: this.pendingPos.clone(),
      age: 0,
      lifetime: label ? 1.4 : 1.0,
      totalPoints: points,
      multiplier,
      label,
    });

    // Reset pending
    this.pendingPoints = 0;
    this.pendingMultiplier = 0;
    this.pendingHasPos = false;
    this.pendingLabel = undefined;
  }

  update(dt: number): void {
    // Merge window countdown
    if (this.pendingTimer > 0) {
      this.pendingTimer -= dt;
      if (this.pendingTimer <= 0) {
        this.flushPending();
      }
    }

    if (!this.camera) return;

    let i = this.popups.length;
    while (i-- > 0) {
      const popup = this.popups[i];
      popup.age += dt;

      // Float upward 1.5–2.0 world units over lifetime
      popup.worldPos.y += 1.8 * dt;

      if (popup.age >= popup.lifetime) {
        popup.element.remove();
        // Swap-and-pop instead of splice
        const last = this.popups.length - 1;
        if (i !== last) this.popups[i] = this.popups[last];
        this.popups.length = last;
        continue;
      }

      // Project world position to screen (reuse vector)
      this._projVec.copy(popup.worldPos).project(this.camera);
      const x = (this._projVec.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-this._projVec.y * 0.5 + 0.5) * window.innerHeight;

      // Behind camera check
      if (this._projVec.z > 1) {
        popup.element.style.display = 'none';
        continue;
      }

      popup.element.style.display = 'block';
      popup.element.style.left = `${x}px`;
      popup.element.style.top = `${y}px`;

      // Scale bounce: 0.8 → 1.2 → 1.0 over first 0.3s
      const t = popup.age / popup.lifetime;
      let scale: number;
      if (t < 0.1) {
        scale = 0.8 + (t / 0.1) * 0.4;
      } else if (t < 0.25) {
        scale = 1.2 - ((t - 0.1) / 0.15) * 0.2;
      } else {
        scale = 1.0;
      }

      // Fade out over last 30%
      let alpha = 1;
      if (t > 0.7) {
        alpha = 1 - (t - 0.7) / 0.3;
      }

      popup.element.style.transform = `translate(-50%, -50%) scale(${scale})`;
      popup.element.style.opacity = `${alpha}`;
    }
  }
}
