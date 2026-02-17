import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAPass } from 'three/examples/jsm/postprocessing/FXAAPass.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';
import { ColorCorrectionShader } from 'three/examples/jsm/shaders/ColorCorrectionShader.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/**
 * Post-processing pipeline for cinematic visual quality.
 * Bloom, FXAA anti-aliasing, vignette, and color grading.
 */
export class PostProcessing {
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private fxaaPass: FXAAPass;
  private vignettePass: ShaderPass;
  private colorPass: ShaderPass;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) {
    // Cinematic tone mapping
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.composer = new EffectComposer(renderer);

    // Main scene render
    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // Bloom: subtle glow on bright objects (sanctuary beam, lit windows, neon signs)
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.15,  // strength — subtle, no haze
      0.3,   // radius — tight spread
      0.9,   // threshold — only very bright emissives bloom
    );
    this.composer.addPass(this.bloomPass);

    // FXAA anti-aliasing (cheap post-process AA since renderer has antialias: false)
    this.fxaaPass = new FXAAPass();
    this.fxaaPass.setSize(
      window.innerWidth * renderer.getPixelRatio(),
      window.innerHeight * renderer.getPixelRatio(),
    );
    this.composer.addPass(this.fxaaPass);

    // Subtle vignette for cinematic framing
    this.vignettePass = new ShaderPass(VignetteShader);
    this.vignettePass.uniforms['offset'].value = 1.2;
    this.vignettePass.uniforms['darkness'].value = 0.8;
    this.composer.addPass(this.vignettePass);

    // Color correction — slight warm shift for golden-hour feel
    this.colorPass = new ShaderPass(ColorCorrectionShader);
    this.colorPass.uniforms['powRGB'].value.set(1.0, 1.0, 1.0);
    this.colorPass.uniforms['mulRGB'].value.set(1.05, 1.0, 0.95);
    this.composer.addPass(this.colorPass);

    // Output pass for correct color space
    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  render(): void {
    this.composer.render();
  }

  setSize(width: number, height: number, pixelRatio = 1): void {
    this.composer.setSize(width, height);
    this.fxaaPass.setSize(width * pixelRatio, height * pixelRatio);
  }

  setBloomStrength(strength: number): void {
    this.bloomPass.strength = strength;
  }

  setBloomThreshold(threshold: number): void {
    this.bloomPass.threshold = threshold;
  }

  setVignetteDarkness(darkness: number): void {
    this.vignettePass.uniforms['darkness'].value = darkness;
  }

  setColorGrading(r: number, g: number, b: number): void {
    this.colorPass.uniforms['mulRGB'].value.set(r, g, b);
  }
}
