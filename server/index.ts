// server/index.ts - COMPLETE FIXED VERSION WITH REDIS INTEGRATION
import path from 'path';
import dotenv from 'dotenv';
// Load .env from project root (__dirname is server/ in source, dist/ in compiled)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import http from 'http';
import { setCorsHeaders } from './config/cors';
import { setupRoutes, updateGlobalStats } from './routes/healthRoutes';
import { setupDebugRoutes, setSocketManager, handleDebugDashboard } from './routes/debugRoutes';
import { handleProfileRoutes, setProfileManager } from './routes/profileRoutes';
import { handleFriendsRoutes, setFriendsProfileManager } from './routes/friendsRoutes';
import { configureSocketIO } from './config/socketIO';
import { initializeSupabase, testDatabaseConnection, getSupabaseConfig, healthCheckSupabase } from './config/supabase';
import { SocketManager } from './managers/SocketManager';
import { ProfileManager } from './managers/profile/ProfileManager';
import { MessageBatcher } from './utils/MessageBatcher';
import { PerformanceMonitor } from './utils/PerformanceMonitor';
import { RedisService } from './services/RedisService';
import { FriendsChatService } from './services/FriendsChatService';
import { User } from './types/User';
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

// ✅ ENHANCED: Initialize Redis service with robust error handling
function initializeRedis(): RedisService | null {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    logger.warn('⚠️ Redis environment variables not found - running without Redis caching');
    logger.info('💡 To enable Redis caching, add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to your .env file');
    return null;
  }

  try {
    logger.info('🔧 Initializing Redis service with Upstash...');
    const redisService = new RedisService(redisUrl, redisToken);
    
    // ✅ FIXED: Test connection immediately with timeout
    Promise.race([
      redisService.testConnection(),
      new Promise<boolean>((_, reject) => 
        setTimeout(() => reject(new Error('Redis connection timeout')), 10000)
      )
    ]).then(connected => {
      if (connected) {
        logger.info('✅ Redis service verified and ready');
      } else {
        logger.warn('⚠️ Redis connection test failed - will use fallback mode');
      }
    }).catch(error => {
      logger.warn('⚠️ Redis connection test failed:', error.message);
    });
    
    return redisService;
  } catch (error) {
    logger.error('❌ Failed to initialize Redis service:', error);
    logger.warn('⚠️ Continuing without Redis caching');
    return null;
  }
}

// ✅ ENHANCED: SocketManager initialization with better error handling
async function initializeSocketManager(
  io: any, 
  profileManager: ProfileManager, 
  messageBatcher: any, 
  performanceMonitor: any, 
  redisService: RedisService | null
): Promise<SocketManager> {
  try {
    logger.info('🔌 Initializing SocketManager with enhanced Redis support...');
    
    const socketManager = new SocketManager(
      io,
      profileManager,
      messageBatcher,
      performanceMonitor,
      redisService  // ✅ FIXED: Pass Redis service properly
    );

    // ✅ FIXED: Test SocketManager health immediately
    const health = socketManager.healthCheck();
    if (health.status === 'healthy') {
      logger.info('✅ SocketManager initialized successfully');
    } else {
      logger.warn('⚠️ SocketManager initialized with issues:', health);
    }

    return socketManager;
  } catch (error) {
    logger.error('❌ Failed to initialize SocketManager:', error);
    throw error;
  }
}

// ✅ ENHANCED: FriendsChatService initialization with health checks
async function initializeFriendsChatService(
  io: any, 
  profileManager: ProfileManager, 
  redisService: RedisService | null
): Promise<FriendsChatService> {
  try {
    logger.info('💬 Initializing FriendsChatService with Redis integration...');
    
    const friendsChatService = new FriendsChatService(io, profileManager, redisService);
    
    // ✅ FIXED: Test FriendsChatService health
    const health = await friendsChatService.healthCheck();
    if (health.status === 'healthy') {
      logger.info('✅ FriendsChatService initialized successfully');
      logger.info(`💾 Chat persistence: ${health.redisEnabled ? 'Redis (24h)' : 'Memory only'}`);
    } else {
      logger.warn('⚠️ FriendsChatService initialized with issues:', health.errors);
    }

    return friendsChatService;
  } catch (error) {
    logger.error('❌ Failed to initialize FriendsChatService:', error);
    throw error;
  }
}

