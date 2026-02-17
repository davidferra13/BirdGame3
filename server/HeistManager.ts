/**
 * HeistManager - Server-side authoritative match logic for Heist mode.
 * Manages trophy state, slam validation, score tracking, and match lifecycle.
 * Follows the pattern of RaceManager.ts.
 */

import { Vector3 } from './types';

// Heist constants (server-side mirror of client Constants.ts HEIST section)
const HEIST = {
  POINTS_TO_WIN: 3,
  MATCH_TIME_LIMIT: 180,
  COUNTDOWN_DURATION: 3,
  SCORE_PAUSE_DURATION: 2,
  TROPHY_HOVER_HEIGHT: 40,
  TROPHY_DROP_GRAVITY: 30,
  TROPHY_DROP_INHERIT_VELOCITY: 0.4,
  TROPHY_DROP_MAX_FALL_TIME: 3,
  TROPHY_GRAB_IMMUNITY: 0.75,
  PEDESTAL_TRIGGER_RADIUS: 12,
  PEDESTAL_HEIGHT: 35,
  PEDESTAL_DISTANCE_FROM_CENTER: 200,
  SLAM_SPEED_THRESHOLD: 0.7,
  SLAM_COLLISION_RADIUS: 8, // Slightly larger than client for lag compensation
  SLAM_KNOCKBACK_FORCE: 40,
  SLAM_COOLDOWN: 1.5,
  PLAYER_SPAWN_DISTANCE: 200,
  PLAYER_SPAWN_HEIGHT: 50,
  MAX_FLIGHT_SPEED: 50, // From FLIGHT.MAX_SPEED
};

export type HeistMatchState = 'waiting' | 'countdown' | 'active' | 'overtime' | 'score_pause' | 'complete';

export type TrophyState = 'idle' | 'carried' | 'falling';

interface HeistPlayer {
  id: string;
  score: number;
  slamCooldown: number;
  pedestalPosition: Vector3;
}

interface HeistMatch {
  id: string;
  state: HeistMatchState;
  players: Map<string, HeistPlayer>;
  trophyState: TrophyState;
  trophyPosition: Vector3;
  trophyVelocity: Vector3;
  trophyCarrierId: string | null;
  trophyGrabImmunity: number;
  trophyFallTimer: number;
  matchTimer: number;
  countdownTimer: number;
  scorePauseTimer: number;
  createdAt: number;
}

type SendFn = (playerId: string, message: any) => void;
type BroadcastFn = (matchId: string, message: any) => void;

export class HeistManager {
  private matches = new Map<string, HeistMatch>();
  private playerToMatch = new Map<string, string>(); // playerId -> matchId
  private nextMatchId = 0;

  private sendToPlayer: SendFn;
  private broadcastToMatch: BroadcastFn;

  constructor(sendToPlayer: SendFn, broadcastToMatch: BroadcastFn) {
    this.sendToPlayer = sendToPlayer;
    this.broadcastToMatch = broadcastToMatch;
  }

  /** Create a new Heist match between two players */
  createMatch(player1Id: string, player2Id: string): string | null {
    // Check neither player is already in a match
    if (this.playerToMatch.has(player1Id) || this.playerToMatch.has(player2Id)) {
      return null;
    }

    const matchId = `heist_${++this.nextMatchId}_${Date.now()}`;

    const match: HeistMatch = {
      id: matchId,
      state: 'countdown',
      players: new Map(),
      trophyState: 'idle',
      trophyPosition: { x: 0, y: HEIST.TROPHY_HOVER_HEIGHT, z: 0 },
      trophyVelocity: { x: 0, y: 0, z: 0 },
      trophyCarrierId: null,
      trophyGrabImmunity: 0,
      trophyFallTimer: 0,
      matchTimer: HEIST.MATCH_TIME_LIMIT,
      countdownTimer: HEIST.COUNTDOWN_DURATION,
      scorePauseTimer: 0,
      createdAt: Date.now(),
    };

    // Player 1 pedestal (negative X)
    match.players.set(player1Id, {
      id: player1Id,
      score: 0,
      slamCooldown: 0,
      pedestalPosition: {
        x: -HEIST.PEDESTAL_DISTANCE_FROM_CENTER,
        y: HEIST.PEDESTAL_HEIGHT,
        z: 0,
      },
    });

    // Player 2 pedestal (positive X)
    match.players.set(player2Id, {
      id: player2Id,
      score: 0,
      slamCooldown: 0,
      pedestalPosition: {
        x: HEIST.PEDESTAL_DISTANCE_FROM_CENTER,
        y: HEIST.PEDESTAL_HEIGHT,
        z: 0,
      },
    });

    this.matches.set(matchId, match);
    this.playerToMatch.set(player1Id, matchId);
    this.playerToMatch.set(player2Id, matchId);

    // Send match start to both players
    this.broadcastToMatch(matchId, {
      type: 'heist-match-start',
      data: {
        matchId,
        players: [player1Id, player2Id],
        trophyPosition: match.trophyPosition,
        countdown: HEIST.COUNTDOWN_DURATION,
      },
    });

    return matchId;
  }

