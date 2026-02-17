import * as THREE from 'three';
import { assetLoader } from '../systems/AssetLoader';
import { NPC_CONFIG } from '../utils/Constants';
import { createToonMaterial, convertToToon } from '../rendering/ToonUtils';

export type NPCType = 'tourist' | 'business' | 'performer' | 'police' | 'chef' | 'treeman' | 'glamorous-elegance';

type BehaviorState = 'walking' | 'idle' | 'fleeing' | 'photo' | 'phone';

const TOURIST_COLORS = [0x87ceeb, 0xffb6c1, 0xffd700, 0x90ee90];
const BUSINESS_COLORS = [0x4A6FA5, 0x2E4057, 0x5B7B9D, 0x3D5A80];
const PERFORMER_COLORS = [0xff6347, 0x9370db, 0xffa500, 0x20b2aa];
const POLICE_COLORS = [0x4169E1, 0x6495ED];

// Shared angry burst texture (drawn once)
let angryTexture: THREE.Texture | null = null;
function getAngryTexture(): THREE.Texture {
  if (angryTexture) return angryTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('\u{1F4A2}', size / 2, size / 2);
  angryTexture = new THREE.CanvasTexture(canvas);
  return angryTexture;
}

export class NPC {
  readonly mesh: THREE.Group;
  readonly boundingRadius = NPC_CONFIG.BOUNDING_RADIUS;
  readonly npcType: NPCType;

  private path: THREE.Vector3[];
  private pathIndex = 0;
  private direction = 1;
  private speed: number;
  private baseSpeed: number;

  // Performer-specific (stationary)
  isStationary = false;

  // Behavior state machine
  private behaviorState: BehaviorState = 'walking';
  private behaviorTimer = 0;
  private fleeDirection = new THREE.Vector3();
  private headGroup: THREE.Object3D | null = null;

  isHit = false;
  isGrabbed = false;
  private hitTimer = 0;
  private despawnTimer = 0;
  shouldDespawn = false;
  private originalColor: number;
  private bodyMaterial: THREE.MeshToonMaterial;

  private angrySprite: THREE.Sprite | null = null;
  private angryAge = 0;

  private knockbackVel = new THREE.Vector3();
  private jumpVel = 0;
  private baseY = 0.1;
  private isModelBased = false;
  private modelLoaded = false;

  /** Scatter state — bird flythrough collision */
  isScattered = false;
  private scatterTimer = 0;
  scatterCooldown = 0;
  private scatterSpinSpeed = 0;

  /** Previous position — saved each frame for collision rollback */
  readonly prevPosition = new THREE.Vector3();

  // Poop coverage system (poop blobs stuck to NPC while carried)
  private poopBlobs: THREE.Mesh[] = [];
  private static poopBlobGeo = new THREE.SphereGeometry(0.12, 5, 4);
  private static poopBlobMat = createToonMaterial(0xf5f5dc);
  static readonly MAX_POOP_BLOBS = 25;

  // Animation support
  private mixer: THREE.AnimationMixer | null = null;
  private walkAction: THREE.AnimationAction | null = null;
  private danceAction: THREE.AnimationAction | null = null;
  private currentAction: THREE.AnimationAction | null = null;

  // Leg swing for procedural walk animation
  private walkPhase = Math.random() * Math.PI * 2;
  private legLeft: THREE.Object3D | null = null;
  private legRight: THREE.Object3D | null = null;

