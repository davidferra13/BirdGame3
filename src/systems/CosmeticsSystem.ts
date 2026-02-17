import * as THREE from 'three';
import { COSMETICS } from '../utils/Constants';

export type SkinId = 'default' | 'pigeon' | 'parrot' | 'crow' | 'golden' | 'flamingo' | 'phoenix';
export type TrailId = 'none' | 'sparkle' | 'smoke' | 'rainbow' | 'fire' | 'lightning';
export type SplatId = 'default' | 'star' | 'splatter' | 'confetti' | 'paint' | 'explosion';

export type CosmeticCurrency = 'coins' | 'feathers' | 'worms' | 'golden_eggs';

export interface CosmeticItem {
  id: string;
  name: string;
  category: 'skin' | 'trail' | 'splat' | 'title';
  cost: number;
  currency: CosmeticCurrency;
  unlockLevel: number;
  owned: boolean;
}

const ALL_COSMETICS: CosmeticItem[] = [
  // === Skins ===
  // Coins (common)
  { id: 'skin_default', name: 'Seagull', category: 'skin', cost: 0, currency: 'coins', unlockLevel: 1, owned: true },
  { id: 'skin_pigeon', name: 'Pigeon', category: 'skin', cost: 500, currency: 'coins', unlockLevel: 5, owned: false },
  { id: 'skin_parrot', name: 'Parrot', category: 'skin', cost: 1500, currency: 'coins', unlockLevel: 10, owned: false },
  { id: 'skin_crow', name: 'Crow', category: 'skin', cost: 3000, currency: 'coins', unlockLevel: 20, owned: false },
  // Worms (uncommon)
  { id: 'skin_flamingo', name: 'Flamingo', category: 'skin', cost: 150, currency: 'worms', unlockLevel: 12, owned: false },
  // Feathers (rare)
  { id: 'skin_golden', name: 'Golden Eagle', category: 'skin', cost: 50, currency: 'feathers', unlockLevel: 30, owned: false },
  // Golden Eggs (legendary)
  { id: 'skin_phoenix', name: 'Phoenix', category: 'skin', cost: 5, currency: 'golden_eggs', unlockLevel: 35, owned: false },

  // === Trails ===
  // Coins (common)
  { id: 'trail_none', name: 'None', category: 'trail', cost: 0, currency: 'coins', unlockLevel: 1, owned: true },
  { id: 'trail_sparkle', name: 'Sparkle', category: 'trail', cost: 800, currency: 'coins', unlockLevel: 8, owned: false },
  { id: 'trail_smoke', name: 'Smoke', category: 'trail', cost: 1200, currency: 'coins', unlockLevel: 15, owned: false },
  // Worms (uncommon)
  { id: 'trail_fire', name: 'Fire', category: 'trail', cost: 100, currency: 'worms', unlockLevel: 10, owned: false },
  // Feathers (rare)
  { id: 'trail_rainbow', name: 'Rainbow', category: 'trail', cost: 30, currency: 'feathers', unlockLevel: 25, owned: false },
  // Golden Eggs (legendary)
  { id: 'trail_lightning', name: 'Lightning', category: 'trail', cost: 3, currency: 'golden_eggs', unlockLevel: 30, owned: false },

  // === Splats ===
  // Coins (common)
  { id: 'splat_default', name: 'Standard', category: 'splat', cost: 0, currency: 'coins', unlockLevel: 1, owned: true },
  { id: 'splat_star', name: 'Star Burst', category: 'splat', cost: 600, currency: 'coins', unlockLevel: 7, owned: false },
  { id: 'splat_splatter', name: 'Big Splat', category: 'splat', cost: 1000, currency: 'coins', unlockLevel: 12, owned: false },
  // Worms (uncommon)
  { id: 'splat_paint', name: 'Paint Splash', category: 'splat', cost: 80, currency: 'worms', unlockLevel: 9, owned: false },
  // Feathers (rare)
  { id: 'splat_confetti', name: 'Confetti', category: 'splat', cost: 25, currency: 'feathers', unlockLevel: 18, owned: false },
  // Golden Eggs (legendary)
  { id: 'splat_explosion', name: 'Explosion', category: 'splat', cost: 2, currency: 'golden_eggs', unlockLevel: 25, owned: false },
];

