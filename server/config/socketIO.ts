// server/config/socketIO.ts
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from '../utils/logger';

// High-performance Socket.IO configuration based on 2024-2025 best practices
export function configureSocketIO(server: HTTPServer, allowedOrigins: string[]): SocketIOServer {
  const io = new SocketIOServer(server, {
    // Connection options
    connectionStateRecovery: {
      // Enable connection state recovery for reliability
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: true,
    },
    
    // Performance optimizations
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 10000,
    maxHttpBufferSize: 1e6, // 1MB
    
    // Enable compression for better performance
    compression: true,
    
    // CORS configuration
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
    
    // Advanced options for production
    allowEIO3: false, // Only allow Engine.IO v4+
    serveClient: false, // Don't serve client files
    
    // Adapter configuration for clustering (if needed)
    // adapter: require('socket.io-redis')({ host: 'localhost', port: 6379 })
  });

  // Performance monitoring
  io.engine.on('connection_error', (err) => {
    logger.error('Engine.IO connection error:', {
      req: err.req?.url,
      code: err.code,
      message: err.message,
      context: err.context,
    });
  });

  // Memory optimization for production
  io.engine.on('connection', (rawSocket) => {
    // Discard HTTP request reference to free memory
    rawSocket.request = null;
  });

  // Log connection statistics
  setInterval(() => {
    const stats = {
      connectedSockets: io.engine.clientsCount,
      rooms: io.sockets.adapter.rooms.size,
      memory: process.memoryUsage(),
    };
    logger.debug('📊 Server stats:', stats);
  }, 30000); // Every 30 seconds

  logger.info('⚡ Socket.IO server configured with performance optimizations');
  
  return io;
}

// Advanced connection rate limiting (optional)
export class ConnectionRateLimiter {
  private connections = new Map<string, number[]>();
  private readonly maxConnections: number;
  private readonly windowMs: number;

  constructor(maxConnections = 5, windowMs = 60000) {
    this.maxConnections = maxConnections;
    this.windowMs = windowMs;
  }

  isAllowed(ip: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    const connections = this.connections.get(ip) || [];
    const recentConnections = connections.filter(time => time > windowStart);
    
    if (recentConnections.length >= this.maxConnections) {
      return false;
    }
    
    recentConnections.push(now);
    this.connections.set(ip, recentConnections);
    
    return true;
  }

  cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    for (const [ip, connections] of this.connections.entries()) {
      const recentConnections = connections.filter(time => time > windowStart);
      if (recentConnections.length === 0) {
        this.connections.delete(ip);
      } else {
        this.connections.set(ip, recentConnections);
      }
    }
  }
}