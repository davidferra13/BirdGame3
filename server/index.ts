/**
 * Bird Game 3D - Realtime Server Entry Point
 */

import dotenv from 'dotenv';
import { GameServer } from './GameServer';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || process.env.WS_PORT || '3001', 10);

// Create and start game server
const server = new GameServer(PORT);
server.start();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down server...');
  server.stop();
  process.exit(0);
});
