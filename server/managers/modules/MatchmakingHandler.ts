// server/managers/modules/MatchmakingHandler.ts - COMPLETE FIXED VERSION

import { Server as SocketIOServer, Socket } from 'socket.io';
import { MatchmakingEngine } from '../../services/MatchmakingEngine';
import { RoomManager, Room } from '../../services/RoomManager';
import { ProfileManager } from '../profile/ProfileManager';
import { ProfileCache } from '../../utils/ProfileCache';
import { PerformanceMonitor } from '../../utils/PerformanceMonitor';
import { ValidationSchemas } from '../../validation/schemas';
import { User } from '../../types/User';
import { logger } from '../../utils/logger';

export class MatchmakingHandler {
  private readonly FIND_PARTNER_COOLDOWN_MS = 2000;
  private readonly DEFAULT_PROFILE_COLOR = '#667eea';
  private lastMatchRequest: Map<string, number> = new Map();

  constructor(
    private io: SocketIOServer,
    private matchmakingEngine: MatchmakingEngine,
    private roomManager: RoomManager,
    private profileManager: ProfileManager,
    private profileCache: ProfileCache,
    private performanceMonitor: PerformanceMonitor,
    private socketToAuthId: Map<string, string>,
    private authIdToSocketId: Map<string, string>,
    private userInterests: Map<string, string[]>,
    private socketToRoom: Map<string, string>,
    private roomToSockets: Map<string, Set<string>>,
    private connectionStartTimes: Map<string, number>
  ) {}

  async handleFindPartner(socket: Socket, payload: unknown): Promise<void> {
    try {
      const validatedPayload = ValidationSchemas.FindPartnerPayloadSchema.parse(payload);
      const { chatType, interests, authId } = validatedPayload;

      if (!this.checkRateLimit(socket.id)) {
        return;
      }

      logger.info(`🔍 MATCHMAKING REQUEST: ${socket.id} (${authId || 'anonymous'}) - ${chatType} chat`);
      
      await this.setupUserMappings(socket.id, authId, interests);
      await this.cleanupUserFromQueuesAndRooms(socket.id);
      
      const currentUser = await this.createEnhancedUser(socket.id, chatType, interests, authId);
      const matchedPartner = this.matchmakingEngine.findMatch(currentUser);

      if (matchedPartner) {
        logger.info(`🎊 MATCH FOUND: ${currentUser.id} ↔ ${matchedPartner.id} (${chatType})`);
        await this.createChatRoom(currentUser, matchedPartner);
      } else {
        logger.debug(`⏳ NO MATCH FOUND - Adding ${socket.id} to ${chatType} waiting list`);
        this.matchmakingEngine.addToWaitingList(currentUser);
        socket.emit('waitingForPartner');
      }

      setTimeout(() => this.broadcastOnlineUsersList(), 200);

    } catch (error: any) {
      logger.error(`❌ MATCHMAKING ERROR for ${socket.id}:`, error);
      socket.emit('error', { message: 'Invalid payload for findPartner.' });
    }
  }

