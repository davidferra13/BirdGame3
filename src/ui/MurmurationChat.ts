/**
 * MurmurationChat — In-panel chat UI for Murmuration group chat.
 * Simple text chat for Murmuration members (Formation 2+).
 * Follows existing imperative DOM pattern.
 */

import { MURMURATION } from '@/utils/Constants';
import type { MurmurationChatMessage } from '@/types/murmuration';

export class MurmurationChat {
  private container: HTMLElement;
  private messagesContainer: HTMLElement;
  private inputEl: HTMLInputElement;
  private messages: MurmurationChatMessage[] = [];
  private onSend: ((message: string) => void) | null = null;

  constructor() {
    this.container = document.createElement('div');
    this.container.style.cssText =
      'display:flex;flex-direction:column;height:100%;' +
      'background:rgba(0,0,0,0.3);border-radius:8px;overflow:hidden;';

    // Header
    const header = document.createElement('div');
    header.style.cssText =
      'padding:10px 14px;font-size:12px;font-weight:bold;letter-spacing:2px;' +
      'color:rgba(255,255,255,0.5);border-bottom:1px solid rgba(255,255,255,0.1);';
    header.textContent = 'MURMURATION CHAT';
    this.container.appendChild(header);

    // Messages area
    this.messagesContainer = document.createElement('div');
    this.messagesContainer.style.cssText =
      'flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:4px;' +
      'min-height:200px;max-height:300px;';
    this.container.appendChild(this.messagesContainer);

    // Input area
    const inputRow = document.createElement('div');
    inputRow.style.cssText =
      'display:flex;gap:8px;padding:10px;border-top:1px solid rgba(255,255,255,0.1);';

    this.inputEl = document.createElement('input');
    this.inputEl.type = 'text';
    this.inputEl.placeholder = 'Type a message...';
    this.inputEl.maxLength = MURMURATION.CHAT_MAX_LENGTH;
    this.inputEl.style.cssText =
      'flex:1;padding:8px 12px;background:rgba(255,255,255,0.08);' +
      'border:1px solid rgba(255,255,255,0.15);border-radius:6px;' +
      'color:#fff;font-size:13px;font-family:"Segoe UI",system-ui,sans-serif;' +
      'outline:none;';
    this.inputEl.addEventListener('focus', () => {
      this.inputEl.style.borderColor = 'rgba(255,255,255,0.3)';
    });
    this.inputEl.addEventListener('blur', () => {
      this.inputEl.style.borderColor = 'rgba(255,255,255,0.15)';
    });
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submitMessage();
      }
      // Prevent game inputs from capturing chat keystrokes
      e.stopPropagation();
    });

    const sendBtn = document.createElement('button');
    sendBtn.setAttribute('type', 'button');
    sendBtn.textContent = 'SEND';
    sendBtn.style.cssText =
      'padding:8px 16px;background:rgba(68,136,255,0.3);' +
      'border:1px solid rgba(68,136,255,0.5);border-radius:6px;' +
      'color:#88aaff;font-size:12px;font-weight:bold;cursor:pointer;' +
      'transition:background 0.2s;';
    sendBtn.addEventListener('mouseenter', () => {
      sendBtn.style.background = 'rgba(68,136,255,0.5)';
    });
    sendBtn.addEventListener('mouseleave', () => {
      sendBtn.style.background = 'rgba(68,136,255,0.3)';
    });
    sendBtn.addEventListener('click', () => this.submitMessage());

    inputRow.appendChild(this.inputEl);
    inputRow.appendChild(sendBtn);
    this.container.appendChild(inputRow);
  }

  getElement(): HTMLElement {
    return this.container;
  }

  setOnSend(callback: (message: string) => void): void {
    this.onSend = callback;
  }

  addMessage(msg: MurmurationChatMessage): void {
    this.messages.push(msg);
    if (this.messages.length > 200) {
      this.messages.shift();
    }
    this.appendMessageElement(msg);
    this.scrollToBottom();
  }

  loadHistory(messages: MurmurationChatMessage[]): void {
    this.messages = messages;
    this.messagesContainer.innerHTML = '';
    for (const msg of messages) {
      this.appendMessageElement(msg);
    }
    this.scrollToBottom();
  }

  clear(): void {
    this.messages = [];
    this.messagesContainer.innerHTML = '';
  }

  private submitMessage(): void {
    const text = this.inputEl.value.trim();
    if (!text) return;
    this.inputEl.value = '';
    this.onSend?.(text);
  }

  private appendMessageElement(msg: MurmurationChatMessage): void {
    const row = document.createElement('div');
    row.style.cssText = 'font-size:13px;line-height:1.4;word-break:break-word;';

    const time = new Date(msg.timestamp);
    const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;

    const timeSpan = document.createElement('span');
    timeSpan.style.cssText = 'color:rgba(255,255,255,0.3);font-size:11px;margin-right:6px;';
    timeSpan.textContent = timeStr;

    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = 'color:#88aaff;font-weight:bold;margin-right:6px;';
    nameSpan.textContent = msg.sender_username;

    const msgSpan = document.createElement('span');
    msgSpan.style.cssText = 'color:rgba(255,255,255,0.85);';
    msgSpan.textContent = msg.message;

    row.appendChild(timeSpan);
    row.appendChild(nameSpan);
    row.appendChild(msgSpan);
    this.messagesContainer.appendChild(row);
  }

  private scrollToBottom(): void {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }
}
