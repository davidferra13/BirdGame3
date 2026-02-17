/**
 * MvMMatchmaker — MvM PvP queue and pre-match UI.
 * Shows mode selection, team size, matchmaking status, and countdown.
 * Follows existing imperative DOM pattern.
 */

import { MVM } from '@/utils/Constants';
import type { MvMMode, MvMTeamSize, MvMMatch, MvMTeam } from '@/types/murmuration';

export class MvMMatchmaker {
  private container: HTMLElement;
  private panel: HTMLElement;
  private visible = false;
  private statusEl: HTMLElement;
  private queueTimerEl: HTMLElement;
  private countdownEl: HTMLElement;
  private modeButtons: HTMLButtonElement[] = [];
  private sizeButtons: HTMLButtonElement[] = [];
  private queueBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;

  private selectedMode: MvMMode = 'team_poop_tag';
  private selectedSize: MvMTeamSize = 3;
  private state: 'selecting' | 'queuing' | 'found' | 'countdown' = 'selecting';

  private onQueue: ((mode: MvMMode, size: MvMTeamSize) => void) | null = null;
  private onCancel: (() => void) | null = null;
  private onClose: (() => void) | null = null;

  constructor() {
    // Overlay
    this.container = document.createElement('div');
    this.container.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;' +
      'display:none;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.85);z-index:2100;' +
      'font-family:"Segoe UI",system-ui,sans-serif;color:#fff;';

    // Panel
    this.panel = document.createElement('div');
    this.panel.style.cssText =
      'background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);' +
      'border-radius:12px;max-width:500px;width:90%;padding:30px;' +
      'box-shadow:0 20px 60px rgba(0,0,0,0.5);' +
      'border:2px solid rgba(255,255,255,0.1);text-align:center;';

    // Title
    const title = document.createElement('div');
    title.style.cssText =
      'font-size:24px;font-weight:bold;margin-bottom:24px;letter-spacing:2px;';
    title.textContent = 'MvM MATCHMAKER';
    this.panel.appendChild(title);

    // Mode selection
    const modeLabel = this.createLabel('SELECT MODE');
    this.panel.appendChild(modeLabel);

    const modeGrid = document.createElement('div');
    modeGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px;';

    const modes: { id: MvMMode; label: string; desc: string }[] = [
      { id: 'team_poop_tag', label: 'TEAM POOP TAG', desc: 'Tag opponents, avoid being tagged' },
      { id: 'team_race', label: 'TEAM RACE', desc: 'Race through checkpoints as a team' },
      { id: 'team_splat_attack', label: 'TEAM SPLAT', desc: 'Cover your target with poop' },
      { id: 'territory_war', label: 'TERRITORY WAR', desc: 'Capture and hold rooftop zones' },
    ];

    for (const mode of modes) {
      const btn = this.createModeButton(mode.id, mode.label, mode.desc);
      this.modeButtons.push(btn);
      modeGrid.appendChild(btn);
    }
    this.panel.appendChild(modeGrid);

    // Team size selection
    const sizeLabel = this.createLabel('TEAM SIZE');
    this.panel.appendChild(sizeLabel);

    const sizeRow = document.createElement('div');
    sizeRow.style.cssText = 'display:flex;gap:8px;justify-content:center;margin-bottom:24px;';

    for (const size of [2, 3, 5] as MvMTeamSize[]) {
      const btn = document.createElement('button');
      btn.setAttribute('type', 'button');
      const isActive = size === this.selectedSize;
      btn.textContent = `${size}v${size}`;
      btn.style.cssText =
        `padding:10px 24px;border-radius:6px;font-size:16px;font-weight:bold;cursor:pointer;` +
        `background:${isActive ? 'rgba(68,136,255,0.3)' : 'rgba(255,255,255,0.05)'};` +
        `border:2px solid ${isActive ? 'rgba(68,136,255,0.6)' : 'rgba(255,255,255,0.1)'};` +
        `color:${isActive ? '#88aaff' : 'rgba(255,255,255,0.6)'};transition:all 0.2s;`;
      btn.addEventListener('click', () => {
        this.selectedSize = size;
        this.updateSizeButtons();
      });
      this.sizeButtons.push(btn);
      sizeRow.appendChild(btn);
    }
    this.panel.appendChild(sizeRow);

    // Status area
    this.statusEl = document.createElement('div');
    this.statusEl.style.cssText =
      'font-size:14px;color:rgba(255,255,255,0.6);margin-bottom:8px;min-height:20px;';
    this.panel.appendChild(this.statusEl);

    this.queueTimerEl = document.createElement('div');
    this.queueTimerEl.style.cssText =
      'font-size:24px;font-weight:bold;color:#ffdd44;margin-bottom:16px;display:none;';
    this.panel.appendChild(this.queueTimerEl);

    this.countdownEl = document.createElement('div');
    this.countdownEl.style.cssText =
      'font-size:48px;font-weight:bold;color:#44ff88;' +
      'text-shadow:0 0 20px rgba(68,255,136,0.5);margin-bottom:16px;display:none;';
    this.panel.appendChild(this.countdownEl);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:12px;';

    this.cancelBtn = document.createElement('button');
    this.cancelBtn.setAttribute('type', 'button');
    this.cancelBtn.textContent = 'CLOSE';
    this.cancelBtn.style.cssText =
      'flex:1;padding:12px;background:rgba(255,255,255,0.1);' +
      'border:1px solid rgba(255,255,255,0.2);border-radius:6px;' +
      'color:#fff;font-size:14px;font-weight:bold;cursor:pointer;transition:all 0.2s;';
    this.cancelBtn.addEventListener('click', () => {
      if (this.state === 'queuing') {
        this.onCancel?.();
        this.setState('selecting');
      } else {
        this.hide();
        this.onClose?.();
      }
    });

    this.queueBtn = document.createElement('button');
    this.queueBtn.setAttribute('type', 'button');
    this.queueBtn.textContent = 'FIND MATCH';
    this.queueBtn.style.cssText =
      'flex:1;padding:12px;background:rgba(68,255,136,0.2);' +
      'border:1px solid rgba(68,255,136,0.4);border-radius:6px;' +
      'color:#44ff88;font-size:14px;font-weight:bold;cursor:pointer;transition:all 0.2s;';
    this.queueBtn.addEventListener('click', () => {
      if (this.state === 'selecting') {
        this.onQueue?.(this.selectedMode, this.selectedSize);
        this.setState('queuing');
      }
    });

    btnRow.appendChild(this.cancelBtn);
    btnRow.appendChild(this.queueBtn);
    this.panel.appendChild(btnRow);

    this.container.appendChild(this.panel);
    document.body.appendChild(this.container);
  }

