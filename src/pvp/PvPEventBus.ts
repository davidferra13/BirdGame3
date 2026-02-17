/**
 * PvPEventBus - Decoupled event system for PvP state changes.
 * UI components subscribe to events without tight coupling to PvPManager.
 */

export type PvPEventType =
  | 'round-phase-change'
  | 'player-joined'
  | 'player-left'
  | 'score-update'
  | 'tag-transfer'
  | 'checkpoint-reached'
  | 'statue-hit'
  | 'round-ending'
  | 'round-results'
  | 'event-available'
  | 'event-removed'
  | 'countdown-tick'
  | 'heist-slam'
  | 'heist-grab'
  | 'heist-score';

type PvPEventCallback = (data: any) => void;

export class PvPEventBus {
  private listeners = new Map<PvPEventType, Set<PvPEventCallback>>();

  on(event: PvPEventType, callback: PvPEventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: PvPEventType, callback: PvPEventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event: PvPEventType, data?: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const cb of callbacks) {
        cb(data);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
