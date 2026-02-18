/**
 * Main Game Server
 * Server-authoritative realtime multiplayer game server
 * with AOI filtering, backpressure handling, PvP, and racing.
 */

import WebSocket, { WebSocketServer } from 'ws';
import { createServer, IncomingMessage } from 'http';
import { WorldState } from './WorldState';
import { Player } from './Player';
import { BotManager } from './BotManager';
import { ClientMessage, ServerMessage, PlayerInput, ChatMessage } from './types';
import { MvMManager } from './MvMManager';
import { MurmurationState } from './MurmurationState';
import { HeistManager } from './HeistManager';

interface AuthenticatedSocket extends WebSocket {
  playerId?: string;
  isAlive?: boolean;
}

/** Maximum concurrent players */
const MAX_PLAYERS = 500;

/** Maximum WebSocket buffer before skipping sends (backpressure) */
const MAX_BUFFER_SIZE = 64 * 1024; // 64KB

/** How often to log server stats (ticks) */
const STATS_LOG_INTERVAL_TICKS = 1200; // every 60s at 20 ticks/s

/** Chat rate limit: 1 message per second per player */
const CHAT_RATE_LIMIT_MS = 1000;
const CHAT_MAX_LENGTH = 150;
const WORLD_ID = (process.env.WORLD_ID || 'global-1').trim();

export class GameServer {
  private wss: WebSocketServer;
  private world: WorldState;
  private clients: Map<string, AuthenticatedSocket>;
  private tickInterval: NodeJS.Timeout | null;
  private heartbeatInterval: NodeJS.Timeout | null;
  private tickCount = 0;
  private botManager: BotManager;
  private mvmManager: MvMManager;
  private murmurationState: MurmurationState;
  private heistManager: HeistManager;
  private chatRateLimit: Map<string, number> = new Map();

