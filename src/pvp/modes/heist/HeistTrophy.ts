/**
 * HeistTrophy - The golden trophy entity that players fight over.
 * Handles mesh, glow, light beam, idle hover, carry attachment, and drop physics.
 */

import * as THREE from 'three';
import { HEIST } from '../../../utils/Constants';

export type TrophyState = 'idle' | 'carried' | 'falling' | 'settling';

export class HeistTrophy {
  readonly group: THREE.Group;
  private trophyMesh: THREE.Mesh;
  private glowLight: THREE.PointLight;
  private beamMesh: THREE.Mesh;

  // State
  state: TrophyState = 'idle';
  position: THREE.Vector3;
  private velocity = new THREE.Vector3();
  private fallTimer = 0;
  private grabImmunityTimer = 0;
  private rotationAngle = 0;

  // Center spawn position (set during init)
  private centerSpawn: THREE.Vector3;

  constructor(scene: THREE.Scene, centerPosition: THREE.Vector3) {
    this.centerSpawn = centerPosition.clone();
    this.position = centerPosition.clone();

    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    // Trophy mesh: a golden cup shape (cylinder base + wider top)
    const cupGeo = new THREE.CylinderGeometry(0.8, 0.5, 2.5, 8);
    const cupMat = new THREE.MeshStandardMaterial({
      color: HEIST.TROPHY_COLOR,
      emissive: HEIST.TROPHY_COLOR,
      emissiveIntensity: 0.5,
      metalness: 0.8,
      roughness: 0.2,
    });
    this.trophyMesh = new THREE.Mesh(cupGeo, cupMat);
    this.group.add(this.trophyMesh);

    // Base pedestal for the cup
    const baseGeo = new THREE.CylinderGeometry(1.0, 1.2, 0.5, 8);
    const baseMesh = new THREE.Mesh(baseGeo, cupMat);
    baseMesh.position.y = -1.5;
    this.group.add(baseMesh);

    // Handles (two torus arcs on the sides)
    const handleGeo = new THREE.TorusGeometry(0.6, 0.1, 6, 12, Math.PI);
    const handleL = new THREE.Mesh(handleGeo, cupMat);
    handleL.position.set(-0.8, 0.3, 0);
    handleL.rotation.z = Math.PI / 2;
    this.group.add(handleL);

    const handleR = new THREE.Mesh(handleGeo, cupMat);
    handleR.position.set(0.8, 0.3, 0);
    handleR.rotation.z = -Math.PI / 2;
    this.group.add(handleR);

    // Glow point light
    this.glowLight = new THREE.PointLight(
      HEIST.TROPHY_COLOR,
      HEIST.TROPHY_GLOW_INTENSITY,
      50,
    );
    this.glowLight.position.y = 1;
    this.group.add(this.glowLight);

    // Light beam pillar (tall semi-transparent cylinder)
    const beamGeo = new THREE.CylinderGeometry(0.5, 0.5, HEIST.TROPHY_BEAM_HEIGHT, 6);
    const beamMat = new THREE.MeshBasicMaterial({
      color: HEIST.TROPHY_COLOR,
      transparent: true,
      opacity: HEIST.TROPHY_BEAM_OPACITY,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.beamMesh = new THREE.Mesh(beamGeo, beamMat);
    this.beamMesh.position.y = HEIST.TROPHY_BEAM_HEIGHT / 2;
    this.group.add(this.beamMesh);

    scene.add(this.group);
  }

  /** Reset trophy to center spawn in idle state */
  resetToCenter(): void {
    this.position.copy(this.centerSpawn);
    this.group.position.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.state = 'idle';
    this.fallTimer = 0;
    this.grabImmunityTimer = 0;
    this.setBeamVisible(true);
    this.group.visible = true;
  }

  /** Attach trophy to a carrier (hide beam, enter carried state) */
  attachToCarrier(): void {
    this.state = 'carried';
    this.setBeamVisible(false);
    this.grabImmunityTimer = 0;
  }

  /** Update trophy position while carried (call from HeistMode each frame) */
  updateCarriedPosition(carrierPosition: THREE.Vector3, carrierYaw: number): void {
    // Position below carrier (talon position)
    this.position.set(
      carrierPosition.x,
      carrierPosition.y - 3.0,
      carrierPosition.z,
    );
    this.group.position.copy(this.position);
    this.group.rotation.y = carrierYaw;

    // Slight sway
    const t = performance.now() / 1000;
    this.group.position.x += Math.sin(t * 3) * 0.3;
    this.group.position.z += Math.cos(t * 2.5) * 0.15;
  }

  /** Drop the trophy with physics (after a slam) */
  drop(carrierVelocity: THREE.Vector3): void {
    this.state = 'falling';
    this.fallTimer = 0;

    // Inherit portion of carrier velocity + small random lateral offset
    this.velocity.copy(carrierVelocity).multiplyScalar(HEIST.TROPHY_DROP_INHERIT_VELOCITY);
    this.velocity.x += (Math.random() - 0.5) * 8;
    this.velocity.z += (Math.random() - 0.5) * 8;
    this.velocity.y = Math.max(this.velocity.y, 2); // Slight upward pop

    this.setBeamVisible(false);
  }

  /** Settle into idle hover at the server-authoritative position */
  settleAt(pos: THREE.Vector3): void {
    this.position.copy(pos);
    this.group.position.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.state = 'settling';
    this.grabImmunityTimer = HEIST.TROPHY_GRAB_IMMUNITY;
    this.setBeamVisible(true);
  }

  /** Hide trophy briefly during score pause */
  hideForScore(): void {
    this.group.visible = false;
    this.state = 'idle';
  }

  /** Can the trophy be grabbed right now? */
  get canBeGrabbed(): boolean {
    return (this.state === 'idle' || this.state === 'settling') && this.grabImmunityTimer <= 0;
  }

  update(dt: number): void {
    // Grab immunity countdown
    if (this.grabImmunityTimer > 0) {
      this.grabImmunityTimer -= dt;
      if (this.grabImmunityTimer <= 0 && this.state === 'settling') {
        this.state = 'idle';
      }
    }

    if (this.state === 'idle' || this.state === 'settling') {
      // Idle rotation
      this.rotationAngle += HEIST.TROPHY_ROTATION_SPEED * dt;
      this.group.rotation.y = this.rotationAngle;

      // Gentle hover bob
      const bob = Math.sin(performance.now() / 1000 * 2) * 0.3;
      this.group.position.y = this.position.y + bob;

      // Pulsing glow
      const pulse = 0.8 + Math.sin(performance.now() / 1000 * 3) * 0.2;
      this.glowLight.intensity = HEIST.TROPHY_GLOW_INTENSITY * pulse;
    }

    if (this.state === 'falling') {
      this.fallTimer += dt;

      // Apply gravity
      this.velocity.y -= HEIST.TROPHY_DROP_GRAVITY * dt;

      // Move
      this.position.addScaledVector(this.velocity, dt);

      // Tumble rotation
      this.group.rotation.x += dt * 5;
      this.group.rotation.z += dt * 3;
      this.group.position.copy(this.position);

      // Settle if hit ground or max fall time
      if (this.position.y <= 5 || this.fallTimer >= HEIST.TROPHY_DROP_MAX_FALL_TIME) {
        this.position.y = Math.max(this.position.y, 5);
        this.settleAt(this.position.clone());
      }
    }

    if (this.state === 'carried') {
      // Carried trophy doesn't rotate or bob (handled by updateCarriedPosition)
      this.group.rotation.x = 0;
      this.group.rotation.z = 0;
    }
  }

  private setBeamVisible(visible: boolean): void {
    this.beamMesh.visible = visible;
  }

  getWorldPosition(): THREE.Vector3 {
    return this.position.clone();
  }

  dispose(): void {
    this.group.parent?.remove(this.group);
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (obj.material instanceof THREE.Material) obj.material.dispose();
      }
    });
    if (this.glowLight.parent) this.glowLight.parent.remove(this.glowLight);
  }
}
