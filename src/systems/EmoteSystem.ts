import * as THREE from 'three';

export type EmoteType = 'squawk' | 'flap' | 'spin' | 'salute';

export const EMOTE_LABELS: Record<EmoteType, string> = {
  squawk: 'SQUAWK!',
  flap: '*flap flap*',
  spin: '*victory spin*',
  salute: 'o7',
};

const EMOTE_CHAT_LINES: Record<EmoteType, string> = {
  squawk: "lets out a bright squawk",
  flap: 'does a happy flap',
  spin: 'twirls through the breeze',
  salute: 'gives a tidy wing salute',
};

export function getEmoteLabel(type: EmoteType): string {
  return EMOTE_LABELS[type];
}

export function getEmoteChatLine(type: EmoteType): string {
  return EMOTE_CHAT_LINES[type];
}

export function getEmoteFromCommand(command: string): EmoteType | null {
  switch (command) {
    case '/chirp':
    case '/squawk':
      return 'squawk';
    case '/flap':
      return 'flap';
    case '/spin':
    case '/dance':
      return 'spin';
    case '/salute':
    case '/wave':
      return 'salute';
    default:
      return null;
  }
}

export class EmoteSystem {
  private container: HTMLElement;
  private activeEmote: EmoteType | null = null;
  private emoteTimer = 0;
  private emoteElement: HTMLElement | null = null;

  constructor() {
    this.container = document.getElementById('hud')!;
  }

  triggerEmote(type: EmoteType): void {
    if (this.activeEmote) return; // one at a time

    this.activeEmote = type;
    this.emoteTimer = 1.5;

    this.emoteElement = document.createElement('div');
    this.emoteElement.style.cssText =
      'position:absolute;top:70%;left:50%;transform:translate(-50%,-50%);' +
      'font-size:24px;font-weight:bold;color:#ffdd44;' +
      'text-shadow:2px 2px 4px rgba(0,0,0,0.8);pointer-events:none;' +
      'animation:emote-pop 0.3s ease-out;';
    this.emoteElement.textContent = EMOTE_LABELS[type];
    this.container.appendChild(this.emoteElement);
  }

  getEmoteFromKey(key: number): EmoteType | null {
    switch (key) {
      case 1: return 'squawk';
      case 2: return 'flap';
      case 3: return 'spin';
      case 4: return 'salute';
      default: return null;
    }
  }

  update(dt: number): void {
    if (this.activeEmote) {
      this.emoteTimer -= dt;
      if (this.emoteTimer <= 0) {
        this.activeEmote = null;
        if (this.emoteElement) {
          this.emoteElement.remove();
          this.emoteElement = null;
        }
      }
    }
  }

  get currentEmote(): EmoteType | null {
    return this.activeEmote;
  }
}