  constructor(path: THREE.Vector3[], speed: number, type: NPCType) {
    this.path = path;
    this.speed = speed;
    this.baseSpeed = speed;
    this.npcType = type;
    this.mesh = new THREE.Group();
    this.isStationary = type === 'performer' || (type === 'treeman' && Math.random() < 0.3);

    this.isModelBased = type === 'chef' || type === 'treeman' || type === 'glamorous-elegance';

    if (this.isModelBased) {
      this.originalColor = 0xffffff;
      this.bodyMaterial = createToonMaterial(this.originalColor);
      this.buildPerson(this.mesh, this.bodyMaterial);
      this.loadModel(type as 'chef' | 'treeman' | 'glamorous-elegance');
    } else {
      let colors: number[];
      switch (type) {
        case 'tourist': colors = TOURIST_COLORS; break;
        case 'business': colors = BUSINESS_COLORS; break;
        case 'performer': colors = PERFORMER_COLORS; break;
        case 'police': colors = POLICE_COLORS; break;
        default: colors = TOURIST_COLORS; break;
      }
      this.originalColor = colors[Math.floor(Math.random() * colors.length)];
      this.bodyMaterial = createToonMaterial(this.originalColor);
      this.buildPerson(this.mesh, this.bodyMaterial);
      this.addTypeProp(type);

      if (type === 'business') this.mesh.scale.setScalar(1.05);
      else if (type === 'tourist') this.mesh.scale.setScalar(1.1);
    }

    const startIdx = Math.floor(Math.random() * Math.max(1, path.length - 1));
    this.pathIndex = startIdx;
    // Randomize initial walking direction so NPCs don't all move the same way
    this.direction = Math.random() < 0.5 ? 1 : -1;
    this.mesh.position.copy(path[this.pathIndex]);
    this.mesh.visible = true;
  }

  private async loadModel(type: 'chef' | 'treeman' | 'glamorous-elegance'): Promise<void> {
    const modelPath = type === 'chef'
      ? '/models/characters/chef.glb'
      : type === 'treeman'
        ? '/models/characters/treeman.glb'
        : '/models/characters/glamorous-elegance.glb';

    try {
      const model = await assetLoader.loadModel(modelPath, true);
      const modelGroup = model as THREE.Group;
      this.setupModelInstance(modelGroup, type);
      this.modelLoaded = true;
      if (type === 'treeman') {
        await this.loadTreemanAnimations();
      }
    } catch (error) {
      console.error(`Failed to load ${type} model:`, error);
      this.buildPerson(this.mesh, this.bodyMaterial);
      this.modelLoaded = true;
    }
  }

  private async loadTreemanAnimations(): Promise<void> {
    try {
      let modelRoot: THREE.Object3D | null = null;
      this.mesh.traverse((child) => {
        if (child.type === 'Group' && child !== this.mesh && !modelRoot) {
          modelRoot = child;
        }
      });
      if (!modelRoot) return;

      this.mixer = new THREE.AnimationMixer(modelRoot);

      const walkClips = await assetLoader.loadAnimations('/models/characters/treeman_walk.glb');
      if (walkClips.length > 0) {
        const validatedClip = this.validateAnimationClip(walkClips[0], modelRoot);
        if (validatedClip) {
          this.walkAction = this.mixer.clipAction(validatedClip);
          this.walkAction.play();
          this.currentAction = this.walkAction;
        }
      }

      const danceClips = await assetLoader.loadAnimations('/models/characters/treeman_dance.glb');
      if (danceClips.length > 0) {
        const validatedClip = this.validateAnimationClip(danceClips[0], modelRoot);
        if (validatedClip) {
          this.danceAction = this.mixer.clipAction(validatedClip);
        }
      }
    } catch {
      this.mixer = null;
    }
  }

  private validateAnimationClip(clip: THREE.AnimationClip, root: THREE.Object3D): THREE.AnimationClip | null {
    if (!clip || !clip.tracks || clip.tracks.length === 0) return null;

    const validTracks = clip.tracks.filter(track => {
      const nodeName = track.name.split('.')[0];
      let nodeExists = false;
      root.traverse((child) => {
        if (child.name === nodeName) nodeExists = true;
      });
      return nodeExists;
    });

    if (validTracks.length === 0) return null;
    return new THREE.AnimationClip(clip.name, clip.duration, validTracks);
  }

