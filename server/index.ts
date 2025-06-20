// ===== Updated server/index.ts with Debug Routes =====
import 'dotenv/config';
import http from 'http';
import { setCorsHeaders } from './config/cors';
import { setupRoutes, updateGlobalStats } from './routes/healthRoutes';
import { setupDebugRoutes, setSocketManager, handleDebugDashboard } from './routes/debugRoutes'; // ✅ ADDED
import { configureSocketIO } from './config/socketIO';
import { initializeSupabase, testDatabaseConnection } from './config/supabase';
import { SocketManager } from './managers/SocketManager';
import { ProfileManager } from './managers/ProfileManager';
import { MessageBatcher } from './utils/MessageBatcher';
import { PerformanceMonitor } from './utils/PerformanceMonitor';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

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

// ✅ ENHANCED: HTTP server with debug route support
const server = http.createServer((req, res) => {
  try {
    const requestOrigin = req.headers.origin;
    setCorsHeaders(res, requestOrigin);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url || '';

    // ✅ ADDED: Handle debug dashboard
    if (url === '/debug/dashboard') {
      handleDebugDashboard(res);
      return;
    }

    // ✅ ADDED: Handle debug routes first
    if (url.startsWith('/debug')) {
      const handled = setupDebugRoutes(req, res);
      if (handled) return;
    }

    // Handle regular routes
    setupRoutes(req, res);
  } catch (error) {
    logger.error('HTTP server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

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

async function initializeServer() {
  try {
    logger.info('🚀 Starting TinChat server initialization...');

    const supabase = initializeSupabase();
    if (supabase) {
      const dbHealthy = await testDatabaseConnection(supabase);
      if (!dbHealthy) {
        logger.warn('⚠️ Database connection issues detected, continuing with limited functionality');
      }
    }

    const performanceMonitor = new PerformanceMonitor();
    const io = configureSocketIO(server, allowedOrigins);
    const messageBatcher = new MessageBatcher();
    messageBatcher.setSocketIOInstance(io);
    const profileManager = new ProfileManager(supabase);
    
    // ✅ ENHANCED: Initialize socket manager with better debugging
    const socketManager = new SocketManager(
      io,
      profileManager,
      messageBatcher,
      performanceMonitor
    );

    // ✅ ADDED: Set socket manager for debug routes
    setSocketManager(socketManager);

    // Enhanced health monitoring
    setInterval(async () => {
      try {
        const health = socketManager.healthCheck();
        const stats = socketManager.getStats();
        const matchmakingDebug = socketManager.debugMatchmaking(); // ✅ ADDED
        
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

        // ✅ ENHANCED: Better health logging with matchmaking info
        if (health.status === 'degraded') {
          logger.warn('🚨 Server health degraded:', health);
        } else {
          logger.debug('💚 Server health check passed:', {
            status: health.status,
            activeConnections: health.activeConnections,
            staleConnections: health.staleConnections,
            queueStats: matchmakingDebug.queueStats
          });
        }

        // ✅ ADDED: Alert on stuck queues (users waiting too long)
        if (matchmakingDebug.queueStats.text > 5 || matchmakingDebug.queueStats.video > 5) {
          logger.warn('🚨 High queue counts detected:', matchmakingDebug.queueStats);
        }

        const disconnectSummary = stats.disconnects;
        if ((disconnectSummary?.topReasons?.['ping timeout'] ?? 0) > 10){
          logger.warn('🚨 High ping timeout rate detected:', disconnectSummary.topReasons);
        }
        if ((disconnectSummary?.topReasons?.['transport close'] ?? 0) > 5){
          logger.warn('🚨 High transport close rate detected:', disconnectSummary.topReasons);
        }

      } catch (error) {
        logger.error('❌ Health monitoring error:', error);
      }
    }, 60000);

    const gracefulShutdown = async (signal: string) => {
      logger.info(`🛑 ${signal} received, starting graceful shutdown...`);
      
      try {
        server.close(() => {
          logger.info('✅ HTTP server closed');
        });

        io.close(() => {
          logger.info('✅ Socket.IO server closed');
        });

        await messageBatcher.destroy();
        logger.info('✅ Message batcher stopped');

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

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'));

    process.on('uncaughtException', (error) => {
      logger.error('💥 Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('💥 Unhandled Rejection:', { reason, promise });
      gracefulShutdown('unhandledRejection');
    });

    server.listen(PORT, () => {
      logger.info(`🚀 TinChat Server Successfully Started!`);
      logger.info(`📊 Environment: ${NODE_ENV}`);
      logger.info(`🌐 Port: ${PORT}`);
      logger.info(`🗄️ Database: ${supabase ? 'Connected' : 'Disabled'}`);
      logger.info(`🔒 CORS Origins: ${allowedOrigins.length} configured`);
      logger.info(`📈 Performance Monitoring: ${performanceMonitor.isEnabled ? 'Enabled' : 'Disabled'}`);
      logger.info(`💬 Socket.IO: Enhanced configuration active`);
      logger.info(`🔧 Memory Limit: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`);
      
      // ✅ ADDED: Debug dashboard info
      if (NODE_ENV === 'development') {
        logger.info(`🐛 Debug Dashboard: http://localhost:${PORT}/debug/dashboard`);
        logger.info(`🔍 Debug API: http://localhost:${PORT}/debug/*`);
      }
      
      const initialHealth = socketManager.healthCheck();
      logger.info(`💚 Initial Health Status: ${initialHealth.status}`);
    });

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

initializeServer().catch(error => {
  logger.error('💥 Failed to start server:', error);
  process.exit(1);
});

export { server };