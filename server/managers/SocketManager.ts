// server/managers/SocketManager.ts - CONSTRUCTOR FIX ONLY
import { Server as SocketIOServer, Socket } from 'socket.io';
import { ProfileManager } from './ProfileManager';
import { MessageBatcher } from '../utils/MessageBatcher';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';
import { ProfileCache } from '../utils/ProfileCache';
import { MatchmakingEngine } from '../services/MatchmakingEngine';
import { RoomManager } from '../services/RoomManager';
import { TypingManager } from '../services/TypingManager';
import { RedisService } from '../services/RedisService';
import { logger } from '../utils/logger';

// Import modular components
import { ConnectionManager } from './modules/ConnectionManager';
import { MessageHandler } from './modules/MessageHandler';
import { MatchmakingHandler } from './modules/MatchmakingHandler';
import { UserStatusHandler } from './modules/UserStatusHandler';
import { EventRouter } from './modules/EventRouter';

// Type definitions for backward compatibility
type SocketManagerStats = {
  onlineUsers: number;
  queues: any;
  rooms: any;
  cache: any;
  performance: any;
  disconnects: any;
  memory: any;
  modules?: any;
  redis?: any;
};

type SocketManagerHealthCheck = {
  status: 'healthy' | 'degraded' | 'down';
  activeConnections: number;
  staleConnections: number;
  onlineUsers: number;
  memoryUsage: NodeJS.MemoryUsage;
  uptime: number;
  timestamp: string;
  redis?: { connected: boolean; mode: string };
};

type MatchmakingDebugInfo = {
  queueStats: any;
  queueDetails: any;
  socketToAuthMapping: number;
  authToSocketMapping: number;
  userInterests: number;
  roomMappings: number;
  roomToSocketMappings: number;
  redis?: { enabled: boolean; mode: string };
};

export class SocketManager {
  private io: SocketIOServer;
  private profileManager: ProfileManager;
  private messageBatcher: MessageBatcher;
  private performanceMonitor: PerformanceMonitor;
  private profileCache: ProfileCache;
  private matchmakingEngine: MatchmakingEngine;
  private roomManager: RoomManager;
  private typingManager: TypingManager;
  private redisService: RedisService | null;

  // Modular components
  private connectionManager!: ConnectionManager;
  private messageHandler!: MessageHandler;
  private matchmakingHandler!: MatchmakingHandler;
  private userStatusHandler!: UserStatusHandler;
  private eventRouter!: EventRouter;

  // Shared state maps for coordination between modules
  private socketToAuthId = new Map<string, string>();
  private authIdToSocketId = new Map<string, string>();
  private userInterests = new Map<string, string[]>();
  private socketToRoom = new Map<string, string>();
  private roomToSockets = new Map<string, Set<string>>();
  private connectionStartTimes = new Map<string, number>();

  // Periodic task intervals for cleanup
  private periodicTaskIntervals: NodeJS.Timeout[] = [];

  // ✅ FIXED: Constructor with correct parameter order to match server/index.ts
  constructor(
    io: SocketIOServer,
    profileManager: ProfileManager,
    messageBatcher: MessageBatcher,
    performanceMonitor: PerformanceMonitor,
    redisService: RedisService | null = null // ✅ FIXED: Optional Redis service parameter
  ) {
    this.io = io;
    this.profileManager = profileManager;
    this.messageBatcher = messageBatcher;
    this.performanceMonitor = performanceMonitor;
    this.redisService = redisService;
    
    // Initialize core services with Redis support
    this.profileCache = new ProfileCache();
    
    // ✅ ENHANCED: Initialize MatchmakingEngine with Redis support
    this.matchmakingEngine = new MatchmakingEngine(redisService);
    
    this.roomManager = new RoomManager();
    this.typingManager = new TypingManager(io);
    
    // Initialize modular components
    this.initializeModules();
    
    // Setup main socket handler
    this.setupSocketHandlers();
    
    // Start periodic tasks with Redis support
    this.startPeriodicTasks();
    
    logger.info('🔌 Modular SocketManager initialized', {
      redisEnabled: !!redisService,
      matchmakingMode: redisService ? 'redis-persistent' : 'memory-only'
    });
  }

