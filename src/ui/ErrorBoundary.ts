import { NotificationManager } from './NotificationManager';

/**
 * ErrorBoundary - Global error handler for the game
 * Handles both critical (game-breaking) and non-critical errors
 */
export class ErrorBoundary {
  private notificationManager: NotificationManager;
  private errorModal: HTMLElement | null = null;
  private onReturnToMenu?: () => void;

  constructor(notificationManager: NotificationManager) {
    this.notificationManager = notificationManager;
  }

  /**
   * Set callback for returning to menu
   */
  public setReturnToMenuCallback(callback: () => void): void {
    this.onReturnToMenu = callback;
  }

  /**
   * Handle an error
   * @param error - The error that occurred
   * @param critical - If true, shows modal and stops game. If false, shows toast notification.
   */
  public handleError(error: Error | string, critical: boolean = false): void {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Always log to console for debugging
    if (critical) {
      console.error('🔴 CRITICAL ERROR:', errorMessage, errorStack);
    } else {
      console.error('⚠️ ERROR:', errorMessage, errorStack);
    }

    if (critical) {
      this.showCriticalErrorModal(errorMessage);
    } else {
      this.notificationManager.error(errorMessage);
    }
  }

  /**
   * Show a critical error modal
   */
  private showCriticalErrorModal(message: string): void {
    // Prevent duplicate modals
    if (this.errorModal) return;

    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 15000;
      padding: 20px;
      box-sizing: border-box;
      animation: fadeIn 0.3s ease-out;
    `;

    const modal = document.createElement('div');
    modal.setAttribute('role', 'alertdialog');
    modal.setAttribute('aria-labelledby', 'error-title');
    modal.setAttribute('aria-describedby', 'error-message');
    modal.style.cssText = `
      background: linear-gradient(135deg, #2c1810 0%, #1a1a1a 100%);
      border-radius: 16px;
      max-width: 600px;
      width: 100%;
      padding: 40px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
      border: 2px solid #d32f2f;
      text-align: center;
      color: #ffffff;
      font-family: 'Arial', sans-serif;
    `;

    // Error Icon
    const icon = document.createElement('div');
    icon.textContent = '💥';
    icon.style.cssText = `
      font-size: 80px;
      margin-bottom: 20px;
      animation: shake 0.5s ease-in-out;
    `;
    modal.appendChild(icon);

    // Title
    const title = document.createElement('h2');
    title.id = 'error-title';
    title.textContent = 'Oops! Something Went Wrong';
    title.style.cssText = `
      margin: 0 0 20px 0;
      font-size: 32px;
      font-weight: bold;
      color: #ff6666;
      text-shadow: 0 2px 10px rgba(255, 102, 102, 0.5);
    `;
    modal.appendChild(title);

    // Message
    const messageEl = document.createElement('p');
    messageEl.id = 'error-message';
    messageEl.textContent = message;
    messageEl.style.cssText = `
      margin: 0 0 30px 0;
      font-size: 16px;
      line-height: 1.6;
      color: #cccccc;
      max-height: 200px;
      overflow-y: auto;
      padding: 10px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
    `;
    modal.appendChild(messageEl);

    // Button Container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      gap: 16px;
      justify-content: center;
      flex-wrap: wrap;
    `;

    // Reload Button
    const reloadBtn = this.createButton('🔄 Reload Game', '#4CAF50', '#45a049', () => {
      window.location.reload();
    });
    buttonContainer.appendChild(reloadBtn);

    // Return to Menu Button (if callback is set)
    if (this.onReturnToMenu) {
      const menuBtn = this.createButton('🏠 Return to Menu', '#2196F3', '#1976D2', () => {
        this.hideErrorModal();
        if (this.onReturnToMenu) {
          this.onReturnToMenu();
        }
      });
      buttonContainer.appendChild(menuBtn);
    }

    modal.appendChild(buttonContainer);

    container.appendChild(modal);
    document.body.appendChild(container);

    this.errorModal = container;

    // Add animations
    this.addAnimationStyles();

    // Focus on first button for accessibility
    setTimeout(() => {
      reloadBtn.focus();
    }, 100);
  }

  /**
   * Create a styled button
   */
  private createButton(
    text: string,
    bgColor: string,
    hoverColor: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.cssText = `
      padding: 14px 32px;
      font-size: 16px;
      font-weight: bold;
      background: ${bgColor};
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      transition: all 0.2s;
      min-width: 160px;
    `;

    button.onmouseenter = () => {
      button.style.background = hoverColor;
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.5)';
    };

    button.onmouseleave = () => {
      button.style.background = bgColor;
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
    };

    button.onclick = onClick;

    // Keyboard accessibility
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');

    return button;
  }

  /**
   * Hide the error modal
   */
  private hideErrorModal(): void {
    if (this.errorModal && this.errorModal.parentElement) {
      this.errorModal.style.opacity = '0';
      setTimeout(() => {
        if (this.errorModal && this.errorModal.parentElement) {
          this.errorModal.parentElement.removeChild(this.errorModal);
        }
        this.errorModal = null;
      }, 300);
    }
  }

  /**
   * Add CSS animations
   */
  private addAnimationStyles(): void {
    if (document.getElementById('error-boundary-animations')) return;

    const style = document.createElement('style');
    style.id = 'error-boundary-animations';
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
        20%, 40%, 60%, 80% { transform: translateX(10px); }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Install global error handlers
   */
  public installGlobalHandlers(): void {
    // Handle uncaught errors
    window.addEventListener('error', (event: ErrorEvent) => {
      event.preventDefault();
      this.handleError(event.error || event.message, true);
    });

    // Handle unhandled promise rejections — log only, don't show UI toasts
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      event.preventDefault();
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      console.warn('Unhandled rejection:', error.message, (error as Error).stack);
    });

    console.log('✅ Global error handlers installed');
  }

  /**
   * Clean up
   */
  public dispose(): void {
    this.hideErrorModal();
  }
}