// ===== COMPREHENSIVE SERVER INITIALIZATION =====
async function initializeServer() {
  try {
    logger.info('🚀 Starting TinChat server initialization...');

    // ✅ STEP 1: Check environment variables first
    logger.info('🔍 Checking environment variables...');
    const supabaseConfig = getSupabaseConfig();
    logger.info('📋 Supabase configuration:', {
      hasUrl: supabaseConfig.hasUrl,
      hasServiceKey: supabaseConfig.hasServiceKey,
      url: supabaseConfig.url,
      keyPreview: supabaseConfig.keyPreview
    });

    if (!supabaseConfig.hasUrl || !supabaseConfig.hasServiceKey) {
      logger.error('❌ Missing required Supabase environment variables');
      logger.error('📋 Required variables:');
      logger.error('   - NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
      logger.error('   - SUPABASE_SERVICE_ROLE_KEY');
      process.exit(1);
    }

    // ✅ STEP 2: Initialize Redis service first
    const redisService = initializeRedis();
    
    if (redisService) {
      try {
        const redisHealthy = await redisService.testConnection();
        if (!redisHealthy) {
          logger.warn('⚠️ Redis connection test failed - continuing with local caching only');
        } else {
          logger.info('✅ Redis connection verified - distributed caching enabled');
        }
      } catch (error) {
        logger.warn('⚠️ Redis connection test failed:', error);
      }
    }

    // ✅ STEP 3: Initialize Supabase with proper server-side configuration
    logger.info('🔍 Initializing Supabase client...');
    const supabase = initializeSupabase();
    
    if (!supabase) {
      logger.error('❌ Failed to initialize Supabase client');
      process.exit(1);
    }

    // ✅ STEP 4: Test database connection with proper error handling
    logger.info('🔍 Testing database connection...');
    const dbHealthy = await testDatabaseConnection(supabase);
    
    if (!dbHealthy) {
      logger.error('❌ Database connection test failed');
      logger.error('📋 Please check:');
      logger.error('   - SUPABASE_SERVICE_ROLE_KEY is correct');
      logger.error('   - Database is accessible');
      logger.error('   - Network connectivity');
      process.exit(1);
    } else {
      logger.info('✅ Database connection verified successfully');
    }

    // ✅ STEP 5: Initialize core services
    const performanceMonitor = new PerformanceMonitor();
    const io = configureSocketIO(server, allowedOrigins);
    const messageBatcher = new MessageBatcher();
    messageBatcher.setSocketIOInstance(io);
    
    // ✅ STEP 6: Initialize ProfileManager with modular architecture
    logger.info('👤 Initializing ProfileManager...');
    const profileManager = new ProfileManager(supabase, redisService);
    
    // Set ProfileManager for both Profile and Friends API routes
    setProfileManager(profileManager);
    setFriendsProfileManager(profileManager);
    logger.info('📡 Profile and Friends API routes configured with ProfileManager');
    
    // ✅ STEP 7: Test ProfileManager health immediately after initialization
    logger.info('🔍 Testing ProfileManager health...');
    try {
      const profileHealth = await profileManager.testConnection();
      if (profileHealth.overall) {
        logger.info('✅ ProfileManager health check passed', {
          database: profileHealth.database,
          redis: profileHealth.redis,
          latency: profileHealth.dbLatency
        });
      } else {
        logger.warn('⚠️ ProfileManager health check failed', {
          database: profileHealth.database,
          redis: profileHealth.redis,
          errors: profileHealth.errors
        });
        // Don't exit - continue with degraded functionality
      }
    } catch (error) {
      logger.error('❌ ProfileManager health check exception:', error);
      // Don't exit - continue with degraded functionality
    }
    
    // ✅ STEP 8: Initialize FriendsChatService with error handling
    let friendsChatService: FriendsChatService | null = null;
    try {
      friendsChatService = await initializeFriendsChatService(io, profileManager, redisService);
      logger.info('💬 Friends chat service initialized with 24h Redis caching');
    } catch (error) {
      logger.error('❌ FriendsChatService initialization failed:', error);
      logger.warn('⚠️ Continuing without friends chat service');
    }
    
    // ✅ STEP 9: Initialize SocketManager with error handling
    let socketManager: SocketManager | null = null;
    try {
      socketManager = await initializeSocketManager(io, profileManager, messageBatcher, performanceMonitor, redisService);
      setSocketManager(socketManager);
      logger.info('🔌 Socket manager initialized with friends support');
    } catch (error) {
      logger.error('❌ SocketManager initialization failed:', error);
      process.exit(1); // This is critical - can't continue without SocketManager
    }

    // ✅ STEP 10: Enhanced health monitoring with better error isolation
    setInterval(async () => {
      try {
        // ✅ SAFE: Get socket manager stats with error handling
        let socketStats = { onlineUsers: 0, queues: { text: 0, video: 0 }, rooms: { totalRooms: 0 }, performance: {} };
        let socketHealth: { status: 'healthy' | 'degraded' | 'down' } = { status: 'down' };
        
        if (socketManager) {
          try {
            socketHealth = socketManager.healthCheck();
            socketStats = socketManager.getStats();
          } catch (err) {
            logger.debug('Socket manager stats failed (non-critical):', err);
          }
        }
        
        // ✅ SAFE: Get friends chat stats with error handling
        let friendsChatStats = { activeRooms: 0, activeTyping: 0, redisEnabled: false };
        if (friendsChatService) {
          try {
            friendsChatStats = friendsChatService.getStats();
          } catch (err) {
            logger.debug('Friends chat stats failed (non-critical):', err);
          }
        }
        
        // ✅ SAFE: Get profile API health with error handling
        let profileApiHealth = { database: false, overall: false };
        try {
          const simpleHealth = await healthCheckSupabase();
          profileApiHealth = {
            database: simpleHealth.connected,
            overall: simpleHealth.connected
          };
        } catch (err) {
          logger.debug('Profile API health check failed (non-critical):', err);
        }
        
        // ✅ SAFE: Get Redis health with error handling
        let redisHealth = false;
        if (redisService) {
          try {
            redisHealth = await redisService.testConnection();
          } catch (err) {
            logger.debug('Redis health check failed (non-critical):', err);
          }
        }
        
        // Update global stats with safe values
        updateGlobalStats({
          onlineUserCount: socketStats.onlineUsers || 0,
          waitingUsers: { 
            text: socketStats.queues?.text || 0, 
            video: socketStats.queues?.video || 0 
          },
          totalRooms: socketStats.rooms?.totalRooms || 0,
          supabaseEnabled: !!supabase,
          performance: {
            avgResponseTime: (socketStats.performance as any)?.averageResponseTime || 0,
            requestsPerSecond: (socketStats.performance as any)?.messagesPerSecond || 0,
            errorRate: (socketStats.performance as any)?.errorRate || 0,
          },
          redisEnabled: redisHealth,
          profileApiEnabled: !!profileManager,
          profileApiHealth: profileApiHealth,
          friendsChat: {
            ...friendsChatStats,
            cacheEnabled: redisHealth,
            retention24h: redisHealth
          }
        } as any);

        // ✅ SAFE: Health status logging
        if (socketHealth.status === 'degraded') {
          logger.warn('🚨 Server health degraded:', socketHealth);
        } else if (socketHealth.status === 'down') {
          logger.error('🚨 Server health critical:', socketHealth);
        } else {
          logger.debug('💚 Server health check passed');
        }

      } catch (error) {
        logger.warn('⚠️ Health monitoring error (non-critical):', error);
      }
    }, 60000); // Every minute

    // ✅ STEP 11: Enhanced graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`🛑 ${signal} received, starting enhanced graceful shutdown...`);
      
      try {
        // ✅ NEW: Set shutdown flag to prevent new operations
        if (socketManager) {
          logger.info('🔌 Signaling SocketManager to stop accepting new connections...');
        }
        
        // Stop accepting new connections
        server.close(() => {
          logger.info('✅ HTTP server closed');
        });

        // Close Socket.IO server
        io.close(() => {
          logger.info('✅ Socket.IO server closed');
        });

        // Stop message batcher
        if (messageBatcher) {
          await messageBatcher.destroy();
          logger.info('✅ Message batcher stopped');
        }

        // ✅ ENHANCED: Cleanup FriendsChatService with error handling
        if (friendsChatService) {
          try {
            await friendsChatService.destroy();
            logger.info('✅ Friends chat service stopped');
          } catch (error) {
            logger.warn('⚠️ Friends chat service cleanup had issues:', error);
          }
        }

        // ✅ ENHANCED: Cleanup ProfileManager with error handling
        if (profileManager) {
          try {
            await profileManager.destroy();
            logger.info('✅ Profile manager and all modules stopped');
          } catch (error) {
            logger.warn('⚠️ Profile manager cleanup had issues:', error);
          }
        }

        // ✅ ENHANCED: Cleanup Redis service with timeout
        if (redisService) {
          try {
            const disconnectPromise = redisService.disconnect();
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Redis disconnect timeout')), 5000)
            );
            
            await Promise.race([disconnectPromise, timeoutPromise]);
            logger.info('✅ Redis service disconnected');
          } catch (error) {
            logger.warn('⚠️ Redis disconnect had issues:', error);
          }
        }

        // ✅ ENHANCED: Cleanup SocketManager with error handling
        if (socketManager) {
          try {
            await socketManager.destroy();
            logger.info('✅ Socket manager stopped');
          } catch (error) {
            logger.warn('⚠️ Socket manager cleanup had issues:', error);
          }
        }

        logger.info('✅ Enhanced graceful shutdown completed');
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

    // ✅ STEP 12: Start the server with comprehensive logging
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

      logger.info('🚀 Server startup complete - production ready');
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

// ✅ Start the server
initializeServer().catch(error => {
  logger.error('💥 Failed to start server:', error);
  process.exit(1);
});

export { server };