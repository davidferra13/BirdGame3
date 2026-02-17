import * as THREE from 'three';
import { AssetLoader } from '../systems/AssetLoader';

// ─── Asset status ───────────────────────────────────────────────
export type AssetStatus = 'placeholder' | 'loading' | 'loaded' | 'error';

export interface AssetEntry {
  /** Unique key, e.g. "bird.seagull", "npc.businessman", "building.office_small" */
  key: string;
  /** Human-readable label */
  label: string;
  /** Category for grouping */
  category: AssetCategory;
  /** Path to the real GLB/texture file (relative to public/) */
  path: string;
  /** Current status */
  status: AssetStatus;
  /** Priority from production checklist */
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** Specs / notes */
  specs?: string;
  /** Loaded Three.js object (cached) */
  loadedObject?: THREE.Object3D;
  /** Loaded animations (cached) */
  loadedAnimations?: THREE.AnimationClip[];
}

export type AssetCategory =
  | 'bird'
  | 'npc'
  | 'building'
  | 'nature'
  | 'prop'
  | 'vehicle'
  | 'food'
  | 'particle'
  | 'trail'
  | 'splat'
  | 'ui'
  | 'audio'
  | 'skybox'
  | 'zone'
  | 'texture';

// ─── The registry ───────────────────────────────────────────────
class AssetRegistryImpl {
  private entries = new Map<string, AssetEntry>();
  private listeners = new Map<string, Array<(entry: AssetEntry) => void>>();

  constructor() {
    this.registerDefaults();
  }

  // ── Public API ──────────────────────────────────────────────

  /** Get an asset entry by key */
  get(key: string): AssetEntry | undefined {
    return this.entries.get(key);
  }

  /** Check if a real (non-placeholder) asset is available */
  isReal(key: string): boolean {
    const entry = this.entries.get(key);
    return entry?.status === 'loaded';
  }

  /** Get all entries, optionally filtered */
  getAll(filter?: { category?: AssetCategory; status?: AssetStatus }): AssetEntry[] {
    let result = Array.from(this.entries.values());
    if (filter?.category) result = result.filter(e => e.category === filter.category);
    if (filter?.status) result = result.filter(e => e.status === filter.status);
    return result;
  }

  /** Get summary stats */
  getStats(): { total: number; placeholder: number; loaded: number; loading: number; error: number } {
    const all = Array.from(this.entries.values());
    return {
      total: all.length,
      placeholder: all.filter(e => e.status === 'placeholder').length,
      loaded: all.filter(e => e.status === 'loaded').length,
      loading: all.filter(e => e.status === 'loading').length,
      error: all.filter(e => e.status === 'error').length,
    };
  }

  /**
   * Attempt to load a real asset. Returns the loaded Object3D or null if
   * the file doesn't exist / fails to load.
   */
  async load(key: string): Promise<THREE.Object3D | null> {
    const entry = this.entries.get(key);
    if (!entry) {
      console.warn(`AssetRegistry: unknown key "${key}"`);
      return null;
    }

    // Already loaded
    if (entry.status === 'loaded' && entry.loadedObject) {
      return entry.loadedObject.clone();
    }

    // Try loading from disk
    entry.status = 'loading';
    try {
      const loader = AssetLoader.getInstance();
      const obj = await loader.loadModel(entry.path, false);
      const anims = await loader.loadAnimations(entry.path).catch(() => []);

      entry.status = 'loaded';
      entry.loadedObject = obj;
      entry.loadedAnimations = anims;

      console.log(`AssetRegistry: loaded "${key}" from ${entry.path}`);
      this.notify(key, entry);
      return obj.clone();
    } catch {
      // File doesn't exist yet — that's fine, stay on placeholder
      entry.status = 'placeholder';
      return null;
    }
  }

  /**
   * Listen for when an asset transitions to "loaded".
   * Returns an unsubscribe function.
   */
  onLoaded(key: string, cb: (entry: AssetEntry) => void): () => void {
    if (!this.listeners.has(key)) this.listeners.set(key, []);
    this.listeners.get(key)!.push(cb);
    return () => {
      const arr = this.listeners.get(key);
      if (arr) {
        const idx = arr.indexOf(cb);
        if (idx >= 0) arr.splice(idx, 1);
      }
    };
  }

  /** Register a new asset entry (or update an existing one) */
  register(entry: Omit<AssetEntry, 'status'> & { status?: AssetStatus }): void {
    this.entries.set(entry.key, { status: 'placeholder', ...entry } as AssetEntry);
  }

  // ── Notifications ───────────────────────────────────────────

  private notify(key: string, entry: AssetEntry): void {
    const cbs = this.listeners.get(key);
    if (cbs) cbs.forEach(cb => cb(entry));
  }

  // ── Default manifest ────────────────────────────────────────

