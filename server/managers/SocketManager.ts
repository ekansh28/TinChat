// server/managers/SocketManager.ts
import { Server as SocketIOServer, Socket } from 'socket.io';
import { ProfileManager, UserProfile } from './ProfileManager';
import { MessageBatcher } from '../utils/MessageBatcher';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';
import { ValidationSchemas } from '../validation/schemas';
import { MatchmakingEngine } from '../services/MatchmakingEngine';
import { RoomManager } from '../services/RoomManager';
import { TypingManager } from '../services/TypingManager';
import { logger } from '../utils/logger';

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
  status?: 'online' | 'idle' | 'dnd' | 'offline';
  displayNameColor?: string;
  displayNameAnimation?: string;
  rainbowSpeed?: number;
  badges?: any[];
}

export class SocketManager {
  private io: SocketIOServer;
  private profileManager: ProfileManager;
  private messageBatcher: MessageBatcher;
  private performanceMonitor: PerformanceMonitor;
  private matchmakingEngine: MatchmakingEngine;
  private roomManager: RoomManager;
  private typingManager: TypingManager;

  private onlineUserCount = 0;
  private socketToAuthId: { [socketId: string]: string } = {};
  private authIdToSocketId: { [authId: string]: string } = {};
  private lastMatchRequest: { [socketId: string]: number } = {};
  
  private readonly FIND_PARTNER_COOLDOWN_MS = 2000; // 2 seconds

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
    
    this.matchmakingEngine = new MatchmakingEngine();
    this.roomManager = new RoomManager();
    this.typingManager = new TypingManager(io);
    
