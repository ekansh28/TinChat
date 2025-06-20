// server/config/socketIO.ts - ENHANCED VERSION WITH TAB CONFLICT PREVENTION
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from '../utils/logger';

export function configureSocketIO(server: HTTPServer, allowedOrigins: string[]): SocketIOServer {
  const io = new SocketIOServer(server, {
    // ✅ ENHANCED: Connection state recovery with better conflict resolution
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: true,
    },
    
    transports: ['websocket', 'polling'],
    allowUpgrades: true,
    
    // ✅ CRITICAL: Adjusted timeouts to prevent duplicate connections
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 10000,
    
    maxHttpBufferSize: 1e6,
    
    perMessageDeflate: {
      threshold: 1024,
      concurrencyLimit: 10,
      memLevel: 7,
    },
    
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn(`🚫 CORS denied for origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ["GET", "POST"],
      credentials: true,
      optionsSuccessStatus: 200
    },
    
    // ✅ CRITICAL: Enhanced connection validation with better rate limiting
    allowRequest: (req, callback) => {
      const ip = req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      
      // ✅ Allow reasonable number of tabs but prevent abuse
      const maxConnectionsPerIP = 5; // Reduced from 10 to prevent conflicts
      const connectionsFromIP = Array.from(io.sockets.sockets.values())
        .filter(socket => socket.handshake.address === ip).length;
      
      if (connectionsFromIP >= maxConnectionsPerIP) {
        logger.warn(`🚨 Too many connections from IP ${ip}: ${connectionsFromIP}`);
        callback('Too many connections from this IP', false);
        return;
      }
      
      callback(null, true);
    },
    
    allowEIO3: true,
    serveClient: false,
    connectTimeout: 20000,
    httpCompression: true
  });

  // ✅ CRITICAL: Enhanced ID generator to prevent conflicts
  io.engine.generateId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 12)}-${process.hrtime.bigint()}`;
  };

  // ✅ ENHANCED: Comprehensive tracking with conflict prevention
  const connectionsByIP = new Map<string, number>();
  const connectionDetails = new Map<string, {
    ip: string;
    userAgent: string;
    connectedAt: Date;
    tabId?: string;
    chatType?: string;
    authId?: string;
  }>();

  // ✅ CRITICAL: Enhanced tab tracking with conflict detection
  const activeTabsByIP = new Map<string, Set<string>>();
  const activeTabsByUser = new Map<string, Set<string>>();
  const socketToTab = new Map<string, string>();
  const tabToSocket = new Map<string, string>();

  function trackConnection(ip: string): void {
    const current = connectionsByIP.get(ip) || 0;
    connectionsByIP.set(ip, current + 1);
  }

  function untrackConnection(ip: string): void {
    const current = connectionsByIP.get(ip) || 0;
    if (current <= 1) {
      connectionsByIP.delete(ip);
    } else {
      connectionsByIP.set(ip, current - 1);
    }
  }

  // ✅ CRITICAL: Enhanced connection handling with comprehensive duplicate prevention
  io.on('connection', (socket) => {
    const ip = socket.request.socket.remoteAddress || 'unknown';
    const userAgent = socket.request.headers?.['user-agent'] || 'unknown';
    const query = socket.handshake.query || {};
    
    trackConnection(ip);
    
    connectionDetails.set(socket.id, {
      ip,
      userAgent,
      connectedAt: new Date(),
      tabId: query.tabId as string,
      chatType: query.chatType as string
    });

    logger.info(`🔗 New connection: ${socket.id}`, {
      ip,
      transport: socket.conn.transport.name,
      userAgent: userAgent.substring(0, 50),
      tabId: query.tabId,
      chatType: query.chatType,
      totalFromIP: connectionsByIP.get(ip) || 1,
      totalConnections: io.engine.clientsCount
    });

    // ✅ CRITICAL: Enhanced tab identification with aggressive duplicate prevention
    socket.on('identify_tab', (data: { 
      tabId?: string; 
      chatType?: string; 
      authId?: string;
      isReconnect?: boolean;
      timestamp?: number;
    }) => {
      if (!data?.tabId) {
        logger.warn(`🚨 Tab identification missing tabId from ${socket.id}`);
        return;
      }

      const details = connectionDetails.get(socket.id);
      if (details) {
        details.tabId = data.tabId;
        details.chatType = data.chatType || 'text';
        details.authId = data.authId;
        connectionDetails.set(socket.id, details);
      }
      
      // ✅ CRITICAL: Check for existing tab connections and force disconnect
      const existingSocketId = tabToSocket.get(data.tabId);
      if (existingSocketId && existingSocketId !== socket.id) {
        const existingSocket = io.sockets.sockets.get(existingSocketId);
        if (existingSocket && existingSocket.connected) {
          logger.warn(`🚨 DUPLICATE TAB DETECTED: ${data.tabId} already connected as ${existingSocketId}`);
          
          // Force disconnect the old socket immediately
          existingSocket.emit('duplicate_tab_detected', { 
            reason: 'New tab opened with same ID',
            newSocketId: socket.id,
            timestamp: Date.now()
          });
          
          // Clean up old mappings
          const oldTabId = socketToTab.get(existingSocketId);
          if (oldTabId) {
            socketToTab.delete(existingSocketId);
            tabToSocket.delete(oldTabId);
          }
          
          existingSocket.disconnect(true);
          logger.info(`✅ Disconnected duplicate tab ${existingSocketId} for ${data.tabId}`);
        }
      }
      
      // ✅ CRITICAL: Check for same auth ID conflicts (prevent user self-matching)
      if (data.authId) {
        const conflictingSockets = Array.from(connectionDetails.entries())
          .filter(([socketId, details]) => 
            socketId !== socket.id && 
            details.authId === data.authId &&
            details.chatType === data.chatType
          );
        
        if (conflictingSockets.length > 0) {
          logger.warn(`🚨 AUTH CONFLICT: User ${data.authId} has ${conflictingSockets.length} existing ${data.chatType} connections`);
          
          // Disconnect conflicting sockets of same type
          conflictingSockets.forEach(([conflictSocketId, conflictDetails]) => {
            const conflictSocket = io.sockets.sockets.get(conflictSocketId);
            if (conflictSocket && conflictSocket.connected) {
              logger.warn(`🚨 Disconnecting conflicting auth socket: ${conflictSocketId}`);
              conflictSocket.emit('auth_conflict_detected', {
                reason: 'Same user opened new tab',
                authId: data.authId,
                chatType: data.chatType
              });
              conflictSocket.disconnect(true);
            }
          });
        }
      }
      
      // Update all mappings
      socketToTab.set(socket.id, data.tabId);
      tabToSocket.set(data.tabId, socket.id);
      
      // Track tabs by IP
      if (!activeTabsByIP.has(ip)) {
        activeTabsByIP.set(ip, new Set());
      }
      activeTabsByIP.get(ip)!.add(data.tabId);
      
      // Track tabs by user
      if (data.authId) {
        if (!activeTabsByUser.has(data.authId)) {
          activeTabsByUser.set(data.authId, new Set());
        }
        activeTabsByUser.get(data.authId)!.add(data.tabId);
      }
      
      logger.info(`🏷️ Tab identified: ${socket.id} -> ${data.tabId} (${data.chatType || 'text'}, IP: ${ip})`);
      
      // Send confirmation
      socket.emit('tab_identified', { 
        socketId: socket.id, 
        tabId: data.tabId,
        chatType: data.chatType,
        isReconnect: data.isReconnect || false,
        timestamp: Date.now()
      });
    });

    // ✅ Enhanced transport monitoring
    socket.conn.on('upgrade', () => {
      const tabId = socketToTab.get(socket.id);
      logger.debug(`📈 Transport upgraded: ${socket.id} (${tabId || 'no-tab'}) -> ${socket.conn.transport.name}`);
    });

    socket.conn.on('upgradeError', (err) => {
      const tabId = socketToTab.get(socket.id);
      logger.warn(`📉 Transport upgrade error: ${socket.id} (${tabId || 'no-tab'})`, err.message);
    });

    // ✅ CRITICAL: Enhanced disconnect handling with comprehensive cleanup
    socket.on('disconnect', (reason, details) => {
      const connDetails = connectionDetails.get(socket.id);
      const tabId = socketToTab.get(socket.id);
      
      if (connDetails) {
        untrackConnection(connDetails.ip);
        
        // ✅ CRITICAL: Clean up ALL tracking mappings
        if (tabId) {
          socketToTab.delete(socket.id);
          tabToSocket.delete(tabId);
          
          // Clean up IP tab tracking
          const ipTabs = activeTabsByIP.get(connDetails.ip);
          if (ipTabs) {
            ipTabs.delete(tabId);
            if (ipTabs.size === 0) {
              activeTabsByIP.delete(connDetails.ip);
            }
          }
          
          // Clean up user tab tracking
          if (connDetails.authId) {
            const userTabs = activeTabsByUser.get(connDetails.authId);
            if (userTabs) {
              userTabs.delete(tabId);
              if (userTabs.size === 0) {
                activeTabsByUser.delete(connDetails.authId);
              }
            }
          }
        }
        
        const duration = new Date().getTime() - connDetails.connectedAt.getTime();
        
        logger.info(`🔌 Disconnected ${socket.id}`, {
          reason,
          duration: `${Math.round(duration / 1000)}s`,
          ip: connDetails.ip,
          tabId: tabId || 'no-tab',
          chatType: connDetails.chatType || 'unknown',
          authId: connDetails.authId || 'anonymous',
          transport: socket.conn.transport.name,
          remainingFromIP: connectionsByIP.get(connDetails.ip) || 0
        });
        
        connectionDetails.delete(socket.id);
      }
    });

    // ✅ Enhanced error handling
    socket.on('error', (err) => {
      const connDetails = connectionDetails.get(socket.id);
      const tabId = socketToTab.get(socket.id);
      
      logger.error(`❌ Socket error (${socket.id}):`, {
        error: err.message,
        ip: connDetails?.ip,
        tabId: tabId || 'no-tab',
        chatType: connDetails?.chatType,
        transport: socket.conn.transport.name
      });
    });

    // ✅ Enhanced heartbeat handling
    socket.on('heartbeat_response', (data) => {
      const tabId = socketToTab.get(socket.id);
      const connDetails = connectionDetails.get(socket.id);
      
      if (data?.timestamp) {
        logger.debug(`💓 Heartbeat from ${socket.id} (${tabId || 'no-tab'}):`, {
          latency: Date.now() - data.timestamp,
          ip: connDetails?.ip,
          chatType: data.chatType || connDetails?.chatType
        });
      }
    });

    // ✅ Connection health monitoring
    socket.on('connection_health', (data) => {
      const tabId = socketToTab.get(socket.id);
      logger.debug(`🏥 Health report from ${socket.id} (${tabId || 'no-tab'}):`, data);
    });
  });

  // ✅ ENHANCED: Periodic monitoring with conflict detection
  setInterval(() => {
    const stats = {
      totalConnections: io.engine.clientsCount,
      uniqueIPs: connectionsByIP.size,
      totalTabs: socketToTab.size,
      authenticatedUsers: activeTabsByUser.size,
      duplicateWarnings: 0
    };
    
    // Check for potential duplicates
    for (const [authId, tabs] of activeTabsByUser.entries()) {
      if (tabs.size > 2) {
        stats.duplicateWarnings++;
        logger.warn(`🚨 User ${authId.substring(0, 8)} has ${tabs.size} tabs open`);
      }
    }
    
    logger.debug('📊 Enhanced connection stats:', stats);
    
    // Alert on high connection counts
    for (const [ip, count] of connectionsByIP.entries()) {
      if (count > 3) {
        logger.warn(`🚨 High connection count from IP ${ip}: ${count} connections`);
      }
    }
  }, 60000);

  // ✅ Periodic cleanup of stale mappings
  setInterval(() => {
    const activeSocketIds = new Set(io.sockets.sockets.keys());
    
    // Clean up stale socket->tab mappings
    for (const [socketId, tabId] of socketToTab.entries()) {
      if (!activeSocketIds.has(socketId)) {
        logger.debug(`🧹 Cleaning stale mapping: ${socketId} -> ${tabId}`);
        socketToTab.delete(socketId);
        tabToSocket.delete(tabId);
      }
    }
    
    // Clean up stale connection details
    for (const socketId of connectionDetails.keys()) {
      if (!activeSocketIds.has(socketId)) {
        connectionDetails.delete(socketId);
      }
    }
  }, 2 * 60 * 1000);

  logger.info('⚡ Enhanced Socket.IO server configured with comprehensive conflict prevention');
  return io;
}