  /** Handle a player requesting to grab the trophy */
  handleGrabRequest(playerId: string, playerPosition: Vector3): void {
    const match = this.getMatchForPlayer(playerId);
    if (!match || match.state !== 'active' && match.state !== 'overtime') return;
    if (match.trophyCarrierId) return; // Already carried
    if (match.trophyGrabImmunity > 0) return; // Grab immunity active
    if (match.trophyState === 'falling') return; // Still falling

    // Validate proximity
    const dx = playerPosition.x - match.trophyPosition.x;
    const dy = playerPosition.y - match.trophyPosition.y;
    const dz = playerPosition.z - match.trophyPosition.z;
    const distSq = dx * dx + dy * dy + dz * dz;

    // Generous grab radius (8 units for lag compensation)
    if (distSq > 64) return;

    // Grant the grab
    match.trophyCarrierId = playerId;
    match.trophyState = 'carried';

    this.broadcastToMatch(match.id, {
      type: 'heist-trophy-grabbed',
      data: { playerId, matchId: match.id },
    });
  }

  /** Handle a player claiming a slam on the carrier */
  handleSlamRequest(
    attackerId: string,
    attackerPosition: Vector3,
    attackerSpeed: number,
  ): void {
    const match = this.getMatchForPlayer(attackerId);
    if (!match || (match.state !== 'active' && match.state !== 'overtime')) return;
    if (!match.trophyCarrierId) return; // No one carrying
    if (match.trophyCarrierId === attackerId) return; // Can't slam yourself

    const player = match.players.get(attackerId);
    if (!player || player.slamCooldown > 0) return; // On cooldown

    // Validate speed threshold
    if (attackerSpeed < HEIST.MAX_FLIGHT_SPEED * HEIST.SLAM_SPEED_THRESHOLD) return;

    // Validate proximity (use server's generous collision radius)
    const carrierId = match.trophyCarrierId;
    // We trust the attacker's claimed position for now (client-authoritative movement)
    // but validate against the trophy position as a proxy for carrier position
    const dx = attackerPosition.x - match.trophyPosition.x;
    const dy = attackerPosition.y - match.trophyPosition.y;
    const dz = attackerPosition.z - match.trophyPosition.z;
    const distSq = dx * dx + dy * dy + dz * dz;

    if (distSq > HEIST.SLAM_COLLISION_RADIUS * HEIST.SLAM_COLLISION_RADIUS) return;

    // Valid slam!
    player.slamCooldown = HEIST.SLAM_COOLDOWN;

    // Drop the trophy with physics
    this.dropTrophy(match, attackerPosition);

    this.broadcastToMatch(match.id, {
      type: 'heist-slam',
      data: {
        matchId: match.id,
        attackerId,
        carrierId,
        trophyPosition: match.trophyPosition,
        trophyVelocity: match.trophyVelocity,
      },
    });
  }

