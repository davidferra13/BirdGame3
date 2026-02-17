/**
 * Server-side Murmuration member tracking for real-time features.
 * Tracks which Murmuration each connected player belongs to,
 * routes chat messages, and manages Roost proximity.
 */

interface MurmurationMemberInfo {
  playerId: string;
  murmurationId: string;
  murmurationTag: string;
  role: string;
}

interface RoostZone {
  murmurationId: string;
  position: { x: number; y: number; z: number };
  radius: number;
  playersNearby: Set<string>;
}

type SendFn = (playerId: string, msg: any) => void;
type BroadcastFn = (murmurationId: string, msg: any, excludePlayerId?: string) => void;

export class MurmurationState {
  /** playerId -> murmuration info */
  private members: Map<string, MurmurationMemberInfo> = new Map();

  /** murmurationId -> set of online player IDs */
  private onlineMembers: Map<string, Set<string>> = new Map();

  /** Roost zones for proximity tracking */
  private roosts: Map<string, RoostZone> = new Map();

  private sendToPlayer: SendFn;

  constructor(sendFn: SendFn) {
    this.sendToPlayer = sendFn;
  }

  // ── Member Tracking ──

  registerPlayer(playerId: string, murmurationId: string, tag: string, role: string): void {
    this.members.set(playerId, { playerId, murmurationId, murmurationTag: tag, role });

    if (!this.onlineMembers.has(murmurationId)) {
      this.onlineMembers.set(murmurationId, new Set());
    }
    this.onlineMembers.get(murmurationId)!.add(playerId);
  }

  unregisterPlayer(playerId: string): void {
    const info = this.members.get(playerId);
    if (info) {
      const online = this.onlineMembers.get(info.murmurationId);
      if (online) {
        online.delete(playerId);
        if (online.size === 0) {
          this.onlineMembers.delete(info.murmurationId);
        }
      }

      // Remove from roost tracking
      for (const roost of this.roosts.values()) {
        roost.playersNearby.delete(playerId);
      }
    }
    this.members.delete(playerId);
  }

  getPlayerMurmuration(playerId: string): MurmurationMemberInfo | undefined {
    return this.members.get(playerId);
  }

  getOnlineMembers(murmurationId: string): string[] {
    return Array.from(this.onlineMembers.get(murmurationId) || []);
  }

  getOnlineMemberCount(murmurationId: string): number {
    return this.onlineMembers.get(murmurationId)?.size || 0;
  }

  // ── Chat Relay ──

  relayChatMessage(senderId: string, message: string, senderUsername: string): void {
    const senderInfo = this.members.get(senderId);
    if (!senderInfo) return;

    const murmurationId = senderInfo.murmurationId;
    const online = this.onlineMembers.get(murmurationId);
    if (!online) return;

    const chatMsg = {
      type: 'murmuration_chat',
      data: {
        murmurationId,
        senderId,
        senderUsername,
        message,
        timestamp: Date.now(),
      },
    };

    for (const pid of online) {
      if (pid !== senderId) {
        this.sendToPlayer(pid, chatMsg);
      }
    }
  }

  // ── Notifications ──

  sendNotification(
    murmurationId: string,
    notificationType: string,
    payload: Record<string, unknown>,
    excludePlayerId?: string,
  ): void {
    const online = this.onlineMembers.get(murmurationId);
    if (!online) return;

    const msg = {
      type: 'murmuration_notification',
      data: { notificationType, payload },
    };

    for (const pid of online) {
      if (pid !== excludePlayerId) {
        this.sendToPlayer(pid, msg);
      }
    }
  }

  // ── Roost Zones ──

  registerRoost(murmurationId: string, position: { x: number; y: number; z: number }, radius = 30): void {
    this.roosts.set(murmurationId, {
      murmurationId,
      position,
      radius,
      playersNearby: new Set(),
    });
  }

  unregisterRoost(murmurationId: string): void {
    this.roosts.delete(murmurationId);
  }

  updatePlayerPosition(playerId: string, position: { x: number; y: number; z: number }): void {
    const info = this.members.get(playerId);
    if (!info) return;

    const roost = this.roosts.get(info.murmurationId);
    if (!roost) return;

    const dx = position.x - roost.position.x;
    const dz = position.z - roost.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    const wasNearby = roost.playersNearby.has(playerId);
    const isNearby = dist <= roost.radius;

    if (isNearby && !wasNearby) {
      roost.playersNearby.add(playerId);
    } else if (!isNearby && wasNearby) {
      roost.playersNearby.delete(playerId);
    }
  }

  getPlayersAtRoost(murmurationId: string): string[] {
    const roost = this.roosts.get(murmurationId);
    return roost ? Array.from(roost.playersNearby) : [];
  }

  // ── Utility ──

  /** Check if two players are in the same Murmuration */
  areInSameMurmuration(playerA: string, playerB: string): boolean {
    const a = this.members.get(playerA);
    const b = this.members.get(playerB);
    if (!a || !b) return false;
    return a.murmurationId === b.murmurationId;
  }

  /** Get the tag for display next to a player's name */
  getPlayerTag(playerId: string): string | null {
    const info = this.members.get(playerId);
    return info ? info.murmurationTag : null;
  }

  /** Get all murmuration IDs that have online members */
  getActiveMurmurationIds(): string[] {
    return Array.from(this.onlineMembers.keys());
  }
}
