export interface KeyBindings {
  moveForward: string;
  moveBackward: string;
  moveLeft: string;
  moveRight: string;
  ascend: string;
  fastDescend: string;
  dive: string;
  boost: string;
  interact: string;
  pause: string;
  emote1: string;
  emote2: string;
  emote3: string;
  emote4: string;
  frontFlip: string;
  backFlip: string;
  leftBarrelRoll: string;
  rightBarrelRoll: string;
  corkscrewLeft: string;
  corkscrewRight: string;
  sideFlipLeft: string;
  sideFlipRight: string;
  invertedFlip: string;
  aileronRoll: string;
  gentleDescend: string;
  ability: string;
  abilityCycle: string;
  uTurn: string;
}

export const DEFAULT_BINDINGS: KeyBindings = {
  moveForward: 'KeyW',
  moveBackward: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  ascend: 'Space',
  fastDescend: 'ControlLeft',
  dive: 'ShiftLeft',
  boost: 'KeyT',
  interact: 'KeyZ',
  pause: 'Escape',
  emote1: 'Digit1',
  emote2: 'Digit2',
  emote3: 'Digit3',
  emote4: 'Digit4',
  frontFlip: 'KeyQ',
  backFlip: 'KeyE',
  leftBarrelRoll: 'KeyR',
  rightBarrelRoll: 'KeyF',
  corkscrewLeft: 'KeyT',
  corkscrewRight: 'KeyY',
  sideFlipLeft: 'KeyX',
  sideFlipRight: 'KeyC',
  invertedFlip: 'KeyV',
  aileronRoll: 'KeyN',
  gentleDescend: 'Tab',
  ability: 'KeyJ',
  abilityCycle: 'KeyU',
  uTurn: 'Backquote',
};

export const BINDINGS_STORAGE_KEY = 'bird-game-keybindings';

export class InputManager {
  private keysDown = new Set<string>();
  private keysPressed = new Set<string>();
  private _mouseDx = 0;
  private _mouseDy = 0;
  private _mouseClicked = false;
  private _rightMouseDown = false;
  private _rightMouseClicked = false;
  private _pointerLocked = false;
  private _scrollDelta = 0;

  sensitivity = 1.0;
  invertY = false;

  // Idle tracking — reset on any gameplay input
  private _lastInputTimestamp = performance.now();

  // ── Key bindings (remappable) ─────────────────────
  readonly bindings: KeyBindings;

  // ── Touch / mobile state ──────────────────────────
  readonly isTouchDevice: boolean;
  private touchControls: HTMLElement | null = null;

  // Virtual joystick (left thumb)
  private joyTouchId: number | null = null;
  private joyOrigin = { x: 0, y: 0 };
  private joyAxis = { h: 0, v: 0 };

  // Camera swipe (right thumb)
  private camTouchId: number | null = null;
  private camLastPos = { x: 0, y: 0 };

  // Touch buttons
  private touchDrop = false;
  private touchAscend = false;
  private touchDive = false;
  private touchBank = false;
  private touchUTurn = false;

  constructor() {
    this.bindings = this.loadBindings();
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // ── Keyboard ──
    window.addEventListener('keydown', (e) => {
      this._lastInputTimestamp = performance.now();
      if (!this.keysDown.has(e.code)) {
        this.keysPressed.add(e.code);
      }
      this.keysDown.add(e.code);
      if (e.code === 'Space') e.preventDefault();
      if (e.code === 'Tab') e.preventDefault();
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
    });

    // ── Mouse ──
    window.addEventListener('mousemove', (e) => {
      if (this._pointerLocked) {
        this._lastInputTimestamp = performance.now();
        this._mouseDx += e.movementX;
        this._mouseDy += e.movementY;
      }
    });

    window.addEventListener('mousedown', (e) => {
      this._lastInputTimestamp = performance.now();
      if (e.button === 0) {
        this._mouseClicked = true;
        if (!this._pointerLocked) {
          // Don't request pointer lock when clicking on UI overlays (menus, buttons, etc.)
          const target = e.target as HTMLElement;
          const isCanvas = target.tagName === 'CANVAS';
          if (isCanvas) {
            document.body.requestPointerLock();
          }
        }
      }
      if (e.button === 2) {
        if (!this._rightMouseDown) {
          this._rightMouseClicked = true; // Track press (only fires once)
        }
        this._rightMouseDown = true;
        e.preventDefault(); // Prevent context menu
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) {
        this._rightMouseDown = false;
      }
    });

    // Prevent context menu on right-click
    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // ── Scroll wheel (altitude control) ──
    window.addEventListener('wheel', (e) => {
      if (this._pointerLocked) {
        this._lastInputTimestamp = performance.now();
        this._scrollDelta += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });

    document.addEventListener('pointerlockchange', () => {
      this._pointerLocked = document.pointerLockElement === document.body;
    });

    window.addEventListener('blur', () => {
      this.keysDown.clear();
    });

    // ── Touch ──
    if (this.isTouchDevice) {
      this.createTouchUI();
    }
  }

  // ── Key bindings management ────────────────────────

  private loadBindings(): KeyBindings {
    try {
      const stored = localStorage.getItem(BINDINGS_STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_BINDINGS, ...JSON.parse(stored) };
      }
    } catch { /* ignore parse errors */ }
    return { ...DEFAULT_BINDINGS };
  }

