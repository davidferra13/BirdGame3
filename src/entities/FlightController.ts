import * as THREE from 'three';
import { FLIGHT, WORLD } from '../utils/Constants';
import { clamp, moveToward, remap } from '../utils/MathUtils';
import { InputManager } from '../core/InputManager';
import { BuildingData } from '../world/City';

// Reusable scratch objects — allocated once, reused every frame
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _forward = new THREE.Vector3();
const _velocity = new THREE.Vector3();
const _displacement = new THREE.Vector3();
const _stepDisp = new THREE.Vector3();
const _newPos = new THREE.Vector3();
const _slidePos = new THREE.Vector3();
const _collisionNormal = new THREE.Vector3();
const _noCollision = { hasCollision: false, normal: new THREE.Vector3() };
const _hitCollision = { hasCollision: true, normal: new THREE.Vector3() };
const _slideVec = new THREE.Vector3();
const _flipQuat = new THREE.Quaternion();
const _flipAxis = new THREE.Vector3();
const _corkscrewRoll = new THREE.Quaternion();
const _corkscrewPitch = new THREE.Quaternion();

export class FlightController {
  readonly position = new THREE.Vector3(0, 50, 0);

  yawAngle = 0;
  pitchAngle = 0;
  rollAngle = 0;

  forwardSpeed = FLIGHT.BASE_SPEED;

  private pitchRate = 0;
  private ascendRamp = 0;
  private turnMomentum = 0; // IMPROVEMENT #5: Turn inertia
  private gentleDescentRamp = 0;
  private fastDescentRamp = 0;

  isDiving = false;
  isDiveBombing = false;
  isGrounded = false;
  isWalkMode = false;
  isPerched = false;   // grounded on a rooftop (not street level)
  isBoosting = false;
  boostJustActivated = false; // true for one frame on boost start
  pullOutJustActivated = false; // true for one frame on a successful dive pullout
  isBraking = false;
  isBomberMode = false;
  isGentleDescending = false;
  private boostCooldown = 0;
  private boostTimer = 0;

  // Flip mechanics
  private isFlipping = false;
  private flipType: 'front' | 'back' | 'left' | 'right' | 'corkscrewLeft' | 'corkscrewRight' |
                     'sideFlipLeft' | 'sideFlipRight' | 'inverted' | 'aileronRoll' | null = null;
  private flipProgress = 0;
  private flipDuration = FLIGHT.FLIP_DURATION; // seconds for a complete flip
  private flipRotation = 0; // accumulated flip rotation
  private flipCooldown = 0; // cooldown between flips
  private isDoubleFlip = false; // whether this is a double flip (720°)
  private flipComboCount = 0; // consecutive flips performed
  private flipComboTimer = 0; // time window for combo

  // U-turn (180° snap turn)
  private isUTurning = false;
  private uTurnProgress = 0;
  private uTurnDuration = FLIGHT.U_TURN_DURATION; // seconds for the 180
  private uTurnStartYaw = 0;
  private uTurnCooldown = 0;

  // Callbacks for flip/dive/U-turn tracking
  onFlipPerformed: ((type: string, isDouble: boolean) => void) | null = null;
  onDiveStart: ((speed: number) => void) | null = null;
  onUTurn: (() => void) | null = null;

  // Dive-to-speed conversion
  private wasDiving = false;
  private divePeakSpeed = 0;
  private diveMomentumBoost = 0;
  private diveMomentumTimer = 0;
  private glideFlow = 0;
  private pendingPullOutAssist = 0;
  private pendingPullOutTimer = 0;
  private pullOutAssist = 0;
  private pullOutTimer = 0;

  // Smooth scroll altitude control
  private scrollVelocity = 0;         // current smoothed scroll vertical velocity

  totalDistanceFlown = 0;

  // Building data for rooftop perching
  private buildings: BuildingData[] = [];
  private perchHeight = 0;

  setBuildings(buildings: BuildingData[]): void {
    this.buildings = buildings;
  }

  toggleWalkMode(): boolean {
    this.isWalkMode = !this.isWalkMode;

    if (this.isWalkMode) {
      this.resetAirflowState();
      this.snapToFloor();
      this.isGrounded = true;
      this.isPerched = this.position.y > FLIGHT.GROUND_ALTITUDE + 1;
      this.isDiving = false;
      this.isDiveBombing = false;
      this.isBraking = false;
      this.isGentleDescending = false;
      this.isBomberMode = false;
      this.pitchAngle = 0;
      this.rollAngle = 0;
      this.forwardSpeed = 0;
      return true;
    }

    // Exiting walk mode always returns the player to flight.
    this.resetAirflowState();
    this.isGrounded = false;
    this.isPerched = false;
    this.pitchAngle = 0;
    this.rollAngle = 0;
    this.position.y += 1.2;
    this.forwardSpeed = FLIGHT.GROUND_TAKEOFF_SPEED;
    return false;
  }

