/**
 * Full-screen poop splatter overlay effect for Poop Tag mode.
 *
 * Plays on the tagged player's screen when they get hit — dramatic, unmistakable,
 * and funny. Pure DOM/CSS implementation with no external assets or dependencies.
 *
 * @example
 * ```ts
 * const effect = new PoopTagHitEffect();
 * effect.trigger(); // play the splatter
 * // later...
 * effect.dispose(); // clean up
 * ```
 */
export default class PoopTagHitEffect {
  private container: HTMLElement | null = null;
  private timeouts: number[] = [];
  private isPlaying = false;

  /**
   * Triggers the poop splatter effect across the full screen.
   * If already playing, resets and replays cleanly (idempotent).
   */
  public trigger(): void {
    // Reset if already playing
    if (this.isPlaying) {
      this.cleanup();
    }
    this.isPlaying = true;

    // Create overlay container
    const container = document.createElement('div');
    container.style.cssText =
      'position:fixed;top:0;left:0;width:100vw;height:100vh;' +
      'z-index:9000;pointer-events:none;overflow:hidden;';
    document.body.appendChild(container);
    this.container = container;

    // Generate 8-12 splats across the viewport
    const splatCount = 8 + Math.floor(Math.random() * 5);
    const positions = this.generateSplatPositions(splatCount);

    for (let i = 0; i < splatCount; i++) {
      const { x, y } = positions[i];
      const size = 80 + Math.random() * 160; // 80–240px
      const rotation = Math.random() * 360;
      const splatGroup = this.createSplatGroup(x, y, size, rotation);

      // Start invisible and scaled up for impact animation
      splatGroup.style.opacity = '0';
      splatGroup.style.transform =
        `translate(-50%, -50%) rotate(${rotation}deg) scale(1.4)`;
      container.appendChild(splatGroup);

      // Stagger appearance over ~100ms for rapid-fire burst
      const delay = (i / splatCount) * 100;
      const tid = window.setTimeout(() => {
        splatGroup.style.transition =
          'opacity 60ms ease-out, transform 180ms cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        splatGroup.style.opacity = '1';
        splatGroup.style.transform =
          `translate(-50%, -50%) rotate(${rotation}deg) scale(1)`;
      }, delay);
      this.timeouts.push(tid);
    }

    // Add 2-3 drip trails from upper-area splats
    const dripCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < dripCount; i++) {
      const dripX = 10 + Math.random() * 80; // vw
      const dripY = 5 + Math.random() * 35;  // vh — upper portion
      const drip = this.createDrip(dripX, dripY);
      container.appendChild(drip);

      // Start the drip sliding down after a short delay
      const dripTid = window.setTimeout(() => {
        drip.style.transition = 'transform 900ms ease-in';
        drip.style.transform = `translateY(${60 + Math.random() * 80}px)`;
      }, 150 + Math.random() * 100);
      this.timeouts.push(dripTid);
    }

    // T+600ms: Begin fade-out with downward drift
    const fadeTid = window.setTimeout(() => {
      if (!this.container) return;
      const children = this.container.children;
      for (let i = 0; i < children.length; i++) {
        const el = children[i] as HTMLElement;
        const currentTransform = el.style.transform || '';
        el.style.transition =
          'opacity 600ms ease-in, transform 600ms ease-in';
        el.style.opacity = '0';
        el.style.transform = currentTransform + ' translateY(30px)';
      }
    }, 600);
    this.timeouts.push(fadeTid);

