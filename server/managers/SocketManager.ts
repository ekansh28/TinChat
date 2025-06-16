// ===== Complete SocketManager.ts with All Missing Methods =====
import { Server as SocketIOServer, Socket } from 'socket.io';
import { ProfileManager, UserProfile } from './ProfileManager';
import { MessageBatcher } from '../utils/MessageBatcher';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';
import { ProfileCache } from '../utils/ProfileCache';
import { ValidationSchemas } from '../validation/schemas';
import { MatchmakingEngine } from '../services/MatchmakingEngine';
import { RoomManager } from '../services/RoomManager';
import { TypingManager } from '../services/TypingManager';
import { logger } from '../utils/logger';
import { UserStatus } from '../types/User';

export interface User {
  id: string; // Socket ID
  authId: string | null;
  interests: string[];
  chatType: 'text' | 'video';
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  pronouns?: string;
  status?: UserStatus;
  displayNameColor?: string;
  displayNameAnimation?: string;
  rainbowSpeed?: number;
  badges?: any[];
  connectionStartTime?: number; // ✅ ADDED: Track connection time
}

export class SocketManager {
  private io: SocketIOServer;
  private profileManager: ProfileManager;
  private messageBatcher: MessageBatcher;
  private performanceMonitor: PerformanceMonitor;
  private profileCache: ProfileCache;
  private matchmakingEngine: MatchmakingEngine;
  private roomManager: RoomManager;
  private typingManager: TypingManager;

  private onlineUserCount = 0;
  private socketToAuthId: { [socketId: string]: string } = {};
  private authIdToSocketId: { [authId: string]: string } = {};
  private lastMatchRequest: { [socketId: string]: number } = {};
  
  // ✅ ADDED: Connection tracking for better monitoring
  private connectionStartTimes: { [socketId: string]: number } = {};
  private disconnectStats = {
    reasons: new Map<string, number>(),
    userAgents: new Map<string, number>(),
    connectionDurations: [] as number[],
  };
  
  private readonly FIND_PARTNER_COOLDOWN_MS = 2000;
  private readonly DEFAULT_PROFILE_COLOR = '#667eea';
  private readonly PING_CHECK_INTERVAL = 60000; // 1 minute
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly STALE_CONNECTION_THRESHOLD = 90000; // 90 seconds

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
    
    this.profileCache = new ProfileCache();
    this.matchmakingEngine = new MatchmakingEngine();
    this.roomManager = new RoomManager();
    this.typingManager = new TypingManager(io);
    
    this.setupSocketHandlers();
    this.startPeriodicTasks();
    this.setupConnectionMonitoring(); // ✅ ADDED
    this.startHeartbeat(); // ✅ ADDED
    