export class CosmeticsSystem {
  readonly items: CosmeticItem[] = ALL_COSMETICS.map(c => ({ ...c }));

  equippedSkin: SkinId = 'default';
  equippedTrail: TrailId = 'none';
  equippedSplat: SplatId = 'default';

  // Trail particle system
  private trailPoints: THREE.Vector3[] = [];
  private trailLine: THREE.Line | null = null;
  private trailMaterial: THREE.LineBasicMaterial;

  constructor() {
    this.trailMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
    });
  }

  purchase(
    itemId: string,
    balances: { coins: number; feathers: number; worms: number; goldenEggs: number },
  ): { success: boolean; cost: number; currency: CosmeticCurrency } {
    const item = this.items.find(i => i.id === itemId);
    if (!item || item.owned) return { success: false, cost: 0, currency: 'coins' };

    const balanceMap: Record<CosmeticCurrency, number> = {
      coins: balances.coins,
      feathers: balances.feathers,
      worms: balances.worms,
      golden_eggs: balances.goldenEggs,
    };

    if (balanceMap[item.currency] >= item.cost) {
      item.owned = true;
      return { success: true, cost: item.cost, currency: item.currency };
    }

    return { success: false, cost: 0, currency: item.currency };
  }

  equip(itemId: string): boolean {
    const item = this.items.find(i => i.id === itemId);
    if (!item || !item.owned) return false;

    if (item.category === 'skin') this.equippedSkin = itemId.replace('skin_', '') as SkinId;
    if (item.category === 'trail') this.equippedTrail = itemId.replace('trail_', '') as TrailId;
    if (item.category === 'splat') this.equippedSplat = itemId.replace('splat_', '') as SplatId;
    return true;
  }

  getBirdColor(): number {
    switch (this.equippedSkin) {
      case 'pigeon': return 0x888899;
      case 'parrot': return 0x33cc33;
      case 'crow': return 0x222222;
      case 'golden': return 0xffcc00;
      case 'flamingo': return 0xff69b4;
      case 'phoenix': return 0xff4500;
      default: return 0xfafafa;
    }
  }

  getTrailColor(): number {
    switch (this.equippedTrail) {
      case 'sparkle': return 0xffff88;
      case 'smoke': return 0xaaaaaa;
      case 'rainbow': return 0xff00ff;
      case 'fire': return 0xff6600;
      case 'lightning': return 0x00ccff;
      default: return 0xffffff;
    }
  }

  initTrail(scene: THREE.Scene): void {
    if (this.equippedTrail === 'none') return;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(COSMETICS.TRAIL_LENGTH * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.trailMaterial.color.setHex(this.getTrailColor());
    this.trailLine = new THREE.Line(geometry, this.trailMaterial);
    scene.add(this.trailLine);
  }

  updateTrail(birdPosition: THREE.Vector3): void {
    if (this.equippedTrail === 'none' || !this.trailLine) return;

    this.trailPoints.unshift(birdPosition.clone());
    if (this.trailPoints.length > COSMETICS.TRAIL_LENGTH) {
      this.trailPoints.pop();
    }

    const positions = this.trailLine.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < COSMETICS.TRAIL_LENGTH; i++) {
      if (i < this.trailPoints.length) {
        positions.setXYZ(i, this.trailPoints[i].x, this.trailPoints[i].y, this.trailPoints[i].z);
      }
    }
    positions.needsUpdate = true;
    this.trailLine.geometry.setDrawRange(0, this.trailPoints.length);
  }

  resetTrail(scene: THREE.Scene): void {
    // Remove old trail
    if (this.trailLine) {
      scene.remove(this.trailLine);
      this.trailLine.geometry.dispose();
      this.trailLine = null;
    }
    // Clear trail points
    this.trailPoints = [];
    // Create new trail with updated settings
    this.initTrail(scene);
  }
}