  constructor(port: number = 3001) {
    const httpServer = createServer();
    this.wss = new WebSocketServer({ server: httpServer });
    this.world = new WorldState();
    this.clients = new Map();
    this.tickInterval = null;
    this.heartbeatInterval = null;

    // Initialize bot manager
    this.botManager = new BotManager(this.world);
    this.setupBotCallbacks();
    this.setupPvPBotCallbacks();

    // Initialize Murmuration systems
    this.mvmManager = new MvMManager((playerId, msg) => {
      const client = this.clients.get(playerId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(msg));
      }
    });
    this.murmurationState = new MurmurationState((playerId, msg) => {
      const client = this.clients.get(playerId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(msg));
      }
    });

    // Initialize Heist manager
    this.heistManager = new HeistManager(
      (playerId, msg) => {
        const client = this.clients.get(playerId);
        if (client && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(msg));
        }
      },
      (matchId, msg) => {
        // Broadcast to all players in the match
        for (const [pid, client] of this.clients) {
          if (client.readyState === WebSocket.OPEN && this.heistManager.isInMatch(pid)) {
            client.send(JSON.stringify(msg));
          }
        }
      },
    );

    this.setupWebSocketHandlers();

    httpServer.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use! Another server is running on this port.`);
        console.error(`   Kill the other process or change WS_PORT in .env`);
        process.exit(1);
      }
      throw err;
    });

    httpServer.listen(port, '0.0.0.0', () => {
      console.log(`Bird Game 3D Server running on 0.0.0.0:${port}`);
      console.log(`   Tick Rate: ${this.world.TICK_RATE} ticks/sec`);
      console.log(`   Max Players: ${MAX_PLAYERS}`);
      console.log(`   Waiting for players...`);
    });
  }

  private setupWebSocketHandlers(): void {
    this.wss.on('connection', (ws: AuthenticatedSocket, req: IncomingMessage) => {
      ws.isAlive = true;

      // Heartbeat pong
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (data: Buffer) => {
        try {
          const message: ClientMessage = JSON.parse(data.toString());
          this.handleClientMessage(ws, message);
        } catch (error) {
          console.error('Error parsing client message:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        if (ws.playerId) {
          this.handlePlayerDisconnect(ws.playerId);
        }
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  private handleClientMessage(ws: AuthenticatedSocket, message: ClientMessage): void {
    switch (message.type) {
      case 'join':
        this.handlePlayerJoin(ws, message.data);
        break;

      case 'update':
        this.handlePlayerUpdate(ws, message.data);
        break;

      case 'poop':
        this.handlePoopDrop(ws, message.data);
        break;

      case 'bank':
        this.handleBanking(ws);
        break;

      case 'bank_complete':
        this.handleBankComplete(ws);
        break;

      case 'bank_cancel':
        this.handleBankCancel(ws);
        break;

      case 'race_create':
        this.handleRaceCreate(ws, message.data);
        break;

      case 'race_join':
        this.handleRaceJoin(ws, message.data);
        break;

      case 'race_ready':
        this.handleRaceReady(ws, message.data);
        break;

      case 'chat':
        this.handleChat(ws, message.data);
        break;

      case 'leave':
        if (ws.playerId) {
          this.handlePlayerDisconnect(ws.playerId);
        }
        break;

      // MvM queue messages
      case 'mvm_queue_join':
        this.handleMvMQueueJoin(ws, message.data);
        break;

      case 'mvm_queue_leave':
        this.handleMvMQueueLeave(ws);
        break;

      // Murmuration chat relay
      case 'murmuration_chat':
        this.handleMurmurationChat(ws, message.data);
        break;

      // PvP messages — broadcast to all connected clients
      case 'pvp-join':
      case 'pvp-leave':
      case 'pvp-tag-transfer':
      case 'pvp-checkpoint':
      case 'pvp-hit':
        this.broadcastPvPMessage(ws, message);
        break;

      // Heist messages — server-authoritative
      case 'heist-join':
        this.handleHeistJoin(ws);
        break;
      case 'heist-grab':
        this.handleHeistGrab(ws, message.data);
        break;
      case 'heist-slam':
        this.handleHeistSlam(ws, message.data);
        break;
      case 'heist-score':
        this.handleHeistScore(ws, message.data);
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  private handlePlayerJoin(ws: AuthenticatedSocket, data: any): void {
    const rawPlayerId = typeof data?.playerId === 'string' ? data.playerId.trim() : '';
    const rawUsername = typeof data?.username === 'string' ? data.username.trim() : '';
    const rawWorldId = typeof data?.worldId === 'string' ? data.worldId.trim() : '';

    if (!rawPlayerId) {
      this.sendError(ws, 'Missing playerId');
      return;
    }
    if (!rawWorldId || rawWorldId !== WORLD_ID) {
      this.sendError(ws, 'World mismatch');
      return;
    }

    let playerId = rawPlayerId;
    const username = rawUsername || (playerId.startsWith('guest_') ? `Bird_${playerId.slice(-4)}` : 'Player');

    // Check player limit
    if (this.clients.size >= MAX_PLAYERS) {
      this.sendError(ws, 'Server full');
      ws.close();
      return;
    }

    // Check if player already exists
    if (this.clients.has(playerId)) {
      // Guest collisions are common (multiple tabs/windows). Auto-dedupe instead of rejecting.
      if (playerId.startsWith('guest_')) {
        playerId = `${playerId}_${Math.random().toString(36).substring(2, 7)}`;
      } else {
        this.sendError(ws, 'Player already connected');
        return;
      }
    }

    // Create new player
    const spawnPos = this.world.getSpawnPosition();
    const player = new Player(playerId, username, spawnPos);
    this.world.addPlayer(player);

    // Register client
    ws.playerId = playerId;
    this.clients.set(playerId, ws);

    // Send welcome message (full snapshot for initial load)
    this.send(ws, {
      type: 'welcome',
      data: {
        playerId,
        spawnPosition: spawnPos,
        worldState: this.world.getSnapshot(),
      },
    });

    // Broadcast to others
    this.broadcastExcept(playerId, {
      type: 'player_joined',
      data: { player: player.toState() },
    });

    console.log(`Player joined: ${username} (${playerId}) [${this.clients.size}/${MAX_PLAYERS}]`);
  }

  private handlePlayerUpdate(ws: AuthenticatedSocket, data: PlayerInput): void {
    if (!ws.playerId) return;

    const player = this.world.getPlayer(ws.playerId);
    if (!player) return;

    player.updateFromInput(data);
  }

  private handlePoopDrop(ws: AuthenticatedSocket, data: any): void {
    if (!ws.playerId) return;

    const player = this.world.getPlayer(ws.playerId);
    if (!player) return;

    if (!player.canPoop()) {
      return;
    }

    player.recordPoop();

    const velocity = data.velocity || { x: 0, y: -2, z: 0 };

    // Register poop for PvP collision tracking on server
    this.world.addActivePoop(ws.playerId, player.position, velocity);

    // Broadcast poop drop to other clients
    this.broadcastExcept(ws.playerId, {
      type: 'poop',
      data: {
        playerId: ws.playerId,
        position: player.position,
        velocity,
      },
    });
  }

  private handleBanking(ws: AuthenticatedSocket): void {
    if (!ws.playerId) return;

    const player = this.world.getPlayer(ws.playerId);
    if (!player) return;

    if (!player.startBanking()) {
      this.sendError(ws, 'Cannot start banking');
      return;
    }

    console.log(`Player ${player.username} started banking (${player.coins} coins)`);
  }

  private handleBankComplete(ws: AuthenticatedSocket): void {
    if (!ws.playerId) return;

    const player = this.world.getPlayer(ws.playerId);
    if (!player) return;

    const result = player.completeBanking();
    if (!result) {
      this.sendError(ws, 'Banking not complete yet');
      return;
    }

    this.broadcast({
      type: 'player_banked',
      data: {
        playerId: ws.playerId,
        coins: result.coins,
        xp: result.xp,
      },
    });

    console.log(`Player ${player.username} banked ${result.coins} coins (+${result.xp} XP)`);
  }

  private handleBankCancel(ws: AuthenticatedSocket): void {
    if (!ws.playerId) return;

    const player = this.world.getPlayer(ws.playerId);
    if (!player) return;

    player.cancelBanking();
  }

  // --- Racing ---

  private handleRaceCreate(ws: AuthenticatedSocket, data: any): void {
    if (!ws.playerId) return;

    const player = this.world.getPlayer(ws.playerId);
    if (!player) return;

    const type = data?.type || 'short';
    if (!['short', 'medium', 'long'].includes(type)) return;

    const race = this.world.raceManager.createRace(ws.playerId, player.username, type, player.position);
    if (!race) {
      this.sendError(ws, 'Cannot create race (already in one?)');
      return;
    }

    // Notify the creator via an event in their next state update
    console.log(`Race created: ${race.id} (${type}) by ${player.username}`);
  }

  private handleRaceJoin(ws: AuthenticatedSocket, data: any): void {
    if (!ws.playerId) return;

    const player = this.world.getPlayer(ws.playerId);
    if (!player) return;

    const raceId = data?.raceId;
    if (!raceId) return;

    const joined = this.world.raceManager.joinRace(raceId, ws.playerId, player.username);
    if (!joined) {
      this.sendError(ws, 'Cannot join race');
    }
  }

  private handleRaceReady(ws: AuthenticatedSocket, data: any): void {
    if (!ws.playerId) return;

    const raceId = data?.raceId;
    if (!raceId) return;

    this.world.raceManager.startRace(raceId, ws.playerId);
  }

  // --- Chat ---

  private handleChat(ws: AuthenticatedSocket, data: any): void {
    if (!ws.playerId) return;

    const player = this.world.getPlayer(ws.playerId);
    if (!player) return;

    const message = typeof data?.message === 'string' ? data.message.trim() : '';
    if (!message || message.length > CHAT_MAX_LENGTH) return;

    // Rate limit
    const now = Date.now();
    const lastChat = this.chatRateLimit.get(ws.playerId) || 0;
    if (now - lastChat < CHAT_RATE_LIMIT_MS) return;
    this.chatRateLimit.set(ws.playerId, now);

    // Broadcast to all clients
    const chatMsg: ChatMessage = {
      playerId: ws.playerId,
      username: player.username,
      message,
      timestamp: now,
    };

    this.broadcast({
      type: 'chat',
      data: chatMsg,
    });

    // Let bots see the message so they can respond
    this.botManager.onExternalChat(ws.playerId!, player.username, message);
  }

  // --- MvM Queue ---

  private handleMvMQueueJoin(ws: AuthenticatedSocket, data: any): void {
    if (!ws.playerId) return;

    const player = this.world.getPlayer(ws.playerId);
    if (!player) return;

    this.mvmManager.addToQueue({
      murmurationId: data?.murmurationId || '',
      murmurationName: data?.murmurationName || '',
      murmurationTag: data?.murmurationTag || '',
      formationLevel: data?.formationLevel || 1,
      mode: data?.mode || 'team_poop_tag',
      teamSize: data?.teamSize || 2,
      playerIds: data?.playerIds || [ws.playerId],
      queuedAt: Date.now(),
    });
  }

  private handleMvMQueueLeave(ws: AuthenticatedSocket): void {
    if (!ws.playerId) return;
    this.mvmManager.removeFromQueue(ws.playerId);
  }

  // --- Murmuration Chat Relay ---

  private handleMurmurationChat(ws: AuthenticatedSocket, data: any): void {
    if (!ws.playerId) return;

    const murmurationId = data?.murmurationId;
    if (!murmurationId) return;

    const player = this.world.getPlayer(ws.playerId);
    if (!player) return;

    const message = typeof data?.message === 'string' ? data.message.trim() : '';
    if (!message) return;

    this.murmurationState.relayChatMessage(ws.playerId, message, player.username);
  }

  // --- Heist ---

  private handleHeistJoin(ws: AuthenticatedSocket): void {
    if (!ws.playerId) return;
    // For now, heist matchmaking is handled client-side via PvPManager.
    // This endpoint is reserved for future server-authoritative matchmaking.
    // The client creates the match locally and uses heist-grab/slam/score for validation.
  }

  private handleHeistGrab(ws: AuthenticatedSocket, data: any): void {
    if (!ws.playerId) return;
    const position = data?.position;
    if (!position) return;
    this.heistManager.handleGrabRequest(ws.playerId, position);
  }

  private handleHeistSlam(ws: AuthenticatedSocket, data: any): void {
    if (!ws.playerId) return;
    const position = data?.position;
    const speed = data?.speed ?? 0;
    if (!position) return;
    this.heistManager.handleSlamRequest(ws.playerId, position, speed);
  }

  private handleHeistScore(ws: AuthenticatedSocket, data: any): void {
    if (!ws.playerId) return;
    const position = data?.position;
    if (!position) return;
    this.heistManager.handleScoreRequest(ws.playerId, position);
  }

  // --- PvP Broadcast ---

  /**
   * Broadcast PvP messages to all connected clients (except sender).
   * Server acts as a relay — client-side PvPManager handles state.
   */
  private broadcastPvPMessage(ws: AuthenticatedSocket, message: ClientMessage): void {
    if (!ws.playerId) return;

    const outgoing = JSON.stringify({
      type: message.type,
      data: { ...message.data, playerId: ws.playerId },
    });

    for (const [id, client] of this.clients) {
      if (id === ws.playerId) continue;
      if (client.readyState === WebSocket.OPEN && (client.bufferedAmount || 0) < MAX_BUFFER_SIZE) {
        client.send(outgoing);
      }
    }
  }

  // --- Disconnect ---

  private handlePlayerDisconnect(playerId: string): void {
    this.world.removePlayer(playerId);
    this.clients.delete(playerId);
    this.chatRateLimit.delete(playerId);

    // Clean up MvM match/queue for disconnected player
    this.mvmManager.handlePlayerDisconnect(playerId);

    // Clean up Heist match for disconnected player
    this.heistManager.handlePlayerDisconnect(playerId);

    // Unregister from Murmuration tracking
    this.murmurationState.unregisterPlayer(playerId);

    this.broadcast({
      type: 'player_left',
      data: { playerId },
    });
  }

  // --- Bot Callbacks ---

  private setupBotCallbacks(): void {
    this.botManager.onBotJoined = (bot) => {
      // Broadcast bot join to all real clients (looks like a real player joining)
      this.broadcast({
        type: 'player_joined',
        data: { player: bot.player.toState() },
      });
    };

    this.botManager.onBotLeft = (botId) => {
      this.broadcast({
        type: 'player_left',
        data: { playerId: botId },
      });
    };

    this.botManager.onBotPoop = (bot, velocity) => {
      // Register poop for PvP collision tracking
      this.world.addActivePoop(bot.botId, bot.player.position, velocity);

      // Broadcast poop drop to all real clients
      this.broadcast({
        type: 'poop',
        data: {
          playerId: bot.botId,
          position: bot.player.position,
          velocity,
        },
      });
    };

    this.botManager.onBotBank = (bot) => {
      console.log(`Bot ${bot.player.username} started banking (${bot.player.coins} coins)`);
    };

    this.botManager.onBotBankComplete = (bot) => {
      this.broadcast({
        type: 'player_banked',
        data: {
          playerId: bot.botId,
          coins: 0,
          xp: 0,
        },
      });
      console.log(`Bot ${bot.player.username} banked coins`);
    };

    this.botManager.onBotChat = (botId, username, message) => {
      const chatMsg: ChatMessage = {
        playerId: botId,
        username,
        message,
        timestamp: Date.now(),
      };
      this.broadcast({
        type: 'chat',
        data: chatMsg,
      });
    };
  }

  // --- PvP Bot Notifications ---

  private setupPvPBotCallbacks(): void {
    this.world.onPvPHit = (result) => {
      // Notify victim bot (reactive behavior: chase or flee)
      if (this.botManager.isBot(result.victimId)) {
        const attacker = this.world.getPlayer(result.attackerId);
        this.botManager.notifyBotHit(
          result.victimId,
          attacker ? { ...attacker.position } : null,
        );
      }

      // Notify attacker bot (contextual chat: "gotcha!")
      if (this.botManager.isBot(result.attackerId)) {
        this.botManager.notifyBotPoopHit(result.attackerId);
      }
    };
  }

  // --- Game Loop ---

  start(): void {
    const tickDt = this.world.TICK_INTERVAL / 1000;
    this.tickInterval = setInterval(() => {
      try {
        this.tick(tickDt);
      } catch (error) {
        console.error('Error in server tick:', error);
      }
    }, this.world.TICK_INTERVAL);

    // Heartbeat ping every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws: WebSocket) => {
        const socket = ws as AuthenticatedSocket;
        if (socket.isAlive === false) {
          console.log('Terminating dead connection');
          return socket.terminate();
        }
        socket.isAlive = false;
        socket.ping();
      });
    }, 30000);

    // Start bot manager (spawns initial bots after short delay)
    this.botManager.initialize();

    console.log('Game loop started');
  }

  private tick(dt: number): void {
    this.tickCount++;

    // Update world state (poop physics, race progress, heat decay, etc.)
    this.world.update(dt);

    // Update bots
    this.botManager.update(dt, this.clients.size);

    // Update MvM matches (countdown timers, round state, scoring)
    this.mvmManager.update(dt);

    // Update Heist matches (trophy physics, timers)
    this.heistManager.update(dt);

    // Per-client AOI-filtered state sends (replaces old broadcast-all)
    for (const [playerId, client] of this.clients) {
      if (client.readyState !== WebSocket.OPEN) continue;

      // Backpressure: skip if client's send buffer is too full
      if (client.bufferedAmount > MAX_BUFFER_SIZE) continue;

      const player = this.world.getPlayer(playerId);
      if (!player) continue;

      const filtered = this.world.getFilteredSnapshot(player);
      this.send(client, { type: 'state', data: filtered });
    }

    // Periodic stats logging
    if (this.tickCount % STATS_LOG_INTERVAL_TICKS === 0) {
      const botCount = this.botManager.getBotCount();
      console.log(`[Stats] Players: ${this.clients.size} real + ${botCount} bots = ${this.world.getPlayerCount()} total | Tick: ${this.tickCount}`);
    }
  }

  // --- Send Helpers ---

  private send(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private broadcast(message: ServerMessage): void {
    const data = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  private broadcastExcept(excludePlayerId: string, message: ServerMessage): void {
    const data = JSON.stringify(message);
    this.clients.forEach((client, playerId) => {
      if (playerId !== excludePlayerId && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  private sendError(ws: WebSocket, error: string): void {
    this.send(ws, {
      type: 'error',
      data: { message: error },
    });
  }

  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.botManager.destroyAll();
    this.wss.close();
    console.log('Server stopped');
  }
}
