export class SettingsMenu {
  private container: HTMLElement;
  private visible = false;
  private onClose: (() => void) | null = null;

  // Setting values
  masterVolume = 0.5;
  sfxVolume = 0.7;
  musicVolume = 0.3;
  sensitivity = 1.0;
  invertY = false;
  showNames = true;
  graphicsQuality: 'low' | 'medium' | 'high' = 'high';

  private onChanged: ((settings: SettingsMenu) => void) | null = null;
  private onReplayTutorial: (() => void) | null = null;
  private onControls: (() => void) | null = null;

  constructor() {
    // Load saved settings
    this.loadSettings();

    this.container = document.createElement('div');
    this.container.id = 'settings-menu';
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-modal', 'true');
    this.container.setAttribute('aria-labelledby', 'settings-title');
    this.container.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;' +
      'display:none;flex-direction:column;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.85);font-family:"Segoe UI",system-ui,sans-serif;' +
      'color:#fff;z-index:95;';

    const panel = document.createElement('div');
    panel.style.cssText =
      'width:400px;max-height:80vh;overflow-y:auto;padding:30px;' +
      'background:rgba(40,50,60,0.95);border-radius:8px;border:1px solid rgba(255,255,255,0.15);';

    const title = document.createElement('h2');
    title.setAttribute('id', 'settings-title');
    title.style.cssText = 'font-size:24px;font-weight:bold;margin-bottom:24px;text-align:center;letter-spacing:2px;';
    title.textContent = 'SETTINGS';
    panel.appendChild(title);

    // Audio sliders
    this.addSlider(panel, 'Master Volume', this.masterVolume, (v) => { this.masterVolume = v; this.emit(); });
    this.addSlider(panel, 'SFX Volume', this.sfxVolume, (v) => { this.sfxVolume = v; this.emit(); });
    this.addSlider(panel, 'Music Volume', this.musicVolume, (v) => { this.musicVolume = v; this.emit(); });
    this.addSlider(panel, 'Sensitivity', this.sensitivity, (v) => { this.sensitivity = v; this.emit(); }, 0.1, 3);

    // Toggles
    this.addToggle(panel, 'Invert Y-Axis', this.invertY, (v) => { this.invertY = v; this.emit(); });
    this.addToggle(panel, 'Show Nameplates', this.showNames, (v) => { this.showNames = v; this.emit(); });

    // Quality
    this.addSelect(panel, 'Graphics Quality', ['low', 'medium', 'high'], this.graphicsQuality,
      (v) => { this.graphicsQuality = v as 'low' | 'medium' | 'high'; this.emit(); });

    // Controls button
    const controlsBtn = document.createElement('button');
    controlsBtn.style.cssText =
      'display:block;width:100%;padding:10px;margin-top:16px;' +
      'background:rgba(135,206,235,0.15);border:1px solid rgba(135,206,235,0.4);' +
      'color:#87ceeb;font-size:13px;font-weight:bold;cursor:pointer;border-radius:4px;pointer-events:auto;';
    controlsBtn.textContent = 'CONTROLS';
    controlsBtn.addEventListener('click', () => this.onControls?.());
    panel.appendChild(controlsBtn);

    // Replay Tutorial button
    const tutorialBtn = document.createElement('button');
    tutorialBtn.style.cssText =
      'display:block;width:100%;padding:10px;margin-top:16px;' +
      'background:rgba(68,255,170,0.15);border:1px solid rgba(68,255,170,0.4);' +
      'color:#44ffaa;font-size:13px;font-weight:bold;cursor:pointer;border-radius:4px;pointer-events:auto;';
    tutorialBtn.textContent = 'REPLAY TUTORIAL';
    tutorialBtn.addEventListener('click', () => {
      this.onReplayTutorial?.();
      this.onClose?.();
    });
    panel.appendChild(tutorialBtn);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText =
      'display:block;width:100%;padding:12px;margin-top:8px;' +
      'background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.3);' +
      'color:#fff;font-size:14px;font-weight:bold;cursor:pointer;border-radius:4px;pointer-events:auto;';
    closeBtn.textContent = 'CLOSE';
    closeBtn.addEventListener('click', () => this.onClose?.());
    panel.appendChild(closeBtn);

    this.container.appendChild(panel);
    document.body.appendChild(this.container);
  }

