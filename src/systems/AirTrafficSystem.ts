import * as THREE from 'three';
import { AIR_TRAFFIC, DRONES } from '../utils/Constants';
import { createToonMaterial } from '../rendering/ToonUtils';
import type { Poop } from '../entities/Poop';

// Reusable scratch vectors — allocated once, reused every frame
const _dir = new THREE.Vector3();

interface Helicopter {
  mesh: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  targetPosition: THREE.Vector3;
  rotorBlade: THREE.Mesh;
}

interface Blimp {
  mesh: THREE.Group;
  position: THREE.Vector3;
  angle: number;
  radius: number;
  speed: number;
}

interface Plane {
  mesh: THREE.Group;
  propeller: THREE.Mesh;
  angle: number;        // Current angle on flight loop
  radius: number;       // Loop radius
  altitude: number;
  speed: number;        // Angular speed
  centerX: number;
  centerZ: number;
  bankPhase: number;    // For gentle banking in turns
}

interface Drone {
  mesh: THREE.Group;
  propellers: THREE.Mesh[];
  position: THREE.Vector3;
  target: THREE.Vector3;
  speed: number;
  alive: boolean;
  respawnTimer: number;
}

export interface DroneHitResult {
  coins: number;
  heat: number;
  position: THREE.Vector3;
}

/**
 * Air Traffic System
 * Manages helicopters, blimps, planes, hot air balloons, and drones
 */
export class AirTrafficSystem {
  private helicopters: Helicopter[] = [];
  private blimps: Blimp[] = [];
  private planes: Plane[] = [];
  private drones: Drone[] = [];
  readonly group = new THREE.Group();

  constructor(cityBounds: { minX: number; maxX: number; minZ: number; maxZ: number }) {
    this.createHelicopters(cityBounds);
    this.createBlimps();
    this.createPlanes(cityBounds);
    // Hot air balloons removed for performance
    this.createDrones(cityBounds);
  }

