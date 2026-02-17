import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { clamp, lerp } from '../utils/MathUtils';
import { AssetLoader } from '../systems/AssetLoader';
import { createToonMaterial, convertToToon } from '../rendering/ToonUtils';

// ─── Model type flag ────────────────────────────────────────────
// Attached to bird.userData so animation functions know which path to take.
export type BirdModelType = 'procedural' | 'glb';

// ─── Expected GLB animation clip names ──────────────────────────
// If your GLB contains clips with these names, they'll be picked up automatically.
// Alternatives are searched in order (first match wins).
const ANIM_FLY   = ['fly', 'flight', 'flap', 'flying'];
const ANIM_GLIDE = ['glide', 'soar', 'gliding'];
const ANIM_IDLE  = ['idle', 'rest', 'standing'];
const ANIM_DIVE  = ['dive', 'diving', 'swoop'];
const ANIM_WALK  = ['walk', 'walking', 'ground'];

// ─── Procedural bird (unchanged original) ───────────────────────

export function createBirdModel(): THREE.Group {
  const bird = new THREE.Group();
  bird.userData.modelType = 'procedural' as BirdModelType;

  // Seagull colors
  const bodyMat = createToonMaterial(0xf8f8f8); // Bright white body
  const wingMat = createToonMaterial(0x708090, { side: THREE.DoubleSide }); // Slate gray wings (classic seagull pattern)
  const beakMat = createToonMaterial(0xffcc00); // Yellow beak
  const beakSpotMat = createToonMaterial(0xff4500); // Orange-red spot
  const eyeMat = createToonMaterial(0x111111);

  // Body — tapered ellipsoid via scaled sphere
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 10, 8),
    bodyMat,
  );
  body.scale.set(0.6, 0.5, 1.2);
  bird.add(body);

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 10, 8),
    bodyMat,
  );
  head.position.set(0, 0.2, -0.7);
  head.name = 'head';
  bird.add(head);

  // Beak
  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.3, 4),
    beakMat,
  );
  beak.rotation.x = -Math.PI / 2;
  beak.position.set(0, 0.15, -1.0);
  bird.add(beak);

  // Red spot on beak (characteristic seagull marking)
  const beakSpot = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 6, 4),
    beakSpotMat,
  );
  beakSpot.position.set(0, 0.12, -0.95);
  bird.add(beakSpot);

  // Eyes
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 6, 4),
      eyeMat,
    );
    eye.position.set(side * 0.15, 0.3, -0.8);
    bird.add(eye);
  }

  // Wings
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(1.5, 0.2);
  wingShape.lineTo(1.3, -0.1);
  wingShape.lineTo(0, -0.15);
  wingShape.closePath();
  const wingGeo = new THREE.ShapeGeometry(wingShape);

  const leftWing = new THREE.Mesh(wingGeo, wingMat);
  leftWing.position.set(0.2, 0.05, -0.1);
  leftWing.rotation.y = -0.2;
  leftWing.name = 'leftWing';
  bird.add(leftWing);

  const rightWing = new THREE.Mesh(wingGeo, wingMat);
  rightWing.position.set(-0.2, 0.05, -0.1);
  rightWing.rotation.y = 0.2;
  rightWing.scale.x = -1;
  rightWing.name = 'rightWing';
  bird.add(rightWing);

  // Tail
  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(0.15, 0.4, 4),
    bodyMat,
  );
  tail.rotation.x = Math.PI / 2 + 0.3;
  tail.position.set(0, 0.1, 0.65);
  tail.name = 'tail';
  bird.add(tail);

  // Scale the whole bird up
  bird.scale.setScalar(1.5);

  return bird;
}

// ─── GLB bird loader ────────────────────────────────────────────

/**
 * Attempt to load the real seagull GLB model.
 * Returns null if the file doesn't exist / fails to load.
 *
 * Uses AssetLoader directly (not AssetRegistry.load) to avoid
 * Object3D.clone() which breaks SkinnedMesh skeleton bindings.
 * For skinned meshes we use SkeletonUtils.clone() instead.
 *
 * The returned group is structured so the existing animation functions
 * still work:
 *   - userData.modelType = 'glb'
 *   - userData.mixer = AnimationMixer (if model has animation clips)
 *   - userData.animations = { fly?, glide?, idle?, dive?, walk? }
 *   - Scaled to match the procedural bird's bounding size (~1.5 units)
 */