  /** Handle a player delivering the trophy to their pedestal */
  handleScoreRequest(playerId: string, playerPosition: Vector3): void {
    const match = this.getMatchForPlayer(playerId);
    if (!match || (match.state !== 'active' && match.state !== 'overtime')) return;
    if (match.trophyCarrierId !== playerId) return; // Not carrying

    const player = match.players.get(playerId);
    if (!player) return;

    // Validate proximity to their own pedestal
    const ped = player.pedestalPosition;
    const dx = playerPosition.x - ped.x;
    const dy = playerPosition.y - ped.y;
    const dz = playerPosition.z - ped.z;
    const distSq = dx * dx + dy * dy + dz * dz;

    if (distSq > HEIST.PEDESTAL_TRIGGER_RADIUS * HEIST.PEDESTAL_TRIGGER_RADIUS) return;

    // Score!
    player.score++;
    match.trophyCarrierId = null;
    match.trophyState = 'idle';

    // Check win condition
    if (player.score >= HEIST.POINTS_TO_WIN) {
      match.state = 'complete';
      this.broadcastToMatch(match.id, {
        type: 'heist-score',
        data: { matchId: match.id, playerId, score: player.score },
      });
      this.broadcastMatchEnd(match, playerId);
      return;
    }

    // Score pause then respawn trophy
    match.state = 'score_pause';
    match.scorePauseTimer = HEIST.SCORE_PAUSE_DURATION;

    this.broadcastToMatch(match.id, {
      type: 'heist-score',
      data: { matchId: match.id, playerId, score: player.score },
    });
  }

  /** Server tick update for all active matches */
  update(dt: number): void {
    for (const [matchId, match] of this.matches) {
      switch (match.state) {
        case 'countdown':
          match.countdownTimer -= dt;
          if (match.countdownTimer <= 0) {
            match.state = 'active';
            this.broadcastToMatch(matchId, {
              type: 'heist-round-start',
              data: { matchId },
            });
          }
          break;

        case 'active':
          match.matchTimer -= dt;
          this.updateTrophyPhysics(match, dt);
          this.updatePlayerCooldowns(match, dt);

          if (match.matchTimer <= 0) {
            this.handleTimeExpired(match);
          }
          break;

        case 'overtime':
          this.updateTrophyPhysics(match, dt);
          this.updatePlayerCooldowns(match, dt);
          break;

        case 'score_pause':
          match.scorePauseTimer -= dt;
          if (match.scorePauseTimer <= 0) {
            // Respawn trophy at center
            match.trophyPosition = { x: 0, y: HEIST.TROPHY_HOVER_HEIGHT, z: 0 };
            match.trophyVelocity = { x: 0, y: 0, z: 0 };
            match.trophyState = 'idle';
            match.trophyGrabImmunity = 0;
            match.state = 'active';

            this.broadcastToMatch(matchId, {
              type: 'heist-trophy-reset',
              data: {
                matchId,
                position: match.trophyPosition,
              },
            });
          }
          break;

        case 'complete':
          // Clean up after a delay
          if (Date.now() - match.createdAt > (HEIST.MATCH_TIME_LIMIT + 30) * 1000) {
            this.cleanupMatch(matchId);
          }
          break;
      }
    }
  }

  private updateTrophyPhysics(match: HeistMatch, dt: number): void {
    // Grab immunity countdown
    if (match.trophyGrabImmunity > 0) {
      match.trophyGrabImmunity -= dt;
    }

    if (match.trophyState === 'falling') {
      match.trophyFallTimer += dt;

      // Apply gravity
      match.trophyVelocity.y -= HEIST.TROPHY_DROP_GRAVITY * dt;

      // Move trophy
      match.trophyPosition.x += match.trophyVelocity.x * dt;
      match.trophyPosition.y += match.trophyVelocity.y * dt;
      match.trophyPosition.z += match.trophyVelocity.z * dt;

      // Settle if hit ground or max fall time
      if (match.trophyPosition.y <= 5 || match.trophyFallTimer >= HEIST.TROPHY_DROP_MAX_FALL_TIME) {
        match.trophyPosition.y = Math.max(match.trophyPosition.y, 5);
        match.trophyState = 'idle';
        match.trophyVelocity = { x: 0, y: 0, z: 0 };
        match.trophyGrabImmunity = HEIST.TROPHY_GRAB_IMMUNITY;
        match.trophyFallTimer = 0;

        // Broadcast settled position
        this.broadcastToMatch(match.id, {
          type: 'heist-trophy-settled',
          data: {
            matchId: match.id,
            position: { ...match.trophyPosition },
          },
        });
      }
    }

    // Update trophy position if carried (use carrier's last known position)
    // Note: clients handle visual carry position; server just tracks state
  }

