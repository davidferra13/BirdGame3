/**
 * EmblemEditor — Layered emblem composition UI.
 * Alpha-only. Allows editing background, icon, border, and colors.
 * Follows existing imperative DOM pattern.
 */

import type { EmblemConfig, EmblemBackground, EmblemBorder } from '@/types/murmuration';
import {
  renderEmblem,
  getAvailableIcons,
  getAvailableColors,
  getAvailableBackgrounds,
  getAvailableBorders,
  DEFAULT_EMBLEM,
} from '@/ui/EmblemRenderer';

export class EmblemEditor {
  private container: HTMLElement;
  private panel: HTMLElement;
  private visible = false;
  private previewCanvas: HTMLCanvasElement;
  private config: EmblemConfig;
  private formationLevel: number;

  private onSave: ((config: EmblemConfig) => void) | null = null;
  private onCancel: (() => void) | null = null;

  constructor() {
    this.config = { ...DEFAULT_EMBLEM };
    this.formationLevel = 1;

    // Overlay
    this.container = document.createElement('div');
    this.container.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;' +
      'display:none;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.85);z-index:2200;' +
      'font-family:"Segoe UI",system-ui,sans-serif;color:#fff;';

    // Panel
    this.panel = document.createElement('div');
    this.panel.style.cssText =
      'background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);' +
      'border-radius:12px;max-width:600px;width:90%;padding:30px;' +
      'max-height:85vh;overflow-y:auto;' +
      'box-shadow:0 20px 60px rgba(0,0,0,0.5);' +
      'border:2px solid rgba(255,255,255,0.1);';

    // Title
    const title = document.createElement('div');
    title.style.cssText =
      'font-size:22px;font-weight:bold;text-align:center;margin-bottom:20px;letter-spacing:2px;';
    title.textContent = 'EMBLEM EDITOR';
    this.panel.appendChild(title);

    // Preview
    const previewArea = document.createElement('div');
    previewArea.style.cssText = 'text-align:center;margin-bottom:24px;';
    this.previewCanvas = document.createElement('canvas');
    this.previewCanvas.width = 128;
    this.previewCanvas.height = 128;
    this.previewCanvas.style.cssText =
      'width:128px;height:128px;border-radius:8px;' +
      'border:2px solid rgba(255,255,255,0.2);';
    previewArea.appendChild(this.previewCanvas);
    this.panel.appendChild(previewArea);

    // Sections will be built dynamically on show()
    this.container.appendChild(this.panel);
    document.body.appendChild(this.container);
  }

  setCallbacks(onSave: (config: EmblemConfig) => void, onCancel: () => void): void {
    this.onSave = onSave;
    this.onCancel = onCancel;
  }

  show(currentConfig: EmblemConfig, formationLevel: number): void {
    this.config = { ...currentConfig };
    this.formationLevel = formationLevel;
    this.visible = true;
    this.container.style.display = 'flex';
    if (document.pointerLockElement) document.exitPointerLock();
    this.buildControls();
    this.updatePreview();
  }

  hide(): void {
    this.visible = false;
    this.container.style.display = 'none';
  }

  get isVisible(): boolean {
    return this.visible;
  }