    // T+1200ms: Remove all DOM elements
    const cleanupTid = window.setTimeout(() => {
      this.cleanup();
    }, 1200);
    this.timeouts.push(cleanupTid);
  }

  /**
   * Disposes the effect, removing all DOM elements and clearing pending timers.
   * Safe to call at any time, even when no effect is playing.
   */
  public dispose(): void {
    this.cleanup();
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private cleanup(): void {
    for (const tid of this.timeouts) {
      window.clearTimeout(tid);
    }
    this.timeouts.length = 0;

    if (this.container && this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
    this.container = null;
    this.isPlaying = false;
  }

  /**
   * Spreads splat positions across the viewport so they cover 70-85% of the
   * screen without excessive clustering.
   */
  private generateSplatPositions(
    count: number,
  ): { x: number; y: number }[] {
    const positions: { x: number; y: number }[] = [];
    // Divide screen into a rough grid and jitter within each cell
    const cols = Math.ceil(Math.sqrt(count * 1.5));
    const rows = Math.ceil(count / cols);
    const cellW = 100 / cols;
    const cellH = 100 / rows;

    for (let r = 0; r < rows && positions.length < count; r++) {
      for (let c = 0; c < cols && positions.length < count; c++) {
        positions.push({
          x: cellW * c + Math.random() * cellW,
          y: cellH * r + Math.random() * cellH,
        });
      }
    }

    // Shuffle so stagger order isn't grid-sequential
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    return positions;
  }

  /**
   * Creates a splat group: one main blob plus 2-4 satellite blobs arranged
   * around it to form an organic impact shape.
   */
  private createSplatGroup(
    x: number,
    y: number,
    size: number,
    rotation: number,
  ): HTMLElement {
    const group = document.createElement('div');
    group.style.cssText =
      `position:absolute;left:${x}vw;top:${y}vh;` +
      `transform:translate(-50%,-50%) rotate(${rotation}deg);`;

    // Main blob
    const mainW = size;
    const mainH = size * (0.75 + Math.random() * 0.5);
    const main = document.createElement('div');
    main.style.cssText =
      `position:absolute;left:50%;top:50%;` +
      `transform:translate(-50%,-50%);` +
      `width:${mainW}px;height:${mainH}px;` +
      `background:radial-gradient(ellipse at 38% 35%,` +
        `#8B6914 0%,#6B4E10 25%,#4A3409 55%,#2E2006 80%,#1C1404 100%);` +
      `border-radius:${this.randomRadius()};` +
      `box-shadow:inset 0 -4px 12px rgba(0,0,0,0.4),` +
        `inset 0 2px 6px rgba(160,120,40,0.2);`;
    group.appendChild(main);

    // Satellite blobs (2-4)
    const satCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < satCount; i++) {
      const satSize = size * (0.18 + Math.random() * 0.25);
      const angle = Math.random() * Math.PI * 2;
      const dist = size * (0.35 + Math.random() * 0.3);
      const sx = Math.cos(angle) * dist;
      const sy = Math.sin(angle) * dist;

      const sat = document.createElement('div');
      const satH = satSize * (0.65 + Math.random() * 0.7);
      sat.style.cssText =
        `position:absolute;` +
        `left:calc(50% + ${sx.toFixed(1)}px);` +
        `top:calc(50% + ${sy.toFixed(1)}px);` +
        `transform:translate(-50%,-50%) rotate(${Math.random() * 360}deg);` +
        `width:${satSize.toFixed(1)}px;height:${satH.toFixed(1)}px;` +
        `background:radial-gradient(ellipse at 40% 38%,` +
          `#7A5C12 0%,#553D0A 45%,#2E2006 100%);` +
        `border-radius:${this.randomRadius()};` +
        `box-shadow:inset 0 -2px 6px rgba(0,0,0,0.35);`;
      group.appendChild(sat);
    }

    return group;
  }

  /**
   * Creates a drip trail element — a narrow, elongated blob that slides
   * downward during the effect.
   */
  private createDrip(x: number, startY: number): HTMLElement {
    const width = 6 + Math.random() * 10;
    const height = 35 + Math.random() * 55;

    const drip = document.createElement('div');
    drip.style.cssText =
      `position:absolute;left:${x}vw;top:${startY}vh;` +
      `width:${width.toFixed(1)}px;height:${height.toFixed(1)}px;` +
      `background:linear-gradient(to bottom,` +
        `#5C3A08 0%,#3D2506 55%,rgba(61,37,6,0) 100%);` +
      `border-radius:${(width / 2).toFixed(1)}px ` +
        `${(width / 2).toFixed(1)}px ` +
        `${width.toFixed(1)}px ${width.toFixed(1)}px;` +
      `opacity:0.85;transform:translateY(0);`;

    return drip;
  }

  /** Generates a random organic 8-value border-radius string. */
  private randomRadius(): string {
    const r = () => (30 + Math.random() * 30).toFixed(0);
    return `${r()}% ${r()}% ${r()}% ${r()}% / ${r()}% ${r()}% ${r()}% ${r()}%`;
  }
}
