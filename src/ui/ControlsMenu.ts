import { KeyBindings, DEFAULT_BINDINGS, BINDINGS_STORAGE_KEY, RESERVED_BINDING_CODES } from '../core/InputManager';

interface ActionEntry {
  key: keyof KeyBindings;
  displayName: string;
}

interface ActionCategory {
  label: string;
  actions: ActionEntry[];
}

const CATEGORIES: ActionCategory[] = [
  {
    label: 'MOVEMENT',
    actions: [
      { key: 'moveForward', displayName: 'Move Forward' },
      { key: 'moveBackward', displayName: 'Move Backward' },
      { key: 'moveLeft', displayName: 'Move Left' },
      { key: 'moveRight', displayName: 'Move Right' },
    ],
  },
  {
    label: 'VERTICAL',
    actions: [
      { key: 'ascend', displayName: 'Ascend / Fly Up' },
      { key: 'gentleDescend', displayName: 'Precise Descend (Slow)' },
      { key: 'fastDescend', displayName: 'Fast Descent' },
      { key: 'dive', displayName: 'Dive' },
    ],
  },
  {
    label: 'ACTIONS',
    actions: [
      { key: 'boost', displayName: 'Boost' },
      { key: 'bomberMode', displayName: 'Bomber Mode Toggle' },
      { key: 'interact', displayName: 'Interact' },
      { key: 'ability', displayName: 'Ability' },
      { key: 'abilityCycle', displayName: 'Cycle Ability' },
      { key: 'uTurn', displayName: 'U-Turn (180°)' },
    ],
  },
  {
    label: 'AEROBATICS',
    actions: [
      { key: 'frontFlip', displayName: 'Front Flip' },
      { key: 'backFlip', displayName: 'Back Flip' },
      { key: 'leftBarrelRoll', displayName: 'Barrel Roll Left' },
      { key: 'rightBarrelRoll', displayName: 'Barrel Roll Right' },
      { key: 'corkscrewLeft', displayName: 'Corkscrew Left' },
      { key: 'corkscrewRight', displayName: 'Corkscrew Right' },
      { key: 'sideFlipLeft', displayName: 'Side Flip Left' },
      { key: 'sideFlipRight', displayName: 'Side Flip Right' },
      { key: 'invertedFlip', displayName: 'Inverted Flip' },
      { key: 'aileronRoll', displayName: 'Aileron Roll' },
    ],
  },
  {
    label: 'EMOTES',
    actions: [
      { key: 'emote1', displayName: 'Emote 1' },
      { key: 'emote2', displayName: 'Emote 2' },
      { key: 'emote3', displayName: 'Emote 3' },
      { key: 'emote4', displayName: 'Emote 4' },
    ],
  },
  {
    label: 'MENU',
    actions: [
      { key: 'pause', displayName: 'Pause' },
    ],
  },
];

const SPECIAL_KEYS: Record<string, string> = {
  Space: 'SPACE',
  Tab: 'TAB',
  ShiftLeft: 'L-SHIFT',
  ShiftRight: 'R-SHIFT',
  ControlLeft: 'L-CTRL',
  ControlRight: 'R-CTRL',
  AltLeft: 'L-ALT',
  AltRight: 'R-ALT',
  MetaLeft: 'L-META',
  MetaRight: 'R-META',
  Escape: 'ESC',
  Enter: 'ENTER',
  Backspace: 'BACKSPACE',
  Delete: 'DELETE',
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
  CapsLock: 'CAPS',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  NumpadEnter: 'NUM ENTER',
  NumpadAdd: 'NUM +',
  NumpadSubtract: 'NUM -',
  NumpadMultiply: 'NUM *',
  NumpadDivide: 'NUM /',
  NumpadDecimal: 'NUM .',
  NumLock: 'NUM LOCK',
};

function codeToDisplayName(code: string): string {
  if (SPECIAL_KEYS[code]) return SPECIAL_KEYS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6);
  if (/^F\d+$/.test(code)) return code;
  return code;
}

export class ControlsMenu {
  private container: HTMLElement;
  private visible = false;
  private onClose: (() => void) | null = null;

  private currentBindings: KeyBindings;
  private inputManager: { setBinding(action: keyof KeyBindings, code: string): void; resetBindings(): void; bindings: KeyBindings } | null = null;

  // Key capture state
  private listeningButton: HTMLButtonElement | null = null;
  private listeningAction: keyof KeyBindings | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  // Map of action → button element for updating display
  private bindingButtons = new Map<keyof KeyBindings, HTMLButtonElement>();

