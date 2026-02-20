import * as THREE from 'three';
import { InputManager } from '../core/InputManager';
import { BuildingData } from '../world/City';
import { DRIVING, WORLD } from '../utils/Constants';
import { clamp, moveToward, remap } from '../utils/MathUtils';
import { createToonMaterial } from '../rendering/ToonUtils';

export type DrivableVehicleType = 'car' | 'motorcycle' | 'helicopter' | 'prop_plane' | 'horse';

interface VehicleHandling {
  maxSpeed: number;
  maxReverse: number;
  acceleration: number;
  brakeForce: number;
  reverseAcceleration: number;
  friction: number;
  handbrakeForce: number;
  maxSteerAngle: number;
  steerSpeed: number;
  wheelbase: number;
  collisionRadius: number;
}

export class DrivableCar {
  readonly type: DrivableVehicleType;
  readonly mesh: THREE.Group;
  readonly position = new THREE.Vector3();
  heading = 0;
  speed = 0;
  steerAngle = 0;
  verticalSpeed = 0;

  occupied = false;

  readonly seatOffset: THREE.Vector3;

  private wheels: THREE.Mesh[] = [];
  private frontWheelPivots: THREE.Group[] = [];
  private taillights: THREE.Mesh[] = [];
  private rotorMain: THREE.Mesh | null = null;
  private rotorTail: THREE.Mesh | null = null;
  private propeller: THREE.Mesh | null = null;
  private horseLegs: THREE.Mesh[] = [];
  private horseGaitTime = 0;
  private horseRideBob = 0;
  private buildings: BuildingData[] = [];
  private readonly handling: VehicleHandling;

  constructor(spawnPos: THREE.Vector3, spawnHeading: number, type: DrivableVehicleType = 'car') {
    this.type = type;
    this.handling = this.getHandling(type);
    this.seatOffset = this.getSeatOffset(type);
    this.mesh = this.createMesh(type);
    this.position.copy(spawnPos);
    this.heading = spawnHeading;
    this.mesh.position.copy(spawnPos);
    this.mesh.rotation.y = spawnHeading;
  }

  setBuildings(buildings: BuildingData[]): void {
    this.buildings = buildings;
  }

  private getHandling(type: DrivableVehicleType): VehicleHandling {
    switch (type) {
      case 'motorcycle':
        return {
          maxSpeed: 42,
          maxReverse: 6,
          acceleration: 30,
          brakeForce: 52,
          reverseAcceleration: 8,
          friction: 11,
          handbrakeForce: 75,
          maxSteerAngle: 0.95,
          steerSpeed: 7.5,
          wheelbase: 1.9,
          collisionRadius: 1.6,
        };
      case 'helicopter':
        return {
          maxSpeed: 24,
          maxReverse: 10,
          acceleration: 14,
          brakeForce: 26,
          reverseAcceleration: 8,
          friction: 6,
          handbrakeForce: 50,
          maxSteerAngle: 0.55,
          steerSpeed: 4.2,
          wheelbase: 3.0,
          collisionRadius: 2.8,
        };
      case 'prop_plane':
        return {
          maxSpeed: 52,
          maxReverse: 3,
          acceleration: 18,
          brakeForce: 24,
          reverseAcceleration: 4,
          friction: 3.5,
          handbrakeForce: 35,
          maxSteerAngle: 0.42,
          steerSpeed: 2.8,
          wheelbase: 4.2,
          collisionRadius: 3.1,
        };
      case 'horse':
        return {
          maxSpeed: 28,
          maxReverse: 4,
          acceleration: 22,
          brakeForce: 36,
          reverseAcceleration: 6,
          friction: 10,
          handbrakeForce: 45,
          maxSteerAngle: 0.82,
          steerSpeed: 6.2,
          wheelbase: 1.7,
          collisionRadius: 1.8,
        };
      case 'car':
      default:
        return {
          maxSpeed: DRIVING.MAX_SPEED,
          maxReverse: DRIVING.MAX_REVERSE_SPEED,
          acceleration: DRIVING.ACCELERATION,
          brakeForce: DRIVING.BRAKE_FORCE,
          reverseAcceleration: DRIVING.REVERSE_ACCELERATION,
          friction: DRIVING.FRICTION,
          handbrakeForce: DRIVING.HANDBRAKE_FORCE,
          maxSteerAngle: DRIVING.MAX_STEER_ANGLE,
          steerSpeed: DRIVING.STEER_SPEED,
          wheelbase: DRIVING.WHEELBASE,
          collisionRadius: DRIVING.COLLISION_RADIUS,
        };
    }
  }

