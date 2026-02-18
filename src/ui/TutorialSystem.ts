export class TutorialSystem {
  private container: HTMLElement;
  private steps: { text: string; condition: string; dismissed: boolean }[];
  private currentStep = 0;
  private stepElement: HTMLElement | null = null;
  private fadeTimer = 0;
  private completed = false;

  // Scripted "Drop it." hook (first 10 seconds)
  private hookElement: HTMLElement | null = null;
  private hookActive = true;
  hookDismissed = false;

  // Tracking first successes
  hasFlown = false;
  hasMoved = false;
  hasDropped = false;
  hasBanked = false;
  hasReachedHighHeat = false;
  hasHitNPC = false;

  constructor() {
    this.container = document.getElementById('hud')!;

    // 5 overlay prompts per spec
    this.steps = [
      { text: 'W/A/S/D + Mouse — Forward, Brake, Turn, Look', condition: 'move', dismissed: false },
      { text: 'SPACE to Fly Up', condition: 'fly', dismissed: false },
      { text: 'CLICK to Drop', condition: 'drop', dismissed: false },
      { text: 'High Heat = WANTED = Danger!', condition: 'heat', dismissed: false },
      { text: 'Fly to the Green Beam to BANK', condition: 'bank', dismissed: false },
    ];

    // Show the scripted "Drop it." hook first
    this.showHook();
  }

  private showHook(): void {
    this.hookElement = document.createElement('div');
    this.hookElement.style.cssText =
      'position:absolute;top:40%;left:50%;transform:translate(-50%,-50%);' +
      'font-size:36px;font-weight:bold;color:rgba(255,255,255,0.9);' +
      'text-shadow:0 0 15px rgba(255,255,255,0.5),2px 2px 6px rgba(0,0,0,0.8);' +
      'pointer-events:none;letter-spacing:4px;text-align:center;transition:opacity 1s;';
    this.hookElement.textContent = 'Drop it.';
    this.container.appendChild(this.hookElement);
  }

  /** Call when the first poop is dropped to dismiss the hook */
  dismissHook(): void {
    if (!this.hookActive) return;
    this.hookActive = false;
    this.hookDismissed = true;
    if (this.hookElement) {
      this.hookElement.style.opacity = '0';
      const el = this.hookElement;
      setTimeout(() => el.remove(), 1000);
      this.hookElement = null;
    }
    // Start normal tutorial prompts after a brief pause
    setTimeout(() => this.showCurrentStep(), 1500);
  }

  private showCurrentStep(): void {
    if (this.currentStep >= this.steps.length) {
      this.completed = true;
      return;
    }

    if (this.stepElement) this.stepElement.remove();

    this.stepElement = document.createElement('div');
    this.stepElement.style.cssText =
      'position:absolute;top:45%;left:50%;transform:translate(-50%,-50%);' +
      'font-size:22px;font-weight:bold;color:rgba(255,255,255,0.85);' +
      'text-shadow:2px 2px 6px rgba(0,0,0,0.8);pointer-events:none;' +
      'letter-spacing:2px;text-align:center;transition:opacity 1s;';
    this.stepElement.textContent = this.steps[this.currentStep].text;
    this.container.appendChild(this.stepElement);
    this.fadeTimer = 0;
  }

  update(dt: number): void {
    // Hook phase: just wait for dismissHook() to be called
    if (this.hookActive) return;

    if (this.completed) return;

    const step = this.steps[this.currentStep];
    if (!step) return;

    // Check dismissal conditions
    let dismiss = false;
    switch (step.condition) {
      case 'move': dismiss = this.hasMoved; break;
      case 'fly': dismiss = this.hasFlown; break;
      case 'drop': dismiss = this.hasDropped; break;
      case 'heat': dismiss = this.hasReachedHighHeat; break;
      case 'bank': dismiss = this.hasBanked; break;
    }

    if (dismiss) {
      step.dismissed = true;
      if (this.stepElement) {
        this.stepElement.style.opacity = '0';
        const el = this.stepElement;
        setTimeout(() => el.remove(), 1000);
      }
      this.currentStep++;
      setTimeout(() => this.showCurrentStep(), 1500);
      return;
    }

    // Auto-dismiss after 15 seconds
    this.fadeTimer += dt;
    if (this.fadeTimer > 12 && this.stepElement) {
      this.stepElement.style.opacity = String(Math.max(0, 1 - (this.fadeTimer - 12) / 3));
    }
    if (this.fadeTimer > 15) {
      step.dismissed = true;
      if (this.stepElement) this.stepElement.remove();
      this.currentStep++;
      this.showCurrentStep();
    }
  }

  /** Completion per spec: hit 1 NPC, reach Heat 5, bank once */
  get isComplete(): boolean {
    return this.completed || (this.hasHitNPC && this.hasReachedHighHeat && this.hasBanked);
  }

  /** Reset tutorial for replay from Settings */
  reset(): void {
    this.completed = false;
    this.hookActive = false;
    this.hookDismissed = false;
    this.currentStep = 0;
    this.hasFlown = false;
    this.hasMoved = false;
    this.hasDropped = false;
    this.hasBanked = false;
    this.hasReachedHighHeat = false;
    this.hasHitNPC = false;

    for (const step of this.steps) {
      step.dismissed = false;
    }

    if (this.stepElement) this.stepElement.remove();
    if (this.hookElement) this.hookElement.remove();
    this.stepElement = null;
    this.hookElement = null;

    this.showCurrentStep();
  }
}
