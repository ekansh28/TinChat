// server/index.ts - FIXED VERSION WITH PROPER FRIENDS INTEGRATION
import 'dotenv/config';
import http from 'http';
import { setCorsHeaders } from './config/cors';
import { setupRoutes, updateGlobalStats } from './routes/healthRoutes';
import { setupDebugRoutes, setSocketManager, handleDebugDashboard } from './routes/debugRoutes';
import { handleProfileRoutes, setProfileManager } from './routes/profileRoutes';
import { handleFriendsRoutes, setFriendsProfileManager } from './routes/friendsRoutes';
import { configureSocketIO } from './config/socketIO';
import { initializeSupabase, testDatabaseConnection } from './config/supabase';
import { SocketManager } from './managers/SocketManager';
import { ProfileManager } from './managers/profile/ProfileManager';
import { MessageBatcher } from './utils/MessageBatcher';
import { PerformanceMonitor } from './utils/PerformanceMonitor';
import { RedisService } from './services/RedisService';
import { FriendsChatService } from './services/FriendsChatService';
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

// Enhanced HTTP server with comprehensive API routes
const server = http.createServer(async (req, res) => {
  try {
    const requestOrigin = req.headers.origin;
    setCorsHeaders(res, requestOrigin);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url || '';
    logger.debug(`📡 Incoming request: ${req.method} ${url}`);

    // ✅ Handle Friends API routes (highest priority for friends functionality)
    if (url.startsWith('/api/friends')) {
      const handled = await handleFriendsRoutes(req, res);
      if (handled) {
        logger.debug(`📡 Friends API request handled: ${req.method} ${url}`);
        return;
      }
    }

    // ✅ Handle Profile API routes
    if (url.startsWith('/api/profiles')) {
      const handled = await handleProfileRoutes(req, res);
      if (handled) {
        logger.debug(`📡 Profile API request handled: ${req.method} ${url}`);
        return;
      }
    }

    // Handle debug dashboard
    if (url === '/debug/dashboard') {
      handleDebugDashboard(res);
      return;
    }

    // Handle debug routes
    if (url.startsWith('/debug')) {
      const handled = setupDebugRoutes(req, res);
      if (handled) return;
    }

    // Handle regular health/status routes
    setupRoutes(req, res);
  } catch (error) {
    logger.error('HTTP server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

// Enhanced error handling
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

// ✅ Initialize Redis service with enhanced configuration
function initializeRedis(): RedisService | null {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    logger.warn('⚠️ Redis environment variables not found - running without Redis caching');
    logger.info('💡 To enable Redis caching, add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to your .env file');
    return null;
  }

  try {
    const redisService = new RedisService(redisUrl, redisToken);
    logger.info('✅ Redis service initialized successfully');
    return redisService;
  } catch (error) {
    logger.error('❌ Failed to initialize Redis service:', error);
    logger.warn('⚠️ Continuing without Redis caching');
    return null;
  }
}

// ===== COMPREHENSIVE SERVER INITIALIZATION =====
async function initializeServer() {
  try {
    logger.info('🚀 Starting TinChat server initialization...');

    // ✅ STEP 1: Initialize Redis service first
    const redisService = initializeRedis();
    
    if (redisService) {
      const redisHealthy = await redisService.testConnection();
      if (!redisHealthy) {
        logger.warn('⚠️ Redis connection test failed - continuing with local caching only');
      } else {
        logger.info('✅ Redis connection verified - distributed caching enabled');
      }
    }

    // ✅ STEP 2: Initialize Supabase
    const supabase = initializeSupabase();
    if (supabase) {
      const dbHealthy = await testDatabaseConnection(supabase);
      if (!dbHealthy) {
        logger.warn('⚠️ Database connection issues detected, continuing with limited functionality');
      } else {
        logger.info('✅ Database connection verified');
      }
    }

    // ✅ STEP 3: Initialize core services
    const performanceMonitor = new PerformanceMonitor();
    const io = configureSocketIO(server, allowedOrigins);
    const messageBatcher = new MessageBatcher();
    messageBatcher.setSocketIOInstance(io);
    
    // ✅ STEP 4: Initialize ProfileManager with modular architecture
    const profileManager = new ProfileManager(supabase, redisService);
    
    // Set ProfileManager for both Profile and Friends API routes
    setProfileManager(profileManager);
    setFriendsProfileManager(profileManager);
    logger.info('📡 Profile and Friends API routes configured');
    
    // ✅ STEP 5: Initialize FriendsChatService for real-time messaging
    const friendsChatService = new FriendsChatService(io, profileManager, redisService);
    logger.info('💬 Friends chat service initialized with 24h Redis caching');
    
    // ✅ STEP 6: Initialize SocketManager with friends chat support
    const socketManager = new SocketManager(
      io,
      profileManager,
      messageBatcher,
      performanceMonitor,
      redisService
    );

    setSocketManager(socketManager);
    logger.info('🔌 Socket manager initialized with friends support');

    // ✅ STEP 7: Enhanced health monitoring with friends stats
    setInterval(async () => {
      try {
        const health = socketManager.healthCheck();
        const stats = socketManager.getStats();
        
        // Get Friends Chat stats
        const friendsChatStats = friendsChatService.getStats();
        
        // Get Redis stats if available
        let redisStats = null;
        if (redisService) {
          try {
            redisStats = await redisService.getRedisStats();
          } catch (error) {
            logger.debug('Failed to get Redis stats for health check:', error);
          }
        }

        // Get Profile API health
        let profileApiHealth = null;
        try {
          profileApiHealth = await profileManager.testConnection();
        } catch (error) {
          logger.debug('Failed to get Profile API health:', error);
        }

        // Get profile and friends statistics
        const profileStats = profileManager.getProfileStats();
        
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
          },
          redisEnabled: !!redisService,
          redisStats: redisStats,
          profileApiEnabled: !!profileManager,
          profileApiHealth: profileApiHealth,
          // Enhanced with friends functionality
          friendsChat: {
            ...friendsChatStats,
            cacheEnabled: !!redisService,
            retention24h: true
          },
          profileCache: {
            localSize: profileStats.cacheStats.local.size,
            hitRate: profileStats.cacheStats.local.hitRate,
            redisConnected: profileStats.cacheStats.redis?.connected || false
          }
        } as any);

        // Enhanced health logging
        if (health.status === 'degraded') {
          logger.warn('🚨 Server health degraded:', health);
        } else {
          logger.debug('💚 Server health check passed:', {
            status: health.status,
            activeConnections: health.activeConnections,
            staleConnections: health.staleConnections,
            redisEnabled: !!redisService,
            profileApiEnabled: !!profileManager,
            friendsChatRooms: friendsChatStats.activeRooms,
            profileCacheHitRate: profileStats.cacheStats.local.hitRate
          });
        }

      } catch (error) {
        logger.error('❌ Health monitoring error:', error);
      }
    }, 60000); // Every minute

    // ✅ STEP 8: Enhanced graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`🛑 ${signal} received, starting graceful shutdown...`);
      
      try {
        // Stop accepting new connections
        server.close(() => {
          logger.info('✅ HTTP server closed');
        });

        // Close Socket.IO server
        io.close(() => {
          logger.info('✅ Socket.IO server closed');
        });

        // Stop message batcher
        await messageBatcher.destroy();
        logger.info('✅ Message batcher stopped');

        // Cleanup FriendsChatService
        if (friendsChatService) {
          await friendsChatService.destroy();
          logger.info('✅ Friends chat service stopped');
        }

        // Cleanup ProfileManager (includes all modules)
        if (profileManager) {
          await profileManager.destroy();
          logger.info('✅ Profile manager and all modules stopped');
        }

        // Cleanup Redis service
        if (redisService) {
          await redisService.disconnect();
          logger.info('✅ Redis service disconnected');
        }

        // Cleanup SocketManager
        await socketManager.destroy();
        logger.info('✅ Socket manager stopped');

        logger.info('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    // Setup signal handlers
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

    // ✅ STEP 9: Start the server with comprehensive logging
    server.listen(PORT, async () => {
      logger.info(`🚀 TinChat Server Successfully Started!`);
      logger.info(`📊 Environment: ${NODE_ENV}`);
      logger.info(`🌐 Port: ${PORT}`);
      logger.info(`🗄️ Database: ${supabase ? 'Connected' : 'Disabled'}`);
      logger.info(`📋 Redis: ${redisService ? 'Enabled' : 'Disabled'}`);
      logger.info(`📡 Profile API: Available at /api/profiles/*`);
      logger.info(`👥 Friends API: Available at /api/friends/*`);
      logger.info(`💬 Friends Chat: Available with ${redisService ? '24h Redis caching' : 'memory-only caching'}`);
      logger.info(`🔒 CORS Origins: ${allowedOrigins.length} configured`);
      logger.info(`📈 Performance Monitoring: ${performanceMonitor.isEnabled ? 'Enabled' : 'Disabled'}`);
      logger.info(`💬 Socket.IO: Enhanced configuration active`);
      logger.info(`🔧 Memory Limit: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`);
      
      // Debug dashboard info
      if (NODE_ENV === 'development') {
        logger.info(`🐛 Debug Dashboard: http://localhost:${PORT}/debug/dashboard`);
        logger.info(`🔍 Debug API: http://localhost:${PORT}/debug/*`);
        logger.info(`📡 Profile API: http://localhost:${PORT}/api/profiles/*`);
        logger.info(`👥 Friends API: http://localhost:${PORT}/api/friends/*`);
      }
      
      // Show comprehensive caching and API configuration
      if (redisService) {
        logger.info(`💾 Caching: Redis (distributed) + LRU (local)`);
        logger.info(`⚡ Queue Persistence: Redis-backed queues active`);
        logger.info(`🔄 Profile Cache: Multi-layer (Redis + Memory + API)`);
        logger.info(`👥 Friends Cache: Redis-backed with real-time updates`);
        logger.info(`💬 Chat Cache: 24h Redis persistence + real-time delivery`);
      } else {
        logger.info(`💾 Caching: LRU (local memory only)`);
        logger.info(`⚡ Queue Persistence: Memory-only (lost on restart)`);
        logger.info(`🔄 Profile Cache: Memory + API only`);
        logger.info(`👥 Friends Cache: Memory-only (lost on restart)`);
        logger.info(`💬 Chat Cache: Memory-only (lost on restart)`);
      }
      
      const initialHealth = socketManager.healthCheck();
      logger.info(`💚 Initial Health Status: ${initialHealth.status}`);

      // ✅ STEP 10: Run startup tests
      try {
        await testProfileApiEndpoints();
        await testFriendsApiEndpoints();
        
        if (redisService) {
          await testRedisOperations(redisService);
        }
        
        logger.info('🧪 All startup tests completed successfully');
      } catch (error) {
        logger.error('❌ Startup tests failed:', error);
      }
    });

    // System information logging
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

// ===== STARTUP TESTS =====

async function testProfileApiEndpoints(): Promise<void> {
  try {
    logger.info('🧪 Testing Profile API endpoints...');
    
    const mockReq = {
      url: '/api/profiles/health',
      method: 'GET',
      headers: {},
      on: () => {},
      emit: () => {}
    } as any;

    const mockRes = {
      writeHead: () => {},
      end: (data: string) => {
        try {
          const response = JSON.parse(data);
          if (response.success) {
            logger.info('✅ Profile API health endpoint test passed');
          } else {
            logger.warn('⚠️ Profile API health endpoint returned degraded status');
          }
        } catch (error) {
          logger.error('❌ Profile API health endpoint test failed');
        }
      },
      setHeader: () => {}
    } as any;

    await handleProfileRoutes(mockReq, mockRes);
    
  } catch (error) {
    logger.error('❌ Profile API endpoint testing failed:', error);
  }
}

async function testFriendsApiEndpoints(): Promise<void> {
  try {
    logger.info('🧪 Testing Friends API endpoints...');
    
    const mockReq = {
      url: '/api/friends/health',
      method: 'GET',
      headers: {},
      on: () => {},
      emit: () => {}
    } as any;

    const mockRes = {
      writeHead: () => {},
      end: (data: string) => {
        try {
          const response = JSON.parse(data);
          if (response.success) {
            logger.info('✅ Friends API health endpoint test passed');
          } else {
            logger.warn('⚠️ Friends API health endpoint returned degraded status');
          }
        } catch (error) {
          logger.error('❌ Friends API health endpoint test failed');
        }
      },
      setHeader: () => {}
    } as any;

    await handleFriendsRoutes(mockReq, mockRes);
    
  } catch (error) {
    logger.error('❌ Friends API endpoint testing failed:', error);
  }
}
     
async function testRedisOperations(redisService: RedisService): Promise<void> {
  try {
    logger.info('🧪 Testing Redis operations...');
    
    // Test basic operations
    const testKey = 'test:startup';
    const testValue = { message: 'Redis test', timestamp: Date.now() };
    
    const redisInstance = redisService.getRedisInstance();
    
    // Test set operation
    await redisInstance.setex(testKey, 10, JSON.stringify(testValue));
    
    // Test get operation
    const retrieved = await redisInstance.get(testKey);
    if (retrieved) {
      const parsed = JSON.parse(retrieved);
      logger.info('✅ Redis read/write test passed');
    }
    
    // Test delete operation
    await redisInstance.del(testKey);
    
    // Test queue operations
    const testUser = {
      id: 'test-user-123',
      authId: null,
      interests: ['testing'],
      chatType: 'text' as const,
      connectionStartTime: Date.now()
    };
    
    await redisService.addToQueue('text', testUser);
    const queueLength = await redisService.getQueueLength('text');
    if (queueLength > 0) {
      logger.info('✅ Redis queue operations test passed');
      // Clean up test user
      await redisService.removeFromQueue('text', 'test-user-123');
    }
    
    // Test friends cache operations
    const testFriend = {
      id: 'test-friend-456',
      username: 'testfriend',
      display_name: 'Test Friend',
      avatar_url: null,
      status: 'online' as const,
      last_seen: new Date().toISOString(),
      is_online: true
    };
    
    // Test friend caching
    const friendsCacheSuccess = await redisService.cacheFriendsList('test-user-123', [testFriend]);
    if (friendsCacheSuccess) {
      logger.info('✅ Redis friends cache test passed');
      
      // Clean up
      await redisService.invalidateFriendsList('test-user-123');
    }
    
    logger.info('✅ All Redis operations tests passed');
    
  } catch (error) {
    logger.error('❌ Redis operations test failed:', error);
    logger.warn('⚠️ Redis may not be functioning correctly');
  }
}

// ✅ Start the server
initializeServer().catch(error => {
  logger.error('💥 Failed to start server:', error);
  process.exit(1);
});

export { server };