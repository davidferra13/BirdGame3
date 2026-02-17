/**
 * Race Manager — handles checkpoint race creation, joining, and progress tracking.
 */

import { Vector3, RaceState, RaceCheckpoint, RaceParticipant, GameEvent } from './types';
import { Player } from './Player';

const RACE_MAX_PARTICIPANTS = 8;
const RACE_WAIT_TIMEOUT_MS = 30000; // 30s max waiting
const RACE_COUNTDOWN_MS = 3000; // 3-2-1 countdown
const RACE_TIMEOUT_MS = 180000; // 3 minute max race duration
const CHECKPOINT_RADIUS = 15;

// Rewards by placement
const RACE_REWARDS = [500, 250, 100, 50, 25];

// Checkpoint counts by race type
const CHECKPOINT_COUNTS: Record<string, number> = {
  short: 5,
  medium: 8,
  long: 12,
};

let nextRaceId = 0;

export class RaceManager {
  private races: Map<string, RaceState> = new Map();
  private playerRaces: Map<string, string> = new Map(); // playerId -> raceId

  createRace(creatorId: string, creatorName: string, type: 'short' | 'medium' | 'long', creatorPosition: Vector3): RaceState | null {
    // Can't create if already in a race
    if (this.playerRaces.has(creatorId)) return null;

    const checkpointCount = CHECKPOINT_COUNTS[type] || 5;
    const checkpoints = this.generateCheckpoints(creatorPosition, checkpointCount);

    const race: RaceState = {
      id: `race_${nextRaceId++}`,
      creatorId,
      type,
      participants: [{
        playerId: creatorId,
        username: creatorName,
        currentCheckpoint: 0,
        finishTime: null,
      }],
      checkpoints,
      state: 'waiting',
      createdAt: Date.now(),
      startTime: 0,
      results: [],
    };

    this.races.set(race.id, race);
    this.playerRaces.set(creatorId, race.id);
    return race;
  }

  joinRace(raceId: string, playerId: string, username: string): boolean {
    const race = this.races.get(raceId);
    if (!race) return false;
    if (race.state !== 'waiting') return false;
    if (race.participants.length >= RACE_MAX_PARTICIPANTS) return false;
    if (this.playerRaces.has(playerId)) return false;
    if (race.participants.some(p => p.playerId === playerId)) return false;

    race.participants.push({
      playerId,
      username,
      currentCheckpoint: 0,
      finishTime: null,
    });
    this.playerRaces.set(playerId, raceId);
    return true;
  }

  startRace(raceId: string, requesterId: string): boolean {
    const race = this.races.get(raceId);
    if (!race) return false;
    if (race.creatorId !== requesterId) return false;
    if (race.state !== 'waiting') return false;
    if (race.participants.length < 1) return false;

    race.state = 'countdown';
    race.startTime = Date.now() + RACE_COUNTDOWN_MS;
    return true;
  }

  removePlayer(playerId: string): void {
    const raceId = this.playerRaces.get(playerId);
    if (!raceId) return;

    const race = this.races.get(raceId);
    if (!race) {
      this.playerRaces.delete(playerId);
      return;
    }

    race.participants = race.participants.filter(p => p.playerId !== playerId);
    this.playerRaces.delete(playerId);

    // If no participants left, remove race
    if (race.participants.length === 0) {
      this.races.delete(raceId);
    }
  }

