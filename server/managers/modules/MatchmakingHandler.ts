// server/managers/modules/MatchmakingHandler.ts - COMPLETE FIXED VERSION WITH PROPER STATE MANAGEMENT

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
  
  // ✅ CRITICAL: Track user states to prevent duplicate connections
  private userStates: Map<string, {
    currentState: 'disconnected' | 'searching' | 'matched' | 'in_chat';
    socketId: string;
    roomId?: string;
    lastActivity: number;
    searchStartTime?: number;
  }> = new Map();

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
      
      // ✅ CRITICAL: Check current state to prevent duplicate searching
      const currentState = this.getUserState(socket.id, authId);
      if (currentState?.currentState === 'searching') {
        logger.warn(`⚠️ User ${socket.id} already searching, ignoring duplicate request`);
        socket.emit('alreadySearching', { 
          message: 'You are already searching for a partner',
          searchStartTime: currentState.searchStartTime 
        });
        return;
      }

      if (currentState?.currentState === 'in_chat') {
        logger.warn(`⚠️ User ${socket.id} already in chat, must leave first`);
        socket.emit('error', { 
          message: 'You must leave your current chat before searching again' 
        });
        return;
      }

      // ✅ CRITICAL: Update user state to searching BEFORE processing
      this.setUserState(socket.id, authId, 'searching');
      
      await this.setupUserMappings(socket.id, authId, interests);
      await this.cleanupUserFromQueuesAndRooms(socket.id);
      
      const currentUser = await this.createEnhancedUser(socket.id, chatType, interests, authId);
      const matchedPartner = await this.matchmakingEngine.findMatch(currentUser);

      if (matchedPartner) {
        logger.info(`🎊 MATCH FOUND: ${currentUser.id} ↔ ${matchedPartner.id} (${chatType})`);
        await this.createChatRoom(currentUser, matchedPartner);
      } else {
        logger.debug(`⏳ NO MATCH FOUND - Adding ${socket.id} to ${chatType} waiting list`);
        this.matchmakingEngine.addToWaitingList(currentUser);
        
        // ✅ CRITICAL: Send proper waiting state with search confirmation
        socket.emit('searchStarted', {
          message: 'Searching for a partner...',
          chatType,
          interests,
          searchId: socket.id,
          timestamp: Date.now()
        });
        
        socket.emit('waitingForPartner', {
          searchId: socket.id,
          chatType,
          queuePosition: await this.getQueuePosition(currentUser),
          estimatedWaitTime: await this.getEstimatedWaitTime(chatType)
        });
      }

      setTimeout(() => this.broadcastOnlineUsersList(), 200);

    } catch (error: any) {
      logger.error(`❌ MATCHMAKING ERROR for ${socket.id}:`, error);
      
      // ✅ CRITICAL: Reset user state on error
      const authId = this.socketToAuthId.get(socket.id);
      this.setUserState(socket.id, authId, 'disconnected');
      
      socket.emit('searchError', { 
        message: 'Failed to start search. Please try again.',
        error: 'SEARCH_FAILED'
      });
    }
  }

  // ✅ NEW: Handle stop searching event properly
  async handleStopSearching(socket: Socket, payload: unknown): Promise<void> {
    try {
      logger.info(`🛑 STOP SEARCHING request from ${socket.id}:`, payload);

      const data = payload as any;
      const authId = this.socketToAuthId.get(socket.id);
      
      // ✅ CRITICAL: Update user state BEFORE removing from queues
      this.setUserState(socket.id, authId, 'disconnected');
      
      // Remove user from all waiting lists
      this.removeUserFromQueues(socket.id);
      
      // ✅ CRITICAL: Send proper confirmation with state reset
      socket.emit('searchStopped', {
        stoppedBy: socket.id,
        authId: data?.authId || authId,
        reason: data?.reason || 'manual_stop',
        timestamp: Date.now(),
        newState: 'idle'
      });

      // ✅ Emit status update to reset UI state
      socket.emit('statusUpdate', {
        status: 'idle',
        message: 'Search stopped',
        searching: false,
        inChat: false
      });

      logger.info(`✅ Stop searching handled successfully for ${socket.id}`);

    } catch (error) {
      logger.error(`❌ Error handling stop searching for ${socket.id}:`, error);
      socket.emit('error', { message: 'Failed to stop searching' });
    }
  }

  // ✅ ENHANCED: Handle skip partner with proper state management
  async handleSkipPartner(socket: Socket, payload: unknown): Promise<void> {
    try {
      logger.info(`🔄 SKIP PARTNER request from ${socket.id}:`, payload);

      const data = payload as any;
      const authId = this.socketToAuthId.get(socket.id);
      
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
      const partnerAuthId = this.socketToAuthId.get(partnerId);

      // ✅ CRITICAL: Update both users' states
      this.setUserState(socket.id, authId, 'searching'); // Skipper goes to searching
      this.setUserState(partnerId, partnerAuthId, 'disconnected'); // Skipped user goes to idle

      // Clean up the room first
      await this.cleanupRoom(roomId);

      // ✅ CRITICAL: Send proper state updates to both users
      socket.emit('partnerSkipped', {
        skippedUserId: partnerId,
        autoSearchStarted: true,
        newState: 'searching',
        timestamp: Date.now()
      });

      // The skipped user gets notified but NO auto-search
      if (partnerSocket && partnerSocket.connected) {
        partnerSocket.emit('partnerSkippedYou', {
          skippedBy: socket.id,
          skipperAuthId: data.skipperAuthId || authId,
          timestamp: Date.now(),
          message: 'Your partner skipped you',
          newState: 'idle'
        });
        
        // ✅ Send status update to reset skipped user's UI
        partnerSocket.emit('statusUpdate', {
          status: 'idle',
          message: 'Partner skipped you',
          searching: false,
          inChat: false
        });
      }

      // Auto-search ONLY for the skipper
      logger.info(`🔍 Starting auto-search for skipper ${socket.id}`);
      
      // Small delay to ensure cleanup is complete
      setTimeout(async () => {
        try {
          await this.handleFindPartner(socket, {
            chatType: data.chatType || 'text',
            interests: data.interests || [],
            authId: data.skipperAuthId || authId,
            reason: 'auto_search_after_skip'
          });
        } catch (error) {
          logger.error(`❌ Auto-search failed for skipper ${socket.id}:`, error);
          
          // ✅ Reset state on auto-search failure
          this.setUserState(socket.id, authId, 'disconnected');
          
          socket.emit('autoSearchFailed', { 
            reason: 'Failed to start auto-search after skip',
            newState: 'idle'
          });
          
          socket.emit('statusUpdate', {
            status: 'idle',
            message: 'Auto-search failed',
            searching: false,
            inChat: false
          });
        }
      }, 500);

      logger.info(`✅ Skip handled: ${socket.id} skipped ${partnerId}`);

    } catch (error) {
      logger.error(`❌ Error handling skip partner for ${socket.id}:`, error);
      const authId = this.socketToAuthId.get(socket.id);
      this.setUserState(socket.id, authId, 'disconnected');
      
      socket.emit('skipError', { 
        message: 'Failed to skip partner',
        error: error instanceof Error ? error.message : 'Unknown error',
        newState: 'idle'
      });
    }
  }

  // ✅ NEW: User state management methods
  private getUserState(socketId: string, authId?: string | null) {
    const key = authId || socketId;
    return this.userStates.get(key);
  }

  private setUserState(socketId: string, authId: string | null | undefined, state: 'disconnected' | 'searching' | 'matched' | 'in_chat', roomId?: string) {
    const key = authId || socketId;
    const currentTime = Date.now();
    
    const stateData = {
      currentState: state,
      socketId,
      roomId,
      lastActivity: currentTime,
      searchStartTime: state === 'searching' ? currentTime : undefined
    };
    
    this.userStates.set(key, stateData);
    
    logger.debug(`📊 User state updated: ${key} -> ${state}${roomId ? ` (room: ${roomId})` : ''}`);
  }

  private cleanupUserState(socketId: string, authId?: string | null) {
    const key = authId || socketId;
    this.userStates.delete(key);
    logger.debug(`🧹 User state cleaned up: ${key}`);
  }

  // ✅ ENHANCED: Queue position calculation
  private async getQueuePosition(user: User): Promise<number> {
    const queueDetails = this.matchmakingEngine.getQueueDetails();
    const queue = queueDetails[user.chatType];
    
    const userIndex = queue.findIndex(u => u.id === user.id);
    return userIndex >= 0 ? userIndex + 1 : 0;
  }

  // ✅ NEW: Estimated wait time calculation
  private async getEstimatedWaitTime(chatType: 'text' | 'video'): Promise<number> {
    const queueStats = this.matchmakingEngine.getQueueStats();
    const queueLength = chatType === 'text' ? queueStats.text : queueStats.video;
    
    // Simple estimation: 30 seconds per person ahead in queue
    return Math.max(30, queueLength * 30);
  }

  private checkRateLimit(socketId: string): boolean {
    const now = Date.now();
    const lastRequest = this.lastMatchRequest.get(socketId) || 0;
    
    if (now - lastRequest < this.FIND_PARTNER_COOLDOWN_MS) {
      logger.debug(`⏱️ Rate limited findPartner for ${socketId}`);
      const socket = this.io.sockets.sockets.get(socketId);
      socket?.emit('findPartnerCooldown', {
        remainingTime: this.FIND_PARTNER_COOLDOWN_MS - (now - lastRequest),
        message: 'Please wait before searching again'
      });
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
      
      // ✅ Reset current user state and re-queue
      const authId = this.socketToAuthId.get(currentUser.id);
      this.setUserState(currentUser.id, authId, 'searching');
      
      this.matchmakingEngine.addToWaitingList(currentUser);
      this.io.to(currentUser.id).emit('waitingForPartner', {
        message: 'Partner disconnected, searching for another...'
      });
      return;
    }

    const roomId = `room_${currentUser.id}_${matchedPartner.id}_${Date.now()}`;
    const room = this.roomManager.createRoom(roomId, [currentUser.id, matchedPartner.id], currentUser.chatType);
    
    // ✅ CRITICAL: Update both users' states to in_chat
    const currentUserAuthId = this.socketToAuthId.get(currentUser.id);
    const partnerAuthId = this.socketToAuthId.get(matchedPartner.id);
    
    this.setUserState(currentUser.id, currentUserAuthId, 'in_chat', roomId);
    this.setUserState(matchedPartner.id, partnerAuthId, 'in_chat', roomId);
    
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

    // ✅ CRITICAL: Send enhanced partner found events with proper state
    const currentUserData = this.buildPartnerFoundData(currentUser, roomId, matchedPartner.interests);
    const matchedPartnerData = this.buildPartnerFoundData(matchedPartner, roomId, currentUser.interests);

    // ✅ Enhanced events with state information
    this.io.to(currentUser.id).emit('partnerFound', {
      ...matchedPartnerData,
      newState: 'in_chat',
      message: 'Connected with a partner. You can start chatting!'
    });
    
    this.io.to(matchedPartner.id).emit('partnerFound', {
      ...currentUserData,
      newState: 'in_chat',
      message: 'Connected with a partner. You can start chatting!'
    });

    // ✅ Send status updates to both users
    this.io.to(currentUser.id).emit('statusUpdate', {
      status: 'in_chat',
      message: 'Connected with partner',
      searching: false,
      inChat: true,
      roomId: roomId
    });
    
    this.io.to(matchedPartner.id).emit('statusUpdate', {
      status: 'in_chat',
      message: 'Connected with partner',
      searching: false,
      inChat: true,
      roomId: roomId
    });

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

  // ✅ ENHANCED: Regular room cleanup with proper state management
  async cleanupRoom(roomId: string): Promise<void> {
    const room: Room | null = this.roomManager.getRoom(roomId);
    if (!room) return;

    // ✅ CRITICAL: Update user states for all users in room
    room.users.forEach((userId: string) => {
      const authId = this.socketToAuthId.get(userId);
      this.setUserState(userId, authId, 'disconnected');
      
      const socket = this.io.sockets.sockets.get(userId);
      if (socket) {
        socket.emit('partnerLeft', {
          reason: 'Partner disconnected',
          timestamp: new Date().toISOString(),
          newState: 'idle'
        });
        
        // ✅ Send status update to reset UI
        socket.emit('statusUpdate', {
          status: 'idle',
          message: 'Partner left',
          searching: false,
          inChat: false
        });
        
        socket.leave(roomId);
      }
      
      // Clean up mappings
      this.socketToRoom.delete(userId);
    });

    // Clean up room tracking
    this.roomToSockets.delete(roomId);
    this.roomManager.deleteRoom(roomId);
    
    logger.info(`🧹 Room ${roomId} completely cleaned up with state updates`);
  }

  // ✅ NEW: Remove user from queues when they stop searching
  removeUserFromQueues(socketId: string): void {
    try {
      // Remove from matchmaking queues
      const wasInQueue = this.isUserInQueue(socketId);
      this.matchmakingEngine.removeFromWaitingLists(socketId);
      
      if (wasInQueue) {
        logger.info(`🗑️ Removed ${socketId} from matchmaking queues due to stop searching`);
      }
      
      // Clean up any associated state
      const authId = this.socketToAuthId.get(socketId);
      if (authId) {
        logger.info(`📊 User ${authId} stopped searching`);
      }
      
    } catch (error) {
      logger.error(`❌ Error removing user ${socketId} from queues:`, error);
    }
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
        // ✅ Update user state before cleanup
        const authId = this.socketToAuthId.get(socket.id);
        this.setUserState(socket.id, authId, 'disconnected');
        
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
      roomToSocketMappings: this.roomToSockets.size,
      userStates: this.userStates.size // ✅ Include state tracking stats
    };
  }

  getStats() {
    return {
      queues: this.matchmakingEngine.getQueueStats(),
      matches: this.performanceMonitor.getStats().totalMatches,
      rateLimits: this.lastMatchRequest.size,
      userStates: {
        total: this.userStates.size,
        searching: Array.from(this.userStates.values()).filter(s => s.currentState === 'searching').length,
        inChat: Array.from(this.userStates.values()).filter(s => s.currentState === 'in_chat').length,
        disconnected: Array.from(this.userStates.values()).filter(s => s.currentState === 'disconnected').length
      },
      mappings: {
        socketToAuth: this.socketToAuthId.size,
        authToSocket: this.authIdToSocketId.size,
        userInterests: this.userInterests.size,
        socketToRoom: this.socketToRoom.size,
        roomToSockets: this.roomToSockets.size
      }
    };
  }

  // ✅ ENHANCED: Cleanup for disconnected users with state management
  cleanupUser(socketId: string): void {
    const authId = this.socketToAuthId.get(socketId);
    
    // ✅ CRITICAL: Clean up user state
    this.cleanupUserState(socketId, authId);
    
    // Remove from queues
    this.matchmakingEngine.removeFromWaitingLists(socketId);
    
    // Clean up mappings
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
    
    logger.debug(`🧹 Complete user cleanup for ${socketId} with state management`);
  }
}