  private getSeatOffset(type: DrivableVehicleType): THREE.Vector3 {
    switch (type) {
      case 'motorcycle':
        return new THREE.Vector3(0, 1.65, 0.05);
      case 'helicopter':
        return new THREE.Vector3(0, 2.2, -0.2);
      case 'prop_plane':
        return new THREE.Vector3(0, 1.95, 0.2);
      case 'horse':
        return new THREE.Vector3(0, 2.05, 0.05);
      case 'car':
      default:
        return new THREE.Vector3(0, 1.5, -0.2);
    }
  }

  private createMesh(type: DrivableVehicleType): THREE.Group {
    switch (type) {
      case 'motorcycle':
        return this.createMotorcycleMesh();
      case 'helicopter':
        return this.createHelicopterMesh();
      case 'prop_plane':
        return this.createPropPlaneMesh();
      case 'horse':
        return this.createHorseMesh();
      case 'car':
      default:
        return this.createCarMesh();
    }
  }

  private createCarMesh(): THREE.Group {
    const group = new THREE.Group();

    const bodyColor = 0xff4444;
    const bodyMat = createToonMaterial(bodyColor);

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.8, 4.2),
      bodyMat,
    );
    body.position.y = 0.6;
    group.add(body);

    const doorMat = createToonMaterial(0xdd2222);
    for (const side of [-1, 1]) {
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.5, 2.4),
        doorMat,
      );
      door.position.set(side * 1.05, 1.15, -0.2);
      group.add(door);
    }

    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.6, 0.08),
      createToonMaterial(0x88ccff, { transparent: true, opacity: 0.4 }),
    );
    windshield.position.set(0, 1.3, -1.3);
    windshield.rotation.x = -0.3;
    group.add(windshield);

    const dash = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.2, 0.4),
      createToonMaterial(0x444444),
    );
    dash.position.set(0, 1.0, -1.1);
    group.add(dash);

    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.3, 0.6),
      createToonMaterial(0x8b6914),
    );
    seat.position.set(0, 0.95, -0.3);
    group.add(seat);

    const rear = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.5, 0.8),
      bodyMat,
    );
    rear.position.set(0, 0.85, 1.5);
    group.add(rear);

    const hood = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.3, 1.2),
      bodyMat,
    );
    hood.position.set(0, 0.85, -1.8);
    group.add(hood);

    const lightMat = createToonMaterial(0xffffcc);
    for (const side of [-0.7, 0.7]) {
      const light = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 6, 4),
        lightMat,
      );
      light.position.set(side, 0.7, -2.35);
      group.add(light);
    }

    const tailMat = createToonMaterial(0xff4400);
    for (const side of [-0.7, 0.7]) {
      const tl = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 4),
        tailMat,
      );
      tl.position.set(side, 0.7, 1.95);
      group.add(tl);
      this.taillights.push(tl);
    }

    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.25, 8);
    const wheelMat = createToonMaterial(0x444444);

    const wheelPositions: [number, number, boolean][] = [
      [-0.95, -1.3, true],
      [0.95, -1.3, true],
      [-0.95, 1.3, false],
      [0.95, 1.3, false],
    ];

    for (const [x, z, isFront] of wheelPositions) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.4, z);

      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      pivot.add(wheel);

      group.add(pivot);
      this.wheels.push(wheel);
      if (isFront) this.frontWheelPivots.push(pivot);
    }

    return group;
  }

  private createMotorcycleMesh(): THREE.Group {
    const group = new THREE.Group();
    const bodyMat = createToonMaterial(0x2266dd);
    const trimMat = createToonMaterial(0x111111);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 2.3), bodyMat);
    frame.position.set(0, 0.75, 0);
    group.add(frame);

    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.8), createToonMaterial(0x3388ff));
    tank.position.set(0, 1.05, -0.2);
    group.add(tank);

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.65), createToonMaterial(0x553311));
    seat.position.set(0, 1.08, 0.45);
    group.add(seat);

    const handleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8), trimMat);
    handleBar.rotation.z = Math.PI / 2;
    handleBar.position.set(0, 1.25, -0.95);
    group.add(handleBar);

    const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.2, 10);
    const wheelMat = createToonMaterial(0x222222);
    const wheelSpawns: [number, boolean][] = [[-0.95, true], [0.95, false]];
    for (const [z, isFront] of wheelSpawns) {
      const pivot = new THREE.Group();
      pivot.position.set(0, 0.45, z);
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      pivot.add(wheel);
      group.add(pivot);
      this.wheels.push(wheel);
      if (isFront) this.frontWheelPivots.push(pivot);
    }

    return group;
  }

  private createHelicopterMesh(): THREE.Group {
    const group = new THREE.Group();
    const bodyMat = createToonMaterial(0xffcc33);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 2.6), bodyMat);
    cabin.position.set(0, 1.8, 0);
    group.add(cabin);

    const cockpit = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.9, 1.0),
      createToonMaterial(0x99ddff, { transparent: true, opacity: 0.45 }),
    );
    cockpit.position.set(0, 1.95, -1.15);
    group.add(cockpit);

    const tailBoom = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 3.0), createToonMaterial(0x222222));
    tailBoom.position.set(0, 1.7, 2.6);
    group.add(tailBoom);

    const skidMat = createToonMaterial(0x1a1a1a);
    for (const side of [-0.85, 0.85]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 3.4), skidMat);
      skid.position.set(side, 0.75, 0.3);
      group.add(skid);
    }

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8), createToonMaterial(0x222222));
    mast.position.set(0, 2.45, 0.05);
    group.add(mast);

    this.rotorMain = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 6.8), createToonMaterial(0x444444));
    this.rotorMain.position.set(0, 2.68, 0.05);
    group.add(this.rotorMain);

    this.rotorTail = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 0.1), createToonMaterial(0x444444));
    this.rotorTail.position.set(0, 1.7, 4.15);
    group.add(this.rotorTail);

    return group;
  }

  private createPropPlaneMesh(): THREE.Group {
    const group = new THREE.Group();
    const fuselageMat = createToonMaterial(0xf2f2f2);

    const fuselage = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 5.2), fuselageMat);
    fuselage.position.set(0, 1.2, 0);
    group.add(fuselage);

    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.6, 1.2),
      createToonMaterial(0x88ccff, { transparent: true, opacity: 0.45 }),
    );
    canopy.position.set(0, 1.65, 0.35);
    group.add(canopy);

    const wing = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.12, 1.3), createToonMaterial(0xdd3333));
    wing.position.set(0, 1.2, 0.15);
    group.add(wing);

    const tailWing = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 0.7), createToonMaterial(0xdd3333));
    tailWing.position.set(0, 1.55, 2.2);
    group.add(tailWing);

    const verticalTail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, 0.8), createToonMaterial(0xdd3333));
    verticalTail.position.set(0, 2.0, 2.4);
    group.add(verticalTail);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.6), createToonMaterial(0x222222));
    nose.position.set(0, 1.2, -2.9);
    group.add(nose);

    this.propeller = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 0.12), createToonMaterial(0x444444));
    this.propeller.position.set(0, 1.2, -3.25);
    group.add(this.propeller);

    const wheelGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.16, 8);
    const wheelMat = createToonMaterial(0x222222);
    const leftWheel = new THREE.Mesh(wheelGeo, wheelMat);
    leftWheel.rotation.z = Math.PI / 2;
    leftWheel.position.set(-0.65, 0.35, 0.1);
    group.add(leftWheel);
    this.wheels.push(leftWheel);

    const rightWheel = new THREE.Mesh(wheelGeo, wheelMat);
    rightWheel.rotation.z = Math.PI / 2;
    rightWheel.position.set(0.65, 0.35, 0.1);
    group.add(rightWheel);
    this.wheels.push(rightWheel);

    const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 8), wheelMat);
    tailWheel.rotation.z = Math.PI / 2;
    tailWheel.position.set(0, 0.42, 2.5);
    group.add(tailWheel);
    this.wheels.push(tailWheel);

    return group;
  }

  private createHorseMesh(): THREE.Group {
    const group = new THREE.Group();
    const coat = createToonMaterial(0x8b5a2b);
    const dark = createToonMaterial(0x3d2a1a);

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 2.3), coat);
    body.position.set(0, 1.2, 0);
    group.add(body);

    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.65), coat);
    neck.position.set(0, 1.55, -1.05);
    neck.rotation.x = -0.3;
    group.add(neck);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.95), coat);
    head.position.set(0, 1.75, -1.58);
    group.add(head);

    const mane = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 1.05), dark);
    mane.position.set(0, 1.9, -1.1);
    group.add(mane);

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), dark);
    tail.position.set(0, 1.5, 1.25);
    tail.rotation.x = 0.45;
    group.add(tail);

    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.2, 0.7), createToonMaterial(0x552200));
    saddle.position.set(0, 1.75, 0.15);
    group.add(saddle);

    const legGeo = new THREE.BoxGeometry(0.26, 1.05, 0.26);
    const legPositions: [number, number][] = [
      [-0.35, -0.75],
      [0.35, -0.75],
      [-0.35, 0.75],
      [0.35, 0.75],
    ];
    for (const [x, z] of legPositions) {
      const leg = new THREE.Mesh(legGeo, coat);
      leg.position.set(x, 0.55, z);
      group.add(leg);
      this.horseLegs.push(leg);
    }

    return group;
  }

  update(dt: number, input: InputManager): void {
    if (!this.occupied) return;

    switch (this.type) {
      case 'helicopter':
        this.updateHelicopter(dt, input);
        break;
      case 'prop_plane':
        this.updatePropPlane(dt, input);
        break;
      case 'horse':
      case 'motorcycle':
      case 'car':
      default:
        this.updateGroundVehicle(dt, input);
        break;
    }

    this.animateVehicle(dt, input);

    this.applySoftBoundary(dt);
    this.mesh.position.copy(this.position);
    this.mesh.position.y += this.horseRideBob;
    this.mesh.rotation.y = this.heading;
  }

  private updateGroundVehicle(dt: number, input: InputManager): void {
    const steerInput = input.getAxis('horizontal');
    const throttleInput = input.getAxis('vertical');
    const handbrakeInput = input.isAscending();

    if (throttleInput > 0) {
      this.speed += this.handling.acceleration * dt;
    } else if (throttleInput < 0) {
      if (this.speed > 0.5) {
        this.speed -= this.handling.brakeForce * dt;
      } else {
        this.speed -= this.handling.reverseAcceleration * dt;
      }
    } else {
      this.speed = moveToward(this.speed, 0, this.handling.friction * dt);
    }

    if (handbrakeInput) {
      this.speed = moveToward(this.speed, 0, this.handling.handbrakeForce * dt);
    }

    this.speed = clamp(this.speed, -this.handling.maxReverse, this.handling.maxSpeed);

    const speedFactor = remap(Math.abs(this.speed), 0, this.handling.maxSpeed, 1.0, 0.45);
    const targetSteer = -steerInput * this.handling.maxSteerAngle * speedFactor;
    this.steerAngle = moveToward(this.steerAngle, targetSteer, this.handling.steerSpeed * dt);

    if (Math.abs(steerInput) < 0.01) {
      this.steerAngle = moveToward(this.steerAngle, 0, this.handling.steerSpeed * 2 * dt);
    }

    if (Math.abs(this.steerAngle) > 0.001 && Math.abs(this.speed) > 0.1) {
      const turnRadius = this.handling.wheelbase / Math.tan(this.steerAngle);
      const angularVelocity = this.speed / turnRadius;
      this.heading += angularVelocity * dt;
    }

    const forward = new THREE.Vector3(
      -Math.sin(this.heading),
      0,
      -Math.cos(this.heading),
    );
    const displacement = forward.multiplyScalar(this.speed * dt);

    this.moveWithCollision(displacement);

    this.position.y = 0.01;
    this.verticalSpeed = 0;
  }

  private updateHelicopter(dt: number, input: InputManager): void {
    const steerInput = input.getAxis('horizontal');
    const throttleInput = input.getAxis('vertical');
    const ascending = input.isAscending();
    const descending = input.isFastDescending() || input.isGentleDescending() || throttleInput < -0.2;

    const yawRate = 1.8;
    this.heading += -steerInput * yawRate * dt;

    const targetSpeed = throttleInput >= 0
      ? throttleInput * this.handling.maxSpeed
      : throttleInput * this.handling.maxReverse;
    const accel = Math.abs(targetSpeed) > Math.abs(this.speed) ? this.handling.acceleration : this.handling.brakeForce;
    this.speed = moveToward(this.speed, targetSpeed, accel * dt);

    if (ascending) {
      this.verticalSpeed = moveToward(this.verticalSpeed, 14, 40 * dt);
    } else if (descending) {
      this.verticalSpeed = moveToward(this.verticalSpeed, -12, 40 * dt);
    } else {
      this.verticalSpeed = moveToward(this.verticalSpeed, 0, 20 * dt);
    }

    this.position.y = clamp(this.position.y + this.verticalSpeed * dt, 0.8, 75);

    const forward = new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    const displacement = forward.multiplyScalar(this.speed * dt);
    this.moveWithCollision(displacement);
  }

  private updatePropPlane(dt: number, input: InputManager): void {
    const steerInput = input.getAxis('horizontal');
    const throttleInput = input.getAxis('vertical');
    const ascending = input.isAscending();
    const descending = input.isFastDescending() || input.isGentleDescending();

    if (throttleInput > 0) {
      this.speed += this.handling.acceleration * dt;
    } else if (throttleInput < 0) {
      if (this.speed > 1.5) this.speed -= this.handling.brakeForce * dt;
      else this.speed -= this.handling.reverseAcceleration * dt;
    } else {
      this.speed = moveToward(this.speed, 0, this.handling.friction * dt);
    }

    this.speed = clamp(this.speed, -this.handling.maxReverse, this.handling.maxSpeed);

    const airborne = this.position.y > 0.2;
    const turnScale = airborne ? remap(Math.abs(this.speed), 0, this.handling.maxSpeed, 0.25, 1.0) : 1.0;
    const steerTarget = -steerInput * this.handling.maxSteerAngle * turnScale;
    this.steerAngle = moveToward(this.steerAngle, steerTarget, this.handling.steerSpeed * dt);

    if (Math.abs(this.steerAngle) > 0.001 && Math.abs(this.speed) > 0.2) {
      const turnRadius = this.handling.wheelbase / Math.tan(this.steerAngle);
      const angularVelocity = this.speed / turnRadius;
      this.heading += angularVelocity * dt;
    }

    const takeoffSpeed = 28;
    if (ascending && this.speed > takeoffSpeed) {
      this.verticalSpeed += 22 * dt;
    }
    if (descending) {
      this.verticalSpeed -= 20 * dt;
    }

    if (this.position.y > 0.05 || this.verticalSpeed > 0) {
      const liftFactor = clamp((this.speed - 20) / (this.handling.maxSpeed - 20), 0, 1);
      this.verticalSpeed += liftFactor * 8 * dt;
      this.verticalSpeed -= (6.5 - liftFactor * 2.5) * dt;
    } else {
      this.verticalSpeed = 0;
      this.position.y = 0.01;
    }

    this.verticalSpeed = clamp(this.verticalSpeed, -20, 16);
    this.position.y = clamp(this.position.y + this.verticalSpeed * dt, 0.01, 85);

    const forward = new THREE.Vector3(
      -Math.sin(this.heading),
      0,
      -Math.cos(this.heading),
    );
    const displacement = forward.multiplyScalar(this.speed * dt);
    this.moveWithCollision(displacement);

    if (this.position.y <= 0.01 && this.verticalSpeed < 0) {
      this.verticalSpeed = 0;
      this.position.y = 0.01;
    }
  }

  private animateVehicle(dt: number, input: InputManager): void {
    const wheelRadius = 0.4;
    const wheelSpin = (this.speed / wheelRadius) * dt;
    for (const w of this.wheels) {
      w.rotation.x += wheelSpin;
    }
    for (const pivot of this.frontWheelPivots) {
      pivot.rotation.y = this.steerAngle * 0.5;
    }

    if (this.rotorMain) {
      this.rotorMain.rotation.y += (this.occupied ? 34 : 12) * dt;
    }
    if (this.rotorTail) {
      this.rotorTail.rotation.z += (this.occupied ? 40 : 16) * dt;
    }
    if (this.propeller) {
      const spinSpeed = 25 + Math.abs(this.speed) * 1.2;
      this.propeller.rotation.z += spinSpeed * dt;
    }

    if (this.type === 'horse' && this.horseLegs.length === 4) {
      this.horseGaitTime += dt * (3 + Math.abs(this.speed) * 0.25);
      const swing = Math.sin(this.horseGaitTime) * 0.55;
      this.horseLegs[0].rotation.x = swing;
      this.horseLegs[3].rotation.x = swing;
      this.horseLegs[1].rotation.x = -swing;
      this.horseLegs[2].rotation.x = -swing;
      this.horseRideBob = Math.abs(swing) * 0.08;
    } else {
      this.horseRideBob = 0;
    }

    if (this.type === 'car') {
      const throttleInput = input.getAxis('vertical');
      const handbrakeInput = input.isAscending();
      const braking = throttleInput < 0 && this.speed > 0.5 || handbrakeInput;
      for (const tl of this.taillights) {
        const mat = tl.material as THREE.MeshToonMaterial;
        mat.color.setHex(braking ? 0xff0000 : 0xff4400);
      }
    }
  }

  getSeatWorldPos(): THREE.Vector3 {
    const seat = this.seatOffset.clone();
    seat.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
    return this.position.clone().add(seat);
  }

  getQuaternion(): THREE.Quaternion {
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.heading, 0));
  }

  getCollisionRadius(): number {
    return this.handling.collisionRadius;
  }

  getImpactSpeed(): number {
    // Vertical speed contributes for aircraft impacts (e.g., descending helicopter).
    return Math.abs(this.speed) + Math.abs(this.verticalSpeed) * 0.5;
  }

  distanceTo(pos: THREE.Vector3): number {
    const dx = pos.x - this.position.x;
    const dz = pos.z - this.position.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  private moveWithCollision(displacement: THREE.Vector3): void {
    if (!this.shouldCollideWithBuildings()) {
      this.position.add(displacement);
      return;
    }

    const SUBSTEP_SIZE = 1.5;
    const totalDist = displacement.length();
    if (totalDist < 0.0001) return;

    const numSteps = Math.max(1, Math.ceil(totalDist / SUBSTEP_SIZE));
    const stepDisplacement = displacement.clone().divideScalar(numSteps);

    for (let i = 0; i < numSteps; i++) {
      const newPosition = this.position.clone().add(stepDisplacement);
      const collision = this.checkBuildingCollision(newPosition);

      if (collision.hit) {
        const slide = this.calculateSlideMovement(stepDisplacement, collision.normal);
        const slidePos = this.position.clone().add(slide);
        const slideCheck = this.checkBuildingCollision(slidePos);

        if (!slideCheck.hit) {
          this.position.copy(slidePos);
        } else {
          this.speed *= 0.3;
          break;
        }
      } else {
        this.position.add(stepDisplacement);
      }
    }

    this.depenetrate();
  }

  private shouldCollideWithBuildings(): boolean {
    switch (this.type) {
      case 'helicopter':
        return this.position.y < 10;
      case 'prop_plane':
        return this.position.y < 4;
      default:
        return true;
    }
  }

  private checkBuildingCollision(newPos: THREE.Vector3): { hit: boolean; normal: THREE.Vector3 } {
    const carRadius = this.handling.collisionRadius;

    for (const b of this.buildings) {
      if (b.height < 0.5) continue;
      const halfW = b.width / 2;
      const halfD = b.depth / 2;

      const closestX = clamp(newPos.x, b.position.x - halfW, b.position.x + halfW);
      const closestZ = clamp(newPos.z, b.position.z - halfD, b.position.z + halfD);

      const dx = newPos.x - closestX;
      const dz = newPos.z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < carRadius * carRadius) {
        const normal = new THREE.Vector3(dx, 0, dz);
        if (normal.lengthSq() > 0.0001) normal.normalize();
        else normal.set(1, 0, 0);
        return { hit: true, normal };
      }
    }

    return { hit: false, normal: new THREE.Vector3() };
  }

  private calculateSlideMovement(displacement: THREE.Vector3, normal: THREE.Vector3): THREE.Vector3 {
    const dot = displacement.dot(normal);
    if (dot < 0) {
      const slide = displacement.clone();
      slide.addScaledVector(normal, -dot);
      return slide.multiplyScalar(0.6);
    }
    return displacement;
  }

  private depenetrate(): void {
    if (!this.shouldCollideWithBuildings()) return;

    const carRadius = this.handling.collisionRadius;
    const px = this.position.x;
    const pz = this.position.z;

    for (const b of this.buildings) {
      if (b.height < 0.5) continue;
      const halfW = b.width / 2;
      const halfD = b.depth / 2;

      const closestX = clamp(px, b.position.x - halfW, b.position.x + halfW);
      const closestZ = clamp(pz, b.position.z - halfD, b.position.z + halfD);

      const dx = px - closestX;
      const dz = pz - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < carRadius * carRadius) {
        if (distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const pushDist = carRadius - dist + 0.1;
          this.position.x += (dx / dist) * pushDist;
          this.position.z += (dz / dist) * pushDist;
        } else {
          const distToLeft = Math.abs(px - (b.position.x - halfW));
          const distToRight = Math.abs(px - (b.position.x + halfW));
          const distToFront = Math.abs(pz - (b.position.z - halfD));
          const distToBack = Math.abs(pz - (b.position.z + halfD));
          const minDist = Math.min(distToLeft, distToRight, distToFront, distToBack);

          if (minDist === distToLeft) this.position.x = b.position.x - halfW - carRadius - 0.1;
          else if (minDist === distToRight) this.position.x = b.position.x + halfW + carRadius + 0.1;
          else if (minDist === distToFront) this.position.z = b.position.z - halfD - carRadius - 0.1;
          else this.position.z = b.position.z + halfD + carRadius + 0.1;
        }

        this.speed *= 0.3;
        return;
      }
    }
  }

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
    this.position.x = clamp(this.position.x, -hard, hard);
    this.position.z = clamp(this.position.z, -hard, hard);
  }
}
