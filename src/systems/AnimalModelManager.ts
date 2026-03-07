import * as THREE from 'three';
import { AssetLoader } from './AssetLoader';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export interface AnimalModelConfig {
  key: string;
  path: string;
  scale: number;
  yOffset: number;
  rotationY: number;
}

const ANIMAL_CONFIGS: AnimalModelConfig[] = [
  // Cats
  { key: 'animal.cat.bengal', path: '/models/animals/cats/bengal.glb', scale: 0.8, yOffset: 0, rotationY: 0 },
  // Dogs
  { key: 'animal.dog.bulldog', path: '/models/animals/dogs/bulldog.glb', scale: 0.8, yOffset: 0, rotationY: 0 },
  { key: 'animal.dog.french_bulldog', path: '/models/animals/dogs/french_bulldog.glb', scale: 0.8, yOffset: 0, rotationY: 0 },
  { key: 'animal.dog.golden_retriever', path: '/models/animals/dogs/golden_retriever.glb', scale: 0.8, yOffset: 0, rotationY: 0 },
  { key: 'animal.dog.pitbull', path: '/models/animals/dogs/pitbull.glb', scale: 0.8, yOffset: 0, rotationY: 0 },
  { key: 'animal.dog.pug', path: '/models/animals/dogs/pug.glb', scale: 0.8, yOffset: 0, rotationY: 0 },
  { key: 'animal.dog.rottweiler', path: '/models/animals/dogs/rottweiler.glb', scale: 0.8, yOffset: 0, rotationY: 0 },
  { key: 'animal.dog.chihuahua', path: '/models/animals/dogs/chihuahua.glb', scale: 0.8, yOffset: 0, rotationY: 0 },
  // Horses
  { key: 'animal.horse.white', path: '/models/animals/horses/white_horse.glb', scale: 2.0, yOffset: 0, rotationY: 0 },
  // Rodents
  { key: 'animal.rodent.rat', path: '/models/animals/rodents/rat.glb', scale: 0.4, yOffset: 0, rotationY: 0 },
  // Misc
  { key: 'animal.misc.elephant', path: '/models/animals/misc/elephant.glb', scale: 4.0, yOffset: 0, rotationY: 0 },
];

// Target bounding sizes for each animal category (in world units)
const TARGET_SIZES: Record<string, number> = {
  cat: 0.8,      // Small — matches procedural cat
  dog: 1.0,      // Medium — matches procedural dog
  horse: 2.5,    // Large — matches procedural horse
  rat: 0.3,      // Tiny
  elephant: 5.0,  // Huge
};

const DOG_BREED_KEYS = [
  'animal.dog.bulldog',
  'animal.dog.french_bulldog',
  'animal.dog.golden_retriever',
  'animal.dog.pitbull',
  'animal.dog.pug',
  'animal.dog.rottweiler',
  'animal.dog.chihuahua',
];

function getAnimalCategory(key: string): string {
  if (key.includes('.cat.')) return 'cat';
  if (key.includes('.dog.')) return 'dog';
  if (key.includes('.horse.')) return 'horse';
  if (key.includes('.rodent.')) return 'rat';
  if (key.includes('.elephant') || key.includes('.misc.')) return 'elephant';
  return 'dog'; // fallback
}

export class AnimalModelManager {
  private static instance: AnimalModelManager;
  private configs: Map<string, AnimalModelConfig> = new Map();
  private templates: Map<string, THREE.Object3D> = new Map();
  private loadPromises: Map<string, Promise<THREE.Object3D | null>> = new Map();
  private _ready = false;

  private constructor() {
    for (const config of ANIMAL_CONFIGS) {
      this.configs.set(config.key, config);
    }
  }

  static getInstance(): AnimalModelManager {
    if (!AnimalModelManager.instance) {
      AnimalModelManager.instance = new AnimalModelManager();
    }
    return AnimalModelManager.instance;
  }

  isReady(): boolean { return this._ready; }