  private setupModelInstance(model: THREE.Group, type: 'chef' | 'treeman' | 'glamorous-elegance'): void {
    if (!model) return;

    let hasValidGeometry = false;
    const toRemove: THREE.Object3D[] = [];

    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (!child.geometry) {
          toRemove.push(child);
          return;
        }
        hasValidGeometry = true;
        child.frustumCulled = false;
        if (!child.geometry.boundingSphere) child.geometry.computeBoundingSphere();
        if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    toRemove.forEach(obj => obj.parent?.remove(obj));
    if (!hasValidGeometry) return;

    while (this.mesh.children.length > 0) {
      this.mesh.remove(this.mesh.children[0]);
    }

    let bbox: THREE.Box3;
    try {
      bbox = new THREE.Box3().setFromObject(model);
    } catch {
      return;
    }
    const size = new THREE.Vector3();
    bbox.getSize(size);
    if (size.y === 0) return;

    const targetHeight = 1.5;
    const scaleFactor = targetHeight / size.y;

    if (type === 'treeman') {
      model.scale.setScalar(scaleFactor * 1.2);
    } else {
      model.scale.setScalar(scaleFactor * 1.0);
    }

    const bbox2 = new THREE.Box3().setFromObject(model);
    model.position.y = -bbox2.min.y;

    this.mesh.add(model);
    convertToToon(model);
  }

