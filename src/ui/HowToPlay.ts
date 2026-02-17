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
      max-width: 700px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    `;

    // Title
    const title = document.createElement('div');
    title.style.cssText = `
      font-size: 32px;
      font-weight: bold;
      color: #fff;
      text-align: center;
      margin-bottom: 10px;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    `;
    title.textContent = '🎮 HOW TO PLAY';
    panel.appendChild(title);

    // Subtitle
    const subtitle = document.createElement('div');
    subtitle.style.cssText = `
      text-align: center;
      color: rgba(255, 255, 255, 0.7);
      margin-bottom: 30px;
      font-size: 14px;
    `;
    subtitle.textContent = 'Master the skies and become the ultimate pooping bird!';
    panel.appendChild(subtitle);

    // Controls content
    const content = document.createElement('div');
    content.style.cssText = `
      color: #fff;
      line-height: 1.8;
    `;

    const row = (key: string, desc: string) =>
      `<div style="display:flex;justify-content:space-between;margin-bottom:6px;">` +
      `<span style="color:#FFD700;font-family:'Courier New',monospace;font-weight:bold;min-width:120px;">${key}</span>` +
      `<span style="color:#ddd;flex:1;text-align:right;">${desc}</span></div>`;

    const section = (title: string, color: string, icon: string, rows: string) =>
      `<div style="margin-bottom:20px;">` +
      `<div style="font-size:18px;font-weight:bold;color:${color};margin-bottom:10px;">${icon} ${title}</div>` +
      `<div style="background:rgba(0,0,0,0.3);padding:14px;border-radius:8px;border-left:3px solid ${color};">${rows}</div></div>`;

    content.innerHTML =
      section('Movement', '#87ceeb', '✈️',
        row('W / ↑', 'Move Forward / Pitch Up') +
        row('S / ↓', 'Move Backward / Brake') +
        row('A / ←', 'Move Left / Turn Left') +
        row('D / →', 'Move Right / Turn Right') +
        row('Mouse', 'Look Around / Steer')
      ) +

      section('Vertical Flight', '#80d0ff', '🔼',
        row('SPACE', 'Ascend / Fly Up') +
        row('L-CTRL', 'Fast Descend') +
        row('L-SHIFT', 'Dive') +
        row('TAB', 'Gentle Descent') +
        row('SHIFT + SPACE', 'Dive Bomb')
      ) +

      section('Actions', '#FFD700', '💩',
        row('LEFT CLICK', 'Drop Poop') +
        row('RIGHT CLICK', 'Free Look / Camera') +
        row('T', 'Boost (Speed Burst)') +
        row('Z', 'Interact / Bank / Land') +
        row('` (Backtick)', 'U-Turn (180°)')
      ) +

      section('Abilities', '#FF80FF', '⚡',
        row('J', 'Use Equipped Ability') +
        row('U', 'Cycle Through Abilities')
      ) +

      section('Aerobatics', '#FF6B6B', '🌀',
        row('Q', 'Front Flip') +
        row('E', 'Back Flip') +
        row('R', 'Barrel Roll Left') +
        row('F', 'Barrel Roll Right') +
        row('T', 'Corkscrew Left') +
        row('Y', 'Corkscrew Right') +
        row('X', 'Side Flip Left') +
        row('C', 'Side Flip Right') +
        row('V', 'Inverted Flip') +
        row('N', 'Aileron Roll') +
        row('ALT + Flip Key', 'Double Flip Modifier')
      ) +

      section('Emotes', '#50C878', '🗣️',
        row('1', 'Squawk') +
        row('2', 'Flap') +
        row('3', 'Spin') +
        row('4', 'Salute')
      ) +

      section('Menu', '#9B59B6', '⚙️',
        row('ESC', 'Pause Menu')
      ) +

      section('Gameplay', '#FF6B6B', '🎯',
        `<div style="margin-bottom:8px;"><strong>1. Hit Targets:</strong> Drop poop on NPCs to earn coins and increase your heat level</div>` +
        `<div style="margin-bottom:8px;"><strong>2. Build Combos:</strong> Hit multiple targets in a row to build a streak multiplier</div>` +
        `<div style="margin-bottom:8px;"><strong>3. Watch Your Heat:</strong> Higher heat = more wanted = police chase you!</div>` +
        `<div style="margin-bottom:8px;"><strong>4. Bank Coins:</strong> Fly to the green beam (Sanctuary) to safely bank your coins</div>` +
        `<div style="margin-bottom:8px;"><strong>5. Avoid Ground:</strong> Flying too low will ground you and lose coins!</div>`
      ) +

      section('Pro Tips', '#9B59B6', '💡',
        `<div style="margin-bottom:6px;">• Aim for hotspots (red circles) for bonus coins</div>` +
        `<div style="margin-bottom:6px;">• Higher altitude = more time for poop to fall</div>` +
        `<div style="margin-bottom:6px;">• Bank regularly to avoid losing coins if grounded</div>` +
        `<div style="margin-bottom:6px;">• Different NPCs give different point values</div>` +
        `<div style="margin-bottom:6px;">• Maintain your combo for massive score multipliers</div>` +
        `<div style="margin-bottom:6px;">• All keys are remappable in Settings → Controls</div>`
      ) +

      `<div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.2);` +
      `color:rgba(255,255,255,0.5);font-size:13px;font-style:italic;">` +
      `"Remember: With great power comes great responsibility...to poop on everything!" 💩</div>`;
    panel.appendChild(content);

    // Close button
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
