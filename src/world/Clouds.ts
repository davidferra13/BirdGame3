import * as THREE from 'three';

/**
 * Cloud system with layered sprite billboards for volumetric appearance.
 * Uses Sprites for automatic camera-facing behavior (no more flat horizontal planes).
 * Each cloud is a group of 2-3 stacked sprites for depth.
 */
export class CloudSystem {
  readonly group = new THREE.Group();
  private clouds: THREE.Group[] = [];
  private speeds: number[] = [];

  constructor() {
    this.createClouds();
  }

  private createClouds(): void {
    // Create 3 texture variants for shape diversity
    const textures = [
      this.createCloudTexture(0.95, 1.0),   // big fluffy cumulus
      this.createCloudTexture(0.80, 0.9),   // less wispy, still round
      this.createCloudTexture(1.0, 1.2),    // thick dense
    ];
    const cloudCount = 25;  // Reduced from 50 for performance

    for (let i = 0; i < cloudCount; i++) {
      const cloudGroup = new THREE.Group();
      const baseScale = 60 + Math.random() * 130;
      const layerCount = 2 + Math.floor(Math.random() * 2); // 2-3 layers

      for (let layer = 0; layer < layerCount; layer++) {
        const texture = textures[Math.floor(Math.random() * textures.length)];
        const layerScale = baseScale * (1 - layer * 0.12);

        const spriteMat = new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          opacity: (0.7 + Math.random() * 0.2) * (1 - layer * 0.1),
          depthWrite: false,
          fog: false,
        });

        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(
          layerScale,
          layerScale * (0.25 + Math.random() * 0.18),
          1,
        );
        sprite.position.set(
          (Math.random() - 0.5) * baseScale * 0.15,
          layer * 4,
          (Math.random() - 0.5) * baseScale * 0.1,
        );
        cloudGroup.add(sprite);
      }

      cloudGroup.position.set(
        (Math.random() - 0.5) * 2400,
        130 + Math.random() * 130,
        (Math.random() - 0.5) * 2400,
      );

      this.group.add(cloudGroup);
      this.clouds.push(cloudGroup);
      this.speeds.push(1.5 + Math.random() * 4);
    }
  }

  private createCloudTexture(density: number, spread: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 256, 128);

    const drawBlob = (cx: number, cy: number, rx: number, ry: number, alpha: number) => {
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
      gradient.addColorStop(0, `rgba(255, 252, 245, ${alpha * density})`);
      gradient.addColorStop(0.3, `rgba(255, 252, 245, ${alpha * density * 0.7})`);
      gradient.addColorStop(0.6, `rgba(255, 252, 245, ${alpha * density * 0.3})`);
      gradient.addColorStop(1, 'rgba(255, 252, 245, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * spread, ry * spread, 0, 0, Math.PI * 2);
      ctx.fill();
    };

    // Layered blobs for organic cloud shape
    drawBlob(128, 64, 100, 45, 0.8);
    drawBlob(70, 60, 60, 32, 0.7);
    drawBlob(180, 58, 65, 35, 0.7);
    drawBlob(110, 48, 50, 26, 0.9);
    drawBlob(155, 72, 45, 23, 0.6);
    drawBlob(90, 68, 40, 20, 0.5);
    // Extra blobs for fullness
    drawBlob(50, 55, 35, 25, 0.4);
    drawBlob(200, 65, 35, 22, 0.45);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  update(dt: number): void {
    for (let i = 0; i < this.clouds.length; i++) {
      this.clouds[i].position.x += this.speeds[i] * dt;

      if (this.clouds[i].position.x > 1300) {
        this.clouds[i].position.x = -1300;
        this.clouds[i].position.z = (Math.random() - 0.5) * 2400;
      }
    }
  }
}
