/**
 * Main Game Server
 * Server-authoritative realtime multiplayer game server
 * with global player state broadcasts, backpressure handling, PvP, and racing.
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
  isAdmin?: boolean;
}

/** Supabase UUIDs of admin users (player IDs start with these) */
const ADMIN_USER_IDS: string[] = (process.env.ADMIN_USER_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

/** Maximum concurrent players */
const MAX_PLAYERS = 500;

/** Maximum WebSocket buffer before skipping sends (backpressure) */
const MAX_BUFFER_SIZE = 64 * 1024; // 64KB

/** Maximum incoming message size — protects against DoS via giant JSON payloads */
const MAX_MESSAGE_SIZE = 8 * 1024; // 8KB

/** How often to log server stats (ticks) */
const STATS_LOG_INTERVAL_TICKS = 1200; // every 60s at 20 ticks/s

/** Chat rate limit: 1 message per second per player */
const CHAT_RATE_LIMIT_MS = 1000;
const CHAT_MAX_LENGTH = 150;
const WORLD_ID = (process.env.WORLD_ID || 'global-1').trim();

type PvPModeId = 'poop-tag' | 'race' | 'poop-cover' | 'heist';
type PvPSessionPhase = 'lobby' | 'countdown' | 'active' | 'results';

interface PvPSession {
  id: string;        // unique session ID — stable across phase transitions
  modeId: PvPModeId;
  phase: PvPSessionPhase;
  participants: Set<string>;
  phaseEndsAt: number;
  lastStateBroadcastAt: number;
}

const PVP_LOBBY_DURATION_MS = 2000;
const PVP_COUNTDOWN_DURATION_MS = 3000;
const PVP_RESULTS_DURATION_MS = 10000;
const PVP_STATE_BROADCAST_INTERVAL_MS = 200;

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
  private mutedPlayers: Set<string> = new Set();       // playerId
  private frozenPlayers: Set<string> = new Set();      // playerId
  private bannedPlayerIds: Map<string, string> = new Map(); // supabase UUID → username
  private serverStartTime: number = Date.now();
  private pvpSessions: Map<string, PvPSession> = new Map();         // sessionId → session
  private playerPvPSession: Map<string, string> = new Map();         // playerId → sessionId
  private pvpActiveByMode: Map<PvPModeId, string> = new Map();       // modeId → current joinable sessionId

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
        // Guard against oversized messages (DoS protection)
        if (data.length > MAX_MESSAGE_SIZE) {
          this.sendError(ws, 'Message too large');
          return;
        }
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

      // PvP messages — server-authoritative session lifecycle + validated relay
      case 'pvp-join':
        this.handlePvPJoin(ws, message.data);
        break;
      case 'pvp-leave':
        this.handlePvPLeave(ws);
        break;
      case 'pvp-tag-transfer':
        this.handlePvPTagTransfer(ws, message.data);
        break;
      case 'pvp-checkpoint':
        this.handlePvPCheckpoint(ws, message.data);
        break;
      case 'pvp-hit':
        this.handlePvPStatueHit(ws, message.data);
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

      // Horse lasso (server-authoritative player wrangle)
      case 'lasso-cast':
        this.handleLassoCast(ws, message.data);
        break;
      case 'lasso-release':
        this.handleLassoRelease(ws);
        break;
      case 'lasso-breakout':
        this.handleLassoBreakout(ws, message.data);
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

    // Check ban list (authenticated players only — first 36 chars are the Supabase UUID)
    if (!playerId.startsWith('guest_')) {
      const uuid = playerId.substring(0, 36);
      if (this.bannedPlayerIds.has(uuid)) {
        this.sendError(ws, 'You are banned from this server');
        ws.close();
        return;
      }
    }

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
    ws.isAdmin = ADMIN_USER_IDS.filter((id) => id.length >= 36).some(
      (adminId) => playerId === adminId || playerId.startsWith(adminId + '_'),
    );
    this.clients.set(playerId, ws);

    // Send welcome message (full snapshot for initial load)
    this.send(ws, {
      type: 'welcome',
      data: {
        playerId,
        spawnPosition: spawnPos,
        worldState: this.world.getSnapshot(),
        isAdmin: ws.isAdmin,
      },
    });

    // Broadcast to others
    this.broadcastExcept(playerId, {
      type: 'player_joined',
      data: { player: player.toState() },
    });

    if (ws.isAdmin) {
      console.log(`[ADMIN] Admin joined: ${username} (${playerId}) [${this.clients.size}/${MAX_PLAYERS}]`);
    } else {
      console.log(`Player joined: ${username} (${playerId}) [${this.clients.size}/${MAX_PLAYERS}]`);
    }
  }

  private handlePlayerUpdate(ws: AuthenticatedSocket, data: PlayerInput): void {
    if (!ws.playerId) return;

    // Frozen players cannot move
    if (this.frozenPlayers.has(ws.playerId)) return;

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

    // Admin commands (bypass rate limit and mute)
    if (ws.isAdmin && message.startsWith('/')) {
      this.handleAdminCommand(ws, player.username, message);
      return;
    }

    // Block muted players
    if (this.mutedPlayers.has(ws.playerId)) return;

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

  // --- Admin Commands ---

  /** Send a private message back to the admin's own chat. */
  private adminReply(ws: AuthenticatedSocket, msg: string): void {
    this.send(ws, {
      type: 'chat',
      data: { playerId: 'server', username: '[Admin]', message: msg, timestamp: Date.now() },
    });
  }

  private handleAdminCommand(ws: AuthenticatedSocket, adminName: string, message: string): void {
    const parts = message.slice(1).split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {

      // ── Broadcast ──────────────────────────────────────────────────────────
      case 'announce': {
        const text = args.join(' ');
        if (!text) { this.adminReply(ws, 'Usage: /announce <message>'); break; }
        console.log(`[ADMIN] ${adminName} announced: ${text}`);
        this.broadcast({ type: 'admin_announce', data: { message: text, timestamp: Date.now() } });
        break;
      }

      // ── Kick ───────────────────────────────────────────────────────────────
      case 'kick': {
        const targetName = args[0];
        if (!targetName) { this.adminReply(ws, 'Usage: /kick <username>'); break; }
        const targetId = this.findPlayerIdByUsername(targetName);
        if (!targetId) { this.adminReply(ws, `Player not found: ${targetName}`); break; }
        const targetWs = this.clients.get(targetId);
        if (targetWs) {
          this.send(targetWs, { type: 'admin_kicked', data: { reason: 'Kicked by admin' } });
          targetWs.close();
        }
        console.log(`[ADMIN] ${adminName} kicked ${targetName}`);
        this.adminReply(ws, `Kicked ${targetName}`);
        break;
      }

      // ── Ban (kick + block rejoin this session) ─────────────────────────────
      case 'ban': {
        const targetName = args[0];
        if (!targetName) { this.adminReply(ws, 'Usage: /ban <username>'); break; }
        const targetId = this.findPlayerIdByUsername(targetName);
        if (!targetId) { this.adminReply(ws, `Player not found: ${targetName}`); break; }
        const uuid = targetId.startsWith('guest_') ? null : targetId.substring(0, 36);
        if (!uuid) { this.adminReply(ws, `Cannot ban guest players (no persistent ID)`); break; }
        this.bannedPlayerIds.set(uuid, targetName);
        const targetWs = this.clients.get(targetId);
        if (targetWs) {
          this.send(targetWs, { type: 'admin_kicked', data: { reason: 'Banned by admin' } });
          targetWs.close();
        }
        console.log(`[ADMIN] ${adminName} banned ${targetName} (${uuid})`);
        this.adminReply(ws, `Banned ${targetName} (UUID: ${uuid})`);
        break;
      }

      // ── Unban ──────────────────────────────────────────────────────────────
      case 'unban': {
        const input = args[0];
        if (!input) { this.adminReply(ws, 'Usage: /unban <username_or_uuid>'); break; }
        // Try by UUID first, then by stored username
        if (this.bannedPlayerIds.has(input)) {
          const username = this.bannedPlayerIds.get(input) ?? input;
          this.bannedPlayerIds.delete(input);
          console.log(`[ADMIN] ${adminName} unbanned ${username} (${input})`);
          this.adminReply(ws, `Unbanned ${username}`);
        } else {
          const entry = Array.from(this.bannedPlayerIds.entries()).find(
            ([, name]) => name.toLowerCase() === input.toLowerCase(),
          );
          if (entry) {
            this.bannedPlayerIds.delete(entry[0]);
            console.log(`[ADMIN] ${adminName} unbanned ${entry[1]} (${entry[0]})`);
            this.adminReply(ws, `Unbanned ${entry[1]}`);
          } else {
            this.adminReply(ws, `No ban found for: ${input}`);
          }
        }
        break;
      }

      // ── Ban list ───────────────────────────────────────────────────────────
      case 'banlist': {
        if (this.bannedPlayerIds.size === 0) {
          this.adminReply(ws, 'No players are banned.');
          break;
        }
        const list = Array.from(this.bannedPlayerIds.entries())
          .map(([uuid, name]) => `${name} (${uuid})`)
          .join(', ');
        this.adminReply(ws, `Banned (${this.bannedPlayerIds.size}): ${list}`);
        break;
      }

      // ── Mute ───────────────────────────────────────────────────────────────
      case 'mute': {
        const targetName = args[0];
        if (!targetName) { this.adminReply(ws, 'Usage: /mute <username>'); break; }
        const targetId = this.findPlayerIdByUsername(targetName);
        if (!targetId) { this.adminReply(ws, `Player not found: ${targetName}`); break; }
        this.mutedPlayers.add(targetId);
        console.log(`[ADMIN] ${adminName} muted ${targetName}`);
        this.adminReply(ws, `Muted ${targetName}`);
        break;
      }

      // ── Unmute ─────────────────────────────────────────────────────────────
      case 'unmute': {
        const targetName = args[0];
        if (!targetName) { this.adminReply(ws, 'Usage: /unmute <username>'); break; }
        const targetId = this.findPlayerIdByUsername(targetName);
        if (!targetId) { this.adminReply(ws, `Player not found: ${targetName}`); break; }
        this.mutedPlayers.delete(targetId);
        console.log(`[ADMIN] ${adminName} unmuted ${targetName}`);
        this.adminReply(ws, `Unmuted ${targetName}`);
        break;
      }

      // ── Mute list ──────────────────────────────────────────────────────────
      case 'mutelist': {
        if (this.mutedPlayers.size === 0) {
          this.adminReply(ws, 'No players are muted.');
          break;
        }
        const list = Array.from(this.mutedPlayers)
          .map((id) => this.world.getPlayer(id)?.username ?? id)
          .join(', ');
        this.adminReply(ws, `Muted (${this.mutedPlayers.size}): ${list}`);
        break;
      }

      // ── Warn (private message to a player) ────────────────────────────────
      case 'warn': {
        const targetName = args[0];
        const warnText = args.slice(1).join(' ');
        if (!targetName || !warnText) { this.adminReply(ws, 'Usage: /warn <username> <message>'); break; }
        const targetId = this.findPlayerIdByUsername(targetName);
        if (!targetId) { this.adminReply(ws, `Player not found: ${targetName}`); break; }
        const targetWs = this.clients.get(targetId);
        if (targetWs) {
          this.send(targetWs, {
            type: 'admin_warn',
            data: { message: warnText, timestamp: Date.now() },
          });
        }
        console.log(`[ADMIN] ${adminName} warned ${targetName}: ${warnText}`);
        this.adminReply(ws, `Warning sent to ${targetName}`);
        break;
      }

      // ── Freeze (infinite stun, movement blocked) ───────────────────────────
      case 'freeze': {
        const targetName = args[0];
        if (!targetName) { this.adminReply(ws, 'Usage: /freeze <username>'); break; }
        const targetId = this.findPlayerIdByUsername(targetName);
        if (!targetId) { this.adminReply(ws, `Player not found: ${targetName}`); break; }
        const target = this.world.getPlayer(targetId);
        if (!target) break;
        this.frozenPlayers.add(targetId);
        target.applyStun(99999); // ~28 hours — effectively permanent
        console.log(`[ADMIN] ${adminName} froze ${targetName}`);
        this.adminReply(ws, `Froze ${targetName}`);
        break;
      }

      // ── Unfreeze ───────────────────────────────────────────────────────────
      case 'unfreeze': {
        const targetName = args[0];
        if (!targetName) { this.adminReply(ws, 'Usage: /unfreeze <username>'); break; }
        const targetId = this.findPlayerIdByUsername(targetName);
        if (!targetId) { this.adminReply(ws, `Player not found: ${targetName}`); break; }
        const target = this.world.getPlayer(targetId);
        if (!target) break;
        this.frozenPlayers.delete(targetId);
        target.stunnedUntil = 0; // expire stun immediately — WorldState.updateStun() will restore state next tick
        console.log(`[ADMIN] ${adminName} unfroze ${targetName}`);
        this.adminReply(ws, `Unfroze ${targetName}`);
        break;
      }

      // ── Bring (teleport target to admin) ──────────────────────────────────
      case 'bring': {
        const targetName = args[0];
        if (!targetName) { this.adminReply(ws, 'Usage: /bring <username>'); break; }
        const targetId = this.findPlayerIdByUsername(targetName);
        if (!targetId) { this.adminReply(ws, `Player not found: ${targetName}`); break; }
        const adminPlayer = ws.playerId ? this.world.getPlayer(ws.playerId) : null;
        const targetPlayer = this.world.getPlayer(targetId);
        if (!adminPlayer || !targetPlayer) break;
        targetPlayer.position = { ...adminPlayer.position };
        const targetWs = this.clients.get(targetId);
        if (targetWs) {
          this.send(targetWs, {
            type: 'admin_teleport',
            data: { x: adminPlayer.position.x, y: adminPlayer.position.y, z: adminPlayer.position.z },
          });
        }
        console.log(`[ADMIN] ${adminName} brought ${targetName} to admin position`);
        this.adminReply(ws, `Teleported ${targetName} to your location`);
        break;
      }

      // ── Teleport admin to target ───────────────────────────────────────────
      case 'tp': {
        const targetName = args[0];
        if (!targetName) { this.adminReply(ws, 'Usage: /tp <username>'); break; }
        const targetId = this.findPlayerIdByUsername(targetName);
        if (!targetId) { this.adminReply(ws, `Player not found: ${targetName}`); break; }
        const targetPlayer = this.world.getPlayer(targetId);
        const adminPlayer = ws.playerId ? this.world.getPlayer(ws.playerId) : null;
        if (!targetPlayer || !adminPlayer) break;
        adminPlayer.position = { ...targetPlayer.position };
        this.send(ws, {
          type: 'admin_teleport',
          data: { x: targetPlayer.position.x, y: targetPlayer.position.y, z: targetPlayer.position.z },
        });
        console.log(`[ADMIN] ${adminName} teleported to ${targetName}`);
        this.adminReply(ws, `Teleported to ${targetName}`);
        break;
      }

      // ── Coins (give/take) ──────────────────────────────────────────────────
      case 'coins': {
        const targetName = args[0];
        const amount = parseInt(args[1] ?? '', 10);
        if (!targetName || isNaN(amount)) { this.adminReply(ws, 'Usage: /coins <username> <amount>'); break; }
        const targetId = this.findPlayerIdByUsername(targetName);
        if (!targetId) { this.adminReply(ws, `Player not found: ${targetName}`); break; }
        const target = this.world.getPlayer(targetId);
        if (!target) break;
        target.coins = Math.max(0, target.coins + amount);
        console.log(`[ADMIN] ${adminName} gave ${amount} coins to ${targetName} (now: ${target.coins})`);
        this.adminReply(ws, `${amount >= 0 ? 'Gave' : 'Took'} ${Math.abs(amount)} coins ${amount >= 0 ? 'to' : 'from'} ${targetName} (now: ${target.coins})`);
        break;
      }

      // ── Clear heat ─────────────────────────────────────────────────────────
      case 'clearheat': {
        const targetName = args[0];
        if (!targetName) { this.adminReply(ws, 'Usage: /clearheat <username>'); break; }
        const targetId = this.findPlayerIdByUsername(targetName);
        if (!targetId) { this.adminReply(ws, `Player not found: ${targetName}`); break; }
        const target = this.world.getPlayer(targetId);
        if (!target) break;
        target.updateHeat(-50); // bring to 0
        console.log(`[ADMIN] ${adminName} cleared heat for ${targetName}`);
        this.adminReply(ws, `Cleared heat for ${targetName}`);
        break;
      }

      // ── Set heat ───────────────────────────────────────────────────────────
      case 'setheat': {
        const targetName = args[0];
        const level = parseInt(args[1] ?? '', 10);
        if (!targetName || isNaN(level)) { this.adminReply(ws, 'Usage: /setheat <username> <0-50>'); break; }
        const targetId = this.findPlayerIdByUsername(targetName);
        if (!targetId) { this.adminReply(ws, `Player not found: ${targetName}`); break; }
        const target = this.world.getPlayer(targetId);
        if (!target) break;
        const clamped = Math.max(0, Math.min(50, level));
        target.heat = clamped;
        target.wantedFlag = clamped >= 15;
        if (!target.isStunned()) {
          target.state = clamped >= 15 ? 'WANTED' : 'NORMAL';
        }
        console.log(`[ADMIN] ${adminName} set ${targetName} heat to ${clamped}`);
        this.adminReply(ws, `Set ${targetName}'s heat to ${clamped}`);
        break;
      }

      // ── Players list ───────────────────────────────────────────────────────
      case 'players': {
        const realCount = this.clients.size;
        const botCount = this.botManager.getBotCount();
        const list = Array.from(this.clients.entries())
          .map(([id]) => {
            const p = this.world.getPlayer(id);
            const flags = [
              this.mutedPlayers.has(id) ? 'muted' : '',
              this.frozenPlayers.has(id) ? 'frozen' : '',
              (id as AuthenticatedSocket['playerId']) && (this.clients.get(id) as AuthenticatedSocket)?.isAdmin ? 'admin' : '',
            ].filter(Boolean).join(',');
            return `${p?.username ?? id}${flags ? ` [${flags}]` : ''}`;
          })
          .join(', ');
        this.adminReply(ws, `Players (${realCount} real + ${botCount} bots): ${list || 'none'}`);
        break;
      }

      // ── Bot list ───────────────────────────────────────────────────────────
      case 'bots': {
        const summaries = this.botManager.getBotSummaries();
        if (summaries.length === 0) { this.adminReply(ws, 'No bots active.'); break; }
        const list = summaries.map((b) => b.username).join(', ');
        this.adminReply(ws, `Bots (${summaries.length}): ${list}`);
        break;
      }

      // ── Spawn one bot ──────────────────────────────────────────────────────
      case 'spawnbot': {
        this.botManager.spawnOneBot();
        console.log(`[ADMIN] ${adminName} force-spawned a bot`);
        this.adminReply(ws, `Spawned a bot (total bots: ${this.botManager.getBotCount()})`);
        break;
      }

      // ── Clear all bots ─────────────────────────────────────────────────────
      case 'clearbots': {
        const count = this.botManager.getBotCount();
        const botIds = this.botManager.getBotIds();
        for (const botId of botIds) {
          this.botManager.removeOneBot(botId);
          this.broadcast({ type: 'player_left', data: { playerId: botId } });
        }
        console.log(`[ADMIN] ${adminName} cleared ${count} bots`);
        this.adminReply(ws, `Removed ${count} bots`);
        break;
      }

      // ── Clear poop projectiles ─────────────────────────────────────────────
      case 'clearpoops': {
        this.world.clearActivePoops();
        console.log(`[ADMIN] ${adminName} cleared active poops`);
        this.adminReply(ws, 'Cleared all active poop projectiles');
        break;
      }

      // ── Force-end a PvP session ────────────────────────────────────────────
      case 'endpvp': {
        const modeArg = args[0]?.toLowerCase() as PvPModeId | undefined;
        let ended = 0;
        for (const [sessionId, session] of this.pvpSessions) {
          if (!modeArg || session.modeId === modeArg) {
            this.broadcastToPvPSession(session, {
              type: 'pvp-mode-end',
              data: { mode: session.modeId, results: { reason: 'admin-ended' } },
            });
            for (const participantId of session.participants) {
              this.playerPvPSession.delete(participantId);
            }
            this.pvpSessions.delete(sessionId);
            if (this.pvpActiveByMode.get(session.modeId) === sessionId) {
              this.pvpActiveByMode.delete(session.modeId);
            }
            ended++;
          }
        }
        console.log(`[ADMIN] ${adminName} force-ended ${ended} PvP session(s)`);
        this.adminReply(ws, ended > 0 ? `Ended ${ended} PvP session(s)` : 'No active PvP sessions found');
        break;
      }

      // ── Server info ────────────────────────────────────────────────────────
      case 'info': {
        const uptimeSec = Math.floor((Date.now() - this.serverStartTime) / 1000);
        const hours = Math.floor(uptimeSec / 3600);
        const mins = Math.floor((uptimeSec % 3600) / 60);
        const secs = uptimeSec % 60;
        const uptime = `${hours}h ${mins}m ${secs}s`;
        const realPlayers = this.clients.size;
        const bots = this.botManager.getBotCount();
        const poops = this.world.getActivePoopCount();
        const activePvP = this.pvpSessions.size;
        const muted = this.mutedPlayers.size;
        const frozen = this.frozenPlayers.size;
        const banned = this.bannedPlayerIds.size;
        this.adminReply(ws,
          `Server info — Uptime: ${uptime} | Players: ${realPlayers} real + ${bots} bots | ` +
          `Active poops: ${poops} | PvP sessions: ${activePvP} | ` +
          `Muted: ${muted} | Frozen: ${frozen} | Banned: ${banned}`,
        );
        break;
      }

      // ── Help ───────────────────────────────────────────────────────────────
      case 'help': {
        const cmds = [
          '/announce <msg>', '/kick <name>', '/ban <name>', '/unban <name>', '/banlist',
          '/mute <name>', '/unmute <name>', '/mutelist', '/warn <name> <msg>',
          '/freeze <name>', '/unfreeze <name>', '/bring <name>', '/tp <name>',
          '/coins <name> <±amt>', '/clearheat <name>', '/setheat <name> <0-50>',
          '/players', '/bots', '/spawnbot', '/clearbots',
          '/clearpoops', '/endpvp [mode]', '/info',
        ];
        this.adminReply(ws, `Commands: ${cmds.join(' | ')}`);
        break;
      }

      default:
        this.adminReply(ws, `Unknown: /${cmd}. Type /help for command list.`);
    }
  }

  /** Find a connected player's ID by their username (case-insensitive). */
  private findPlayerIdByUsername(username: string): string | null {
    const lower = username.toLowerCase();
    for (const [id] of this.clients) {
      const p = this.world.getPlayer(id);
      if (p && p.username.toLowerCase() === lower) return id;
    }
    return null;
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

  private handleLassoCast(ws: AuthenticatedSocket, data: any): void {
    if (!ws.playerId) return;

    const targetId = typeof data?.targetId === 'string' ? data.targetId : '';
    if (!targetId) return;

    this.world.requestPlayerLasso(ws.playerId, targetId);
  }

  private handleLassoRelease(ws: AuthenticatedSocket): void {
    if (!ws.playerId) return;
    this.world.releaseLassoByAttacker(ws.playerId, 'released');
  }

  private handleLassoBreakout(ws: AuthenticatedSocket, data: any): void {
    if (!ws.playerId) return;
    const pulse = typeof data?.pulse === 'number' ? data.pulse : 1;
    this.world.registerLassoBreakoutPulse(ws.playerId, pulse);
  }

  // --- PvP Sessions (Server-authoritative round lifecycle) ---

  private isPvPModeId(modeId: string): modeId is PvPModeId {
    return modeId === 'poop-tag' || modeId === 'race' || modeId === 'poop-cover' || modeId === 'heist';
  }

  private getPvPRoundDurationMs(modeId: PvPModeId): number {
    switch (modeId) {
      case 'poop-tag': return 120_000;
      case 'race': return 90_000;
      case 'poop-cover': return 75_000;
      case 'heist': return 180_000;
      default: return 90_000;
    }
  }

  private getPvPSessionForPlayer(playerId: string): PvPSession | null {
    const sessionId = this.playerPvPSession.get(playerId);
    if (!sessionId) return null;
    return this.pvpSessions.get(sessionId) || null;
  }

  private buildPvPState(session: PvPSession, now: number): any {
    const players = Array.from(session.participants).map((playerId) => {
      const p = this.world.getPlayer(playerId);
      return {
        id: playerId,
        username: p?.username || playerId,
      };
    });

    return {
      mode: session.modeId,
      phase: session.phase,
      timeRemaining: Math.max(0, (session.phaseEndsAt - now) / 1000),
      players,
      serverTimestamp: now,
    };
  }

  private broadcastPvPState(session: PvPSession): void {
    const now = Date.now();
    const state = this.buildPvPState(session, now);
    const payload = JSON.stringify({ type: 'pvp-state-update', data: state });

    for (const playerId of session.participants) {
      const client = this.clients.get(playerId);
      if (client && client.readyState === WebSocket.OPEN && (client.bufferedAmount || 0) < MAX_BUFFER_SIZE) {
        client.send(payload);
      }
    }

    session.lastStateBroadcastAt = now;
  }

  private broadcastToPvPSession(
    session: PvPSession,
    message: ServerMessage,
    excludePlayerId?: string,
  ): void {
    const payload = JSON.stringify(message);
    for (const playerId of session.participants) {
      if (excludePlayerId && playerId === excludePlayerId) continue;
      const client = this.clients.get(playerId);
      if (client && client.readyState === WebSocket.OPEN && (client.bufferedAmount || 0) < MAX_BUFFER_SIZE) {
        client.send(payload);
      }
    }
  }

  private removePlayerFromPvPSession(playerId: string): void {
    const sessionId = this.playerPvPSession.get(playerId);
    if (!sessionId) return;

    const session = this.pvpSessions.get(sessionId);
    this.playerPvPSession.delete(playerId);
    if (!session) return;

    session.participants.delete(playerId);

    if (session.participants.size === 0) {
      this.pvpSessions.delete(sessionId);
      // Also remove from mode index if this was the active session.
      if (this.pvpActiveByMode.get(session.modeId) === sessionId) {
        this.pvpActiveByMode.delete(session.modeId);
      }
      return;
    }

    // Keep session alive with remaining players.
    this.broadcastPvPState(session);
  }

  private handlePvPJoin(ws: AuthenticatedSocket, data: any): void {
    if (!ws.playerId) return;

    const modeIdRaw = typeof data?.modeId === 'string' ? data.modeId.trim() : '';
    if (!this.isPvPModeId(modeIdRaw)) {
      this.sendError(ws, 'Invalid PvP mode');
      return;
    }
    const modeId = modeIdRaw;
    const now = Date.now();

    // Leave previous session first if switching modes.
    const existingSessionId = this.playerPvPSession.get(ws.playerId);
    if (existingSessionId) {
      const existingSession = this.pvpSessions.get(existingSessionId);
      if (!existingSession || existingSession.modeId !== modeId) {
        this.removePlayerFromPvPSession(ws.playerId);
      } else {
        // Already in a lobby/countdown for this mode — no-op.
        if (existingSession.phase === 'lobby' || existingSession.phase === 'countdown') {
          return;
        }
      }
    }

    // Find the current joinable session for this mode (lobby or countdown only).
    const activeSessionId = this.pvpActiveByMode.get(modeId);
    let session = activeSessionId ? this.pvpSessions.get(activeSessionId) : undefined;

    // If the active session is already running or finishing, create a new lobby.
    if (!session || session.phase === 'active' || session.phase === 'results') {
      const sessionId = `${modeId}_${now}`;
      session = {
        id: sessionId,
        modeId,
        phase: 'lobby',
        participants: new Set<string>(),
        phaseEndsAt: now + PVP_LOBBY_DURATION_MS,
        lastStateBroadcastAt: 0,
      };
      this.pvpSessions.set(sessionId, session);
      this.pvpActiveByMode.set(modeId, sessionId);
    }

    session.participants.add(ws.playerId);
    this.playerPvPSession.set(ws.playerId, session.id);
    this.broadcastPvPState(session);
  }

  private handlePvPLeave(ws: AuthenticatedSocket): void {
    if (!ws.playerId) return;
    this.removePlayerFromPvPSession(ws.playerId);
  }

  private handlePvPTagTransfer(ws: AuthenticatedSocket, data: any): void {
    if (!ws.playerId) return;
    const session = this.getPvPSessionForPlayer(ws.playerId);
    if (!session || session.phase !== 'active') return;

    const targetId = typeof data?.to === 'string' ? data.to : typeof data?.targetId === 'string' ? data.targetId : '';
    if (!targetId || !session.participants.has(targetId)) return;

    this.broadcastToPvPSession(session, {
      type: 'pvp-tag-transfer',
      data: { from: ws.playerId, to: targetId },
    });
  }

  private handlePvPCheckpoint(ws: AuthenticatedSocket, data: any): void {
    if (!ws.playerId) return;
    const session = this.getPvPSessionForPlayer(ws.playerId);
    if (!session || session.phase !== 'active') return;

    const checkpoint = Number(data?.checkpoint);
    if (!Number.isFinite(checkpoint)) return;

    this.broadcastToPvPSession(session, {
      type: 'pvp-checkpoint',
      data: { playerId: ws.playerId, checkpoint },
    });
  }

  private handlePvPStatueHit(ws: AuthenticatedSocket, data: any): void {
    if (!ws.playerId) return;
    const session = this.getPvPSessionForPlayer(ws.playerId);
    if (!session || session.phase !== 'active') return;

    this.broadcastToPvPSession(session, {
      type: 'pvp-hit',
      data: {
        playerId: ws.playerId,
        points: Number(data?.points) || 0,
        accuracy: Number(data?.accuracy) || 0,
        hitPosition: data?.hitPosition || null,
      },
    });
  }

  private updatePvPSessions(): void {
    const now = Date.now();

    for (const [sessionId, session] of this.pvpSessions) {
      // Prune disconnected players.
      for (const participantId of Array.from(session.participants)) {
        if (!this.clients.has(participantId)) {
          session.participants.delete(participantId);
          this.playerPvPSession.delete(participantId);
        }
      }

      if (session.participants.size === 0) {
        this.pvpSessions.delete(sessionId);
        if (this.pvpActiveByMode.get(session.modeId) === sessionId) {
          this.pvpActiveByMode.delete(session.modeId);
        }
        continue;
      }

      let phaseChanged = false;
      if (session.phase === 'lobby' && now >= session.phaseEndsAt) {
        session.phase = 'countdown';
        session.phaseEndsAt = now + PVP_COUNTDOWN_DURATION_MS;
        phaseChanged = true;
      } else if (session.phase === 'countdown' && now >= session.phaseEndsAt) {
        session.phase = 'active';
        session.phaseEndsAt = now + this.getPvPRoundDurationMs(session.modeId);
        phaseChanged = true;

        this.broadcastToPvPSession(session, {
          type: 'pvp-mode-start',
          data: this.buildPvPState(session, now),
        });
      } else if (session.phase === 'active' && now >= session.phaseEndsAt) {
        session.phase = 'results';
        session.phaseEndsAt = now + PVP_RESULTS_DURATION_MS;
        phaseChanged = true;

        // Open a new lobby so late joiners can queue for the next round.
        if (this.pvpActiveByMode.get(session.modeId) === sessionId) {
          this.pvpActiveByMode.delete(session.modeId);
        }

        this.broadcastToPvPSession(session, {
          type: 'pvp-mode-end',
          data: {
            mode: session.modeId,
            results: { reason: 'time-up' },
          },
        });
      } else if (session.phase === 'results' && now >= session.phaseEndsAt) {
        for (const participantId of session.participants) {
          this.playerPvPSession.delete(participantId);
        }
        this.pvpSessions.delete(sessionId);
        if (this.pvpActiveByMode.get(session.modeId) === sessionId) {
          this.pvpActiveByMode.delete(session.modeId);
        }
        continue;
      }

      if (phaseChanged || now - session.lastStateBroadcastAt >= PVP_STATE_BROADCAST_INTERVAL_MS) {
        this.broadcastPvPState(session);
      }
    }
  }

  // --- Disconnect ---

  private handlePlayerDisconnect(playerId: string): void {
    this.removePlayerFromPvPSession(playerId);
    this.world.removePlayer(playerId);
    this.clients.delete(playerId);
    this.chatRateLimit.delete(playerId);
    this.mutedPlayers.delete(playerId);
    this.frozenPlayers.delete(playerId);

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

    // Update PvP session lifecycle (lobby/countdown/active/results).
    this.updatePvPSessions();

    // Per-client global state sends (all players every tick)
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
