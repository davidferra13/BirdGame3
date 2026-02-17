/**
 * Bot Manager
 * Manages the lifecycle of AI bot players.
 * Spawns bots to fill the server, staggers joins/leaves for realism,
 * and drives bot behavior updates each tick.
 *
 * Chat is driven by BotChatEngine — event-triggered, personality-filtered
 * messages with realistic pacing.
 */

import { BotPlayer } from './BotPlayer';
import { BotChatEngine } from './BotChatEngine';
import { WorldState } from './WorldState';
import { Vector3 } from './types';

interface BotManagerConfig {
  /** Minimum bots always present */
  minBots: number;
  /** Target player count (bots + real players) */
  targetPopulation: number;
  /** Maximum bots allowed */
  maxBots: number;
  /** Seconds between bot join/leave evaluations */
  evaluationInterval: number;
  /** Minimum seconds between bot joins (stagger) */
  joinStagger: number;
}

const DEFAULT_CONFIG: BotManagerConfig = {
  minBots: 3,
  targetPopulation: 8,
  maxBots: 15,
  evaluationInterval: 5,
  joinStagger: 3,
};

export class BotManager {
  private bots: Map<string, BotPlayer> = new Map();
  private world: WorldState;
  private config: BotManagerConfig;
  private chatEngine: BotChatEngine;

  // Timing
  private evaluationTimer = 0;
  private lastJoinTime = 0;
  private socialTimer = 0;

  // Callbacks for the GameServer to handle
  onBotJoined: ((bot: BotPlayer) => void) | null = null;
  onBotLeft: ((botId: string) => void) | null = null;
  onBotPoop: ((bot: BotPlayer, velocity: Vector3) => void) | null = null;
  onBotBank: ((bot: BotPlayer) => void) | null = null;
  onBotBankComplete: ((bot: BotPlayer) => void) | null = null;
  onBotChat: ((botId: string, username: string, message: string) => void) | null = null;

  constructor(world: WorldState, config?: Partial<BotManagerConfig>) {
    this.world = world;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.chatEngine = new BotChatEngine();
  }

  /**
   * Initialize bots. Called once after server starts.
   * Stagger initial bot spawns over a few seconds.
   */
  initialize(): void {
    // Spawn initial bots with staggered timing
    const initialCount = this.config.minBots;
    for (let i = 0; i < initialCount; i++) {
      setTimeout(() => this.spawnBot(), i * 2000); // 2s stagger
    }
    console.log(`BotManager initialized. Target population: ${this.config.targetPopulation}`);
  }

  /**
   * Main update - called every server tick.
   */
  update(dt: number, realPlayerCount: number): void {
    // Update evaluation timer
    this.evaluationTimer += dt;

    // Evaluate population needs periodically
    if (this.evaluationTimer >= this.config.evaluationInterval) {
      this.evaluationTimer = 0;
      this.evaluatePopulation(realPlayerCount);
    }

    // Gather all real player positions for PvP awareness
    const realPlayerPositions: Vector3[] = [];
    for (const player of this.world.getAllPlayers()) {
      // Only include real players (not bots)
      if (!this.bots.has(player.id)) {
        realPlayerPositions.push({ ...player.position });
      }
    }

    // Update each bot
    const toRemove: string[] = [];
    for (const [botId, bot] of this.bots) {
      // Get nearby player positions for this bot's PvP awareness
      const nearbyPlayers = this.getNearbyPositions(bot, realPlayerPositions);

      const alive = bot.update(dt, nearbyPlayers);
      if (!alive) {
        toRemove.push(botId);
        continue;
      }

      // Check if bot wants to poop (use last behavior output)
      if (bot.behavior.poopIntent && bot.player.canPoop()) {
        bot.player.recordPoop();
        this.onBotPoop?.(bot, bot.getPoopVelocity());
      }

      // Check banking
      if (bot.wantsToBank()) {
        const started = bot.player.startBanking();
        if (started) {
          this.onBotBank?.(bot);
        }
      }

      // Check bank completion
      if (bot.player.state === 'BANKING') {
        const result = bot.player.completeBanking();
        if (result) {
          bot.behavior.onBankComplete();
          this.onBotBankComplete?.(bot);
          bot.behavior.coins = 0;
          // Trigger chat engine event
          this.chatEngine.onBotBanked(botId);
        }
      }

      // Detect PvP state changes for chat triggers
      const nowStunned = bot.player.isStunned();
      if (nowStunned && !bot.prevStunned) {
        // Bot just got stunned (hit by poop) — chat engine already notified via notifyBotHit
      }
      bot.prevStunned = nowStunned;
      bot.prevCoins = bot.player.coins;
    }

    // Remove expired bots (farewell chat before removal)
    for (const botId of toRemove) {
      this.chatEngine.onBotLeaving(botId);
      this.removeBot(botId);
    }

    // Occasional social initiation
    this.socialTimer += dt;
    if (this.socialTimer >= 30 + Math.random() * 60) {
      this.socialTimer = 0;
      this.chatEngine.tryInitiateSocial();
    }

    // Process chat engine queue — flush ready messages
    const outgoing = this.chatEngine.update(dt);
    for (const msg of outgoing) {
      this.onBotChat?.(msg.botId, msg.username, msg.message);
      // Feed bot's own message back into chat engine so other bots can respond
      this.chatEngine.onChatReceived(msg.botId, msg.username, msg.message);
    }
  }

