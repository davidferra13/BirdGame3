export class CreditsPanel {
  private container: HTMLElement;
  private visible = false;
  private onClose: (() => void) | null = null;

  constructor() {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.8);
      z-index: 2000;
      font-family: 'Segoe UI', system-ui, sans-serif;
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
      background: linear-gradient(180deg, #1a2a3a 0%, #2a4a6a 100%);
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 12px;
      padding: 30px;
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    `;

    // Title
    const title = document.createElement('div');
    title.style.cssText = `
      font-size: 32px;
      font-weight: bold;
      color: #fff;
      text-align: center;
      margin-bottom: 10px;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    `;
    title.textContent = 'CREDITS';
    panel.appendChild(title);

    // Subtitle
    const subtitle = document.createElement('div');
    subtitle.style.cssText = `
      text-align: center;
      color: rgba(255, 255, 255, 0.6);
      margin-bottom: 30px;
      font-size: 14px;
    `;
    subtitle.textContent = 'Bird Game 3D - Poop on everything';
    panel.appendChild(subtitle);

    // Credits content
    const content = document.createElement('div');
    content.style.cssText = `
      color: #fff;
      line-height: 1.8;
    `;

    content.innerHTML = `
      <div style="margin-bottom: 24px;">
        <div style="font-size: 18px; font-weight: bold; color: #87ceeb; margin-bottom: 8px;">Game Development</div>
        <div style="color: rgba(255,255,255,0.8);">
          Created by David
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <div style="font-size: 18px; font-weight: bold; color: #87ceeb; margin-bottom: 8px;">Built With</div>
        <div style="color: rgba(255,255,255,0.8);">
          Three.js - 3D Graphics Engine<br>
          TypeScript - Programming Language<br>
          Vite - Build Tool &amp; Dev Server<br>
          Supabase - Backend &amp; Database<br>
          Claude AI - Development Assistant
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <div style="font-size: 18px; font-weight: bold; color: #87ceeb; margin-bottom: 8px;">Special Thanks</div>
        <div style="color: rgba(255,255,255,0.8);">
          All playtesters &amp; friends<br>
          The open-source community<br>
          You, for playing!
        </div>
      </div>

      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.2);">
        <div style="color: rgba(255,255,255,0.5); font-size: 12px;">
          &copy; 2026 Bird Game 3D. All rights reserved.<br>
          Made with love and poop
        </div>
      </div>
    `;
    panel.appendChild(content);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `
      display: block;
      width: 100%;
      margin-top: 20px;
      padding: 12px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 6px;
      color: #fff;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
    `;
    closeBtn.textContent = 'CLOSE';
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
      closeBtn.style.transform = 'scale(1.02)';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
      closeBtn.style.transform = 'scale(1)';
    });
    closeBtn.addEventListener('click', () => {
      this.hide();
      this.onClose?.();
    });
    panel.appendChild(closeBtn);

    this.container.appendChild(panel);
    document.body.appendChild(this.container);
  }

  show(): void {
    this.visible = true;
    this.container.style.display = 'flex';
  }

  hide(): void {
    this.visible = false;
    this.container.style.display = 'none';
  }

  setOnClose(callback: () => void): void {
    this.onClose = callback;
  }

  get isVisible(): boolean {
    return this.visible;
  }
}