  setCallbacks(
    onQueue: (mode: MvMMode, size: MvMTeamSize) => void,
    onCancel: () => void,
    onClose: () => void,
  ): void {
    this.onQueue = onQueue;
    this.onCancel = onCancel;
    this.onClose = onClose;
  }

  show(): void {
    this.visible = true;
    this.container.style.display = 'flex';
    this.setState('selecting');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  hide(): void {
    this.visible = false;
    this.container.style.display = 'none';
  }

  get isVisible(): boolean {
    return this.visible;
  }

  setState(state: 'selecting' | 'queuing' | 'found' | 'countdown'): void {
    this.state = state;

    switch (state) {
      case 'selecting':
        this.statusEl.textContent = '';
        this.queueTimerEl.style.display = 'none';
        this.countdownEl.style.display = 'none';
        this.queueBtn.style.display = 'block';
        this.queueBtn.textContent = 'FIND MATCH';
        this.cancelBtn.textContent = 'CLOSE';
        break;
      case 'queuing':
        this.statusEl.textContent = 'Searching for opponents...';
        this.queueTimerEl.style.display = 'block';
        this.countdownEl.style.display = 'none';
        this.queueBtn.style.display = 'none';
        this.cancelBtn.textContent = 'CANCEL SEARCH';
        break;
      case 'found':
        this.statusEl.textContent = 'Match found!';
        this.statusEl.style.color = '#44ff88';
        this.queueTimerEl.style.display = 'none';
        this.countdownEl.style.display = 'none';
        this.queueBtn.style.display = 'none';
        this.cancelBtn.style.display = 'none';
        break;
      case 'countdown':
        this.statusEl.textContent = 'Match starting...';
        this.statusEl.style.color = '#44ff88';
        this.queueTimerEl.style.display = 'none';
        this.countdownEl.style.display = 'block';
        this.queueBtn.style.display = 'none';
        this.cancelBtn.style.display = 'none';
        break;
    }
  }

  updateQueueTimer(elapsedMs: number): void {
    const secs = Math.floor(elapsedMs / 1000);
    this.queueTimerEl.textContent = `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`;
  }

  showCountdown(seconds: number): void {
    this.setState('countdown');
    this.countdownEl.textContent = seconds.toString();
  }

  showMatchInfo(opponent: MvMTeam): void {
    this.statusEl.innerHTML =
      `Match found! vs <strong style="color:#ff8844;">[${opponent.murmuration_tag}] ${opponent.murmuration_name}</strong>`;
  }

  private createLabel(text: string): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText =
      'font-size:11px;font-weight:bold;letter-spacing:2px;' +
      'color:rgba(255,255,255,0.4);margin-bottom:8px;';
    el.textContent = text;
    return el;
  }

