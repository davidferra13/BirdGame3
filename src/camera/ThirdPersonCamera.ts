import * as THREE from 'three';
import { CAMERA, FLIGHT } from '../utils/Constants';
import { remap, clamp, moveToward } from '../utils/MathUtils';
import { Bird } from '../entities/Bird';
import { InputManager } from '../core/InputManager';

export class ThirdPersonCamera {
  readonly camera: THREE.PerspectiveCamera;
  private currentLookTarget = new THREE.Vector3();
  private initialized = false;

  // Intro camera mode
  private introMode = false;
  private introPosition = new THREE.Vector3();
  private introLookAt = new THREE.Vector3();

  // Poop drop assist
  private dropAssistTimer = 0;

  // Screen shake
  private shakeIntensity = 0;
  private shakeTimer = 0;
  private shakeMaxDuration = 0.2;
  private shakeOffset = new THREE.Vector3();

  // Bombing run mode (dedicated toggle)
  private bombingBlend = 0;

  // Vertigo shot (dolly zoom on boost)
  private vertigoPunchTimer = 0;   // counts down from BOOST_PUNCH_DURATION
  private vertigoBlend = 0;        // 0 = normal, 1 = full vertigo effect
  private vertigoFov = 0;          // current vertigo FOV override

  // Free-look (right mouse — clamped ±45° yaw)
  private freeLookYawOffset = 0;
  private freeLookPitchOffset = 0;

  // Orbit (middle mouse — full 360° yaw)
  private orbitYawOffset = 0;
  private orbitPitchOffset = 0;

  // Driving mode
  private drivingMode = false;

  // Smoothed camera offsets (prevent snapping on state changes)
  private smoothOffsetBehind = CAMERA.OFFSET_BEHIND;
  private smoothOffsetAbove = CAMERA.OFFSET_ABOVE;