export async function loadBirdGLB(
  _assetKey = 'bird.seagull',
): Promise<THREE.Group | null> {
  const modelPath = '/models/characters/bird/seagull.glb';
  const loader = AssetLoader.getInstance();

  let obj: THREE.Object3D;
  let clips: THREE.AnimationClip[];
  try {
    // Load without cloning — we need the original skeleton bindings
    obj = await loader.loadModel(modelPath, false);
    clips = await loader.loadAnimations(modelPath).catch(() => []);
  } catch {
    return null;
  }

  // Use SkeletonUtils.clone for proper skinned mesh support
  const cloned = cloneSkeleton(obj) as THREE.Object3D;

  const bird = new THREE.Group();
  bird.userData.modelType = 'glb' as BirdModelType;

  // Orientation fix: GLB model faces +X, game expects -Z forward.
  // Rotate -90° around Y to align.
  cloned.rotation.y = -Math.PI / 2;

  // Wrap in a pivot so scale/center calculations work on the rotated model
  const pivot = new THREE.Group();
  pivot.add(cloned);
  bird.add(pivot);

  // Normalize scale: fit the model so its bounding box ≈ 1.5 units
  const box = new THREE.Box3().setFromObject(pivot);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0) {
    const targetSize = 0.375;
    const scale = targetSize / maxDim;
    pivot.scale.multiplyScalar(scale);
  }

  // Center the model
  const centeredBox = new THREE.Box3().setFromObject(pivot);
  const center = new THREE.Vector3();
  centeredBox.getCenter(center);
  pivot.position.sub(center);

  // Set up AnimationMixer if the model has animation clips
  if (clips.length > 0) {
    const mixer = new THREE.AnimationMixer(cloned);
    bird.userData.mixer = mixer;

    // Map well-known animation names
    const animations: Record<string, THREE.AnimationAction> = {};
    for (const clip of clips) {
      const name = clip.name.toLowerCase();
      if (!animations.fly && ANIM_FLY.some(n => name.includes(n))) {
        animations.fly = mixer.clipAction(clip);
      } else if (!animations.glide && ANIM_GLIDE.some(n => name.includes(n))) {
        animations.glide = mixer.clipAction(clip);
      } else if (!animations.idle && ANIM_IDLE.some(n => name.includes(n))) {
        animations.idle = mixer.clipAction(clip);
      } else if (!animations.dive && ANIM_DIVE.some(n => name.includes(n))) {
        animations.dive = mixer.clipAction(clip);
      } else if (!animations.walk && ANIM_WALK.some(n => name.includes(n))) {
        animations.walk = mixer.clipAction(clip);
      }
    }

    // Fallback: if no named animations matched, use the first clip as "fly"
    if (Object.keys(animations).length === 0) {
      animations.fly = mixer.clipAction(clips[0]);
    }

    bird.userData.animations = animations;

    // Start with fly animation if available
    if (animations.fly) {
      animations.fly.play();
    } else if (animations.idle) {
      animations.idle.play();
    }
  }

  console.log(`Bird GLB loaded from ${modelPath}`);
  convertToToon(bird);
  return bird;
}

// ─── Hot-swap helper ────────────────────────────────────────────

/**
 * Replace a procedural bird's children with a loaded GLB, preserving
 * the group's position/rotation/scale in the scene graph.
 */
export function swapBirdModel(
  existing: THREE.Group,
  replacement: THREE.Group,
): void {
  // Copy over userData from replacement
  existing.userData.modelType = replacement.userData.modelType;
  existing.userData.mixer = replacement.userData.mixer;
  existing.userData.animations = replacement.userData.animations;

  // Remove old children
  while (existing.children.length > 0) {
    const child = existing.children[0];
    existing.remove(child);
    // Dispose geometry/materials
    child.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.geometry?.dispose();
        if (Array.isArray(node.material)) {
          node.material.forEach(m => m.dispose());
        } else {
          node.material?.dispose();
        }
      }
    });
  }

  // Move replacement's children into the existing group
  while (replacement.children.length > 0) {
    const child = replacement.children[0];
    replacement.remove(child);
    existing.add(child);
  }
}

// ─── Animation functions ────────────────────────────────────────
// These now handle both procedural and GLB models.

/** Animate wing flap based on elapsed time and speed, or fold when grounded */
export function animateWings(
  bird: THREE.Group,
  time: number,
  speed: number,
  grounded = false,
  isBoosting = false,
): void {
  // GLB path: update the AnimationMixer and cross-fade between clips
  if (bird.userData.modelType === 'glb') {
    const mixer = bird.userData.mixer as THREE.AnimationMixer | undefined;
    const anims = bird.userData.animations as Record<string, THREE.AnimationAction> | undefined;
    if (mixer) {
      // Advance the mixer (time is elapsed total, we need dt — stored on userData)
      const dt = bird.userData._lastTime !== undefined ? time - bird.userData._lastTime : 0.016;
      bird.userData._lastTime = time;
      mixer.update(dt);

      // Cross-fade between fly/walk/idle based on state
      if (anims) {
        if (grounded && anims.walk) {
          fadeToAction(anims, 'walk');
        } else if (!grounded && speed > 20 && anims.fly) {
          fadeToAction(anims, 'fly');
        } else if (!grounded && anims.glide) {
          fadeToAction(anims, 'glide');
        } else if (anims.fly) {
          fadeToAction(anims, 'fly');
        }
      }
    }
    return;
  }

  // Procedural path (original code)
  const leftWing = bird.getObjectByName('leftWing') as THREE.Mesh | undefined;
  const rightWing = bird.getObjectByName('rightWing') as THREE.Mesh | undefined;

  if (grounded) {
    if (leftWing) leftWing.rotation.z = -0.3;
    if (rightWing) rightWing.rotation.z = 0.3;
  } else {
    // Flap cartoonishly fast when boosting
    const boostFlapMultiplier = isBoosting ? 20.0 : 1.0;
    const flapSpeed = (3 + speed * 0.05) * boostFlapMultiplier;
    const flapAmplitude = 0.4;
    const flap = Math.sin(time * flapSpeed) * flapAmplitude;

    if (leftWing) leftWing.rotation.z = flap;
    if (rightWing) rightWing.rotation.z = -flap;
  }
}

