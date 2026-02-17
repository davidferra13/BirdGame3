/**
 * HeistHUD - In-game HUD for Heist mode.
 * Score, timer, trophy status, slam cooldown, directional indicators.
 * Pure imperative DOM, no framework.
 */

import * as THREE from 'three';
import { HEIST } from '../../../utils/Constants';

export type TrophyStatusLabel = 'CENTER' | 'YOU HAVE IT' | 'OPPONENT HAS IT' | 'LOOSE';

export class HeistHUD {
  private container: HTMLElement;
  private scoreEl: HTMLElement;
  private timerEl: HTMLElement;
  private trophyStatusEl: HTMLElement;
  private slamCooldownEl: HTMLElement;
  private trophyArrowEl: HTMLElement;
  private pedestalArrowEl: HTMLElement;
  private countdownOverlay: HTMLElement;
  private countdownNumber: HTMLElement;

  private visible = false;

  constructor() {
    // Main container - top center bar
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      z-index: 2000;
      pointer-events: none;
      font-family: 'Segoe UI', system-ui, sans-serif;
    `;

    // Score bar
    const scoreBar = document.createElement('div');
    scoreBar.style.cssText = `
      display: flex;
      align-items: center;
      gap: 16px;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      border-radius: 20px;
      padding: 8px 24px;
      border: 1px solid rgba(255, 215, 0, 0.4);
    `;
    this.container.appendChild(scoreBar);

    // Mode label
    const modeLabel = document.createElement('span');
    modeLabel.style.cssText = `
      color: #ffd700;
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
    `;
    modeLabel.textContent = 'HEIST';
    scoreBar.appendChild(modeLabel);

    // Separator
    const sep1 = document.createElement('span');
    sep1.style.cssText = 'color: rgba(255,255,255,0.3); font-size: 14px;';
    sep1.textContent = '|';
    scoreBar.appendChild(sep1);

    // Score display
    this.scoreEl = document.createElement('span');
    this.scoreEl.style.cssText = `
      color: #fff;
      font-size: 16px;
      font-weight: bold;
      min-width: 100px;
      text-align: center;
    `;
    this.scoreEl.textContent = '0 — 0';
    scoreBar.appendChild(this.scoreEl);

    // Separator
    const sep2 = document.createElement('span');
    sep2.style.cssText = 'color: rgba(255,255,255,0.3); font-size: 14px;';
    sep2.textContent = '|';
    scoreBar.appendChild(sep2);

    // Timer
    this.timerEl = document.createElement('span');
    this.timerEl.style.cssText = `
      color: #fff;
      font-size: 14px;
      font-weight: 500;
      min-width: 40px;
      text-align: center;
    `;
    this.timerEl.textContent = '3:00';
    scoreBar.appendChild(this.timerEl);

    // Trophy status indicator (below score bar)
    this.trophyStatusEl = document.createElement('div');
    this.trophyStatusEl.style.cssText = `
      background: rgba(0, 0, 0, 0.6);
      border-radius: 12px;
      padding: 4px 14px;
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #ffd700;
    `;
    this.trophyStatusEl.textContent = 'CENTER';
    this.container.appendChild(this.trophyStatusEl);

    // Slam cooldown indicator (bottom center)
    this.slamCooldownEl = document.createElement('div');
    this.slamCooldownEl.style.cssText = `
      position: fixed;
      bottom: 120px;
      left: 50%;
      transform: translateX(-50%);
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 3px solid rgba(255, 100, 100, 0.8);
      display: none;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: bold;
      color: #ff6666;
      background: rgba(0, 0, 0, 0.5);
      z-index: 2000;
      pointer-events: none;
      font-family: 'Segoe UI', system-ui, sans-serif;
    `;
    this.slamCooldownEl.textContent = 'SLAM';

    // Trophy directional arrow (screen edge indicator)
    this.trophyArrowEl = document.createElement('div');
    this.trophyArrowEl.style.cssText = `
      position: fixed;
      width: 0;
      height: 0;
      border-left: 10px solid transparent;
      border-right: 10px solid transparent;
      border-bottom: 16px solid #ffd700;
      display: none;
      z-index: 1999;
      pointer-events: none;
      filter: drop-shadow(0 0 4px rgba(255, 215, 0, 0.6));
    `;

    // Pedestal directional arrow
    this.pedestalArrowEl = document.createElement('div');
    this.pedestalArrowEl.style.cssText = `
      position: fixed;
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-bottom: 14px solid #4488ff;
      display: none;
      z-index: 1999;
      pointer-events: none;
      filter: drop-shadow(0 0 4px rgba(68, 136, 255, 0.6));
    `;

    // Countdown overlay
    this.countdownOverlay = document.createElement('div');
    this.countdownOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: none;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      z-index: 3000;
      pointer-events: none;
      font-family: 'Segoe UI', system-ui, sans-serif;
    `;

    const countdownLabel = document.createElement('div');
    countdownLabel.style.cssText = `
      color: #ffd700;
      font-size: 18px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 3px;
      text-shadow: 0 2px 8px rgba(0,0,0,0.6);
      margin-bottom: 8px;
    `;
    countdownLabel.textContent = 'HEIST';
    this.countdownOverlay.appendChild(countdownLabel);

    this.countdownNumber = document.createElement('div');
    this.countdownNumber.style.cssText = `
      color: #fff;
      font-size: 72px;
      font-weight: bold;
      text-shadow: 0 4px 16px rgba(0,0,0,0.8);
    `;
    this.countdownNumber.textContent = '3';
    this.countdownOverlay.appendChild(this.countdownNumber);

    document.body.appendChild(this.container);
    document.body.appendChild(this.slamCooldownEl);
    document.body.appendChild(this.trophyArrowEl);
    document.body.appendChild(this.pedestalArrowEl);
    document.body.appendChild(this.countdownOverlay);
  }

