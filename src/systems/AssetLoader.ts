import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { convertToToon } from '../rendering/ToonUtils';

/**
 * Asset loading progress callback
 */
export interface LoadProgress {
  url: string;
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * Centralized asset loader with caching, progress tracking, and Draco compression support
 */
export class AssetLoader {
  private static instance: AssetLoader;

  private gltfLoader: GLTFLoader;
  private dracoLoader: DRACOLoader;

  // Caches
  private modelCache: Map<string, THREE.Object3D> = new Map();
  private animationCache: Map<string, THREE.AnimationClip[]> = new Map();
  private textureCache: Map<string, THREE.Texture> = new Map();

  // Loading state
  private loadingQueue: Set<string> = new Set();
  private loadedAssets: Set<string> = new Set();

  // Progress tracking
  private onProgressCallback?: (progress: LoadProgress) => void;
  private onLoadCallback?: (url: string) => void;
  private onErrorCallback?: (url: string, error: Error) => void;

  private constructor() {
    // Initialize GLTF Loader
    this.gltfLoader = new GLTFLoader();

    // Initialize Draco Loader (for compressed models)
    this.dracoLoader = new DRACOLoader();
    // Use CDN for Draco decoder (alternative: host locally in /public/draco/)
    this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    this.dracoLoader.preload();

    // Attach Draco loader to GLTF loader
    this.gltfLoader.setDRACOLoader(this.dracoLoader);

    console.log('✅ AssetLoader initialized with Draco compression support');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AssetLoader {
    if (!AssetLoader.instance) {
      AssetLoader.instance = new AssetLoader();
    }
    return AssetLoader.instance;
  }

  /**
   * Set progress callback
   */
  public setOnProgress(callback: (progress: LoadProgress) => void): void {
    this.onProgressCallback = callback;
  }

  /**
   * Set load complete callback
   */
  public setOnLoad(callback: (url: string) => void): void {
    this.onLoadCallback = callback;
  }

  /**
   * Set error callback
   */
  public setOnError(callback: (url: string, error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  /**
   * Load a GLTF/GLB model
   * @param url - Path to the model file
   * @param clone - If true, returns a clone (default: true)
   * @returns Promise with the loaded model
   */
  public async loadModel(url: string, clone: boolean = true): Promise<THREE.Object3D> {
    // Check cache first
    if (this.modelCache.has(url)) {
      const cached = this.modelCache.get(url)!;
      console.log(`✅ Model loaded from cache: ${url}`);
      const result = clone ? cached.clone() : cached;

      // Ensure all geometries have bounding volumes computed
      if (clone) {
        const toRemove: THREE.Object3D[] = [];
        result.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            // Keep frustum culling enabled so off-screen meshes are skipped.
            child.frustumCulled = true;

            // Mark meshes without geometry for removal
            if (!child.geometry) {
              console.warn(`⚠️ Mesh without geometry in cached model: ${url}`, child.name);
              toRemove.push(child);
              return;
            }
            // Compute bounding volumes
            try {
              if (!child.geometry.boundingSphere) {
                child.geometry.computeBoundingSphere();
              }
              if (!child.geometry.boundingBox) {
                child.geometry.computeBoundingBox();
              }
            } catch (e) {
              console.error('Error computing bounds:', e);
              toRemove.push(child);
            }
          }
        });
        // Remove problematic meshes after traversal
        toRemove.forEach(obj => obj.parent?.remove(obj));
      }

      return result;
    }

    // Check if already loading
    if (this.loadingQueue.has(url)) {
      // Wait for existing load to complete
      return this.waitForLoad(url, clone);
    }

    // Start loading
    this.loadingQueue.add(url);

    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf: GLTF) => {
          // Ensure all geometries have bounding volumes computed and keep frustum culling on
          gltf.scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.frustumCulled = true;

              if (child.geometry) {
                if (!child.geometry.boundingSphere) {
                  child.geometry.computeBoundingSphere();
                }
                if (!child.geometry.boundingBox) {
                  child.geometry.computeBoundingBox();
                }
              }
            }
          });

          // Convert all materials to toon shading
          convertToToon(gltf.scene);

          // Cache the model
          this.modelCache.set(url, gltf.scene);

          // Cache animations if present
          if (gltf.animations && gltf.animations.length > 0) {
            this.animationCache.set(url, gltf.animations);
          }

          // Mark as loaded
          this.loadingQueue.delete(url);
          this.loadedAssets.add(url);

          console.log(`✅ Model loaded: ${url}`);
          if (this.onLoadCallback) {
            this.onLoadCallback(url);
          }

          const result = clone ? gltf.scene.clone() : gltf.scene;

          // Ensure cloned object also has bounding volumes computed
          if (clone) {
            const toRemove: THREE.Object3D[] = [];
            result.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.frustumCulled = true;

                // Mark meshes without geometry for removal
                if (!child.geometry) {
                  console.warn(`⚠️ Mesh without geometry in cloned model: ${url}`, child.name);
                  toRemove.push(child);
                  return;
                }
                // Compute bounding volumes
                try {
                  if (!child.geometry.boundingSphere) {
                    child.geometry.computeBoundingSphere();
                  }
                  if (!child.geometry.boundingBox) {
                    child.geometry.computeBoundingBox();
                  }
                } catch (e) {
                  console.error('Error computing bounds:', e);
                  toRemove.push(child);
                }
              }
            });
            // Remove problematic meshes after traversal
            toRemove.forEach(obj => obj.parent?.remove(obj));
          }

          resolve(result);
        },
        (progress: ProgressEvent) => {
          const loadProgress: LoadProgress = {
            url,
            loaded: progress.loaded,
            total: progress.total,
            percentage: progress.total > 0 ? (progress.loaded / progress.total) * 100 : 0,
          };

          if (this.onProgressCallback) {
            this.onProgressCallback(loadProgress);
          }
        },
        (error: unknown) => {
          this.loadingQueue.delete(url);
          const err = error instanceof Error ? error : new Error(String(error));
          console.error(`❌ Error loading model: ${url}`, err);

          if (this.onErrorCallback) {
            this.onErrorCallback(url, err);
          }

          reject(err);
        }
      );
    });
  }

  /**
   * Load animations from a GLTF/GLB file
   */
  public async loadAnimations(url: string): Promise<THREE.AnimationClip[]> {
    // Check cache first
    if (this.animationCache.has(url)) {
      console.log(`✅ Animations loaded from cache: ${url}`);
      return this.animationCache.get(url)!;
    }

    // Load the model (this will cache animations automatically)
    await this.loadModel(url, false);

    return this.animationCache.get(url) || [];
  }

  /**
   * Load a texture
   */
  public async loadTexture(url: string): Promise<THREE.Texture> {
    // Check cache first
    if (this.textureCache.has(url)) {
      console.log(`✅ Texture loaded from cache: ${url}`);
      return this.textureCache.get(url)!;
    }

    return new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader();
      loader.load(
        url,
        (texture) => {
          this.textureCache.set(url, texture);
          console.log(`✅ Texture loaded: ${url}`);
          resolve(texture);
        },
        undefined,
        (error) => {
          const err = error instanceof Error ? error : new Error(String(error));
          console.error(`❌ Error loading texture: ${url}`, err);
          reject(err);
        }
      );
    });
  }

  /**
   * Preload multiple assets
   */
  public async preloadAssets(urls: string[]): Promise<void> {
    console.log(`📦 Preloading ${urls.length} assets...`);

    const promises = urls.map(url => this.loadModel(url, false).catch(err => {
      console.warn(`⚠️ Failed to preload ${url}:`, err);
    }));

    await Promise.all(promises);
    console.log(`✅ Preloading complete`);
  }

  /**
   * Wait for an asset that's currently loading
   */
  private async waitForLoad(url: string, clone: boolean): Promise<THREE.Object3D> {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (this.modelCache.has(url)) {
          clearInterval(checkInterval);
          const model = this.modelCache.get(url)!;
          const result = clone ? model.clone() : model;

          // Ensure cloned object has bounding volumes computed
          if (clone) {
            const toRemove: THREE.Object3D[] = [];
            result.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.frustumCulled = true;

                // Mark meshes without geometry for removal
                if (!child.geometry) {
                  console.warn(`⚠️ Mesh without geometry in waitForLoad: ${url}`, child.name);
                  toRemove.push(child);
                  return;
                }
                // Compute bounding volumes
                try {
                  if (!child.geometry.boundingSphere) {
                    child.geometry.computeBoundingSphere();
                  }
                  if (!child.geometry.boundingBox) {
                    child.geometry.computeBoundingBox();
                  }
                } catch (e) {
                  console.error('Error computing bounds:', e);
                  toRemove.push(child);
                }
              }
            });
            // Remove problematic meshes after traversal
            toRemove.forEach(obj => obj.parent?.remove(obj));
          }

          resolve(result);
        } else if (!this.loadingQueue.has(url)) {
          // Loading failed
          clearInterval(checkInterval);
          reject(new Error(`Failed to load ${url}`));
        }
      }, 100);
    });
  }

  /**
   * Get cache statistics
   */
  public getStats() {
    return {
      modelsInCache: this.modelCache.size,
      animationsInCache: this.animationCache.size,
      texturesInCache: this.textureCache.size,
      currentlyLoading: this.loadingQueue.size,
      totalLoaded: this.loadedAssets.size,
    };
  }

  /**
   * Clear cache (use carefully - will force reload of all assets)
   */
  public clearCache(): void {
    this.modelCache.clear();
    this.animationCache.clear();
    this.textureCache.clear();
    this.loadedAssets.clear();
    console.log('🗑️ Asset cache cleared');
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.dracoLoader.dispose();
    this.clearCache();
  }
}

// Export singleton instance
export const assetLoader = AssetLoader.getInstance();
