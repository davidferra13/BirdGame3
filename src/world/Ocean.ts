import * as THREE from 'three';

/**
 * Animated ocean with vertex-displaced waves and foam.
 * Uses a custom shader for lightweight wave animation without
 * requiring extra render passes (unlike Water.js reflections).
 */
export class Ocean {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor() {
    const geometry = new THREE.PlaneGeometry(2200, 600, 120, 30);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDeepColor: { value: new THREE.Color(0x20B2AA) },
        uShallowColor: { value: new THREE.Color(0x48D1CC) },
        uFoamColor: { value: new THREE.Color(0xE0FFFF) },
        uOpacity: { value: 0.95 },
        fogColor: { value: new THREE.Color(0x87ceeb) },
        fogNear: { value: 2000.0 },
        fogFar: { value: 5000.0 },
      },
      vertexShader: /* glsl */ `
        #include <logdepthbuf_pars_vertex>
        uniform float uTime;
        varying vec2 vUv;
        varying float vElevation;
        varying float vFogDepth;

        void main() {
          vUv = uv;
          vec3 pos = position;

          // Gentle cartoon waves (reduced amplitude)
          float wave1 = sin(pos.x * 0.02 + uTime * 0.8) * 1.1;
          float wave2 = sin(pos.x * 0.05 + pos.y * 0.03 + uTime * 1.3) * 0.5;
          float wave3 = sin(pos.x * 0.01 - uTime * 0.4) * 1.8;
          float wave4 = cos(pos.y * 0.04 + uTime * 0.7) * 0.7;
          float wave5 = sin(pos.x * 0.08 + pos.y * 0.06 - uTime * 1.8) * 0.25;

          pos.z = wave1 + wave2 + wave3 + wave4 + wave5;
          vElevation = pos.z;

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          vFogDepth = -mvPosition.z;
          gl_Position = projectionMatrix * mvPosition;
          #include <logdepthbuf_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        #include <logdepthbuf_pars_fragment>
        uniform vec3 uDeepColor;
        uniform vec3 uShallowColor;
        uniform vec3 uFoamColor;
        uniform float uOpacity;
        uniform float uTime;
        uniform vec3 fogColor;
        uniform float fogNear;
        uniform float fogFar;
        varying vec2 vUv;
        varying float vElevation;
        varying float vFogDepth;

        void main() {
          #include <logdepthbuf_fragment>
          // Cartoon banding: hard steps instead of smooth gradients
          float depthMix = step(0.0, vElevation) * 0.5 + step(1.5, vElevation) * 0.5;
          vec3 color = mix(uDeepColor, uShallowColor, depthMix);

          // Foam on wave crests — sharper threshold
          float foam = step(1.8, vElevation);
          color = mix(color, uFoamColor, foam * 0.4);

          // Subtle sparkle/shimmer (reduced)
          float sparkle = pow(max(0.0, sin(vUv.x * 300.0 + uTime * 2.5) *
                           sin(vUv.y * 200.0 + uTime * 1.8)), 10.0) * 0.12;
          color += vec3(sparkle);

          // Apply fog
          float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
          color = mix(color, fogColor, fogFactor);

          gl_FragColor = vec4(color, uOpacity);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(0, -0.3, 950);
  }

  update(elapsed: number): void {
    this.material.uniforms.uTime.value = elapsed;
  }

  setFogParams(color: THREE.Color, near: number, far: number): void {
    this.material.uniforms.fogColor.value.copy(color);
    this.material.uniforms.fogNear.value = near;
    this.material.uniforms.fogFar.value = far;
  }
}
