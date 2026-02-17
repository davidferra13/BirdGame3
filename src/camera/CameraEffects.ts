import * as THREE from 'three';

export class CameraEffects {
  private camera: THREE.PerspectiveCamera;

  // Impact cam / hit cam
  private impactCamActive = false;
  private impactCamTimer = 0;
  private impactCamDuration = 0.15; // Brief slow-mo burst
  private impactCamZoomTarget = 0;
  private impactCamZoomCurrent = 0;

  // Screen shake
  private shakeIntensity = 0;
  private shakeTimer = 0;
  private shakeOffset = new THREE.Vector3();

  // Time scale
  timeScale = 1.0;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  update(dt: number): void {
    const realDt = dt; // Real delta time before time scaling

    // Impact cam slow-mo
    if (this.impactCamActive) {
      this.impactCamTimer -= realDt;

      if (this.impactCamTimer > 0) {
        // Slow-mo active
        const progress = 1 - (this.impactCamTimer / this.impactCamDuration);

        if (progress < 0.3) {
          // Ramp into slow-mo
          this.timeScale = 1.0 - (progress / 0.3) * 0.6; // Slow to 40%
          this.impactCamZoomCurrent += (this.impactCamZoomTarget - this.impactCamZoomCurrent) * 8 * realDt;
        } else if (progress < 0.7) {
          // Hold slow-mo
          this.timeScale = 0.4;
        } else {
          // Ramp out of slow-mo
          const exitProgress = (progress - 0.7) / 0.3;
          this.timeScale = 0.4 + exitProgress * 0.6; // Speed back to 100%
          this.impactCamZoomCurrent += (0 - this.impactCamZoomCurrent) * 10 * realDt;
        }
      } else {
        // Impact cam complete
        this.impactCamActive = false;
        this.timeScale = 1.0;
        this.impactCamZoomCurrent = 0;
      }
    } else {
      // Ensure time scale returns to normal
      this.timeScale = 1.0;
      this.impactCamZoomCurrent += (0 - this.impactCamZoomCurrent) * 5 * realDt;
    }

    // Screen shake
    if (this.shakeTimer > 0) {
      this.shakeTimer -= realDt;

      // Random shake offset
      const decay = this.shakeTimer / 0.3;
      this.shakeOffset.set(
        (Math.random() - 0.5) * this.shakeIntensity * decay,
        (Math.random() - 0.5) * this.shakeIntensity * decay,
        0
      );
    } else {
      this.shakeOffset.set(0, 0, 0);
    }
  }

  triggerImpactCam(hitValue: number): void {
    // Trigger on most hits for cinematic feel
    if (hitValue < 5) return;

    this.impactCamActive = true;
    this.impactCamDuration = hitValue >= 20 ? 0.2 : 0.12;
    this.impactCamTimer = this.impactCamDuration;

    // Zoom amount based on hit value
    this.impactCamZoomTarget = Math.min(hitValue / 50, 3);
  }

  triggerScreenShake(intensity: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTimer = 0.3;
  }

  getImpactCamZoom(): number {
    return this.impactCamZoomCurrent;
  }

  getShakeOffset(): THREE.Vector3 {
    return this.shakeOffset;
  }

  getTimeScale(): number {
    return this.timeScale;
  }

  reset(): void {
    this.impactCamActive = false;
    this.impactCamTimer = 0;
    this.timeScale = 1.0;
    this.shakeIntensity = 0;
    this.shakeTimer = 0;
    this.shakeOffset.set(0, 0, 0);
    this.impactCamZoomCurrent = 0;
  }
}