  private initializeModules(): void {
    // Initialize Connection Manager
    this.connectionManager = new ConnectionManager(this.io);

    // Initialize Message Handler
    this.messageHandler = new MessageHandler(
      this.io,
      this.profileManager,
      this.messageBatcher,
      this.roomManager,
      this.profileCache,
      this.performanceMonitor,
      this.socketToRoom
    );

    // Initialize Matchmaking Handler with Redis-enhanced engine
    this.matchmakingHandler = new MatchmakingHandler(
      this.io,
      this.matchmakingEngine, // This now has Redis support
      this.roomManager,
      this.profileManager,
      this.profileCache,
      this.performanceMonitor,
      this.socketToAuthId,
      this.authIdToSocketId,
      this.userInterests,
      this.socketToRoom,
      this.roomToSockets,
      this.connectionStartTimes
    );

    // Initialize User Status Handler
    this.userStatusHandler = new UserStatusHandler(
      this.io,
      this.profileManager,
      this.roomManager,
      this.profileCache,
      this.socketToAuthId
    );

    // Initialize Event Router
    this.eventRouter = new EventRouter(
      this.connectionManager,
      this.messageHandler,
      this.matchmakingHandler,
      this.userStatusHandler,
      this.typingManager
    );

    logger.info('✅ All SocketManager modules initialized with Redis support');
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      // Store connection start time for shared state
      this.connectionStartTimes.set(socket.id, Date.now());
      
      // Store socket mapping in Redis for persistence
      if (this.redisService) {
        this.redisService.setSocketMapping(socket.id, `anonymous_${Date.now()}`).catch(err =>
          logger.debug(`Failed to set initial socket mapping for ${socket.id}:`, err)
        );
      }
      
      // Route all socket events through the event router
      this.eventRouter.setupSocketHandlers(socket);
      
      // Record connection for performance monitoring
      this.performanceMonitor.recordConnection();
    });
  }

  private startPeriodicTasks(): void {
    // Comprehensive stats logging with Redis information
    const statsInterval = setInterval(async () => {
      const stats = await this.getEnhancedStats();
      
      logger.debug('📊 SocketManager comprehensive stats:', {
        onlineUsers: stats.onlineUsers,
        queues: stats.queues,
        rooms: stats.rooms,
        cache: stats.cache,
        performance: stats.performance,
        memory: stats.memory,
        redis: stats.redis || { enabled: false }
      });
    }, 30000);
    this.periodicTaskIntervals.push(statsInterval);

    // Queue cleanup with Redis support
    const queueCleanupInterval = setInterval(async () => {
      await this.matchmakingEngine.cleanupStaleUsers((socketId) => {
        const socket = this.io.sockets.sockets.get(socketId);
        return socket?.connected || false;
      });
    }, 60000);
    this.periodicTaskIntervals.push(queueCleanupInterval);

    // Memory cleanup with Redis coordination
    const memoryCleanupInterval = setInterval(async () => {
      await this.performMemoryCleanup();
    }, 300000);
    this.periodicTaskIntervals.push(memoryCleanupInterval);

    // Redis health monitoring (if Redis is available)
    if (this.redisService) {
      const redisHealthInterval = setInterval(async () => {
        await this.monitorRedisHealth();
      }, 120000); // Every 2 minutes
      this.periodicTaskIntervals.push(redisHealthInterval);
    }

    logger.info('🔄 Periodic tasks started with Redis monitoring');
  }

  // Monitor Redis health and performance
  private async monitorRedisHealth(): Promise<void> {
    if (!this.redisService) return;
    
    try {
      const startTime = Date.now();
      const isConnected = await this.redisService.testConnection();
      const operationTime = Date.now() - startTime;
      
      if (!isConnected) {
        logger.warn('⚠️ Redis health check failed - connection lost');
      } else if (operationTime > 1000) {
        logger.warn(`⚠️ Redis health check slow: ${operationTime}ms`);
      } else {
        logger.debug(`✅ Redis health check passed: ${operationTime}ms`);
      }
      
      // Get Redis statistics periodically
      const redisStats = await this.redisService.getRedisStats();
      if (redisStats) {
        logger.debug('📊 Redis stats:', redisStats);
      }
      
    } catch (error) {
      logger.error('❌ Redis health monitoring failed:', error);
    }
  }

  // Memory cleanup with Redis coordination
  private async performMemoryCleanup(): Promise<void> {
    try {
      const activeSocketIds = new Set(this.io.sockets.sockets.keys());
      
      // Clean up all shared state maps
      [
        this.connectionStartTimes,
        this.socketToAuthId,
        this.userInterests,
        this.socketToRoom
      ].forEach(map => {
        for (const socketId of map.keys()) {
          if (!activeSocketIds.has(socketId)) {
            map.delete(socketId);
          }
        }
      });

      // Clean up reverse mappings
      for (const [authId, socketId] of this.authIdToSocketId.entries()) {
        if (!activeSocketIds.has(socketId)) {
          this.authIdToSocketId.delete(authId);
        }
      }

      // Clean up room mappings
      for (const [roomId, sockets] of this.roomToSockets.entries()) {
        const validSockets = Array.from(sockets).filter(socketId => 
          activeSocketIds.has(socketId)
        );
        
        if (validSockets.length === 0) {
          this.roomToSockets.delete(roomId);
        } else {
          this.roomToSockets.set(roomId, new Set(validSockets));
        }
      }

      // Clean up Redis socket mappings for disconnected users
      if (this.redisService) {
        const disconnectedSockets = Array.from(this.connectionStartTimes.keys())
          .filter(socketId => !activeSocketIds.has(socketId));
        
        for (const socketId of disconnectedSockets) {
          this.redisService.removeSocketMapping(socketId).catch(err =>
            logger.debug(`Failed to clean Redis mapping for ${socketId}:`, err)
          );
        }
      }

      logger.debug('🧹 Memory cleanup completed', {
        activeConnections: activeSocketIds.size,
        mappingsCleanedUp: {
          connectionTimes: this.connectionStartTimes.size,
          authMappings: this.socketToAuthId.size,
          roomMappings: this.socketToRoom.size,
          roomToSockets: this.roomToSockets.size,
        },
        redisEnabled: !!this.redisService
      });
    } catch (error) {
      logger.error('❌ Memory cleanup failed:', error);
    }
  }

  // Enhanced stats with Redis information
  public async getEnhancedStats(): Promise<SocketManagerStats> {
    const connectionStats = this.connectionManager.getStats();
    const queueStats = await this.matchmakingEngine.getQueueStats();
    const roomStats = this.roomManager.getStats();
    const performanceStats = this.performanceMonitor.getStats();
    const disconnectSummary = connectionStats.disconnects;

    // Get Redis statistics if available
    let redisStats = null;
    if (this.redisService) {
      try {
        const queueHealth = await this.matchmakingEngine.getQueueHealth();
        redisStats = {
          connected: queueHealth.redis.connected,
          mode: queueHealth.redis.mode,
          performance: queueHealth.performance,
          profileCache: this.profileManager.getCacheStats().redis || null
        };
      } catch (error) {
        redisStats = {
          connected: false,
          mode: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return {
      onlineUsers: connectionStats.onlineUsers,
      queues: queueStats,
      rooms: roomStats,
      cache: this.profileCache.getStats(),
      performance: performanceStats,
      disconnects: disconnectSummary,
      memory: {
        trackedConnections: connectionStats.trackedConnections,
        authMappings: this.socketToAuthId.size,
        roomMappings: this.socketToRoom.size,
        roomToSocketMappings: this.roomToSockets.size,
        heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB`,
      },
      redis: redisStats,
      modules: {
        connections: connectionStats,
        messages: this.messageHandler.getStats(),
        matchmaking: this.matchmakingHandler.getStats(),
        userStatus: this.userStatusHandler.getStats(),
      }
    };
  }

  // Standard getStats method for backward compatibility
  public getStats(): SocketManagerStats {
    const connectionStats = this.connectionManager.getStats();
    const queueStats = this.matchmakingEngine.getQueueStats();
    const roomStats = this.roomManager.getStats();
    const performanceStats = this.performanceMonitor.getStats();
    const disconnectSummary = connectionStats.disconnects;

    return {
      onlineUsers: connectionStats.onlineUsers,
      queues: queueStats,
      rooms: roomStats,
      cache: this.profileCache.getStats(),
      performance: performanceStats,
      disconnects: disconnectSummary,
      memory: {
        trackedConnections: connectionStats.trackedConnections,
        authMappings: this.socketToAuthId.size,
        roomMappings: this.socketToRoom.size,
        roomToSocketMappings: this.roomToSockets.size,
        heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB`,
      },
      modules: {
        connections: connectionStats,
        messages: this.messageHandler.getStats(),
        matchmaking: this.matchmakingHandler.getStats(),
        userStatus: this.userStatusHandler.getStats(),
      }
    };
  }

  // Health check with Redis information
  public healthCheck(): SocketManagerHealthCheck {
    const baseHealth = this.connectionManager.healthCheck();

    const redisHealth = {
      connected: this.redisService ? this.matchmakingEngine.isUsingRedis() : false,
      mode: this.redisService && this.matchmakingEngine.isUsingRedis()
        ? 'redis-primary'
        : 'memory-fallback'
    };

    return {
      ...baseHealth,
      redis: redisHealth
    };
  }


  // Debug matchmaking with Redis information
  public debugMatchmaking(): MatchmakingDebugInfo {
    const baseDebug = this.matchmakingHandler.debugMatchmaking();
    
    let redisDebug = null;
    if (this.redisService) {
      redisDebug = {
        enabled: true,
        mode: this.matchmakingEngine.isUsingRedis() ? 'redis-active' : 'memory-fallback'
      };
    } else {
      redisDebug = {
        enabled: false,
        mode: 'memory-only'
      };
    }

    return {
      ...baseDebug,
      redis: redisDebug
    };
  }

  public forceMatch(chatType: 'text' | 'video') {
    return this.matchmakingHandler.forceMatch(chatType);
  }

  // Access to modules for external use
  public getConnectionManager(): ConnectionManager {
    return this.connectionManager;
  }

  public getMessageHandler(): MessageHandler {
    return this.messageHandler;
  }

  public getMatchmakingHandler(): MatchmakingHandler {
    return this.matchmakingHandler;
  }

  public getUserStatusHandler(): UserStatusHandler {
    return this.userStatusHandler;
  }

  public getProfileCache(): ProfileCache {
    return this.profileCache;
  }

  public getMatchmakingEngine(): MatchmakingEngine {
    return this.matchmakingEngine;
  }

  public getTypingManager(): TypingManager {
    return this.typingManager;
  }

  // Get Redis service instance
  public getRedisService(): RedisService | null {
    return this.redisService;
  }

  // Graceful shutdown with Redis cleanup
  public async destroy(): Promise<void> {
    logger.info('🛑 Starting SocketManager graceful shutdown...');
    
    try {
      // Stop all periodic tasks
      this.periodicTaskIntervals.forEach(interval => {
        clearInterval(interval);
      });
      this.periodicTaskIntervals = [];
      
      // Clean up modules
      this.connectionManager.cleanup();
      
      // Perform final Redis operations before shutdown
      if (this.redisService) {
        logger.info('📋 Performing final Redis cleanup...');
        
        // Save current queue state or perform final cleanup
        await this.redisService.cleanup();
        
        // Optionally, save current socket mappings for recovery
        const currentConnections = Array.from(this.socketToAuthId.entries());
        if (currentConnections.length > 0) {
          logger.info(`💾 ${currentConnections.length} active connections during shutdown`);
        }
      }
      
      // Clear all shared state
      this.socketToAuthId.clear();
      this.authIdToSocketId.clear();
      this.userInterests.clear();
      this.socketToRoom.clear();
      this.roomToSockets.clear();
      this.connectionStartTimes.clear();
      
      // Clear caches
      this.profileCache.clear();
      
      logger.info('✅ SocketManager graceful shutdown completed');
    } catch (error) {
      logger.error('❌ Error during SocketManager shutdown:', error);
      throw error;
    }
  }

  // Additional Redis-specific utility methods
  
  /**
   * Check Redis connection health
   */
  public async checkRedisHealth(): Promise<{
    available: boolean;
    connected?: boolean;
    mode?: string;
    operationTime?: number;
  }> {
    if (!this.redisService) {
      return { available: false };
    }
    
    try {
      const startTime = Date.now();
      const connected = await this.redisService.testConnection();
      const operationTime = Date.now() - startTime;
      
      return {
        available: true,
        connected,
        mode: this.matchmakingEngine.isUsingRedis() ? 'redis-primary' : 'memory-fallback',
        operationTime
      };
    } catch (error) {
      return {
        available: true,
        connected: false,
        mode: 'error'
      };
    }
  }

  /**
   * Switch matchmaking engine between Redis and memory mode
   */
  public async switchMatchmakingMode(useRedis: boolean): Promise<{
    success: boolean;
    previousMode: string;
    newMode: string;
    message: string;
  }> {
    const previousMode = this.matchmakingEngine.isUsingRedis() ? 'redis' : 'memory';
    
    try {
      const success = await this.matchmakingEngine.switchMode(useRedis);
      const newMode = this.matchmakingEngine.isUsingRedis() ? 'redis' : 'memory';
      
      return {
        success,
        previousMode,
        newMode,
        message: success 
          ? `Successfully switched from ${previousMode} to ${newMode} mode`
          : `Failed to switch to ${useRedis ? 'Redis' : 'memory'} mode`
      };
    } catch (error) {
      return {
        success: false,
        previousMode,
        newMode: previousMode,
        message: `Error switching mode: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get comprehensive system status including Redis
   */
  public async getSystemStatus(): Promise<{
    server: { uptime: number; memory: NodeJS.MemoryUsage };
    sockets: { active: number; stale: number };
    queues: { mode: string; stats: any };
    cache: { local: any; redis?: any };
    database: { connected: boolean };
    redis: { available: boolean; connected?: boolean; stats?: any };
  }> {
    const health = this.healthCheck();
    const queueStats = await this.matchmakingEngine.getQueueStats();
    const cacheStats = this.profileManager.getCacheStats();
    
    // Test database connection
    const dbHealth = await this.profileManager.testConnection();
    
interface RedisInfo {
  available: boolean;
  connected?: boolean;
  stats?: any;
  error?: string;
}

let redisInfo: RedisInfo = { available: false };

if (this.redisService) {
  try {
    const connected = await this.redisService.testConnection();
    const stats = connected ? await this.redisService.getRedisStats() : null;

    redisInfo = {
      available: true,
      connected,
      stats
    };
  } catch (error) {
    redisInfo = {
      available: true,
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}


    return {
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage()
      },
      sockets: {
        active: health.activeConnections,
        stale: health.staleConnections
      },
      queues: {
        mode: this.matchmakingEngine.isUsingRedis() ? 'redis' : 'memory',
        stats: queueStats
      },
      cache: {
        local: cacheStats.local,
        redis: cacheStats.redis
      },
      database: {
        connected: dbHealth.database
      },
      redis: redisInfo
    };
  }

  /**
   * Perform emergency operations (for debugging/maintenance)
   */
  public async performEmergencyOperations(): Promise<{
    queuesCleaned: number;
    cacheCleared: boolean;
    redisCleanup: boolean;
    message: string;
  }> {
    try {
      logger.warn('🚨 Performing emergency operations...');
      
      // Clear all queues
      const queueResult = await this.matchmakingEngine.clearAllQueues();
      
      // Clear local caches
      this.profileCache.clear();
      
      // Perform Redis cleanup
      let redisCleanup = false;
      if (this.redisService) {
        await this.redisService.cleanup();
        redisCleanup = true;
      }
      
      // Clear shared state
      this.socketToAuthId.clear();
      this.authIdToSocketId.clear();
      this.userInterests.clear();
      this.socketToRoom.clear();
      this.roomToSockets.clear();
      
      const message = `Emergency cleanup completed: ${queueResult.cleared} queues cleared, caches reset`;
      logger.warn(`🚨 ${message}`);
      
      return {
        queuesCleaned: queueResult.cleared,
        cacheCleared: true,
        redisCleanup,
        message
      };
    } catch (error) {
      const errorMessage = `Emergency operations failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(`🚨 ${errorMessage}`);
      
      return {
        queuesCleaned: 0,
        cacheCleared: false,
        redisCleanup: false,
        message: errorMessage
      };
    }
  }
}