  private buildPerson(parent: THREE.Group, bodyMat: THREE.Material): void {
    const scale = 1.5;

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * scale, 0.25 * scale, 1.2 * scale, 6), bodyMat);
    body.position.y = 0.6 * scale;
    body.castShadow = true;
    body.frustumCulled = false;
    parent.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.2 * scale, 6, 5),
      createToonMaterial(0xFFDDAA),
    );
    head.position.y = 1.4 * scale;
    head.castShadow = true;
    head.frustumCulled = false;
    this.headGroup = head;
    parent.add(head);

    const legMat = createToonMaterial(0x4A5568);
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * scale, 0.06 * scale, 0.6 * scale, 4), legMat);
    legL.position.set(-0.1 * scale, 0.3 * scale, 0);
    legL.frustumCulled = false;
    this.legLeft = legL;
    parent.add(legL);

    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * scale, 0.06 * scale, 0.6 * scale, 4), legMat);
    legR.position.set(0.1 * scale, 0.3 * scale, 0);
    legR.frustumCulled = false;
    this.legRight = legR;
    parent.add(legR);
  }

  private addTypeProp(type: NPCType): void {
    const propMat = createToonMaterial(0x666666);

    switch (type) {
      case 'tourist': {
        const camera = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.1), propMat);
        camera.position.set(0.3, 1.0, 0.2);
        this.mesh.add(camera);
        break;
      }
      case 'business': {
        const briefcase = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.1), propMat);
        briefcase.position.set(0.35, 0.5, 0);
        briefcase.rotation.z = Math.PI / 8;
        this.mesh.add(briefcase);
        break;
      }
      case 'performer': {
        const guitar = new THREE.Group();
        const gBody = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 6, 6),
          createToonMaterial(0xCD853F)
        );
        const neck = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4),
          createToonMaterial(0x8B7355)
        );
        neck.position.set(0, 0.25, 0);
        neck.rotation.z = Math.PI / 2;
        guitar.add(gBody);
        guitar.add(neck);
        guitar.position.set(0.3, 1.0, 0);
        guitar.rotation.y = Math.PI / 4;
        this.mesh.add(guitar);
        break;
      }
      case 'police': {
        const hat = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.22, 0.1, 6),
          createToonMaterial(0x4169E1)
        );
        hat.position.set(0, 1.6, 0);
        this.mesh.add(hat);
        const badge = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.1, 0.05),
          createToonMaterial(0xFFD700)
        );
        badge.position.set(0, 1.0, 0.26);
        this.mesh.add(badge);
        break;
      }
    }
  }

  get coinValue(): number {
    switch (this.npcType) {
      case 'tourist': return NPC_CONFIG.TOURIST_COINS;
      case 'business': return NPC_CONFIG.BUSINESS_COINS;
      case 'performer': return NPC_CONFIG.PERFORMER_COINS;
      case 'police': return NPC_CONFIG.POLICE_COINS;
      case 'chef': return NPC_CONFIG.CHEF_COINS;
      case 'treeman': return NPC_CONFIG.TREEMAN_COINS;
      case 'glamorous-elegance': return NPC_CONFIG.GLAMOROUS_ELEGANCE_COINS;
    }
  }

  get heatValue(): number {
    switch (this.npcType) {
      case 'tourist': return NPC_CONFIG.TOURIST_HEAT;
      case 'business': return NPC_CONFIG.BUSINESS_HEAT;
      case 'performer': return NPC_CONFIG.PERFORMER_HEAT;
      case 'police': return NPC_CONFIG.POLICE_HEAT;
      case 'chef': return NPC_CONFIG.CHEF_HEAT;
      case 'treeman': return NPC_CONFIG.TREEMAN_HEAT;
      case 'glamorous-elegance': return NPC_CONFIG.GLAMOROUS_ELEGANCE_HEAT;
    }
  }

  get multiplierBonus(): number {
    return this.npcType === 'performer' ? NPC_CONFIG.PERFORMER_MULTIPLIER_BONUS : 0;
  }

  /** Make this NPC flee away from a threat position */
  flee(threatPos: THREE.Vector3): void {
    if (this.isHit || this.isStationary || this.isGrabbed) return;

    this.behaviorState = 'fleeing';
    this.behaviorTimer = NPC_CONFIG.FLEE_DURATION;
    this.speed = NPC_CONFIG.FLEE_SPEED;

    // Run away from threat
    this.fleeDirection.subVectors(this.mesh.position, threatPos);
    this.fleeDirection.y = 0;
    if (this.fleeDirection.lengthSq() < 0.01) {
      this.fleeDirection.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    }
    this.fleeDirection.normalize();
  }

  /** Reverse walking direction (used for building collision) */
  reverseDirection(): void {
    this.direction *= -1;
    // Clamp pathIndex
    if (this.pathIndex >= this.path.length) this.pathIndex = this.path.length - 2;
    if (this.pathIndex < 0) this.pathIndex = 1;
  }

  update(dt: number): void {
    if (this.shouldDespawn) return;

    // Grabbed NPCs are fully controlled by GrabSystem
    if (this.isGrabbed) return;

    // Save position for collision rollback
    this.prevPosition.copy(this.mesh.position);

    // Update animation mixer
    if (this.mixer) {
      this.mixer.update(dt);
    }

    // Animate angry burst
    if (this.angrySprite) {
      this.angryAge += dt;
      const ANGRY_LIFETIME = 0.6;
      if (this.angryAge >= ANGRY_LIFETIME) {
        this.mesh.remove(this.angrySprite);
        this.angrySprite = null;
      } else {
        const t = this.angryAge / ANGRY_LIFETIME;
        this.angrySprite.position.y = 2.2 + t * 1.0;
        (this.angrySprite.material as THREE.SpriteMaterial).opacity = 1 - t;
        const s = 1.2 + t * 0.3;
        this.angrySprite.scale.set(s, s, 1);
      }
    }

    if (this.isHit) {
      this.updateHitState(dt);
      return;
    }

    // Scatter cooldown tick
    if (this.scatterCooldown > 0) this.scatterCooldown -= dt;

    // Scatter physics (bird flythrough)
    if (this.isScattered) {
      this.updateScatterState(dt);
      return;
    }

    // Stationary NPCs (performers and some treemen) — gentle idle sway
    if (this.isStationary) {
      if (this.npcType === 'treeman' && this.danceAction && this.currentAction !== this.danceAction) {
        this.switchAnimation(this.danceAction);
      }
      // Subtle body sway
      this.mesh.rotation.y += Math.sin(performance.now() * 0.001 + this.walkPhase) * 0.002;
      return;
    }

    // Behavior state machine
    switch (this.behaviorState) {
      case 'walking':
        this.updateWalking(dt);
        break;
      case 'idle':
        this.updateIdle(dt);
        break;
      case 'fleeing':
        this.updateFleeing(dt);
        break;
      case 'photo':
        this.updatePhoto(dt);
        break;
      case 'phone':
        this.updatePhone(dt);
        break;
    }

    // Procedural leg swing animation
    this.updateLegAnimation(dt);
  }

  private updateHitState(dt: number): void {
    if (this.knockbackVel.lengthSq() > 0.01) {
      this.mesh.position.addScaledVector(this.knockbackVel, dt);
      this.knockbackVel.multiplyScalar(Math.max(0, 1 - 5 * dt));
    }

    if (this.jumpVel !== 0 || this.mesh.position.y > this.baseY + 0.01) {
      this.jumpVel -= 20 * dt;
      this.mesh.position.y += this.jumpVel * dt;
      if (this.mesh.position.y <= this.baseY) {
        this.mesh.position.y = this.baseY;
        // Bounce back up slightly on first landing
        if (this.jumpVel < -4) {
          this.jumpVel = -this.jumpVel * 0.3;
        } else {
          this.jumpVel = 0;
        }
      }
    }

    // Stagger wobble — decreasing over time
    const hitProgress = Math.max(0, this.hitTimer / NPC_CONFIG.HIT_FREEZE_TIME);
    const wobblePhase = (NPC_CONFIG.HIT_FREEZE_TIME - this.hitTimer) * 10;
    this.mesh.rotation.z = Math.sin(wobblePhase) * 0.4 * hitProgress;
    this.mesh.rotation.x = Math.cos(wobblePhase * 0.7) * 0.15 * hitProgress;

    this.hitTimer -= dt;
    if (this.hitTimer <= 0) {
      // Reset rotation when hit state ends
      this.mesh.rotation.z = 0;
      this.mesh.rotation.x = 0;
      this.despawnTimer += dt;
      if (this.despawnTimer > 2) this.shouldDespawn = true;
    }
  }

  private updateScatterState(dt: number): void {
    // Apply knockback (decaying)
    if (this.knockbackVel.lengthSq() > 0.01) {
      this.mesh.position.addScaledVector(this.knockbackVel, dt);
      this.knockbackVel.multiplyScalar(Math.max(0, 1 - 6 * dt));
    }

    // Jump arc
    if (this.jumpVel !== 0 || this.mesh.position.y > this.baseY + 0.01) {
      this.jumpVel -= 20 * dt;
      this.mesh.position.y += this.jumpVel * dt;
      if (this.mesh.position.y <= this.baseY) {
        this.mesh.position.y = this.baseY;
        if (this.jumpVel < -3) {
          this.jumpVel = -this.jumpVel * 0.2; // Small bounce
        } else {
          this.jumpVel = 0;
        }
      }
    }

    // Spin
    this.mesh.rotation.y += this.scatterSpinSpeed * dt;
    this.scatterSpinSpeed *= Math.max(0, 1 - 3 * dt); // Decay spin

    this.scatterTimer -= dt;
    if (this.scatterTimer <= 0) {
      this.isScattered = false;
      this.scatterTimer = 0;
      this.scatterSpinSpeed = 0;
      this.mesh.rotation.z = 0;
      this.mesh.rotation.x = 0;
      // Resume walking
      this.behaviorState = 'walking';
      this.speed = this.baseSpeed;
    }
  }

  private updateWalking(dt: number): void {
    if (this.npcType === 'treeman' && this.walkAction && this.currentAction !== this.walkAction) {
      this.switchAnimation(this.walkAction);
    }

    if (this.path.length < 2) return;

    const target = this.path[this.pathIndex];
    const dir = new THREE.Vector3().subVectors(target, this.mesh.position);
    dir.y = 0;
    const dist = dir.length();
    dir.normalize();

    this.mesh.position.addScaledVector(dir, this.speed * dt);

    if (dir.lengthSq() > 0.001) {
      this.mesh.lookAt(
        this.mesh.position.x + dir.x,
        this.mesh.position.y,
        this.mesh.position.z + dir.z,
      );
    }

    // Cartoon walk bobble
    this.mesh.rotation.z = Math.sin(this.walkPhase * 0.5) * 0.03;

    if (dist < 0.5) {
      this.pathIndex += this.direction;
      if (this.pathIndex >= this.path.length) {
        this.pathIndex = this.path.length - 2;
        this.direction = -1;
      } else if (this.pathIndex < 0) {
        this.pathIndex = 1;
        this.direction = 1;
      }

      // Chance to enter an idle behavior at waypoints
      this.tryIdleBehavior();
    }
  }

  private tryIdleBehavior(): void {
    if (Math.random() > NPC_CONFIG.IDLE_CHANCE) return;

    const duration = NPC_CONFIG.IDLE_DURATION_MIN +
      Math.random() * (NPC_CONFIG.IDLE_DURATION_MAX - NPC_CONFIG.IDLE_DURATION_MIN);

    // Type-specific idle behaviors
    if (this.npcType === 'tourist' && Math.random() < 0.6) {
      this.behaviorState = 'photo';
      this.behaviorTimer = duration;
      this.mesh.rotation.y = Math.random() * Math.PI * 2;
    } else if (this.npcType === 'business' && Math.random() < 0.5) {
      this.behaviorState = 'phone';
      this.behaviorTimer = duration * 0.7;
      if (this.headGroup) this.headGroup.rotation.x = 0.5;
    } else {
      this.behaviorState = 'idle';
      this.behaviorTimer = duration;
    }
  }

  private updateIdle(dt: number): void {
    // Stand still, look around slightly
    this.mesh.rotation.y += Math.sin(performance.now() * 0.0015 + this.walkPhase) * 0.003;

    this.behaviorTimer -= dt;
    if (this.behaviorTimer <= 0) {
      this.behaviorState = 'walking';
      this.speed = this.baseSpeed;
    }
  }

  private updateFleeing(dt: number): void {
    this.mesh.position.addScaledVector(this.fleeDirection, this.speed * dt);

    this.mesh.lookAt(
      this.mesh.position.x + this.fleeDirection.x,
      this.mesh.position.y,
      this.mesh.position.z + this.fleeDirection.z,
    );

    this.behaviorTimer -= dt;
    if (this.behaviorTimer <= 0) {
      this.behaviorState = 'walking';
      this.speed = this.baseSpeed;
      if (this.headGroup) this.headGroup.rotation.x = 0;
    }
  }

  private updatePhoto(dt: number): void {
    // Tourist "taking a photo" — stand still, slight camera bob
    if (this.headGroup) {
      this.headGroup.rotation.x = -0.2 + Math.sin(performance.now() * 0.003) * 0.05;
    }

    this.behaviorTimer -= dt;
    if (this.behaviorTimer <= 0) {
      this.behaviorState = 'walking';
      this.speed = this.baseSpeed;
      if (this.headGroup) this.headGroup.rotation.x = 0;
    }
  }

  private updatePhone(dt: number): void {
    // Business person checking phone — stand still, head down
    this.behaviorTimer -= dt;
    if (this.behaviorTimer <= 0) {
      this.behaviorState = 'walking';
      this.speed = this.baseSpeed;
      if (this.headGroup) this.headGroup.rotation.x = 0;
    }
  }

  private updateLegAnimation(dt: number): void {
    if (this.isModelBased || !this.legLeft || !this.legRight) return;

    const isMoving = this.behaviorState === 'walking' || this.behaviorState === 'fleeing';
    if (isMoving) {
      const animSpeed = this.behaviorState === 'fleeing' ? 12 : 6;
      this.walkPhase += dt * animSpeed;
      const swing = Math.sin(this.walkPhase) * 0.4;
      this.legLeft.rotation.x = swing;
      this.legRight.rotation.x = -swing;
    } else {
      this.legLeft.rotation.x *= 0.9;
      this.legRight.rotation.x *= 0.9;
    }
  }

  /** Called when the bird flies through this NPC — lighter than onHit */
  onScatter(birdDirection: THREE.Vector3, birdSpeed: number): void {
    if (this.isHit || this.isScattered || this.isGrabbed) return;

    this.isScattered = true;
    this.scatterTimer = NPC_CONFIG.SCATTER_COOLDOWN;
    this.scatterCooldown = NPC_CONFIG.SCATTER_COOLDOWN;

    // Knockback perpendicular to bird's flight path (bowling pin effect)
    // Add some randomness so NPCs scatter outward in different directions
    const sideways = new THREE.Vector3(-birdDirection.z, 0, birdDirection.x);
    const randomSide = Math.random() < 0.5 ? 1 : -1;
    const speedScale = Math.min(birdSpeed / 50, 2.0); // Faster bird = bigger scatter

    this.knockbackVel.set(
      (sideways.x * randomSide + (Math.random() - 0.5) * 0.5) * NPC_CONFIG.SCATTER_KNOCKBACK * speedScale,
      0,
      (sideways.z * randomSide + (Math.random() - 0.5) * 0.5) * NPC_CONFIG.SCATTER_KNOCKBACK * speedScale,
    );
    this.baseY = this.mesh.position.y;
    this.jumpVel = NPC_CONFIG.SCATTER_JUMP * (0.8 + Math.random() * 0.4);

    // Spin direction matches scatter direction
    this.scatterSpinSpeed = NPC_CONFIG.SCATTER_SPIN_SPEED * randomSide * speedScale;

    // Squash/stretch for impact feel
    this.mesh.scale.set(1.3, 0.6, 1.3);
    setTimeout(() => { if (!this.shouldDespawn) this.mesh.scale.set(0.9, 1.15, 0.9); }, 200);
    setTimeout(() => { if (!this.shouldDespawn) this.mesh.scale.set(1, 1, 1); }, 450);
  }

  onHit(): { coins: number; heat: number; multiplierBonus: number } {
    this.isHit = true;
    this.hitTimer = NPC_CONFIG.HIT_FREEZE_TIME;

    if (!this.isModelBased) {
      this.bodyMaterial.color.setHex(0xff0000);
    }

    const coins = this.coinValue;
    const heat = this.heatValue;

    // Big squash/stretch — dramatic impact feel
    this.mesh.scale.set(1.6, 0.4, 1.6);
    setTimeout(() => { this.mesh.scale.set(0.85, 1.2, 0.85); }, 400);
    setTimeout(() => { this.mesh.scale.set(1, 1, 1); }, 650);

    // Bigger knockback + higher jump
    this.baseY = this.mesh.position.y;
    this.knockbackVel.set(
      (Math.random() - 0.5) * 10,
      0,
      (Math.random() - 0.5) * 10,
    );
    this.jumpVel = 8;

    this.spawnAngryBurst();

    return { coins, heat, multiplierBonus: this.multiplierBonus };
  }

  /** Add a poop blob stuck to the NPC's body surface */
  addPoopBlob(): boolean {
    if (this.poopBlobs.length >= NPC.MAX_POOP_BLOBS) return false;

    const blob = new THREE.Mesh(NPC.poopBlobGeo, NPC.poopBlobMat);

    // Random position on NPC body surface using cylindrical coordinates
    const angle = Math.random() * Math.PI * 2;
    const y = 0.15 + Math.random() * 2.1; // feet to top of head

    // Body radius varies with height to follow the NPC shape
    let radius: number;
    if (y < 0.5) radius = 0.1;          // legs — narrow
    else if (y < 1.7) radius = 0.35;    // torso — widest
    else radius = 0.22;                  // head — smaller

    blob.position.set(
      Math.cos(angle) * radius,
      y,
      Math.sin(angle) * radius,
    );

    // Vary blob size for organic look
    const scale = 0.8 + Math.random() * 0.7;
    blob.scale.setScalar(scale);
    blob.frustumCulled = false;

    this.mesh.add(blob);
    this.poopBlobs.push(blob);
    return true;
  }

  getPoopCount(): number {
    return this.poopBlobs.length;
  }

  private spawnAngryBurst(): void {
    if (this.angrySprite) {
      this.mesh.remove(this.angrySprite);
    }
    const mat = new THREE.SpriteMaterial({
      map: getAngryTexture(),
      transparent: true,
      depthTest: false,
    });
    this.angrySprite = new THREE.Sprite(mat);
    this.angrySprite.scale.set(1.2, 1.2, 1);
    this.angrySprite.position.set(0, 2.2, 0);
    this.angryAge = 0;
    this.mesh.add(this.angrySprite);
  }

  private switchAnimation(newAction: THREE.AnimationAction | null): void {
    if (!newAction || newAction === this.currentAction) return;
    if (this.currentAction) {
      this.currentAction.fadeOut(0.3);
    }
    newAction.reset().fadeIn(0.3).play();
    this.currentAction = newAction;
  }
}