  update(dt: number, input: InputManager): void {
    const yawInput = input.getAxis('horizontal');
    const pitchInput = input.getAxis('vertical');
    const forwardInput = input.isMoveForwardHeld() ? 1 : 0;
    const ascendInput = input.isAscending();
    const fastDescentInput = input.isFastDescending();
    const diveInput = input.isDive();
    const diveBombInput = input.isDiveBomb();
    const gentleDescentInput = input.isGentleDescending();
    const brakeInput = input.isBrakeHeld();

    this.boostJustActivated = false;
    this.pullOutJustActivated = false;

    // Ground / perch mode
    const rooftopY = this.getRooftopBelow();
    const floorY = Math.max(FLIGHT.GROUND_ALTITUDE, rooftopY);

    // Forced walk mode: always stay grounded until explicitly toggled off.
    if (this.isWalkMode) {
      this.perchHeight = rooftopY;
      this.handleGroundMode(dt, input, floorY);
      return;
    }

    // Landing requires: near ground + not ascending + (very low speed OR actively descending)
    const wantsToLand = this.forwardSpeed < FLIGHT.LANDING_SPEED_THRESHOLD || fastDescentInput || diveInput;
    if (this.position.y <= floorY && !ascendInput && wantsToLand) {
      this.perchHeight = rooftopY;
      this.handleGroundMode(dt, input, floorY);
      return;
    }

    if (this.isGrounded && ascendInput) {
      this.isGrounded = false;
      this.isPerched = false;
      this.forwardSpeed = FLIGHT.GROUND_TAKEOFF_SPEED;
    }

    this.isGrounded = false;
    if (input.wasBomberModePressed()) {
      this.isBomberMode = !this.isBomberMode;
    }
    this.isDiving = fastDescentInput || diveInput;
    this.isDiveBombing = diveBombInput;
    this.isBraking = brakeInput && !this.isDiving;
    this.isGentleDescending = gentleDescentInput && !this.isDiving;

    // Update flip cooldown and combo timer
    if (this.flipCooldown > 0) this.flipCooldown -= dt;
    if (this.flipComboTimer > 0) {
      this.flipComboTimer -= dt;
    } else {
      this.flipComboCount = 0; // Reset combo if timer expires
    }

    // Check for flip input (only when not already flipping, not grounded, and cooldown expired)
    if (!this.isFlipping && this.flipCooldown <= 0) {
      // Check if Alt key is held for double flips
      const isDoubleFlipModifier = input.isDown('AltLeft') || input.isDown('AltRight');

      if (input.wasFrontFlipPressed()) {
        this.startFlip('front', isDoubleFlipModifier);
      } else if (input.wasBackFlipPressed()) {
        this.startFlip('back', isDoubleFlipModifier);
      } else if (input.wasLeftBarrelRollPressed()) {
        this.startFlip('left', isDoubleFlipModifier);
      } else if (input.wasRightBarrelRollPressed()) {
        this.startFlip('right', isDoubleFlipModifier);
      } else if (input.wasCorkscrewLeftPressed()) {
        this.startFlip('corkscrewLeft', isDoubleFlipModifier);
      } else if (input.wasCorkscrewRightPressed()) {
        this.startFlip('corkscrewRight', isDoubleFlipModifier);
      } else if (input.wasSideFlipLeftPressed()) {
        this.startFlip('sideFlipLeft', isDoubleFlipModifier);
      } else if (input.wasSideFlipRightPressed()) {
        this.startFlip('sideFlipRight', isDoubleFlipModifier);
      } else if (input.wasInvertedFlipPressed()) {
        this.startFlip('inverted', isDoubleFlipModifier);
      } else if (input.wasAileronRollPressed()) {
        this.startFlip('aileronRoll', isDoubleFlipModifier);
      }
    }

    // U-turn: instant 180° turn
    if (this.uTurnCooldown > 0) this.uTurnCooldown -= dt;
    if (!this.isUTurning && this.uTurnCooldown <= 0 && !this.isFlipping && input.wasUTurnPressed()) {
      this.isUTurning = true;
      this.uTurnProgress = 0;
      this.uTurnStartYaw = this.yawAngle;
    }
    if (this.isUTurning) {
      this.uTurnProgress += dt / this.uTurnDuration;
      if (this.uTurnProgress >= 1) {
        this.yawAngle = this.uTurnStartYaw + Math.PI;
        this.isUTurning = false;
        this.uTurnProgress = 0;
        this.uTurnCooldown = FLIGHT.U_TURN_COOLDOWN;
        this.turnMomentum = 0;
        this.rollAngle = 0;
        this.onUTurn?.();
      } else {
        // Ease-in-out for smooth 180
        const t = this.uTurnProgress;
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        this.yawAngle = this.uTurnStartYaw + Math.PI * eased;
      }
    }

    // Dive-to-speed conversion: track dive entry/exit
    if (this.isDiving && !this.wasDiving) {
      // Entering dive
      this.divePeakSpeed = 0;
      this.onDiveStart?.(this.forwardSpeed);
    } else if (!this.isDiving && this.wasDiving) {
      // Exiting dive - convert dive speed to horizontal momentum
      const diveSpeedGained = this.divePeakSpeed - FLIGHT.BASE_SPEED;
      if (diveSpeedGained > 0) {
        this.diveMomentumBoost = diveSpeedGained * FLIGHT.DIVE_MOMENTUM_CONVERSION;
        this.diveMomentumTimer = FLIGHT.DIVE_MOMENTUM_DURATION;
        const pullOutStrength = clamp(
          remap(diveSpeedGained, FLIGHT.PULL_OUT_MIN_DIVE_GAIN, FLIGHT.DIVE_BOMB_SPEED - FLIGHT.BASE_SPEED, 0, 1),
          0,
          1,
        );
        if (pullOutStrength > 0) {
          this.pendingPullOutAssist = Math.max(this.pendingPullOutAssist, pullOutStrength);
          this.pendingPullOutTimer = FLIGHT.PULL_OUT_ACTIVATION_WINDOW;
        }
      }
    }
    this.wasDiving = this.isDiving;

    // Boost
    if (this.boostCooldown > 0) this.boostCooldown -= dt;
    if (this.boostTimer > 0) this.boostTimer -= dt;

    if (input.isBoost() && this.boostCooldown <= 0) {
      this.isBoosting = true;
      this.boostJustActivated = true;
      this.boostTimer = FLIGHT.BOOST_DURATION;
      this.boostCooldown = FLIGHT.BOOST_COOLDOWN;
    }
    if (this.boostTimer <= 0) this.isBoosting = false;

    // IMPROVEMENT #2: Bank-based turns (physics-driven)
    // Skip normal turning while U-turning (yaw is driven by the U-turn animation)
    if (!this.isUTurning) {
      // Yaw input controls roll, roll controls turn rate
      const targetRoll = -yawInput * FLIGHT.MAX_BANK_ANGLE;
      const rollResponse = FLIGHT.BANK_SPEED * (1 + this.glideFlow * 0.4);
      this.rollAngle = moveToward(this.rollAngle, targetRoll, rollResponse * dt);

      // Turn rate based on bank angle (like real birds)
      const pullOutTurnAssist = this.getPullOutBlend();
      const carveAssist = this.glideFlow * FLIGHT.FLOW_TURN_BONUS + pullOutTurnAssist * FLIGHT.PULL_OUT_TURN_BONUS;
      const bankTurnFactor = Math.sin(this.rollAngle);
      const speedBasedTurnRate = remap(this.forwardSpeed, 0, FLIGHT.MAX_SPEED, FLIGHT.TURN_SPEED_MAX_MULT, FLIGHT.TURN_SPEED_MIN_MULT);
      const effectiveTurnRate = bankTurnFactor * FLIGHT.YAW_RATE * speedBasedTurnRate * (1 + carveAssist);

      // IMPROVEMENT #5: Turn inertia - high speed resists rapid direction changes
      const desiredTurn = effectiveTurnRate * dt;
      const speedInertiaFactor = remap(this.forwardSpeed, 0, FLIGHT.MAX_SPEED, 1.0, 0.4);
      const turnAccel = FLIGHT.TURN_ACCEL * speedInertiaFactor * (1 + carveAssist * 0.6);

      this.turnMomentum = moveToward(this.turnMomentum, desiredTurn, turnAccel * dt);
      this.yawAngle += this.turnMomentum;
    }

    // Pitch — smoothed with acceleration/deceleration like yaw
    let targetPitchRate = 0;
    if (this.isDiveBombing) {
      // Dive bomb: steeper pitch, faster descent
      this.pitchAngle = moveToward(this.pitchAngle, FLIGHT.DIVE_BOMB_PITCH, FLIGHT.PITCH_RATE_DIVEBOMB * dt);
      targetPitchRate = 0;
    } else if (this.isDiving) {
      this.pitchAngle = moveToward(this.pitchAngle, FLIGHT.DIVE_PITCH, FLIGHT.PITCH_RATE_DIVE * dt);
      targetPitchRate = 0;
    } else if (ascendInput) {
      this.pitchAngle = moveToward(this.pitchAngle, FLIGHT.MAX_PITCH_UP * 0.5, FLIGHT.PITCH_RATE_ASCEND * dt);
      targetPitchRate = 0;
    } else if (this.isBraking) {
      this.pitchAngle = moveToward(this.pitchAngle, 0, FLIGHT.PITCH_RATE_BRAKE * dt);
      targetPitchRate = 0;
    } else if (this.isGentleDescending) {
      // Precision descend takes priority over W pitch-up for better attack-run control.
      this.pitchAngle = moveToward(this.pitchAngle, FLIGHT.GENTLE_DESCENT_PITCH, FLIGHT.PITCH_RATE_GENTLE * dt);
      targetPitchRate = 0;
    } else if (pitchInput > 0) {
      // W key: shallow climb bias so forward speed feels primary (Space remains main vertical control)
      this.pitchAngle = moveToward(this.pitchAngle, FLIGHT.MAX_PITCH_UP * 0.35, FLIGHT.PITCH_RATE_FORWARD * dt);
      targetPitchRate = 0;
    } else {
      // No input: gentle auto-descent pitch
      this.pitchAngle = moveToward(this.pitchAngle, FLIGHT.AUTO_DESCENT_PITCH, FLIGHT.PITCH_RATE_AUTODESCENT * dt);
      targetPitchRate = 0;
    }
    const pitchAccel = targetPitchRate !== 0 ? FLIGHT.PITCH_ACCELERATION : FLIGHT.PITCH_DECELERATION;
    this.pitchRate = moveToward(this.pitchRate, targetPitchRate, pitchAccel * dt);
    this.pitchAngle += this.pitchRate * dt;
    this.pitchAngle = clamp(this.pitchAngle, FLIGHT.MAX_PITCH_DOWN, FLIGHT.MAX_PITCH_UP);

    if (this.pendingPullOutTimer > 0) {
      this.pendingPullOutTimer -= dt;
      if (!this.isDiving && !this.isDiveBombing && this.pitchAngle >= FLIGHT.PULL_OUT_TRIGGER_PITCH) {
        this.pullOutAssist = Math.max(this.pullOutAssist, this.pendingPullOutAssist);
        this.pullOutTimer = FLIGHT.PULL_OUT_DURATION;
        this.pendingPullOutAssist = 0;
        this.pendingPullOutTimer = 0;
        this.pullOutJustActivated = this.pullOutAssist > 0.15;
      } else if (this.pendingPullOutTimer <= 0) {
        this.pendingPullOutAssist = 0;
      }
    }

    if (this.pullOutTimer > 0) {
      this.pullOutTimer = Math.max(0, this.pullOutTimer - dt);
      if (this.pullOutTimer <= 0) this.pullOutAssist = 0;
    }

    const pullOutFactor = this.getPullOutBlend();
    const speedFlowFactor = clamp(remap(this.forwardSpeed, FLIGHT.FLOW_SPEED_START, FLIGHT.FLOW_SPEED_FULL, 0, 1), 0, 1);
    let pitchFlowFactor = 1;
    if (this.pitchAngle < FLIGHT.FLOW_PITCH_SWEET_MIN) {
      pitchFlowFactor = clamp(remap(this.pitchAngle, FLIGHT.MAX_PITCH_DOWN, FLIGHT.FLOW_PITCH_SWEET_MIN, 0, 1), 0, 1);
    } else if (this.pitchAngle > FLIGHT.FLOW_PITCH_SWEET_MAX) {
      pitchFlowFactor = clamp(remap(this.pitchAngle, FLIGHT.FLOW_PITCH_SWEET_MAX, FLIGHT.MAX_PITCH_UP, 1, 0), 0, 1);
    }
    const bankFactor = clamp(
      remap(Math.abs(this.rollAngle), FLIGHT.MAX_BANK_ANGLE * FLIGHT.FLOW_BANK_MIN, FLIGHT.MAX_BANK_ANGLE, 0, 1),
      0,
      1,
    );
    const skimFactor = clamp(remap(this.position.y, FLIGHT.MIN_ALTITUDE + 0.8, FLIGHT.FLOW_SKIM_ALTITUDE, 1, 0), 0, 1);
    const flowAnchor = Math.max(bankFactor, skimFactor * 0.85 + pullOutFactor * 0.35);
    const canBuildFlow = !this.isGrounded && !this.isDiving && !this.isDiveBombing && !this.isBraking && !ascendInput;
    const targetGlideFlow = canBuildFlow ? speedFlowFactor * pitchFlowFactor * flowAnchor : 0;
    const glideRate = targetGlideFlow > this.glideFlow ? FLIGHT.FLOW_BUILD_RATE : FLIGHT.FLOW_DECAY_RATE;
    this.glideFlow = moveToward(this.glideFlow, targetGlideFlow, glideRate * dt);
    const airflow = Math.max(this.glideFlow, pullOutFactor);

    // Speed
    // IMPROVEMENT #1: Curve-based acceleration (adds weight/inertia)
    if (this.isDiveBombing) {
      // Dive bomb: much faster speed
      const gap = FLIGHT.DIVE_BOMB_SPEED - this.forwardSpeed;
      const easeRate = FLIGHT.EASE_DIVEBOMB;
      this.forwardSpeed += gap * easeRate * dt;
      // Track peak dive speed for momentum conversion
      if (this.forwardSpeed > this.divePeakSpeed) {
        this.divePeakSpeed = this.forwardSpeed;
      }
    } else if (this.isDiving) {
      const gap = FLIGHT.DIVE_SPEED - this.forwardSpeed;
      const easeRate = FLIGHT.EASE_DIVE;
      this.forwardSpeed += gap * easeRate * dt;
      // Track peak dive speed for momentum conversion
      if (this.forwardSpeed > this.divePeakSpeed) {
        this.divePeakSpeed = this.forwardSpeed;
      }
    } else if (this.isBraking) {
      // S key: brake to a full stop in flight (only slows down, never speeds up)
      if (this.forwardSpeed > FLIGHT.BRAKE_MIN_SPEED) {
        const gap = FLIGHT.BRAKE_MIN_SPEED - this.forwardSpeed;
        const easeRate = FLIGHT.EASE_BRAKE;
        this.forwardSpeed += gap * easeRate * dt;
      }
      // If already at or below brake speed, maintain current speed
    } else {
      const pitchSpeedMod = remap(this.pitchAngle, FLIGHT.PITCH_REMAP_MIN_PITCH, FLIGHT.PITCH_REMAP_MAX_PITCH, FLIGHT.PITCH_REMAP_MAX_SPEED, FLIGHT.PITCH_REMAP_MIN_SPEED);
      let targetSpeed = FLIGHT.BASE_SPEED + pitchSpeedMod + forwardInput * FLIGHT.FORWARD_SPEED_BONUS;
      targetSpeed += this.glideFlow * FLIGHT.FLOW_SPEED_BONUS + pullOutFactor * FLIGHT.PULL_OUT_SPEED_BONUS;
      if (this.isBoosting) targetSpeed *= FLIGHT.BOOST_MULTIPLIER;

      // Apply dive momentum boost
      if (this.diveMomentumTimer > 0) {
        const momentumFactor = this.diveMomentumTimer / FLIGHT.DIVE_MOMENTUM_DURATION;
        targetSpeed += this.diveMomentumBoost * momentumFactor;
        this.diveMomentumTimer -= dt;
      }

      const speedCap = this.isBoosting
        ? FLIGHT.MAX_SPEED * FLIGHT.BOOST_MULTIPLIER
        : FLIGHT.MAX_SPEED;
      targetSpeed = clamp(targetSpeed, FLIGHT.MIN_SPEED, speedCap);
      const gap = targetSpeed - this.forwardSpeed;
      // Different rates for accel vs decel (decel faster = more weight)
      const easeRate = gap > 0 ? FLIGHT.EASE_ACCEL : FLIGHT.EASE_DECEL;
      this.forwardSpeed += gap * easeRate * dt;
    }

    // Update flip progress
    if (this.isFlipping) {
      this.flipProgress += dt / this.flipDuration;
      if (this.flipProgress >= 1.0) {
        this.flipProgress = 0;
        this.isFlipping = false;
        this.flipRotation = 0;
        this.flipType = null;
        this.isDoubleFlip = false;
        this.flipCooldown = FLIGHT.FLIP_COOLDOWN;

        // Update combo system
        this.flipComboCount++;
        this.flipComboTimer = FLIGHT.FLIP_COMBO_WINDOW;
      }
    }

    _euler.set(this.pitchAngle, this.yawAngle, 0, 'YXZ');
    _quat.setFromEuler(_euler);

    _velocity.set(0, 0, -1).applyQuaternion(_quat).multiplyScalar(this.forwardSpeed);
    const velocity = _velocity;

    // Ascend with Space (fast ramp-down to prevent overshoot)
    if (ascendInput) {
      this.ascendRamp = moveToward(this.ascendRamp, 1, dt / FLIGHT.ASCEND_RAMP_UP_TIME);
    } else {
      this.ascendRamp = moveToward(this.ascendRamp, 0, dt / FLIGHT.ASCEND_RAMP_DOWN_TIME);
    }
    if (this.ascendRamp > 0) {
      velocity.y += FLIGHT.ASCEND_SPEED * this.ascendRamp;
    }

    // Fast descent with Ctrl (ramped to prevent jerky velocity snap)
    if (fastDescentInput && !diveInput) {
      this.fastDescentRamp = moveToward(this.fastDescentRamp, 1, dt / FLIGHT.FAST_DESCENT_RAMP_TIME);
    } else {
      this.fastDescentRamp = moveToward(this.fastDescentRamp, 0, dt / FLIGHT.FAST_DESCENT_RAMP_TIME);
    }
    if (this.fastDescentRamp > 0) {
      velocity.y -= FLIGHT.FAST_DESCENT_SPEED * this.fastDescentRamp;
    }

    // Gentle descent with precision-descend key (slow, controlled lowering)
    if (this.isGentleDescending) {
      this.gentleDescentRamp = moveToward(this.gentleDescentRamp, 1, dt / FLIGHT.GENTLE_DESCENT_RAMP_TIME);
    } else {
      this.gentleDescentRamp = moveToward(this.gentleDescentRamp, 0, dt / FLIGHT.GENTLE_DESCENT_RAMP_TIME);
    }
    if (this.gentleDescentRamp > 0) {
      velocity.y -= FLIGHT.GENTLE_DESCENT_SPEED * this.gentleDescentRamp;
    }

    // Auto-descent — faster flight = less sink (soaring feel)
    // When braking, reduce descent for better control
    if (!this.isDiving && !ascendInput) {
      const soarFactor = remap(this.forwardSpeed, 0, FLIGHT.MAX_SPEED, 1.0, 0.3);
      const brakeReduction = this.isBraking ? FLIGHT.BRAKE_DESCENT_REDUCTION : 1.0;
      const descentReduction = clamp(
        1 - this.glideFlow * FLIGHT.FLOW_DESCENT_REDUCTION - pullOutFactor * FLIGHT.PULL_OUT_DESCENT_REDUCTION,
        0.2,
        1,
      );
      velocity.y -= FLIGHT.AUTO_DESCENT_RATE * soarFactor * brakeReduction * descentReduction;
    }

    // IMPROVEMENT #3: Ground effect lift (risk/reward for low-altitude flight)
    if (this.position.y < FLIGHT.GROUND_EFFECT_ALTITUDE && this.forwardSpeed > FLIGHT.GROUND_EFFECT_MIN_SPEED && !ascendInput) {
      const heightFactor = 1 - (this.position.y / FLIGHT.GROUND_EFFECT_ALTITUDE); // 1 at ground, 0 at threshold
      const speedFactor = remap(this.forwardSpeed, FLIGHT.GROUND_EFFECT_MIN_SPEED, FLIGHT.MAX_SPEED, 0, 1);
      const liftBonus = heightFactor * speedFactor * FLIGHT.GROUND_EFFECT_LIFT_BONUS;
      velocity.y += liftBonus;
    }

    if (airflow > 0 && !ascendInput && !this.isDiving) {
      const flowLift = this.glideFlow * FLIGHT.FLOW_LIFT_BONUS + pullOutFactor * FLIGHT.PULL_OUT_LIFT_BONUS;
      velocity.y += flowLift + skimFactor * this.glideFlow * FLIGHT.FLOW_SKIM_LIFT_BONUS;
    }

    // Hover descent: when slow, sink more aggressively
    // When braking, reduce descent significantly for gentle slow flight
    if (this.forwardSpeed < FLIGHT.HOVER_SPEED_THRESHOLD && !ascendInput && !this.isDiving) {
      const hoverFactor = 1 - (this.forwardSpeed / FLIGHT.HOVER_SPEED_THRESHOLD);
      const brakeReduction = this.isBraking ? FLIGHT.BRAKE_DESCENT_REDUCTION : 1.0;
      velocity.y -= FLIGHT.HOVER_DESCENT_RATE * hoverFactor * brakeReduction;
    }

    // Banking sink: turning causes slight altitude loss
    // Reduce when braking for easier slow-speed maneuvering
    const bankAmount = Math.abs(this.rollAngle / FLIGHT.MAX_BANK_ANGLE);
    if (bankAmount > 0.1 && !ascendInput) {
      const brakeReduction = this.isBraking ? FLIGHT.BRAKE_DESCENT_REDUCTION : 1.0;
      const bankSinkReduction = clamp(1 - this.glideFlow * FLIGHT.FLOW_BANK_SINK_REDUCTION - pullOutFactor * 0.45, 0.2, 1);
      velocity.y -= FLIGHT.BANK_SINK_RATE * bankAmount * brakeReduction * bankSinkReduction;
    }

    // Scroll wheel altitude control: fast, responsive, momentum-based
    const scrollDelta = input.getScrollDelta();
    if (scrollDelta !== 0) {
      // Each scroll tick gives a big kick — scroll up = rise, scroll down = descend
      const impulse = clamp(-scrollDelta / FLIGHT.SCROLL_IMPULSE_DIVISOR, -1, 1) * FLIGHT.SCROLL_IMPULSE_SCALE;
      this.scrollVelocity += impulse;
      this.scrollVelocity = clamp(this.scrollVelocity, -FLIGHT.SCROLL_VELOCITY_MAX, FLIGHT.SCROLL_VELOCITY_MAX);
    }
    if (Math.abs(this.scrollVelocity) > 0.5) {
      velocity.y += this.scrollVelocity * dt;
      // Gentle decay so momentum carries — feels fast but still smooth
      this.scrollVelocity *= Math.exp(-FLIGHT.SCROLL_DECAY * dt);
    } else {
      this.scrollVelocity = 0;
    }

    // Altitude clamping
    if (this.position.y >= FLIGHT.MAX_ALTITUDE) {
      velocity.y = Math.min(velocity.y, -FLIGHT.CEILING_PUSH_STRENGTH);
    }
    // MIN_ALTITUDE floor only when flying fast enough (allows landing when slow)
    // Don't apply when braking to allow low-altitude slow flight
    if (this.position.y <= FLIGHT.MIN_ALTITUDE && this.forwardSpeed >= FLIGHT.LANDING_SPEED && !this.isBraking) {
      velocity.y = Math.max(velocity.y, 0);
      this.position.y = FLIGHT.MIN_ALTITUDE;
    }

    // Rooftop collision: don't fall through buildings while flying
    const roofBelow = this.getRooftopBelow();
    if (roofBelow > 0 && this.position.y <= roofBelow + 0.5 && velocity.y < 0) {
      velocity.y = Math.max(velocity.y, 0);
    }

    _displacement.copy(velocity).multiplyScalar(dt);

    // COLLISION DETECTION: Swept substep collision to prevent tunneling through buildings
    this.moveWithCollision(_displacement);

    // Soft boundary push-back
    this.applySoftBoundary(dt);
  }