  // Camera collision (prevent clipping through buildings)
  private collidableMeshes: THREE.Object3D[] = [];
  private readonly _camDir = new THREE.Vector3();
  private readonly _camRay = new THREE.Raycaster();

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(
      CAMERA.SPEED_FOV_MIN,
      aspect,
      1,
      CAMERA.CAMERA_FAR_PLANE,
    );
  }

  /** Set building meshes for camera collision detection. */
  setCollidableMeshes(meshes: THREE.Object3D[]): void {
    this.collidableMeshes = meshes;
  }

  /** Set intro camera: fixed position looking at a target */
  setIntro(position: THREE.Vector3, lookAt: THREE.Vector3): void {
    this.introMode = true;
    this.introPosition.copy(position);
    this.introLookAt.copy(lookAt);
    this.camera.position.copy(position);
    this.currentLookTarget.copy(lookAt);
    this.camera.lookAt(lookAt);
    this.initialized = false; // reset so follow cam lerps from intro position
  }

  /** Exit intro mode — follow cam will smoothly take over */
  clearIntro(): void {
    this.introMode = false;
  }

  /** Toggle driving camera mode (tighter follow, lower FOV) */
  setDrivingMode(active: boolean): void {
    this.drivingMode = active;
  }

  /** Trigger brief zoom-out + tilt-down on poop drop. */
  notifyDrop(): void {
    this.dropAssistTimer = CAMERA.DROP_ASSIST_DURATION;
  }

  /** Trigger screen shake effect. Intensity scales effect strength, duration in seconds. */
  triggerShake(intensity: number, duration: number = 0.2): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    if (duration >= this.shakeTimer) {
      this.shakeTimer = duration;
      this.shakeMaxDuration = duration;
    }
  }

  update(dt: number, bird: Bird, input?: InputManager): void {
    // Intro mode: hold fixed position
    if (this.introMode) {
      this.camera.position.copy(this.introPosition);
      this.camera.lookAt(this.introLookAt);
      return;
    }

    const ctrl = bird.controller;
    const airflow = ctrl.getAirflow();
    const surfBlend = airflow * clamp(Math.abs(ctrl.rollAngle) / FLIGHT.MAX_BANK_ANGLE, 0, 1);

    // Free-look mode (right mouse — clamped ±45° yaw)
    if (input && input.isFreeLookActive()) {
      // Apply mouse movement to free-look offsets
      this.freeLookYawOffset += input.mouseDx * CAMERA.FREE_LOOK_SENSITIVITY;
      this.freeLookPitchOffset += input.mouseDy * CAMERA.FREE_LOOK_SENSITIVITY;

      // Clamp offsets
      this.freeLookYawOffset = clamp(this.freeLookYawOffset, -CAMERA.FREE_LOOK_MAX_YAW, CAMERA.FREE_LOOK_MAX_YAW);
      this.freeLookPitchOffset = clamp(this.freeLookPitchOffset, -CAMERA.FREE_LOOK_MAX_PITCH, CAMERA.FREE_LOOK_MAX_PITCH);
    } else {
      // Lerp back to center when not free-looking
      this.freeLookYawOffset *= Math.max(0, 1 - CAMERA.FREE_LOOK_RETURN_SPEED * dt);
      this.freeLookPitchOffset *= Math.max(0, 1 - CAMERA.FREE_LOOK_RETURN_SPEED * dt);

      // Snap to zero when close enough
      if (Math.abs(this.freeLookYawOffset) < 0.01) this.freeLookYawOffset = 0;
      if (Math.abs(this.freeLookPitchOffset) < 0.01) this.freeLookPitchOffset = 0;
    }

    // Gamepad right-stick camera look (dt-scaled so feel matches mouse free-look)
    if (input) {
      const gpCamX = input.getGamepadCamX();
      const gpCamY = input.getGamepadCamY();
      if (Math.abs(gpCamX) > 0 || Math.abs(gpCamY) > 0) {
        const gpSensitivity = CAMERA.FREE_LOOK_SENSITIVITY * 55;
        this.freeLookYawOffset += gpCamX * gpSensitivity * dt;
        this.freeLookPitchOffset += gpCamY * gpSensitivity * dt;
        this.freeLookYawOffset = clamp(this.freeLookYawOffset, -CAMERA.FREE_LOOK_MAX_YAW, CAMERA.FREE_LOOK_MAX_YAW);
        this.freeLookPitchOffset = clamp(this.freeLookPitchOffset, -CAMERA.FREE_LOOK_MAX_PITCH, CAMERA.FREE_LOOK_MAX_PITCH);
      }
    }

    // Orbit mode (middle mouse — full 360° yaw, wider pitch)
    if (input && input.isOrbitActive()) {
      this.orbitYawOffset += input.mouseDx * CAMERA.ORBIT_SENSITIVITY;
      this.orbitPitchOffset += input.mouseDy * CAMERA.ORBIT_SENSITIVITY;
      this.orbitPitchOffset = clamp(this.orbitPitchOffset, -CAMERA.ORBIT_MAX_PITCH, CAMERA.ORBIT_MAX_PITCH);
    } else {
      // Lerp back to center when released
      this.orbitYawOffset *= Math.max(0, 1 - CAMERA.ORBIT_RETURN_SPEED * dt);
      this.orbitPitchOffset *= Math.max(0, 1 - CAMERA.ORBIT_RETURN_SPEED * dt);
      if (Math.abs(this.orbitYawOffset) < 0.005) this.orbitYawOffset = 0;
      if (Math.abs(this.orbitPitchOffset) < 0.005) this.orbitPitchOffset = 0;
    }

    // Vertigo shot: trigger on boost activation
    if (ctrl.boostJustActivated) {
      this.vertigoPunchTimer = CAMERA.BOOST_PUNCH_DURATION;
      this.vertigoBlend = 1;
      this.vertigoFov = CAMERA.BOOST_FOV_PUNCH;
      this.triggerShake(CAMERA.BOOST_SHAKE_INTENSITY, 0.15);
    }
    if (ctrl.pullOutJustActivated) {
      this.triggerShake(0.04 + ctrl.getPullOutBlend() * 0.05, 0.12);
    }

    // Vertigo punch phase: hold the extreme values briefly
    if (this.vertigoPunchTimer > 0) {
      this.vertigoPunchTimer -= dt;
    } else {
      // Recover phase: ease back to normal
      const recoverAlpha = 1 - Math.exp(-CAMERA.BOOST_RECOVER_SPEED * dt);
      this.vertigoBlend *= (1 - recoverAlpha);
      if (this.vertigoBlend < 0.01) this.vertigoBlend = 0;
    }

    // Poop drop assist timer
    if (this.dropAssistTimer > 0) this.dropAssistTimer -= dt;
    const dropBlend = Math.max(0, this.dropAssistTimer / CAMERA.DROP_ASSIST_DURATION);

    // Bombing run mode: ramp blend when bomber mode is active in flight
    const wantsBombing = ctrl.isBomberMode && !ctrl.isGrounded && !ctrl.isDiving;
    if (wantsBombing) {
      this.bombingBlend = moveToward(this.bombingBlend, 1, dt * CAMERA.BOMBING_RAMP_UP_SPEED);
    } else {
      this.bombingBlend = moveToward(this.bombingBlend, 0, dt * CAMERA.BOMBING_RAMP_DOWN_SPEED);
    }
    const bombingSpeedNorm = clamp(
      remap(ctrl.forwardSpeed, FLIGHT.BASE_SPEED, FLIGHT.DIVE_BOMB_SPEED, 0, 1),
      0,
      1,
    );

    // Choose target offsets based on state: driving > grounded > diving > bombing > normal
    let targetOffsetBehind: number;
    let targetOffsetAbove: number;
    if (this.drivingMode) {
      targetOffsetBehind = CAMERA.DRIVING_OFFSET_BEHIND;
      targetOffsetAbove = CAMERA.DRIVING_OFFSET_ABOVE;
    } else if (ctrl.isGrounded) {
      targetOffsetBehind = CAMERA.GROUND_OFFSET_BEHIND;
      targetOffsetAbove = CAMERA.GROUND_OFFSET_ABOVE;
    } else if (ctrl.isDiving) {
      targetOffsetBehind = CAMERA.DIVE_OFFSET_BEHIND;
      targetOffsetAbove = CAMERA.DIVE_OFFSET_ABOVE;
    } else if (this.bombingBlend > 0.01) {
      // Blend between normal and bombing offsets
      const b = this.bombingBlend;
      targetOffsetBehind = CAMERA.OFFSET_BEHIND + (CAMERA.BOMBING_OFFSET_BEHIND - CAMERA.OFFSET_BEHIND) * b;
      targetOffsetAbove = CAMERA.OFFSET_ABOVE + (CAMERA.BOMBING_OFFSET_ABOVE - CAMERA.OFFSET_ABOVE) * b;
    } else {
      targetOffsetBehind = CAMERA.OFFSET_BEHIND;
      targetOffsetAbove = CAMERA.OFFSET_ABOVE;
    }

    // Smooth offset transitions (with extra catch-up at high-speed bombing)
    const offsetLerpSpeed = CAMERA.OFFSET_LERP_BASE + this.bombingBlend * (2.0 + bombingSpeedNorm * 8.0);
    const offsetAlpha = 1 - Math.exp(-offsetLerpSpeed * dt);
    this.smoothOffsetBehind += (targetOffsetBehind - this.smoothOffsetBehind) * offsetAlpha;
    this.smoothOffsetAbove += (targetOffsetAbove - this.smoothOffsetAbove) * offsetAlpha;

    let offsetBehind = this.smoothOffsetBehind;
    let offsetAbove = this.smoothOffsetAbove;

    if (!ctrl.isGrounded) {
      offsetBehind += airflow * CAMERA.SURF_OFFSET_BEHIND;
      offsetAbove -= airflow * CAMERA.SURF_OFFSET_DROP;
    }

    // Vertigo shot: pull camera in close (dolly zoom — close camera + wide FOV = vertigo warp)
    if (this.vertigoBlend > 0) {
      const vb = this.vertigoBlend;
      offsetBehind += (CAMERA.BOOST_PULL_IN_BEHIND - offsetBehind) * vb;
      offsetAbove += (CAMERA.BOOST_PULL_IN_ABOVE - offsetAbove) * vb;
    }

    // Poop drop assist: brief zoom-out + extra height
    offsetBehind += CAMERA.DROP_ZOOM_EXTRA_BEHIND * dropBlend;
    offsetAbove += CAMERA.DROP_ZOOM_EXTRA_ABOVE * dropBlend;

    // Compute ideal position: offset rotated by yaw (+ free-look + orbit offsets)
    const localOffset = new THREE.Vector3(0, offsetAbove, offsetBehind);
    localOffset.x += Math.sin(ctrl.rollAngle) * CAMERA.SURF_SIDE_OFFSET * surfBlend;
    const yawQuat = new THREE.Quaternion();
    const effectiveYaw = ctrl.yawAngle + this.freeLookYawOffset + this.orbitYawOffset;
    yawQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), effectiveYaw);
    localOffset.applyQuaternion(yawQuat);

    const idealPosition = ctrl.position.clone().add(localOffset);

    // Apply pitch offsets to vertical position
    const pitchOffset = Math.sin(this.freeLookPitchOffset + this.orbitPitchOffset) * offsetBehind * CAMERA.PITCH_OFFSET_MULTIPLIER;
    idealPosition.y += pitchOffset;

    // Camera collision: prevent clipping through buildings
    if (this.collidableMeshes.length > 0) {
      this._camDir.subVectors(idealPosition, ctrl.position);
      const camDist = this._camDir.length();
      if (camDist > 0.1) {
        this._camDir.normalize();
        this._camRay.set(ctrl.position, this._camDir);
        this._camRay.near = 0.5;
        this._camRay.far = camDist;
        const hits = this._camRay.intersectObjects(this.collidableMeshes, false);
        if (hits.length > 0) {
          idealPosition.copy(ctrl.position).addScaledVector(this._camDir, Math.max(0.5, hits[0].distance - 0.5));
        }
      }
    }

    // Compute look target: ahead of the bird (with free-look/orbit offset)
    // Reduce lookahead during bombing mode so camera looks closer to directly below
    const baseLookahead = this.drivingMode
      ? CAMERA.DRIVING_LOOKAHEAD
      : CAMERA.LOOKAHEAD_DISTANCE * (1 - this.bombingBlend * (1 - CAMERA.BOMBING_LOOKAHEAD_SCALE))
        + this.bombingBlend * bombingSpeedNorm * 8;
    // Attenuate lookahead when grounded (walking is much slower than flying)
    const groundAtten = ctrl.isGrounded ? CAMERA.GROUND_LOOKAHEAD_ATTEN : 1.0;
    const effectiveLookahead = baseLookahead * groundAtten + airflow * CAMERA.SURF_LOOKAHEAD_BONUS;
    const lookYawQuat = new THREE.Quaternion();
    lookYawQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), effectiveYaw);
    const lookForward = new THREE.Vector3(0, 0, -1).applyQuaternion(lookYawQuat);
    const lookRight = new THREE.Vector3(1, 0, 0).applyQuaternion(lookYawQuat);

    const lookTarget = ctrl.position
      .clone()
      .add(lookForward.multiplyScalar(effectiveLookahead));
    lookTarget.addScaledVector(lookRight, Math.sin(ctrl.rollAngle) * CAMERA.SURF_LOOK_SIDE * surfBlend);
    lookTarget.y += CAMERA.LOOK_TARGET_HEIGHT;
    lookTarget.y -= Math.sin(this.freeLookPitchOffset) * effectiveLookahead * CAMERA.PITCH_LOOK_TARGET_MULT;
    lookTarget.y += CAMERA.DROP_LOOK_DOWN_OFFSET * dropBlend;
    lookTarget.y += CAMERA.BOMBING_LOOK_DOWN * this.bombingBlend;

    if (!this.initialized) {
      // Snap on first frame
      this.camera.position.copy(idealPosition);
      this.currentLookTarget.copy(lookTarget);
      this.initialized = true;
    } else {
      // Bomber mode now scales follow speed with movement speed so camera won't lag behind.
      const baseLerpSpeed = ctrl.isGrounded ? CAMERA.GROUND_LERP_SPEED : CAMERA.POSITION_LERP_SPEED;
      const baseLookLerp = ctrl.isGrounded ? CAMERA.GROUND_LERP_SPEED : CAMERA.LOOKAT_LERP_SPEED;
      const bombingCatchup = this.bombingBlend * (CAMERA.BOMBING_CATCHUP_BASE + bombingSpeedNorm * CAMERA.BOMBING_CATCHUP_SCALE);
      const lerpSpeed = Math.max(baseLerpSpeed, CAMERA.BOMBING_LERP_SPEED + bombingCatchup) + airflow * CAMERA.SURF_LERP_BOOST;
      const lookLerp = Math.max(baseLookLerp, CAMERA.BOMBING_LERP_SPEED + bombingCatchup * 1.15) + airflow * (CAMERA.SURF_LERP_BOOST + 0.5);

      const posAlpha = 1 - Math.exp(-lerpSpeed * dt);
      this.camera.position.lerp(idealPosition, posAlpha);

      const lookAlpha = 1 - Math.exp(-lookLerp * dt);
      this.currentLookTarget.lerp(lookTarget, lookAlpha);
    }

    // Screen shake effect (impact-based)
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const shakeFactor = this.shakeMaxDuration > 0 ? this.shakeTimer / this.shakeMaxDuration : 0;
      this.shakeOffset.set(
        (Math.random() - 0.5) * this.shakeIntensity * shakeFactor,
        (Math.random() - 0.5) * this.shakeIntensity * shakeFactor,
        (Math.random() - 0.5) * this.shakeIntensity * shakeFactor
      );
      this.camera.position.add(this.shakeOffset);
    } else {
      this.shakeIntensity = 0;
      this.shakeOffset.set(0, 0, 0);
    }

    this.camera.lookAt(this.currentLookTarget);

    // Dynamic FOV based on speed (reset to min when grounded)
    let targetFov: number;
    if (this.drivingMode) {
      // Driving: subtle FOV increase with speed
      targetFov = remap(
        Math.abs(ctrl.forwardSpeed), 0, 35,
        CAMERA.DRIVING_FOV_MIN, CAMERA.DRIVING_FOV_MAX,
      );
    } else if (ctrl.isGrounded) {
      targetFov = CAMERA.SPEED_FOV_MIN;
    } else {
      targetFov = remap(
        ctrl.forwardSpeed,
        FLIGHT.BASE_SPEED,
        FLIGHT.DIVE_SPEED,
        CAMERA.SPEED_FOV_MIN,
        CAMERA.SPEED_FOV_MAX,
      );
    }

    // Vertigo shot: override FOV with punched-out wide angle
    if (this.vertigoBlend > 0) {
      targetFov += (CAMERA.BOOST_FOV_PUNCH - targetFov) * this.vertigoBlend;
    }
    targetFov += airflow * CAMERA.SURF_FOV_BONUS;

    const fovAlpha = 1 - Math.exp(-CAMERA.FOV_LERP_SPEED * dt);
    this.camera.fov += (targetFov - this.camera.fov) * fovAlpha;
    this.camera.updateProjectionMatrix();
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
