import * as THREE from 'three';
import { ZOO } from '../utils/Constants';
import { createToonMaterial } from '../rendering/ToonUtils';
import { AnimalModelManager } from './AnimalModelManager';
import type { StreetAnimal } from './StreetLifeSystem';
import type { Poop } from '../entities/Poop';

type ZooAnimalType = 'elephant' | 'giraffe' | 'penguin' | 'monkey';

interface ZooAnimal {
  mesh: THREE.Group;
  type: ZooAnimalType;
  position: THREE.Vector3;
  state: 'idle' | 'walking' | 'spooked' | 'pooped';
  stateTimer: number;
  speed: number;
  walkTarget: THREE.Vector3;
  mixer?: THREE.AnimationMixer;
  modelLoaded: boolean;
  hitCooldown: number;
  enclosureBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export interface ZooHitResult {
  coins: number;
  heat: number;
  position: THREE.Vector3;
  animalType: ZooAnimalType;
}

const _dir = new THREE.Vector3();

export class ZooSystem {
  readonly group = new THREE.Group();
  private animals: ZooAnimal[] = [];
  private bounds = ZOO.BOUNDS;
  private elapsed = 0;
  private centerX: number;
  private centerZ: number;

  // Poop splat decals on the ground
  private splatPool: THREE.Mesh[] = [];
  private splatIndex = 0;

  constructor() {
    this.centerX = (this.bounds.minX + this.bounds.maxX) / 2;
    this.centerZ = (this.bounds.minZ + this.bounds.maxZ) / 2;

    this.createZooEnclosure();
    this.createSplatPool();
    this.spawnAllAnimals();
  }

  /** Get the center of the zoo for minimap/HUD markers. */
  getCenter(): THREE.Vector3 {
    return new THREE.Vector3(this.centerX, 0, this.centerZ);
  }

  /** Check if a world position is inside the zoo bounds. */
  isInsideBounds(pos: THREE.Vector3): boolean {
    return pos.x >= this.bounds.minX && pos.x <= this.bounds.maxX
        && pos.z >= this.bounds.minZ && pos.z <= this.bounds.maxZ;
  }

  // ---- Enclosure construction ----

  private createZooEnclosure(): void {
    // Green ground plane for the zoo area
    const w = this.bounds.maxX - this.bounds.minX;
    const d = this.bounds.maxZ - this.bounds.minZ;
    const groundGeo = new THREE.PlaneGeometry(w, d);
    const groundMat = createToonMaterial(0x4a7c3f);
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(this.centerX, 0.02, this.centerZ);
    this.group.add(ground);

    // Dirt paths between enclosures (cross shape)
    const pathMat = createToonMaterial(0xc4a86c);
    const pathH = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, 4), pathMat);
    pathH.rotation.x = -Math.PI / 2;
    pathH.position.set(this.centerX, 0.03, this.centerZ);
    this.group.add(pathH);
    const pathV = new THREE.Mesh(new THREE.PlaneGeometry(4, d * 0.9), pathMat);
    pathV.rotation.x = -Math.PI / 2;
    pathV.position.set(this.centerX, 0.03, this.centerZ);
    this.group.add(pathV);

    // Perimeter fence
    this.buildFence(this.bounds);

    // Inner enclosure fences (smaller pens)
    for (const [, enc] of Object.entries(ZOO.ENCLOSURES)) {
      const eb = this.enclosureToBounds(enc);
      this.buildLowFence(eb);
    }

    // Entry gate
    const gatePostMat = createToonMaterial(0x654321);
    const gateGeo = new THREE.CylinderGeometry(0.25, 0.25, 4, 6);
    for (const offset of [-4, 4]) {
      const gatePost = new THREE.Mesh(gateGeo, gatePostMat);
      gatePost.position.set(this.centerX + offset, 2, this.bounds.minZ);
      this.group.add(gatePost);
    }

    // "ZOO" sign arch
    const archGeo = new THREE.BoxGeometry(10, 2, 0.4);
    const archMat = createToonMaterial(0x2255aa);
    const arch = new THREE.Mesh(archGeo, archMat);
    arch.position.set(this.centerX, 4, this.bounds.minZ);
    this.group.add(arch);

    // Decorative trees around the zoo
    this.addTrees();

