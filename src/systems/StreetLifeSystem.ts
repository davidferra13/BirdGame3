import * as THREE from 'three';
import { STREET_LIFE } from '../utils/Constants';
import { createToonMaterial } from '../rendering/ToonUtils';
import { AnimalModelManager } from './AnimalModelManager';
import type { Poop } from '../entities/Poop';

// Reusable scratch vector — allocated once, reused every frame
const _dir = new THREE.Vector3();

// ---- Street Animals ----

export type AnimalType = 'cat' | 'dog' | 'rat';

export interface StreetAnimal {
  mesh: THREE.Group;
  type: AnimalType;
  breed?: string;
  position: THREE.Vector3;
  walkTarget: THREE.Vector3;
  speed: number;
  state: 'walking' | 'idle' | 'fleeing' | 'hit';
  stateTimer: number;
  tailPhase: number;
  hitCooldown: number;
  isGrabbed: boolean;
  mixer?: THREE.AnimationMixer;
  modelLoaded: boolean;
}

// ---- Food Carts ----

interface FoodCart {
  mesh: THREE.Group;
  position: THREE.Vector3;
  hitCooldown: number;
  flashTimer: number;
}

export interface StreetLifeHitResult {
  coins: number;
  heat: number;
  position: THREE.Vector3;
}

/**
 * Street Life System
 * Manages stray cats/dogs, rats (easter egg), and food carts
 */
export class StreetLifeSystem {
  private animals: StreetAnimal[] = [];
  private foodCarts: FoodCart[] = [];
  readonly group = new THREE.Group();

  constructor(
    cityBounds: { minX: number; maxX: number; minZ: number; maxZ: number },
    streetPaths: THREE.Vector3[][],
  ) {
    this.createAnimals(cityBounds);
    this.createFoodCarts(streetPaths);
  }

  // ===================== ANIMALS =====================

  private createProceduralAnimalMesh(type: AnimalType): THREE.Group {
    const group = new THREE.Group();

    if (type === 'cat') {
      // Body
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.3, 0.8),
        createToonMaterial(
          [0xFFB347, 0x555555, 0xFFFFFF, 0xCD853F][Math.floor(Math.random() * 4)],
        ),
      );
      body.position.y = 0.35;
      group.add(body);

