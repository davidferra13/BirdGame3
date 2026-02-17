import * as THREE from 'three';

/**
 * SpatialGrid - A spatial hash grid for efficient spatial queries
 *
 * This data structure partitions 3D space into a grid of cells, allowing
 * for fast neighbor queries. Perfect for collision detection and proximity
 * checks in large worlds.
 *
 * Performance: O(n) insertion, O(1) cell lookup, O(k) query where k is
 * the number of items in nearby cells (typically << total items)
 *
 * Use case: Instead of checking every poop against every NPC (O(n²)),
 * we only check poops against NPCs in nearby cells (O(n)).
 */
export class SpatialGrid<T> {
  private grid = new Map<string, T[]>();
  private cellSize: number;

  /**
   * Create a spatial grid
   * @param cellSize Size of each grid cell in world units
   * For a 1500×1500 world with ~40 NPCs, 50-unit cells work well
   * (30×30 = 900 cells, ~0.04 NPCs per cell on average)
   */
  constructor(cellSize = 50) {
    this.cellSize = cellSize;
  }

  /**
   * Clear all items from the grid
   * Call this at the start of each frame before rebuilding
   */
  clear(): void {
    this.grid.clear();
  }

  /**
   * Insert an item at a position
   * @param position World position of the item
   * @param item The item to insert
   */
  insert(position: THREE.Vector3, item: T): void {
    const key = this.getCellKey(position);
    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key)!.push(item);
  }

  /**
   * Query all items within a radius of a position
   * @param position Center of the query
   * @param radius Query radius in world units
   * @returns Array of all items in cells that intersect the radius
   */
  queryRadius(position: THREE.Vector3, radius: number): T[] {
    const results: T[] = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const centerCell = this.getCell(position);

    // Check all cells within the radius
    // For radius=10 and cellSize=50, this checks a 1×1 or 3×3 grid
    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dz = -cellRadius; dz <= cellRadius; dz++) {
        const key = `${centerCell.x + dx},${centerCell.z + dz}`;
        const items = this.grid.get(key);
        if (items) {
          results.push(...items);
        }
      }
    }

    return results;
  }

  /**
   * Get the cell coordinates for a world position
   * @param pos World position
   * @returns Cell coordinates {x, z}
   */
  private getCell(pos: THREE.Vector3): { x: number; z: number } {
    return {
      x: Math.floor(pos.x / this.cellSize),
      z: Math.floor(pos.z / this.cellSize),
    };
  }

  /**
   * Get the string key for a world position
   * @param pos World position
   * @returns String key like "5,-3" for the cell
   */
  private getCellKey(pos: THREE.Vector3): string {
    const cell = this.getCell(pos);
    return `${cell.x},${cell.z}`;
  }

  /**
   * Get the total number of cells currently in use
   * Useful for debugging and performance monitoring
   */
  getCellCount(): number {
    return this.grid.size;
  }

  /**
   * Get the total number of items across all cells
   * Useful for debugging
   */
  getItemCount(): number {
    let count = 0;
    for (const items of this.grid.values()) {
      count += items.length;
    }
    return count;
  }
}