/**
 * Idle animations — called after animateWings, adds personality when
 * the player hasn't touched any input for a while.
 *
 * Tiers (all fade in gradually, never jarring):
 *   5s+  — Look around (head turns left/right)
 *  15s+  — Preening (head bobs, wings ruffle)
 *  30s+  — Dozing off (head droops, occasional micro-nod)
 *
 * @param blend  0–1 smooth ramp (fast out on input, slow in on idle)
 */
export function animateIdle(
  bird: THREE.Group,
  time: number,
  idleTime: number,
  blend: number,
): void {
  // GLB path: cross-fade to idle animation
  if (bird.userData.modelType === 'glb') {
    const anims = bird.userData.animations as Record<string, THREE.AnimationAction> | undefined;
    if (anims?.idle && blend > 0.5) {
      fadeToAction(anims, 'idle');
    }
    return;
  }

  // Procedural path (original code)
  const head = bird.getObjectByName('head') as THREE.Mesh | undefined;
  const tail = bird.getObjectByName('tail') as THREE.Mesh | undefined;
  const leftWing = bird.getObjectByName('leftWing') as THREE.Mesh | undefined;
  const rightWing = bird.getObjectByName('rightWing') as THREE.Mesh | undefined;

  const t1 = clamp((idleTime - 5) / 3, 0, 1);
  const t2 = clamp((idleTime - 15) / 3, 0, 1);
  const t3 = clamp((idleTime - 30) / 5, 0, 1);

  if (head) {
    const lookY = Math.sin(time * 0.5) * 0.4 * t1;
    const preenX = Math.sin(time * 0.7) * 0.15 * t2;
    const droopBase = 0.3 * t3;
    const nodSnap = Math.pow(Math.max(0, Math.sin(time * 0.15)), 12) * 0.2 * t3;
    const dozeX = droopBase - nodSnap;
    const finalX = t3 > 0 ? lerp(preenX, dozeX, t3) : preenX;
    const finalY = lookY * (1 - t3 * 0.8);
    head.rotation.x = finalX * blend;
    head.rotation.y = finalY * blend;
  }

  if (t2 > 0 && leftWing && rightWing) {
    const burst = Math.pow(Math.max(0, Math.sin(time * 0.25)), 4);
    const ruffle = Math.sin(time * 1.5) * burst * 0.08 * t2 * blend;
    leftWing.rotation.z += ruffle;
    rightWing.rotation.z -= ruffle;
  }

  if (tail) {
    const wagSpeed = t3 > 0 ? 0.4 : 0.7;
    tail.rotation.z = Math.sin(time * wagSpeed) * 0.12 * t1 * blend;
  }
}

/** Update bird body color based on equipped skin cosmetic */
export function updateBirdColor(bird: THREE.Group, color: number): void {
  if (bird.userData.modelType === 'glb') {
    // For GLB models, tint all MeshStandardMaterial instances
    bird.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshToonMaterial) {
        child.material.color.setHex(color);
      }
    });
    return;
  }

  // Procedural path (original code)
  bird.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const isWing = child === bird.getObjectByName('leftWing') || child === bird.getObjectByName('rightWing');
      if (!isWing && child.material instanceof THREE.MeshToonMaterial) {
        if (child.material.color.getHex() > 0x500000) {
          child.material.color.setHex(color);
        }
      }
    }
  });
}

// ─── Internal helpers ───────────────────────────────────────────

let _currentAction: string | undefined;

function fadeToAction(
  anims: Record<string, THREE.AnimationAction>,
  name: string,
  duration = 0.3,
): void {
  if (_currentAction === name) return;
  const prev = _currentAction ? anims[_currentAction] : undefined;
  const next = anims[name];
  if (!next) return;

  if (prev) {
    prev.fadeOut(duration);
  }
  next.reset().fadeIn(duration).play();
  _currentAction = name;
}
