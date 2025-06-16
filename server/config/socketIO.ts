// server/config/socketIO.ts - Socket.IO Configuration
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from '../utils/logger';

export function configureSocketIO(server: HTTPServer, allowedOrigins: string[]): SocketIOServer {
  const io = new SocketIOServer(server, {
    // Connection state recovery for better reliability
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: true,
    },
    
    // Performance optimizations
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,      // 60 seconds
    pingInterval: 25000,     // 25 seconds
    upgradeTimeout: 10000,   // 10 seconds
    maxHttpBufferSize: 1e6,  // 1MB
    
    // CORS configuration for ProfileCustomizer integration
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn(`🚫 CORS denied for origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
    
    // Security and performance settings
    allowEIO3: false,        // Disable Engine.IO v3 for security
    serveClient: false,      // Don't serve client files
  });

  // Enhanced error handling for better debugging
  io.engine.on('connection_error', (err) => {
    logger.error('🔌 Engine.IO connection error:', {
      req: err.req?.url,
      code: err.code,
      message: err.message,
      context: err.context,
    });
  });

  // Memory optimization - discard HTTP request after connection
  io.engine.on('connection', (rawSocket) => {
    rawSocket.request = null; // Free memory
  });

  // Connection statistics logging
  setInterval(() => {
    const stats = {
      connectedSockets: io.engine.clientsCount,
      rooms: io.sockets.adapter.rooms.size,
      memoryUsage: {
        heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB`,
        heapTotal: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)}MB`
      }
    };
    logger.debug('🔌 Socket.IO stats:', stats);
  }, 30000); // Every 30 seconds

  logger.info('⚡ Socket.IO server configured with ProfileCustomizer optimizations');
  
  return io;
}4