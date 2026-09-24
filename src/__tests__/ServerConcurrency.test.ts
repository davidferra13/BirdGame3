// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { GameServer } from '../../server/GameServer';

const SYNTHETIC_CLIENTS = 100;
const sockets: WebSocket[] = [];
let server: GameServer | null = null;

function waitForBoundPort(instance: GameServer): Promise<number> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 3000;
    const poll = () => {
      const address = instance.address();
      if (address && typeof address === 'object') {
        resolve(address.port);
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error('Server did not bind within 3 seconds'));
        return;
      }
      setTimeout(poll, 10);
    };
    poll();
  });
}

function connectSyntheticClient(port: number, index: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    sockets.push(socket);
    const timeout = setTimeout(() => reject(new Error(`client ${index} join timed out`)), 5000);
    socket.on('open', () => {
      socket.send(JSON.stringify({
        type: 'join',
        data: {
          playerId: `loadtest_${index}`,
          username: `Synthetic ${index}`,
          worldId: 'global-1',
        },
      }));
    });

    socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type === 'welcome') {
        clearTimeout(timeout);
        resolve();
      }
      if (message.type === 'error') {
        clearTimeout(timeout);
        reject(new Error(`client ${index}: ${message.data?.message || 'unknown error'}`));
      }
    });
    socket.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

afterEach(async () => {
  for (const socket of sockets.splice(0)) {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.terminate();
    }
  }
  if (server) {
    await server.stop();
    server = null;
  }
});
describe('server concurrency acceptance', () => {
  it('accepts at least 100 simultaneous synthetic sessions and reports them accurately', async () => {
    process.env.BOT_MIN = '0';
    process.env.BOT_MAX = '0';
    process.env.BOT_TARGET_POPULATION = '0';

    server = new GameServer(0, '127.0.0.1');
    server.start();
    const port = await waitForBoundPort(server);

    await Promise.all(
      Array.from({ length: SYNTHETIC_CLIENTS }, (_, index) => connectSyntheticClient(port, index)),
    );

    const response = await fetch(`http://127.0.0.1:${port}/status`);
    expect(response.status).toBe(200);
    const status = await response.json() as {
      connectedHumanSessions: number;
      targetConnectedHumanSessions: number;
      connectedHumanSessionGap: number;
      botPlayers: number;
      maxHumanPlayers: number;
    };

    expect(status.connectedHumanSessions).toBe(SYNTHETIC_CLIENTS);
    expect(status.targetConnectedHumanSessions).toBe(100);
    expect(status.connectedHumanSessionGap).toBe(0);
    expect(status.botPlayers).toBe(0);
    expect(status.maxHumanPlayers).toBeGreaterThanOrEqual(SYNTHETIC_CLIENTS);
  }, 15000);
});
