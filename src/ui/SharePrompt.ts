import { generateShareText, ShareContext } from '../sharing/ShareMessages';

export class SharePrompt {
  private container: HTMLElement;
  private msgEl: HTMLElement;
  private visible = false;
  private lastShownAt = 0;
  private readonly COOLDOWN_MS = 120_000; // 2 minutes between prompts
  private autoDismissTimer: number | null = null;
  private onShare: ((text: string) => void) | null = null;

  constructor() {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%) translateY(200px);
      background: linear-gradient(135deg, #1a2a3a 0%, #2a4a6a 100%);
      border: 2px solid rgba(255, 215, 0, 0.6);
      border-radius: 12px;
      padding: 16px 24px;
      z-index: 3000;
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: #fff;
      display: none;
      align-items: center;
      gap: 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), 0 0 30px rgba(255, 215, 0, 0.1);
      transition: transform 0.4s ease-out, opacity 0.4s ease-out;
      opacity: 0;
      max-width: 500px;
      pointer-events: auto;
    `;

    this.msgEl = document.createElement('div');
    this.msgEl.style.cssText = 'flex: 1; font-size: 14px; font-weight: bold;';
    this.container.appendChild(this.msgEl);

    const shareBtn = document.createElement('button');
    shareBtn.textContent = 'SHARE';
    shareBtn.style.cssText = `
      padding: 8px 20px;
      background: rgba(255, 215, 0, 0.2);
      border: 2px solid rgba(255, 215, 0, 0.5);
      border-radius: 6px;
      color: #FFD700;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
    `;
    shareBtn.addEventListener('mouseenter', () => {
      shareBtn.style.background = 'rgba(255, 215, 0, 0.35)';
      shareBtn.style.transform = 'scale(1.05)';
    });
    shareBtn.addEventListener('mouseleave', () => {
      shareBtn.style.background = 'rgba(255, 215, 0, 0.2)';
      shareBtn.style.transform = 'scale(1)';
    });
    shareBtn.addEventListener('click', () => {
      this.onShare?.(this.msgEl.textContent || '');
      this.dismiss();
    });
    this.container.appendChild(shareBtn);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u00d7';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.5);
      font-size: 24px;
      cursor: pointer;
      padding: 0 4px;
      transition: color 0.2s;
    `;
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.color = '#fff';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.color = 'rgba(255, 255, 255, 0.5)';
    });
    closeBtn.addEventListener('click', () => this.dismiss());
    this.container.appendChild(closeBtn);

    document.body.appendChild(this.container);
  }

  setOnShare(callback: (text: string) => void): void {
    this.onShare = callback;
  }

  prompt(context: ShareContext): void {
    const now = Date.now();
    if (now - this.lastShownAt < this.COOLDOWN_MS) return;

    const text = generateShareText(context);
    this.msgEl.textContent = text;

    this.lastShownAt = now;
    this.show();

    if (this.autoDismissTimer) clearTimeout(this.autoDismissTimer);
    this.autoDismissTimer = window.setTimeout(() => this.dismiss(), 6000);
  }

  private show(): void {
    this.visible = true;
    this.container.style.display = 'flex';
    requestAnimationFrame(() => {
      this.container.style.transform = 'translateX(-50%) translateY(0)';
      this.container.style.opacity = '1';
    });
  }

  private dismiss(): void {
    this.container.style.transform = 'translateX(-50%) translateY(200px)';
    this.container.style.opacity = '0';
    setTimeout(() => {
      this.container.style.display = 'none';
      this.visible = false;
    }, 400);
    if (this.autoDismissTimer) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = null;
    }
  }

  get isVisible(): boolean {
    return this.visible;
  }
}
