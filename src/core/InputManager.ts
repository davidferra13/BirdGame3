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
  bomberMode: string;
}

export const RESERVED_BINDING_CODES = new Set<string>([
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
]);

export const DEFAULT_BINDINGS: KeyBindings = {
  moveForward: 'KeyW',
  moveBackward: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  ascend: 'Space',
  fastDescend: 'KeyK',
  dive: 'AltLeft',
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
  corkscrewLeft: 'KeyI',
  corkscrewRight: 'KeyY',
  sideFlipLeft: 'KeyX',
  sideFlipRight: 'KeyC',
  invertedFlip: 'KeyV',
  aileronRoll: 'KeyN',
  gentleDescend: 'ShiftLeft',
  ability: 'KeyJ',
  abilityCycle: 'KeyU',
  uTurn: 'Backquote',
  bomberMode: 'CapsLock',
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
  private touchGrabPressed = false;

  // Store bound handlers for cleanup
  private _onKeyDown: (e: KeyboardEvent) => void;
  private _onKeyUp: (e: KeyboardEvent) => void;
  private _onMouseMove: (e: MouseEvent) => void;
  private _onMouseDown: (e: MouseEvent) => void;
  private _onMouseUp: (e: MouseEvent) => void;
  private _onContextMenu: (e: Event) => void;
  private _onWheel: (e: WheelEvent) => void;
  private _onPointerLockChange: () => void;
  private _onBlur: () => void;

  private shouldBlockBrowserHotkeys(e: KeyboardEvent): boolean {
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName;
    const isEditable = !!target && (
      target.isContentEditable ||
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT'
    );
    if (isEditable) return false;
    const isCloseTabCombo = (e.ctrlKey || e.metaKey) && (e.code === 'KeyW' || e.key.toLowerCase() === 'w');
    if (isCloseTabCombo) return true;
    if (e.code === 'Escape' || e.key === 'Escape') return false;
    // Only hard-block hotkeys while gameplay capture is active.
    return this._pointerLocked;
  }

  private sanitizeBindings(): boolean {
    let changed = false;
    const setIfDifferent = (action: keyof KeyBindings, code: string) => {
      if (this.bindings[action] !== code) {
        this.bindings[action] = code;
        changed = true;
      }
    };

    const movementCodes = new Set<string>([
      this.bindings.moveForward,
      this.bindings.moveBackward,
      this.bindings.moveLeft,
      this.bindings.moveRight,
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
    ]);

    if (movementCodes.has(this.bindings.pause) || this.bindings.pause === 'KeyW') {
      setIfDifferent('pause', DEFAULT_BINDINGS.pause);
    }

    if (this.bindings.moveForward === this.bindings.pause) {
      setIfDifferent('moveForward', DEFAULT_BINDINGS.moveForward);
    }
    if (this.bindings.moveBackward === this.bindings.pause) {
      setIfDifferent('moveBackward', DEFAULT_BINDINGS.moveBackward);
    }
    if (this.bindings.moveLeft === this.bindings.pause) {
      setIfDifferent('moveLeft', DEFAULT_BINDINGS.moveLeft);
    }
    if (this.bindings.moveRight === this.bindings.pause) {
      setIfDifferent('moveRight', DEFAULT_BINDINGS.moveRight);
    }

    // Keep boost and aerobatics distinct in defaults.
    if (this.bindings.boost === this.bindings.corkscrewLeft) {
      setIfDifferent('corkscrewLeft', DEFAULT_BINDINGS.corkscrewLeft);
    }

    return changed;
  }

  constructor() {
    this.bindings = this.loadBindings();
    this.sanitizeBindings();
    // Force requested baseline remap:
    // Caps Lock = bomber mode, Left Shift = precision descend.
    this.bindings.bomberMode = 'CapsLock';
    this.bindings.gentleDescend = 'ShiftLeft';
    this.bindings.dive = 'AltLeft';
    if (RESERVED_BINDING_CODES.has(this.bindings.fastDescend)) {
      this.bindings.fastDescend = this.findSafeFastDescendBinding();
    }
    try {
      localStorage.setItem(BINDINGS_STORAGE_KEY, JSON.stringify(this.bindings));
    } catch { /* storage unavailable */ }
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // ── Keyboard ──
    this._onKeyDown = (e: KeyboardEvent) => {
      if (this.shouldBlockBrowserHotkeys(e)) {
        e.preventDefault();
        e.stopPropagation();
      }
      this._lastInputTimestamp = performance.now();
      if (!this.keysDown.has(e.code)) {
        this.keysPressed.add(e.code);
      }
      this.keysDown.add(e.code);
      if (e.code === 'Space') e.preventDefault();
      if (e.code === 'Tab') e.preventDefault();
    };
    window.addEventListener('keydown', this._onKeyDown);

    this._onKeyUp = (e: KeyboardEvent) => {
      if (this.shouldBlockBrowserHotkeys(e)) {
        e.preventDefault();
        e.stopPropagation();
      }
      this.keysDown.delete(e.code);
    };
    window.addEventListener('keyup', this._onKeyUp);

    // ── Mouse ──
    this._onMouseMove = (e: MouseEvent) => {
      if (this._pointerLocked) {
        this._lastInputTimestamp = performance.now();
        this._mouseDx += e.movementX;
        this._mouseDy += e.movementY;
      }
    };
    window.addEventListener('mousemove', this._onMouseMove);

    this._onMouseDown = (e: MouseEvent) => {
      this._lastInputTimestamp = performance.now();
      if (e.button === 0) {
        this._mouseClicked = true;
        if (!this._pointerLocked) {
          const target = e.target as HTMLElement;
          const isCanvas = target.tagName === 'CANVAS';
          if (isCanvas) {
            document.body.requestPointerLock();
          }
        }
      }
      if (e.button === 2) {
        if (!this._rightMouseDown) {
          this._rightMouseClicked = true;
        }
        this._rightMouseDown = true;
        e.preventDefault();
      }
    };
    window.addEventListener('mousedown', this._onMouseDown);

    this._onMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        this._rightMouseDown = false;
      }
    };
    window.addEventListener('mouseup', this._onMouseUp);

    this._onContextMenu = (e: Event) => {
      e.preventDefault();
    };
    window.addEventListener('contextmenu', this._onContextMenu);

    // ── Scroll wheel (altitude control) ──
    this._onWheel = (e: WheelEvent) => {
      if (this._pointerLocked) {
        this._lastInputTimestamp = performance.now();
        this._scrollDelta += e.deltaY;
        e.preventDefault();
      }
    };
    window.addEventListener('wheel', this._onWheel, { passive: false });

    this._onPointerLockChange = () => {
      this._pointerLocked = document.pointerLockElement === document.body;
      if (!this._pointerLocked) {
        // Prevent free-look latch when pointer lock is lost mid-click.
        this._rightMouseDown = false;
        this._mouseDx = 0;
        this._mouseDy = 0;
      }
    };
    document.addEventListener('pointerlockchange', this._onPointerLockChange);

    this._onBlur = () => {
      this.keysDown.clear();
      this._rightMouseDown = false;
      this._mouseDx = 0;
      this._mouseDy = 0;
      this._scrollDelta = 0;
    };
    window.addEventListener('blur', this._onBlur);

    // ── Touch ──
    if (this.isTouchDevice) {
      this.createTouchUI();
    }
  }

  dispose(): void {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('contextmenu', this._onContextMenu);
    window.removeEventListener('wheel', this._onWheel);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    window.removeEventListener('blur', this._onBlur);
    if (this.touchControls) {
      this.touchControls.remove();
      this.touchControls = null;
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

  private findSafeFastDescendBinding(): string {
    const candidates = [DEFAULT_BINDINGS.fastDescend, 'KeyI', 'KeyO'];
    for (const candidate of candidates) {
      if (RESERVED_BINDING_CODES.has(candidate)) continue;
      let inUse = false;
      for (const [action, code] of Object.entries(this.bindings)) {
        if (action !== 'fastDescend' && code === candidate) {
          inUse = true;
          break;
        }
      }
      if (!inUse) return candidate;
    }
    return DEFAULT_BINDINGS.fastDescend;
  }

  setBinding(action: keyof KeyBindings, code: string): void {
    if (RESERVED_BINDING_CODES.has(code)) return;
    if (action === 'pause') {
      const disallowedPauseCodes = new Set<string>([
        this.bindings.moveForward,
        this.bindings.moveBackward,
        this.bindings.moveLeft,
        this.bindings.moveRight,
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'KeyW',
      ]);
      if (disallowedPauseCodes.has(code)) {
        code = DEFAULT_BINDINGS.pause;
      }
    }
    (this.bindings as unknown as Record<string, string>)[action] = code;
    if (action === 'moveForward' && this.bindings.pause === code) {
      this.bindings.pause = DEFAULT_BINDINGS.pause;
    }
    if (action === 'moveBackward' && this.bindings.pause === code) {
      this.bindings.pause = DEFAULT_BINDINGS.pause;
    }
    if (action === 'moveLeft' && this.bindings.pause === code) {
      this.bindings.pause = DEFAULT_BINDINGS.pause;
    }
    if (action === 'moveRight' && this.bindings.pause === code) {
      this.bindings.pause = DEFAULT_BINDINGS.pause;
    }
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

  // ── Visual joystick elements ─────────────────────
  private joyBase: HTMLElement | null = null;
  private joyThumb: HTMLElement | null = null;
  private joyMaxDist = 50;

  // ── Touch UI ──────────────────────────────────────

  private createTouchUI(): void {
    const vw = () => window.innerWidth;

    const root = document.createElement('div');
    root.id = 'touch-controls';
    root.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:80;' +
      'touch-action:none;user-select:none;-webkit-user-select:none;';

    // ── Left half — joystick zone ──
    const joyZone = document.createElement('div');
    joyZone.style.cssText =
      'position:absolute;left:0;top:0;width:50%;height:100%;pointer-events:auto;';
    joyZone.addEventListener('touchstart', (e) => this.onJoyStart(e), { passive: false });
    joyZone.addEventListener('touchmove', (e) => this.onJoyMove(e), { passive: false });
    joyZone.addEventListener('touchend', (e) => this.onJoyEnd(e), { passive: false });
    joyZone.addEventListener('touchcancel', (e) => this.onJoyEnd(e), { passive: false });
    root.appendChild(joyZone);

    // Visual joystick base (translucent ring, hidden until touch)
    const baseSize = Math.min(130, vw() * 0.22);
    this.joyMaxDist = baseSize * 0.55;
    this.joyBase = document.createElement('div');
    this.joyBase.style.cssText =
      `position:fixed;width:${baseSize}px;height:${baseSize}px;border-radius:50%;` +
      `border:2px solid rgba(255,255,255,0.25);background:rgba(255,255,255,0.06);` +
      `pointer-events:none;display:none;transform:translate(-50%,-50%);` +
      `box-shadow:inset 0 0 20px rgba(255,255,255,0.05);`;
    root.appendChild(this.joyBase);

    // Visual joystick thumb (inner knob)
    const thumbSize = Math.round(baseSize * 0.38);
    this.joyThumb = document.createElement('div');
    this.joyThumb.style.cssText =
      `position:fixed;width:${thumbSize}px;height:${thumbSize}px;border-radius:50%;` +
      `background:rgba(255,255,255,0.35);border:2px solid rgba(255,255,255,0.5);` +
      `pointer-events:none;display:none;transform:translate(-50%,-50%);` +
      `box-shadow:0 0 10px rgba(255,255,255,0.15);`;
    root.appendChild(this.joyThumb);

    // ── Right half — camera swipe zone (full right, top 70%) ──
    const camZone = document.createElement('div');
    camZone.style.cssText =
      'position:absolute;right:0;top:0;width:50%;height:70%;pointer-events:auto;';
    camZone.addEventListener('touchstart', (e) => this.onCamStart(e), { passive: false });
    camZone.addEventListener('touchmove', (e) => this.onCamMove(e), { passive: false });
    camZone.addEventListener('touchend', (e) => this.onCamEnd(e), { passive: false });
    camZone.addEventListener('touchcancel', (e) => this.onCamEnd(e), { passive: false });
    root.appendChild(camZone);

    // ── Action cluster (bottom-right, compact triangle layout) ──
    // Responsive sizing: buttons scale with viewport
    const btnSize = Math.max(52, Math.min(62, vw() * 0.14));
    const gap = btnSize * 0.18;
    const clusterRight = 16;
    const clusterBottom = 16;

    const makeActionBtn = (label: string, color: string, icon: string): HTMLElement => {
      const btn = document.createElement('div');
      btn.style.cssText =
        `width:${btnSize}px;height:${btnSize}px;border-radius:50%;background:${color};` +
        `border:1.5px solid rgba(255,255,255,0.4);pointer-events:auto;` +
        `display:flex;align-items:center;justify-content:center;flex-direction:column;` +
        `font-size:${Math.round(btnSize * 0.18)}px;font-weight:700;color:#fff;` +
        `font-family:system-ui,sans-serif;opacity:0.75;text-align:center;` +
        `text-shadow:0 1px 3px rgba(0,0,0,0.6);line-height:1.1;`;
      btn.innerHTML = `<span style="font-size:${Math.round(btnSize * 0.32)}px">${icon}</span>${label}`;
      return btn;
    };

    // DROP button (top of cluster)
    const dropBtn = makeActionBtn('DROP', 'rgba(200,100,50,0.55)', '\uD83D\uDCA9');
    dropBtn.style.position = 'absolute';
    dropBtn.style.bottom = `${clusterBottom + btnSize + gap}px`;
    dropBtn.style.right = `${clusterRight + (btnSize + gap) / 2}px`;
    dropBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.touchDrop = true; });
    dropBtn.addEventListener('touchend', () => { this.touchDrop = false; });
    dropBtn.addEventListener('touchcancel', () => { this.touchDrop = false; });
    root.appendChild(dropBtn);

    // BANK button (bottom-left of cluster)
    const bankBtn = makeActionBtn('BANK', 'rgba(68,255,170,0.45)', '\u2728');
    bankBtn.style.position = 'absolute';
    bankBtn.style.bottom = `${clusterBottom}px`;
    bankBtn.style.right = `${clusterRight + btnSize + gap}px`;
    bankBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.touchBank = true; });
    bankBtn.addEventListener('touchend', () => { this.touchBank = false; });
    bankBtn.addEventListener('touchcancel', () => { this.touchBank = false; });
    root.appendChild(bankBtn);

    // 180 button (bottom-right of cluster)
    const uTurnBtn = makeActionBtn('180', 'rgba(255,200,50,0.45)', '\u21BA');
    uTurnBtn.style.position = 'absolute';
    uTurnBtn.style.bottom = `${clusterBottom}px`;
    uTurnBtn.style.right = `${clusterRight}px`;
    uTurnBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.touchUTurn = true; });
    uTurnBtn.addEventListener('touchend', () => { this.touchUTurn = false; });
    uTurnBtn.addEventListener('touchcancel', () => { this.touchUTurn = false; });
    root.appendChild(uTurnBtn);

    // GRAB button (right column, above 180)
    const grabBtn = makeActionBtn('GRAB', 'rgba(85,170,255,0.45)', '\u270B');
    grabBtn.style.position = 'absolute';
    grabBtn.style.bottom = `${clusterBottom + (btnSize + gap) * 2}px`;
    grabBtn.style.right = `${clusterRight}px`;
    grabBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this._lastInputTimestamp = performance.now();
      this.touchGrabPressed = true;
    });
    root.appendChild(grabBtn);

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

    // Show visual joystick at touch origin
    if (this.joyBase && this.joyThumb) {
      this.joyBase.style.display = 'block';
      this.joyBase.style.left = `${t.clientX}px`;
      this.joyBase.style.top = `${t.clientY}px`;
      this.joyThumb.style.display = 'block';
      this.joyThumb.style.left = `${t.clientX}px`;
      this.joyThumb.style.top = `${t.clientY}px`;
    }

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
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = this.joyMaxDist;
        const clampedDist = Math.min(dist, maxDist);
        const angle = Math.atan2(dy, dx);
        const clampedX = Math.cos(angle) * clampedDist;
        const clampedY = Math.sin(angle) * clampedDist;

        this.joyAxis.h = Math.max(-1, Math.min(1, clampedX / maxDist));
        this.joyAxis.v = Math.max(-1, Math.min(1, -clampedY / maxDist)); // up = positive

        // Map vertical axis to fly up / dive
        this.touchAscend = this.joyAxis.v > 0.6;
        this.touchDive = this.joyAxis.v < -0.6;

        // Update visual thumb position
        if (this.joyThumb) {
          this.joyThumb.style.left = `${this.joyOrigin.x + clampedX}px`;
          this.joyThumb.style.top = `${this.joyOrigin.y + clampedY}px`;
        }
      }
    }
  }

  private onJoyEnd(e: TouchEvent): void {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.joyTouchId) {
        this.joyTouchId = null;
        this.joyAxis.h = 0;
        this.joyAxis.v = 0;
        this.touchAscend = false;
        this.touchDive = false;

        // Hide visual joystick
        if (this.joyBase) this.joyBase.style.display = 'none';
        if (this.joyThumb) this.joyThumb.style.display = 'none';
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
        this._mouseDx += (t.clientX - this.camLastPos.x) * 0.3;
        this._mouseDy += (t.clientY - this.camLastPos.y) * 0.3;
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
    const rawTouch = name === 'horizontal' ? this.joyAxis.h : this.joyAxis.v;
    // Apply a quadratic response curve on touch to reduce sensitivity near center
    const touch = this.isTouchDevice
      ? Math.sign(rawTouch) * rawTouch * rawTouch * 0.8
      : rawTouch;
    return Math.abs(touch) > Math.abs(kb) ? touch : kb;
  }

  isAscending(): boolean {
    return this.isDown(this.bindings.ascend) || this.touchAscend;
  }

  isFastDescending(): boolean {
    return this.isDown(this.bindings.fastDescend) || this.touchDive;
  }

  isDive(): boolean {
    return this.isDown(this.bindings.dive);
  }

  isGentleDescending(): boolean {
    // Keep Tab as a secondary fallback so existing muscle memory still works.
    return this.isDown(this.bindings.gentleDescend) || this.isDown('Tab');
  }

  isMoveForwardHeld(): boolean {
    return this.isDown(this.bindings.moveForward) || this.isDown('ArrowUp') || this.joyAxis.v > 0.4;
  }

  isBrakeHeld(): boolean {
    return this.isDown(this.bindings.moveBackward) || this.isDown('ArrowDown') || this.joyAxis.v < -0.4;
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

  wasBomberModePressed(): boolean {
    return this.wasPressed(this.bindings.bomberMode);
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

  wasGrabPressed(): boolean {
    return this._rightMouseClicked || this.touchGrabPressed;
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
    this.touchGrabPressed = false;
    // touchDrop is held (not one-shot), so don't clear it here
  }
}
