export class GameLoop {
  private lastTime = 0;
  private readonly MAX_DT = 1 / 30;
  private running = false;
  private onUpdate: (dt: number) => void;
  private onRender: () => void;
  private onFrameEnd: () => void;

  constructor(
    onUpdate: (dt: number) => void,
    onRender: () => void,
    onFrameEnd: () => void,
  ) {
    this.onUpdate = onUpdate;
    this.onRender = onRender;
    this.onFrameEnd = onFrameEnd;
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
  }

  private tick = (now: number): void => {
    if (!this.running) return;

    const rawDt = (now - this.lastTime) / 1000;
    const dt = Math.min(rawDt, this.MAX_DT);
    this.lastTime = now;

    this.onUpdate(dt);
    this.onRender();
    this.onFrameEnd();

    requestAnimationFrame(this.tick);
  };
}