      // Head
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 5, 4),
        (body.material as THREE.MeshToonMaterial).clone(),
      );
      head.position.set(0, 0.5, 0.35);
      group.add(head);

      // Ears (triangles)
      const earGeo = new THREE.ConeGeometry(0.06, 0.12, 3);
      const earMat = (body.material as THREE.MeshToonMaterial).clone();
      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(earGeo, earMat);
        ear.position.set(side * 0.1, 0.65, 0.35);
        group.add(ear);
      }

      // Tail
      const tail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.02, 0.5, 4),
        earMat,
      );
      tail.position.set(0, 0.5, -0.5);
      tail.rotation.x = -0.5;
      tail.name = 'tail';
      group.add(tail);
    } else if (type === 'dog') {
      // Dog body
      const color = [0xFFD700, 0xCD853F, 0xF5DEB3, 0x555555][Math.floor(Math.random() * 4)];
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.4, 0.9),
        createToonMaterial(color),
      );
      body.position.y = 0.45;
      group.add(body);

      // Head
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.3, 0.35),
        createToonMaterial(color),
      );
      head.position.set(0, 0.55, 0.5);
      group.add(head);

      // Snout
      const snout = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.15, 0.15),
        createToonMaterial(0x666666),
      );
      snout.position.set(0, 0.5, 0.7);
      group.add(snout);

      // Floppy ears
      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.15, 0.12),
          createToonMaterial(color),
        );
        ear.position.set(side * 0.2, 0.6, 0.45);
        group.add(ear);
      }

      // Tail
      const tail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.03, 0.4, 4),
        createToonMaterial(color),
      );
      tail.position.set(0, 0.65, -0.5);
      tail.rotation.x = -0.8;
      tail.name = 'tail';
      group.add(tail);
    } else {
      // Rat — small gray body, long tail, round ears
      const gray = createToonMaterial(0x777777);

      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.1, 0.3),
        gray,
      );
      body.position.y = 0.08;
      group.add(body);

      // Head
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 4, 3),
        gray,
      );
      head.position.set(0, 0.1, 0.18);
      group.add(head);

      // Round ears
      const earGeo = new THREE.SphereGeometry(0.03, 4, 3);
      const earMat = createToonMaterial(0xCC9999);
      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(earGeo, earMat);
        ear.position.set(side * 0.05, 0.15, 0.18);
        group.add(ear);
      }

      // Long thin tail
      const tail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.008, 0.25, 4),
        earMat,
      );
      tail.position.set(0, 0.06, -0.25);
      tail.rotation.x = -0.3;
      tail.name = 'tail';
      group.add(tail);
    }

    return group;
  }

  private createAnimals(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }): void {
    const modelManager = AnimalModelManager.getInstance();

    // Cats
    for (let i = 0; i < STREET_LIFE.CAT_COUNT; i++) {
      const mesh = this.createProceduralAnimalMesh('cat');
      const pos = new THREE.Vector3(
        bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
        0,
        bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ),
      );
      mesh.position.copy(pos);
      this.group.add(mesh);

      const animal: StreetAnimal = {
        mesh, type: 'cat',
        position: pos.clone(),
        walkTarget: this.randomWalkTarget(pos, 10),
        speed: STREET_LIFE.CAT_SPEED,
        state: 'idle',
        stateTimer: 2 + Math.random() * 3,
        tailPhase: Math.random() * Math.PI * 2,
        hitCooldown: 0,
        isGrabbed: false,
        modelLoaded: false,
      };
      this.animals.push(animal);

      // Async model swap
      modelManager.getModel('animal.cat.bengal').then(glb => {
        if (glb && !animal.modelLoaded) this.swapAnimalMesh(animal, glb);
      });
    }

    // Dogs — random breed per dog
    for (let i = 0; i < STREET_LIFE.DOG_COUNT; i++) {
      const mesh = this.createProceduralAnimalMesh('dog');
      const pos = new THREE.Vector3(
        bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
        0,
        bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ),
      );
      mesh.position.copy(pos);
      this.group.add(mesh);

      const breed = modelManager.getRandomDogBreed();
      const animal: StreetAnimal = {
        mesh, type: 'dog',
        breed,
        position: pos.clone(),
        walkTarget: this.randomWalkTarget(pos, 15),
        speed: STREET_LIFE.DOG_SPEED,
        state: 'walking',
        stateTimer: 3 + Math.random() * 5,
        tailPhase: Math.random() * Math.PI * 2,
        hitCooldown: 0,
        isGrabbed: false,
        modelLoaded: false,
      };
      this.animals.push(animal);

      // Async model swap
      modelManager.getModel(breed).then(glb => {
        if (glb && !animal.modelLoaded) this.swapAnimalMesh(animal, glb);
      });
    }

    // Rats — rare easter egg spawns between buildings
    for (let i = 0; i < STREET_LIFE.RAT_COUNT; i++) {
      const mesh = this.createProceduralAnimalMesh('rat');
      const pos = new THREE.Vector3(
        bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
        0,
        bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ),
      );
      mesh.position.copy(pos);
      this.group.add(mesh);

      const animal: StreetAnimal = {
        mesh, type: 'rat',
        position: pos.clone(),
        walkTarget: this.randomWalkTarget(pos, 5),
        speed: STREET_LIFE.RAT_SPEED,
        state: 'walking',
        stateTimer: 0.5 + Math.random() * 1,
        tailPhase: Math.random() * Math.PI * 2,
        hitCooldown: 0,
        isGrabbed: false,
        modelLoaded: false,
      };
      this.animals.push(animal);

      // Async model swap
      modelManager.getModel('animal.rodent.rat').then(glb => {
        if (glb && !animal.modelLoaded) this.swapAnimalMesh(animal, glb);
      });
    }
  }

  private swapAnimalMesh(animal: StreetAnimal, newMesh: THREE.Group): void {
    // Copy transform from old mesh
    newMesh.position.copy(animal.mesh.position);
    newMesh.rotation.copy(animal.mesh.rotation);
    newMesh.visible = animal.mesh.visible;

    // Remove old mesh from scene
    this.group.remove(animal.mesh);

    // Dispose old procedural geometry
    animal.mesh.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });

    // Add new mesh
    this.group.add(newMesh);
    animal.mesh = newMesh;
    animal.modelLoaded = true;

    // Set up mixer if GLB has animations
    if (newMesh.userData.mixer) {
      animal.mixer = newMesh.userData.mixer;
    }
  }

  private randomWalkTarget(from: THREE.Vector3, range: number): THREE.Vector3 {
    const angle = Math.random() * Math.PI * 2;
    const dist = 3 + Math.random() * range;
    return new THREE.Vector3(
      from.x + Math.cos(angle) * dist,
      0,
      from.z + Math.sin(angle) * dist,
    );
  }

  // ===================== FOOD CARTS =====================

  private createFoodCarts(streetPaths: THREE.Vector3[][]): void {
    const cartColors = [0xcc4444, 0x44aa44, 0x4488cc, 0xddaa22, 0xcc44cc];
    const count = Math.min(STREET_LIFE.FOOD_CART_COUNT, streetPaths.length);

    // Pick random street positions for carts
    const usedPaths = new Set<number>();
    for (let i = 0; i < count; i++) {
      let pathIdx: number;
      do {
        pathIdx = Math.floor(Math.random() * streetPaths.length);
      } while (usedPaths.has(pathIdx) && usedPaths.size < streetPaths.length);
      usedPaths.add(pathIdx);

      const path = streetPaths[pathIdx];
      const pos = new THREE.Vector3().lerpVectors(path[0], path[path.length - 1], Math.random());
      pos.y = 0;

      const cart = new THREE.Group();
      const color = cartColors[i % cartColors.length];

      // Cart body
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 1.5, 1.2),
        createToonMaterial(color),
      );
      body.position.y = 1;
      cart.add(body);

      // Counter top
      const counter = new THREE.Mesh(
        new THREE.BoxGeometry(2, 0.1, 1.4),
        createToonMaterial(0xB0B0B0),
      );
      counter.position.y = 1.8;
      cart.add(counter);

      // Umbrella pole
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 2, 4),
        createToonMaterial(0x888888),
      );
      pole.position.y = 2.8;
      cart.add(pole);

      // Umbrella canopy
      const canopy = new THREE.Mesh(
        new THREE.ConeGeometry(1.5, 0.6, 8),
        createToonMaterial(color),
      );
      canopy.position.y = 4;
      cart.add(canopy);

      // Wheels
      const wheelGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 6);
      const wheelMat = createToonMaterial(0x444444);
      for (const xOff of [-0.8, 0.8]) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(xOff, 0.2, 0);
        cart.add(w);
      }

      cart.position.copy(pos);
      cart.rotation.y = Math.random() * Math.PI * 2;
      this.group.add(cart);

      this.foodCarts.push({
        mesh: cart,
        position: pos.clone(),
        hitCooldown: 0,
        flashTimer: 0,
      });
    }
  }

  // ===================== UPDATE =====================

  update(dt: number, playerPos: THREE.Vector3): void {
    this.updateAnimals(dt, playerPos);
    this.updateFoodCarts(dt);
  }

  /** Get all animals (for grab system, zoo system, etc.) */
  getAnimals(): StreetAnimal[] {
    return this.animals;
  }

  /** DEBUG: Spawn an animal at a specific position for testing */
  spawnAnimalAt(type: AnimalType, pos: THREE.Vector3): void {
    const mesh = this.createProceduralAnimalMesh(type);
    const position = new THREE.Vector3(pos.x, 0, pos.z);
    mesh.position.copy(position);
    this.group.add(mesh);

    this.animals.push({
      mesh, type,
      position: position.clone(),
      walkTarget: position.clone(),
      speed: type === 'cat' ? STREET_LIFE.CAT_SPEED : type === 'rat' ? STREET_LIFE.RAT_SPEED : STREET_LIFE.DOG_SPEED,
      state: 'idle',
      stateTimer: 999, // Stay idle so it's easy to grab
      tailPhase: 0,
      hitCooldown: 0,
      isGrabbed: false,
      modelLoaded: false,
    });
  }

  /** Place a grabbed animal safely on the ground */
  placeAnimal(animal: StreetAnimal, position: THREE.Vector3): void {
    animal.isGrabbed = false;
    animal.position.set(position.x, 0, position.z);
    animal.mesh.position.copy(animal.position);
    animal.mesh.rotation.set(0, Math.random() * Math.PI * 2, 0);
    animal.state = 'idle';
    animal.stateTimer = 2 + Math.random() * 3;
  }

  private updateAnimals(dt: number, playerPos: THREE.Vector3): void {
    for (const animal of this.animals) {
      // Skip grabbed animals (GrabSystem manages their position)
      if (animal.isGrabbed) continue;

      // Hit cooldown
      if (animal.hitCooldown > 0) animal.hitCooldown -= dt;

      // Update animation mixer for GLB models
      if (animal.mixer) {
        animal.mixer.update(dt);
      }

      // Hit state (stunned briefly)
      if (animal.state === 'hit') {
        animal.stateTimer -= dt;
        // Wobble animation
        animal.mesh.rotation.z = Math.sin(animal.stateTimer * 15) * 0.3;
        if (animal.stateTimer <= 0) {
          animal.mesh.rotation.z = 0;
          animal.state = 'fleeing';
          animal.stateTimer = 3; // Flee after being hit
        }
        continue;
      }

      // Tail wag/sway (only for procedural meshes — GLB uses mixer)
      if (!animal.modelLoaded) {
        animal.tailPhase += dt * (animal.type === 'dog' ? 8 : animal.type === 'rat' ? 12 : 3);
        const tail = animal.mesh.getObjectByName('tail');
        if (tail) {
          tail.rotation.z = Math.sin(animal.tailPhase) * (animal.type === 'dog' ? 0.5 : 0.3);
        }
      }

      // Distance to player
      const dx = playerPos.x - animal.position.x;
      const dz = playerPos.z - animal.position.z;
      const playerDistSq = dx * dx + dz * dz;

      if (animal.state === 'fleeing') {
        animal.stateTimer -= dt;
        if (animal.stateTimer <= 0) {
          animal.state = 'idle';
          animal.stateTimer = animal.type === 'rat' ? 0.5 + Math.random() : 2 + Math.random() * 3;
        } else {
          // Run away from player
          const awayAngle = Math.atan2(-dz, -dx);
          let fleeSpeed: number;
          if (animal.type === 'cat') fleeSpeed = STREET_LIFE.CAT_DODGE_SPEED;
          else if (animal.type === 'rat') fleeSpeed = STREET_LIFE.RAT_FLEE_SPEED;
          else fleeSpeed = STREET_LIFE.DOG_SCATTER_SPEED;
          animal.position.x += Math.cos(awayAngle) * fleeSpeed * dt;
          animal.position.z += Math.sin(awayAngle) * fleeSpeed * dt;
          animal.mesh.position.copy(animal.position);
          animal.mesh.rotation.y = awayAngle;
        }
      } else if (animal.state === 'walking') {
        // Walk toward target
        _dir.subVectors(animal.walkTarget, animal.position);
        const dist = _dir.length();

        if (dist < 1) {
          // Reached target, idle for a bit
          animal.state = 'idle';
          animal.stateTimer = animal.type === 'rat' ? 0.3 + Math.random() * 0.7 : 1 + Math.random() * 3;
        } else {
          _dir.normalize();
          animal.position.addScaledVector(_dir, animal.speed * dt);
          animal.mesh.position.copy(animal.position);
          animal.mesh.rotation.y = Math.atan2(_dir.x, _dir.z);
        }
      } else {
        // Idle
        animal.stateTimer -= dt;
        if (animal.stateTimer <= 0) {
          animal.state = 'walking';
          const range = animal.type === 'cat' ? 8 : animal.type === 'rat' ? 5 : 15;
          animal.walkTarget = this.randomWalkTarget(animal.position, range);
          animal.stateTimer = animal.type === 'rat' ? 1 + Math.random() * 2 : 5 + Math.random() * 5;
        }
      }

      // React to nearby player
      let reactRadius: number;
      if (animal.type === 'cat') reactRadius = STREET_LIFE.CAT_DODGE_RADIUS;
      else if (animal.type === 'rat') reactRadius = STREET_LIFE.RAT_FLEE_RADIUS;
      else reactRadius = STREET_LIFE.DOG_REACT_RADIUS;

      if (playerDistSq < reactRadius * reactRadius && playerPos.y < 20 && animal.state !== 'fleeing') {
        if (animal.type === 'cat' || animal.type === 'rat') {
          // Cats and rats always flee
          animal.state = 'fleeing';
          animal.stateTimer = animal.type === 'rat' ? 2 : STREET_LIFE.CAT_DODGE_DURATION;
        } else if (playerDistSq < STREET_LIFE.DOG_REACT_RADIUS * STREET_LIFE.DOG_REACT_RADIUS * 0.25) {
          // Dogs only flee if very close
          animal.state = 'fleeing';
          animal.stateTimer = STREET_LIFE.DOG_SCATTER_DURATION;
        }
      }

      // Distance culling
      if (playerDistSq > 300 * 300) {
        animal.mesh.visible = false;
      } else {
        animal.mesh.visible = true;
      }
    }
  }

  private updateFoodCarts(dt: number): void {
    for (const cart of this.foodCarts) {
      if (cart.hitCooldown > 0) cart.hitCooldown -= dt;

      if (cart.flashTimer > 0) {
        cart.flashTimer -= dt;
        cart.mesh.visible = Math.sin(cart.flashTimer * 20) > 0;
        if (cart.flashTimer <= 0) cart.mesh.visible = true;
      }
    }
  }

  // ===================== COLLISIONS =====================

  checkPoopHits(activePoops: Poop[], onHit: (result: StreetLifeHitResult) => void): void {
    for (const poop of activePoops) {
      if (!poop.alive) continue;
      const poopPos = poop.mesh.position;
      let hit = false;

      // Check food carts
      for (const cart of this.foodCarts) {
        if (cart.hitCooldown > 0) continue;

        const dx = poopPos.x - cart.position.x;
        const dy = poopPos.y - cart.position.y - 2;
        const dz = poopPos.z - cart.position.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        const radius = STREET_LIFE.FOOD_CART_HIT_RADIUS;

        if (distSq < radius * radius) {
          cart.hitCooldown = STREET_LIFE.FOOD_CART_HIT_COOLDOWN;
          cart.flashTimer = 0.6;
          poop.kill();
          onHit({ coins: STREET_LIFE.FOOD_CART_COINS, heat: STREET_LIFE.FOOD_CART_HEAT, position: cart.position.clone() });
          hit = true;
          break;
        }
      }
      if (hit) continue;

      // Check animals (cats, dogs, and rats)
      for (const animal of this.animals) {
        if (animal.hitCooldown > 0 || animal.state === 'hit') continue;
        if (!animal.mesh.visible || animal.isGrabbed) continue;

        let hitRadius: number;
        if (animal.type === 'cat') hitRadius = STREET_LIFE.CAT_HIT_RADIUS;
        else if (animal.type === 'rat') hitRadius = STREET_LIFE.RAT_HIT_RADIUS;
        else hitRadius = STREET_LIFE.DOG_HIT_RADIUS;

        const dx = poopPos.x - animal.position.x;
        const dy = poopPos.y - animal.position.y - 0.4; // Center height
        const dz = poopPos.z - animal.position.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < hitRadius * hitRadius) {
          animal.hitCooldown = 10; // 10s cooldown
          animal.state = 'hit';
          animal.stateTimer = 0.8; // Stunned for 0.8s
          poop.kill();

          let coins: number, heat: number;
          if (animal.type === 'cat') { coins = STREET_LIFE.CAT_COINS; heat = STREET_LIFE.CAT_HEAT; }
          else if (animal.type === 'rat') { coins = STREET_LIFE.RAT_COINS; heat = STREET_LIFE.RAT_HEAT; }
          else { coins = STREET_LIFE.DOG_COINS; heat = STREET_LIFE.DOG_HEAT; }

          onHit({ coins, heat, position: animal.position.clone() });
          hit = true;
          break;
        }
      }
    }
  }
}
