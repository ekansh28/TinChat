// server/managers/SocketManager.ts - MODULAR VERSION
import { Server as SocketIOServer, Socket } from 'socket.io';
import { ProfileManager } from './ProfileManager';
import { MessageBatcher } from '../utils/MessageBatcher';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';
import { ProfileCache } from '../utils/ProfileCache';
import { MatchmakingEngine } from '../services/MatchmakingEngine';
import { RoomManager } from '../services/RoomManager';
import { TypingManager } from '../services/TypingManager';
import { logger } from '../utils/logger';

// Import modular components
import { ConnectionManager } from './modules/ConnectionManager';
import { MessageHandler } from './modules/MessageHandler';
import { MatchmakingHandler } from './modules/MatchmakingHandler';
import { UserStatusHandler } from './modules/UserStatusHandler';
import { EventRouter } from './modules/EventRouter';

// Import types for backward compatibility - use inline types if file doesn't exist
type SocketManagerStats = {
  onlineUsers: number;
  queues: any;
  rooms: any;
  cache: any;
  performance: any;
  disconnects: any;
  memory: any;
  modules?: any;
};

type SocketManagerHealthCheck = {
  status: 'healthy' | 'degraded' | 'down';
  activeConnections: number;
  staleConnections: number;
  onlineUsers: number;
  memoryUsage: NodeJS.MemoryUsage;
  uptime: number;
  timestamp: string;
};

type MatchmakingDebugInfo = {
  queueStats: any;
  queueDetails: any;
  socketToAuthMapping: number;
  authToSocketMapping: number;
  userInterests: number;
  roomMappings: number;
  roomToSocketMappings: number;
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

  // Modular components - use definite assignment assertion since they're initialized in initializeModules()
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

  constructor(
    io: SocketIOServer,
    profileManager: ProfileManager,
    messageBatcher: MessageBatcher,
    performanceMonitor: PerformanceMonitor
  ) {
    this.io = io;
    this.profileManager = profileManager;
    this.messageBatcher = messageBatcher;
    this.performanceMonitor = performanceMonitor;
    
    // Initialize core services
    this.profileCache = new ProfileCache();
    this.matchmakingEngine = new MatchmakingEngine();
    this.roomManager = new RoomManager();
    this.typingManager = new TypingManager(io);
    
    // Initialize modular components
    this.initializeModules();
    
    // Setup main socket handler
    this.setupSocketHandlers();
    
    // Start periodic tasks
    this.startPeriodicTasks();
    
    logger.info('🔌 Modular SocketManager initialized');
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

    // Initialize Matchmaking Handler
    this.matchmakingHandler = new MatchmakingHandler(
      this.io,
      this.matchmakingEngine,
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

    logger.info('✅ All SocketManager modules initialized');
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      // Store connection start time for shared state
      this.connectionStartTimes.set(socket.id, Date.now());
      
      // Route all socket events through the event router
      this.eventRouter.setupSocketHandlers(socket);
      
      // Record connection for performance monitoring
      this.performanceMonitor.recordConnection();
    });
  }

  private startPeriodicTasks(): void {
    // Comprehensive stats logging
    const statsInterval = setInterval(() => {
      const stats = this.getStats();
      
      logger.debug('📊 SocketManager comprehensive stats:', {
        onlineUsers: stats.onlineUsers,
        queues: stats.queues,
        rooms: stats.rooms,
        cache: stats.cache,
        performance: stats.performance,
        memory: stats.memory
      });
    }, 30000);
    this.periodicTaskIntervals.push(statsInterval);

    // Queue cleanup
    const queueCleanupInterval = setInterval(() => {
      this.matchmakingEngine.cleanupStaleUsers((socketId) => {
        const socket = this.io.sockets.sockets.get(socketId);
        return socket?.connected || false;
      });
    }, 60000);
    this.periodicTaskIntervals.push(queueCleanupInterval);

    // Memory cleanup
    const memoryCleanupInterval = setInterval(() => {
      this.performMemoryCleanup();
    }, 300000);
    this.periodicTaskIntervals.push(memoryCleanupInterval);

    logger.info('🔄 Periodic tasks started');
  }

  private performMemoryCleanup(): void {
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

      logger.debug('🧹 Memory cleanup completed', {
        activeConnections: activeSocketIds.size,
        mappingsCleanedUp: {
          connectionTimes: this.connectionStartTimes.size,
          authMappings: this.socketToAuthId.size,
          roomMappings: this.socketToRoom.size,
          roomToSockets: this.roomToSockets.size,
        }
      });
    } catch (error) {
      logger.error('❌ Memory cleanup failed:', error);
    }
  }

  // ✅ PUBLIC API METHODS - Maintain exact backward compatibility with server/index.ts

  public getStats(): SocketManagerStats {
    const connectionStats = this.connectionManager.getStats();
    const queueStats = this.matchmakingEngine.getQueueStats();
    const roomStats = this.roomManager.getStats();
    const performanceStats = this.performanceMonitor.getStats();
    const disconnectSummary = connectionStats.disconnects;

    return {
      // ✅ FIXED: Maintain expected structure for server/index.ts
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
      
      // ✅ ADDITIONAL: Detailed modular stats (optional, for debugging)
      modules: {
        connections: connectionStats,
        messages: this.messageHandler.getStats(),
        matchmaking: this.matchmakingHandler.getStats(),
        userStatus: this.userStatusHandler.getStats(),
      }
    };
  }

  public healthCheck(): SocketManagerHealthCheck {
    return this.connectionManager.healthCheck();
  }

  public debugMatchmaking(): MatchmakingDebugInfo {
    return this.matchmakingHandler.debugMatchmaking();
  }

  public forceMatch(chatType: 'text' | 'video') {
    return this.matchmakingHandler.forceMatch(chatType);
  }

  // ✅ ACCESS TO MODULES for external use
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

  public getRoomManager(): RoomManager {
    return this.roomManager;
  }

  public getTypingManager(): TypingManager {
    return this.typingManager;
  }

  // ✅ GRACEFUL SHUTDOWN
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
}