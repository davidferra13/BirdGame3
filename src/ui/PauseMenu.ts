import { FocusTrap } from '../utils/AccessibilityHelper';

export class PauseMenu {
  private container: HTMLElement;
  private visible = false;
  private onResume: (() => void) | null = null;
  private onShop: (() => void) | null = null;
  private onSettings: (() => void) | null = null;
  private onMurmuration: (() => void) | null = null;
  private onQuit: (() => void) | null = null;
  private focusTrap: FocusTrap | null = null;
  private buttons: HTMLButtonElement[] = [];
  private exitFsBtn: HTMLButtonElement | null = null;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'pause-menu';
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-modal', 'true');
    this.container.setAttribute('aria-labelledby', 'pause-title');
    this.container.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;' +
      'display:none;flex-direction:column;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.7);font-family:"Segoe UI",system-ui,sans-serif;' +
      'color:#fff;z-index:90;';

    const title = document.createElement('h2');
    title.id = 'pause-title';
    title.style.cssText = 'font-size:36px;font-weight:bold;margin-bottom:40px;letter-spacing:4px;';
    title.textContent = 'PAUSED';
    this.container.appendChild(title);

    const buttonConfigs = [
      { label: 'RESUME', ariaLabel: 'Resume game', action: () => this.onResume?.() },
      { label: '🛍️ SHOP', ariaLabel: 'Open cosmetics shop', action: () => this.onShop?.() },
      { label: 'MURMURATION', ariaLabel: 'Open Murmuration panel', action: () => this.onMurmuration?.() },
      { label: 'SETTINGS', ariaLabel: 'Open settings menu', action: () => this.onSettings?.() },
      { label: 'LEAVE WORLD', ariaLabel: 'Return to main menu', action: () => this.onQuit?.() },
    ];

    // Exit fullscreen button (only visible when in fullscreen)
    this.exitFsBtn = document.createElement('button');
    this.exitFsBtn.setAttribute('aria-label', 'Exit fullscreen mode');
    this.exitFsBtn.setAttribute('type', 'button');
    this.exitFsBtn.style.cssText =
      'display:none;width:220px;padding:12px 0;margin:5px 0;' +
      'background:rgba(255,100,100,0.15);border:1px solid rgba(255,100,100,0.4);' +
      'color:#ff8888;font-size:14px;font-weight:bold;letter-spacing:2px;' +
      'cursor:pointer;border-radius:4px;pointer-events:auto;transition:background 0.2s;';
    this.exitFsBtn.textContent = 'EXIT FULLSCREEN';
    this.exitFsBtn.addEventListener('mouseenter', () => { this.exitFsBtn!.style.background = 'rgba(255,100,100,0.3)'; });
    this.exitFsBtn.addEventListener('mouseleave', () => { this.exitFsBtn!.style.background = 'rgba(255,100,100,0.15)'; });
    this.exitFsBtn.addEventListener('click', () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    });
    this.exitFsBtn.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      }
    });

    for (const btn of buttonConfigs) {
      const el = document.createElement('button');
      el.setAttribute('aria-label', btn.ariaLabel);
      el.setAttribute('type', 'button');
      el.style.cssText =
        'display:block;width:220px;padding:12px 0;margin:5px 0;' +
        'background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.3);' +
        'color:#fff;font-size:16px;font-weight:bold;letter-spacing:2px;' +
        'cursor:pointer;border-radius:4px;pointer-events:auto;transition:background 0.2s;';
      el.textContent = btn.label;
      el.addEventListener('mouseenter', () => { el.style.background = 'rgba(255,255,255,0.25)'; });
      el.addEventListener('mouseleave', () => { el.style.background = 'rgba(255,255,255,0.1)'; });
      el.addEventListener('click', btn.action);

      // Keyboard accessibility
      el.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          btn.action();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.onResume?.();
        }
      });

      this.buttons.push(el);
      this.container.appendChild(el);
    }

    // Add exit fullscreen button after the main buttons
    if (this.exitFsBtn) {
      this.container.appendChild(this.exitFsBtn);
    }

    document.body.appendChild(this.container);
    this.focusTrap = new FocusTrap(this.container);
  }

  setCallbacks(onResume: () => void, onShop: () => void, onSettings: () => void, onQuit: () => void, onMurmuration?: () => void): void {
    this.onResume = onResume;
    this.onShop = onShop;
    this.onSettings = onSettings;
    this.onQuit = onQuit;
    this.onMurmuration = onMurmuration ?? null;
  }

  show(): void {
    this.visible = true;
    this.container.style.display = 'flex';
    if (document.pointerLockElement) document.exitPointerLock();

    // Show/hide exit fullscreen button based on current state
    if (this.exitFsBtn) {
      this.exitFsBtn.style.display = document.fullscreenElement ? 'block' : 'none';
    }

    // Activate focus trap and focus first button
    if (this.focusTrap) {
      this.focusTrap.activate();
    }
  }

  hide(): void {
    this.visible = false;
    this.container.style.display = 'none';

    // Deactivate focus trap
    if (this.focusTrap) {
      this.focusTrap.deactivate();
    }
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  get isVisible(): boolean {
    return this.visible;
  }
}
