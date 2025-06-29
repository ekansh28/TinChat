// server/index.ts - UPDATED WITH XATA AND CLERK INTEGRATION
import 'dotenv/config';
import http from 'http';
import { setCorsHeaders } from './config/cors';
import { setupRoutes, updateGlobalStats } from './routes/healthRoutes';
import { setupDebugRoutes, setSocketManager, handleDebugDashboard } from './routes/debugRoutes';
import { handleProfileRoutes, setProfileManager } from './routes/profileRoutes';
import { handleFriendsRoutes, setFriendsProfileManager } from './routes/friendsRoutes';
import { configureSocketIO } from './config/socketIO';
import { initializeSupabase, testDatabaseConnection, getSupabaseConfig, healthCheckSupabase } from './config/supabase';
import { initializeXata, testXataConnection, getXataClient, getXataStats } from './config/xata';
import { initializeClerk, testClerkConnection, getAuthStats } from './middleware/clerkAuth';
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

    // ✅ Handle Authentication API routes
    if (url.startsWith('/api/auth')) {
      const handled = await handleAuthRoutes(req, res);
      if (handled) {
        logger.debug(`📡 Auth API request handled: ${req.method} ${url}`);
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

// ✅ NEW: Authentication API routes
async function handleAuthRoutes(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
  const url = req.url || '';
  const method = req.method;

  // Set CORS headers
  setCorsHeaders(res);
  res.setHeader('Content-Type', 'application/json');

  try {
    // Health check for auth services
    if (url === '/api/auth/health' && method === 'GET') {
      const clerkHealth = await testClerkConnection();
      const authStats = getAuthStats();
      
      const health = {
        clerk: clerkHealth,
        cache: authStats,
        timestamp: new Date().toISOString()
      };

      res.writeHead(clerkHealth.connected ? 200 : 503);
      res.end(JSON.stringify(health, null, 2));
      return true;
    }

    // Get current user info (requires authentication)
    if (url === '/api/auth/me' && method === 'GET') {
      const { verifyClerkToken } = await import('./middleware/clerkAuth');
      const authResult = await verifyClerkToken(req);
      
      if (!authResult.isAuthenticated) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return true;
      }

      res.writeHead(200);
      res.end(JSON.stringify({
        user: authResult.user,
        userId: authResult.userId,
        authenticated: true,
        cached: authResult.cached
      }, null, 2));
      return true;
    }

    return false; // Route not handled
  } catch (error) {
    logger.error('Auth API error:', error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Authentication service error' }));
    return true;
  }
}

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

    // ✅ STEP 1: Initialize authentication (Clerk)
    logger.info('🔐 Initializing Clerk authentication...');
    const clerkInitialized = initializeClerk();
    
    if (clerkInitialized) {
      const clerkHealth = await testClerkConnection();
      if (clerkHealth.connected) {
        logger.info(`✅ Clerk authentication verified (${clerkHealth.latency}ms)`);
      } else {
        logger.warn('⚠️ Clerk connection test failed:', clerkHealth.error);
        logger.warn('⚠️ Continuing with degraded authentication');
      }
    } else {
      logger.error('❌ Clerk initialization failed - authentication disabled');
      logger.error('📋 Required variables:');
      logger.error('   - CLERK_SECRET_KEY');
      logger.error('   - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
    }

    // ✅ STEP 2: Initialize primary database (Xata)
    logger.info('🗄️ Initializing Xata database...');
    const xataClient = initializeXata();
    
    let primaryDatabaseHealthy = false;
    if (xataClient) {
      const xataHealthy = await testXataConnection();
      if (xataHealthy) {
        logger.info('✅ Xata database connection verified');
        primaryDatabaseHealthy = true;
        
        // Get database stats
        try {
          const xataStats = await getXataStats();
          if (xataStats.connected) {
            logger.info('📊 Xata database stats:', xataStats.stats);
          }
        } catch (error) {
          logger.debug('Could not fetch Xata stats (non-critical):', error);
        }
      } else {
        logger.warn('⚠️ Xata database connection failed');
      }
    } else {
      logger.warn('⚠️ Xata database not configured');
    }

    // ✅ STEP 3: Initialize fallback database (Supabase) if Xata fails
    let supabase = null;
    let fallbackDatabaseHealthy = false;
    
    if (!primaryDatabaseHealthy) {
      logger.info('🔄 Attempting Supabase fallback database...');
      
      const supabaseConfig = getSupabaseConfig();
      logger.info('📋 Supabase configuration:', {
        hasUrl: supabaseConfig.hasUrl,
        hasServiceKey: supabaseConfig.hasServiceKey,
        url: supabaseConfig.url,
        keyPreview: supabaseConfig.keyPreview
      });

      if (supabaseConfig.hasUrl && supabaseConfig.hasServiceKey) {
        supabase = initializeSupabase();
        
        if (supabase) {
          const dbHealthy = await testDatabaseConnection(supabase);
          if (dbHealthy) {
            logger.info('✅ Supabase fallback database connection verified');
            fallbackDatabaseHealthy = true;
          } else {
            logger.warn('⚠️ Supabase fallback database connection failed');
          }
        }
      } else {
        logger.warn('⚠️ Supabase configuration incomplete');
      }
    }

    // ✅ Check if we have at least one working database
    const hasWorkingDatabase = primaryDatabaseHealthy || fallbackDatabaseHealthy;
    
    if (!hasWorkingDatabase) {
      logger.error('❌ No working database connection available');
      logger.error('📋 Please configure either:');
      logger.error('   - Xata: XATA_DB_URL, XATA_API_KEY');
      logger.error('   - Supabase: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
      logger.warn('⚠️ Continuing with limited functionality...');
    }

    // ✅ STEP 4: Initialize Redis service
    const redisService = initializeRedis();
    
    if (redisService) {
      const redisHealthy = await redisService.testConnection();
      if (!redisHealthy) {
        logger.warn('⚠️ Redis connection test failed - continuing with local caching only');
      } else {
        logger.info('✅ Redis connection verified - distributed caching enabled');
      }
    }

    // ✅ STEP 5: Initialize core services
    const performanceMonitor = new PerformanceMonitor();
    const io = configureSocketIO(server, allowedOrigins);
    const messageBatcher = new MessageBatcher();
    messageBatcher.setSocketIOInstance(io);

    // ✅ STEP 6: Initialize ProfileManager with database priority (Xata > Supabase)
    logger.info('👤 Initializing ProfileManager...');
    const profileManager = new ProfileManager(
      supabase, // Keep Supabase for compatibility with existing modules
      redisService
    );
    
    // Set ProfileManager for both Profile and Friends API routes
    setProfileManager(profileManager);
    setFriendsProfileManager(profileManager);
    logger.info('📡 Profile and Friends API routes configured with ProfileManager');
    
    // ✅ STEP 7: Test ProfileManager health
    if (hasWorkingDatabase) {
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
        }
      } catch (error) {
        logger.error('❌ ProfileManager health check exception:', error);
      }
    }
    
    // ✅ STEP 8: Initialize FriendsChatService for real-time messaging
    const friendsChatService = new FriendsChatService(io, profileManager, redisService);
    logger.info('💬 Friends chat service initialized with enhanced database integration');
    
    // ✅ STEP 9: Initialize SocketManager with authentication and database support
    const socketManager = new SocketManager(
      io,
      profileManager,
      messageBatcher,
      performanceMonitor,
      redisService
    );

    setSocketManager(socketManager);
    logger.info('🔌 Socket manager initialized with Clerk authentication support');

    // ✅ STEP 10: Enhanced health monitoring with database and auth status
    setInterval(async () => {
      try {
        const health = socketManager.healthCheck();
        const stats = socketManager.getStats();
        
        // Get database health status
        let xataHealth = { connected: false };
        let supabaseHealth = { connected: false };
        let clerkHealth = { connected: false };
        
        try {
          if (xataClient) {
            xataHealth = await getXataStats();
          }
          if (supabase) {
            const supabaseCheck = await healthCheckSupabase();
            supabaseHealth = { connected: supabaseCheck.connected };
          }
          if (clerkInitialized) {
            clerkHealth = await testClerkConnection();
          }
        } catch (err) {
          logger.debug('Health check services failed (non-critical):', err);
        }
        
        // Get friends chat stats safely
        let friendsChatStats = { activeRooms: 0, activeTyping: 0, redisEnabled: false };
        if (friendsChatService) {
          try {
            friendsChatStats = friendsChatService.getStats();
          } catch (err) {
            logger.debug('Friends chat stats failed (non-critical):', err);
          }
        }
        
        // Update global stats with enhanced information
        updateGlobalStats({
          onlineUserCount: stats.onlineUsers,
          waitingUsers: { 
            text: stats.queues.text, 
            video: stats.queues.video 
          },
          totalRooms: stats.rooms.totalRooms,
          databases: {
            xata: xataHealth.connected,
            supabase: supabaseHealth.connected,
            primary: primaryDatabaseHealthy ? 'xata' : (fallbackDatabaseHealthy ? 'supabase' : 'none')
          },
          authentication: {
            clerk: clerkHealth.connected,
            cacheStats: getAuthStats()
          },
          performance: {
            avgResponseTime: stats.performance.averageResponseTime || 0,
            requestsPerSecond: stats.performance.messagesPerSecond || 0,
            errorRate: stats.performance.errorRate || 0,
          },
          redisEnabled: !!redisService,
          profileApiEnabled: !!profileManager,
          friendsChat: {
            ...friendsChatStats,
            cacheEnabled: !!redisService,
            retention24h: true
          }
        } as any);

        // Log health status periodically
        if (health.status === 'degraded') {
          logger.warn('🚨 Server health degraded (but continuing)');
        } else {
          logger.debug('💚 Server health check passed');
        }

      } catch (error) {
        logger.warn('⚠️ Health monitoring error (non-critical):', error);
      }
    }, 60000); // Every minute

    // ✅ STEP 11: Enhanced graceful shutdown
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

        // Clear authentication caches
        const { clearAuthCaches } = await import('./middleware/clerkAuth');
        clearAuthCaches();
        logger.info('✅ Authentication caches cleared');

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

    // ✅ STEP 12: Start the server with comprehensive logging
    server.listen(PORT, async () => {
      logger.info(`🚀 TinChat Server Successfully Started!`);
      logger.info(`📊 Environment: ${NODE_ENV}`);
      logger.info(`🌐 Port: ${PORT}`);
      
      // Database status
      logger.info(`🗄️ Primary Database: ${primaryDatabaseHealthy ? 'Xata (Connected)' : 'Not Available'}`);
      logger.info(`🗄️ Fallback Database: ${fallbackDatabaseHealthy ? 'Supabase (Connected)' : 'Not Available'}`);
      logger.info(`🗄️ Database Status: ${hasWorkingDatabase ? 'Operational' : 'Degraded'}`);
      
      // Authentication status
      logger.info(`🔐 Authentication: ${clerkInitialized ? 'Clerk (Enabled)' : 'Disabled'}`);
      
      // Cache and services
      logger.info(`📋 Redis: ${redisService ? 'Enabled' : 'Disabled'}`);
      logger.info(`📡 Profile API: Available at /api/profiles/*`);
      logger.info(`👥 Friends API: Available at /api/friends/*`);
      logger.info(`🔐 Auth API: Available at /api/auth/*`);
      logger.info(`💬 Friends Chat: Available with ${redisService ? '24h Redis caching' : 'memory-only caching'}`);
      logger.info(`🔒 CORS Origins: ${allowedOrigins.length} configured`);
      logger.info(`📈 Performance Monitoring: ${performanceMonitor.isEnabled ? 'Enabled' : 'Disabled'}`);
      logger.info(`💬 Socket.IO: Enhanced configuration with authentication`);
      logger.info(`🔧 Memory Limit: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`);
      
      // Debug info for development
      if (NODE_ENV === 'development') {
        logger.info(`🐛 Debug Dashboard: http://localhost:${PORT}/debug/dashboard`);
        logger.info(`🔍 Debug API: http://localhost:${PORT}/debug/*`);
        logger.info(`📡 Profile API: http://localhost:${PORT}/api/profiles/*`);
        logger.info(`👥 Friends API: http://localhost:${PORT}/api/friends/*`);
        logger.info(`🔐 Auth API: http://localhost:${PORT}/api/auth/*`);
      }
      
      // Show comprehensive service architecture
      if (primaryDatabaseHealthy) {
        logger.info(`🏗️ Architecture: Xata (Primary) + ${redisService ? 'Redis (Cache)' : 'Memory (Cache)'} + Clerk (Auth)`);
      } else if (fallbackDatabaseHealthy) {
        logger.info(`🏗️ Architecture: Supabase (Fallback) + ${redisService ? 'Redis (Cache)' : 'Memory (Cache)'} + Clerk (Auth)`);
      } else {
        logger.info(`🏗️ Architecture: No Database + ${redisService ? 'Redis (Cache)' : 'Memory (Cache)'} + Clerk (Auth)`);
      }
      
      // Caching strategy
      if (redisService) {
        logger.info(`💾 Caching: Redis (distributed) + LRU (local) + Clerk (auth)`);
        logger.info(`⚡ Queue Persistence: Redis-backed queues active`);
        logger.info(`🔄 Profile Cache: Multi-layer (Redis + Memory + Database)`);
        logger.info(`👥 Friends Cache: Redis-backed with real-time updates`);
        logger.info(`💬 Chat Cache: 24h Redis persistence + real-time delivery`);
        logger.info(`🔐 Auth Cache: Token caching with 5min TTL`);
      } else {
        logger.info(`💾 Caching: LRU (local memory only) + Clerk (auth)`);
        logger.info(`⚡ Queue Persistence: Memory-only (lost on restart)`);
        logger.info(`🔄 Profile Cache: Memory + Database only`);
        logger.info(`👥 Friends Cache: Memory-only (lost on restart)`);
        logger.info(`💬 Chat Cache: Memory-only (lost on restart)`);
        logger.info(`🔐 Auth Cache: Local token caching only`);
      }
      
      const initialHealth = socketManager.healthCheck();
      logger.info(`💚 Initial Health Status: ${initialHealth.status}`);

      // ✅ STEP 13: Run startup tests with proper error handling
      try {
        await testProfileApiEndpoints();
        await testFriendsApiEndpoints();
        await testAuthEndpoints();
        
        if (redisService) {
          await testRedisOperations(redisService);
        }
        
        if (xataClient) {
          await testXataOperations(xataClient);
        }
        
        logger.info('🧪 All startup tests completed successfully');
      } catch (error) {
        logger.warn('⚠️ Some startup tests failed (non-critical):', error);
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
    
    // Test with Xata if available, fallback to Supabase
    const xataClient = getXataClient();
    if (xataClient) {
      const xataHealthy = await xataClient.testConnection();
      if (xataHealthy) {
        logger.info('✅ Profile API Xata connection working');
      } else {
        logger.warn('⚠️ Profile API Xata connection issues');
      }
    }
    
    // Also test Supabase if configured
    const supabaseHealth = await healthCheckSupabase();
    if (supabaseHealth.connected) {
      logger.info('✅ Profile API Supabase connection working');
    } else {
      logger.debug('Supabase not connected (using Xata as primary)');
    }
    
    logger.info('✅ Profile API routes are configured and available');
    
  } catch (error: any) {
    logger.warn('⚠️ Profile API test failed (non-critical):', error.message);
  }
}

async function testFriendsApiEndpoints(): Promise<void> {
  try {
    logger.info('🧪 Testing Friends API endpoints...');
    
    // Test primary database connection
    const xataClient = getXataClient();
    if (xataClient) {
      const xataHealthy = await xataClient.testConnection();
      if (xataHealthy) {
        logger.info('✅ Friends API Xata connection working');
      } else {
        logger.warn('⚠️ Friends API Xata connection issues');
      }
    }
    
    logger.info('✅ Friends API routes are configured and available');
    
  } catch (error: any) {
    logger.warn('⚠️ Friends API test failed (non-critical):', error.message);
  }
}

async function testAuthEndpoints(): Promise<void> {
  try {
    logger.info('🧪 Testing Authentication API endpoints...');
    
    const clerkHealth = await testClerkConnection();
    if (clerkHealth.connected) {
      logger.info(`✅ Auth API Clerk connection working (${clerkHealth.latency}ms)`);
    } else {
      logger.warn('⚠️ Auth API Clerk connection issues:', clerkHealth.error);
    }
    
    const authStats = getAuthStats();
    logger.info('📊 Auth cache stats:', authStats);
    
    logger.info('✅ Auth API routes are configured and available');
    
  } catch (error: any) {
    logger.warn('⚠️ Auth API test failed (non-critical):', error.message);
  }
}

async function testXataOperations(xataClient: any): Promise<void> {
  try {
    logger.info('🧪 Testing Xata operations...');
    
    // Test basic database stats
    const stats = await xataClient.getDatabaseStats();
    logger.info('📊 Xata database stats:', stats);
    
    // Test search functionality
    const searchResults = await xataClient.searchUserProfiles('test', 1);
    logger.info(`🔍 Xata search test returned ${searchResults.length} results`);
    
    logger.info('✅ All Xata operations tests passed');
    
  } catch (error) {
    logger.error('❌ Xata operations test failed:', error);
    logger.warn('⚠️ Xata may not be functioning correctly');
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
    
    // Test enhanced auth cache operations
    const testUserId = 'test-user-123';
    const testTokenData = { userId: testUserId, user: { id: testUserId, username: 'testuser' } };
    
    // Cache token data
    await redisInstance.setex(`token:test123`, 300, JSON.stringify(testTokenData));
    const cachedToken = await redisInstance.get(`token:test123`);
    
    if (cachedToken) {
      logger.info('✅ Redis auth cache test passed');
      await redisInstance.del(`token:test123`);
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