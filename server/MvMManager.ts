/**
 * Server-side MvM matchmaking, round management, and scoring.
 * Handles the MvM PvP queue, matches Murmurations, runs rounds, and distributes rewards.
 */

import WebSocket from 'ws';

interface MvMMode {
  id: string;
  duration: number; // seconds
}

interface QueueEntry {
  murmurationId: string;
  murmurationName: string;
  murmurationTag: string;
  formationLevel: number;
  mode: string;
  teamSize: number;
  playerIds: string[];
  queuedAt: number;
}

interface ActiveMatch {
  id: string;
  mode: string;
  teamSize: number;
  teamA: QueueEntry;
  teamB: QueueEntry;
  scores: { a: number; b: number };
  state: 'countdown' | 'active' | 'ending';
  timeRemaining: number;
  startedAt: number;
  zones?: TerritoryZone[];
}

interface TerritoryZone {
  id: number;
  position: { x: number; y: number; z: number };
  controlledBy: 'a' | 'b' | 'none';
  captureProgress: number;
  capturingTeam: 'a' | 'b' | 'none';
}

type SendFn = (playerId: string, msg: any) => void;

const COUNTDOWN_SECONDS = 5;
const RESULTS_DISPLAY_SECONDS = 10;

// Match durations per mode
const MODE_DURATIONS: Record<string, number> = {
  team_poop_tag: 180,
  team_race: 90,
  team_splat_attack: 90,
  territory_war: 300,
};

const FORMATION_RANGE = 2;
const MATCHMAKING_TIMEOUT_MS = 60_000;

// Territory War constants
const TERRITORY_ZONE_COUNT = 3;
const TERRITORY_POINTS_TO_WIN = 300;
const TERRITORY_CAPTURE_TIME = 5;
const TERRITORY_POINTS_PER_SECOND = 1;

export class MvMManager {
  private queue: QueueEntry[] = [];
  private activeMatches: Map<string, ActiveMatch> = new Map();
  private playerMatchMap: Map<string, string> = new Map(); // playerId -> matchId
  private sendToPlayer: SendFn;
  private matchCounter = 0;

  constructor(sendFn: SendFn) {
    this.sendToPlayer = sendFn;
  }

  addToQueue(entry: QueueEntry): void {
    // Remove any existing entry for this murmuration
    this.queue = this.queue.filter(e => e.murmurationId !== entry.murmurationId);
    this.queue.push(entry);
    this.tryMatchmaking();
  }

  removeFromQueue(murmurationId: string): void {
    this.queue = this.queue.filter(e => e.murmurationId !== murmurationId);
  }

  private tryMatchmaking(): void {
    const now = Date.now();

    for (let i = 0; i < this.queue.length; i++) {
      const a = this.queue[i];

      for (let j = i + 1; j < this.queue.length; j++) {
        const b = this.queue[j];

        // Must be same mode and team size
        if (a.mode !== b.mode || a.teamSize !== b.teamSize) continue;

        // Formation level range check
        if (Math.abs(a.formationLevel - b.formationLevel) > FORMATION_RANGE) {
          // Allow wider range after timeout
          const aWaiting = now - a.queuedAt > MATCHMAKING_TIMEOUT_MS;
          const bWaiting = now - b.queuedAt > MATCHMAKING_TIMEOUT_MS;
          if (!aWaiting && !bWaiting) continue;
        }

        // Match found! Remove from queue and start
        this.queue.splice(j, 1);
        this.queue.splice(i, 1);
        this.createMatch(a, b);
        return;
      }
    }
  }

  private createMatch(teamA: QueueEntry, teamB: QueueEntry): void {
    this.matchCounter++;
    const matchId = `mvm_${this.matchCounter}_${Date.now()}`;
    const duration = MODE_DURATIONS[teamA.mode] || 180;

    const match: ActiveMatch = {
      id: matchId,
      mode: teamA.mode,
      teamSize: teamA.teamSize,
      teamA,
      teamB,
      scores: { a: 0, b: 0 },
      state: 'countdown',
      timeRemaining: COUNTDOWN_SECONDS,
      startedAt: Date.now(),
    };

    // Initialize territory zones if Territory War
    if (teamA.mode === 'territory_war') {
      match.zones = this.createTerritoryZones();
    }

    this.activeMatches.set(matchId, match);

    // Map players to match
    for (const pid of [...teamA.playerIds, ...teamB.playerIds]) {
      this.playerMatchMap.set(pid, matchId);
    }

    // Notify all players
    const matchFoundMsg = (team: QueueEntry, opponent: QueueEntry) => ({
      type: 'mvm_match_found',
      data: {
        matchId,
        mode: teamA.mode,
        opponent: {
          murmuration_id: opponent.murmurationId,
          murmuration_name: opponent.murmurationName,
          murmuration_tag: opponent.murmurationTag,
          player_ids: opponent.playerIds,
          color: 0xff4444,
        },
      },
    });

    for (const pid of teamA.playerIds) {
      this.sendToPlayer(pid, matchFoundMsg(teamA, teamB));
    }
    for (const pid of teamB.playerIds) {
      this.sendToPlayer(pid, matchFoundMsg(teamB, teamA));
    }
  }

