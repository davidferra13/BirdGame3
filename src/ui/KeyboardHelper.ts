/**
 * Keyboard shortcuts helper — always-visible compact strip + F1 full panel
 */
export class KeyboardHelper {
  private container: HTMLElement;
  private compactBar: HTMLElement;
  private fullPanel: HTMLElement;
  private expanded = false;

  constructor() {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 500;
      pointer-events: none;
      font-family: 'Segoe UI', system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    `;

    // ── Compact always-visible bar ──
    this.compactBar = document.createElement('div');
    this.compactBar.style.cssText = `
      display: flex;
      gap: 10px;
      padding: 5px 14px;
      background: rgba(0, 0, 0, 0.35);
      border-radius: 20px;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      opacity: 0.6;
      transition: opacity 0.3s;
    `;
    this.compactBar.onmouseenter = () => { this.compactBar.style.opacity = '1'; };
    this.compactBar.onmouseleave = () => { if (!this.expanded) this.compactBar.style.opacity = '0.6'; };

    const compactHints = [
      { key: 'WASD', label: 'Fly' },
      { key: 'M', label: 'Walk Toggle' },
      { key: 'Space', label: 'Up' },
      { key: 'Caps', label: 'Bomber' },
      { key: 'L-Shift', label: 'Soft Down' },
      { key: 'K', label: 'Fast Down' },
      { key: 'Alt', label: 'Dive' },
      { key: 'Click', label: 'Poop' },
      { key: 'R-Click', label: 'Grab NPC' },
      { key: 'T', label: 'Boost' },
      { key: 'F1', label: 'More' },
    ];

    for (const hint of compactHints) {
      const item = document.createElement('span');
      item.style.cssText = `font-size: 11px; color: rgba(255,255,255,0.7); white-space: nowrap;`;
      item.innerHTML = `<span style="color:#FFD700;font-weight:bold;font-family:'Courier New',monospace;font-size:10px;">${hint.key}</span> <span style="font-size:10px;">${hint.label}</span>`;
      this.compactBar.appendChild(item);
    }

    // ── Full expanded panel ──
    this.fullPanel = document.createElement('div');
    this.fullPanel.style.cssText = `
      display: none;
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 10px;
      padding: 14px 18px;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      max-width: 640px;
      width: max-content;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    `;

    const title = document.createElement('div');
    title.style.cssText = `
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 10px;
      text-align: center;
      color: #FFD700;
      letter-spacing: 1px;
      text-transform: uppercase;
    `;
    title.textContent = 'Controls';
    this.fullPanel.appendChild(title);

    const columns = document.createElement('div');
    columns.style.cssText = `display: flex; gap: 24px;`;

    const flightShortcuts = [
      { key: 'W/A/D', action: 'Forward & Turn' },
      { key: 'S', action: 'Brake' },
      { key: 'Space', action: 'Ascend' },
      { key: 'Caps', action: 'Bomber Mode' },
      { key: 'L-Shift', action: 'Precision Descend' },
      { key: 'K', action: 'Fast Descent' },
      { key: 'Alt', action: 'Dive' },
      { key: 'T', action: 'Boost' },
    ];

    const actionShortcuts = [
      { key: 'Click', action: 'Drop Poop' },
      { key: 'R-Click', action: 'Grab / Throw NPC' },
      { key: 'Q/E', action: 'Flip Fwd / Back' },
      { key: 'R/F', action: 'Barrel Roll L / R' },
      { key: '1-4', action: 'Emotes' },
    ];

    const menuShortcuts = [
      { key: 'B', action: 'Shop' },
      { key: 'L', action: 'LeaderBird' },
      { key: 'H', action: 'Achievements' },
      { key: 'M', action: 'Walk Mode Toggle' },
      { key: 'O', action: 'Minimap' },
      { key: 'Esc', action: 'Pause' },
      { key: 'F1', action: 'Hide Controls' },
    ];

    columns.appendChild(this.buildColumn('Flight', flightShortcuts));
    columns.appendChild(this.buildColumn('Actions', actionShortcuts));
    columns.appendChild(this.buildColumn('Menus', menuShortcuts));
    this.fullPanel.appendChild(columns);

    this.container.appendChild(this.fullPanel);
    this.container.appendChild(this.compactBar);
    document.body.appendChild(this.container);
  }

  private buildColumn(heading: string, items: { key: string; action: string }[]): HTMLElement {
    const col = document.createElement('div');
    col.style.cssText = `min-width: 180px;`;

    const h = document.createElement('div');
    h.style.cssText = `font-size: 10px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;`;
    h.textContent = heading;
    col.appendChild(h);

    for (const item of items) {
      const row = document.createElement('div');
      row.style.cssText = `display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px;`;

      const keyEl = document.createElement('span');
      keyEl.style.cssText = `color: #FFD700; font-weight: bold; font-family: 'Courier New', monospace; font-size: 10px; min-width: 60px;`;
      keyEl.textContent = item.key;

      const actionEl = document.createElement('span');
      actionEl.style.cssText = `color: rgba(255,255,255,0.75); text-align: right; flex: 1;`;
      actionEl.textContent = item.action;

      row.appendChild(keyEl);
      row.appendChild(actionEl);
      col.appendChild(row);
    }
    return col;
  }

  show(): void {
    this.expanded = true;
    this.fullPanel.style.display = 'block';
    this.compactBar.style.opacity = '1';
  }

  hide(): void {
    this.expanded = false;
    this.fullPanel.style.display = 'none';
    this.compactBar.style.opacity = '0.6';
  }

  toggle(): void {
    if (this.expanded) {
      this.hide();
    } else {
      this.show();
    }
  }

  get isVisible(): boolean {
    return this.expanded;
  }
}
