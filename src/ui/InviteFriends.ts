import { ReferralService } from '../sharing/ReferralService';

export class InviteFriends {
  private container: HTMLElement;
  private visible = false;
  private onClose: (() => void) | null = null;
  private gameUrl: string;
  private shareText: string;
  private linkInput: HTMLInputElement;
  private referralService: ReferralService;

  constructor(referralService: ReferralService) {
    this.referralService = referralService;
    this.gameUrl = referralService.getShareUrl();
    this.shareText = 'Check out Bird Game 3D - the funniest browser game! Poop on everything!';

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
      max-width: 560px;
      width: 90%;
      max-height: 85vh;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    `;

    // Title
    const title = document.createElement('div');
    title.style.cssText = `
      font-size: 28px;
      font-weight: bold;
      color: #fff;
      text-align: center;
      margin-bottom: 6px;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    `;
    title.textContent = 'SHARE THE GAME';
    panel.appendChild(title);

    // Subtitle
    const subtitle = document.createElement('div');
    subtitle.style.cssText = `
      text-align: center;
      color: rgba(255, 255, 255, 0.6);
      margin-bottom: 20px;
      font-size: 14px;
    `;
    subtitle.textContent = 'Spread the word and get your friends playing!';
    panel.appendChild(subtitle);

    // Referral stats (if any)
    const refCount = referralService.getReferralCount();
    if (refCount > 0) {
      const referralStats = document.createElement('div');
      referralStats.style.cssText = `
        text-align: center;
        color: #44ffaa;
        font-size: 16px;
        font-weight: bold;
        margin-bottom: 16px;
        padding: 10px;
        background: rgba(68, 255, 170, 0.08);
        border: 1px solid rgba(68, 255, 170, 0.3);
        border-radius: 8px;
        text-shadow: 0 0 10px rgba(68, 255, 170, 0.3);
      `;
      referralStats.textContent = `${refCount} friend${refCount !== 1 ? 's' : ''} joined from your link!`;
      panel.appendChild(referralStats);
    }

    // Share link section
    const linkSection = document.createElement('div');
    linkSection.style.cssText = `
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 16px;
    `;

    const linkLabel = document.createElement('div');
    linkLabel.style.cssText = `
      color: rgba(255, 255, 255, 0.7);
      font-size: 12px;
      margin-bottom: 8px;
      font-weight: bold;
    `;
    linkLabel.textContent = 'YOUR SHARE LINK';
    linkSection.appendChild(linkLabel);

    const linkContainer = document.createElement('div');
    linkContainer.style.cssText = 'display: flex; gap: 8px;';

    this.linkInput = document.createElement('input');
    this.linkInput.type = 'text';
    this.linkInput.readOnly = true;
    this.linkInput.value = this.gameUrl;
    this.linkInput.style.cssText = `
      flex: 1;
      padding: 10px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 4px;
      color: #fff;
      font-size: 13px;
      font-family: monospace;
    `;
    linkContainer.appendChild(this.linkInput);

    const copyBtn = document.createElement('button');
    copyBtn.style.cssText = `
      padding: 10px 20px;
      background: rgba(255, 215, 0, 0.15);
      border: 1px solid rgba(255, 215, 0, 0.5);
      border-radius: 4px;
      color: #FFD700;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
    `;
    copyBtn.textContent = 'COPY';
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(this.gameUrl);
        copyBtn.textContent = 'COPIED!';
        copyBtn.style.background = 'rgba(50, 200, 100, 0.3)';
        copyBtn.style.borderColor = 'rgba(50, 200, 100, 0.5)';
        copyBtn.style.color = '#44ff88';
        setTimeout(() => {
          copyBtn.textContent = 'COPY';
          copyBtn.style.background = 'rgba(255, 215, 0, 0.15)';
          copyBtn.style.borderColor = 'rgba(255, 215, 0, 0.5)';
          copyBtn.style.color = '#FFD700';
        }, 2000);
      } catch {
        this.linkInput.select();
        document.execCommand('copy');
        copyBtn.textContent = 'COPIED!';
        setTimeout(() => { copyBtn.textContent = 'COPY'; }, 2000);
      }
    });
    copyBtn.addEventListener('mouseenter', () => {
      if (copyBtn.textContent === 'COPY') {
        copyBtn.style.background = 'rgba(255, 215, 0, 0.3)';
      }
    });
    copyBtn.addEventListener('mouseleave', () => {
      if (copyBtn.textContent === 'COPY') {
        copyBtn.style.background = 'rgba(255, 215, 0, 0.15)';
      }
    });
    linkContainer.appendChild(copyBtn);

    linkSection.appendChild(linkContainer);
    panel.appendChild(linkSection);

    // Social media buttons - 3 column grid
    const socialLabel = document.createElement('div');
    socialLabel.style.cssText = `
      color: rgba(255, 255, 255, 0.7);
      font-size: 12px;
      margin-bottom: 10px;
      font-weight: bold;
    `;
    socialLabel.textContent = 'SHARE ON SOCIAL MEDIA';
    panel.appendChild(socialLabel);

    const socialButtons = document.createElement('div');
    socialButtons.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
      margin-bottom: 16px;
    `;

    socialButtons.appendChild(this.createSocialButton('Twitter / X', '#1DA1F2', () => this.shareToTwitter()));
    socialButtons.appendChild(this.createSocialButton('Facebook', '#4267B2', () => this.shareToFacebook()));
    socialButtons.appendChild(this.createSocialButton('WhatsApp', '#25D366', () => this.shareToWhatsApp()));
    socialButtons.appendChild(this.createSocialButton('Reddit', '#FF4500', () => this.shareToReddit()));
    socialButtons.appendChild(this.createSocialButton('Discord', '#5865F2', () => this.copyForDiscord()));
    socialButtons.appendChild(this.createSocialButton('Text / SMS', '#7B68EE', () => this.shareViaSMS()));

    panel.appendChild(socialButtons);

    // Web Share API button (if supported)
    if ('share' in navigator && typeof navigator.share === 'function') {
      const webShareBtn = document.createElement('button');
      webShareBtn.style.cssText = `
        width: 100%;
        padding: 12px;
        background: rgba(135, 206, 235, 0.15);
        border: 2px solid rgba(135, 206, 235, 0.4);
        border-radius: 6px;
        color: #87ceeb;
        font-size: 15px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
        margin-bottom: 16px;
      `;
      webShareBtn.textContent = 'MORE SHARING OPTIONS...';
      webShareBtn.addEventListener('click', () => this.shareNative());
      webShareBtn.addEventListener('mouseenter', () => {
        webShareBtn.style.background = 'rgba(135, 206, 235, 0.25)';
        webShareBtn.style.transform = 'scale(1.02)';
      });
      webShareBtn.addEventListener('mouseleave', () => {
        webShareBtn.style.background = 'rgba(135, 206, 235, 0.15)';
        webShareBtn.style.transform = 'scale(1)';
      });
      panel.appendChild(webShareBtn);
    }

    // QR Code section
    const qrSection = document.createElement('div');
    qrSection.style.cssText = `
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 16px;
      text-align: center;
    `;

    const qrLabel = document.createElement('div');
    qrLabel.style.cssText = `
      color: rgba(255, 255, 255, 0.7);
      font-size: 12px;
      margin-bottom: 10px;
      font-weight: bold;
    `;
    qrLabel.textContent = 'SCAN TO PLAY ON MOBILE';
    qrSection.appendChild(qrLabel);

    const qrImg = document.createElement('img');
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(this.gameUrl)}&bgcolor=1a2a3a&color=ffffff`;
    qrImg.alt = 'QR Code - Scan to play';
    qrImg.style.cssText = `
      width: 150px;
      height: 150px;
      border-radius: 8px;
      border: 2px solid rgba(255, 255, 255, 0.2);
    `;
    qrSection.appendChild(qrImg);
    panel.appendChild(qrSection);

    // Embed code section
    const embedSection = document.createElement('div');
    embedSection.style.cssText = `
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 20px;
    `;

    const embedLabel = document.createElement('div');
    embedLabel.style.cssText = `
      color: rgba(255, 255, 255, 0.7);
      font-size: 12px;
      margin-bottom: 8px;
      font-weight: bold;
    `;
    embedLabel.textContent = 'EMBED ON YOUR WEBSITE';
    embedSection.appendChild(embedLabel);

    const embedContainer = document.createElement('div');
    embedContainer.style.cssText = 'display: flex; gap: 8px;';

    const embedInput = document.createElement('input');
    embedInput.type = 'text';
    embedInput.readOnly = true;
    const baseOrigin = window.location.origin;
    embedInput.value = `<iframe src="${baseOrigin}" width="800" height="600" frameborder="0" allow="fullscreen; pointer-lock"></iframe>`;
    embedInput.style.cssText = `
      flex: 1;
      padding: 10px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 4px;
      color: rgba(255, 255, 255, 0.7);
      font-size: 11px;
      font-family: monospace;
    `;
    embedContainer.appendChild(embedInput);

    const embedCopyBtn = document.createElement('button');
    embedCopyBtn.style.cssText = `
      padding: 10px 16px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 4px;
      color: #fff;
      font-size: 13px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    `;
    embedCopyBtn.textContent = 'COPY';
    embedCopyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(embedInput.value);
        embedCopyBtn.textContent = 'COPIED!';
        embedCopyBtn.style.background = 'rgba(50, 200, 100, 0.3)';
        setTimeout(() => {
          embedCopyBtn.textContent = 'COPY';
          embedCopyBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        }, 2000);
      } catch {
        embedInput.select();
        document.execCommand('copy');
        embedCopyBtn.textContent = 'COPIED!';
        setTimeout(() => { embedCopyBtn.textContent = 'COPY'; }, 2000);
      }
    });
    embedCopyBtn.addEventListener('mouseenter', () => {
      if (embedCopyBtn.textContent === 'COPY') {
        embedCopyBtn.style.background = 'rgba(255, 255, 255, 0.2)';
      }
    });
    embedCopyBtn.addEventListener('mouseleave', () => {
      if (embedCopyBtn.textContent === 'COPY') {
        embedCopyBtn.style.background = 'rgba(255, 255, 255, 0.1)';
      }
    });
    embedContainer.appendChild(embedCopyBtn);

    embedSection.appendChild(embedContainer);
    panel.appendChild(embedSection);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `
      display: block;
      width: 100%;
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

