/**
 * MvMNetworking — Client-side MvM WebSocket message handling.
 * Sends and receives MvM PvP messages through the existing WebSocket connection.
 */

import type {
  MvMMode, MvMTeamSize, MvMMatch, MvMTeam, MvMRewards,
  TerritoryZone, MurmurationChatMessage,
} from '@/types/murmuration';

export type MvMEventType =
  | 'match_found'
  | 'round_update'
  | 'match_end'
  | 'chat_message'
  | 'notification';

export interface MvMNetworkCallbacks {
  onMatchFound: (data: { matchId: string; opponent: MvMTeam; mode: MvMMode }) => void;
  onRoundUpdate: (data: { scores: { a: number; b: number }; time: number; zones?: TerritoryZone[] }) => void;
  onMatchEnd: (data: { winner: 'a' | 'b' | 'draw'; rewards: MvMRewards; stats: { a: number; b: number } }) => void;
  onChatMessage: (msg: MurmurationChatMessage) => void;
  onNotification: (data: { notificationType: string; payload: Record<string, unknown> }) => void;
}

export class MvMNetworking {
  private ws: WebSocket | null = null;
  private callbacks: Partial<MvMNetworkCallbacks> = {};

  setWebSocket(ws: WebSocket): void {
    this.ws = ws;
  }

  setCallbacks(callbacks: Partial<MvMNetworkCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Handle incoming WebSocket message. Called by MultiplayerManager
   * when it receives a murmuration/mvm message type.
   */
  handleMessage(type: string, data: any): void {
    switch (type) {
      case 'mvm_match_found':
        this.callbacks.onMatchFound?.(data);
        break;
      case 'mvm_round_update':
        this.callbacks.onRoundUpdate?.(data);
        break;
      case 'mvm_match_end':
        this.callbacks.onMatchEnd?.(data);
        break;
      case 'murmuration_chat':
        this.callbacks.onChatMessage?.({
          murmuration_id: data.murmurationId || '',
          sender_id: data.senderId,
          sender_username: data.senderUsername,
          message: data.message,
          timestamp: data.timestamp,
        });
        break;
      case 'murmuration_notification':
        this.callbacks.onNotification?.(data);
        break;
    }
  }

  // ── Send Methods ──

  joinQueue(mode: MvMMode, teamSize: MvMTeamSize): void {
    this.send({
      type: 'mvm_queue_join',
      data: { mode, teamSize },
    });
  }

  leaveQueue(): void {
    this.send({
      type: 'mvm_queue_leave',
      data: {},
    });
  }

  sendChatMessage(murmurationId: string, senderId: string, senderUsername: string, message: string): void {
    this.send({
      type: 'murmuration_chat',
      data: {
        murmurationId,
        senderId,
        senderUsername,
        message,
        timestamp: Date.now(),
      },
    });
  }

  private send(message: { type: string; data: any }): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  destroy(): void {
    this.ws = null;
    this.callbacks = {};
  }
}