  /**
   * Evaluate whether to add or remove bots based on real player count.
   */
  private evaluatePopulation(realPlayerCount: number): void {
    const currentBotCount = this.bots.size;
    const totalPopulation = realPlayerCount + currentBotCount;
    const now = Date.now() / 1000;

    // Need more bots?
    if (totalPopulation < this.config.targetPopulation &&
        currentBotCount < this.config.maxBots &&
        now - this.lastJoinTime >= this.config.joinStagger) {
      this.spawnBot();
      this.lastJoinTime = now;
    }

    // Too many bots? (real players joined, reduce bots)
    if (currentBotCount > this.config.minBots &&
        totalPopulation > this.config.targetPopulation + 2) {
      // Remove the bot with the shortest remaining session
      let shortestSession: BotPlayer | null = null;
      let shortestRemaining = Infinity;
      for (const bot of this.bots.values()) {
        const remaining = (bot as any).sessionDuration - (bot as any).sessionTimer;
        if (remaining < shortestRemaining) {
          shortestRemaining = remaining;
          shortestSession = bot;
        }
      }
      if (shortestSession) {
        this.chatEngine.onBotLeaving(shortestSession.botId);
        this.removeBot(shortestSession.botId);
      }
    }
  }

  private spawnBot(): void {
    const spawnPos = this.world.getSpawnPosition();
    const bot = new BotPlayer(spawnPos);

    this.bots.set(bot.botId, bot);
    this.world.addPlayer(bot.player);

    // Register with chat engine and trigger join greeting
    this.chatEngine.registerBot(bot.botId, bot.player.username);
    this.chatEngine.onBotJoined(bot.botId);

    this.onBotJoined?.(bot);
    console.log(`Bot joined: ${bot.player.username} (${bot.botId}) [${bot.getArchetype()}] [${this.bots.size} bots]`);
  }

  private removeBot(botId: string): void {
    const bot = this.bots.get(botId);
    if (!bot) return;

    this.chatEngine.unregisterBot(botId);
    this.world.removePlayer(botId);
    bot.destroy();
    this.bots.delete(botId);

    this.onBotLeft?.(botId);
    console.log(`Bot left: ${bot.player.username} (${botId}) [${this.bots.size} bots]`);
  }

  private getNearbyPositions(bot: BotPlayer, allPositions: Vector3[]): Vector3[] {
    const result: Vector3[] = [];
    const bx = bot.player.position.x;
    const by = bot.player.position.y;
    const bz = bot.player.position.z;
    const rangeSq = 200 * 200;

    for (const pos of allPositions) {
      const dx = pos.x - bx;
      const dy = pos.y - by;
      const dz = pos.z - bz;
      if (dx * dx + dy * dy + dz * dz < rangeSq) {
        result.push(pos);
      }
    }
    return result;
  }

  /** Notify a bot that it was hit by another player's poop */
  notifyBotHit(botId: string, attackerPos: Vector3 | null): void {
    const bot = this.bots.get(botId);
    if (bot) {
      bot.notifyHit(attackerPos);
      this.chatEngine.onBotGotHit(botId);
    }
  }

  /** Notify a bot that its poop hit another player */
  notifyBotPoopHit(botId: string): void {
    const bot = this.bots.get(botId);
    if (bot) {
      bot.notifyPoopHit();
      this.chatEngine.onBotHitSomeone(botId);
    }
  }

  /**
   * Called by GameServer when a real player (or any non-bot) sends a chat message.
   * Gives bots a chance to respond.
   */
  onExternalChat(senderId: string, username: string, message: string): void {
    this.chatEngine.onChatReceived(senderId, username, message);
  }

  getBotCount(): number {
    return this.bots.size;
  }

  isBot(playerId: string): boolean {
    return this.bots.has(playerId);
  }

  /** Get all bot IDs */
  getBotIds(): string[] {
    return Array.from(this.bots.keys());
  }

  /** Cleanup all bots (server shutdown) */
  destroyAll(): void {
    for (const [botId, bot] of this.bots) {
      this.world.removePlayer(botId);
      bot.destroy();
    }
    this.bots.clear();
  }
}