    logger.info('🔌 Enhanced SocketManager initialized with disconnect prevention');
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });
  }

  private handleConnection(socket: Socket): void {
    this.onlineUserCount++;
    this.connectionStartTimes[socket.id] = Date.now(); // ✅ ADDED: Track connection start
    
    logger.info(`👤 User connected: ${socket.id}. Total online: ${this.onlineUserCount}`, {
      userAgent: socket.handshake.headers['user-agent'],
      remoteAddress: socket.handshake.address,
      transport: socket.conn.transport.name,
    });
    
    this.io.emit('onlineUserCountUpdate', this.onlineUserCount);
    this.performanceMonitor.recordConnection();

    // Set up all event handlers for this socket
    this.setupUserEventHandlers(socket);
    this.setupChatEventHandlers(socket);
    this.setupStatusEventHandlers(socket);
    this.setupOnlineUsersEventHandlers(socket);
    this.setupCleanupEventHandlers(socket);
    this.setupHeartbeatHandler(socket); // ✅ ADDED
  }

  private setupUserEventHandlers(socket: Socket): void {
    socket.on('getOnlineUserCount', () => {
      socket.emit('onlineUserCount', this.onlineUserCount);
    });

    socket.on('findPartner', async (payload: unknown) => {
      await this.handleFindPartner(socket, payload);
    });
  }

  private setupChatEventHandlers(socket: Socket): void {
    socket.on('sendMessage', async (payload: unknown) => {
      await this.handleSendMessage(socket, payload);
    });

    socket.on('webrtcSignal', (payload: unknown) => {
      this.handleWebRTCSignal(socket, payload);
    });

    socket.on('typing_start', (payload: unknown) => {
      this.typingManager.handleTypingStart(socket, payload);
    });

    socket.on('typing_stop', (payload: unknown) => {
      this.typingManager.handleTypingStop(socket, payload);
    });

    socket.on('leaveChat', (payload: unknown) => {
      this.handleLeaveChat(socket, payload);
    });
  }

  private setupStatusEventHandlers(socket: Socket): void {
    socket.on('updateStatus', async (payload: unknown) => {
      await this.handleUpdateStatus(socket, payload);
    });
  }

  private setupOnlineUsersEventHandlers(socket: Socket): void {
    socket.on('getOnlineUsersData', async () => {
      await this.handleGetOnlineUsersData(socket);
    });

    socket.on('getOnlineUsersList', async () => {
      await this.handleGetOnlineUsersList(socket);
    });
  }

  // ✅ ADDED: Heartbeat handler for client responses
  private setupHeartbeatHandler(socket: Socket): void {
    socket.on('heartbeat_response', (data: any) => {
      const authId = this.socketToAuthId[socket.id];
      logger.debug(`💓 Heartbeat response from ${socket.id} (${authId || 'anonymous'}):`, data);
    });

    socket.on('connection_health', (data: any) => {
      logger.debug(`🏥 Connection health report from ${socket.id}:`, data);
    });
  }

  private setupCleanupEventHandlers(socket: Socket): void {
    socket.on('disconnect', async (reason, details) => {
      await this.handleDisconnection(socket, reason, details);
    });

    socket.on('disconnecting', (reason) => {
      logger.debug(`🔄 Socket ${socket.id} is disconnecting: ${reason}`);
      this.notifyPartnerBeforeDisconnect(socket.id);
    });

    socket.on('error', (error) => {
      logger.error(`❌ Socket ${socket.id} error:`, error);
      this.recordSocketError(socket.id, error);
    });

    socket.on('connect_error', (error) => {
      logger.error(`🔌 Socket ${socket.id} connection error:`, error);
    });
  }

  // ✅ FIXED: Enhanced connection monitoring with stale detection
  private setupConnectionMonitoring(): void {
    setInterval(() => {
      const sockets = this.io.sockets.sockets;
      const now = Date.now();
      
      sockets.forEach((socket) => {
        try {
          const lastPong = (socket.conn as any).lastPong || now;
          const timeSinceLastPong = now - lastPong;
          const authId = this.socketToAuthId[socket.id];
          
          // Check for stale connections
          if (timeSinceLastPong > this.STALE_CONNECTION_THRESHOLD) {
            logger.warn(`🔍 Stale connection detected: ${socket.id} (${authId || 'anonymous'}) - ${Math.round(timeSinceLastPong / 1000)}s since last pong`);
            
            // Emit warning to client
            socket.emit('connection_warning', {
              type: 'stale_connection',
              timeSinceLastPong,
              timestamp: new Date().toISOString(),
            });
          }

          // Check for very long connections without activity
          const connectionDuration = now - (this.connectionStartTimes[socket.id] || now);
          if (connectionDuration > 3600000) { // 1 hour
            logger.debug(`⏰ Long-running connection: ${socket.id} - ${Math.round(connectionDuration / 60000)} minutes`);
          }

        } catch (error) {
          logger.error(`Error monitoring socket ${socket.id}:`, error);
        }
      });

      // ✅ ADDED: Report disconnect statistics
      if (this.disconnectStats.reasons.size > 0) {
        const topReasons = Array.from(this.disconnectStats.reasons.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);
        
        logger.debug('📊 Recent disconnect patterns:', {
          topReasons,
          avgDuration: this.getAverageConnectionDuration(),
          totalTracked: this.disconnectStats.connectionDurations.length,
        });
      }
    }, this.PING_CHECK_INTERVAL);
  }

  // ✅ ADDED: Enhanced heartbeat with health checks
  private startHeartbeat(): void {
    setInterval(() => {
      const heartbeatData = {
        timestamp: Date.now(),
        serverTime: new Date().toISOString(),
        onlineCount: this.onlineUserCount,
        serverUptime: process.uptime(),
      };

      // Send heartbeat to all connected sockets
      this.io.emit('heartbeat', heartbeatData);
      
      logger.debug(`💓 Heartbeat sent to ${this.io.sockets.sockets.size} connections`);
    }, this.HEARTBEAT_INTERVAL);
  }

  // ✅ ADDED: Get average connection duration for analysis
  private getAverageConnectionDuration(): number {
    if (this.disconnectStats.connectionDurations.length === 0) return 0;
    const sum = this.disconnectStats.connectionDurations.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.disconnectStats.connectionDurations.length / 1000); // in seconds
  }

  // ✅ ADDED: Record socket errors for pattern analysis
  private recordSocketError(socketId: string, error: any): void {
    const authId = this.socketToAuthId[socketId];
    logger.error(`Socket error details:`, {
      socketId,
      authId: authId || 'anonymous',
      error: error.message || error,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    
    this.performanceMonitor.recordError();
  }

  // ✅ ADDED: Notify partner before disconnect
  private notifyPartnerBeforeDisconnect(socketId: string): void {
    const room = this.roomManager.getRoomByUserId(socketId);
    if (room) {
      const partnerId = room.users.find(id => id !== socketId);
      if (partnerId) {
        this.io.to(partnerId).emit('partnerDisconnecting', {
          reason: 'Connection issues detected',
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  private async handleFindPartner(socket: Socket, payload: unknown): Promise<void> {
    try {
      const validatedPayload = ValidationSchemas.FindPartnerPayloadSchema.parse(payload);
      const { chatType, interests, authId } = validatedPayload;

      // Rate limiting
      const now = Date.now();
      if (now - (this.lastMatchRequest[socket.id] || 0) < this.FIND_PARTNER_COOLDOWN_MS) {
        logger.debug(`Rate limited findPartner for ${socket.id}`);
        socket.emit('findPartnerCooldown');
        return;
      }
      this.lastMatchRequest[socket.id] = now;

      logger.info(`🔍 Find partner request: ${socket.id} (${authId || 'anonymous'}) - ${chatType} chat, interests: [${interests?.join(', ') || 'none'}]`);
      
      // Set up auth mapping
      if (authId) {
        this.socketToAuthId[socket.id] = authId;
        this.authIdToSocketId[authId] = socket.id;
        await this.profileManager.updateUserStatus(authId, 'online');
        
        // Broadcast updated online users list when someone authenticates
        setTimeout(() => this.broadcastOnlineUsersList(), 500);
      }

      // Remove user from any existing waiting lists
      this.matchmakingEngine.removeFromWaitingLists(socket.id);
      
      // Create user object
      const currentUser: User = { 
        id: socket.id, 
        interests: interests || [], 
        chatType, 
        authId: authId || null,
        connectionStartTime: this.connectionStartTimes[socket.id],
      };
      
      // Fetch enhanced profile if authenticated
      if (authId) {
        const profile = await this.profileCache.getProfile(
          authId, 
          (id) => this.profileManager.fetchUserProfile(id)
        );
        
        if (profile) {
          this.enhanceUserWithProfile(currentUser, profile);
          logger.debug(`Enhanced profile loaded for ${authId}:`, {
            username: profile.username,
            displayName: profile.display_name,
            status: profile.status,
            badges: currentUser.badges?.length || 0
          });
        } else {
          this.setDefaultUserProperties(currentUser);
        }
      } else {
        this.setDefaultUserProperties(currentUser);
      }

      // Try to find a match
      const matchedPartner = this.matchmakingEngine.findMatch(currentUser);

      if (matchedPartner) {
        await this.createChatRoom(currentUser, matchedPartner);
        // Broadcast when people enter chat
        setTimeout(() => this.broadcastOnlineUsersList(), 200);
      } else {
        // Add to waiting list
        this.matchmakingEngine.addToWaitingList(currentUser);
        logger.debug(`User ${socket.id} added to ${chatType} waiting list`);
        socket.emit('waitingForPartner');
        // Broadcast queue changes
        setTimeout(() => this.broadcastOnlineUsersList(), 200);
      }
    } catch (error: any) {
      logger.warn(`Invalid findPartner payload from ${socket.id}:`, error.message);
      socket.emit('error', { message: 'Invalid payload for findPartner.' });
    }
  }

  private async handleSendMessage(socket: Socket, payload: unknown): Promise<void> {
    try {
      const { roomId, message, username, authId } = ValidationSchemas.SendMessagePayloadSchema.parse(payload);
      
      const room = this.roomManager.getRoom(roomId);
      if (!room || !room.users.includes(socket.id)) {
        logger.warn(`Message rejected: User ${socket.id} not in room ${roomId}`);
        return;
      }

      // Use cached profile data for better performance
      let senderUsername = 'Stranger';
      let senderDisplayNameColor = this.DEFAULT_PROFILE_COLOR;
      let senderDisplayNameAnimation = 'none';
      let senderRainbowSpeed = 3;
      
      if (authId) {
        if (username) {
          senderUsername = username;
        }
        
        // Use profile cache instead of fetching every time
        const profile = await this.profileCache.getProfile(
          authId, 
          (id) => this.profileManager.fetchUserProfile(id)
        );
        
        if (profile) {
          senderUsername = profile.display_name || profile.username || 'Stranger';
          senderDisplayNameColor = profile.display_name_color || this.DEFAULT_PROFILE_COLOR;
          senderDisplayNameAnimation = profile.display_name_animation || 'none';
          senderRainbowSpeed = profile.rainbow_speed || 3;
          
          logger.debug(`💬 Message styling from cache:`, {
            authId,
            username: senderUsername,
            color: senderDisplayNameColor,
            animation: senderDisplayNameAnimation,
            speed: senderRainbowSpeed
          });
        } else {
          logger.warn(`⚠️ No profile found for ${authId}, using defaults`);
        }
      }
      
      const messagePayload = { 
        senderId: socket.id, 
        message, 
        senderUsername,
        senderAuthId: authId || null,
        senderDisplayNameColor,
        senderDisplayNameAnimation,
        senderRainbowSpeed
      };
      
      // Send message to partner using message batching for performance
      const partnerId = room.users.find(id => id !== socket.id);
      if (partnerId) {
        this.messageBatcher.queueMessage(partnerId, 'receiveMessage', messagePayload, 'high');
        this.performanceMonitor.recordMessage();
        
        logger.debug(`📨 Message relayed: ${socket.id} → ${partnerId} in room ${roomId}`);
      }
    } catch (error: any) {
      logger.warn(`Invalid sendMessage payload from ${socket.id}:`, error.message);
      socket.emit('error', { message: 'Invalid payload for sendMessage.' });
    }
  }

  private handleWebRTCSignal(socket: Socket, payload: unknown): void {
    try {
      const { roomId, signalData } = ValidationSchemas.WebRTCSignalPayloadSchema.parse(payload);
      
      const room = this.roomManager.getRoom(roomId);
      if (!room || !room.users.includes(socket.id)) {
        logger.warn(`WebRTC signal rejected: User ${socket.id} not in room ${roomId}`);
        return;
      }

      const partnerId = room.users.find(id => id !== socket.id);
      if (partnerId) {
        this.io.to(partnerId).emit('webrtcSignal', signalData);
        logger.debug(`🎥 WebRTC signal: ${socket.id} → ${partnerId}`);
      }
    } catch (error: any) {
      logger.warn(`Invalid webrtcSignal payload from ${socket.id}:`, error.message);
      socket.emit('error', { message: 'Invalid payload for webrtcSignal.' });
    }
  }

  private async handleUpdateStatus(socket: Socket, payload: unknown): Promise<void> {
    try {
      const { status } = ValidationSchemas.UpdateStatusPayloadSchema.parse(payload);
      const authId = this.socketToAuthId[socket.id];
      
      if (authId) {
        const success = await this.profileManager.updateUserStatus(authId, status);
        if (success) {
          // Invalidate cache when profile changes
          this.profileCache.invalidate(authId);
          
          // Broadcast status change to partner
          this.broadcastStatusToPartner(socket.id, status);
          socket.emit('statusUpdated', { status });
          logger.debug(`📊 Status updated and cache invalidated: ${authId} → ${status}`);
        } else {
          socket.emit('error', { message: 'Failed to update status.' });
        }
      } else {
        socket.emit('error', { message: 'Authentication required to update status.' });
      }
    } catch (error: any) {
      logger.warn(`Invalid updateStatus payload from ${socket.id}:`, error.message);
      socket.emit('error', { message: 'Invalid payload for updateStatus.' });
    }
  }

  private handleLeaveChat(socket: Socket, payload: unknown): void {
    try {
      const { roomId } = ValidationSchemas.RoomIdPayloadSchema.parse(payload);
      
      const room = this.roomManager.getRoom(roomId);
      if (room && room.users.includes(socket.id)) {
        const partnerId = room.users.find(id => id !== socket.id);
        
        socket.leave(roomId);
        if (partnerId) {
          this.io.to(partnerId).emit('partnerLeft', {
            reason: 'Partner left chat',
            timestamp: new Date().toISOString(),
          });
          const partnerSocket = this.io.sockets.sockets.get(partnerId);
          if (partnerSocket) partnerSocket.leave(roomId);
        }
        
        this.roomManager.deleteRoom(roomId);
        this.typingManager.clearTyping(roomId);
        
        logger.info(`🚪 User ${socket.id} left room ${roomId}`);
        
        // Broadcast when people leave chat
        setTimeout(() => this.broadcastOnlineUsersList(), 200);
      }
    } catch (error: any) {
      logger.warn(`Invalid leaveChat payload from ${socket.id}:`, error.message);
      socket.emit('error', { message: 'Invalid payload for leaveChat.' });
    }
  }

  // ✅ FIXED: Enhanced disconnect handling with comprehensive tracking
  private async handleDisconnection(socket: Socket, reason: string, details?: any): Promise<void> {
    const connectionDuration = Date.now() - (this.connectionStartTimes[socket.id] || Date.now());
    const userAgent = socket.handshake.headers['user-agent'] as string;
    
    const disconnectInfo = {
      socketId: socket.id,
      reason,
      details,
      connectionDuration: Math.round(connectionDuration / 1000),
      timestamp: new Date().toISOString(),
      userAgent: userAgent?.substring(0, 100),
      remoteAddress: socket.handshake.address,
    };

    logger.info(`👋 Enhanced disconnect handling:`, disconnectInfo);
    
    // ✅ ADDED: Record disconnect for analysis
    this.recordDisconnect(socket.id, reason, userAgent, connectionDuration);
    
    this.onlineUserCount = Math.max(0, this.onlineUserCount - 1);
    this.io.emit('onlineUserCountUpdate', this.onlineUserCount);
    
    // Categorize disconnect reasons for better handling
    await this.categorizeAndHandleDisconnect(socket.id, reason, details);
    
    // Clean up user data
    await this.cleanupUser(socket.id, `disconnect: ${reason}`);
    this.performanceMonitor.recordDisconnection();
    
    // ✅ ADDED: Clean up connection tracking
    delete this.connectionStartTimes[socket.id];
  }

  // ✅ ADDED: Record disconnect for pattern analysis
  private recordDisconnect(socketId: string, reason: string, userAgent?: string, connectionDuration?: number): void {
    this.disconnectStats.reasons.set(reason, (this.disconnectStats.reasons.get(reason) || 0) + 1);
    
    if (userAgent) {
      const browser = this.extractBrowser(userAgent);
      this.disconnectStats.userAgents.set(browser, (this.disconnectStats.userAgents.get(browser) || 0) + 1);
    }
    
    if (connectionDuration) {
      this.disconnectStats.connectionDurations.push(connectionDuration);
      // Keep only last 1000 entries
      if (this.disconnectStats.connectionDurations.length > 1000) {
        this.disconnectStats.connectionDurations = this.disconnectStats.connectionDurations.slice(-500);
      }
    }
  }

  // ✅ ADDED: Extract browser from user agent
  private extractBrowser(userAgent: string): string {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Other';
  }

  private async categorizeAndHandleDisconnect(socketId: string, reason: string, details?: any): Promise<void> {
    const authId = this.socketToAuthId[socketId];
    
    switch (reason) {
      case 'ping timeout':
        logger.warn(`⏰ Ping timeout for ${socketId} (${authId || 'anonymous'})`);
        if (authId) {
          await this.profileManager.updateUserStatus(authId, 'idle');
        }
        break;
        
      case 'transport close':
        logger.warn(`🚫 Transport close for ${socketId} (${authId || 'anonymous'})`);
        break;
        
      case 'transport error':
        logger.error(`❌ Transport error for ${socketId} (${authId || 'anonymous'}):`, details);
        break;
        
      case 'client namespace disconnect':
        logger.debug(`👤 Client initiated disconnect for ${socketId}`);
        if (authId) {
          await this.profileManager.updateUserStatus(authId, 'offline');
        }
        break;
        
      case 'server namespace disconnect':
        logger.debug(`🖥️ Server initiated disconnect for ${socketId}`);
        break;
        
      default:
        logger.info(`❓ Unknown disconnect reason "${reason}" for ${socketId}:`, details);
    }
  }

  private async handleGetOnlineUsersData(socket: Socket): Promise<void> {
    try {
      const onlineData = await this.getOnlineUsersData();
      socket.emit('onlineUsersData', onlineData);
      logger.debug(`📋 Sent complete online data to ${socket.id}:`, onlineData);
    } catch (error) {
      logger.error('Failed to get online users data:', error);
      socket.emit('onlineUsersData', {
        connectedUsers: [],
        queueStats: { textQueue: 0, videoQueue: 0 },
        activeChats: 0,
        totalOnline: 0
      });
    }
  }

  private async handleGetOnlineUsersList(socket: Socket): Promise<void> {
    try {
      const onlineData = await this.getOnlineUsersData();
      socket.emit('onlineUsersList', onlineData.connectedUsers);
      logger.debug(`📋 Sent online users list to ${socket.id}: ${onlineData.connectedUsers.length} users`);
    } catch (error) {
      logger.error('Failed to get online users list:', error);
      socket.emit('onlineUsersList', []);
    }
  }

  private async createChatRoom(currentUser: User, matchedPartner: User): Promise<void> {
    const partnerSocket = this.io.sockets.sockets.get(matchedPartner.id);
    if (!partnerSocket || !partnerSocket.connected) {
      // Partner disconnected, re-queue both users
      this.matchmakingEngine.addToWaitingList(currentUser);
      this.matchmakingEngine.addToWaitingList(matchedPartner);
      this.io.to(currentUser.id).emit('waitingForPartner');
      return;
    }

    const roomId = `${currentUser.id}#${Date.now()}`;
    const room = this.roomManager.createRoom(roomId, [currentUser.id, matchedPartner.id], currentUser.chatType);
    
    const currentSocket = this.io.sockets.sockets.get(currentUser.id);
    if (currentSocket) currentSocket.join(roomId);
    partnerSocket.join(roomId);

    // Prepare partner info for both users
    const currentUserDisplayName = currentUser.displayName || currentUser.username || "Stranger";
    const partnerDisplayName = matchedPartner.displayName || matchedPartner.username || "Stranger";

    // Emit partner found events with complete profile data
    this.io.to(currentUser.id).emit('partnerFound', {
      partnerId: matchedPartner.id,
      roomId,
      interests: matchedPartner.interests,
      partnerUsername: partnerDisplayName,
      partnerDisplayName: matchedPartner.displayName,
      partnerAvatarUrl: matchedPartner.avatarUrl,
      partnerBannerUrl: matchedPartner.bannerUrl,
      partnerPronouns: matchedPartner.pronouns,
      partnerStatus: matchedPartner.status || 'online',
      partnerDisplayNameColor: matchedPartner.displayNameColor || this.DEFAULT_PROFILE_COLOR,
      partnerDisplayNameAnimation: matchedPartner.displayNameAnimation || 'none',
      partnerRainbowSpeed: matchedPartner.rainbowSpeed || 3,
      partnerAuthId: matchedPartner.authId,
      partnerBadges: matchedPartner.badges || [],
    });

    this.io.to(matchedPartner.id).emit('partnerFound', {
      partnerId: currentUser.id,
      roomId,
      interests: currentUser.interests,
      partnerUsername: currentUserDisplayName,
      partnerDisplayName: currentUser.displayName,
      partnerAvatarUrl: currentUser.avatarUrl,
      partnerBannerUrl: currentUser.bannerUrl,
      partnerPronouns: currentUser.pronouns,
      partnerStatus: currentUser.status || 'online',
      partnerDisplayNameColor: currentUser.displayNameColor || this.DEFAULT_PROFILE_COLOR,
      partnerDisplayNameAnimation: currentUser.displayNameAnimation || 'none',
      partnerRainbowSpeed: currentUser.rainbowSpeed || 3,
      partnerAuthId: currentUser.authId,
      partnerBadges: currentUser.badges || [],
    });

    this.performanceMonitor.recordMatch(currentUser.id, true);
    logger.info(`🎯 Match created: ${currentUser.id} ↔ ${matchedPartner.id} in room ${roomId}`);
  }

  private enhanceUserWithProfile(user: User, profile: UserProfile): void {
    user.username = profile.username;
    user.displayName = profile.display_name;
    user.avatarUrl = profile.avatar_url;
    user.bannerUrl = profile.banner_url;
    user.pronouns = profile.pronouns;
    user.status = profile.status || 'online';
    user.displayNameColor = profile.display_name_color || this.DEFAULT_PROFILE_COLOR;
    user.displayNameAnimation = profile.display_name_animation || 'none';
    user.rainbowSpeed = profile.rainbow_speed || 3;
    user.badges = profile.badges || [];
  }

  private setDefaultUserProperties(user: User): void {
    user.status = 'online';
    user.displayNameColor = this.DEFAULT_PROFILE_COLOR;
    user.displayNameAnimation = 'none';
    user.rainbowSpeed = 3;
    user.badges = [];
  }

  private broadcastStatusToPartner(socketId: string, status: string): void {
    const room = this.roomManager.getRoomByUserId(socketId);
    if (room) {
      const partnerId = room.users.find(id => id !== socketId);
      if (partnerId) {
        this.io.to(partnerId).emit('partnerStatusChanged', { status });
      }
    }
  }

  // ✅ FIXED: Enhanced user cleanup with better error handling
  private async cleanupUser(socketId: string, reason: string): Promise<void> {
    try {
      // Remove from waiting lists
      this.matchmakingEngine.removeFromWaitingLists(socketId);
      
      // Clear rate limiting
      delete this.lastMatchRequest[socketId];
      
      // Handle auth mapping cleanup with better error handling
      const authId = this.socketToAuthId[socketId];
      if (authId) {
        try {
          await this.profileManager.updateUserStatus(authId, 'offline');
          delete this.socketToAuthId[socketId];
          delete this.authIdToSocketId[authId];
          
          // Invalidate profile cache
          this.profileCache.invalidate(authId);
          
          logger.debug(`✅ Auth cleanup completed for ${authId}`);
        } catch (error) {
          logger.error(`❌ Auth cleanup failed for ${authId}:`, error);
        }
        
        // Broadcast updated online users list when someone disconnects
        setTimeout(() => this.broadcastOnlineUsersList(), 500);
      }
      
      // Clean up rooms with better partner notification
      this.roomManager.cleanupUserRooms(socketId, (partnerId) => {
        this.io.to(partnerId).emit('partnerLeft', {
          reason: 'Partner disconnected',
          timestamp: new Date().toISOString(),
          details: reason,
        });
        
        const partnerSocket = this.io.sockets.sockets.get(partnerId);
        if (partnerSocket) {
          partnerSocket.leave(socketId);
        }
      });
      
      // Clear typing indicators
      this.typingManager.clearUserTyping(socketId);
      
      logger.debug(`🧹 Enhanced cleanup completed for ${socketId}: ${reason}`);
    } catch (error) {
      logger.error(`❌ Cleanup failed for ${socketId}:`, error);
    }
  }

  private async getOnlineUsersData(): Promise<{
    connectedUsers: string[];
    queueStats: { textQueue: number; videoQueue: number };
    activeChats: number;
    totalOnline: number;
  }> {
    const connectedUsers: string[] = [];
    
    // Get authenticated usernames
    for (const [socketId, authId] of Object.entries(this.socketToAuthId)) {
      try {
        // Check if socket is still connected
        const socket = this.io.sockets.sockets.get(socketId);
        if (!socket?.connected) {
          continue;
        }

        if (authId) {
          // Fetch username from cache/database
          const profile = await this.profileCache.getProfile(
            authId, 
            (id) => this.profileManager.fetchUserProfile(id)
          );
          if (profile && profile.username) {
            connectedUsers.push(profile.username);
          }
        }
      } catch (error) {
        logger.warn(`Failed to fetch username for ${authId}:`, error);
      }
    }

    // Calculate queue stats
    const queueStats = this.matchmakingEngine.getQueueStats();
    const roomStats = this.roomManager.getStats();

    return {
      connectedUsers,
      queueStats: {
        textQueue: queueStats.text,
        videoQueue: queueStats.video
      },
      activeChats: roomStats.totalRooms * 2, // Each room has 2 users
      totalOnline: this.onlineUserCount
    };
  }

  private async broadcastOnlineUsersList(): Promise<void> {
    try {
      const onlineData = await this.getOnlineUsersData();
      
      // Broadcast comprehensive data
      this.io.emit('onlineUsersData', onlineData);
      
      // Also emit individual events for backward compatibility
      this.io.emit('onlineUsersList', onlineData.connectedUsers);
      this.io.emit('queueStatsUpdate', onlineData.queueStats);
      this.io.emit('activeChatUpdate', onlineData.activeChats);
      
      logger.debug(`📡 Broadcasted online data:`, {
        users: onlineData.connectedUsers.length,
        total: onlineData.totalOnline,
        textQueue: onlineData.queueStats.textQueue,
        videoQueue: onlineData.queueStats.videoQueue,
        activeChats: onlineData.activeChats
      });
    } catch (error) {
      logger.error('Failed to broadcast online users list:', error);
    }
  }

  private startPeriodicTasks(): void {
    // ✅ ENHANCED: More comprehensive periodic reporting
    setInterval(() => {
      const stats = this.matchmakingEngine.getQueueStats();
      const roomStats = this.roomManager.getStats();
      const cacheStats = this.profileCache.getStats();
      const disconnectSummary = this.getDisconnectSummary();
      
      logger.debug('📊 SocketManager comprehensive stats:', {
        online: this.onlineUserCount,
        queues: stats,
        rooms: roomStats,
        cache: cacheStats,
        performance: this.performanceMonitor.getStats(),
        disconnects: disconnectSummary,
        memoryUsage: {
          heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB`,
          heapTotal: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)}MB`,
        }
      });
    }, 30000); // Every 30 seconds

    // Cleanup inactive connections
    setInterval(() => {
      this.matchmakingEngine.cleanupStaleUsers((socketId) => {
        const socket = this.io.sockets.sockets.get(socketId);
        return socket?.connected || false;
      });
    }, 60000); // Every minute

    // ✅ ADDED: Periodic memory cleanup
    setInterval(() => {
      this.performMemoryCleanup();
    }, 300000); // Every 5 minutes
  }

  // ✅ ADDED: Get disconnect summary for monitoring
  private getDisconnectSummary() {
    const topReasons = Array.from(this.disconnectStats.reasons.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    return {
      topReasons: Object.fromEntries(topReasons),
      avgConnectionDuration: this.getAverageConnectionDuration(),
      totalTracked: this.disconnectStats.connectionDurations.length,
    };
  }

  // ✅ ADDED: Memory cleanup to prevent leaks
  private performMemoryCleanup(): void {
    try {
      // Clean up stale connection tracking
      const activeSocketIds = new Set(this.io.sockets.sockets.keys());
      
      Object.keys(this.connectionStartTimes).forEach(socketId => {
        if (!activeSocketIds.has(socketId)) {
          delete this.connectionStartTimes[socketId];
        }
      });

      Object.keys(this.lastMatchRequest).forEach(socketId => {
        if (!activeSocketIds.has(socketId)) {
          delete this.lastMatchRequest[socketId];
        }
      });

      // Clean up orphaned auth mappings
      Object.entries(this.socketToAuthId).forEach(([socketId, authId]) => {
        if (!activeSocketIds.has(socketId)) {
          delete this.socketToAuthId[socketId];
          delete this.authIdToSocketId[authId];
        }
      });

      // Trim disconnect stats to prevent unlimited growth
      if (this.disconnectStats.connectionDurations.length > 1000) {
        this.disconnectStats.connectionDurations = this.disconnectStats.connectionDurations.slice(-500);
      }

      logger.debug('🧹 Memory cleanup completed', {
        activeConnections: activeSocketIds.size,
        trackedConnections: Object.keys(this.connectionStartTimes).length,
        authMappings: Object.keys(this.socketToAuthId).length,
      });
    } catch (error) {
      logger.error('❌ Memory cleanup failed:', error);
    }
  }

  // ✅ ADDED: Connection recovery helpers
  public handleReconnection(socket: Socket, authId?: string): void {
    if (authId && this.authIdToSocketId[authId]) {
      const oldSocketId = this.authIdToSocketId[authId];
      logger.info(`🔄 User ${authId} reconnecting from ${oldSocketId} to ${socket.id}`);
      
      // Clean up old connection
      this.cleanupUser(oldSocketId, 'reconnection');
      
      // Set up new connection
      this.socketToAuthId[socket.id] = authId;
      this.authIdToSocketId[authId] = socket.id;
      this.connectionStartTimes[socket.id] = Date.now();
      
      // Update status
      this.profileManager.updateUserStatus(authId, 'online');
      
      // Emit reconnection success
      socket.emit('reconnectionSuccess', {
        timestamp: new Date().toISOString(),
        newSocketId: socket.id,
      });
    }
  }

  // ✅ ADDED: Force disconnect with reason (for admin use)
  public forceDisconnect(socketId: string, reason: string = 'Admin action'): boolean {
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      logger.info(`🔨 Force disconnecting ${socketId}: ${reason}`);
      socket.emit('forceDisconnect', { reason, timestamp: new Date().toISOString() });
      socket.disconnect(true);
      return true;
    }
    return false;
  }

  // ✅ ADDED: Get detailed connection info for debugging
  public getConnectionInfo(socketId: string) {
    const socket = this.io.sockets.sockets.get(socketId);
    if (!socket) return null;

    const authId = this.socketToAuthId[socketId];
    const connectionDuration = Date.now() - (this.connectionStartTimes[socketId] || Date.now());
    const lastPong = (socket.conn as any).lastPong || Date.now();

    return {
      socketId,
      authId: authId || null,
      connected: socket.connected,
      transport: socket.conn.transport.name,
      connectionDuration: Math.round(connectionDuration / 1000),
      lastPong: new Date(lastPong).toISOString(),
      timeSinceLastPong: Math.round((Date.now() - lastPong) / 1000),
      userAgent: socket.handshake.headers['user-agent'],
      remoteAddress: socket.handshake.address,
      rooms: Array.from(socket.rooms),
    };
  }

  // Public API
  public getStats() {
    return {
      onlineUsers: this.onlineUserCount,
      queues: this.matchmakingEngine.getQueueStats(),
      rooms: this.roomManager.getStats(),
      cache: this.profileCache.getStats(),
      performance: this.performanceMonitor.getStats(),
      disconnects: this.getDisconnectSummary(),
      memory: {
        trackedConnections: Object.keys(this.connectionStartTimes).length,
        authMappings: Object.keys(this.socketToAuthId).length,
        heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB`,
      }
    };
  }

  // ✅ ADDED: Health check method
  public healthCheck() {
    const now = Date.now();
    const activeConnections = this.io.sockets.sockets.size;
    const staleConnections = Array.from(this.io.sockets.sockets.values()).filter(socket => {
      const lastPong = (socket.conn as any).lastPong || now;
      return (now - lastPong) > this.STALE_CONNECTION_THRESHOLD;
    }).length;

    const health = {
      status: staleConnections / activeConnections > 0.1 ? 'degraded' : 'healthy',
      activeConnections,
      staleConnections,
      onlineUsers: this.onlineUserCount,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };

    return health;
  }
}