  /**
   * Called each server tick. Returns events to emit.
   */
  update(players: Map<string, Player>): GameEvent[] {
    const events: GameEvent[] = [];
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [raceId, race] of this.races) {
      switch (race.state) {
        case 'waiting': {
          // Auto-timeout waiting races
          if (now - race.createdAt > RACE_WAIT_TIMEOUT_MS) {
            // Auto-start if at least 2 participants, otherwise cancel
            if (race.participants.length >= 2) {
              race.state = 'countdown';
              race.startTime = now + RACE_COUNTDOWN_MS;
              events.push({
                type: 'race_countdown',
                data: { raceId, startTime: race.startTime, participants: race.participants },
              });
            } else {
              toRemove.push(raceId);
            }
          }
          break;
        }

        case 'countdown': {
          if (now >= race.startTime) {
            race.state = 'racing';
            events.push({
              type: 'race_started',
              data: {
                raceId,
                checkpoints: race.checkpoints,
                participants: race.participants,
              },
            });
          }
          break;
        }

        case 'racing': {
          // Check if race has timed out
          if (now - race.startTime > RACE_TIMEOUT_MS) {
            this.finishRace(race, events);
            break;
          }

          // Check each participant's progress
          for (const participant of race.participants) {
            if (participant.finishTime !== null) continue; // already finished

            const player = players.get(participant.playerId);
            if (!player) continue;

            const nextCp = race.checkpoints[participant.currentCheckpoint];
            if (!nextCp) continue;

            // Check if player is within checkpoint radius
            const dx = player.position.x - nextCp.position.x;
            const dy = player.position.y - nextCp.position.y;
            const dz = player.position.z - nextCp.position.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (dist <= nextCp.radius) {
              participant.currentCheckpoint++;

              events.push({
                type: 'race_checkpoint',
                data: {
                  raceId,
                  playerId: participant.playerId,
                  checkpoint: participant.currentCheckpoint,
                  total: race.checkpoints.length,
                },
              });

              // Check if finished
              if (participant.currentCheckpoint >= race.checkpoints.length) {
                participant.finishTime = now - race.startTime;
                const place = race.results.length + 1;
                race.results.push({
                  playerId: participant.playerId,
                  username: participant.username,
                  time: participant.finishTime,
                  place,
                });

                // Award coins
                const reward = RACE_REWARDS[place - 1] || 10;
                player.addCoins(reward);

                console.log(`🏁 ${participant.username} finished race in place #${place} (${(participant.finishTime / 1000).toFixed(1)}s) +${reward} coins`);
              }
            }
          }

          // Check if all participants have finished
          const allFinished = race.participants.every(p => p.finishTime !== null);
          if (allFinished) {
            this.finishRace(race, events);
          }
          break;
        }

        case 'finished': {
          // Clean up finished races after 10 seconds
          if (now - race.startTime > RACE_TIMEOUT_MS + 10000) {
            toRemove.push(raceId);
          }
          break;
        }
      }
    }

    // Clean up
    for (const raceId of toRemove) {
      const race = this.races.get(raceId);
      if (race) {
        for (const p of race.participants) {
          this.playerRaces.delete(p.playerId);
        }
        this.races.delete(raceId);
      }
    }

    return events;
  }

  private finishRace(race: RaceState, events: GameEvent[]): void {
    race.state = 'finished';
    events.push({
      type: 'race_finished',
      data: {
        raceId: race.id,
        results: race.results,
        participants: race.participants,
      },
    });

    // Clean up player-race mappings
    for (const p of race.participants) {
      this.playerRaces.delete(p.playerId);
    }

    console.log(`🏁 Race ${race.id} finished! Results: ${race.results.map(r => `${r.place}. ${r.username}`).join(', ')}`);
  }

  getRaceForEvent(event: GameEvent): RaceState | null {
    const raceId = event.data?.raceId;
    if (!raceId) return null;
    return this.races.get(raceId) || null;
  }

  getActiveRaceForPlayer(playerId: string): RaceState | null {
    const raceId = this.playerRaces.get(playerId);
    if (!raceId) return null;
    return this.races.get(raceId) || null;
  }

  private generateCheckpoints(nearPosition: Vector3, count: number): RaceCheckpoint[] {
    const checkpoints: RaceCheckpoint[] = [];
    // Generate checkpoints in a rough loop around the map
    const mapRadius = 90; // stay within map bounds (±115 but with margin)
    const centerX = 0;
    const centerZ = 0;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const distance = 40 + Math.random() * (mapRadius - 40);
      checkpoints.push({
        position: {
          x: centerX + Math.cos(angle) * distance,
          y: 15 + Math.random() * 40, // varied altitude (15-55)
          z: centerZ + Math.sin(angle) * distance,
        },
        radius: CHECKPOINT_RADIUS,
      });
    }

    return checkpoints;
  }
}