  private buildControls(): void {
    // Remove old controls (keep title + preview)
    while (this.panel.children.length > 2) {
      this.panel.removeChild(this.panel.lastChild!);
    }

    // Background shape
    const backgrounds = getAvailableBackgrounds(this.formationLevel);
    this.panel.appendChild(this.createSelector(
      'BACKGROUND SHAPE',
      backgrounds,
      this.config.background,
      (val) => { this.config.background = val as EmblemBackground; this.updatePreview(); },
    ));

    // Icon
    const icons = getAvailableIcons(this.formationLevel);
    this.panel.appendChild(this.createSelector(
      'ICON',
      icons,
      this.config.icon,
      (val) => { this.config.icon = val; this.updatePreview(); },
    ));

    // Border
    const borders = getAvailableBorders(this.formationLevel);
    this.panel.appendChild(this.createSelector(
      'BORDER',
      borders,
      this.config.border,
      (val) => { this.config.border = val as EmblemBorder; this.updatePreview(); },
    ));

    // Background color
    const colors = getAvailableColors(this.formationLevel);
    this.panel.appendChild(this.createColorPicker(
      'BACKGROUND COLOR',
      colors,
      this.config.bgColor,
      (val) => { this.config.bgColor = val; this.updatePreview(); },
    ));

    // Foreground color
    this.panel.appendChild(this.createColorPicker(
      'ICON COLOR',
      colors,
      this.config.fgColor,
      (val) => { this.config.fgColor = val; this.updatePreview(); },
    ));

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:12px;margin-top:20px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.setAttribute('type', 'button');
    cancelBtn.textContent = 'CANCEL';
    cancelBtn.style.cssText =
      'flex:1;padding:12px;background:rgba(255,255,255,0.1);' +
      'border:1px solid rgba(255,255,255,0.2);border-radius:6px;' +
      'color:#fff;font-size:14px;font-weight:bold;cursor:pointer;transition:all 0.2s;';
    cancelBtn.addEventListener('click', () => { this.hide(); this.onCancel?.(); });

    const saveBtn = document.createElement('button');
    saveBtn.setAttribute('type', 'button');
    saveBtn.textContent = 'SAVE EMBLEM';
    saveBtn.style.cssText =
      'flex:1;padding:12px;background:rgba(68,255,136,0.2);' +
      'border:1px solid rgba(68,255,136,0.4);border-radius:6px;' +
      'color:#44ff88;font-size:14px;font-weight:bold;cursor:pointer;transition:all 0.2s;';
    saveBtn.addEventListener('click', () => {
      this.onSave?.({ ...this.config });
      this.hide();
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);
    this.panel.appendChild(btnRow);
  }

  private updatePreview(): void {
    const rendered = renderEmblem(this.config, 128, this.formationLevel >= 10);
    const ctx = this.previewCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, 128, 128);
    ctx.drawImage(rendered, 0, 0);
  }

  private createSelector(
    label: string,
    options: string[],
    current: string,
    onChange: (val: string) => void,
  ): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom:16px;';

    const labelEl = document.createElement('div');
    labelEl.style.cssText =
      'font-size:11px;font-weight:bold;letter-spacing:2px;' +
      'color:rgba(255,255,255,0.4);margin-bottom:8px;';
    labelEl.textContent = label;
    section.appendChild(labelEl);

    const grid = document.createElement('div');
    grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';

    for (const opt of options) {
      const btn = document.createElement('button');
      btn.setAttribute('type', 'button');
      const isActive = opt === current;
      btn.textContent = opt.replace(/_/g, ' ');
      btn.style.cssText =
        `padding:6px 12px;border-radius:4px;font-size:11px;cursor:pointer;` +
        `background:${isActive ? 'rgba(68,136,255,0.3)' : 'rgba(255,255,255,0.05)'};` +
        `border:1px solid ${isActive ? 'rgba(68,136,255,0.6)' : 'rgba(255,255,255,0.1)'};` +
        `color:${isActive ? '#88aaff' : 'rgba(255,255,255,0.6)'};transition:all 0.2s;`;
      btn.addEventListener('click', () => {
        onChange(opt);
        this.buildControls();
      });
      grid.appendChild(btn);
    }

    section.appendChild(grid);
    return section;
  }

  private createColorPicker(
    label: string,
    colors: string[],
    current: string,
    onChange: (val: string) => void,
  ): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom:16px;';

    const labelEl = document.createElement('div');
    labelEl.style.cssText =
      'font-size:11px;font-weight:bold;letter-spacing:2px;' +
      'color:rgba(255,255,255,0.4);margin-bottom:8px;';
    labelEl.textContent = label;
    section.appendChild(labelEl);

    const grid = document.createElement('div');
    grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';

    for (const color of colors) {
      const swatch = document.createElement('button');
      swatch.setAttribute('type', 'button');
      swatch.setAttribute('aria-label', `Color ${color}`);
      const isActive = color === current;
      swatch.style.cssText =
        `width:30px;height:30px;border-radius:50%;cursor:pointer;` +
        `background:${color};` +
        `border:3px solid ${isActive ? '#fff' : 'rgba(255,255,255,0.2)'};` +
        'transition:border-color 0.2s;';
      swatch.addEventListener('click', () => {
        onChange(color);
        this.buildControls();
      });
      grid.appendChild(swatch);
    }

    section.appendChild(grid);
    return section;
  }
}
