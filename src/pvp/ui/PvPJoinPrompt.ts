/**
 * PvPJoinPrompt - Non-intrusive toast notification when a PvP event starts.
 * Shows briefly in the corner with a Join button. Auto-dismisses.
 */

import type { PvPEventBus } from '../PvPEventBus';
import type { PvPManager } from '../PvPManager';

export class PvPJoinPrompt {
  private container: HTMLElement;
  private visible = false;
  private dismissTimer = 0;
  private currentModeId = '';
  private manager: PvPManager;

  constructor(eventBus: PvPEventBus, manager: PvPManager) {
    this.manager = manager;

    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(6px);
      border-radius: 10px;
      border: 1px solid rgba(68, 136, 255, 0.3);
      padding: 12px 16px;
      z-index: 950;
      font-family: 'Arial', sans-serif;
      color: white;
      display: none;
      max-width: 280px;
      opacity: 0;
      transform: translateX(300px);
      transition: all 0.3s ease-out;
    `;
    document.body.appendChild(this.container);

    // Listen for new events
    eventBus.on('round-phase-change', (data: any) => {
      if (data.phase === 'lobby' || data.phase === 'countdown') {
        this.showPrompt(data.modeId, data.modeName);
      }
      if (data.phase === 'idle' || data.phase === 'results') {
        this.hide();
      }
    });
  }

  private showPrompt(modeId: string, modeName: string): void {
    // Don't show if player is already in this round
    if (this.manager.isInRound()) return;

    this.currentModeId = modeId;
    this.visible = true;
    this.dismissTimer = 8;

    this.container.innerHTML = '';

    // Message
    const msg = document.createElement('div');
    msg.style.cssText = 'font-size: 13px; margin-bottom: 8px;';
    msg.textContent = `${modeName} starting!`;
    this.container.appendChild(msg);

    // Button row
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 8px;';

    const joinBtn = document.createElement('button');
    joinBtn.style.cssText = `
      flex: 1;
      padding: 6px 12px;
      background: #44cc44;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      cursor: pointer;
    `;
    joinBtn.textContent = 'Join';
    joinBtn.addEventListener('click', () => {
      this.manager.joinMode(this.currentModeId);
      this.hide();
    });

    const dismissBtn = document.createElement('button');
    dismissBtn.style.cssText = `
      padding: 6px 10px;
      background: rgba(255,255,255,0.1);
      color: #888;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
    `;
    dismissBtn.textContent = '\u00d7';
    dismissBtn.addEventListener('click', () => this.hide());

    btnRow.appendChild(joinBtn);
    btnRow.appendChild(dismissBtn);
    this.container.appendChild(btnRow);

    this.container.style.display = 'block';
    requestAnimationFrame(() => {
      this.container.style.opacity = '1';
      this.container.style.transform = 'translateX(0)';
    });
  }

  private hide(): void {
    this.visible = false;
    this.container.style.opacity = '0';
    this.container.style.transform = 'translateX(300px)';
    setTimeout(() => {
      if (!this.visible) this.container.style.display = 'none';
    }, 300);
  }

  update(dt: number): void {
    if (!this.visible) return;

    this.dismissTimer -= dt;
    if (this.dismissTimer <= 0) {
      this.hide();
    }
  }

  dispose(): void {
    this.container.remove();
  }
}
