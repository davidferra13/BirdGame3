/**
 * Global Chat UI
 * Semi-transparent chat overlay with message history and text input.
 * Press Enter to open, Enter to send, Escape to close.
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
  private inputContainer: HTMLDivElement;
  private inputField: HTMLInputElement;
  private messages: ChatMessageEntry[] = [];
  private isOpen = false;
  private onSend: ((message: string) => void) | null = null;

  // Rate limiting
  private lastSendTime = 0;
  private sendCooldown = 1000; // 1 second between messages

  constructor() {
    // Main container
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

    // Messages area
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

    // Input container (hidden by default)
    this.inputContainer = document.createElement('div');
    Object.assign(this.inputContainer.style, {
      display: 'none',
      background: 'rgba(0, 0, 0, 0.75)',
      borderRadius: '6px',
      padding: '4px',
      marginTop: '4px',
      pointerEvents: 'auto',
    });

    this.inputField = document.createElement('input');
    this.inputField.type = 'text';
    this.inputField.maxLength = 150;
    this.inputField.placeholder = 'Type a message...';
    Object.assign(this.inputField.style, {
      width: '100%',
      background: 'rgba(255, 255, 255, 0.1)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '4px',
      color: '#fff',
      padding: '6px 10px',
      fontSize: '13px',
      outline: 'none',
      boxSizing: 'border-box',
    });

    this.inputContainer.appendChild(this.inputField);
    this.container.appendChild(this.inputContainer);

    document.body.appendChild(this.container);

    // Event listeners
    this.inputField.addEventListener('keydown', (e) => {
      e.stopPropagation(); // Prevent game input while typing
      if (e.key === 'Enter') {
        this.sendMessage();
      } else if (e.key === 'Escape') {
        this.close();
      }
    });

    // Prevent game input events from firing while chat is focused
    this.inputField.addEventListener('keyup', (e) => e.stopPropagation());
    this.inputField.addEventListener('keypress', (e) => e.stopPropagation());

    // Global listener for opening chat
    document.addEventListener('keydown', (e) => {
      // Don't open chat if already in an input field or menu
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Enter' && !this.isOpen) {
        // Only if pointer is locked (in-game)
        if (document.pointerLockElement) {
          e.preventDefault();
          this.open();
        }
      }
    });

    // Start fade update loop
    this.startFadeLoop();
  }

  /** Set the callback for when a message is sent */
  setOnSend(callback: (message: string) => void): void {
    this.onSend = callback;
  }

  /** Add an incoming chat message */
  addMessage(username: string, message: string, isSystem = false): void {
    const color = isSystem ? '#aaa' : this.getUserColor(username);

    this.messages.push({
      username,
      message,
      timestamp: Date.now(),
      color,
    });

    // Trim old messages
    if (this.messages.length > MAX_MESSAGES) {
      this.messages.shift();
    }

    this.renderMessages();
    this.scrollToBottom();
  }

  /** Open the chat input */
  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.inputContainer.style.display = 'block';
    this.container.style.pointerEvents = 'auto';

    // Exit pointer lock so user can type
    document.exitPointerLock();

    // Focus input after a tiny delay (pointer lock release needs time)
    setTimeout(() => {
      this.inputField.focus();
    }, 50);

    // Show all messages while chat is open
    this.renderMessages();
  }

  /** Close the chat input */
  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.inputContainer.style.display = 'none';
    this.inputField.value = '';
    this.container.style.pointerEvents = 'none';

    // Re-acquire pointer lock
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.requestPointerLock();
    }
  }

  /** Check if chat is currently active (consuming input) */
  isActive(): boolean {
    return this.isOpen;
  }

  private sendMessage(): void {
    const text = this.inputField.value.trim();
    if (!text) {
      this.close();
      return;
    }

    // Rate limit
    const now = Date.now();
    if (now - this.lastSendTime < this.sendCooldown) {
      return;
    }
    this.lastSendTime = now;

    // Send
    this.onSend?.(text);
    this.inputField.value = '';
    this.close();
  }

  private renderMessages(): void {
    const now = Date.now();
    this.messagesDiv.innerHTML = '';

    for (const msg of this.messages) {
      const age = now - msg.timestamp;
      let opacity = 1;

      if (!this.isOpen) {
        if (age > MESSAGE_GONE_TIME) {
          continue; // Don't render
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
    // Generate a consistent color from username hash
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
    setInterval(() => {
      if (!this.isOpen && this.messages.length > 0) {
        this.renderMessages();
      }
    }, 1000);
  }

  /** Destroy the chat UI */
  destroy(): void {
    this.container.remove();
  }
}