  private createHelicopters(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }): void {
    for (let i = 0; i < AIR_TRAFFIC.HELICOPTER_COUNT; i++) {
      const heli = new THREE.Group();

      const body = new THREE.Mesh(
        new THREE.BoxGeometry(3, 1.5, 6),
        createToonMaterial(0x333333)
      );
      heli.add(body);

      const cockpit = new THREE.Mesh(
        new THREE.SphereGeometry(1.2, 8, 8),
        createToonMaterial(0x88ccff, { transparent: true, opacity: 0.6 })
      );
      cockpit.position.set(0, 0.5, 2);
      cockpit.scale.set(1, 0.8, 1.2);
      heli.add(cockpit);

      const rotorBlade = new THREE.Mesh(
        new THREE.BoxGeometry(8, 0.1, 0.4),
        createToonMaterial(0x222222)
      );
      rotorBlade.position.set(0, 2, 0);
      heli.add(rotorBlade);

      const tail = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.8, 4),
        createToonMaterial(0x333333)
      );
      tail.position.set(0, 0.5, -4);
      heli.add(tail);

      const tailRotor = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 2, 0.3),
        createToonMaterial(0x222222)
      );
      tailRotor.position.set(0.7, 0.5, -5.5);
      heli.add(tailRotor);

      const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
      const z = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);
      const y = AIR_TRAFFIC.HELICOPTER_ALTITUDE_RANGE[0] +
                Math.random() * (AIR_TRAFFIC.HELICOPTER_ALTITUDE_RANGE[1] - AIR_TRAFFIC.HELICOPTER_ALTITUDE_RANGE[0]);

      heli.position.set(x, y, z);
      this.group.add(heli);

      this.helicopters.push({
        mesh: heli,
        position: heli.position.clone(),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          0,
          (Math.random() - 0.5) * 2
        ).normalize().multiplyScalar(AIR_TRAFFIC.HELICOPTER_SPEED),
        targetPosition: new THREE.Vector3(x, y, z),
        rotorBlade,
      });
    }
  }

  private createBlimps(): void {
    for (let i = 0; i < AIR_TRAFFIC.BLIMP_COUNT; i++) {
      const blimp = new THREE.Group();

      const envelope = new THREE.Mesh(
        new THREE.SphereGeometry(6, 16, 12),
        createToonMaterial(i === 0 ? 0xff6633 : 0x3366ff)
      );
      envelope.scale.set(2, 1, 1);
      blimp.add(envelope);

      const gondola = new THREE.Mesh(
        new THREE.BoxGeometry(2, 1, 4),
        createToonMaterial(0x333333)
      );
      gondola.position.set(0, -4, 0);
      blimp.add(gondola);

      const finGeo = new THREE.ConeGeometry(1.5, 3, 3);
      const finMat = createToonMaterial(0x444444);

      const topFin = new THREE.Mesh(finGeo, finMat);
      topFin.position.set(0, 2, -9);
      topFin.rotation.x = Math.PI / 2;
      blimp.add(topFin);

      const angle = (i / Math.max(AIR_TRAFFIC.BLIMP_COUNT, 1)) * Math.PI * 2;
      const radius = 400;

      this.group.add(blimp);

      this.blimps.push({
        mesh: blimp,
        position: blimp.position.clone(),
        angle,
        radius,
        speed: AIR_TRAFFIC.BLIMP_SPEED / radius,
      });
    }
  }

  private createPlanes(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }): void {
    const planeColors = [0xcc2222, 0x2255cc, 0xeecc00];

    for (let i = 0; i < AIR_TRAFFIC.PLANE_COUNT; i++) {
      const plane = new THREE.Group();
      const color = planeColors[i % planeColors.length];

      // Fuselage
      const fuselage = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.3, 6, 6),
        createToonMaterial(color)
      );
      fuselage.rotation.x = Math.PI / 2;
      plane.add(fuselage);

      // Wings
      const wingMat = createToonMaterial(color);
      const mainWing = new THREE.Mesh(
        new THREE.BoxGeometry(10, 0.15, 1.8),
        wingMat
      );
      mainWing.position.set(0, 0.1, 0.3);
      plane.add(mainWing);

      // Tail wing (horizontal stabilizer)
      const tailWing = new THREE.Mesh(
        new THREE.BoxGeometry(4, 0.1, 1),
        wingMat
      );
      tailWing.position.set(0, 0.2, -2.5);
      plane.add(tailWing);

      // Vertical stabilizer
      const vertStab = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 1.5, 1.2),
        wingMat
      );
      vertStab.position.set(0, 0.8, -2.5);
      plane.add(vertStab);

      // Propeller
      const propeller = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 0.12, 0.25),
        createToonMaterial(0x222222)
      );
      propeller.position.set(0, 0, 3.2);
      plane.add(propeller);

      // Nose cone
      const nose = new THREE.Mesh(
        new THREE.ConeGeometry(0.4, 0.8, 6),
        createToonMaterial(0xcccccc)
      );
      nose.rotation.x = -Math.PI / 2;
      nose.position.set(0, 0, 3.5);
      plane.add(nose);

      // Each plane gets a unique circular flight path
      const loopRadius = AIR_TRAFFIC.PLANE_LOOP_RADIUS * (0.6 + Math.random() * 0.8);
      const centerX = (Math.random() - 0.5) * 200;
      const centerZ = (Math.random() - 0.5) * 200;
      const altitude = AIR_TRAFFIC.PLANE_ALTITUDE_RANGE[0] +
        Math.random() * (AIR_TRAFFIC.PLANE_ALTITUDE_RANGE[1] - AIR_TRAFFIC.PLANE_ALTITUDE_RANGE[0]);
      const startAngle = (i / AIR_TRAFFIC.PLANE_COUNT) * Math.PI * 2;

      const x = centerX + Math.cos(startAngle) * loopRadius;
      const z = centerZ + Math.sin(startAngle) * loopRadius;
      plane.position.set(x, altitude, z);

      this.group.add(plane);

      this.planes.push({
        mesh: plane,
        propeller,
        angle: startAngle,
        radius: loopRadius,
        altitude,
        speed: AIR_TRAFFIC.PLANE_SPEED / loopRadius,
        centerX,
        centerZ,
        bankPhase: 0,
      });
    }
  }

  private createDrones(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }): void {
    for (let i = 0; i < DRONES.COUNT; i++) {
      const drone = new THREE.Group();
      const propellers: THREE.Mesh[] = [];

      // Central body (package)
      const packageBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.4, 0.8),
        createToonMaterial(0x996633),
      );
      packageBox.position.y = -0.3;
      drone.add(packageBox);

      // Drone frame (X shape)
      const armMat = createToonMaterial(0x333333);
      for (let a = 0; a < 4; a++) {
        const angle = (a / 4) * Math.PI * 2 + Math.PI / 4;
        const armLen = 0.8;

        const arm = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.08, armLen),
          armMat,
        );
        arm.position.set(
          Math.cos(angle) * armLen * 0.5,
          0,
          Math.sin(angle) * armLen * 0.5,
        );
        arm.rotation.y = -angle;
        drone.add(arm);

        // Propeller disc at end of arm
        const prop = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.35, 0.03, 8),
          createToonMaterial(0x666666, { transparent: true, opacity: 0.6 }),
        );
        prop.position.set(
          Math.cos(angle) * armLen,
          0.1,
          Math.sin(angle) * armLen,
        );
        drone.add(prop);
        propellers.push(prop);
      }

      // LED light (small glowing sphere)
      const led = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
      );
      led.position.y = 0.15;
      drone.add(led);

      const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
      const z = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);
      const y = DRONES.ALTITUDE_RANGE[0] + Math.random() * (DRONES.ALTITUDE_RANGE[1] - DRONES.ALTITUDE_RANGE[0]);

      drone.position.set(x, y, z);
      this.group.add(drone);

      this.drones.push({
        mesh: drone,
        propellers,
        position: new THREE.Vector3(x, y, z),
        target: new THREE.Vector3(
          (Math.random() - 0.5) * 800,
          DRONES.ALTITUDE_RANGE[0] + Math.random() * (DRONES.ALTITUDE_RANGE[1] - DRONES.ALTITUDE_RANGE[0]),
          (Math.random() - 0.5) * 800,
        ),
        speed: DRONES.SPEED * (0.8 + Math.random() * 0.4),
        alive: true,
        respawnTimer: 0,
      });
    }
  }

  update(dt: number, _playerPos: THREE.Vector3, _isPlayerWanted?: boolean): void {
    this.updateHelicopters(dt);
    this.updateBlimps(dt);
    this.updatePlanes(dt);
    this.updateDrones(dt);
  }

  private updateHelicopters(dt: number): void {
    for (const heli of this.helicopters) {
      heli.rotorBlade.rotation.y += dt * 30;

      _dir.subVectors(heli.targetPosition, heli.mesh.position);
      const distance = _dir.length();

      if (distance > 5) {
        _dir.normalize().multiplyScalar(AIR_TRAFFIC.HELICOPTER_SPEED);
        heli.velocity.lerp(_dir, dt);
      } else {
        heli.targetPosition.set(
          (Math.random() - 0.5) * 1400,
          AIR_TRAFFIC.HELICOPTER_ALTITUDE_RANGE[0] + Math.random() *
            (AIR_TRAFFIC.HELICOPTER_ALTITUDE_RANGE[1] - AIR_TRAFFIC.HELICOPTER_ALTITUDE_RANGE[0]),
          (Math.random() - 0.5) * 1400
        );
      }

      heli.mesh.position.addScaledVector(heli.velocity, dt);

      if (heli.velocity.length() > 0.1) {
        const angle = Math.atan2(heli.velocity.x, heli.velocity.z);
        heli.mesh.rotation.y = angle;
        heli.mesh.rotation.z = Math.sin(angle - heli.mesh.rotation.y) * 0.1;
      }
    }
  }

  private updateBlimps(dt: number): void {
    for (const blimp of this.blimps) {
      blimp.angle += blimp.speed * dt;

      const x = Math.cos(blimp.angle) * blimp.radius;
      const z = Math.sin(blimp.angle) * blimp.radius;

      blimp.mesh.position.set(x, AIR_TRAFFIC.BLIMP_ALTITUDE, z);
      blimp.mesh.rotation.y = blimp.angle + Math.PI / 2;
    }
  }

  private updatePlanes(dt: number): void {
    for (const plane of this.planes) {
      // Spin propeller
      plane.propeller.rotation.z += dt * 40;

      // Advance along circular path
      plane.angle += plane.speed * dt;

      const x = plane.centerX + Math.cos(plane.angle) * plane.radius;
      const z = plane.centerZ + Math.sin(plane.angle) * plane.radius;

      // Gentle altitude variation (slight sine wave)
      const altVariation = Math.sin(plane.angle * 2) * 5;

      plane.mesh.position.set(x, plane.altitude + altVariation, z);

      // Face tangent of circle (direction of travel)
      plane.mesh.rotation.y = plane.angle + Math.PI / 2;

      // Bank into the turn
      plane.bankPhase += dt;
      plane.mesh.rotation.z = -0.15; // Constant gentle bank for circular path
      // Slight pitch variation
      plane.mesh.rotation.x = Math.sin(plane.angle * 2) * 0.05;
    }
  }

  private updateDrones(dt: number): void {
    for (const drone of this.drones) {
      if (!drone.alive) {
        drone.respawnTimer -= dt;
        if (drone.respawnTimer <= 0) {
          drone.alive = true;
          drone.mesh.visible = true;
          // Reset to new random position
          drone.position.set(
            (Math.random() - 0.5) * 800,
            DRONES.ALTITUDE_RANGE[0] + Math.random() * (DRONES.ALTITUDE_RANGE[1] - DRONES.ALTITUDE_RANGE[0]),
            (Math.random() - 0.5) * 800,
          );
          drone.mesh.position.copy(drone.position);
        }
        continue;
      }

      // Spin propellers
      for (const prop of drone.propellers) {
        prop.rotation.y += dt * 30;
      }

      // Fly toward target
      _dir.subVectors(drone.target, drone.position);
      const dist = _dir.length();

      if (dist < 10) {
        // Pick new target
        drone.target.set(
          (Math.random() - 0.5) * 800,
          DRONES.ALTITUDE_RANGE[0] + Math.random() * (DRONES.ALTITUDE_RANGE[1] - DRONES.ALTITUDE_RANGE[0]),
          (Math.random() - 0.5) * 800,
        );
      }

      _dir.normalize();
      drone.position.addScaledVector(_dir, drone.speed * dt);
      drone.mesh.position.copy(drone.position);

      // Face direction of travel
      drone.mesh.rotation.y = Math.atan2(_dir.x, _dir.z);
      // Slight tilt forward
      drone.mesh.rotation.x = 0.1;
    }
  }

  checkDroneHits(activePoops: Poop[], onHit: (result: DroneHitResult) => void): void {
    const hitRadiusSq = DRONES.HIT_RADIUS * DRONES.HIT_RADIUS;

    for (const poop of activePoops) {
      if (!poop.alive) continue;
      const poopPos = poop.mesh.position;

      for (const drone of this.drones) {
        if (!drone.alive) continue;

        const distSq = poopPos.distanceToSquared(drone.position);
        if (distSq < hitRadiusSq) {
          drone.alive = false;
          drone.respawnTimer = DRONES.RESPAWN_TIME;
          drone.mesh.visible = false;
          poop.kill();

          onHit({
            coins: DRONES.COINS,
            heat: DRONES.HEAT,
            position: drone.position.clone(),
          });
          break;
        }
      }
    }
  }

  getHelicopters(): Helicopter[] {
    return this.helicopters;
  }
}