  private createSocialButton(label: string, color: string, action: () => void): HTMLElement {
    const btn = document.createElement('button');
    btn.style.cssText = `
      padding: 10px 4px;
      background: rgba(255, 255, 255, 0.05);
      border: 2px solid ${color};
      border-radius: 6px;
      color: #fff;
      font-size: 13px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
    `;
    btn.textContent = label;
    btn.addEventListener('click', action);
    btn.addEventListener('mouseenter', () => {
      btn.style.background = color + '40';
      btn.style.transform = 'scale(1.05)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(255, 255, 255, 0.05)';
      btn.style.transform = 'scale(1)';
    });
    return btn;
  }

  private shareToTwitter(): void {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(this.shareText)}&url=${encodeURIComponent(this.gameUrl)}`;
    window.open(url, '_blank', 'width=550,height=420');
  }

  private shareToFacebook(): void {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(this.gameUrl)}`;
    window.open(url, '_blank', 'width=550,height=420');
  }

  private shareToWhatsApp(): void {
    const text = `${this.shareText} ${this.gameUrl}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }

  private shareToReddit(): void {
    const url = `https://www.reddit.com/submit?url=${encodeURIComponent(this.gameUrl)}&title=${encodeURIComponent(this.shareText)}`;
    window.open(url, '_blank', 'width=800,height=600');
  }

  private copyForDiscord(): void {
    const text = `${this.shareText}\n${this.gameUrl}`;
    navigator.clipboard.writeText(text).then(() => {
      // Brief visual feedback - find the Discord button
      const buttons = this.container.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent === 'Discord') {
          const original = btn.textContent;
          btn.textContent = 'Copied!';
          btn.style.background = 'rgba(50, 200, 100, 0.3)';
          setTimeout(() => {
            btn.textContent = original;
            btn.style.background = 'rgba(255, 255, 255, 0.05)';
          }, 2000);
          break;
        }
      }
    }).catch(() => {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    });
  }

  private shareViaSMS(): void {
    const text = `${this.shareText} ${this.gameUrl}`;
    const separator = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?';
    const url = `sms:${separator}body=${encodeURIComponent(text)}`;
    window.location.href = url;
  }

  private async shareNative(): Promise<void> {
    if ('share' in navigator && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Bird Game 3D',
          text: this.shareText,
          url: this.gameUrl,
        });
      } catch {
        // User cancelled or error
      }
    }
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

  setShareData(text: string, url?: string): void {
    this.shareText = text;
    if (url) {
      this.gameUrl = url;
    }
    if (this.linkInput) {
      this.linkInput.value = this.gameUrl;
    }
  }
}
