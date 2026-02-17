import { PlayerStats } from '../systems/ProgressionSystem';

export class StatsPanel {
  private container: HTMLElement;
  private visible = false;
  private onClose: (() => void) | null = null;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'stats-panel';
    this.container.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;' +
      'display:none;flex-direction:column;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.85);font-family:"Segoe UI",system-ui,sans-serif;' +
      'color:#fff;z-index:95;';
    document.body.appendChild(this.container);
  }

  show(stats: PlayerStats, level: number, xp: number): void {
    this.visible = true;
    this.container.style.display = 'flex';
    this.container.innerHTML = '';

    const panel = document.createElement('div');
    panel.style.cssText =
      'width:360px;padding:30px;background:rgba(40,50,60,0.95);' +
      'border-radius:8px;border:1px solid rgba(255,255,255,0.15);';

    const title = document.createElement('div');
    title.style.cssText = 'font-size:24px;font-weight:bold;margin-bottom:20px;text-align:center;letter-spacing:2px;';
    title.textContent = 'STATISTICS';
    panel.appendChild(title);

    const statLines = [
      ['Level', String(level)],
      ['Total XP', String(xp)],
      ['Total NPC Hits', String(stats.totalNPCHits)],
      ['Times Grounded', String(stats.totalTimesGrounded)],
      ['Highest Heat', String(Math.round(stats.highestHeat))],
      ['Highest Streak', String(stats.highestStreak)],
      ['Lifetime Coins', String(stats.lifetimeCoinsEarned)],
      ['Total Banks', String(stats.totalBanks)],
      ['Largest Bank', String(stats.largestBank)],
      ['Distance Flown', `${Math.round(stats.totalDistanceFlown)}m`],
    ];

    for (const [label, value] of statLines) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.1);';
      const l = document.createElement('span');
      l.style.cssText = 'color:#aaa;font-size:13px;';
      l.textContent = label;
      const v = document.createElement('span');
      v.style.cssText = 'font-weight:bold;font-size:14px;';
      v.textContent = value;
      row.appendChild(l);
      row.appendChild(v);
      panel.appendChild(row);
    }

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText =
      'display:block;width:100%;padding:12px;margin-top:20px;' +
      'background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.3);' +
      'color:#fff;font-size:14px;font-weight:bold;cursor:pointer;border-radius:4px;pointer-events:auto;';
    closeBtn.textContent = 'CLOSE';
    closeBtn.addEventListener('click', () => { this.hide(); this.onClose?.(); });
    panel.appendChild(closeBtn);

    this.container.appendChild(panel);
  }

  hide(): void {
    this.visible = false;
    this.container.style.display = 'none';
  }

  setOnClose(fn: () => void): void {
    this.onClose = fn;
  }

  get isVisible(): boolean {
    return this.visible;
  }
}
