/**
 * Server-side spatial hash grid for Area of Interest (AOI) queries.
 * No Three.js dependency — uses plain {x, y, z} vectors.
 */

import { Vector3 } from './types';

export class ServerSpatialGrid {
  private grid = new Map<string, string[]>(); // cellKey -> playerIds
  private positions = new Map<string, Vector3>(); // playerId -> position
  private cellSize: number;

  constructor(cellSize = 100) {
    this.cellSize = cellSize;
  }

  clear(): void {
    this.grid.clear();
    this.positions.clear();
  }

  insert(id: string, position: Vector3): void {
    const key = this.getCellKey(position);
    let cell = this.grid.get(key);
    if (!cell) {
      cell = [];
      this.grid.set(key, cell);
    }
    cell.push(id);
    this.positions.set(id, position);
  }

  /**
   * Rebuild the grid from a player map. Call once per tick.
   */
  rebuild(players: Map<string, { id: string; position: Vector3 }>): void {
    this.clear();
    for (const player of players.values()) {
      this.insert(player.id, player.position);
    }
  }

  /**
   * Query all player IDs within a radius of a position.
   */
  queryRadius(position: Vector3, radius: number): string[] {
    const results: string[] = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const cx = Math.floor(position.x / this.cellSize);
    const cz = Math.floor(position.z / this.cellSize);
    const radiusSq = radius * radius;

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dz = -cellRadius; dz <= cellRadius; dz++) {
        const key = `${cx + dx},${cz + dz}`;
        const ids = this.grid.get(key);
        if (!ids) continue;

        for (const id of ids) {
          const pos = this.positions.get(id);
          if (!pos) continue;
          const distSq =
            (pos.x - position.x) ** 2 +
            (pos.y - position.y) ** 2 +
            (pos.z - position.z) ** 2;
          if (distSq <= radiusSq) {
            results.push(id);
          }
        }
      }
    }

    return results;
  }

  /**
   * Get the position of a tracked entity.
   */
  getPosition(id: string): Vector3 | undefined {
    return this.positions.get(id);
  }

  private getCellKey(pos: Vector3): string {
    return `${Math.floor(pos.x / this.cellSize)},${Math.floor(pos.z / this.cellSize)}`;
  }
}
