/**
 * Shop Service
 * Implements SHOP_SYSTEM.md specification
 *
 * Features:
 * - Coin Shop (common cosmetics)
 * - Feather Shop (premium cosmetics)
 * - Server authoritative purchases
 * - Idempotent operations
 * - Purchase history tracking
 */

import { supabase } from './SupabaseClient';
import { CosmeticItem, PurchaseResponse } from '../types/database';
import { deductCoins, deductFeathers, deductWorms, deductGoldenEggs } from './CurrencyService';

export interface ShopItem extends CosmeticItem {
  owned: boolean;
  equipped: boolean;
}

/**
 * Get all items available in the coin shop
 */
export async function getCoinShopItems(userId: string): Promise<ShopItem[]> {
  try {
    // In a full implementation, this would query a cosmetic_items table
    // For now, return a placeholder array
    // const { data: items, error } = await supabase
    //   .from('cosmetic_items')
    //   .select('*')
    //   .not('coin_price', 'is', null);

    // For now, return empty array
    return [];
  } catch (error) {
    console.error('Error getting coin shop items:', error);
    return [];
  }
}

/**
 * Get all items available in the feather shop
 */
export async function getFeatherShopItems(userId: string): Promise<ShopItem[]> {
  try {
    // In a full implementation, this would query a cosmetic_items table
    // const { data: items, error } = await supabase
    //   .from('cosmetic_items')
    //   .select('*')
    //   .not('feather_price', 'is', null);

    // For now, return empty array
    return [];
  } catch (error) {
    console.error('Error getting feather shop items:', error);
    return [];
  }
}

/**
 * Purchase an item with coins
 * Server-authoritative and idempotent
 */
export async function purchaseWithCoins(
  userId: string,
  itemId: string,
  itemType: string,
  price: number
): Promise<PurchaseResponse> {
  try {
    // Check if already purchased (idempotency)
    const { data: existingPurchase } = await supabase
      .from('purchases')
      .select('id')
      .eq('user_id', userId)
      .eq('item_id', itemId)
      .eq('item_type', itemType)
      .single();

    if (existingPurchase) {
      return {
        success: false,
        error: 'Item already purchased',
      };
    }

    // Check balance and deduct coins
    const deductSuccess = await deductCoins(userId, price);
    if (!deductSuccess) {
      return {
        success: false,
        error: 'Insufficient coins',
      };
    }

    // Create purchase record
    const { error: purchaseError } = await supabase.from('purchases').insert({
      user_id: userId,
      item_id: itemId,
      item_type: itemType,
      currency_type: 'coins',
      amount: price,
    });

    if (purchaseError) {
      console.error('Failed to create purchase record:', purchaseError);
      // Attempt to refund coins
      await supabase.rpc('add_coins', { user_id: userId, amount: price });
      return {
        success: false,
        error: 'Purchase failed',
      };
    }

    // Add to inventory
    const { data: inventoryItem, error: inventoryError } = await supabase
      .from('inventory')
      .insert({
        user_id: userId,
        item_id: itemId,
        item_type: itemType,
        equipped: false, // Auto-equip logic can be added here
      })
      .select()
      .single();

    if (inventoryError) {
      console.error('Failed to add to inventory:', inventoryError);
      return {
        success: false,
        error: 'Failed to add item to inventory',
      };
    }

    // Get updated balance
    const { data: profile } = await supabase
      .from('profiles')
      .select('coins')
      .eq('id', userId)
      .single();

    return {
      success: true,
      item: inventoryItem,
      updated_coins: profile?.coins || 0,
    };
  } catch (error) {
    console.error('Error purchasing with coins:', error);
    return {
      success: false,
      error: String(error),
    };
  }
}

/**
 * Purchase an item with feathers
 * Server-authoritative and idempotent
 */