    // Penguin pool (blue water patch)
    const pengEnc = ZOO.ENCLOSURES.penguin;
    const poolGeo = new THREE.CircleGeometry(6, 16);
    const poolMat = createToonMaterial(0x3388cc);
    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(
      this.centerX + pengEnc.offsetX,
      0.04,
      this.centerZ + pengEnc.offsetZ,
    );
    this.group.add(pool);
  }

  private enclosureToBounds(enc: { offsetX: number; offsetZ: number; size: number }) {
    const half = enc.size / 2;
    return {
      minX: this.centerX + enc.offsetX - half,
      maxX: this.centerX + enc.offsetX + half,
      minZ: this.centerZ + enc.offsetZ - half,
      maxZ: this.centerZ + enc.offsetZ + half,
    };
  }

  private buildFence(b: { minX: number; maxX: number; minZ: number; maxZ: number }): void {
    const fenceMat = createToonMaterial(0x8B4513);
    const postGeo = new THREE.CylinderGeometry(0.15, 0.15, 3, 4);
    const spacing = 8;
    const sides = [
      { startX: b.minX, startZ: b.minZ, endX: b.maxX, endZ: b.minZ },
      { startX: b.maxX, startZ: b.minZ, endX: b.maxX, endZ: b.maxZ },
      { startX: b.maxX, startZ: b.maxZ, endX: b.minX, endZ: b.maxZ },
      { startX: b.minX, startZ: b.maxZ, endX: b.minX, endZ: b.minZ },
    ];

    for (const side of sides) {
      const dx = side.endX - side.startX;
      const dz = side.endZ - side.startZ;
      const length = Math.sqrt(dx * dx + dz * dz);
      const posts = Math.floor(length / spacing);
      const angle = Math.atan2(dx, dz);

      for (let i = 0; i <= posts; i++) {
        const t = i / Math.max(posts, 1);
        const x = side.startX + dx * t;
        const z = side.startZ + dz * t;
        const post = new THREE.Mesh(postGeo, fenceMat);
        post.position.set(x, 1.5, z);
        this.group.add(post);

        if (i < posts) {
          const midX = x + (dx / posts) * 0.5;
          const midZ = z + (dz / posts) * 0.5;
          for (const h of [0.8, 1.6, 2.4]) {
            const rail = new THREE.Mesh(
              new THREE.BoxGeometry(0.08, 0.12, spacing),
              fenceMat,
            );
            rail.position.set(midX, h, midZ);
            rail.rotation.y = angle;
            this.group.add(rail);
          }
        }
      }
    }
  }

  private buildLowFence(b: { minX: number; maxX: number; minZ: number; maxZ: number }): void {
    const fenceMat = createToonMaterial(0x9B7653);
    const spacing = 6;
    const sides = [
      { startX: b.minX, startZ: b.minZ, endX: b.maxX, endZ: b.minZ },
      { startX: b.maxX, startZ: b.minZ, endX: b.maxX, endZ: b.maxZ },
      { startX: b.maxX, startZ: b.maxZ, endX: b.minX, endZ: b.maxZ },
      { startX: b.minX, startZ: b.maxZ, endX: b.minX, endZ: b.minZ },
    ];

    for (const side of sides) {
      const dx = side.endX - side.startX;
      const dz = side.endZ - side.startZ;
      const length = Math.sqrt(dx * dx + dz * dz);
      const posts = Math.floor(length / spacing);
      const angle = Math.atan2(dx, dz);

      for (let i = 0; i <= posts; i++) {
        const t = i / Math.max(posts, 1);
        const x = side.startX + dx * t;
        const z = side.startZ + dz * t;
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.1, 1.8, 4),
          fenceMat,
        );
        post.position.set(x, 0.9, z);
        this.group.add(post);

        if (i < posts) {
          const midX = x + (dx / posts) * 0.5;
          const midZ = z + (dz / posts) * 0.5;
          for (const h of [0.5, 1.2]) {
            const rail = new THREE.Mesh(
              new THREE.BoxGeometry(0.06, 0.1, spacing),
              fenceMat,
            );
            rail.position.set(midX, h, midZ);
            rail.rotation.y = angle;
            this.group.add(rail);
          }
        }
      }
    }
  }

  private addTrees(): void {
    const trunkMat = createToonMaterial(0x6B4226);
    const leafMat = createToonMaterial(0x2d6e1e);
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 4, 5);
    const leafGeo = new THREE.SphereGeometry(2.5, 6, 5);

    // Place trees along paths and at corners
    const treePositions = [
      [this.centerX - 20, this.centerZ - 10],
      [this.centerX + 20, this.centerZ - 10],
      [this.centerX - 20, this.centerZ + 10],
      [this.centerX + 20, this.centerZ + 10],
      [this.centerX, this.centerZ - 35],
      [this.centerX, this.centerZ + 35],
    ];

    for (const [x, z] of treePositions) {
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x, 2, z);
      this.group.add(trunk);
      const leaves = new THREE.Mesh(leafGeo, leafMat);
      leaves.position.set(x, 5.5, z);
      this.group.add(leaves);
    }
  }

  private createSplatPool(): void {
    const splatGeo = new THREE.CircleGeometry(0.8, 6);
    for (let i = 0; i < 30; i++) {
      const splat = new THREE.Mesh(
        splatGeo,
        new THREE.MeshBasicMaterial({
          color: 0x7a5c2e,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
        }),
      );
      splat.rotation.x = -Math.PI / 2;
      splat.visible = false;
      this.group.add(splat);
      this.splatPool.push(splat);
    }
  }

  // ---- Animal spawning ----

  private spawnAllAnimals(): void {
    this.spawnAnimal('elephant', ZOO.ENCLOSURES.elephant, ZOO.ELEPHANT_SPEED);
    this.spawnAnimal('giraffe', ZOO.ENCLOSURES.giraffe, ZOO.GIRAFFE_SPEED);
    this.spawnAnimal('monkey', ZOO.ENCLOSURES.monkey, ZOO.MONKEY_SPEED);

    // Multiple penguins
    for (let i = 0; i < ZOO.PENGUIN_COUNT; i++) {
      this.spawnAnimal('penguin', ZOO.ENCLOSURES.penguin, ZOO.PENGUIN_SPEED);
    }
  }

  private spawnAnimal(
    type: ZooAnimalType,
    enc: { offsetX: number; offsetZ: number; size: number },
    speed: number,
  ): void {
    const mesh = this.createProceduralAnimal(type);
    const eb = this.enclosureToBounds(enc);
    const pos = this.randomPosInBounds(eb, 3);
    mesh.position.copy(pos);
    this.group.add(mesh);

    this.animals.push({
      mesh,
      type,
      position: pos.clone(),
      state: 'idle',
      stateTimer: 2 + Math.random() * 4,
      speed,
      walkTarget: pos.clone(),
      modelLoaded: false,
      hitCooldown: 0,
      enclosureBounds: eb,
    });
  }

  // ---- Procedural animal meshes ----

  private createProceduralAnimal(type: ZooAnimalType): THREE.Group {
    switch (type) {
      case 'elephant': return this.createProceduralElephant();
      case 'giraffe': return this.createProceduralGiraffe();
      case 'penguin': return this.createProceduralPenguin();
      case 'monkey': return this.createProceduralMonkey();
    }
  }

  private createProceduralElephant(): THREE.Group {
    const group = new THREE.Group();
    const gray = createToonMaterial(0x888888);

    const body = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 4), gray);
    body.position.y = 2.5;
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6), gray);
    head.position.set(0, 3.5, 2.2);
    group.add(head);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.35, 2, 6), gray);
    trunk.position.set(0, 2.5, 3.2);
    trunk.rotation.x = 0.5;
    trunk.name = 'trunk';
    group.add(trunk);

    const earGeo = new THREE.CircleGeometry(1, 6);
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(earGeo, gray.clone());
      ear.position.set(side * 1.5, 3.5, 1.8);
      ear.rotation.y = side * 0.3;
      group.add(ear);
    }

    const legGeo = new THREE.CylinderGeometry(0.4, 0.45, 2.5, 6);
    for (const [x, z] of [[-0.9, -1.2], [0.9, -1.2], [-0.9, 1.2], [0.9, 1.2]]) {
      const leg = new THREE.Mesh(legGeo, gray);
      leg.position.set(x, 1.25, z);
      group.add(leg);
    }

    return group;
  }

  private createProceduralGiraffe(): THREE.Group {
    const group = new THREE.Group();
    const yellow = createToonMaterial(0xd4a843);
    const brown = createToonMaterial(0x8B5E3C);

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.8, 3), yellow);
    body.position.y = 3.5;
    group.add(body);

    // Long neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 5, 6), yellow);
    neck.position.set(0, 6.5, 1.2);
    neck.rotation.x = -0.15;
    group.add(neck);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 1.0), yellow);
    head.position.set(0, 9.2, 1.5);
    group.add(head);

    // Ossicones (little horns)
    const hornGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 4);
    for (const side of [-0.2, 0.2]) {
      const horn = new THREE.Mesh(hornGeo, brown);
      horn.position.set(side, 9.7, 1.5);
      group.add(horn);
    }

    // Spots (small box patches on the body)
    const spotGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    for (let i = 0; i < 6; i++) {
      const spot = new THREE.Mesh(spotGeo, brown);
      spot.position.set(
        (Math.random() - 0.5) * 1.2,
        3 + Math.random() * 1.2,
        (Math.random() - 0.5) * 2.5,
      );
      group.add(spot);
    }

    // 4 legs
    const legGeo = new THREE.CylinderGeometry(0.2, 0.22, 3, 5);
    for (const [x, z] of [[-0.5, -1], [0.5, -1], [-0.5, 1], [0.5, 1]]) {
      const leg = new THREE.Mesh(legGeo, yellow);
      leg.position.set(x, 1.5, z);
      group.add(leg);
    }

    return group;
  }

  private createProceduralPenguin(): THREE.Group {
    const group = new THREE.Group();
    const black = createToonMaterial(0x222222);
    const white = createToonMaterial(0xf0f0f0);
    const orange = createToonMaterial(0xff8800);

    // Body (egg shape using sphere)
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), black);
    body.scale.set(1, 1.3, 0.9);
    body.position.y = 0.9;
    group.add(body);

    // White belly
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), white);
    belly.scale.set(0.8, 1.1, 0.5);
    belly.position.set(0, 0.9, 0.18);
    group.add(belly);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), black);
    head.position.set(0, 1.6, 0.05);
    group.add(head);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.06, 4, 4);
    const eyeMat = createToonMaterial(0xffffff);
    for (const side of [-0.12, 0.12]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(side, 1.65, 0.25);
      group.add(eye);
    }

    // Beak
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 4), orange);
    beak.rotation.x = -Math.PI / 2;
    beak.position.set(0, 1.55, 0.35);
    group.add(beak);

    // Flippers
    const flipperGeo = new THREE.BoxGeometry(0.12, 0.5, 0.25);
    for (const side of [-0.45, 0.45]) {
      const flipper = new THREE.Mesh(flipperGeo, black);
      flipper.position.set(side, 1.0, 0);
      flipper.rotation.z = side > 0 ? -0.3 : 0.3;
      flipper.name = 'flipper';
      group.add(flipper);
    }

    // Feet
    const footGeo = new THREE.BoxGeometry(0.2, 0.06, 0.3);
    for (const side of [-0.15, 0.15]) {
      const foot = new THREE.Mesh(footGeo, orange);
      foot.position.set(side, 0.03, 0.1);
      group.add(foot);
    }

    return group;
  }

  private createProceduralMonkey(): THREE.Group {
    const group = new THREE.Group();
    const fur = createToonMaterial(0x8B5A2B);
    const face = createToonMaterial(0xdeb887);

    // Body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), fur);
    body.scale.set(1, 1.1, 0.9);
    body.position.y = 1.5;
    group.add(body);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), fur);
    head.position.set(0, 2.3, 0.2);
    group.add(head);

    // Face plate
    const faceMesh = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), face);
    faceMesh.scale.set(0.8, 0.9, 0.5);
    faceMesh.position.set(0, 2.3, 0.4);
    group.add(faceMesh);

    // Ears
    const earGeo = new THREE.SphereGeometry(0.15, 6, 4);
    for (const side of [-0.45, 0.45]) {
      const ear = new THREE.Mesh(earGeo, face);
      ear.position.set(side, 2.4, 0.15);
      group.add(ear);
    }

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.06, 4, 4);
    const eyeMat = createToonMaterial(0x111111);
    for (const side of [-0.15, 0.15]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(side, 2.4, 0.55);
      group.add(eye);
    }

    // Arms
    const armGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.0, 5);
    for (const side of [-0.65, 0.65]) {
      const arm = new THREE.Mesh(armGeo, fur);
      arm.position.set(side, 1.3, 0);
      arm.rotation.z = side > 0 ? -0.5 : 0.5;
      group.add(arm);
    }

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.8, 5);
    for (const side of [-0.3, 0.3]) {
      const leg = new THREE.Mesh(legGeo, fur);
      leg.position.set(side, 0.4, 0);
      group.add(leg);
    }

    // Tail (curled cylinder)
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.2, 5), fur);
    tail.position.set(0, 1.2, -0.6);
    tail.rotation.x = -0.8;
    tail.name = 'tail';
    group.add(tail);

    return group;
  }

  // ---- Update ----

  update(dt: number, _playerPos: THREE.Vector3, streetAnimals: StreetAnimal[]): void {
    this.elapsed += dt;

    for (const animal of this.animals) {
      if (animal.hitCooldown > 0) animal.hitCooldown -= dt;
      if (animal.mixer) animal.mixer.update(dt);

      if (animal.type === 'elephant') {
        this.checkRatProximity(animal, streetAnimals);
      }

      this.updateAnimal(animal, dt);
    }
  }

  private updateAnimal(a: ZooAnimal, dt: number): void {
    if (a.state === 'pooped') {
      // Pooped reaction: freeze briefly, wobble
      a.stateTimer -= dt;
      a.mesh.rotation.z = Math.sin(this.elapsed * 12) * 0.08;
      if (a.stateTimer <= 0) {
        a.state = 'walking';
        a.walkTarget = this.randomPosInBounds(a.enclosureBounds, 3);
        a.stateTimer = 4 + Math.random() * 4;
        a.mesh.rotation.z = 0;
      }
      return;
    }

    if (a.state === 'spooked') {
      a.stateTimer -= dt;
      _dir.subVectors(a.walkTarget, a.position);
      const dist = _dir.length();
      if (dist > 1) {
        _dir.normalize();
        const spookSpeed = a.type === 'elephant' ? ZOO.ELEPHANT_SPOOKED_SPEED : a.speed * 3;
        a.position.addScaledVector(_dir, spookSpeed * dt);
        a.mesh.position.copy(a.position);
        a.mesh.rotation.y = Math.atan2(_dir.x, _dir.z);
      }
      this.clampToEnclosure(a);
      a.mesh.rotation.z = Math.sin(a.stateTimer * 10) * 0.05;

      if (a.stateTimer <= 0) {
        a.state = 'idle';
        a.stateTimer = 2 + Math.random() * 3;
        a.mesh.rotation.z = 0;
      }
      return;
    }

    if (a.state === 'walking') {
      _dir.subVectors(a.walkTarget, a.position);
      const dist = _dir.length();
      if (dist < 1.5) {
        a.state = 'idle';
        a.stateTimer = 2 + Math.random() * 5;
      } else {
        _dir.normalize();
        a.position.addScaledVector(_dir, a.speed * dt);
        a.mesh.position.copy(a.position);
        a.mesh.rotation.y = Math.atan2(_dir.x, _dir.z);
      }

      // Type-specific walk animations
      if (a.type === 'penguin') {
        a.mesh.rotation.z = Math.sin(this.elapsed * ZOO.PENGUIN_WADDLE_RATE) * 0.12;
      }
      return;
    }

    // Idle state
    this.animateIdle(a);
    a.stateTimer -= dt;
    if (a.stateTimer <= 0) {
      a.state = 'walking';
      a.walkTarget = this.randomPosInBounds(a.enclosureBounds, 3);
      a.stateTimer = 6 + Math.random() * 6;
    }
  }

  private animateIdle(a: ZooAnimal): void {
    if (a.modelLoaded) return;

    switch (a.type) {
      case 'elephant': {
        const trunk = a.mesh.getObjectByName('trunk');
        if (trunk) trunk.rotation.z = Math.sin(this.elapsed * 2) * 0.15;
        break;
      }
      case 'monkey': {
        const tail = a.mesh.getObjectByName('tail');
        if (tail) tail.rotation.z = Math.sin(this.elapsed * 3) * 0.2;
        // Subtle bounce
        a.mesh.position.y = a.position.y + Math.abs(Math.sin(this.elapsed * 2)) * 0.1;
        break;
      }
      case 'penguin': {
        // Gentle body sway
        a.mesh.rotation.z = Math.sin(this.elapsed * 1.5 + a.position.x) * 0.04;
        break;
      }
      case 'giraffe': {
        // Slow head bob via slight neck pitch
        a.mesh.position.y = a.position.y + Math.sin(this.elapsed * 0.8) * 0.1;
        break;
      }
    }
  }

  // ---- Poop hit detection ----

  checkPoopHits(poops: Poop[], onHit: (result: ZooHitResult) => void): void {
    const hitRadiusSq = ZOO.HIT_RADIUS * ZOO.HIT_RADIUS;

    for (const poop of poops) {
      if (!poop.alive || poop.grounded) continue;
      const pp = poop.mesh.position;

      for (const animal of this.animals) {
        if (animal.hitCooldown > 0) continue;

        const dx = pp.x - animal.position.x;
        const dy = pp.y - animal.position.y - 1.5; // aim at body center
        const dz = pp.z - animal.position.z;
        if (dx * dx + dy * dy + dz * dz >= hitRadiusSq) continue;

        // Hit!
        poop.kill();
        animal.hitCooldown = ZOO.HIT_COOLDOWN;

        // Funny reaction: enter "pooped" state
        animal.state = 'pooped';
        animal.stateTimer = 1.5 + Math.random() * 0.5;

        // Place a splat decal
        this.placeSplat(animal.position);

        const coins = this.getAnimalCoins(animal.type);
        onHit({
          coins,
          heat: ZOO.HIT_HEAT,
          position: animal.position.clone(),
          animalType: animal.type,
        });
        break; // one poop per animal per frame
      }
    }
  }

  private getAnimalCoins(type: ZooAnimalType): number {
    switch (type) {
      case 'elephant': return ZOO.ELEPHANT_COINS;
      case 'giraffe': return ZOO.GIRAFFE_COINS;
      case 'penguin': return ZOO.PENGUIN_COINS;
      case 'monkey': return ZOO.MONKEY_COINS;
    }
  }

  private placeSplat(pos: THREE.Vector3): void {
    const splat = this.splatPool[this.splatIndex % this.splatPool.length];
    this.splatIndex++;
    splat.position.set(
      pos.x + (Math.random() - 0.5) * 2,
      0.05,
      pos.z + (Math.random() - 0.5) * 2,
    );
    splat.rotation.z = Math.random() * Math.PI * 2;
    const sc = 0.6 + Math.random() * 0.8;
    splat.scale.set(sc, sc, 1);
    splat.visible = true;
  }

  // ---- Rat spook (elephant-specific) ----

  private checkRatProximity(elephant: ZooAnimal, streetAnimals: StreetAnimal[]): void {
    if (elephant.state === 'spooked') return;

    for (const animal of streetAnimals) {
      if (animal.type !== 'rat') continue;
      if (animal.isGrabbed || !animal.mesh.visible) continue;

      const distSq = elephant.position.distanceToSquared(animal.position);
      if (distSq < ZOO.ELEPHANT_SPOOK_RADIUS * ZOO.ELEPHANT_SPOOK_RADIUS) {
        elephant.state = 'spooked';
        elephant.stateTimer = ZOO.ELEPHANT_SPOOK_DURATION;

        const away = new THREE.Vector3()
          .subVectors(elephant.position, animal.position)
          .normalize()
          .multiplyScalar(20);
        elephant.walkTarget.copy(elephant.position).add(away);
        this.clampToEnclosure(elephant);
        break;
      }
    }
  }

  // ---- Helpers ----

  private clampToEnclosure(a: ZooAnimal): void {
    const pad = 2;
    const b = a.enclosureBounds;
    a.position.x = Math.max(b.minX + pad, Math.min(b.maxX - pad, a.position.x));
    a.position.z = Math.max(b.minZ + pad, Math.min(b.maxZ - pad, a.position.z));
    a.mesh.position.copy(a.position);

    // Also clamp walkTarget
    a.walkTarget.x = Math.max(b.minX + pad, Math.min(b.maxX - pad, a.walkTarget.x));
    a.walkTarget.z = Math.max(b.minZ + pad, Math.min(b.maxZ - pad, a.walkTarget.z));
  }

  private randomPosInBounds(
    b: { minX: number; maxX: number; minZ: number; maxZ: number },
    pad: number,
  ): THREE.Vector3 {
    return new THREE.Vector3(
      b.minX + pad + Math.random() * (b.maxX - b.minX - pad * 2),
      0,
      b.minZ + pad + Math.random() * (b.maxZ - b.minZ - pad * 2),
    );
  }
}
