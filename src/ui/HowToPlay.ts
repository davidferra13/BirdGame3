import {
  BINDINGS_STORAGE_KEY,
  DEFAULT_BINDINGS,
  type KeyBindings,
} from '../core/InputManager';
import { bindingToDisplayName } from './KeyDisplay';

function loadBindings(): KeyBindings {
  try {
    const stored = localStorage.getItem(BINDINGS_STORAGE_KEY);
    if (stored) return { ...DEFAULT_BINDINGS, ...JSON.parse(stored) };
  } catch {
    // Fallback to defaults when storage is unavailable.
  }
  return { ...DEFAULT_BINDINGS };
}

export class HowToPlay {
  private container: HTMLElement;
  private visible = false;
  private onClose: (() => void) | null = null;

  constructor() {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.8);
      z-index: 2000;
      font-family: 'Segoe UI', system-ui, sans-serif;
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
      background: linear-gradient(180deg, #1a2a3a 0%, #2a4a6a 100%);
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 12px;
      padding: 30px;
      max-width: 760px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    `;

    const title = document.createElement('div');
    title.style.cssText = `
      font-size: 32px;
      font-weight: bold;
      color: #fff;
      text-align: center;
      margin-bottom: 10px;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    `;
    title.textContent = 'HOW TO PLAY';
    panel.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.style.cssText = `
      text-align: center;
      color: rgba(255, 255, 255, 0.7);
      margin-bottom: 30px;
      font-size: 14px;
    `;
    subtitle.textContent = 'Earn coins by hitting targets, then bank safely at the Sanctuary.';
    panel.appendChild(subtitle);

    const content = document.createElement('div');
    content.style.cssText = `
      color: #fff;
      line-height: 1.8;
    `;

    const b = loadBindings();
    const key = (action: keyof KeyBindings) => bindingToDisplayName(b, action);

    const row = (keys: string, desc: string) =>
      `<div style="display:flex;justify-content:space-between;margin-bottom:6px;">` +
      `<span style="color:#FFD700;font-family:'Courier New',monospace;font-weight:bold;min-width:180px;">${keys}</span>` +
      `<span style="color:#ddd;flex:1;text-align:right;">${desc}</span></div>`;

    const section = (heading: string, color: string, rows: string) =>
      `<div style="margin-bottom:20px;">` +
      `<div style="font-size:18px;font-weight:bold;color:${color};margin-bottom:10px;">${heading}</div>` +
      `<div style="background:rgba(0,0,0,0.3);padding:14px;border-radius:8px;border-left:3px solid ${color};">${rows}</div></div>`;

    content.innerHTML =
      section('Movement', '#87ceeb',
        row(`${key('moveForward')} / UP`, 'Move Forward / Pitch Up') +
        row(`${key('moveBackward')} / DOWN`, 'Brake / Stop') +
        row(`${key('moveLeft')} / LEFT`, 'Move Left / Turn Left') +
        row(`${key('moveRight')} / RIGHT`, 'Move Right / Turn Right') +
        row('MOUSE', 'Look Around / Steer'),
      ) +
      section('Vertical Flight', '#80d0ff',
        row(key('ascend'), 'Ascend / Fly Up') +
        row(key('fastDescend'), 'Fast Descend') +
        row(key('dive'), 'Dive') +
        row(key('gentleDescend'), 'Precise Descend (Slow)') +
        row(`${key('dive')} + ${key('ascend')}`, 'Dive Bomb') +
        row(key('bomberMode'), 'Toggle Bomber Mode'),
      ) +
      section('Actions', '#FFD700',
        row('LEFT CLICK', 'Drop Poop') +
        row('RIGHT CLICK', 'Free Look / Camera (Horse: Lasso)') +
        row(key('boost'), 'Boost (Speed Burst)') +
        row(key('interact'), 'Interact / Bank / Land') +
        row(key('uTurn'), 'U-Turn (180)'),
      ) +
      section('Abilities', '#FF80FF',
        row(key('ability'), 'Use Equipped Ability') +
        row(key('abilityCycle'), 'Cycle Through Abilities'),
      ) +
      section('Aerobatics', '#FF6B6B',
        row(key('frontFlip'), 'Front Flip') +
        row(key('backFlip'), 'Back Flip') +
        row(key('leftBarrelRoll'), 'Barrel Roll Left') +
        row(key('rightBarrelRoll'), 'Barrel Roll Right') +
        row(key('corkscrewLeft'), 'Corkscrew Left') +
        row(key('corkscrewRight'), 'Corkscrew Right') +
        row(key('sideFlipLeft'), 'Side Flip Left') +
        row(key('sideFlipRight'), 'Side Flip Right') +
        row(key('invertedFlip'), 'Inverted Flip') +
        row(key('aileronRoll'), 'Aileron Roll') +
        row(`${key('dive')} + Flip Key`, 'Double Flip Modifier'),
      ) +
      section('Objective', '#50C878',
        `<div style="margin-bottom:8px;"><strong>1. Earn Coins:</strong> Hit NPCs and targets with poop.</div>` +
        `<div style="margin-bottom:8px;"><strong>2. Build Streaks:</strong> Chain hits for multiplier and faster gains.</div>` +
        `<div style="margin-bottom:8px;"><strong>3. Manage Heat:</strong> More heat gives more reward but higher danger.</div>` +
        `<div style="margin-bottom:8px;"><strong>4. Bank Often:</strong> Fly to the green beam and hold ${key('interact')} to bank.</div>` +
        `<div style="margin-bottom:8px;"><strong>5. Stay Off The Ground:</strong> Getting grounded drops unbanked coins.</div>`,
      ) +
      section('Vehicles &amp; Mounts', '#FFA500',
        row(`Approach + hold ${key('interact')}`, 'Enter car / mount horse') +
        row(key('interact'), 'Exit car / dismount') +
        row('WASD / MOUSE', 'Steer vehicle') +
        row('RMB (on horse)', 'Cast lasso at NPCs or players') +
        `<div style="margin-top:8px;color:#aaa;font-size:12px;">Cars earn heat — horses let you lasso targets!</div>`,
      ) +
      section('Pro Tips', '#9B59B6',
        `<div style="margin-bottom:6px;">- Aim for hotspots for bonus score windows.</div>` +
        `<div style="margin-bottom:6px;">- Bank before risky low-altitude passes.</div>` +
        `<div style="margin-bottom:6px;">- Rebind keys in Settings -> Controls anytime.</div>` +
        `<div style="margin-bottom:6px;">- Use combos plus timely banking for fastest progression.</div>`,
      );
    panel.appendChild(content);

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `
      display: block;
      width: 100%;
      margin-top: 20px;
      padding: 12px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 6px;
      color: #fff;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
    `;
    closeBtn.textContent = 'CLOSE';
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
      closeBtn.style.transform = 'scale(1.02)';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
      closeBtn.style.transform = 'scale(1)';
    });
    closeBtn.addEventListener('click', () => {
      this.hide();
      this.onClose?.();
    });
    panel.appendChild(closeBtn);

    this.container.appendChild(panel);
    document.body.appendChild(this.container);
  }

  show(): void {
    this.visible = true;
    this.container.style.display = 'flex';
  }

  hide(): void {
    this.visible = false;
    this.container.style.display = 'none';
  }

  setOnClose(callback: () => void): void {
    this.onClose = callback;
  }

  get isVisible(): boolean {
    return this.visible;
  }
}