  private createTerritoryZones(): TerritoryZone[] {
    const zones: TerritoryZone[] = [];
    const positions = [
      { x: -100, y: 40, z: 0 },
      { x: 100, y: 40, z: 0 },
      { x: 0, y: 40, z: 100 },
    ];

    for (let i = 0; i < TERRITORY_ZONE_COUNT; i++) {
      zones.push({
        id: i,
        position: positions[i],
        controlledBy: 'none',
        captureProgress: 0,
        capturingTeam: 'none',
      });
    }
    return zones;
  }

  update(dt: number): void {
    for (const [matchId, match] of this.activeMatches) {
      match.timeRemaining -= dt;

      switch (match.state) {
        case 'countdown':
          if (match.timeRemaining <= 0) {
            match.state = 'active';
            match.timeRemaining = MODE_DURATIONS[match.mode] || 180;
          }
          break;

        case 'active':
          // Territory War: accumulate points
          if (match.mode === 'territory_war' && match.zones) {
            for (const zone of match.zones) {
              if (zone.controlledBy === 'a') match.scores.a += TERRITORY_POINTS_PER_SECOND * dt;
              else if (zone.controlledBy === 'b') match.scores.b += TERRITORY_POINTS_PER_SECOND * dt;
            }

            // Check win condition
            if (match.scores.a >= TERRITORY_POINTS_TO_WIN || match.scores.b >= TERRITORY_POINTS_TO_WIN) {
              this.endMatch(matchId);
              continue;
            }
          }

          // Time expired
          if (match.timeRemaining <= 0) {
            this.endMatch(matchId);
            continue;
          }

          // Send round updates to all players
          this.broadcastMatchUpdate(match);
          break;

        case 'ending':
          if (match.timeRemaining <= 0) {
            this.cleanupMatch(matchId);
          }
          break;
      }
    }
  }

  private endMatch(matchId: string): void {
    const match = this.activeMatches.get(matchId);
    if (!match) return;

    match.state = 'ending';
    match.timeRemaining = RESULTS_DISPLAY_SECONDS;

    const winner: 'a' | 'b' | 'draw' =
      match.scores.a > match.scores.b ? 'a' :
      match.scores.b > match.scores.a ? 'b' : 'draw';

    const endMsg = {
      type: 'mvm_match_end',
      data: {
        winner,
        stats: { a: Math.floor(match.scores.a), b: Math.floor(match.scores.b) },
        rewards: {
          coins: winner !== 'draw' ? 200 : 100,
          feathers: winner !== 'draw' ? 50 : 25,
          formation_xp: winner !== 'draw' ? 500 : 200,
          is_mvp: false,
        },
      },
    };

    for (const pid of [...match.teamA.playerIds, ...match.teamB.playerIds]) {
      this.sendToPlayer(pid, endMsg);
    }
  }

  private broadcastMatchUpdate(match: ActiveMatch): void {
    const msg = {
      type: 'mvm_round_update',
      data: {
        scores: { a: Math.floor(match.scores.a), b: Math.floor(match.scores.b) },
        time: Math.max(0, Math.floor(match.timeRemaining)),
        zones: match.zones,
      },
    };

    for (const pid of [...match.teamA.playerIds, ...match.teamB.playerIds]) {
      this.sendToPlayer(pid, msg);
    }
  }

  private cleanupMatch(matchId: string): void {
    const match = this.activeMatches.get(matchId);
    if (!match) return;

    for (const pid of [...match.teamA.playerIds, ...match.teamB.playerIds]) {
      this.playerMatchMap.delete(pid);
    }
    this.activeMatches.delete(matchId);
  }

  handlePlayerDisconnect(playerId: string): void {
    const matchId = this.playerMatchMap.get(playerId);
    if (matchId) {
      const match = this.activeMatches.get(matchId);
      if (match) {
        match.teamA.playerIds = match.teamA.playerIds.filter(id => id !== playerId);
        match.teamB.playerIds = match.teamB.playerIds.filter(id => id !== playerId);

        // If entire team disconnected, void the match
        if (match.teamA.playerIds.length === 0 || match.teamB.playerIds.length === 0) {
          this.cleanupMatch(matchId);
        }
      }
      this.playerMatchMap.delete(playerId);
    }

    // Remove from queue
    this.queue = this.queue.filter(e => !e.playerIds.includes(playerId));
  }

  /** Update territory zone capture from player position */
  updateZoneCapture(matchId: string, team: 'a' | 'b', zoneId: number, dt: number): void {
    const match = this.activeMatches.get(matchId);
    if (!match || !match.zones || match.state !== 'active') return;

    const zone = match.zones.find(z => z.id === zoneId);
    if (!zone) return;

    if (zone.controlledBy === team) return; // Already controlled

    if (zone.capturingTeam === team) {
      zone.captureProgress += dt / TERRITORY_CAPTURE_TIME;
      if (zone.captureProgress >= 1) {
        zone.controlledBy = team;
        zone.captureProgress = 0;
        zone.capturingTeam = 'none';
      }
    } else {
      zone.capturingTeam = team;
      zone.captureProgress = dt / TERRITORY_CAPTURE_TIME;
    }
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  getActiveMatchCount(): number {
    return this.activeMatches.size;
  }
}
