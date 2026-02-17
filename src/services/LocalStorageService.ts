/**
 * LocalStorageService
 * Manages guest player cosmetics data in browser localStorage
 *
 * Used for:
 * - Guest players who haven't created accounts
 * - Fallback when Supabase is unavailable
 * - Temporary storage before account creation
 */

const STORAGE_KEYS = {
  GUEST_INVENTORY: 'birdgame_guest_inventory',
  GUEST_EQUIPPED: 'birdgame_guest_equipped',
  GUEST_PURCHASES: 'birdgame_guest_purchases',
  GUEST_COINS: 'birdgame_guest_coins',
  GUEST_FEATHERS: 'birdgame_guest_feathers',
  GUEST_WORMS: 'birdgame_guest_worms',
  GUEST_GOLDEN_EGGS: 'birdgame_guest_golden_eggs',
};

export interface GuestInventoryItem {
  item_id: string;
  item_type: string;
  equipped: boolean;
  acquired_at: string;
}

export interface GuestEquipped {
  skin?: string;
  trail?: string;
  splat?: string;
}

/**
 * Save guest inventory to localStorage
 */
export function saveGuestInventory(items: GuestInventoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.GUEST_INVENTORY, JSON.stringify(items));
  } catch (error) {
    console.error('Failed to save guest inventory:', error);
  }
}

/**
 * Load guest inventory from localStorage
 */
export function loadGuestInventory(): GuestInventoryItem[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.GUEST_INVENTORY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load guest inventory:', error);
    return [];
  }
}

/**
 * Save equipped cosmetic for a category
 */
export function saveGuestEquipped(category: string, itemId: string): void {
  try {
    const equipped = loadGuestEquipped();
    equipped[category as keyof GuestEquipped] = itemId;
    localStorage.setItem(STORAGE_KEYS.GUEST_EQUIPPED, JSON.stringify(equipped));
  } catch (error) {
    console.error('Failed to save guest equipped:', error);
  }
}

/**
 * Load all equipped cosmetics
 */
export function loadGuestEquipped(): GuestEquipped {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.GUEST_EQUIPPED);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Failed to load guest equipped:', error);
    return {};
  }
}

/**
 * Add item to guest inventory (after purchase)
 */
export function addGuestInventoryItem(itemId: string, itemType: string): void {
  try {
    const inventory = loadGuestInventory();

    // Check if already owned
    const exists = inventory.some(i => i.item_id === itemId && i.item_type === itemType);
    if (exists) {
      console.warn('Item already in guest inventory');
      return;
    }

    inventory.push({
      item_id: itemId,
      item_type: itemType,
      equipped: false,
      acquired_at: new Date().toISOString(),
    });

    saveGuestInventory(inventory);
  } catch (error) {
    console.error('Failed to add guest inventory item:', error);
  }
}

/**
 * Check if guest owns an item
 */
export function guestOwnsItem(itemId: string, itemType: string): boolean {
  try {
    const inventory = loadGuestInventory();
    return inventory.some(i => i.item_id === itemId && i.item_type === itemType);
  } catch (error) {
    console.error('Failed to check guest ownership:', error);
    return false;
  }
}

/**
 * Save guest coins
 */
export function saveGuestCoins(coins: number): void {
  try {
    localStorage.setItem(STORAGE_KEYS.GUEST_COINS, coins.toString());
  } catch (error) {
    console.error('Failed to save guest coins:', error);
  }
}

/**
 * Load guest coins
 */
export function loadGuestCoins(): number {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.GUEST_COINS);
    return data ? parseInt(data, 10) : 0;
  } catch (error) {
    console.error('Failed to load guest coins:', error);
    return 0;
  }
}

/**
 * Save guest feathers
 */
export function saveGuestFeathers(feathers: number): void {
  try {
    localStorage.setItem(STORAGE_KEYS.GUEST_FEATHERS, feathers.toString());
  } catch (error) {
    console.error('Failed to save guest feathers:', error);
  }
}

/**
 * Load guest feathers
 */
export function loadGuestFeathers(): number {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.GUEST_FEATHERS);
    return data ? parseInt(data, 10) : 0;
  } catch (error) {
    console.error('Failed to load guest feathers:', error);
    return 0;
  }
}

/**
 * Save guest worms
 */
export function saveGuestWorms(worms: number): void {
  try {
    localStorage.setItem(STORAGE_KEYS.GUEST_WORMS, worms.toString());
  } catch (error) {
    console.error('Failed to save guest worms:', error);
  }
}

/**
 * Load guest worms
 */
export function loadGuestWorms(): number {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.GUEST_WORMS);
    return data ? parseInt(data, 10) : 0;
  } catch (error) {
    console.error('Failed to load guest worms:', error);
    return 0;
  }
}

/**
 * Save guest golden eggs
 */
export function saveGuestGoldenEggs(goldenEggs: number): void {
  try {
    localStorage.setItem(STORAGE_KEYS.GUEST_GOLDEN_EGGS, goldenEggs.toString());
  } catch (error) {
    console.error('Failed to save guest golden eggs:', error);
  }
}

/**
 * Load guest golden eggs
 */
export function loadGuestGoldenEggs(): number {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.GUEST_GOLDEN_EGGS);
    return data ? parseInt(data, 10) : 0;
  } catch (error) {
    console.error('Failed to load guest golden eggs:', error);
    return 0;
  }
}

/**
 * Clear all guest data (called after successful account migration)
 */
export function clearGuestData(): void {
  try {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
    console.log('Guest data cleared');
  } catch (error) {
    console.error('Failed to clear guest data:', error);
  }
}

/**
 * Get all guest data for migration to authenticated account
 */
export function getAllGuestData() {
  return {
    inventory: loadGuestInventory(),
    equipped: loadGuestEquipped(),
    coins: loadGuestCoins(),
    feathers: loadGuestFeathers(),
    worms: loadGuestWorms(),
    goldenEggs: loadGuestGoldenEggs(),
  };
}
