const FS_DISMISSED_KEY = 'birdgame_fs_dismissed';

export class FullscreenPrompt {
  private container: HTMLElement;

  constructor() {
    this.container = document.createElement('div');

    // Don't show if already dismissed, already fullscreen, or inside an iframe
    // (game platforms manage their own fullscreen experience)
    const isInIframe = window.self !== window.top;
    if (localStorage.getItem(FS_DISMISSED_KEY) || document.fullscreenElement || isInIframe) {
      return;
    }

    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.85);
      z-index: 5000;
      font-family: 'Segoe UI', system-ui, sans-serif;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      background: linear-gradient(180deg, #1a2a3a 0%, #2a4a6a 100%);
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 12px;
      padding: 40px;
      text-align: center;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    `;

    const icon = document.createElement('div');
    icon.style.cssText = 'font-size: 48px; margin-bottom: 8px;';
    icon.textContent = '\uD83D\uDDA5\uFE0F';
    card.appendChild(icon);

    const title = document.createElement('div');
    title.style.cssText = `
      color: #fff;
      font-size: 24px;
      font-weight: bold;
      margin: 12px 0 8px;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    `;
    title.textContent = 'PLAY IN FULLSCREEN';
    card.appendChild(title);

    const desc = document.createElement('div');
    desc.style.cssText = `
      color: rgba(255, 255, 255, 0.7);
      font-size: 14px;
      margin-bottom: 24px;
      line-height: 1.5;
    `;
    desc.textContent = 'For the best experience, play Bird Game 3D in fullscreen mode.';
    card.appendChild(desc);

    const goFullscreen = document.createElement('button');
    goFullscreen.style.cssText = `
      width: 100%;
      padding: 14px;
      background: rgba(135, 206, 235, 0.3);
      border: 2px solid rgba(135, 206, 235, 0.5);
      border-radius: 6px;
      color: #fff;
      font-size: 18px;
      font-weight: bold;
      cursor: pointer;
      margin-bottom: 12px;
      transition: all 0.2s;
    `;
    goFullscreen.textContent = 'GO FULLSCREEN';
    goFullscreen.addEventListener('mouseenter', () => {
      goFullscreen.style.background = 'rgba(135, 206, 235, 0.45)';
      goFullscreen.style.transform = 'scale(1.02)';
    });
    goFullscreen.addEventListener('mouseleave', () => {
      goFullscreen.style.background = 'rgba(135, 206, 235, 0.3)';
      goFullscreen.style.transform = 'scale(1)';
    });
    goFullscreen.addEventListener('click', () => {
      document.documentElement.requestFullscreen().catch(() => {});
      this.dismiss();
    });
    card.appendChild(goFullscreen);

    const skip = document.createElement('button');
    skip.style.cssText = `
      width: 100%;
      padding: 10px;
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      color: rgba(255, 255, 255, 0.5);
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    `;
    skip.textContent = 'No thanks';
    skip.addEventListener('mouseenter', () => {
      skip.style.color = 'rgba(255, 255, 255, 0.8)';
      skip.style.borderColor = 'rgba(255, 255, 255, 0.4)';
    });
    skip.addEventListener('mouseleave', () => {
      skip.style.color = 'rgba(255, 255, 255, 0.5)';
      skip.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    });
    skip.addEventListener('click', () => this.dismiss());
    card.appendChild(skip);

    this.container.appendChild(card);
    document.body.appendChild(this.container);
  }

  private dismiss(): void {
    localStorage.setItem(FS_DISMISSED_KEY, '1');
    this.container.style.display = 'none';
    this.container.remove();
  }
}
