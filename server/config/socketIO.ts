// ===== server/config/socketIO.ts - Fixed Configuration =====
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from '../utils/logger';

export function configureSocketIO(server: HTTPServer, allowedOrigins: string[]): SocketIOServer {
  const io = new SocketIOServer(server, {
    // ✅ FIXED: Enhanced connection state recovery
    connectionStateRecovery: {
      maxDisconnectionDuration: 5 * 60 * 1000, // 5 minutes (increased from 2)
      skipMiddlewares: true,
    },
    
    // ✅ FIXED: Improved ping settings to prevent timeout disconnections
    transports: ['websocket', 'polling'],
    pingTimeout: 120000,     // 2 minutes (increased from 60s)
    pingInterval: 30000,     // 30 seconds (increased from 25s)
    upgradeTimeout: 30000,   // 30 seconds (increased from 10s)
    maxHttpBufferSize: 5e6,  // 5MB (increased from 1MB) to prevent large payload disconnections
    
    // ✅ FIXED: Enhanced WebSocket configuration
    allowUpgrades: true,
    perMessageDeflate: {
      threshold: 1024,
      concurrencyLimit: 10,
      memLevel: 7,
    },
    
    // ✅ REMOVED: Invalid compression property
    httpCompression: true,   // This is valid
    // compression: true,    // ❌ REMOVED: This doesn't exist in Socket.IO
    
    // CORS configuration remains the same
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
    allowEIO3: false,
    serveClient: false,
    
    // ✅ FIXED: Better connection timeout handling
    connectTimeout: 60000, // 1 minute for initial connection
    
    // ✅ FIXED: Enhanced engine.io settings (these are valid)
    destroyUpgrade: false,
    destroyUpgradeTimeout: 1000,
  });

  // ✅ FIXED: Enhanced error handling for better debugging
  io.engine.on('connection_error', (err: any) => {
    logger.error('🔌 Engine.IO connection error:', {
      req: err.req?.url,
      code: err.code,
      message: err.message,
      context: err.context,
      headers: err.req?.headers,
      userAgent: err.req?.headers?.['user-agent'],
    });
  });

  // ✅ FIXED: Better connection monitoring
  io.engine.on('connection', (rawSocket: any) => {
    logger.debug(`🔗 New engine connection: ${rawSocket.id}`, {
      transport: rawSocket.transport.name,
      userAgent: rawSocket.request?.headers?.['user-agent'],
      remoteAddress: rawSocket.request?.connection?.remoteAddress,
    });
    
    // Memory optimization - clear the request object
    if (rawSocket.request) {
      rawSocket.request = null;
    }
  });

  // ✅ FIXED: Enhanced disconnection monitoring
  io.engine.on('disconnect', (reason: string) => {
    logger.debug(`⚠️ Engine disconnection: ${reason}`);
  });

  // ✅ FIXED: Monitor transport upgrades
  io.engine.on('upgrade', (socket: any) => {
    logger.debug(`⬆️ Transport upgraded to: ${socket.transport.name}`);
  });

  // ✅ FIXED: Monitor transport downgrades
  io.engine.on('upgradeError', (error: Error) => {
    logger.warn(`⬇️ Transport upgrade failed:`, error.message);
  });

  // ✅ FIXED: Enhanced connection statistics with disconnect reasons
  const connectionStats = {
    totalConnections: 0,
    activeConnections: 0,
    disconnectReasons: new Map<string, number>(),
    transportTypes: new Map<string, number>(),
  };

  io.on('connection', (socket) => {
    connectionStats.totalConnections++;
    connectionStats.activeConnections++;
    
    const transport = socket.conn.transport.name;
    connectionStats.transportTypes.set(transport, (connectionStats.transportTypes.get(transport) || 0) + 1);
    
    logger.debug(`👤 Socket connected: ${socket.id}`, {
      transport,
      totalConnections: connectionStats.totalConnections,
      activeConnections: connectionStats.activeConnections,
    });

    // ✅ FIXED: Enhanced disconnect handling with reason tracking
    socket.on('disconnect', (reason: string) => {
      connectionStats.activeConnections = Math.max(0, connectionStats.activeConnections - 1);
      connectionStats.disconnectReasons.set(reason, (connectionStats.disconnectReasons.get(reason) || 0) + 1);
      
      logger.info(`👋 Socket disconnected: ${socket.id}`, {
        reason,
        activeConnections: connectionStats.activeConnections,
        disconnectCounts: Object.fromEntries(connectionStats.disconnectReasons),
      });
    });

    // ✅ FIXED: Monitor transport changes during session
    socket.conn.on('upgrade', () => {
      logger.debug(`🔄 Socket ${socket.id} upgraded to: ${socket.conn.transport.name}`);
    });

    socket.conn.on('upgradeError', (error: Error) => {
      logger.warn(`❌ Socket ${socket.id} upgrade failed:`, error.message);
    });
  });

  // ✅ FIXED: Enhanced periodic statistics with disconnect analysis
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const stats = {
      connectedSockets: io.engine.clientsCount,
      rooms: io.sockets.adapter.rooms.size,
      memoryUsage: {
        heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
        rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)}MB`,
      },
      connectionStats,
      topDisconnectReasons: Array.from(connectionStats.disconnectReasons.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    };
    
    logger.debug('🔌 Socket.IO detailed stats:', stats);
    
    // ✅ FIXED: Alert on concerning disconnect patterns
    const pingTimeouts = connectionStats.disconnectReasons.get('ping timeout') || 0;
    const transportCloses = connectionStats.disconnectReasons.get('transport close') || 0;
    const totalDisconnects = Array.from(connectionStats.disconnectReasons.values()).reduce((a, b) => a + b, 0);
    
    if (totalDisconnects > 0) {
      const pingTimeoutRate = (pingTimeouts / totalDisconnects) * 100;
      const transportCloseRate = (transportCloses / totalDisconnects) * 100;
      
      if (pingTimeoutRate > 30) {
        logger.warn(`🚨 High ping timeout rate: ${pingTimeoutRate.toFixed(1)}% - consider adjusting ping settings`);
      }
      
      if (transportCloseRate > 20) {
        logger.warn(`🚨 High transport close rate: ${transportCloseRate.toFixed(1)}% - possible proxy/network issues`);
      }
    }
  }, 30000); // Every 30 seconds

  // ✅ FIXED: Graceful shutdown handling
  const gracefulShutdown = (signal: string) => {
    logger.info(`🛑 ${signal} received, closing Socket.IO server gracefully...`);
    io.close(() => {
      logger.info('✅ Socket.IO server closed gracefully');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  logger.info('⚡ Socket.IO server configured with enhanced stability settings');
  
  return io;
}