  constructor() {
    this.currentBindings = this.loadBindings();

    // Inject pulse animation
    const style = document.createElement('style');
    style.textContent = `@keyframes controls-pulse{0%,100%{opacity:1}50%{opacity:.5}}`;
    document.head.appendChild(style);

    // Root overlay
    this.container = document.createElement('div');
    this.container.id = 'controls-menu';
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-modal', 'true');
    this.container.setAttribute('aria-labelledby', 'controls-title');
    this.container.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;' +
      'display:none;flex-direction:column;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.85);font-family:"Segoe UI",system-ui,sans-serif;' +
      'color:#fff;z-index:96;';

    // Scrollable panel
    const panel = document.createElement('div');
    panel.style.cssText =
      'width:500px;max-height:80vh;overflow-y:auto;padding:30px;' +
      'background:rgba(40,50,60,0.95);border-radius:8px;border:1px solid rgba(255,255,255,0.15);';

    // Title
    const title = document.createElement('h2');
    title.id = 'controls-title';
    title.style.cssText = 'font-size:24px;font-weight:bold;margin-bottom:8px;text-align:center;letter-spacing:2px;';
    title.textContent = 'CONTROLS';
    panel.appendChild(title);

    // Subtitle hint
    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:11px;color:#888;text-align:center;margin-bottom:20px;';
    hint.textContent = 'Click a key to rebind. Press Escape to cancel. Ctrl/Meta keys are reserved.';
    panel.appendChild(hint);

    // Build category sections
    for (const category of CATEGORIES) {
      this.addCategory(panel, category);
    }

    // Reset to defaults button
    const resetBtn = document.createElement('button');
    resetBtn.style.cssText =
      'display:block;width:100%;padding:10px;margin-top:20px;' +
      'background:rgba(255,165,0,0.15);border:1px solid rgba(255,165,0,0.4);' +
      'color:#ffa500;font-size:13px;font-weight:bold;cursor:pointer;border-radius:4px;pointer-events:auto;';
    resetBtn.textContent = 'RESET TO DEFAULTS';
    resetBtn.addEventListener('click', () => this.resetToDefaults());
    panel.appendChild(resetBtn);

    // Back button
    const backBtn = document.createElement('button');
    backBtn.style.cssText =
      'display:block;width:100%;padding:12px;margin-top:8px;' +
      'background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.3);' +
      'color:#fff;font-size:14px;font-weight:bold;cursor:pointer;border-radius:4px;pointer-events:auto;';
    backBtn.textContent = 'BACK';
    backBtn.addEventListener('click', () => this.onClose?.());
    panel.appendChild(backBtn);

    this.container.appendChild(panel);
    document.body.appendChild(this.container);
  }

  // ── Build helpers ──────────────────────────────────

  private addCategory(parent: HTMLElement, category: ActionCategory): void {
    const header = document.createElement('div');
    header.style.cssText =
      'font-size:11px;font-weight:bold;color:#87ceeb;letter-spacing:1px;' +
      'margin-top:18px;margin-bottom:6px;padding-bottom:4px;' +
      'border-bottom:1px solid rgba(135,206,235,0.25);text-transform:uppercase;';
    header.textContent = category.label;
    parent.appendChild(header);

    for (const action of category.actions) {
      this.addBindingRow(parent, action.key, action.displayName);
    }
  }

  private addBindingRow(parent: HTMLElement, action: keyof KeyBindings, displayName: string): void {
    const row = document.createElement('div');
    row.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;' +
      'padding:5px 0;';

    const label = document.createElement('span');
    label.style.cssText = 'font-size:13px;color:#ccc;';
    label.textContent = displayName;
    row.appendChild(label);

    const btn = document.createElement('button');
    btn.style.cssText =
      'min-width:110px;padding:6px 12px;' +
      'background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);' +
      'color:#FFD700;font-family:"Courier New",monospace;font-size:13px;font-weight:bold;' +
      'border-radius:3px;cursor:pointer;pointer-events:auto;text-align:center;' +
      'transition:background 0.15s;';
    btn.textContent = codeToDisplayName(this.currentBindings[action]);
    btn.addEventListener('mouseenter', () => {
      if (this.listeningAction !== action) btn.style.background = 'rgba(255,255,255,0.15)';
    });
    btn.addEventListener('mouseleave', () => {
      if (this.listeningAction !== action) btn.style.background = 'rgba(255,255,255,0.08)';
    });
    btn.addEventListener('click', () => this.startListening(action, btn));

    this.bindingButtons.set(action, btn);
    row.appendChild(btn);
    parent.appendChild(row);
  }

  // ── Key capture ────────────────────────────────────

