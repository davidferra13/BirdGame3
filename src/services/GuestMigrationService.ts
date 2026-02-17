/**
 * GuestMigrationService
 * Migrates guest localStorage data into Supabase when a guest creates an account.
 * Only clears guest data after successful migration.
 */

import { getAllGuestData, clearGuestData } from './LocalStorageService';
import { supabase } from './SupabaseClient';
import { Profile } from '../types/database';

export interface MigrationResult {
  migrated: boolean;
  itemsMigrated: number;
  coinsMigrated: number;
  feathersMigrated: number;
}

export async function migrateGuestDataToAccount(profile: Profile): Promise<MigrationResult> {
  const guestData = getAllGuestData();
  let itemsMigrated = 0;

  // Migrate inventory items
  for (const item of guestData.inventory) {
    try {
      const { error } = await supabase.from('inventory').upsert({
        user_id: profile.id,
        item_id: item.item_id,
        item_type: item.item_type,
        equipped: item.equipped,
        acquired_at: item.acquired_at,
      }, { onConflict: 'user_id,item_id,item_type' });

      if (!error) itemsMigrated++;
    } catch (e) {
      console.warn('Failed to migrate item:', item.item_id, e);
    }
  }

  // Migrate equipped cosmetics (set equipped flags)
  const equipped = guestData.equipped;
  if (equipped.skin) {
    await setEquipped(profile.id, `skin_${equipped.skin}`, 'skin');
  }
  if (equipped.trail) {
    await setEquipped(profile.id, `trail_${equipped.trail}`, 'trail');
  }
  if (equipped.splat) {
    await setEquipped(profile.id, `splat_${equipped.splat}`, 'splat');
  }

  // Migrate coins, feathers, level, and xp from saved game state
  const coinsMigrated = guestData.coins;
  const feathersMigrated = guestData.feathers;

  const updateData: Record<string, number> = {};
  if (coinsMigrated > 0) updateData.coins = (profile.coins || 0) + coinsMigrated;
  if (feathersMigrated > 0) updateData.feathers = (profile.feathers || 0) + feathersMigrated;

  // Check for saved game state (level, xp, stats)
  try {
    const savedStateRaw = localStorage.getItem('birdgame_gamestate');
    if (savedStateRaw) {
      const savedState = JSON.parse(savedStateRaw);
      if (savedState.level > 1) updateData.level = savedState.level;
      if (savedState.xp > 0) updateData.xp = savedState.xp;
      if (savedState.bankedCoins > 0 && !updateData.coins) {
        updateData.coins = (profile.coins || 0) + savedState.bankedCoins;
      }
    }
  } catch (e) {
    console.warn('Failed to parse saved game state for migration:', e);
  }

  // Apply profile updates
  if (Object.keys(updateData).length > 0) {
    await supabase.from('profiles').update(updateData).eq('id', profile.id);
  }

  // Clear guest data after successful migration
  clearGuestData();
  localStorage.removeItem('birdgame_gamestate');

  return {
    migrated: true,
    itemsMigrated,
    coinsMigrated,
    feathersMigrated,
  };
}

/** Helper: set an inventory item as equipped (and unequip others of same type) */
async function setEquipped(userId: string, itemId: string, itemType: string): Promise<void> {
  try {
    // Unequip all of this type
    await supabase.from('inventory')
      .update({ equipped: false })
      .eq('user_id', userId)
      .eq('item_type', itemType);

    // Equip the target item
    await supabase.from('inventory')
      .update({ equipped: true })
      .eq('user_id', userId)
      .eq('item_id', itemId)
      .eq('item_type', itemType);
  } catch (e) {
    console.warn('Failed to set equipped:', itemId, e);
  }
}