  private handleGroundMode(dt: number, input: InputManager, floorY: number): void {
    this.resetAirflowState();
    this.isGrounded = true;
    this.isDiving = false;
    this.isBraking = false;
    this.isBomberMode = false;
    this.isPerched = floorY > FLIGHT.GROUND_ALTITUDE + 1;
    this.position.y = floorY;
    this.pitchAngle = 0;

    const horizontalInput = input.getAxis('horizontal');
    const verticalInput = input.getAxis('vertical');
    const moveMag = Math.hypot(horizontalInput, verticalInput);

    // Full ground locomotion: walk in any direction with WASD/left stick.
    if (moveMag > 0.1) {
      const nx = -horizontalInput / moveMag;
      const nz = verticalInput / moveMag;

      // Face movement direction relative to current heading while grounded.
      const inputAngle = Math.atan2(nx, nz);
      const targetYaw = this.yawAngle + inputAngle;
      const yawDelta = Math.atan2(Math.sin(targetYaw - this.yawAngle), Math.cos(targetYaw - this.yawAngle));
      this.yawAngle += clamp(yawDelta, -FLIGHT.YAW_RATE * dt * 1.2, FLIGHT.YAW_RATE * dt * 1.2);

      // Keep S-only backward walk slower for readability/feel.
      const backwardOnly = verticalInput < -0.1 && Math.abs(horizontalInput) < 0.1;
      const baseWalkSpeed = backwardOnly ? FLIGHT.GROUND_WALK_BACKWARD_SPEED : FLIGHT.GROUND_WALK_SPEED;
      const targetSpeed = baseWalkSpeed * Math.min(1, moveMag);
      this.forwardSpeed = moveToward(this.forwardSpeed, targetSpeed, 20 * dt);

      _euler.set(0, this.yawAngle, 0, 'YXZ');
      _quat.setFromEuler(_euler);
      _forward.set(0, 0, -1).applyQuaternion(_quat);
      _displacement.copy(_forward).multiplyScalar(this.forwardSpeed * dt);

      // Check collision before applying ground movement
      _newPos.copy(this.position).add(_displacement);
      const collision = this.checkBuildingCollision(_newPos);
      if (!collision.hasCollision) {
        this.position.add(_displacement);
      } else {
        // Try sliding along the wall
        this.calculateSlideMovement(_displacement, collision.normal, _slideVec);
        _slidePos.copy(this.position).add(_slideVec);
        const slideCheck = this.checkBuildingCollision(_slidePos);
        if (!slideCheck.hasCollision) {
          this.position.add(_slideVec);
        }
        // else: blocked on all sides, just stop
      }

      // If perched on rooftop and walked off the edge, fall off
      if (this.isPerched) {
        const newRoof = this.getRooftopBelow();
        if (newRoof < this.perchHeight - 1) {
          this.isGrounded = false;
          this.isPerched = false;
          this.forwardSpeed = FLIGHT.GROUND_TAKEOFF_SPEED * 0.5;
        }
      }
    } else {
      this.forwardSpeed = moveToward(this.forwardSpeed, 0, 20 * dt);
    }

    this.applySoftBoundary(dt);
    this.rollAngle = moveToward(this.rollAngle, 0, FLIGHT.BANK_SPEED * dt);
  }

