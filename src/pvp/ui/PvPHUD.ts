/**
 * PvPHUD - Minimal in-game overlay during active PvP round.
 * Thin status bar at top-center, auto-fades when no state changes.
 */

import type { PvPEventBus } from '../PvPEventBus';
import type { PvPRoundState } from '../PvPManager';

export class PvPHUD {
  private container: HTMLElement;
  private statusText: HTMLElement;
  private timerText: HTMLElement;
  private standingText: HTMLElement;
  private visible = false;
  private opacity = 0;
  private fadeTimer = 0;
  private lastStateStr = '';

  constructor(_eventBus: PvPEventBus) {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      border-radius: 20px;
      padding: 6px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      z-index: 850;
      font-family: 'Arial', sans-serif;
      color: white;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s ease;
      white-space: nowrap;
    `;

    // Mode icon + name
    this.statusText = document.createElement('span');
    this.statusText.style.cssText = 'font-size: 13px; font-weight: bold;';
    this.container.appendChild(this.statusText);

    // Separator
    const sep = document.createElement('span');
    sep.style.cssText = 'color: rgba(255,255,255,0.3);';
    sep.textContent = '|';
    this.container.appendChild(sep);

    // Timer
    this.timerText = document.createElement('span');
    this.timerText.style.cssText = 'font-size: 14px; font-weight: bold; font-variant-numeric: tabular-nums;';
    this.container.appendChild(this.timerText);

    // Separator
    const sep2 = sep.cloneNode(true);
    this.container.appendChild(sep2);

    // Standing
    this.standingText = document.createElement('span');
    this.standingText.style.cssText = 'font-size: 12px; color: #aaccff;';
    this.container.appendChild(this.standingText);

    document.body.appendChild(this.container);
  }

  update(dt: number, state: PvPRoundState): void {
    const shouldShow = state.phase === 'active' || state.phase === 'countdown';

    if (shouldShow && !this.visible) {
      this.visible = true;
      this.fadeTimer = 3;
    }

    if (!shouldShow && this.visible) {
      this.visible = false;
    }

    // Build state string for change detection
    const stateStr = `${state.phase}|${Math.ceil(state.timeRemaining)}|${state.modeData?.taggedPlayerId || ''}|${state.modeData?.localCheckpoint || 0}|${Math.ceil(state.modeData?.combat?.burstCooldown || 0)}|${Math.ceil(state.modeData?.combat?.mineCooldown || 0)}|${Math.ceil(state.modeData?.combat?.rootedRemaining || 0)}`;
    if (stateStr !== this.lastStateStr) {
      this.lastStateStr = stateStr;
      this.fadeTimer = 3; // Reset fade timer on state change
    }

    // Fade logic
    if (this.visible) {
      this.fadeTimer -= dt;
      const targetOpacity = this.fadeTimer > 0 ? 0.9 : 0.3;
      this.opacity += (targetOpacity - this.opacity) * Math.min(1, 5 * dt);
    } else {
      this.opacity += (0 - this.opacity) * Math.min(1, 5 * dt);
    }
    this.container.style.opacity = String(this.opacity);

    if (!shouldShow) return;

    // Update content
    if (state.phase === 'countdown') {
      this.statusText.textContent = 'GET READY';
      this.timerText.textContent = String(Math.ceil(state.timeRemaining));
      this.timerText.style.fontSize = '20px';
      this.standingText.textContent = '';
    } else if (state.phase === 'active') {
      this.timerText.style.fontSize = '14px';
      const mins = Math.floor(state.timeRemaining / 60);
      const secs = Math.floor(state.timeRemaining % 60);
      this.timerText.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

      this.updateModeStatus(state);
    }
  }

  private updateModeStatus(state: PvPRoundState): void {
    const data = state.modeData;
    const combat = data?.combat;
    const burstCd = Math.ceil(Math.max(0, combat?.burstCooldown || 0));
    const mineCd = Math.ceil(Math.max(0, combat?.mineCooldown || 0));
    const rooted = (combat?.rootedRemaining || 0) > 0;
    const slowed = (combat?.slowedRemaining || 0) > 0;
    const mines = Math.max(0, combat?.mineCount || 0);
    const combatHint = ` [5 Burst ${burstCd || 'READY'} | 6 Mine ${mineCd || 'READY'} (${mines})]`;

    switch (state.mode) {
      case 'poop-tag': {
        const isTagged = data?.taggedPlayerId === data?.localPlayerId;
        this.statusText.textContent = `POOP TAG${combatHint}`;
        this.standingText.textContent = rooted ? 'Rooted!' : (isTagged ? "You're IT!" : (slowed ? 'Slowed' : "You're safe"));
        this.standingText.style.color = isTagged ? '#ff6644' : '#44ff88';
        break;
      }
      case 'race': {
        const cp = data?.localCheckpoint || 0;
        const total = data?.totalCheckpoints || 0;
        const rank = data?.localRank || '?';
        this.statusText.textContent = `RACE${combatHint}`;
        this.standingText.textContent = rooted ? 'Rooted!' : `CP ${cp}/${total} - ${rank}${slowed ? ' - Slowed' : ''}`;
        this.standingText.style.color = '#aaccff';
        break;
      }
      case 'poop-cover': {
        const hits = data?.localHits || 0;
        const rank = data?.localRank || '?';
        this.statusText.textContent = `SPLAT ATTACK${combatHint}`;
        this.standingText.textContent = rooted ? 'Rooted!' : `${hits} hits (${rank})${slowed ? ' - Slowed' : ''}`;
        this.standingText.style.color = '#ffcc44';
        break;
      }
      case 'heist': {
        const scoreA = data?.scoreA ?? 0;
        const scoreB = data?.scoreB ?? 0;
        this.statusText.textContent = `HEIST${combatHint}`;
        this.standingText.textContent = rooted ? 'Rooted!' : `${scoreA} - ${scoreB}${slowed ? ' - Slowed' : ''}`;
        this.standingText.style.color = '#aaccff';
        break;
      }
    }
  }

  dispose(): void {
    this.container.remove();
  }
}