    this.setupSocketHandlers();
    this.startPeriodicTasks();
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });
  }

  private handleConnection(socket: Socket): void {
    this.onlineUserCount++;
    logger.info(`👤 User connected: ${socket.id}. Total online: ${this.onlineUserCount}`);
    
    this.io.emit('onlineUserCountUpdate', this.onlineUserCount);
    this.performanceMonitor.recordConnection();

    // Set up event handlers
    this.setupUserEventHandlers(socket);
    this.setupChatEventHandlers(socket);
    this.setupStatusEventHandlers(socket);
    this.setupCleanupEventHandlers(socket);
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
  }

  private setupStatusEventHandlers(socket: Socket): void {
    socket.on('updateStatus', async (payload: unknown) => {
      await this.handleUpdateStatus(socket, payload);
    });
  }

  private setupCleanupEventHandlers(socket: Socket): void {
    socket.on('leaveChat', (payload: unknown) => {
      this.handleLeaveChat(socket, payload);
    });

    socket.on('disconnect', async (reason) => {
      await this.handleDisconnection(socket, reason);
    });
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

      logger.info(`🔍 Find partner request: ${socket.id} (${authId || 'anonymous'}) - ${chatType} chat, interests: [${interests.join(', ')}]`);
      
      // Set up auth mapping
      if (authId) {
        this.socketToAuthId[socket.id] = authId;
        this.authIdToSocketId[authId] = socket.id;
        await this.profileManager.updateUserStatus(authId, 'online');
      }

      // Remove user from any existing waiting lists
      this.matchmakingEngine.removeFromWaitingLists(socket.id);
      
      // Create user object
      const currentUser: User = { 
        id: socket.id, 
        interests: interests || [], 
        chatType, 
        authId: authId || null 
      };
      
      // Fetch enhanced profile if authenticated
      if (authId) {
        const profile = await this.profileManager.fetchUserProfile(authId);
        if (profile) {
          this.enhanceUserWithProfile(currentUser, profile);
          logger.debug(`Enhanced profile loaded for ${authId}:`, {
            username: profile.username,
            displayName: profile.display_name,
            status: profile.status,
            badges: currentUser.badges?.length || 0
          });
        } else {
          // Set defaults for new/missing profiles
          this.setDefaultUserProperties(currentUser);
        }
      } else {
        this.setDefaultUserProperties(currentUser);
      }

      // Try to find a match
      const matchedPartner = this.matchmakingEngine.findMatch(currentUser);

      if (matchedPartner) {
        await this.createChatRoom(currentUser, matchedPartner);
      } else {
        // Add to waiting list
        this.matchmakingEngine.addToWaitingList(currentUser);
        logger.debug(`User ${socket.id} added to ${chatType} waiting list`);
        socket.emit('waitingForPartner');
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

      let senderUsername = 'Stranger';
      let senderDisplayNameColor = '#ffffff';
      let senderDisplayNameAnimation = 'none';
      let senderRainbowSpeed = 3;
      
      if (authId) {
        if (username) {
          senderUsername = username;
        } else {
          const profile = await this.profileManager.fetchUserProfile(authId);
          if (profile) {
            senderUsername = profile.display_name || profile.username || 'Stranger';
            senderDisplayNameColor = profile.display_name_color || '#ffffff';
            senderDisplayNameAnimation = profile.display_name_animation || 'none';
            senderRainbowSpeed = profile.rainbow_speed || 3;
          }
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
      
      // Use message batching for performance
      const partnerId = room.users.find(id => id !== socket.id);
      if (partnerId) {
        this.messageBatcher.queueMessage(partnerId, 'receiveMessage', messagePayload);
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
          // Broadcast status change to partner
          this.broadcastStatusToPartner(socket.id, status);
          socket.emit('statusUpdated', { status });
          logger.debug(`📊 Status updated: ${authId} → ${status}`);
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
          this.io.to(partnerId).emit('partnerLeft');
          const partnerSocket = this.io.sockets.sockets.get(partnerId);
          if (partnerSocket) partnerSocket.leave(roomId);
        }
        
        this.roomManager.deleteRoom(roomId);
        this.typingManager.clearTyping(roomId);
        
        logger.info(`🚪 User ${socket.id} left room ${roomId}`);
      }
    } catch (error: any) {
      logger.warn(`Invalid leaveChat payload from ${socket.id}:`, error.message);
      socket.emit('error', { message: 'Invalid payload for leaveChat.' });
    }
  }

  private async handleDisconnection(socket: Socket, reason: string): Promise<void> {
    logger.info(`👋 User disconnected: ${socket.id}, reason: ${reason}`);
    
    this.onlineUserCount = Math.max(0, this.onlineUserCount - 1);
    this.io.emit('onlineUserCountUpdate', this.onlineUserCount);
    
    // Clean up user data
    await this.cleanupUser(socket.id, `disconnect: ${reason}`);
    this.performanceMonitor.recordDisconnection();
  }

  private async cleanupUser(socketId: string, reason: string): Promise<void> {
    // Remove from waiting lists
    this.matchmakingEngine.removeFromWaitingLists(socketId);
    
    // Clear rate limiting
    delete this.lastMatchRequest[socketId];
    
    // Handle auth mapping cleanup
    const authId = this.socketToAuthId[socketId];
    if (authId) {
      await this.profileManager.updateUserStatus(authId, 'offline');
      delete this.socketToAuthId[socketId];
      delete this.authIdToSocketId[authId];
    }
    
    // Clean up rooms
    this.roomManager.cleanupUserRooms(socketId, (partnerId) => {
      this.io.to(partnerId).emit('partnerLeft');
      const partnerSocket = this.io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.leave(socketId); // Leave any room with this socket
      }
    });
    
    // Clear typing indicators
    this.typingManager.clearUserTyping(socketId);
    
    logger.debug(`🧹 Cleanup completed for ${socketId}`);
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
      partnerDisplayNameColor: matchedPartner.displayNameColor || '#ffffff',
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
      partnerDisplayNameColor: currentUser.displayNameColor || '#ffffff',
      partnerDisplayNameAnimation: currentUser.displayNameAnimation || 'none',
      partnerRainbowSpeed: currentUser.rainbowSpeed || 3,
      partnerAuthId: currentUser.authId,
      partnerBadges: currentUser.badges || [],
    });

    this.performanceMonitor.recordMatch();
    logger.info(`🎯 Match created: ${currentUser.id} ↔ ${matchedPartner.id} in room ${roomId}`);
  }

  private enhanceUserWithProfile(user: User, profile: any): void {
    user.username = profile.username;
    user.displayName = profile.display_name;
    user.avatarUrl = profile.avatar_url;
    user.bannerUrl = profile.banner_url;
    user.pronouns = profile.pronouns;
    user.status = profile.status || 'online';
    user.displayNameColor = profile.display_name_color || '#ffffff';
    user.displayNameAnimation = profile.display_name_animation || 'none';
    user.rainbowSpeed = profile.rainbow_speed || 3;
    user.badges = profile.badges || [];
  }

  private setDefaultUserProperties(user: User): void {
    user.status = 'online';
    user.displayNameColor = '#ffffff';
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

  private startPeriodicTasks(): void {
    // Queue state logging
    setInterval(() => {
      const stats = this.matchmakingEngine.getQueueStats();
      const roomStats = this.roomManager.getStats();
      const cacheStats = this.profileManager.getCacheStats();
      
      logger.debug('📊 Periodic stats:', {
        online: this.onlineUserCount,
        queues: stats,
        rooms: roomStats,
        cache: cacheStats,
        performance: this.performanceMonitor.getStats()
      });
    }, 30000); // Every 30 seconds

    // Cleanup inactive connections
    setInterval(() => {
      this.matchmakingEngine.cleanupStaleUsers((socketId) => {
        const socket = this.io.sockets.sockets.get(socketId);
        return socket?.connected || false;
      });
    }, 60000); // Every minute
  }

  public getStats() {
    return {
      onlineUsers: this.onlineUserCount,
      queues: this.matchmakingEngine.getQueueStats(),
      rooms: this.roomManager.getStats(),
      cache: this.profileManager.getCacheStats(),
      performance: this.performanceMonitor.getStats()
    };
  }
}