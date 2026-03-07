/**
 * Global Chat UI
 * Semi-transparent chat overlay with message history and virtual keyboard input.
 * Press Enter to open, Enter to send, Escape to close.
 * Game keeps running while chat is open - no pointer lock release, no game pause.
 */

interface ChatMessageEntry {
  username: string;
  message: string;
  timestamp: number;
  color: string;
}

const MAX_MESSAGES = 50;
const MESSAGE_FADE_TIME = 12000; // ms before messages start fading
const MESSAGE_GONE_TIME = 18000; // ms before messages fully disappear

export class ChatUI {
  private container: HTMLDivElement;
  private messagesDiv: HTMLDivElement;
  private inputDisplay: HTMLDivElement;
  private messages: ChatMessageEntry[] = [];
  private isOpen = false;
  private onSend: ((message: string) => void) | null = null;
  private fadeIntervalId: ReturnType<typeof setInterval> | null = null;
  private readonly keydownHandler: (e: KeyboardEvent) => void;

  // Virtual keyboard state
  private chatText = '';
  private cursorVisible = true;
  private cursorIntervalId: ReturnType<typeof setInterval> | null = null;

  // Rate limiting
  private lastSendTime = 0;
  private sendCooldown = 1000; // 1 second between messages

  constructor() {
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (this.isOpen) {
        e.stopPropagation();
        e.preventDefault();

        if (e.key === 'Enter') {
          this.sendMessage();
        } else if (e.key === 'Escape') {
          this.close();
        } else if (e.key === 'Backspace') {
          this.chatText = this.chatText.slice(0, -1);
          this.updateInputDisplay();
        } else if (e.key.length === 1 && this.chatText.length < 150) {
          this.chatText += e.key;
          this.updateInputDisplay();
        }
      } else if (e.key === 'Enter' && document.pointerLockElement) {
        e.preventDefault();
        e.stopPropagation();
        this.open();
      }
    };

    this.container = document.createElement('div');
    this.container.id = 'chat-ui';
    Object.assign(this.container.style, {
      position: 'fixed',
      bottom: '20px',
      left: '20px',
      width: '380px',
      maxHeight: '300px',
      zIndex: '8000',
      pointerEvents: 'none',
      fontFamily: "'Segoe UI', Arial, sans-serif",
      fontSize: '13px',
    });

    this.messagesDiv = document.createElement('div');
    Object.assign(this.messagesDiv.style, {
      maxHeight: '220px',
      overflowY: 'auto',
      overflowX: 'hidden',
      padding: '6px 10px',
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(255,255,255,0.2) transparent',
    });
    this.container.appendChild(this.messagesDiv);

    this.inputDisplay = document.createElement('div');
    Object.assign(this.inputDisplay.style, {
      display: 'none',
      background: 'rgba(0, 0, 0, 0.75)',
      borderRadius: '6px',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      padding: '6px 10px',
      marginTop: '4px',
      color: '#fff',
      fontSize: '13px',
      minHeight: '30px',
      wordBreak: 'break-word',
    });
    this.container.appendChild(this.inputDisplay);

    document.body.appendChild(this.container);
    document.addEventListener('keydown', this.keydownHandler);
    this.startFadeLoop();
  }

  /** Set the callback for when a message is sent */
  setOnSend(callback: (message: string) => void): void {
    this.onSend = callback;
  }

  /** Add an incoming chat message */
  addMessage(username: string, message: string, isSystem = false): void {
    const color = isSystem ? '#b9d8ff' : this.getUserColor(username);

    this.messages.push({
      username,
      message,
      timestamp: Date.now(),
      color,
    });

    if (this.messages.length > MAX_MESSAGES) {
      this.messages.shift();
    }

    this.renderMessages();
    this.scrollToBottom();
  }

  /** Open the chat input - pointer lock is NOT released, game keeps running */
  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.chatText = '';
    this.cursorVisible = true;

    this.inputDisplay.style.display = 'block';

    this.cursorIntervalId = setInterval(() => {
      this.cursorVisible = !this.cursorVisible;
      this.updateInputDisplay();
    }, 500);

    this.renderMessages();
    this.updateInputDisplay();
  }

  /** Close the chat input */
  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.chatText = '';

    this.inputDisplay.style.display = 'none';

    if (this.cursorIntervalId !== null) {
      clearInterval(this.cursorIntervalId);
      this.cursorIntervalId = null;
    }
  }

  /** Check if chat is currently active (consuming input) */
  isActive(): boolean {
    return this.isOpen;
  }

  private sendMessage(): void {
    const text = this.chatText.trim();
    if (!text) {
      this.close();
      return;
    }

    const now = Date.now();
    if (now - this.lastSendTime < this.sendCooldown) {
      return;
    }
    this.lastSendTime = now;

    this.onSend?.(text);
    this.close();
  }

  private updateInputDisplay(): void {
    const cursor = this.cursorVisible ? '|' : ' ';
    if (this.chatText.length === 0) {
      this.inputDisplay.innerHTML =
        `<span style="color:rgba(255,255,255,0.4)">Chat with the flock... (/chirp /flap /spin /salute /help)</span><span style="color:#fff">${cursor}</span>`;
    } else {
      const safe = this.escapeHtml(this.chatText);
      this.inputDisplay.innerHTML = `<span style="color:#fff">${safe}${cursor}</span>`;
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private renderMessages(): void {
    const now = Date.now();
    this.messagesDiv.innerHTML = '';

    for (const msg of this.messages) {
      const age = now - msg.timestamp;
      let opacity = 1;

      if (!this.isOpen) {
        if (age > MESSAGE_GONE_TIME) {
          continue;
        }
        if (age > MESSAGE_FADE_TIME) {
          opacity = 1 - (age - MESSAGE_FADE_TIME) / (MESSAGE_GONE_TIME - MESSAGE_FADE_TIME);
        }
      }

      const line = document.createElement('div');
      Object.assign(line.style, {
        padding: '2px 0',
        opacity: String(opacity),
        textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
        lineHeight: '1.4',
        wordBreak: 'break-word',
      });

      const nameSpan = document.createElement('span');
      nameSpan.style.color = msg.color;
      nameSpan.style.fontWeight = 'bold';
      nameSpan.textContent = msg.username;

      const msgSpan = document.createElement('span');
      msgSpan.style.color = '#eee';
      msgSpan.textContent = `: ${msg.message}`;

      line.appendChild(nameSpan);
      line.appendChild(msgSpan);
      this.messagesDiv.appendChild(line);
    }
  }

  private scrollToBottom(): void {
    this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
  }

  private getUserColor(username: string): string {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = ((hash << 5) - hash) + username.charCodeAt(i);
      hash |= 0;
    }

    const colors = [
      '#5cf', '#fc5', '#5f8', '#f8c', '#c8f',
      '#8fc', '#ff7', '#7ff', '#f77', '#7f7',
      '#fa5', '#5fa', '#a5f', '#ff5a5a', '#5afffa',
    ];
    return colors[Math.abs(hash) % colors.length];
  }

  private startFadeLoop(): void {
    this.fadeIntervalId = setInterval(() => {
      if (!this.isOpen && this.messages.length > 0) {
        this.renderMessages();
      }
    }, 1000);
  }

  /** Destroy the chat UI */
  destroy(): void {
    if (this.cursorIntervalId !== null) {
      clearInterval(this.cursorIntervalId);
      this.cursorIntervalId = null;
    }
    if (this.fadeIntervalId !== null) {
      clearInterval(this.fadeIntervalId);
      this.fadeIntervalId = null;
    }
    document.removeEventListener('keydown', this.keydownHandler);
    this.container.remove();
  }
}
