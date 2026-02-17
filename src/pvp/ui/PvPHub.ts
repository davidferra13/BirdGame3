/**
 * PvPHub - Collapsible sidebar showing available/active PvP events.
 * Non-intrusive: collapsed by default, expands on click.
 */

import type { PvPEventBus } from '../PvPEventBus';
import type { PvPManager } from '../PvPManager';

export class PvPHub {
  private container: HTMLElement;
  private tab: HTMLElement;
  private panel: HTMLElement;
  private eventList: HTMLElement;
  private expanded = false;
  private eventBus: PvPEventBus;
  private manager: PvPManager;
  private badgeEl: HTMLElement;

  constructor(eventBus: PvPEventBus, manager: PvPManager) {
    this.eventBus = eventBus;
    this.manager = manager;

    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      top: 50%;
      right: 0;
      transform: translateY(-50%);
      z-index: 900;
      display: flex;
      align-items: center;
      pointer-events: auto;
      font-family: 'Arial', sans-serif;
    `;

    // Collapsed tab
    this.tab = document.createElement('div');
    this.tab.style.cssText = `
      width: 40px;
      height: 80px;
      background: rgba(0, 0, 0, 0.7);
      border-radius: 8px 0 0 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.2s;
      position: relative;
    `;
    this.tab.innerHTML = `<span style="font-size: 20px; filter: grayscale(0);">&#9876;</span>`;
    this.tab.title = 'PvP Events';
    this.tab.addEventListener('click', () => this.toggle());
    this.tab.addEventListener('mouseenter', () => {
      this.tab.style.background = 'rgba(0, 0, 0, 0.85)';
    });
    this.tab.addEventListener('mouseleave', () => {
      this.tab.style.background = 'rgba(0, 0, 0, 0.7)';
    });

    // Badge
    this.badgeEl = document.createElement('div');
    this.badgeEl.style.cssText = `
      position: absolute;
      top: 4px;
      right: 4px;
      width: 16px;
      height: 16px;
      background: #ff4444;
      border-radius: 50%;
      font-size: 10px;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
    `;
    this.badgeEl.textContent = '3';
    this.tab.appendChild(this.badgeEl);

    // Expanded panel
    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      width: 0;
      max-height: 400px;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(8px);
      border-radius: 8px 0 0 8px;
      overflow: hidden;
      transition: width 0.3s ease;
      color: white;
    `;

    // Panel header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
      min-width: 260px;
    `;
    const title = document.createElement('span');
    title.style.cssText = 'font-size: 14px; font-weight: bold; letter-spacing: 1px;';
    title.textContent = 'PVP EVENTS';
    header.appendChild(title);

    const closeBtn = document.createElement('span');
    closeBtn.style.cssText = 'cursor: pointer; font-size: 18px; opacity: 0.7;';
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.collapse();
    });
    header.appendChild(closeBtn);
    this.panel.appendChild(header);

    // Event list
    this.eventList = document.createElement('div');
    this.eventList.style.cssText = `
      padding: 8px;
      overflow-y: auto;
      max-height: 330px;
      min-width: 260px;
    `;
    this.panel.appendChild(this.eventList);

    this.container.appendChild(this.panel);
    this.container.appendChild(this.tab);
    document.body.appendChild(this.container);

    this.renderEvents();
  }

  toggle(): void {
    this.expanded ? this.collapse() : this.expand();
  }

  expand(): void {
    this.expanded = true;
    this.panel.style.width = '280px';
    this.tab.style.display = 'none';
    this.renderEvents();
  }

  collapse(): void {
    this.expanded = false;
    this.panel.style.width = '0';
    this.tab.style.display = 'flex';
  }

  update(_dt: number): void {
    // Update badge count
    const events = this.manager.getAvailableEvents();
    this.badgeEl.textContent = String(events.length);
    this.badgeEl.style.display = events.length > 0 ? 'flex' : 'none';

    if (this.expanded) {
      this.renderEvents();
    }
  }

  private renderEvents(): void {
    const events = this.manager.getAvailableEvents();
    const phase = this.manager.getPhase();
    const currentMode = this.manager.getCurrentMode();

    this.eventList.innerHTML = '';

    if (events.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'text-align: center; color: #888; padding: 20px; font-size: 13px;';
      empty.textContent = 'No events available';
      this.eventList.appendChild(empty);
      return;
    }

    for (const event of events) {
      const card = document.createElement('div');
      const isActive = currentMode?.getModeId() === event.modeId && phase !== 'idle';
      card.style.cssText = `
        background: ${isActive ? 'rgba(68, 136, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
        border: 1px solid ${isActive ? 'rgba(68, 136, 255, 0.4)' : 'rgba(255, 255, 255, 0.1)'};
        border-radius: 6px;
        padding: 10px 12px;
        margin-bottom: 6px;
        cursor: pointer;
        transition: background 0.2s;
      `;
      card.addEventListener('mouseenter', () => {
        if (!isActive) card.style.background = 'rgba(255, 255, 255, 0.1)';
      });
      card.addEventListener('mouseleave', () => {
        if (!isActive) card.style.background = 'rgba(255, 255, 255, 0.05)';
      });

      // Mode name + icon
      const nameRow = document.createElement('div');
      nameRow.style.cssText = 'display: flex; align-items: center; gap: 6px; margin-bottom: 4px;';
      nameRow.innerHTML = `
        <span style="font-size: 16px;">${event.icon}</span>
        <span style="font-size: 13px; font-weight: bold;">${event.modeName}</span>
      `;
      card.appendChild(nameRow);

      // Status
      const status = document.createElement('div');
      status.style.cssText = 'font-size: 11px; color: #aaa; margin-bottom: 6px;';
      if (isActive) {
        status.textContent = `In progress - ${phase}`;
        status.style.color = '#4488ff';
      } else {
        status.textContent = 'Ready to play';
      }
      card.appendChild(status);

      // Action button
      const btn = document.createElement('button');
      btn.style.cssText = `
        width: 100%;
        padding: 6px;
        border: none;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
        transition: opacity 0.2s;
      `;

      if (isActive && this.manager.isInRound()) {
        btn.style.background = '#ff4444';
        btn.style.color = 'white';
        btn.textContent = 'LEAVE';
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.manager.leaveMode();
          this.renderEvents();
        });
      } else {
        btn.style.background = '#44cc44';
        btn.style.color = 'white';
        btn.textContent = 'PLAY';
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.manager.joinMode(event.modeId);
          this.renderEvents();
        });
      }

      btn.addEventListener('mouseenter', () => { btn.style.opacity = '0.8'; });
      btn.addEventListener('mouseleave', () => { btn.style.opacity = '1'; });
      card.appendChild(btn);

      this.eventList.appendChild(card);
    }
  }

  dispose(): void {
    this.container.remove();
  }
}