  setBinding(action: keyof KeyBindings, code: string): void {
    (this.bindings as unknown as Record<string, string>)[action] = code;
    try {
      localStorage.setItem(BINDINGS_STORAGE_KEY, JSON.stringify(this.bindings));
    } catch { /* storage full or unavailable */ }
  }

  resetBindings(): void {
    Object.assign(this.bindings, DEFAULT_BINDINGS);
    try {
      localStorage.removeItem(BINDINGS_STORAGE_KEY);
    } catch { /* ignore */ }
  }

  // ── Touch UI ──────────────────────────────────────

  private createTouchUI(): void {
    const root = document.createElement('div');
    root.id = 'touch-controls';
    root.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:80;' +
      'touch-action:none;user-select:none;-webkit-user-select:none;';

    // Left half — joystick zone
    const joyZone = document.createElement('div');
    joyZone.style.cssText =
      'position:absolute;left:0;top:0;width:50%;height:100%;pointer-events:auto;';
    joyZone.addEventListener('touchstart', (e) => this.onJoyStart(e), { passive: false });
    joyZone.addEventListener('touchmove', (e) => this.onJoyMove(e), { passive: false });
    joyZone.addEventListener('touchend', (e) => this.onJoyEnd(e), { passive: false });
    joyZone.addEventListener('touchcancel', (e) => this.onJoyEnd(e), { passive: false });
    root.appendChild(joyZone);

    // Right half — camera swipe zone
    const camZone = document.createElement('div');
    camZone.style.cssText =
      'position:absolute;right:0;top:0;width:50%;height:60%;pointer-events:auto;';
    camZone.addEventListener('touchstart', (e) => this.onCamStart(e), { passive: false });
    camZone.addEventListener('touchmove', (e) => this.onCamMove(e), { passive: false });
    camZone.addEventListener('touchend', (e) => this.onCamEnd(e), { passive: false });
    camZone.addEventListener('touchcancel', (e) => this.onCamEnd(e), { passive: false });
    root.appendChild(camZone);

    // Buttons (bottom-right in diamond pattern)
    const btnStyle = (bottom: string, right: string, color: string) =>
      `position:absolute;bottom:${bottom};right:${right};width:70px;height:70px;` +
      `border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.5);` +
      `pointer-events:auto;display:flex;align-items:center;justify-content:center;` +
      `font-size:11px;font-weight:bold;color:#fff;font-family:system-ui;opacity:0.7;text-align:center;`;

    const dropBtn = this.makeButton('DROP', btnStyle('20px', '90px', 'rgba(200,100,50,0.6)'));
    dropBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.touchDrop = true; });
    dropBtn.addEventListener('touchend', () => { this.touchDrop = false; });
    dropBtn.addEventListener('touchcancel', () => { this.touchDrop = false; });
    root.appendChild(dropBtn);

    const ascendBtn = this.makeButton('FLY UP', btnStyle('110px', '20px', 'rgba(80,160,255,0.6)'));
    ascendBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.touchAscend = true; });
    ascendBtn.addEventListener('touchend', () => { this.touchAscend = false; });
    ascendBtn.addEventListener('touchcancel', () => { this.touchAscend = false; });
    root.appendChild(ascendBtn);

    const diveBtn = this.makeButton('DIVE', btnStyle('110px', '160px', 'rgba(255,80,80,0.6)'));
    diveBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.touchDive = true; });
    diveBtn.addEventListener('touchend', () => { this.touchDive = false; });
    diveBtn.addEventListener('touchcancel', () => { this.touchDive = false; });
    root.appendChild(diveBtn);

    const bankBtn = this.makeButton('BANK\nSPACE', btnStyle('200px', '90px', 'rgba(68,255,170,0.6)'));
    bankBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.touchBank = true; });
    bankBtn.addEventListener('touchend', () => { this.touchBank = false; });
    bankBtn.addEventListener('touchcancel', () => { this.touchBank = false; });
    root.appendChild(bankBtn);

    const uTurnBtn = this.makeButton('180', btnStyle('290px', '90px', 'rgba(255,200,50,0.6)'));
    uTurnBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.touchUTurn = true; });
    uTurnBtn.addEventListener('touchend', () => { this.touchUTurn = false; });
    uTurnBtn.addEventListener('touchcancel', () => { this.touchUTurn = false; });
    root.appendChild(uTurnBtn);

    document.body.appendChild(root);
    this.touchControls = root;
  }

  private makeButton(label: string, style: string): HTMLElement {
    const btn = document.createElement('div');
    btn.style.cssText = style;
    btn.innerHTML = label.replace(/\n/g, '<br>');
    return btn;
  }

  // ── Joystick handlers ─────────────────────────────

  private onJoyStart(e: TouchEvent): void {
    e.preventDefault();
    this._lastInputTimestamp = performance.now();
    if (this.joyTouchId !== null) return;
    const t = e.changedTouches[0];
    this.joyTouchId = t.identifier;
    this.joyOrigin.x = t.clientX;
    this.joyOrigin.y = t.clientY;
    this.joyAxis.h = 0;
    this.joyAxis.v = 0;

    // Auto-start game on touch (like pointer lock)
    this._pointerLocked = true;
  }

  private onJoyMove(e: TouchEvent): void {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === this.joyTouchId) {
        const dx = t.clientX - this.joyOrigin.x;
        const dy = t.clientY - this.joyOrigin.y;
        const maxDist = 50;
        this.joyAxis.h = Math.max(-1, Math.min(1, dx / maxDist));
        this.joyAxis.v = Math.max(-1, Math.min(1, -dy / maxDist)); // up = positive
      }
    }
  }

  private onJoyEnd(e: TouchEvent): void {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.joyTouchId) {
        this.joyTouchId = null;
        this.joyAxis.h = 0;
        this.joyAxis.v = 0;
      }
    }
  }

  // ── Camera swipe handlers ─────────────────────────

  private onCamStart(e: TouchEvent): void {
    e.preventDefault();
    if (this.camTouchId !== null) return;
    const t = e.changedTouches[0];
    this.camTouchId = t.identifier;
    this.camLastPos.x = t.clientX;
    this.camLastPos.y = t.clientY;
  }

  private onCamMove(e: TouchEvent): void {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === this.camTouchId) {
        this._mouseDx += (t.clientX - this.camLastPos.x) * 0.8;
        this._mouseDy += (t.clientY - this.camLastPos.y) * 0.8;
        this.camLastPos.x = t.clientX;
        this.camLastPos.y = t.clientY;
      }
    }
  }

  private onCamEnd(e: TouchEvent): void {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.camTouchId) {
        this.camTouchId = null;
      }
    }
  }

  // ── Public input queries (keyboard + touch combined) ──

  isDown(code: string): boolean {
    return this.keysDown.has(code);
  }

  wasPressed(code: string): boolean {
    return this.keysPressed.has(code);
  }

  getAxis(name: 'horizontal' | 'vertical'): number {
    let kb = 0;
    switch (name) {
      case 'horizontal':
        kb = (this.isDown(this.bindings.moveRight) || this.isDown('ArrowRight') ? 1 : 0) -
             (this.isDown(this.bindings.moveLeft) || this.isDown('ArrowLeft') ? 1 : 0);
        break;
      case 'vertical':
        kb = (this.isDown(this.bindings.moveForward) || this.isDown('ArrowUp') ? 1 : 0) -
             (this.isDown(this.bindings.moveBackward) || this.isDown('ArrowDown') ? 1 : 0);
        break;
    }
    // Combine keyboard with touch joystick (whichever has larger magnitude)
    const touch = name === 'horizontal' ? this.joyAxis.h : this.joyAxis.v;
    return Math.abs(touch) > Math.abs(kb) ? touch : kb;
  }

  isAscending(): boolean {
    return this.isDown(this.bindings.ascend) || this.touchAscend;
  }

  isFastDescending(): boolean {
    return this.isDown(this.bindings.fastDescend) || this.isDown('ControlRight') || this.touchDive;
  }

  isDive(): boolean {
    return this.isDown(this.bindings.dive) || this.isDown('ShiftRight');
  }

  isGentleDescending(): boolean {
    return this.isDown(this.bindings.gentleDescend);
  }

  isDiveBomb(): boolean {
    // Dive bomb = diving + holding space (ascend key)
    return this.isDive() && this.isDown(this.bindings.ascend);
  }

  isPoop(): boolean {
    return this._mouseClicked || this.touchDrop;
  }

  isBoost(): boolean {
    return this.wasPressed(this.bindings.boost);
  }

  wasPausePressed(): boolean {
    return this.wasPressed(this.bindings.pause);
  }

  wasInteractPressed(): boolean {
    return this.wasPressed(this.bindings.interact) || this.touchBank;
  }

  getEmoteKey(): number {
    if (this.wasPressed(this.bindings.emote1)) return 1;
    if (this.wasPressed(this.bindings.emote2)) return 2;
    if (this.wasPressed(this.bindings.emote3)) return 3;
    if (this.wasPressed(this.bindings.emote4)) return 4;
    return 0;
  }

  wasFrontFlipPressed(): boolean {
    return this.wasPressed(this.bindings.frontFlip);
  }

  wasBackFlipPressed(): boolean {
    return this.wasPressed(this.bindings.backFlip);
  }

  wasLeftBarrelRollPressed(): boolean {
    return this.wasPressed(this.bindings.leftBarrelRoll);
  }

  wasRightBarrelRollPressed(): boolean {
    return this.wasPressed(this.bindings.rightBarrelRoll);
  }

  wasCorkscrewLeftPressed(): boolean {
    return this.wasPressed(this.bindings.corkscrewLeft);
  }

  wasCorkscrewRightPressed(): boolean {
    return this.wasPressed(this.bindings.corkscrewRight);
  }

  wasSideFlipLeftPressed(): boolean {
    return this.wasPressed(this.bindings.sideFlipLeft);
  }

  wasSideFlipRightPressed(): boolean {
    return this.wasPressed(this.bindings.sideFlipRight);
  }

  wasInvertedFlipPressed(): boolean {
    return this.wasPressed(this.bindings.invertedFlip);
  }

  wasAileronRollPressed(): boolean {
    return this.wasPressed(this.bindings.aileronRoll);
  }

  wasAbilityPressed(): boolean {
    return this.wasPressed(this.bindings.ability);
  }

  wasAbilityCyclePressed(): boolean {
    return this.wasPressed(this.bindings.abilityCycle);
  }

  wasUTurnPressed(): boolean {
    return this.wasPressed(this.bindings.uTurn) || this.touchUTurn;
  }

  get mouseDx(): number {
    return this._mouseDx * this.sensitivity;
  }

  get mouseDy(): number {
    return this._mouseDy * (this.invertY ? -1 : 1) * this.sensitivity;
  }

  get isPointerLocked(): boolean {
    return this._pointerLocked;
  }

  getScrollDelta(): number {
    return this._scrollDelta;
  }

  isFreeLookActive(): boolean {
    return this._rightMouseDown;
  }

  wasRightMouseClicked(): boolean {
    return this._rightMouseClicked;
  }

  /** Seconds since the last keyboard/mouse/touch input */
  getIdleTime(): number {
    return (performance.now() - this._lastInputTimestamp) / 1000;
  }

  endFrame(): void {
    this.keysPressed.clear();
    this._mouseDx = 0;
    this._mouseDy = 0;
    this._mouseClicked = false;
    this._rightMouseClicked = false;
    this._scrollDelta = 0;
    this.touchUTurn = false;
    // touchDrop is held (not one-shot), so don't clear it here
  }
}