  // Handle skip partner with proper differentiation
  async handleSkipPartner(socket: Socket, payload: unknown): Promise<void> {
    try {
      logger.info(`🔄 SKIP PARTNER request from ${socket.id}:`, payload);

      const data = payload as any;
      if (!data || typeof data !== 'object') {
        socket.emit('skipError', { message: 'Invalid skip payload' });
        return;
      }

      const roomId = data.roomId || this.socketToRoom.get(socket.id);
      if (!roomId) {
        socket.emit('skipError', { message: 'Not in a chat room' });
        return;
      }

      const room = this.roomManager.getRoom(roomId);
      if (!room || !room.users.includes(socket.id)) {
        socket.emit('skipError', { message: 'Invalid room or not in room' });
        return;
      }

      // Find the partner
      const partnerId = room.users.find(id => id !== socket.id);
      if (!partnerId) {
        socket.emit('skipError', { message: 'No partner found in room' });
        return;
      }

      const partnerSocket = this.io.sockets.sockets.get(partnerId);

      // Clean up the room first
      await this.cleanupRoom(roomId);

      // Notify both users about the skip
      // The skipper gets confirmation and auto-search
      socket.emit('skipConfirmed', {
        skippedUserId: partnerId,
        autoSearchStarted: true,
        timestamp: Date.now()
      });

      // The skipped user gets notified but NO auto-search
      if (partnerSocket && partnerSocket.connected) {
        partnerSocket.emit('partnerSkipped', {
          skippedBy: socket.id,
          skipperAuthId: data.skipperAuthId,
          timestamp: Date.now(),
          message: 'Your partner skipped you'
        });
      }

      // Auto-search ONLY for the skipper
      if (data.autoSearchForSkipper) {
        logger.info(`🔍 Starting auto-search for skipper ${socket.id}`);
        
        // Small delay to ensure cleanup is complete
        setTimeout(async () => {
          try {
            await this.handleFindPartner(socket, {
              chatType: data.chatType || 'text',
              interests: data.interests || [],
              authId: data.skipperAuthId,
              reason: 'auto_search_after_skip'
            });
          } catch (error) {
            logger.error(`❌ Auto-search failed for skipper ${socket.id}:`, error);
            socket.emit('autoSearchFailed', { 
              reason: 'Failed to start auto-search after skip'
            });
          }
        }, 500);
      }

      logger.info(`✅ Skip handled: ${socket.id} skipped ${partnerId}`);

    } catch (error) {
      logger.error(`❌ Error handling skip partner for ${socket.id}:`, error);
      socket.emit('skipError', { 
        message: 'Failed to skip partner',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private checkRateLimit(socketId: string): boolean {
    const now = Date.now();
    const lastRequest = this.lastMatchRequest.get(socketId) || 0;
    
    if (now - lastRequest < this.FIND_PARTNER_COOLDOWN_MS) {
      logger.debug(`⏱️ Rate limited findPartner for ${socketId}`);
      const socket = this.io.sockets.sockets.get(socketId);
      socket?.emit('findPartnerCooldown');
      return false;
    }
    
    this.lastMatchRequest.set(socketId, now);
    return true;
  }

  private async setupUserMappings(socketId: string, authId: string | null, interests: string[]): Promise<void> {
    this.userInterests.set(socketId, interests || []);
    
    if (authId) {
      this.socketToAuthId.set(socketId, authId);
      this.authIdToSocketId.set(authId, socketId);
      await this.profileManager.updateUserStatus(authId, 'online');
    }
  }

  private async createEnhancedUser(
    socketId: string, 
    chatType: 'text' | 'video', 
    interests: string[], 
    authId: string | null
  ): Promise<User> {
    const currentUser: User = { 
      id: socketId, 
      interests: interests || [], 
      chatType, 
      authId: authId || null,
      connectionStartTime: this.connectionStartTimes.get(socketId) || Date.now(),
    };
    
    if (authId) {
      await this.enhanceUserWithProfile(currentUser, authId);
    } else {
      this.setDefaultUserProperties(currentUser);
    }

    return currentUser;
  }

  private async enhanceUserWithProfile(user: User, authId: string): Promise<void> {
    const profile = await this.profileCache.getProfile(
      authId, 
      (id) => this.profileManager.fetchUserProfile(id)
    );
    
    if (profile) {
      user.username = profile.username;
      user.displayName = profile.display_name ?? '';
      user.avatarUrl = profile.avatar_url ?? '';
      user.bannerUrl = profile.banner_url ?? '';
      user.pronouns = profile.pronouns ?? '';
      user.status = profile.status || 'online';
      user.displayNameColor = profile.display_name_color || this.DEFAULT_PROFILE_COLOR;
      user.displayNameAnimation = profile.display_name_animation || 'none';
      user.rainbowSpeed = profile.rainbow_speed || 3;
      user.badges = profile.badges || [];
    } else {
      this.setDefaultUserProperties(user);
    }
  }

  private setDefaultUserProperties(user: User): void {
    user.status = 'online';
    user.displayNameColor = this.DEFAULT_PROFILE_COLOR;
    user.displayNameAnimation = 'none';
    user.rainbowSpeed = 3;
    user.badges = [];
  }

  private async createChatRoom(currentUser: User, matchedPartner: User): Promise<void> {
    const partnerSocket = this.io.sockets.sockets.get(matchedPartner.id);
    if (!partnerSocket || !partnerSocket.connected) {
      logger.warn(`⚠️ Partner ${matchedPartner.id} disconnected during room creation`);
      this.matchmakingEngine.addToWaitingList(currentUser);
      this.io.to(currentUser.id).emit('waitingForPartner');
      return;
    }

    const roomId = `room_${currentUser.id}_${matchedPartner.id}_${Date.now()}`;
    const room = this.roomManager.createRoom(roomId, [currentUser.id, matchedPartner.id], currentUser.chatType);
    
    // Update all tracking mappings
    this.socketToRoom.set(currentUser.id, roomId);
    this.socketToRoom.set(matchedPartner.id, roomId);
    this.roomToSockets.set(roomId, new Set([currentUser.id, matchedPartner.id]));
    
    // Join socket.io rooms
    const currentSocket = this.io.sockets.sockets.get(currentUser.id);
    if (currentSocket) currentSocket.join(roomId);
    partnerSocket.join(roomId);

    logger.info(`🎯 ROOM CREATED: ${roomId}`, {
      user1: { id: currentUser.id, authId: currentUser.authId },
      user2: { id: matchedPartner.id, authId: matchedPartner.authId },
      chatType: currentUser.chatType
    });

    // Send enhanced partner found events
    const currentUserData = this.buildPartnerFoundData(currentUser, roomId, matchedPartner.interests);
    const matchedPartnerData = this.buildPartnerFoundData(matchedPartner, roomId, currentUser.interests);

    this.io.to(currentUser.id).emit('partnerFound', matchedPartnerData);
    this.io.to(matchedPartner.id).emit('partnerFound', currentUserData);

    this.performanceMonitor.recordMatch(currentUser.id, true);
  }

  private buildPartnerFoundData(user: User, roomId: string, partnerInterests: string[]) {
    return {
      partnerId: user.id,
      roomId,
      interests: partnerInterests,
      partnerUsername: user.displayName || user.username || 'Stranger',
      partnerDisplayName: user.displayName,
      partnerAvatarUrl: user.avatarUrl,
      partnerBannerUrl: user.bannerUrl,
      partnerPronouns: user.pronouns,
      partnerStatus: user.status || 'online',
      partnerDisplayNameColor: user.displayNameColor || this.DEFAULT_PROFILE_COLOR,
      partnerDisplayNameAnimation: user.displayNameAnimation || 'none',
      partnerRainbowSpeed: user.rainbowSpeed || 3,
      partnerAuthId: user.authId,
      partnerBadges: user.badges || [],
    };
  }

  private async cleanupUserFromQueuesAndRooms(socketId: string): Promise<void> {
    // Remove from matchmaking queues
    const wasInQueue = this.isUserInQueue(socketId);
    this.matchmakingEngine.removeFromWaitingLists(socketId);
    if (wasInQueue) {
      logger.debug(`🗑️ Removed ${socketId} from matchmaking queues`);
    }

    // Clean up existing room
    const existingRoomId = this.socketToRoom.get(socketId);
    if (existingRoomId) {
      await this.cleanupRoom(existingRoomId);
    }
  }

  // Regular room cleanup with "partnerLeft" message
  async cleanupRoom(roomId: string): Promise<void> {
    const room: Room | null = this.roomManager.getRoom(roomId);
    if (!room) return;

    // Notify all users in room
    room.users.forEach((userId: string) => {
      if (userId !== roomId) { // Avoid self-notification
        const socket = this.io.sockets.sockets.get(userId);
        if (socket) {
          socket.emit('partnerLeft', {
            reason: 'Partner disconnected',
            timestamp: new Date().toISOString(),
          });
          socket.leave(roomId);
        }
      }
      
      // Clean up mappings
      this.socketToRoom.delete(userId);
    });

    // Clean up room tracking
    this.roomToSockets.delete(roomId);
    this.roomManager.deleteRoom(roomId);
    
    logger.info(`🧹 Room ${roomId} completely cleaned up`);
  }

  // Get room ID for a socket
  getRoomIdForSocket(socketId: string): string | null {
    return this.socketToRoom.get(socketId) || null;
  }

  // Get room for debugging
  getRoom(roomId: string): Room | null {
    return this.roomManager.getRoom(roomId);
  }

  // Clean up room for skip (prevents "partnerLeft" message)
  async cleanupRoomForSkip(roomId: string, skipperSocketId: string): Promise<void> {
    const room: Room | null = this.roomManager.getRoom(roomId);
    if (!room) return;

    // Don't send "partnerLeft" - this is a skip scenario
    room.users.forEach((userId: string) => {
      const socket = this.io.sockets.sockets.get(userId);
      if (socket) {
        socket.leave(roomId);
      }
      
      // Clean up mappings
      this.socketToRoom.delete(userId);
    });

    // Clean up room tracking
    this.roomToSockets.delete(roomId);
    this.roomManager.deleteRoom(roomId);
    
    logger.info(`🧹 Room ${roomId} cleaned up for skip by ${skipperSocketId}`);
  }

  private isUserInQueue(socketId: string): boolean {
    const queueDetails = this.matchmakingEngine.getQueueDetails();
    return queueDetails.text.some(u => u.id === socketId) || 
           queueDetails.video.some(u => u.id === socketId);
  }

  private async broadcastOnlineUsersList(): Promise<void> {
    try {
      const onlineData = await this.getOnlineUsersData();
      
      this.io.emit('onlineUsersData', onlineData);
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

  private async getOnlineUsersData(): Promise<{
    connectedUsers: string[];
    queueStats: { textQueue: number; videoQueue: number };
    activeChats: number;
    totalOnline: number;
  }> {
    const connectedUsers: string[] = [];
    
    for (const [socketId, authId] of this.socketToAuthId.entries()) {
      try {
        const socket = this.io.sockets.sockets.get(socketId);
        if (!socket?.connected) {
          continue;
        }

        if (authId) {
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

    const queueStats = this.matchmakingEngine.getQueueStats();
    const roomStats = this.roomManager.getStats();

    return {
      connectedUsers,
      queueStats: {
        textQueue: queueStats.text,
        videoQueue: queueStats.video
      },
      activeChats: roomStats.totalRooms * 2,
      totalOnline: this.io.sockets.sockets.size
    };
  }

  handleLeaveChat(socket: Socket, payload: unknown): void {
    try {
      let roomId: string;
      
      if (typeof payload === 'object' && payload !== null && 'roomId' in payload) {
        roomId = (payload as any).roomId;
      } else {
        roomId = this.socketToRoom.get(socket.id) || '';
      }
      
      const room = this.roomManager.getRoom(roomId) || this.roomManager.getRoomByUserId(socket.id);
      if (room && room.users.includes(socket.id)) {
        this.cleanupRoom(room.id);
        logger.info(`🚪 User ${socket.id} left room ${room.id}`);
        setTimeout(() => this.broadcastOnlineUsersList(), 200);
      }
    } catch (error: any) {
      logger.warn(`❌ Invalid leaveChat payload from ${socket.id}:`, error.message);
      socket.emit('error', { message: 'Invalid payload for leaveChat.' });
    }
  }

  // Force match for debugging
  forceMatch(chatType: 'text' | 'video'): { user1: User; user2: User } | null {
    return this.matchmakingEngine.forceMatch(chatType);
  }

  // Debug and monitoring methods
  debugMatchmaking() {
    const queueDetails = this.matchmakingEngine.getQueueDetails();
    const queueStats = this.matchmakingEngine.getQueueStats();
    
    return {
      queueStats,
      queueDetails,
      socketToAuthMapping: this.socketToAuthId.size,
      authToSocketMapping: this.authIdToSocketId.size,
      userInterests: this.userInterests.size,
      roomMappings: this.socketToRoom.size,
      roomToSocketMappings: this.roomToSockets.size
    };
  }

  getStats() {
    return {
      queues: this.matchmakingEngine.getQueueStats(),
      matches: this.performanceMonitor.getStats().totalMatches,
      rateLimits: this.lastMatchRequest.size,
      mappings: {
        socketToAuth: this.socketToAuthId.size,
        authToSocket: this.authIdToSocketId.size,
        userInterests: this.userInterests.size,
        socketToRoom: this.socketToRoom.size,
        roomToSockets: this.roomToSockets.size
      }
    };
  }
    // ✅ NEW: Remove user from queues when they stop searching
  removeUserFromQueues(socketId: string): void {
    try {
      // Remove from matchmaking queues
      const wasInQueue = this.isUserInQueue(socketId);
      this.matchmakingEngine.removeFromWaitingLists(socketId);
      
      if (wasInQueue) {
        console.log(`🗑️ Removed ${socketId} from matchmaking queues due to stop searching`);
      } else {
        console.log(`ℹ️ User ${socketId} was not in any queues when stop searching was called`);
      }
      
      // Clean up any associated state
      const authId = this.socketToAuthId.get(socketId);
      if (authId) {
        // Could update user status if needed
        console.log(`📊 User ${authId} stopped searching`);
      }
      
    } catch (error) {
      console.error(`❌ Error removing user ${socketId} from queues:`, error);
    }
  }
  // Cleanup for disconnected users
  cleanupUser(socketId: string): void {
    // Remove from queues
    this.matchmakingEngine.removeFromWaitingLists(socketId);
    
    // Clean up mappings
    const authId = this.socketToAuthId.get(socketId);
    if (authId) {
      this.socketToAuthId.delete(socketId);
      this.authIdToSocketId.delete(authId);
    }
    
    this.userInterests.delete(socketId);
    this.lastMatchRequest.delete(socketId);
    
    const roomId = this.socketToRoom.get(socketId);
    if (roomId) {
      this.cleanupRoom(roomId);
    }
  }
}