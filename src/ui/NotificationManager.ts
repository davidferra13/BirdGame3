/**
 * NotificationManager - Toast notification system
 * Displays user-friendly notifications for errors, warnings, info, and success messages
 */
export type NotificationType = 'error' | 'warning' | 'info' | 'success';

interface Notification {
  id: number;
  message: string;
  type: NotificationType;
  element: HTMLElement;
  timer?: number;
}

export class NotificationManager {
  private container: HTMLElement;
  private notifications: Map<number, Notification> = new Map();
  private nextId: number = 0;
  private defaultDuration: number = 3000; // 3 seconds
  private maxNotifications: number = 5;

  constructor() {
    this.container = this.createContainer();
    document.body.appendChild(this.container);
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column-reverse;
      gap: 12px;
      pointer-events: none;
    `;
    return container;
  }

  /**
   * Show a notification
   * @param message - The message to display
   * @param type - Type of notification (error, warning, info, success)
   * @param duration - How long to show in ms (0 = manual dismiss only)
   * @returns notification ID for manual dismissal
   */
  public show(message: string, type: NotificationType = 'info', duration: number = this.defaultDuration): number {
    const id = this.nextId++;

    // Limit max notifications
    if (this.notifications.size >= this.maxNotifications) {
      const oldestId = Array.from(this.notifications.keys())[0];
      this.dismiss(oldestId);
    }

    const element = this.createNotificationElement(message, type, id);
    this.container.appendChild(element);

    const notification: Notification = {
      id,
      message,
      type,
      element,
    };

    // Auto-dismiss after duration
    if (duration > 0) {
      notification.timer = window.setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }

    this.notifications.set(id, notification);

    // Animate in
    requestAnimationFrame(() => {
      element.style.opacity = '1';
      element.style.transform = 'translateX(0)';
    });

    return id;
  }

  private createNotificationElement(message: string, type: NotificationType, id: number): HTMLElement {
    const notif = document.createElement('div');
    notif.setAttribute('role', 'alert');
    notif.setAttribute('aria-live', 'polite');

    const config = this.getTypeConfig(type);

    notif.style.cssText = `
      background: ${config.background};
      color: ${config.color};
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      border-left: 4px solid ${config.borderColor};
      min-width: 300px;
      max-width: 400px;
      display: flex;
      align-items: center;
      gap: 12px;
      font-family: 'Arial', sans-serif;
      font-size: 14px;
      pointer-events: auto;
      cursor: pointer;
      opacity: 0;
      transform: translateX(400px);
      transition: all 0.3s ease-out;
    `;

    // Icon
    const icon = document.createElement('span');
    icon.textContent = config.icon;
    icon.style.cssText = `
      font-size: 20px;
      flex-shrink: 0;
    `;
    notif.appendChild(icon);

    // Message
    const messageEl = document.createElement('div');
    messageEl.textContent = message;
    messageEl.style.cssText = `
      flex: 1;
      word-wrap: break-word;
    `;
    notif.appendChild(messageEl);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Dismiss notification');
    closeBtn.style.cssText = `
      background: transparent;
      border: none;
      color: ${config.color};
      font-size: 24px;
      line-height: 1;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.7;
      transition: opacity 0.2s;
    `;
    closeBtn.onmouseenter = () => {
      closeBtn.style.opacity = '1';
    };
    closeBtn.onmouseleave = () => {
      closeBtn.style.opacity = '0.7';
    };
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      this.dismiss(id);
    };
    notif.appendChild(closeBtn);

    // Click anywhere to dismiss
    notif.onclick = () => {
      this.dismiss(id);
    };

    return notif;
  }

  private getTypeConfig(type: NotificationType) {
    switch (type) {
      case 'error':
        return {
          background: 'linear-gradient(135deg, #d32f2f 0%, #c62828 100%)',
          color: '#ffffff',
          borderColor: '#b71c1c',
          icon: '❌',
        };
      case 'warning':
        return {
          background: 'linear-gradient(135deg, #f57c00 0%, #ef6c00 100%)',
          color: '#ffffff',
          borderColor: '#e65100',
          icon: '⚠️',
        };
      case 'success':
        return {
          background: 'linear-gradient(135deg, #388e3c 0%, #2e7d32 100%)',
          color: '#ffffff',
          borderColor: '#1b5e20',
          icon: '✅',
        };
      case 'info':
      default:
        return {
          background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
          color: '#ffffff',
          borderColor: '#0d47a1',
          icon: 'ℹ️',
        };
    }
  }

  /**
   * Dismiss a notification by ID
   */
  public dismiss(id: number): void {
    const notification = this.notifications.get(id);
    if (!notification) return;

    // Clear timer if exists
    if (notification.timer) {
      clearTimeout(notification.timer);
    }

    // Animate out
    notification.element.style.opacity = '0';
    notification.element.style.transform = 'translateX(400px)';

    // Remove after animation
    setTimeout(() => {
      if (notification.element.parentElement) {
        this.container.removeChild(notification.element);
      }
      this.notifications.delete(id);
    }, 300);
  }

  /**
   * Dismiss all notifications
   */
  public dismissAll(): void {
    const ids = Array.from(this.notifications.keys());
    ids.forEach(id => this.dismiss(id));
  }

  /**
   * Convenience methods for common notification types
   */
  public error(message: string, duration?: number): number {
    return this.show(message, 'error', duration);
  }

  public warning(message: string, duration?: number): number {
    return this.show(message, 'warning', duration);
  }

  public info(message: string, duration?: number): number {
    return this.show(message, 'info', duration);
  }

  public success(message: string, duration?: number): number {
    return this.show(message, 'success', duration);
  }

  /**
   * Clean up
   */
  public dispose(): void {
    this.dismissAll();
    if (this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }
}
