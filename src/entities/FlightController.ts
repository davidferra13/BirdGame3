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
  isPerched = false;   // grounded on a rooftop (not street level)
  isBoosting = false;
  boostJustActivated = false; // true for one frame on boost start
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
  private flipDuration = 0.8; // seconds for a complete flip
  private flipRotation = 0; // accumulated flip rotation
  private flipCooldown = 0; // cooldown between flips
  private isDoubleFlip = false; // whether this is a double flip (720°)
  private flipComboCount = 0; // consecutive flips performed
  private flipComboTimer = 0; // time window for combo

  // U-turn (180° snap turn)
  private isUTurning = false;
  private uTurnProgress = 0;
  private uTurnDuration = 0.35; // seconds for the 180
  private uTurnStartYaw = 0;
  private uTurnCooldown = 0;

  // Callback for flip tracking
  onFlipPerformed: ((type: string, isDouble: boolean) => void) | null = null;

  // Dive-to-speed conversion
  private wasDiving = false;
  private divePeakSpeed = 0;
  private diveMomentumBoost = 0;
  private diveMomentumTimer = 0;

  private walkDirection = 1;

  // Smooth scroll altitude control
  private scrollVelocity = 0;         // current smoothed scroll vertical velocity

  totalDistanceFlown = 0;

  // Building data for rooftop perching
  private buildings: BuildingData[] = [];
  private perchHeight = 0;

  setBuildings(buildings: BuildingData[]): void {
    this.buildings = buildings;
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

    // Ground / perch mode
    const rooftopY = this.getRooftopBelow();
    const floorY = Math.max(FLIGHT.GROUND_ALTITUDE, rooftopY);

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
        this.uTurnCooldown = 0.5;
        this.turnMomentum = 0;
        this.rollAngle = 0;
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
    } else if (!this.isDiving && this.wasDiving) {
      // Exiting dive - convert dive speed to horizontal momentum
      const diveSpeedGained = this.divePeakSpeed - FLIGHT.BASE_SPEED;
      if (diveSpeedGained > 0) {
        this.diveMomentumBoost = diveSpeedGained * FLIGHT.DIVE_MOMENTUM_CONVERSION;
        this.diveMomentumTimer = FLIGHT.DIVE_MOMENTUM_DURATION;
      }
    }
    this.wasDiving = this.isDiving;

    // Boost
    if (this.boostCooldown > 0) this.boostCooldown -= dt;
    if (this.boostTimer > 0) this.boostTimer -= dt;

    this.boostJustActivated = false;
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
      this.rollAngle = moveToward(this.rollAngle, targetRoll, FLIGHT.BANK_SPEED * dt);

      // Turn rate based on bank angle (like real birds)
      const bankTurnFactor = Math.sin(this.rollAngle);
      const speedBasedTurnRate = remap(this.forwardSpeed, 0, FLIGHT.MAX_SPEED, 2.5, 1.2);
      const effectiveTurnRate = bankTurnFactor * FLIGHT.YAW_RATE * speedBasedTurnRate;

      // IMPROVEMENT #5: Turn inertia - high speed resists rapid direction changes
      const desiredTurn = effectiveTurnRate * dt;
      const speedInertiaFactor = remap(this.forwardSpeed, 0, FLIGHT.MAX_SPEED, 1.0, 0.4);
      const turnAccel = 12.0 * speedInertiaFactor; // Slower turn response at high speed

      this.turnMomentum = moveToward(this.turnMomentum, desiredTurn, turnAccel * dt);
      this.yawAngle += this.turnMomentum;
    }

    // Pitch — smoothed with acceleration/deceleration like yaw
    let targetPitchRate = 0;
    if (this.isDiveBombing) {
      // Dive bomb: steeper pitch, faster descent
      this.pitchAngle = moveToward(this.pitchAngle, FLIGHT.DIVE_BOMB_PITCH, 5.0 * dt);
      targetPitchRate = 0;
    } else if (this.isDiving) {
      this.pitchAngle = moveToward(this.pitchAngle, FLIGHT.DIVE_PITCH, 4.0 * dt);
      targetPitchRate = 0;
    } else if (ascendInput) {
      this.pitchAngle = moveToward(this.pitchAngle, FLIGHT.MAX_PITCH_UP * 0.5, 3.0 * dt);
      targetPitchRate = 0;
    } else if (this.isBraking) {
      this.pitchAngle = moveToward(this.pitchAngle, 0, 2.0 * dt);
      targetPitchRate = 0;
    } else if (this.isGentleDescending) {
      // Precision descend takes priority over W pitch-up for better attack-run control.
      this.pitchAngle = moveToward(this.pitchAngle, FLIGHT.GENTLE_DESCENT_PITCH, 1.5 * dt);
      targetPitchRate = 0;
    } else if (pitchInput > 0) {
      // W key: shallow climb bias so forward speed feels primary (Space remains main vertical control)
      this.pitchAngle = moveToward(this.pitchAngle, FLIGHT.MAX_PITCH_UP * 0.35, 2.2 * dt);
      targetPitchRate = 0;
    } else {
      // No input: gentle auto-descent pitch
      this.pitchAngle = moveToward(this.pitchAngle, FLIGHT.AUTO_DESCENT_PITCH, 0.5 * dt);
      targetPitchRate = 0;
    }
    const pitchAccel = targetPitchRate !== 0 ? FLIGHT.PITCH_ACCELERATION : FLIGHT.PITCH_DECELERATION;
    this.pitchRate = moveToward(this.pitchRate, targetPitchRate, pitchAccel * dt);
    this.pitchAngle += this.pitchRate * dt;
    this.pitchAngle = clamp(this.pitchAngle, FLIGHT.MAX_PITCH_DOWN, FLIGHT.MAX_PITCH_UP);

    // Speed
    // IMPROVEMENT #1: Curve-based acceleration (adds weight/inertia)
    if (this.isDiveBombing) {
      // Dive bomb: much faster speed
      const gap = FLIGHT.DIVE_BOMB_SPEED - this.forwardSpeed;
      const easeRate = 3.5; // Even faster acceleration
      this.forwardSpeed += gap * easeRate * dt;
      // Track peak dive speed for momentum conversion
      if (this.forwardSpeed > this.divePeakSpeed) {
        this.divePeakSpeed = this.forwardSpeed;
      }
    } else if (this.isDiving) {
      const gap = FLIGHT.DIVE_SPEED - this.forwardSpeed;
      const easeRate = 2.5; // Ease-out: faster accel as you approach target
      this.forwardSpeed += gap * easeRate * dt;
      // Track peak dive speed for momentum conversion
      if (this.forwardSpeed > this.divePeakSpeed) {
        this.divePeakSpeed = this.forwardSpeed;
      }
    } else if (this.isBraking) {
      // S key: brake to minimum cruise speed (only slows down, never speeds up)
      if (this.forwardSpeed > FLIGHT.BRAKE_MIN_SPEED) {
        const gap = FLIGHT.BRAKE_MIN_SPEED - this.forwardSpeed;
        const easeRate = 3.5; // Faster decel feels heavier
        this.forwardSpeed += gap * easeRate * dt;
      }
      // If already at or below brake speed, maintain current speed
    } else {
      const pitchSpeedMod = remap(this.pitchAngle, -0.8, 0.6, 10, -8);
      let targetSpeed = FLIGHT.BASE_SPEED + pitchSpeedMod + forwardInput * 12;
      if (this.isBoosting) targetSpeed *= FLIGHT.BOOST_MULTIPLIER;

      // Apply dive momentum boost
      if (this.diveMomentumTimer > 0) {
        const momentumFactor = this.diveMomentumTimer / FLIGHT.DIVE_MOMENTUM_DURATION;
        targetSpeed += this.diveMomentumBoost * momentumFactor;
        this.diveMomentumTimer -= dt;
      }

      targetSpeed = clamp(targetSpeed, FLIGHT.MIN_SPEED, FLIGHT.MAX_SPEED);
      const gap = targetSpeed - this.forwardSpeed;
      // Different rates for accel vs decel (decel faster = more weight)
      const easeRate = gap > 0 ? 1.8 : 3.0;
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
        this.flipCooldown = 0.2; // 0.2 second cooldown between flips

        // Update combo system
        this.flipComboCount++;
        this.flipComboTimer = 2.0; // 2 second window to continue combo

        // Log combo achievements
        if (this.flipComboCount >= 3) {
          console.log(`🎯 Flip Combo x${this.flipComboCount}!`);
        }
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
      velocity.y -= FLIGHT.AUTO_DESCENT_RATE * soarFactor * brakeReduction;
    }

    // IMPROVEMENT #3: Ground effect lift (risk/reward for low-altitude flight)
    const groundEffectAltitude = 8;
    if (this.position.y < groundEffectAltitude && this.forwardSpeed > 20 && !ascendInput) {
      const heightFactor = 1 - (this.position.y / groundEffectAltitude); // 1 at ground, 0 at threshold
      const speedFactor = remap(this.forwardSpeed, 20, FLIGHT.MAX_SPEED, 0, 1);
      const liftBonus = heightFactor * speedFactor * 6; // Counteracts auto-descent
      velocity.y += liftBonus;
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
      velocity.y -= FLIGHT.BANK_SINK_RATE * bankAmount * brakeReduction;
    }

    // Scroll wheel altitude control: fast, responsive, momentum-based
    const scrollDelta = input.getScrollDelta();
    if (scrollDelta !== 0) {
      // Each scroll tick gives a big kick — scroll up = rise, scroll down = descend
      const impulse = clamp(-scrollDelta / 50, -1, 1) * 400;
      this.scrollVelocity += impulse;
      this.scrollVelocity = clamp(this.scrollVelocity, -600, 600);
    }
    if (Math.abs(this.scrollVelocity) > 0.5) {
      velocity.y += this.scrollVelocity * dt;
      // Gentle decay so momentum carries — feels fast but still smooth
      this.scrollVelocity *= Math.exp(-3 * dt);
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
    this.isGrounded = true;
    this.isDiving = false;
    this.isBraking = false;
    this.isBomberMode = false;
    this.isPerched = floorY > FLIGHT.GROUND_ALTITUDE + 1;
    this.position.y = floorY;
    this.pitchAngle = 0;

    const yawInput = input.getAxis('horizontal');
    const forwardInput = input.getAxis('vertical');

    this.yawAngle += -yawInput * FLIGHT.YAW_RATE * 0.5 * dt;

    // W = walk forward, S = walk backward
    let targetSpeed: number;
    if (forwardInput > 0) {
      targetSpeed = FLIGHT.GROUND_WALK_SPEED;
      this.walkDirection = 1;
    } else if (forwardInput < 0) {
      targetSpeed = FLIGHT.GROUND_WALK_BACKWARD_SPEED;
      this.walkDirection = -1;
    } else {
      targetSpeed = 0;
    }

    this.forwardSpeed = moveToward(this.forwardSpeed, targetSpeed, 20 * dt);

    if (this.forwardSpeed > 0.1) {
      _euler.set(0, this.yawAngle, 0, 'YXZ');
      _quat.setFromEuler(_euler);
      _forward.set(0, 0, -1).applyQuaternion(_quat);
      _displacement.copy(_forward).multiplyScalar(this.forwardSpeed * this.walkDirection * dt);

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
    }

    this.applySoftBoundary(dt);
    this.rollAngle = moveToward(this.rollAngle, 0, FLIGHT.BANK_SPEED * dt);
  }

  /**
   * Move the bird with swept substep collision detection.
   * Subdivides large displacements into smaller steps to prevent tunneling through buildings.
   */
  private moveWithCollision(displacement: THREE.Vector3): void {
    const SUBSTEP_SIZE = 1.0; // Max movement per substep (< birdRadius of 1.5)
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
          this.forwardSpeed *= 0.7;
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
    const birdRadius = 1.5;
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
          const pushDist = birdRadius - dist + 0.1; // small extra margin
          this.position.x += (dx / dist) * pushDist;
          this.position.z += (dz / dist) * pushDist;
        } else {
          // Fully inside — push to the nearest face
          const distToLeft = Math.abs(px - (b.position.x - halfW));
          const distToRight = Math.abs(px - (b.position.x + halfW));
          const distToFront = Math.abs(pz - (b.position.z - halfD));
          const distToBack = Math.abs(pz - (b.position.z + halfD));
          const minDist = Math.min(distToLeft, distToRight, distToFront, distToBack);

          if (minDist === distToLeft) this.position.x = b.position.x - halfW - birdRadius - 0.1;
          else if (minDist === distToRight) this.position.x = b.position.x + halfW + birdRadius + 0.1;
          else if (minDist === distToFront) this.position.z = b.position.z - halfD - birdRadius - 0.1;
          else this.position.z = b.position.z + halfD + birdRadius + 0.1;
        }

        this.forwardSpeed *= 0.5;
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
      const halfW = b.width / 2 + 0.3;
      const halfD = b.depth / 2 + 0.3;
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

  /** Check if a position would collide with any building */
  private checkBuildingCollision(position: THREE.Vector3): { hasCollision: boolean; normal: THREE.Vector3 } {
    const birdRadius = 1.5; // Collision radius around the bird
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
      out.multiplyScalar(0.8); // Reduce speed slightly when sliding
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
          _corkscrewPitch.setFromAxisAngle(_flipAxis, flipRot * 0.3);
          _flipQuat.multiplyQuaternions(_corkscrewRoll, _corkscrewPitch);
          break;
        case 'corkscrewRight':
          _flipAxis.set(0, 0, 1);
          _corkscrewRoll.setFromAxisAngle(_flipAxis, flipRot);
          _flipAxis.set(1, 0, 0);
          _corkscrewPitch.setFromAxisAngle(_flipAxis, flipRot * 0.3);
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
          _flipQuat.setFromAxisAngle(_flipAxis, flipRot * 0.5);
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
    let baseDuration = 0.8;
    switch (type) {
      case 'aileronRoll':
        baseDuration = 1.2; // Slower, smoother roll
        break;
      case 'corkscrewLeft':
      case 'corkscrewRight':
        baseDuration = 1.0; // Spiral takes longer
        break;
      case 'inverted':
        baseDuration = 0.6; // Quick half flip
        break;
      default:
        baseDuration = 0.8; // Standard flip duration
        break;
    }

    // Double flips take longer
    this.flipDuration = isDouble ? baseDuration * 1.6 : baseDuration;

    // Log flip initiation
    console.log(`🎪 ${isDouble ? 'Double ' : ''}${type} flip!`);

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
