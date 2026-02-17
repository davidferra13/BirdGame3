import { Bird } from '../entities/Bird';

const EMOTES = [
  { key: 1, name: 'SQUAWK', icon: '!' },
  { key: 2, name: 'FLAP', icon: '~' },
  { key: 3, name: 'SPIN', icon: '*' },
  { key: 4, name: 'SALUTE', icon: '^' },
];

export class EmoteWheel {
  private container: HTMLElement;
  private activeEmote: { name: string; timer: number } | null = null;
  private floatingEl: HTMLElement | null = null;

  constructor() {
    this.container = document.getElementById('hud')!;

    // Hints
    const hints = document.createElement('div');
    hints.style.cssText =
      'position:absolute;bottom:80px;left:16px;font-size:10px;color:rgba(255,255,255,0.3);line-height:1.6;';
    hints.innerHTML = EMOTES.map(e => `${e.key}: ${e.name}`).join('<br>');
    this.container.appendChild(hints);
  }

  trigger(key: number, bird: Bird): void {
    const emote = EMOTES.find(e => e.key === key);
    if (!emote) return;

    this.activeEmote = { name: emote.name, timer: 1.5 };

    // Show floating text above bird
    if (this.floatingEl) this.floatingEl.remove();
    this.floatingEl = document.createElement('div');
    this.floatingEl.style.cssText =
      'position:absolute;top:35%;left:50%;transform:translateX(-50%);font-size:24px;font-weight:bold;color:#ffdd44;text-shadow:0 0 10px rgba(255,221,68,0.5),2px 2px 4px rgba(0,0,0,0.8);letter-spacing:3px;pointer-events:none;';
    this.floatingEl.textContent = emote.name;
    this.container.appendChild(this.floatingEl);

    // Trigger bird animation based on emote
    this.playEmoteAnimation(emote.key, bird);
  }

  private playEmoteAnimation(key: number, bird: Bird): void {
    const mesh = bird.mesh;
    switch (key) {
      case 3: // Spin
        {
          const startRot = mesh.rotation.y;
          const duration = 500;
          const start = performance.now();
          const spin = () => {
            const t = (performance.now() - start) / duration;
            if (t < 1) {
              mesh.rotation.y = startRot + t * Math.PI * 2;
              requestAnimationFrame(spin);
            } else {
              mesh.rotation.y = startRot;
            }
          };
          requestAnimationFrame(spin);
        }
        break;
      case 2: // Flap taunt — quick scale pulse
        mesh.scale.set(1.3, 0.8, 1.3);
        setTimeout(() => mesh.scale.set(0.8, 1.3, 0.8), 150);
        setTimeout(() => mesh.scale.set(1, 1, 1), 300);
        break;
    }
  }

  update(dt: number): void {
    if (this.activeEmote) {
      this.activeEmote.timer -= dt;
      if (this.activeEmote.timer <= 0) {
        this.activeEmote = null;
        if (this.floatingEl) {
          this.floatingEl.remove();
          this.floatingEl = null;
        }
      } else if (this.floatingEl) {
        this.floatingEl.style.opacity = `${Math.min(1, this.activeEmote.timer / 0.3)}`;
      }
    }
  }
}
