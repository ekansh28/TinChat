// ===== Enhanced server/index.ts - Complete Fix =====
import 'dotenv/config';
import http from 'http';
import { setCorsHeaders } from './config/cors';
import { setupRoutes, updateGlobalStats } from './routes/healthRoutes';
import { configureSocketIO } from './config/socketIO';
import { initializeSupabase, testDatabaseConnection } from './config/supabase';
import { SocketManager } from './managers/SocketManager';
import { ProfileManager } from './managers/ProfileManager';
import { MessageBatcher } from './utils/MessageBatcher';
import { PerformanceMonitor } from './utils/PerformanceMonitor';
import { logger } from './utils/logger';

// ✅ FIXED: Enhanced server configuration
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ✅ FIXED: CORS origins configuration
const allowedOrigins = [
  "https://studio--chitchatconnect-aqa0w.us-central1.hosted.app",
  "https://delightful-pond-0cb3e0010.6.azurestaticapps.net", 
  "https://tinchat.online",
  "https://www.tinchat.online",
  "https://6000-idx-studio-1746229586647.cluster-73qgvk7hjjadkrjeyexca5ivva.cloudworkstations.dev",
  "http://localhost:9002",
  "http://localhost:3000",
  "http://localhost:3001"
];

if (NODE_ENV === 'development') {
  allowedOrigins.push(
    "http://localhost:8080",
    "http://localhost:8000", 
    "http://127.0.0.1:3000",
    "http://127.0.0.1:9002"
  );
}

// ✅ FIXED: Enhanced HTTP server with proper error handling
const server = http.createServer((req, res) => {
  try {
    const requestOrigin = req.headers.origin;
    setCorsHeaders(res, requestOrigin);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Use enhanced route handling
    setupRoutes(req, res);
  } catch (error) {
    logger.error('HTTP server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

// ✅ FIXED: Enhanced error handling for the server
server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    logger.error('❌ Server error:', error);
  }
});

server.on('clientError', (error: any, socket: any) => {
  logger.warn('Client error:', error.message);
  if (socket.writable) {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  }
});

// ✅ FIXED: Enhanced initialization sequence
async function initializeServer() {
  try {
    logger.info('🚀 Starting TinChat server initialization...');

    // Initialize Supabase
    const supabase = initializeSupabase();
    if (supabase) {
      const dbHealthy = await testDatabaseConnection(supabase);
      if (!dbHealthy) {
        logger.warn('⚠️ Database connection issues detected, continuing with limited functionality');
      }
    }

    // Initialize performance monitoring
    const performanceMonitor = new PerformanceMonitor();
    
    // ✅ FIXED: Configure Socket.IO with enhanced settings
    const io = configureSocketIO(server, allowedOrigins);
    
    // Initialize message batching for performance
    const messageBatcher = new MessageBatcher();
    messageBatcher.setSocketIOInstance(io);
    
    // Initialize profile manager
    const profileManager = new ProfileManager(supabase);
    
    // ✅ FIXED: Initialize enhanced socket manager
    const socketManager = new SocketManager(
      io,
      profileManager,
      messageBatcher,
      performanceMonitor
    );

    // ✅ ADDED: Periodic health monitoring
    setInterval(async () => {
      try {
        const health = socketManager.healthCheck();
        const stats = socketManager.getStats();
        
        // Update global stats for health endpoint
        updateGlobalStats({
          onlineUserCount: stats.onlineUsers,
          waitingUsers: { 
            text: stats.queues.text, 
            video: stats.queues.video 
          },
          totalRooms: stats.rooms.totalRooms,
          supabaseEnabled: !!supabase,
          performance: {
            avgResponseTime: stats.performance.averageResponseTime || 0,
            requestsPerSecond: stats.performance.messagesPerSecond || 0,
            errorRate: stats.performance.errorRate || 0,
          }
        });

        // Log health status
        if (health.status === 'degraded') {
          logger.warn('🚨 Server health degraded:', health);
        } else {
          logger.debug('💚 Server health check passed:', {
            status: health.status,
            activeConnections: health.activeConnections,
            staleConnections: health.staleConnections,
          });
        }

        // Alert on concerning patterns
        const disconnectSummary = stats.disconnects;
        if (disconnectSummary.topReasons['ping timeout'] > 10) {
          logger.warn('🚨 High ping timeout rate detected:', disconnectSummary.topReasons);
        }
        if (disconnectSummary.topReasons['transport close'] > 5) {
          logger.warn('🚨 High transport close rate detected:', disconnectSummary.topReasons);
        }

      } catch (error) {
        logger.error('❌ Health monitoring error:', error);
      }
    }, 60000); // Every minute

    // ✅ ADDED: Enhanced graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      logger.info(`🛑 ${signal} received, starting graceful shutdown...`);
      
      try {
        // Stop accepting new connections
        server.close(() => {
          logger.info('✅ HTTP server closed');
        });

        // Close Socket.IO server gracefully
        io.close(() => {
          logger.info('✅ Socket.IO server closed');
        });

        // Stop message batching
        await messageBatcher.destroy();
        logger.info('✅ Message batcher stopped');

        // Close database connections
        if (profileManager) {
          profileManager.destroy();
          logger.info('✅ Profile manager stopped');
        }

        logger.info('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('💥 Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });

      process.on('unhandledRejection', (reason, promise) => {
      logger.error('💥 Unhandled Rejection:', { reason, promise });
      gracefulShutdown('unhandledRejection');
      });

    // Start the server
    server.listen(PORT, () => {
      logger.info(`🚀 TinChat Server Successfully Started!`);
      logger.info(`📊 Environment: ${NODE_ENV}`);
      logger.info(`🌐 Port: ${PORT}`);
      logger.info(`🗄️ Database: ${supabase ? 'Connected' : 'Disabled'}`);
      logger.info(`🔒 CORS Origins: ${allowedOrigins.length} configured`);
      logger.info(`📈 Performance Monitoring: ${performanceMonitor.isEnabled ? 'Enabled' : 'Disabled'}`);
      logger.info(`💬 Socket.IO: Enhanced configuration active`);
      logger.info(`🔧 Memory Limit: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`);
      
      // Log initial health status
      const initialHealth = socketManager.healthCheck();
      logger.info(`💚 Initial Health Status: ${initialHealth.status}`);
    });

    // ✅ ADDED: Log system information for debugging
    logger.info('🖥️ System Information:', {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cpus: require('os').cpus().length,
      totalMemory: `${Math.round(require('os').totalmem() / 1024 / 1024 / 1024)}GB`,
      freeMemory: `${Math.round(require('os').freemem() / 1024 / 1024 / 1024)}GB`,
    });

  } catch (error) {
    logger.error('💥 Server initialization failed:', error);
    process.exit(1);
  }
}

// ✅ ADDED: Start server with error handling
initializeServer().catch(error => {
  logger.error('💥 Failed to start server:', error);
  process.exit(1);
});

// ✅ ADDED: Export for testing
export { server };