  private registerDefaults(): void {
    // ═══════════════════════════════════════════════════════════
    // CATEGORY: Bird (Player Character)
    // ═══════════════════════════════════════════════════════════
    this.register({
      key: 'bird.seagull',
      label: 'Seagull Base Model',
      category: 'bird',
      path: '/models/characters/bird/seagull.glb',
      priority: 'critical',
      specs: '500-1000 tris, fly/glide/dive/idle/turn animations',
    });
    this.register({
      key: 'bird.skin.pigeon',
      label: 'Pigeon Skin',
      category: 'bird',
      path: '/models/characters/bird/skins/pigeon.glb',
      priority: 'medium',
    });
    this.register({
      key: 'bird.skin.crow',
      label: 'Crow Skin',
      category: 'bird',
      path: '/models/characters/bird/skins/crow.glb',
      priority: 'medium',
    });
    this.register({
      key: 'bird.skin.parrot',
      label: 'Parrot Skin',
      category: 'bird',
      path: '/models/characters/bird/skins/parrot.glb',
      priority: 'medium',
    });
    this.register({
      key: 'bird.skin.cardinal',
      label: 'Red Cardinal Skin',
      category: 'bird',
      path: '/models/characters/bird/skins/cardinal.glb',
      priority: 'medium',
    });
    this.register({
      key: 'bird.skin.bluejay',
      label: 'Blue Jay Skin',
      category: 'bird',
      path: '/models/characters/bird/skins/bluejay.glb',
      priority: 'medium',
    });
    this.register({
      key: 'bird.skin.golden',
      label: 'Golden Eagle Skin',
      category: 'bird',
      path: '/models/characters/bird/skins/golden.glb',
      priority: 'medium',
    });
    this.register({
      key: 'bird.skin.flamingo',
      label: 'Pink Flamingo Skin',
      category: 'bird',
      path: '/models/characters/bird/skins/flamingo.glb',
      priority: 'medium',
    });

    // ═══════════════════════════════════════════════════════════
    // CATEGORY: NPCs
    // ═══════════════════════════════════════════════════════════
    this.register({
      key: 'npc.businessman',
      label: 'Businessman',
      category: 'npc',
      path: '/models/npcs/businessman.glb',
      priority: 'critical',
      specs: '500-1500 tris, walk animation',
    });
    this.register({
      key: 'npc.businesswoman',
      label: 'Businesswoman',
      category: 'npc',
      path: '/models/npcs/businesswoman.glb',
      priority: 'critical',
    });
    this.register({
      key: 'npc.tourist',
      label: 'Tourist',
      category: 'npc',
      path: '/models/npcs/tourist.glb',
      priority: 'high',
    });
    this.register({
      key: 'npc.police',
      label: 'Police Officer',
      category: 'npc',
      path: '/models/npcs/police_officer.glb',
      priority: 'high',
    });
    this.register({
      key: 'npc.performer',
      label: 'Street Performer',
      category: 'npc',
      path: '/models/npcs/performer.glb',
      priority: 'medium',
    });
    this.register({
      key: 'npc.jogger',
      label: 'Jogger',
      category: 'npc',
      path: '/models/npcs/jogger.glb',
      priority: 'high',
    });
    this.register({
      key: 'npc.construction',
      label: 'Construction Worker',
      category: 'npc',
      path: '/models/npcs/construction_worker.glb',
      priority: 'high',
    });

    // ═══════════════════════════════════════════════════════════
    // CATEGORY: Buildings
    // ═══════════════════════════════════════════════════════════
    this.register({
      key: 'building.office_small',
      label: 'Small Office (3-5 stories)',
      category: 'building',
      path: '/models/buildings/office_small.glb',
      priority: 'critical',
      specs: '2000-5000 tris',
    });
    this.register({
      key: 'building.office_medium',
      label: 'Medium Office (6-10 stories)',
      category: 'building',
      path: '/models/buildings/office_medium.glb',
      priority: 'critical',
    });
    this.register({
      key: 'building.skyscraper',
      label: 'Large Skyscraper',
      category: 'building',
      path: '/models/buildings/skyscraper.glb',
      priority: 'critical',
    });
    this.register({
      key: 'building.apartment_lowrise',
      label: 'Low-rise Apartment',
      category: 'building',
      path: '/models/buildings/apartment_lowrise.glb',
      priority: 'critical',
    });
    this.register({
      key: 'building.sanctuary',
      label: 'Sanctuary Building',
      category: 'building',
      path: '/models/buildings/sanctuary.glb',
      priority: 'critical',
      specs: 'Green emissive glow, banking mechanic',
    });

    // ═══════════════════════════════════════════════════════════
    // CATEGORY: Nature
    // ═══════════════════════════════════════════════════════════
    this.register({
      key: 'nature.tree_oak_01',
      label: 'Oak Tree (variation 1)',
      category: 'nature',
      path: '/models/nature/tree_oak_01.glb',
      priority: 'critical',
      specs: '500-1500 tris',
    });
    this.register({
      key: 'nature.tree_oak_02',
      label: 'Oak Tree (variation 2)',
      category: 'nature',
      path: '/models/nature/tree_oak_02.glb',
      priority: 'critical',
    });
    this.register({
      key: 'nature.tree_pine_01',
      label: 'Pine Tree',
      category: 'nature',
      path: '/models/nature/tree_pine_01.glb',
      priority: 'critical',
    });
    this.register({
      key: 'nature.bush_small',
      label: 'Small Bush',
      category: 'nature',
      path: '/models/nature/bush_small.glb',
      priority: 'high',
    });
    this.register({
      key: 'nature.bush_large',
      label: 'Large Bush',
      category: 'nature',
      path: '/models/nature/bush_large.glb',
      priority: 'high',
    });

    // ═══════════════════════════════════════════════════════════
    // CATEGORY: Props
    // ═══════════════════════════════════════════════════════════
    this.register({
      key: 'prop.bench_wooden',
      label: 'Wooden Park Bench',
      category: 'prop',
      path: '/models/props/bench_wooden.glb',
      priority: 'critical',
    });
    this.register({
      key: 'prop.streetlamp',
      label: 'Street Lamp',
      category: 'prop',
      path: '/models/props/streetlamp.glb',
      priority: 'high',
    });
    this.register({
      key: 'prop.trashcan',
      label: 'Trash Can',
      category: 'prop',
      path: '/models/props/trashcan.glb',
      priority: 'high',
    });
    this.register({
      key: 'prop.fountain',
      label: 'Fountain',
      category: 'prop',
      path: '/models/props/fountain.glb',
      priority: 'high',
    });
    this.register({
      key: 'prop.traffic_light',
      label: 'Traffic Light',
      category: 'prop',
      path: '/models/props/traffic_light.glb',
      priority: 'high',
    });

    // ═══════════════════════════════════════════════════════════
    // CATEGORY: Vehicles
    // ═══════════════════════════════════════════════════════════
    this.register({
      key: 'vehicle.sedan',
      label: 'Car - Sedan',
      category: 'vehicle',
      path: '/models/vehicles/car_sedan.glb',
      priority: 'high',
    });
    this.register({
      key: 'vehicle.police_car',
      label: 'Police Car',
      category: 'vehicle',
      path: '/models/vehicles/police_car.glb',
      priority: 'high',
    });

    // ═══════════════════════════════════════════════════════════
    // CATEGORY: Food
    // ═══════════════════════════════════════════════════════════
    this.register({
      key: 'food.sandwich',
      label: 'Sandwich',
      category: 'food',
      path: '/models/food/sandwich.glb',
      priority: 'critical',
    });
    this.register({
      key: 'food.hotdog',
      label: 'Hot Dog',
      category: 'food',
      path: '/models/food/hotdog.glb',
      priority: 'critical',
    });
    this.register({
      key: 'food.icecream',
      label: 'Ice Cream Cone',
      category: 'food',
      path: '/models/food/icecream.glb',
      priority: 'critical',
    });
    this.register({
      key: 'food.coffee',
      label: 'Coffee Cup',
      category: 'food',
      path: '/models/food/coffee.glb',
      priority: 'high',
    });

    // ═══════════════════════════════════════════════════════════
    // CATEGORY: Textures
    // ═══════════════════════════════════════════════════════════
    this.register({
      key: 'texture.grass',
      label: 'Grass (seamless)',
      category: 'texture',
      path: '/textures/grass_seamless.png',
      priority: 'critical',
    });
    this.register({
      key: 'texture.pavement',
      label: 'Pavement (seamless)',
      category: 'texture',
      path: '/textures/pavement_seamless.png',
      priority: 'critical',
    });

    // ═══════════════════════════════════════════════════════════
    // CATEGORY: Skybox
    // ═══════════════════════════════════════════════════════════
    this.register({
      key: 'skybox.day',
      label: 'Daytime Skybox',
      category: 'skybox',
      path: '/textures/skybox/day_px.png',
      priority: 'critical',
      specs: '6 faces, 2048x2048 each',
    });

    // ═══════════════════════════════════════════════════════════
    // CATEGORY: Particles
    // ═══════════════════════════════════════════════════════════
    this.register({
      key: 'particle.splat_default',
      label: 'Poop Splat (default)',
      category: 'particle',
      path: '/textures/particles/splat_default.png',
      priority: 'critical',
    });
    this.register({
      key: 'particle.feather_white',
      label: 'White Feather',
      category: 'particle',
      path: '/textures/particles/feather_white.png',
      priority: 'high',
    });
  }
}

// Singleton
export const AssetRegistry = new AssetRegistryImpl();