  /**
   * Move the bird with swept substep collision detection.
   * Subdivides large displacements into smaller steps to prevent tunneling through buildings.
   */
  private moveWithCollision(displacement: THREE.Vector3): void {
    const SUBSTEP_SIZE = FLIGHT.SUBSTEP_SIZE; // Max movement per substep (< birdRadius of 1.5)
    const totalDist = displacement.length();

    if (totalDist < 0.0001) return;

    const numSteps = Math.max(1, Math.ceil(totalDist / SUBSTEP_SIZE));
    _stepDisp.copy(displacement).divideScalar(numSteps);

    for (let i = 0; i < numSteps; i++) {
      _newPos.copy(this.position).add(_stepDisp);
      const collisionResult = this.checkBuildingCollision(_newPos);

      if (collisionResult.hasCollision) {
        // Try sliding along the building surface
        this.calculateSlideMovement(_stepDisp, collisionResult.normal, _slideVec);
        _slidePos.copy(this.position).add(_slideVec);

        const slideCheck = this.checkBuildingCollision(_slidePos);
        if (!slideCheck.hasCollision) {
          this.position.copy(_slidePos);
          this.totalDistanceFlown += _slideVec.length();
        } else {
          // Can't move at all — reduce speed and stop stepping
          this.forwardSpeed *= FLIGHT.COLLISION_SLIDE_FACTOR;
          break;
        }
      } else {
        this.position.add(_stepDisp);
        this.totalDistanceFlown += _stepDisp.length();
      }
    }

    // Depenetration: if bird ended up inside a building, push it out
    this.depenetrate();
  }

