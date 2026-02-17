/**
 * PersistenceService
 * Hybrid persistence layer that routes to Supabase or localStorage based on auth state
 *
 * Provides a unified API for saving/loading cosmetics regardless of backend
 */

import { getCurrentUser } from './SupabaseClient';
import { getEquippedItems, equipItem } from './InventoryService';
import {
  loadGuestEquipped,
  saveGuestEquipped,
  addGuestInventoryItem,
  guestOwnsItem,
} from './LocalStorageService';
import { SkinId, TrailId, SplatId } from '../systems/CosmeticsSystem';

export interface EquippedCosmetics {
  skin: SkinId;
  trail: TrailId;
  splat: SplatId;
}

/**
 * Load equipped cosmetics from persistence layer
 * Routes to Supabase for authenticated users, localStorage for guests
 */
export async function loadEquippedCosmetics(): Promise<EquippedCosmetics> {
  try {
    const user = await getCurrentUser();

    if (user) {
      // Authenticated: Load from Supabase
      const equipped = await getEquippedItems(user.id);
      return {
        skin: (equipped.find(i => i.item_type === 'skin')?.item_id.replace('skin_', '') || 'default') as SkinId,
        trail: (equipped.find(i => i.item_type === 'trail')?.item_id.replace('trail_', '') || 'none') as TrailId,
        splat: (equipped.find(i => i.item_type === 'splat')?.item_id.replace('splat_', '') || 'default') as SplatId,
      };
    } else {
      // Guest: Load from localStorage
      const equipped = loadGuestEquipped();
      return {
        skin: (equipped.skin || 'default') as SkinId,
        trail: (equipped.trail || 'none') as TrailId,
        splat: (equipped.splat || 'default') as SplatId,
      };
    }
  } catch (error) {
    console.error('Failed to load equipped cosmetics:', error);
    // Return defaults on error
    return {
      skin: 'default',
      trail: 'none',
      splat: 'default',
    };
  }
}

/**
 * Save equipped cosmetic for a specific category
 * Routes to Supabase for authenticated users, localStorage for guests
 */
export async function saveEquippedCosmetic(category: string, itemId: string): Promise<void> {
  try {
    const user = await getCurrentUser();

    if (user) {
      // Authenticated: Save to Supabase
      await equipItem(user.id, itemId, category as any);
    } else {
      // Guest: Save to localStorage
      // Remove category prefix for storage (e.g., 'skin_pigeon' -> 'pigeon')
      const cleanItemId = itemId.replace(`${category}_`, '');
      saveGuestEquipped(category, cleanItemId);
    }
  } catch (error) {
    console.error('Failed to save equipped cosmetic:', error);
  }
}

/**
 * Check if user owns a specific cosmetic item
 * Routes to Supabase for authenticated users, localStorage for guests
 */
export async function ownsCosmetic(itemId: string, itemType: string): Promise<boolean> {
  try {
    const user = await getCurrentUser();

    if (user) {
      // Authenticated: Check Supabase inventory
      const { ownsItem } = await import('./InventoryService');
      return await ownsItem(user.id, itemId, itemType as any);
    } else {
      // Guest: Check localStorage
      return guestOwnsItem(itemId, itemType);
    }
  } catch (error) {
    console.error('Failed to check cosmetic ownership:', error);
    return false;
  }
}

/**
 * Add cosmetic item to user's inventory after purchase
 * Routes to Supabase for authenticated users, localStorage for guests
 */
export async function addCosmeticToInventory(itemId: string, itemType: string): Promise<void> {
  try {
    const user = await getCurrentUser();

    if (user) {
      // Authenticated: Add to Supabase inventory
      const { addItemToInventory } = await import('./InventoryService');
      await addItemToInventory(user.id, itemId, itemType as any, false);
    } else {
      // Guest: Add to localStorage
      addGuestInventoryItem(itemId, itemType);
    }
  } catch (error) {
    console.error('Failed to add cosmetic to inventory:', error);
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    return user !== null;
  } catch (error) {
    return false;
  }
}