export async function purchaseWithFeathers(
  userId: string,
  itemId: string,
  itemType: string,
  price: number
): Promise<PurchaseResponse> {
  try {
    // Check if already purchased (idempotency)
    const { data: existingPurchase } = await supabase
      .from('purchases')
      .select('id')
      .eq('user_id', userId)
      .eq('item_id', itemId)
      .eq('item_type', itemType)
      .single();

    if (existingPurchase) {
      return {
        success: false,
        error: 'Item already purchased',
      };
    }

    // Check balance and deduct feathers
    const deductSuccess = await deductFeathers(userId, price);
    if (!deductSuccess) {
      return {
        success: false,
        error: 'Insufficient feathers',
      };
    }

    // Create purchase record
    const { error: purchaseError } = await supabase.from('purchases').insert({
      user_id: userId,
      item_id: itemId,
      item_type: itemType,
      currency_type: 'feathers',
      amount: price,
    });

    if (purchaseError) {
      console.error('Failed to create purchase record:', purchaseError);
      // Attempt to refund feathers
      await supabase.rpc('add_feathers', { user_id: userId, amount: price });
      return {
        success: false,
        error: 'Purchase failed',
      };
    }

    // Add to inventory
    const { data: inventoryItem, error: inventoryError } = await supabase
      .from('inventory')
      .insert({
        user_id: userId,
        item_id: itemId,
        item_type: itemType,
        equipped: false,
      })
      .select()
      .single();

    if (inventoryError) {
      console.error('Failed to add to inventory:', inventoryError);
      return {
        success: false,
        error: 'Failed to add item to inventory',
      };
    }

    // Get updated balance
    const { data: profile } = await supabase
      .from('profiles')
      .select('feathers')
      .eq('id', userId)
      .single();

    return {
      success: true,
      item: inventoryItem,
      updated_feathers: profile?.feathers || 0,
    };
  } catch (error) {
    console.error('Error purchasing with feathers:', error);
    return {
      success: false,
      error: String(error),
    };
  }
}

/**
 * Purchase an item with worms
 * Server-authoritative and idempotent
 */
export async function purchaseWithWorms(
  userId: string,
  itemId: string,
  itemType: string,
  price: number
): Promise<PurchaseResponse> {
  try {
    const { data: existingPurchase } = await supabase
      .from('purchases')
      .select('id')
      .eq('user_id', userId)
      .eq('item_id', itemId)
      .eq('item_type', itemType)
      .single();

    if (existingPurchase) {
      return { success: false, error: 'Item already purchased' };
    }

    const deductSuccess = await deductWorms(userId, price);
    if (!deductSuccess) {
      return { success: false, error: 'Insufficient worms' };
    }

    const { error: purchaseError } = await supabase.from('purchases').insert({
      user_id: userId,
      item_id: itemId,
      item_type: itemType,
      currency_type: 'worms',
      amount: price,
    });

    if (purchaseError) {
      console.error('Failed to create purchase record:', purchaseError);
      await supabase.rpc('add_worms', { user_id: userId, amount: price });
      return { success: false, error: 'Purchase failed' };
    }

    const { data: inventoryItem, error: inventoryError } = await supabase
      .from('inventory')
      .insert({ user_id: userId, item_id: itemId, item_type: itemType, equipped: false })
      .select()
      .single();

    if (inventoryError) {
      console.error('Failed to add to inventory:', inventoryError);
      return { success: false, error: 'Failed to add item to inventory' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('worms')
      .eq('id', userId)
      .single();

    return { success: true, item: inventoryItem, updated_worms: profile?.worms || 0 };
  } catch (error) {
    console.error('Error purchasing with worms:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Purchase an item with golden eggs
 * Server-authoritative and idempotent
 */
export async function purchaseWithGoldenEggs(
  userId: string,
  itemId: string,
  itemType: string,
  price: number
): Promise<PurchaseResponse> {
  try {
    const { data: existingPurchase } = await supabase
      .from('purchases')
      .select('id')
      .eq('user_id', userId)
      .eq('item_id', itemId)
      .eq('item_type', itemType)
      .single();

    if (existingPurchase) {
      return { success: false, error: 'Item already purchased' };
    }

    const deductSuccess = await deductGoldenEggs(userId, price);
    if (!deductSuccess) {
      return { success: false, error: 'Insufficient golden eggs' };
    }

    const { error: purchaseError } = await supabase.from('purchases').insert({
      user_id: userId,
      item_id: itemId,
      item_type: itemType,
      currency_type: 'golden_eggs',
      amount: price,
    });

    if (purchaseError) {
      console.error('Failed to create purchase record:', purchaseError);
      await supabase.rpc('add_golden_eggs', { user_id: userId, amount: price });
      return { success: false, error: 'Purchase failed' };
    }

    const { data: inventoryItem, error: inventoryError } = await supabase
      .from('inventory')
      .insert({ user_id: userId, item_id: itemId, item_type: itemType, equipped: false })
      .select()
      .single();

    if (inventoryError) {
      console.error('Failed to add to inventory:', inventoryError);
      return { success: false, error: 'Failed to add item to inventory' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('golden_eggs')
      .eq('id', userId)
      .single();

    return { success: true, item: inventoryItem, updated_golden_eggs: profile?.golden_eggs || 0 };
  } catch (error) {
    console.error('Error purchasing with golden eggs:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get user's purchase history
 */
export async function getPurchaseHistory(userId: string) {
  try {
    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .eq('user_id', userId)
      .order('purchased_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch purchase history:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting purchase history:', error);
    return [];
  }
}