  /**
   * If the bird is currently inside a building, push it out to the nearest surface.
   */
  private depenetrate(): void {
    const birdRadius = FLIGHT.BIRD_RADIUS;
    const px = this.position.x;
    const py = this.position.y;
    const pz = this.position.z;

    for (const b of this.buildings) {
      const halfW = b.width / 2;
      const halfD = b.depth / 2;

      if (py < 0 || py > b.height) continue;

      const closestX = clamp(px, b.position.x - halfW, b.position.x + halfW);
      const closestZ = clamp(pz, b.position.z - halfD, b.position.z + halfD);

      const dx = px - closestX;
      const dz = pz - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < birdRadius * birdRadius) {
        if (distSq > 0.0001) {
          // Push outward along the penetration direction
          const dist = Math.sqrt(distSq);
          const pushDist = birdRadius - dist + FLIGHT.DEPENETRATION_MARGIN;
          this.position.x += (dx / dist) * pushDist;
          this.position.z += (dz / dist) * pushDist;
        } else {
          // Fully inside — push to the nearest face
          const distToLeft = Math.abs(px - (b.position.x - halfW));
          const distToRight = Math.abs(px - (b.position.x + halfW));
          const distToFront = Math.abs(pz - (b.position.z - halfD));
          const distToBack = Math.abs(pz - (b.position.z + halfD));
          const minDist = Math.min(distToLeft, distToRight, distToFront, distToBack);

          if (minDist === distToLeft) this.position.x = b.position.x - halfW - birdRadius - FLIGHT.DEPENETRATION_MARGIN;
          else if (minDist === distToRight) this.position.x = b.position.x + halfW + birdRadius + FLIGHT.DEPENETRATION_MARGIN;
          else if (minDist === distToFront) this.position.z = b.position.z - halfD - birdRadius - FLIGHT.DEPENETRATION_MARGIN;
          else this.position.z = b.position.z + halfD + birdRadius + FLIGHT.DEPENETRATION_MARGIN;
        }

        this.forwardSpeed *= FLIGHT.DEPENETRATION_SPEED_FACTOR;
        return; // Fix one penetration per frame to avoid jitter
      }
    }
  }

  /** Returns the height of the tallest building rooftop directly below the bird, or 0. */
  private getRooftopBelow(): number {
    let maxH = 0;
    const px = this.position.x;
    const pz = this.position.z;
    for (const b of this.buildings) {
      const halfW = b.width / 2 + FLIGHT.ROOFTOP_MARGIN;
      const halfD = b.depth / 2 + FLIGHT.ROOFTOP_MARGIN;
      if (
        px >= b.position.x - halfW && px <= b.position.x + halfW &&
        pz >= b.position.z - halfD && pz <= b.position.z + halfD &&
        b.height > maxH
      ) {
        maxH = b.height;
      }
    }
    return maxH;
  }

  private snapToFloor(): void {
    const rooftopY = this.getRooftopBelow();
    const floorY = Math.max(FLIGHT.GROUND_ALTITUDE, rooftopY);
    this.perchHeight = rooftopY;
    this.position.y = floorY;
  }

  /** Check if a position would collide with any building */
  private checkBuildingCollision(position: THREE.Vector3): { hasCollision: boolean; normal: THREE.Vector3 } {
    const birdRadius = FLIGHT.BIRD_RADIUS; // Collision radius around the bird
    const px = position.x;
    const py = position.y;
    const pz = position.z;

    for (const b of this.buildings) {
      const halfW = b.width / 2;
      const halfD = b.depth / 2;
      const buildingTop = b.height;

      // Check if bird is within the building's height range
      if (py < 0 || py > buildingTop) continue;

      // Calculate closest point on the building's AABB (Axis-Aligned Bounding Box)
      const closestX = clamp(px, b.position.x - halfW, b.position.x + halfW);
      const closestZ = clamp(pz, b.position.z - halfD, b.position.z + halfD);

      // Calculate distance from bird to closest point
      const dx = px - closestX;
      const dz = pz - closestZ;
      const distanceSquared = dx * dx + dz * dz;

      // If distance is less than bird's radius, we have a collision
      if (distanceSquared < birdRadius * birdRadius) {
        // Calculate collision normal (direction to push the bird away from building)
        _hitCollision.normal.set(dx, 0, dz);
        if (_hitCollision.normal.lengthSq() > 0.0001) {
          _hitCollision.normal.normalize();
        } else {
          // Bird is exactly at the center of the building - push in any direction
          _hitCollision.normal.set(1, 0, 0);
        }

        return _hitCollision;
      }
    }

    return _noCollision;
  }

  /** Calculate slide movement along a surface when colliding. Result written to `out`. */
  private calculateSlideMovement(displacement: THREE.Vector3, collisionNormal: THREE.Vector3, out: THREE.Vector3): void {
    // Remove the component of movement that's going into the surface
    // This creates a sliding effect along the building wall
    const normalDot = displacement.dot(collisionNormal);

    if (normalDot < 0) {
      // Moving into the surface - project displacement onto the surface plane
      out.copy(displacement);
      out.addScaledVector(collisionNormal, -normalDot);
      out.multiplyScalar(FLIGHT.SLIDE_SPEED_FACTOR); // Reduce speed slightly when sliding
    } else {
      // Moving away from surface, allow normal movement
      out.copy(displacement);
    }
  }

  /** Gentle push-back when approaching map edges (no hard walls). */
  private applySoftBoundary(dt: number): void {
    const soft = WORLD.BOUNDARY_SOFT_EDGE;
    const hard = WORLD.BOUNDARY_HARD_EDGE;
    const strength = WORLD.BOUNDARY_PUSH_STRENGTH;

    const pushAxis = (val: number): number => {
      if (val > soft) {
        const t = clamp((val - soft) / (hard - soft), 0, 1);
        return -t * t * strength * dt;
      }
      if (val < -soft) {
        const t = clamp((-val - soft) / (hard - soft), 0, 1);
        return t * t * strength * dt;
      }
      return 0;
    };

    this.position.x += pushAxis(this.position.x);
    this.position.z += pushAxis(this.position.z);

    // Hard clamp: absolute backstop so nothing can ever escape the map
    this.position.x = clamp(this.position.x, -hard, hard);
    this.position.z = clamp(this.position.z, -hard, hard);
  }

  private resetAirflowState(): void {
    this.glideFlow = 0;
    this.pendingPullOutAssist = 0;
    this.pendingPullOutTimer = 0;
    this.pullOutAssist = 0;
    this.pullOutTimer = 0;
    this.pullOutJustActivated = false;
  }

  getGlideFlow(): number {
    return this.glideFlow;
  }

  getPullOutBlend(): number {
    if (this.pullOutTimer <= 0 || this.pullOutAssist <= 0) return 0;
    return this.pullOutAssist * clamp(this.pullOutTimer / FLIGHT.PULL_OUT_DURATION, 0, 1);
  }

  getAirflow(): number {
    return Math.max(this.glideFlow, this.getPullOutBlend());
  }

  getQuaternion(): THREE.Quaternion {
    _euler.set(this.pitchAngle, this.yawAngle, this.rollAngle, 'YXZ');
    _quat.setFromEuler(_euler);

    // Apply flip rotation if currently flipping
    if (this.isFlipping && this.flipType) {
      const flipRot = this.getFlipRotation();

      switch (this.flipType) {
        case 'front':
          _flipAxis.set(1, 0, 0);
          _flipQuat.setFromAxisAngle(_flipAxis, flipRot);
          break;
        case 'back':
          _flipAxis.set(1, 0, 0);
          _flipQuat.setFromAxisAngle(_flipAxis, -flipRot);
          break;
        case 'left':
          _flipAxis.set(0, 0, 1);
          _flipQuat.setFromAxisAngle(_flipAxis, -flipRot);
          break;
        case 'right':
          _flipAxis.set(0, 0, 1);
          _flipQuat.setFromAxisAngle(_flipAxis, flipRot);
          break;
        case 'corkscrewLeft':
          _flipAxis.set(0, 0, 1);
          _corkscrewRoll.setFromAxisAngle(_flipAxis, -flipRot);
          _flipAxis.set(1, 0, 0);
          _corkscrewPitch.setFromAxisAngle(_flipAxis, flipRot * FLIGHT.CORKSCREW_PITCH_MULT);
          _flipQuat.multiplyQuaternions(_corkscrewRoll, _corkscrewPitch);
          break;
        case 'corkscrewRight':
          _flipAxis.set(0, 0, 1);
          _corkscrewRoll.setFromAxisAngle(_flipAxis, flipRot);
          _flipAxis.set(1, 0, 0);
          _corkscrewPitch.setFromAxisAngle(_flipAxis, flipRot * FLIGHT.CORKSCREW_PITCH_MULT);
          _flipQuat.multiplyQuaternions(_corkscrewRoll, _corkscrewPitch);
          break;
        case 'sideFlipLeft':
          _flipAxis.set(0, 1, 0);
          _flipQuat.setFromAxisAngle(_flipAxis, -flipRot);
          break;
        case 'sideFlipRight':
          _flipAxis.set(0, 1, 0);
          _flipQuat.setFromAxisAngle(_flipAxis, flipRot);
          break;
        case 'inverted':
          _flipAxis.set(1, 0, 0);
          _flipQuat.setFromAxisAngle(_flipAxis, flipRot * FLIGHT.INVERTED_PITCH_MULT);
          break;
        case 'aileronRoll':
          _flipAxis.set(0, 0, 1);
          _flipQuat.setFromAxisAngle(_flipAxis, flipRot);
          break;
      }

      // Apply flip rotation in local space
      _quat.multiply(_flipQuat);
    }

    return _quat;
  }

  getForward(): THREE.Vector3 {
    _euler.set(this.pitchAngle, this.yawAngle, 0, 'YXZ');
    _quat.setFromEuler(_euler);
    return _forward.set(0, 0, -1).applyQuaternion(_quat);
  }

  private startFlip(type: 'front' | 'back' | 'left' | 'right' | 'corkscrewLeft' | 'corkscrewRight' |
                            'sideFlipLeft' | 'sideFlipRight' | 'inverted' | 'aileronRoll', isDouble: boolean = false): void {
    this.isFlipping = true;
    this.flipType = type;
    this.flipProgress = 0;
    this.flipRotation = 0;
    this.isDoubleFlip = isDouble;

    // Set duration based on flip type
    let baseDuration = FLIGHT.FLIP_DURATION;
    switch (type) {
      case 'aileronRoll':
        baseDuration = FLIGHT.AILERON_ROLL_DURATION;
        break;
      case 'corkscrewLeft':
      case 'corkscrewRight':
        baseDuration = FLIGHT.CORKSCREW_DURATION;
        break;
      case 'inverted':
        baseDuration = FLIGHT.INVERTED_DURATION;
        break;
      default:
        baseDuration = FLIGHT.FLIP_DURATION;
        break;
    }

    // Double flips take longer
    this.flipDuration = isDouble ? baseDuration * FLIGHT.FLIP_DOUBLE_MULT : baseDuration;

    // Notify flip tracker
    this.onFlipPerformed?.(type, isDouble);
  }

  private getFlipRotation(): number {
    if (!this.isFlipping || !this.flipType) return 0;

    // Use easing for smooth flip animation (ease-in-out)
    const t = this.flipProgress;
    const eased = t < 0.5
      ? 2 * t * t
      : 1 - Math.pow(-2 * t + 2, 2) / 2;

    // Double flips rotate 720° instead of 360°
    const rotationMultiplier = this.isDoubleFlip ? 4 : 2;
    return eased * Math.PI * rotationMultiplier;
  }

  // Public getters for flip state
  getFlipComboCount(): number {
    return this.flipComboCount;
  }

  isCurrentlyFlipping(): boolean {
    return this.isFlipping;
  }

  getCurrentFlipType(): string | null {
    if (!this.flipType) return null;
    return this.isDoubleFlip ? `Double ${this.flipType}` : this.flipType;
  }

  isCurrentlyUTurning(): boolean {
    return this.isUTurning;
  }
}
