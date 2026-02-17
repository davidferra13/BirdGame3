/**
 * PvPResultsPanel - End-of-round results screen.
 * Centered overlay showing standings, scores, rewards. Auto-closes after 10s.
 */

import type { PvPEventBus } from '../PvPEventBus';
import type { PvPResults } from '../PvPMode';

export class PvPResultsPanel {
  private overlay: HTMLElement;
  private panel: HTMLElement;
  private visible = false;
  private autoCloseTimer = 0;

  constructor(_eventBus: PvPEventBus) {
    // Full-screen semi-transparent overlay
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1100;
      display: none;
      justify-content: center;
      align-items: center;
      font-family: 'Arial', sans-serif;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    // Results panel
    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      background: rgba(15, 15, 30, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 24px 32px;
      max-width: 400px;
      width: 90%;
      color: white;
      text-align: center;
      transform: scale(0.9);
      transition: transform 0.3s ease;
    `;
    this.overlay.appendChild(this.panel);

    // Click overlay (outside panel) to close
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });

    document.body.appendChild(this.overlay);
  }

  showResults(results: PvPResults): void {
    this.visible = true;
    this.autoCloseTimer = 10;

    this.panel.innerHTML = '';

    // Title
    const title = document.createElement('h2');
    title.style.cssText = 'margin: 0 0 4px 0; font-size: 22px; letter-spacing: 2px;';
    title.textContent = results.modeName.toUpperCase();
    this.panel.appendChild(title);

    // Subtitle
    const sub = document.createElement('div');
    sub.style.cssText = 'font-size: 12px; color: #888; margin-bottom: 16px;';
    sub.textContent = 'Round Complete';
    this.panel.appendChild(sub);

    // Standings
    for (const standing of results.standings) {
      const row = document.createElement('div');
      const isLocal = standing.player.isLocal;
      const rankColors = ['#ffd700', '#c0c0c0', '#cd7f32'];
      const rankColor = rankColors[standing.rank - 1] || '#888';

      row.style.cssText = `
        display: flex;
        align-items: center;
        padding: 8px 12px;
        margin-bottom: 4px;
        border-radius: 6px;
        background: ${isLocal ? 'rgba(68, 136, 255, 0.15)' : 'rgba(255, 255, 255, 0.03)'};
        border: 1px solid ${isLocal ? 'rgba(68, 136, 255, 0.3)' : 'transparent'};
      `;

      // Rank
      const rankEl = document.createElement('div');
      rankEl.style.cssText = `
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: ${rankColor};
        color: black;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 14px;
        margin-right: 10px;
        flex-shrink: 0;
      `;
      rankEl.textContent = String(standing.rank);
      row.appendChild(rankEl);

      // Player info
      const info = document.createElement('div');
      info.style.cssText = 'flex: 1; text-align: left;';

      const nameEl = document.createElement('div');
      nameEl.style.cssText = `font-size: 14px; font-weight: ${isLocal ? 'bold' : 'normal'};`;
      nameEl.textContent = standing.player.name + (standing.player.isBot ? ' (Bot)' : '');
      info.appendChild(nameEl);

      const labelEl = document.createElement('div');
      labelEl.style.cssText = 'font-size: 11px; color: #888;';
      labelEl.textContent = standing.label;
      info.appendChild(labelEl);

      row.appendChild(info);

      // Reward
      if (standing.reward > 0) {
        const rewardEl = document.createElement('div');
        rewardEl.style.cssText = 'font-size: 14px; font-weight: bold; color: #ffcc00;';
        rewardEl.textContent = `+${standing.reward}`;
        row.appendChild(rewardEl);
      }

      this.panel.appendChild(row);
    }

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `
      margin-top: 16px;
      padding: 8px 24px;
      background: rgba(255, 255, 255, 0.1);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s;
    `;
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => this.hide());
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    });
    this.panel.appendChild(closeBtn);

    // Show with animation
    this.overlay.style.display = 'flex';
    requestAnimationFrame(() => {
      this.overlay.style.opacity = '1';
      this.panel.style.transform = 'scale(1)';
    });
  }

  private hide(): void {
    this.visible = false;
    this.overlay.style.opacity = '0';
    this.panel.style.transform = 'scale(0.9)';
    setTimeout(() => {
      if (!this.visible) this.overlay.style.display = 'none';
    }, 300);
  }

  update(dt: number): void {
    if (!this.visible) return;

    this.autoCloseTimer -= dt;
    if (this.autoCloseTimer <= 0) {
      this.hide();
    }
  }

  dispose(): void {
    this.overlay.remove();
  }
}
