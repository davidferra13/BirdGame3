import * as THREE from 'three';

export type MapId = 'default';

/**
 * Manages environment maps and scene background/lighting.
 */
export class EnvironmentSystem {
  private pmremGenerator: THREE.PMREMGenerator;

  constructor(private renderer: THREE.WebGLRenderer) {
    this.pmremGenerator = new THREE.PMREMGenerator(renderer);
    this.pmremGenerator.compileEquirectangularShader();
  }

  get activeMapId(): MapId {
    return 'default';
  }

  get isHDRActive(): boolean {
    return false;
  }

  dispose(): void {
    this.pmremGenerator.dispose();
  }
}
