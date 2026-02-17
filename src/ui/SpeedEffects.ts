/**
 * SpeedEffects — screen-space visual feedback for velocity and impacts.
 *
 * - Speed lines: radial streaks that appear at screen edges during fast flight / dives
 * - Screen flash: brief white/gold overlay on big hits and combo tier-ups
 * - Vignette pulse: red vignette throb during low-altitude danger
 */

export class SpeedEffects {
    private lastFlashTime = 0;
  private container: HTMLElement;

  // Speed lines
  private speedLinesEl: HTMLElement;
  private currentOpacity = 0;

  // Screen flash
  private flashEl: HTMLElement;
  private flashTimer = 0;
  private flashDuration = 0;

  // Vignette
  private vignetteEl: HTMLElement;

  constructor() {
    this.container = document.getElementById('hud')!;

    // === Speed lines: CSS radial gradient that simulates motion streaks ===
    this.speedLinesEl = document.createElement('div');
    this.speedLinesEl.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;opacity:0;' +
      'background:radial-gradient(ellipse at center, transparent 30%, transparent 45%, ' +
      'rgba(255,255,255,0.03) 50%, transparent 52%, transparent 60%, ' +
      'rgba(255,255,255,0.05) 65%, transparent 68%, transparent 75%, ' +
      'rgba(255,255,255,0.04) 80%, transparent 83%, transparent 88%, ' +
      'rgba(255,255,255,0.08) 92%, rgba(255,255,255,0.12) 100%);' +
      'mix-blend-mode:screen;z-index:1;';
    this.container.appendChild(this.speedLinesEl);

    // === Screen flash overlay ===
    this.flashEl = document.createElement('div');
    this.flashEl.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;opacity:0;' +
      'background:radial-gradient(ellipse at center, rgba(255,255,255,0.8) 0%, rgba(255,215,0,0.3) 50%, transparent 80%);' +
      'mix-blend-mode:screen;z-index:2;';
    this.container.appendChild(this.flashEl);

    // === Danger vignette (low altitude with coins) ===
    this.vignetteEl = document.createElement('div');
    this.vignetteEl.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;opacity:0;' +
      'box-shadow:inset 0 0 120px rgba(255,30,30,0.5);z-index:1;transition:opacity 0.3s;';
    this.container.appendChild(this.vignetteEl);
  }

  update(dt: number, speed: number, maxSpeed: number, isDiving: boolean, isBoosting: boolean): void {
    // --- Speed lines ---
    // Calculate target opacity: ramps up with speed, stronger during dive/boost
    let speedFactor = Math.max(0, (speed - 30) / (maxSpeed - 30)); // 0 at base speed, 1 at max
    if (isDiving) speedFactor = Math.min(speedFactor * 1.5, 1);
    if (isBoosting) speedFactor = Math.min(speedFactor + 0.3, 1);

    const targetOpacity = speedFactor * 0.7;
    // Smooth transition
    this.currentOpacity += (targetOpacity - this.currentOpacity) * Math.min(dt * 5, 1);
    this.speedLinesEl.style.opacity = this.currentOpacity.toFixed(3);

    // Scale the gradient to give a "tunnel vision" effect at high speeds
    const scale = 1 + speedFactor * 0.15;
    this.speedLinesEl.style.transform = `scale(${scale.toFixed(3)})`;

    // --- Screen flash ---
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      const t = Math.max(0, this.flashTimer / this.flashDuration);
      // Fast flash in, slow fade out
      this.flashEl.style.opacity = (t * t).toFixed(3);
    } else {
      this.flashEl.style.opacity = '0';
    }
  }

  /** Trigger a screen flash for big hits. color: 'white' | 'gold' | 'red' */
  triggerFlash(intensity: number = 0.5, color: 'white' | 'gold' | 'red' = 'white'): void {
    const now = performance.now();
    // Debounce: only allow a flash every 200ms
    if (now - this.lastFlashTime < 200) return;
    this.lastFlashTime = now;
    const colors = {
      white: 'rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.2) 60%, transparent 85%',
      gold: 'rgba(255,215,0,0.8) 0%, rgba(255,170,0,0.3) 50%, transparent 80%',
      red: 'rgba(255,50,50,0.6) 0%, rgba(255,0,0,0.2) 60%, transparent 85%',
    };
    this.flashEl.style.background = `radial-gradient(ellipse at center, ${colors[color]})`;
    this.flashDuration = 0.15 + intensity * 0.15;
    this.flashTimer = this.flashDuration;
  }

  /** Show/hide the danger vignette. opacity 0-1 */
  setDangerVignette(opacity: number): void {
    this.vignetteEl.style.opacity = Math.min(1, Math.max(0, opacity)).toFixed(3);
  }
}