  private startListening(action: keyof KeyBindings, button: HTMLButtonElement): void {
    this.stopListening();

    this.listeningAction = action;
    this.listeningButton = button;

    button.textContent = '[ PRESS A KEY ]';
    button.style.background = 'rgba(255,200,50,0.3)';
    button.style.borderColor = '#FFD700';
    button.style.animation = 'controls-pulse 1s infinite';

    this.keydownHandler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      this.handleKeyCapture(e);
    };

    window.addEventListener('keydown', this.keydownHandler, { capture: true });
  }

  private handleKeyCapture(e: KeyboardEvent): void {
    const code = e.code;
    const action = this.listeningAction!;

    // Escape cancels
    if (code === 'Escape') {
      this.stopListening();
      this.refreshAllButtons();
      return;
    }

    if (RESERVED_BINDING_CODES.has(code)) {
      this.showInvalidKeyFeedback();
      return;
    }

    // Detect conflict
    const conflict = this.detectConflict(code, action);
    if (conflict) {
      // Swap: give the conflicting action our old key
      const oldCode = this.currentBindings[action];
      this.saveBinding(conflict, oldCode);
    }

    // Set the new binding
    this.saveBinding(action, code);

    // Refresh display
    this.refreshAllButtons();

    // Flash the swapped row if there was a conflict
    if (conflict) {
      const swappedBtn = this.bindingButtons.get(conflict);
      if (swappedBtn) {
        swappedBtn.style.background = 'rgba(255,165,0,0.3)';
        setTimeout(() => { swappedBtn.style.background = 'rgba(255,255,255,0.08)'; }, 600);
      }
    }

    this.stopListening();
  }

  private showInvalidKeyFeedback(): void {
    if (!this.listeningButton) return;
    const button = this.listeningButton;
    button.textContent = '[ RESERVED KEY ]';
    button.style.background = 'rgba(220,80,80,0.35)';
    setTimeout(() => {
      if (this.listeningButton === button) {
        button.textContent = '[ PRESS A KEY ]';
        button.style.background = 'rgba(255,200,50,0.3)';
      }
    }, 700);
  }

  private stopListening(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler, { capture: true });
      this.keydownHandler = null;
    }
    if (this.listeningButton) {
      this.listeningButton.style.animation = '';
      this.listeningButton.style.borderColor = 'rgba(255,255,255,0.2)';
      this.listeningButton.style.background = 'rgba(255,255,255,0.08)';
    }
    this.listeningAction = null;
    this.listeningButton = null;
  }

  private detectConflict(newCode: string, targetAction: keyof KeyBindings): keyof KeyBindings | null {
    for (const [action, code] of Object.entries(this.currentBindings)) {
      if (action !== targetAction && code === newCode) {
        return action as keyof KeyBindings;
      }
    }
    return null;
  }

  // ── Persistence ────────────────────────────────────

  private loadBindings(): KeyBindings {
    try {
      const stored = localStorage.getItem(BINDINGS_STORAGE_KEY);
      if (stored) return { ...DEFAULT_BINDINGS, ...JSON.parse(stored) };
    } catch { /* ignore */ }
    return { ...DEFAULT_BINDINGS };
  }

  private saveBinding(action: keyof KeyBindings, code: string): void {
    if (RESERVED_BINDING_CODES.has(code)) return;
    (this.currentBindings as unknown as Record<string, string>)[action] = code;

    if (this.inputManager) {
      this.inputManager.setBinding(action, code);
    } else {
      try {
        localStorage.setItem(BINDINGS_STORAGE_KEY, JSON.stringify(this.currentBindings));
      } catch { /* storage unavailable */ }
    }
  }

  private resetToDefaults(): void {
    Object.assign(this.currentBindings, DEFAULT_BINDINGS);

    if (this.inputManager) {
      this.inputManager.resetBindings();
    } else {
      try {
        localStorage.removeItem(BINDINGS_STORAGE_KEY);
      } catch { /* ignore */ }
    }

    this.refreshAllButtons();
  }

  private refreshAllButtons(): void {
    for (const [action, btn] of this.bindingButtons) {
      btn.textContent = codeToDisplayName(this.currentBindings[action]);
    }
  }

  // ── Public API ─────────────────────────────────────

  setOnClose(callback: () => void): void {
    this.onClose = callback;
  }

  setInputManager(im: { setBinding(action: keyof KeyBindings, code: string): void; resetBindings(): void; bindings: KeyBindings } | null): void {
    this.inputManager = im;
  }

  show(): void {
    // Reload bindings from current source
    this.currentBindings = this.inputManager
      ? { ...this.inputManager.bindings }
      : this.loadBindings();
    this.refreshAllButtons();

    this.visible = true;
    this.container.style.display = 'flex';
  }

  hide(): void {
    this.stopListening();
    this.visible = false;
    this.container.style.display = 'none';
  }

  get isVisible(): boolean {
    return this.visible;
  }
}