  private updatePlayerCooldowns(match: HeistMatch, dt: number): void {
    for (const player of match.players.values()) {
      if (player.slamCooldown > 0) {
        player.slamCooldown -= dt;
      }
    }
  }

  private dropTrophy(match: HeistMatch, attackerPosition: Vector3): void {
    match.trophyCarrierId = null;
    match.trophyState = 'falling';
    match.trophyFallTimer = 0;

    // Give trophy some velocity based on direction from attacker
    const dx = match.trophyPosition.x - attackerPosition.x;
    const dz = match.trophyPosition.z - attackerPosition.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;

    match.trophyVelocity = {
      x: (dx / len) * 10 + (Math.random() - 0.5) * 8,
      y: 5,
      z: (dz / len) * 10 + (Math.random() - 0.5) * 8,
    };
  }

  private handleTimeExpired(match: HeistMatch): void {
    const players = Array.from(match.players.values());
    const scores = players.map(p => ({ id: p.id, score: p.score }));
    scores.sort((a, b) => b.score - a.score);

    if (scores.length >= 2 && scores[0].score === scores[1].score) {
      // Tied — enter overtime
      match.state = 'overtime';
      match.trophyCarrierId = null;
      match.trophyState = 'idle';
      match.trophyPosition = { x: 0, y: HEIST.TROPHY_HOVER_HEIGHT, z: 0 };
      match.trophyVelocity = { x: 0, y: 0, z: 0 };

      this.broadcastToMatch(match.id, {
        type: 'heist-overtime',
        data: { matchId: match.id },
      });
    } else {
      // Higher score wins
      match.state = 'complete';
      this.broadcastMatchEnd(match, scores[0].id);
    }
  }

  private broadcastMatchEnd(match: HeistMatch, winnerId: string): void {
    const stats: Record<string, { score: number }> = {};
    for (const [id, p] of match.players) {
      stats[id] = { score: p.score };
    }

    this.broadcastToMatch(match.id, {
      type: 'heist-match-end',
      data: {
        matchId: match.id,
        winnerId,
        stats,
      },
    });
  }

  private cleanupMatch(matchId: string): void {
    const match = this.matches.get(matchId);
    if (!match) return;

    for (const playerId of match.players.keys()) {
      this.playerToMatch.delete(playerId);
    }
    this.matches.delete(matchId);
  }

  /** Handle a player disconnecting */
  handlePlayerDisconnect(playerId: string): void {
    const matchId = this.playerToMatch.get(playerId);
    if (!matchId) return;

    const match = this.matches.get(matchId);
    if (!match) return;

    // End the match — disconnecting player forfeits
    match.state = 'complete';

    // Find the other player as winner
    for (const pid of match.players.keys()) {
      if (pid !== playerId) {
        this.broadcastMatchEnd(match, pid);
        break;
      }
    }

    this.cleanupMatch(matchId);
  }

  /** Get the match for a player */
  getMatchForPlayer(playerId: string): HeistMatch | null {
    const matchId = this.playerToMatch.get(playerId);
    return matchId ? this.matches.get(matchId) ?? null : null;
  }

  /** Check if a player is in a heist match */
  isInMatch(playerId: string): boolean {
    return this.playerToMatch.has(playerId);
  }

  /** Get trophy state for world state sync */
  getTrophyState(matchId: string): { position: Vector3; state: TrophyState; carrierId: string | null } | null {
    const match = this.matches.get(matchId);
    if (!match) return null;
    return {
      position: { ...match.trophyPosition },
      state: match.trophyState,
      carrierId: match.trophyCarrierId,
    };
  }
}