  private addSlider(parent: HTMLElement, label: string, value: number, onChange: (v: number) => void, min = 0, max = 1): void {
    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom:16px;';

    const labelId = `slider-${label.replace(/\s+/g, '-').toLowerCase()}`;
    const lbl = document.createElement('label');
    lbl.setAttribute('for', labelId);
    lbl.style.cssText = 'font-size:12px;color:#aaa;margin-bottom:4px;display:block;';
    lbl.textContent = label;
    row.appendChild(lbl);

    const input = document.createElement('input');
    input.id = labelId;
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = '0.05';
    input.value = String(value);
    input.setAttribute('aria-label', label);
    input.setAttribute('aria-valuemin', String(min));
    input.setAttribute('aria-valuemax', String(max));
    input.setAttribute('aria-valuenow', String(value));
    input.style.cssText = 'width:100%;pointer-events:auto;cursor:pointer;';
    input.addEventListener('input', () => {
      const val = parseFloat(input.value);
      input.setAttribute('aria-valuenow', String(val));
      onChange(val);
    });
    row.appendChild(input);

    parent.appendChild(row);
  }

  private addToggle(parent: HTMLElement, label: string, value: boolean, onChange: (v: boolean) => void): void {
    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;';

    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:13px;color:#ccc;';
    lbl.textContent = label;
    row.appendChild(lbl);

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = value;
    cb.style.cssText = 'pointer-events:auto;cursor:pointer;width:18px;height:18px;';
    cb.addEventListener('change', () => onChange(cb.checked));
    row.appendChild(cb);

    parent.appendChild(row);
  }

  private addSelect(parent: HTMLElement, label: string, options: string[], value: string, onChange: (v: string) => void): void {
    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom:16px;';

    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:12px;color:#aaa;margin-bottom:4px;';
    lbl.textContent = label;
    row.appendChild(lbl);

    const sel = document.createElement('select');
    sel.style.cssText =
      'width:100%;padding:6px;background:#333;color:#fff;border:1px solid #555;' +
      'border-radius:3px;pointer-events:auto;cursor:pointer;';
    for (const opt of options) {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
      if (opt === value) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => onChange(sel.value));
    row.appendChild(sel);

    parent.appendChild(row);
  }

  private emit(): void {
    this.saveSettings();
    this.onChanged?.(this);
  }

  private loadSettings(): void {
    try {
      const saved = localStorage.getItem('birdgame_settings');
      if (saved) {
        const settings = JSON.parse(saved);
        this.masterVolume = settings.masterVolume ?? 0.5;
        this.sfxVolume = settings.sfxVolume ?? 0.7;
        this.musicVolume = settings.musicVolume ?? 0.3;
        this.sensitivity = settings.sensitivity ?? 1.0;
        this.invertY = settings.invertY ?? false;
        this.showNames = settings.showNames ?? true;
        this.graphicsQuality = settings.graphicsQuality ?? 'high';
      }
    } catch (error) {
      console.warn('Failed to load settings:', error);
    }
  }

  private saveSettings(): void {
    try {
      const settings = {
        masterVolume: this.masterVolume,
        sfxVolume: this.sfxVolume,
        musicVolume: this.musicVolume,
        sensitivity: this.sensitivity,
        invertY: this.invertY,
        showNames: this.showNames,
        graphicsQuality: this.graphicsQuality,
      };
      localStorage.setItem('birdgame_settings', JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save settings:', error);
    }
  }

  setCallbacks(onClose: () => void, onChanged: (settings: SettingsMenu) => void, onReplayTutorial?: () => void, onControls?: () => void): void {
    this.onClose = onClose;
    this.onChanged = onChanged;
    this.onReplayTutorial = onReplayTutorial ?? null;
    this.onControls = onControls ?? null;
  }

  show(): void {
    this.visible = true;
    this.container.style.display = 'flex';
  }

  hide(): void {
    this.visible = false;
    this.container.style.display = 'none';
  }

  get isVisible(): boolean {
    return this.visible;
  }
}
