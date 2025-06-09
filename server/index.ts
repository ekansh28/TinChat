// server/index.ts
import 'dotenv/config';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { initializeSupabase } from './config/supabase';
import { configureSocketIO } from './config/socketIO';
import { allowedOrigins } from './config/cors';
import { setupRoutes } from './routes/healthRoutes';
import { SocketManager } from './managers/SocketManager';
import { ProfileManager } from './managers/ProfileManager';
import { MessageBatcher } from './utils/MessageBatcher';
import { PerformanceMonitor } from './utils/PerformanceMonitor';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 3001;

// Initialize core services
const supabase = initializeSupabase();
const profileManager = new ProfileManager(supabase);
const messageBatcher = new MessageBatcher();
const performanceMonitor = new PerformanceMonitor();

// Create HTTP server
const server = http.createServer((req, res) => {
  const requestOrigin = req.headers.origin;
  let originToAllow = undefined;

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    originToAllow = requestOrigin;
  }

  if (originToAllow) {
    res.setHeader('Access-Control-Allow-Origin', originToAllow);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(originToAllow ? 204 : 403);
    res.end();
    return;
  }

  // Handle routes
  setupRoutes(req, res);
});

// Initialize Socket.IO with optimized configuration
const io = configureSocketIO(server, allowedOrigins);

// Initialize socket manager with all dependencies
const socketManager = new SocketManager(
  io,
  profileManager,
  messageBatcher,
  performanceMonitor
);

// Start the server
server.listen(PORT, () => {
  logger.info(`🚀 Enhanced Socket.IO Chat Server running on port ${PORT}`);
  logger.info(`📊 Performance monitoring: ${performanceMonitor.isEnabled ? 'enabled' : 'disabled'}`);
  logger.info(`🗄️  Supabase integration: ${supabase ? 'enabled' : 'disabled'}`);
  logger.info(`🌐 CORS origins: ${allowedOrigins.length} configured`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('🛑 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    logger.info('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('🛑 SIGINT received, shutting down gracefully...');
  server.close(() => {
    logger.info('✅ Server closed');
    process.exit(0);
  });
});

export { io, supabase, profileManager };