  show(): void {
    this.visible = true;
    this.container.style.display = 'flex';
  }

  hide(): void {
    this.visible = false;
    this.container.style.display = 'none';
    this.slamCooldownEl.style.display = 'none';
    this.trophyArrowEl.style.display = 'none';
    this.pedestalArrowEl.style.display = 'none';
    this.countdownOverlay.style.display = 'none';
  }

  showCountdown(seconds: number): void {
    this.countdownOverlay.style.display = 'flex';
    this.countdownNumber.textContent = String(Math.ceil(seconds));
  }

  hideCountdown(): void {
    this.countdownOverlay.style.display = 'none';
  }

  updateScore(localScore: number, opponentScore: number, localColor: string, opponentColor: string): void {
    this.scoreEl.innerHTML = `<span style="color:${localColor}">${localScore}</span> <span style="color:rgba(255,255,255,0.5)">—</span> <span style="color:${opponentColor}">${opponentScore}</span>`;
  }

  updateTimer(secondsRemaining: number): void {
    const mins = Math.floor(secondsRemaining / 60);
    const secs = Math.floor(secondsRemaining % 60);
    this.timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

    // Flash red when low
    if (secondsRemaining <= 30) {
      this.timerEl.style.color = '#ff4444';
    } else {
      this.timerEl.style.color = '#fff';
    }
  }

  updateTrophyStatus(status: TrophyStatusLabel): void {
    this.trophyStatusEl.textContent = status;
    switch (status) {
      case 'CENTER':
        this.trophyStatusEl.style.color = '#ffd700';
        this.trophyStatusEl.style.borderColor = 'rgba(255, 215, 0, 0.3)';
        break;
      case 'YOU HAVE IT':
        this.trophyStatusEl.style.color = '#44ff44';
        this.trophyStatusEl.style.borderColor = 'rgba(68, 255, 68, 0.3)';
        break;
      case 'OPPONENT HAS IT':
        this.trophyStatusEl.style.color = '#ff4444';
        this.trophyStatusEl.style.borderColor = 'rgba(255, 68, 68, 0.3)';
        break;
      case 'LOOSE':
        this.trophyStatusEl.style.color = '#ffaa00';
        this.trophyStatusEl.style.borderColor = 'rgba(255, 170, 0, 0.3)';
        break;
    }
  }

  updateSlamCooldown(remaining: number, total: number): void {
    if (remaining <= 0) {
      this.slamCooldownEl.style.display = 'none';
      return;
    }

    this.slamCooldownEl.style.display = 'flex';
    const pct = remaining / total;
    // Draw a border progress effect using conic gradient
    this.slamCooldownEl.style.background = `conic-gradient(rgba(255,100,100,0.3) ${pct * 360}deg, rgba(0,0,0,0.5) ${pct * 360}deg)`;
  }

  /**
   * Update directional arrow pointing to a world target from the camera.
   * Shows an arrow at the screen edge when the target is off-screen.
   */
  updateDirectionalArrow(
    arrowEl: HTMLElement,
    targetWorld: THREE.Vector3,
    camera: THREE.Camera,
    color: string,
  ): void {
    // Project target to NDC
    const ndc = targetWorld.clone().project(camera);

    // Check if on-screen (NDC in [-1, 1] range and in front of camera)
    if (ndc.z < 1 && Math.abs(ndc.x) < 0.85 && Math.abs(ndc.y) < 0.85) {
      arrowEl.style.display = 'none';
      return;
    }

    arrowEl.style.display = 'block';

    // Compute angle from screen center to target
    const angle = Math.atan2(ndc.y, ndc.x);
    const margin = 40;
    const hw = window.innerWidth / 2 - margin;
    const hh = window.innerHeight / 2 - margin;

    // Clamp to screen edge
    let sx = Math.cos(angle) * hw;
    let sy = -Math.sin(angle) * hh; // Flip Y for CSS
    const maxAbs = Math.max(Math.abs(sx / hw), Math.abs(sy / hh));
    if (maxAbs > 1) {
      sx /= maxAbs;
      sy /= maxAbs;
    }

    const cx = window.innerWidth / 2 + sx;
    const cy = window.innerHeight / 2 + sy;

    arrowEl.style.left = `${cx - 10}px`;
    arrowEl.style.top = `${cy - 8}px`;
    arrowEl.style.transform = `rotate(${-angle + Math.PI / 2}rad)`;
    arrowEl.style.borderBottomColor = color;
  }

  updateTrophyArrow(trophyWorldPos: THREE.Vector3, camera: THREE.Camera): void {
    this.updateDirectionalArrow(this.trophyArrowEl, trophyWorldPos, camera, '#ffd700');
  }

  updatePedestalArrow(pedestalWorldPos: THREE.Vector3, camera: THREE.Camera, color: string): void {
    this.updateDirectionalArrow(this.pedestalArrowEl, pedestalWorldPos, camera, color);
  }

  hidePedestalArrow(): void {
    this.pedestalArrowEl.style.display = 'none';
  }

  dispose(): void {
    this.container.remove();
    this.slamCooldownEl.remove();
    this.trophyArrowEl.remove();
    this.pedestalArrowEl.remove();
    this.countdownOverlay.remove();
  }
}
