/**
 * AccessibilityHelper - Utility functions for accessibility features
 * Provides reusable patterns for ARIA labels, keyboard navigation, and focus management
 */

/**
 * Focus trap - prevents focus from escaping a container (useful for modals)
 */
export class FocusTrap {
  private container: HTMLElement;
  private focusableElements: HTMLElement[] = [];
  private firstFocusable: HTMLElement | null = null;
  private lastFocusable: HTMLElement | null = null;
  private previouslyFocused: HTMLElement | null = null;
  private isActive = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.updateFocusableElements();
  }

  /**
   * Find all focusable elements in the container
   */
  private updateFocusableElements(): void {
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    this.focusableElements = Array.from(
      this.container.querySelectorAll<HTMLElement>(focusableSelectors)
    );

    this.firstFocusable = this.focusableElements[0] || null;
    this.lastFocusable = this.focusableElements[this.focusableElements.length - 1] || null;
  }

  /**
   * Handle Tab key to trap focus
   */
  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Tab') return;

    this.updateFocusableElements(); // Refresh in case elements changed

    if (e.shiftKey) {
      // Shift + Tab (backwards)
      if (document.activeElement === this.firstFocusable) {
        e.preventDefault();
        this.lastFocusable?.focus();
      }
    } else {
      // Tab (forwards)
      if (document.activeElement === this.lastFocusable) {
        e.preventDefault();
        this.firstFocusable?.focus();
      }
    }
  };

  /**
   * Activate the focus trap
   */
  public activate(): void {
    if (this.isActive) return;

    this.previouslyFocused = document.activeElement as HTMLElement;
    this.updateFocusableElements();

    // Focus first element
    this.firstFocusable?.focus();

    // Listen for Tab key
    document.addEventListener('keydown', this.handleKeyDown);

    this.isActive = true;
  }

  /**
   * Deactivate the focus trap and return focus to previous element
   */
  public deactivate(): void {
    if (!this.isActive) return;

    document.removeEventListener('keydown', this.handleKeyDown);

    // Return focus to previously focused element
    if (this.previouslyFocused && this.previouslyFocused.focus) {
      this.previouslyFocused.focus();
    }

    this.isActive = false;
  }
}

/**
 * Add keyboard navigation to a button-like element
 */
export function makeKeyboardAccessible(
  element: HTMLElement,
  onClick: () => void,
  role: string = 'button'
): void {
  element.setAttribute('role', role);
  element.setAttribute('tabindex', '0');

  element.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  });
}

/**
 * Add ARIA attributes to an element
 */
export function addAriaLabel(element: HTMLElement, label: string, describedBy?: string): void {
  element.setAttribute('aria-label', label);

  if (describedBy) {
    element.setAttribute('aria-describedby', describedBy);
  }
}

/**
 * Create an ARIA live region for announcements
 */
export function createLiveRegion(
  polite: boolean = true,
  atomic: boolean = true
): HTMLElement {
  const liveRegion = document.createElement('div');
  liveRegion.setAttribute('aria-live', polite ? 'polite' : 'assertive');
  liveRegion.setAttribute('aria-atomic', atomic ? 'true' : 'false');
  liveRegion.style.cssText = `
    position: absolute;
    left: -10000px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  `;

  document.body.appendChild(liveRegion);
  return liveRegion;
}

/**
 * Announce a message to screen readers
 */
export function announceToScreenReader(message: string, liveRegion: HTMLElement): void {
  liveRegion.textContent = '';

  // Use setTimeout to ensure the change is detected
  setTimeout(() => {
    liveRegion.textContent = message;
  }, 100);
}

/**
 * Set up slider keyboard controls (arrow keys for adjustment)
 */
export function addSliderKeyboardControls(
  slider: HTMLInputElement,
  step: number = 0.1
): void {
  slider.addEventListener('keydown', (e: KeyboardEvent) => {
    const currentValue = parseFloat(slider.value);
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);

    let newValue = currentValue;

    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        e.preventDefault();
        newValue = Math.min(currentValue + step, max);
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        e.preventDefault();
        newValue = Math.max(currentValue - step, min);
        break;
      case 'Home':
        e.preventDefault();
        newValue = min;
        break;
      case 'End':
        e.preventDefault();
        newValue = max;
        break;
    }

    if (newValue !== currentValue) {
      slider.value = newValue.toString();
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  // Add ARIA attributes
  slider.setAttribute('role', 'slider');
  slider.setAttribute('aria-valuemin', slider.min);
  slider.setAttribute('aria-valuemax', slider.max);
  slider.setAttribute('aria-valuenow', slider.value);

  // Update aria-valuenow on change
  slider.addEventListener('input', () => {
    slider.setAttribute('aria-valuenow', slider.value);
  });
}

/**
 * Check if an element is currently visible
 */
export function isElementVisible(element: HTMLElement): boolean {
  return !!(
    element.offsetWidth ||
    element.offsetHeight ||
    element.getClientRects().length
  );
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors));
}
