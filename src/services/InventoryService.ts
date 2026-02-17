/**
 * Inventory Service
 * Manages user's owned cosmetic items
 *
 * Features:
 * - View owned items
 * - Equip/unequip items
 * - Filter by type
 * - Get currently equipped loadout
 */

import { supabase } from './SupabaseClient';
import { InventoryItem, CosmeticType } from '../types/database';

/**
 * Get all items in user's inventory
 */
export async function getInventory(userId: string): Promise<InventoryItem[]> {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', userId)
      .order('acquired_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch inventory:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting inventory:', error);
    return [];
  }
}

/**
 * Get items of a specific type from inventory
 */
export async function getInventoryByType(
  userId: string,
  itemType: CosmeticType
): Promise<InventoryItem[]> {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', userId)
      .eq('item_type', itemType)
      .order('acquired_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch inventory by type:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting inventory by type:', error);
    return [];
  }
}

/**
 * Get all currently equipped items
 */
export async function getEquippedItems(userId: string): Promise<InventoryItem[]> {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', userId)
      .eq('equipped', true);

    if (error) {
      console.error('Failed to fetch equipped items:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting equipped items:', error);
    return [];
  }
}

/**
 * Get currently equipped item of a specific type
 */
export async function getEquippedItemOfType(
  userId: string,
  itemType: CosmeticType
): Promise<InventoryItem | null> {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', userId)
      .eq('item_type', itemType)
      .eq('equipped', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      console.error('Failed to fetch equipped item:', error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error('Error getting equipped item:', error);
    return null;
  }
}

/**
 * Equip an item (unequips others of same type)
 */
export async function equipItem(
  userId: string,
  itemId: string,
  itemType: CosmeticType
): Promise<boolean> {
  try {
    // Start a transaction-like operation
    // 1. Unequip all items of this type
    const { error: unequipError } = await supabase
      .from('inventory')
      .update({ equipped: false })
      .eq('user_id', userId)
      .eq('item_type', itemType);

    if (unequipError) {
      console.error('Failed to unequip items:', unequipError);
      return false;
    }

    // 2. Equip the selected item
    const { error: equipError } = await supabase
      .from('inventory')
      .update({ equipped: true })
      .eq('user_id', userId)
      .eq('item_id', itemId)
      .eq('item_type', itemType);

    if (equipError) {
      console.error('Failed to equip item:', equipError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error equipping item:', error);
    return false;
  }
}

/**
 * Unequip an item
 */
export async function unequipItem(
  userId: string,
  itemId: string,
  itemType: CosmeticType
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('inventory')
      .update({ equipped: false })
      .eq('user_id', userId)
      .eq('item_id', itemId)
      .eq('item_type', itemType);

    if (error) {
      console.error('Failed to unequip item:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error unequipping item:', error);
    return false;
  }
}

/**
 * Check if user owns a specific item
 */
export async function ownsItem(
  userId: string,
  itemId: string,
  itemType: CosmeticType
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('id')
      .eq('user_id', userId)
      .eq('item_id', itemId)
      .eq('item_type', itemType)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Failed to check item ownership:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error checking item ownership:', error);
    return false;
  }
}

/**
 * Add item to inventory (used by shop system)
 */
export async function addItemToInventory(
  userId: string,
  itemId: string,
  itemType: CosmeticType,
  autoEquip: boolean = false
): Promise<InventoryItem | null> {
  try {
    // Check if already owned
    const alreadyOwned = await ownsItem(userId, itemId, itemType);
    if (alreadyOwned) {
      console.warn('Item already in inventory');
      return null;
    }

    // Add to inventory
    const { data, error } = await supabase
      .from('inventory')
      .insert({
        user_id: userId,
        item_id: itemId,
        item_type: itemType,
        equipped: autoEquip,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to add item to inventory:', error);
      return null;
    }

    // If auto-equip, unequip other items of same type
    if (autoEquip) {
      await supabase
        .from('inventory')
        .update({ equipped: false })
        .eq('user_id', userId)
        .eq('item_type', itemType)
        .neq('id', data.id);
    }

    return data;
  } catch (error) {
    console.error('Error adding item to inventory:', error);
    return null;
  }
}

/**
 * Get inventory count by type
 */
export async function getInventoryCount(userId: string): Promise<Record<CosmeticType, number>> {
  try {
    const inventory = await getInventory(userId);

    const counts: Record<CosmeticType, number> = {
      title: 0,
      banner_frame: 0,
      skin: 0,
      trail: 0,
      splat: 0,
      emote: 0,
    };

    for (const item of inventory) {
      counts[item.item_type]++;
    }

    return counts;
  } catch (error) {
    console.error('Error getting inventory count:', error);
    return {
      title: 0,
      banner_frame: 0,
      skin: 0,
      trail: 0,
      splat: 0,
      emote: 0,
    };
  }
}
