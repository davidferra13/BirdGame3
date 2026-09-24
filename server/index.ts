/** Bird Game 3D - realtime server entry point. */
import 'dotenv/config';
import { GameServer } from './GameServer.js';

const rawPort = process.env.PORT || process.env.WS_PORT || '3001';
const port = Number(rawPort);
if (!/^\d+$/.test(rawPort) || !Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error('PORT/WS_PORT must be an integer between 0 and 65535');
}
const server = new GameServer(port);
server.start();

let stopping = false;
const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  console.log('Shutting down Bird Game server...');
  try { await server.stop(); }
  catch (error) { console.error('Shutdown failed:', error); process.exitCode = 1; }
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