  private createModeButton(id: MvMMode, label: string, desc: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.setAttribute('type', 'button');
    const isActive = id === this.selectedMode;
    btn.style.cssText =
      `padding:12px;border-radius:8px;cursor:pointer;text-align:left;` +
      `background:${isActive ? 'rgba(68,136,255,0.2)' : 'rgba(255,255,255,0.03)'};` +
      `border:2px solid ${isActive ? 'rgba(68,136,255,0.5)' : 'rgba(255,255,255,0.08)'};` +
      'transition:all 0.2s;';
    btn.innerHTML =
      `<div style="font-size:12px;font-weight:bold;color:${isActive ? '#88aaff' : '#fff'};margin-bottom:4px;">${label}</div>` +
      `<div style="font-size:10px;color:rgba(255,255,255,0.4);">${desc}</div>`;
    btn.addEventListener('click', () => {
      this.selectedMode = id;
      this.updateModeButtons();
    });
    return btn;
  }

  private updateModeButtons(): void {
    const modes: MvMMode[] = ['team_poop_tag', 'team_race', 'team_splat_attack', 'territory_war'];
    for (let i = 0; i < this.modeButtons.length; i++) {
      const isActive = modes[i] === this.selectedMode;
      this.modeButtons[i].style.background = isActive ? 'rgba(68,136,255,0.2)' : 'rgba(255,255,255,0.03)';
      this.modeButtons[i].style.borderColor = isActive ? 'rgba(68,136,255,0.5)' : 'rgba(255,255,255,0.08)';
    }
  }

  private updateSizeButtons(): void {
    const sizes: MvMTeamSize[] = [2, 3, 5];
    for (let i = 0; i < this.sizeButtons.length; i++) {
      const isActive = sizes[i] === this.selectedSize;
      this.sizeButtons[i].style.background = isActive ? 'rgba(68,136,255,0.3)' : 'rgba(255,255,255,0.05)';
      this.sizeButtons[i].style.borderColor = isActive ? 'rgba(68,136,255,0.6)' : 'rgba(255,255,255,0.1)';
      this.sizeButtons[i].style.color = isActive ? '#88aaff' : 'rgba(255,255,255,0.6)';
    }
  }
}