  async preloadAll(): Promise<void> {
    const promises = ANIMAL_CONFIGS.map(c => this.loadTemplate(c.key));
    await Promise.allSettled(promises);
    this._ready = true;
    console.log(`AnimalModelManager: ${this.templates.size}/${ANIMAL_CONFIGS.length} models loaded`);
  }

  private async loadTemplate(key: string): Promise<THREE.Object3D | null> {
    // Dedup in-flight loads
    if (this.loadPromises.has(key)) return this.loadPromises.get(key)!;

    const config = this.configs.get(key);
    if (!config) return null;

    const promise = (async () => {
      const loader = AssetLoader.getInstance();
      try {
        // Load without cloning — we keep the original as template
        const obj = await loader.loadModel(config.path, false);

        // Normalise: compute bounding box, scale to target size, centre at origin
        const category = getAnimalCategory(key);
        const targetSize = TARGET_SIZES[category] ?? 1.0;

        const box = new THREE.Box3().setFromObject(obj);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
          const s = targetSize / maxDim;
          obj.scale.multiplyScalar(s);
        }

        // Re-compute box after scale
        const centeredBox = new THREE.Box3().setFromObject(obj);
        const center = new THREE.Vector3();
        centeredBox.getCenter(center);
        // Shift so center-bottom is at origin (y=0 is ground)
        const min = new THREE.Vector3();
        centeredBox.getSize(min); // reuse vec
        centeredBox.min; // we want min-y
        obj.position.set(-center.x, -centeredBox.min.y, -center.z);

        // Apply orientation fix
        if (config.rotationY !== 0) {
          obj.rotation.y += config.rotationY;
        }

        this.templates.set(key, obj);
        return obj;
      } catch (err) {
        console.warn(`AnimalModelManager: failed to load ${key}`, err);
        return null;
      }
    })();

    this.loadPromises.set(key, promise);
    return promise;
  }

  /**
   * Get a clone of a loaded animal model. Returns null if not yet loaded.
   */
  async getModel(key: string): Promise<THREE.Group | null> {
    // Ensure template is loaded
    if (!this.templates.has(key)) {
      await this.loadTemplate(key);
    }

    const template = this.templates.get(key);
    if (!template) return null;

    // Use SkeletonUtils.clone for proper skinned mesh support
    const cloned = SkeletonUtils.clone(template) as THREE.Object3D;

    // Wrap in a Group for consistent interface
    const group = new THREE.Group();
    group.add(cloned);

    // Copy animations if present
    const loader = AssetLoader.getInstance();
    const config = this.configs.get(key);
    if (config) {
      const clips = await loader.loadAnimations(config.path).catch(() => [] as THREE.AnimationClip[]);
      if (clips.length > 0) {
        const mixer = new THREE.AnimationMixer(cloned);
        group.userData.mixer = mixer;

        // Auto-play first animation by default
        const actions: Record<string, THREE.AnimationAction> = {};
        for (const clip of clips) {
          const name = clip.name.toLowerCase();
          if (name.includes('walk') || name.includes('run') || name.includes('trot')) {
            actions.walk = mixer.clipAction(clip);
          } else if (name.includes('idle') || name.includes('stand') || name.includes('rest')) {
            actions.idle = mixer.clipAction(clip);
          } else if (name.includes('gallop') || name.includes('sprint')) {
            actions.run = mixer.clipAction(clip);
          }
        }
        // Fallback: first clip as idle
        if (Object.keys(actions).length === 0 && clips.length > 0) {
          actions.idle = mixer.clipAction(clips[0]);
        }

        group.userData.animations = actions;

        // Start idle or walk by default
        const startAction = actions.idle ?? actions.walk ?? Object.values(actions)[0];
        if (startAction) {
          startAction.play();
        }
      }
    }

    return group;
  }

  /** Pick a random dog breed key */
  getRandomDogBreed(): string {
    return DOG_BREED_KEYS[Math.floor(Math.random() * DOG_BREED_KEYS.length)];
  }

  /** Get all config keys */
  getAllKeys(): string[] {
    return Array.from(this.configs.keys());
  }
}
