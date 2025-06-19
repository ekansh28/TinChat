// server/managers/modules/EventRouter.ts - FIXED CONSTRUCTOR VERSION
import { Socket, Server as SocketIOServer } from 'socket.io';
import { TypingManager } from '../../services/TypingManager';
import { logger } from '../../utils/logger';

// Import all our handler modules
import { ConnectionManager } from './ConnectionManager';
import { MessageHandler } from './MessageHandler';
import { MatchmakingHandler } from './MatchmakingHandler';
import { UserStatusHandler } from './UserStatusHandler';

export class EventRouter {
  constructor(
    private connectionManager: ConnectionManager,
    private messageHandler: MessageHandler,
    private matchmakingHandler: MatchmakingHandler,
    private userStatusHandler: UserStatusHandler,
    private typingManager: TypingManager
  ) {}

  setupSocketHandlers(socket: Socket): void {
    // Connection events
    this.connectionManager.handleConnection(socket);

    // User/Authentication events
    this.setupUserEventHandlers(socket);

    // Chat/Message events
    this.setupChatEventHandlers(socket);

    // Status events
    this.setupStatusEventHandlers(socket);

    // Online users events
    this.setupOnlineUsersEventHandlers(socket);

    // Debug events
    this.setupDebugEventHandlers(socket);

    // Cleanup events
    this.setupCleanupEventHandlers(socket);

    // Heartbeat events
    this.setupHeartbeatHandler(socket);
  }

  private setupUserEventHandlers(socket: Socket): void {
    socket.on('getOnlineUserCount', () => {
      socket.emit('onlineUserCount', this.connectionManager.getOnlineUserCount());
    });

    socket.on('findPartner', async (payload: unknown) => {
      await this.matchmakingHandler.handleFindPartner(socket, payload);
    });
  }

  private setupChatEventHandlers(socket: Socket): void {
    socket.on('sendMessage', async (payload: unknown) => {
      await this.messageHandler.handleSendMessage(socket, payload);
    });

    // Enhanced WebRTC signal handling
    socket.on('webrtcSignal', (payload: unknown) => {
      logger.info(`🎥 WebRTC signal from ${socket.id}:`, {
        socketId: socket.id,
        hasPayload: !!payload,
        payloadType: typeof payload,
        roomId: (payload as any)?.roomId,
        signalDataExists: !!(payload as any)?.signalData
      });

      if (!payload) {
        logger.error(`❌ WebRTC signal data is null from ${socket.id}`);
        socket.emit('error', { message: 'WebRTC signal data is required' });
        return;
      }

      if (typeof payload !== 'object') {
        logger.error(`❌ WebRTC signal data is not an object from ${socket.id}`);
        socket.emit('error', { message: 'WebRTC signal data must be an object' });
        return;
      }

      const data = payload as any;
      
      if (!data.signalData) {
        logger.error(`❌ WebRTC signal missing signalData from ${socket.id}`);
        socket.emit('error', { message: 'WebRTC signal missing signalData' });
        return;
      }

      try {
        this.messageHandler.handleWebRTCSignal(socket, payload);
      } catch (error) {
        logger.error(`❌ WebRTC signal handler error for ${socket.id}:`, error);
        socket.emit('error', { message: 'WebRTC signal processing failed' });
      }
    });

    socket.on('typing_start', (payload: unknown) => {
      this.typingManager.handleTypingStart(socket, payload);
    });

    socket.on('typing_stop', (payload: unknown) => {
      this.typingManager.handleTypingStop(socket, payload);
    });

    socket.on('leaveChat', (payload: unknown) => {
      this.matchmakingHandler.handleLeaveChat(socket, payload);
    });

    // Handle skip partner event
    socket.on('skipPartner', async (payload: unknown) => {
      await this.handleSkipPartner(socket, payload);
    });

    // Handle disconnect only (no auto-search)
    socket.on('disconnectOnly', async (payload: unknown) => {
      await this.handleDisconnectOnly(socket, payload);
    });
  }

  // Skip partner handler with proper error handling
  private async handleSkipPartner(socket: Socket, payload: unknown): Promise<void> {
    try {
      logger.info(`🔄 SKIP PARTNER request from ${socket.id}:`, payload);

      const data = payload as any;
      if (!data || typeof data !== 'object') {
        socket.emit('skipError', { message: 'Invalid skip payload' });
        return;
      }

      const roomId = data.roomId || this.matchmakingHandler.getRoomIdForSocket(socket.id);
      if (!roomId) {
        socket.emit('skipError', { message: 'Not in a chat room' });
        return;
      }

      // Get partner before cleaning up room
      const room = this.matchmakingHandler.getRoom(roomId);
      if (!room || !room.users.includes(socket.id)) {
        socket.emit('skipError', { message: 'Invalid room or not in room' });
        return;
      }

      const partnerId = room.users.find(id => id !== socket.id);
      if (!partnerId) {
        socket.emit('skipError', { message: 'No partner found in room' });
        return;
      }

      // Get io instance from one of the handlers that has it
      const io = (this.messageHandler as any).io;
      const partnerSocket = io.sockets.sockets.get(partnerId);

      // Clean up the room with skip context (prevents "partnerLeft" message)
      await this.matchmakingHandler.cleanupRoomForSkip(roomId, socket.id);

      // Notify the skipped user (NO auto-search)
      if (partnerSocket && partnerSocket.connected) {
        partnerSocket.emit('partnerSkipped', {
          skippedBy: socket.id,
          skipperAuthId: data.authId,
          timestamp: Date.now(),
          message: 'Your partner skipped you'
        });
      }

      // Send confirmation to the skipper and start auto-search
      socket.emit('skipConfirmed', {
        skippedUserId: partnerId,
        autoSearchStarted: true,
        timestamp: Date.now()
      });

      // Auto-search for the skipper ONLY
      logger.info(`🔍 Starting auto-search for skipper ${socket.id}`);
      
      // Small delay to ensure cleanup is complete
      setTimeout(async () => {
        try {
          await this.matchmakingHandler.handleFindPartner(socket, {
            chatType: data.chatType || 'text',
            interests: data.interests || [],
            authId: data.authId,
            reason: 'auto_search_after_skip'
          });
        } catch (error) {
          logger.error(`❌ Auto-search failed for skipper ${socket.id}:`, error);
          socket.emit('autoSearchFailed', { 
            reason: 'Failed to start auto-search after skip'
          });
        }
      }, 500);

      logger.info(`✅ Skip handled: ${socket.id} skipped ${partnerId}`);

    } catch (error) {
      logger.error(`❌ Error handling skip partner for ${socket.id}:`, error);
      socket.emit('skipError', { 
        message: 'Failed to skip partner',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Disconnect only handler (no auto-search)
  private async handleDisconnectOnly(socket: Socket, payload: unknown): Promise<void> {
    try {
      logger.info(`🚪 DISCONNECT ONLY request from ${socket.id}:`, payload);

      const data = payload as any;
      
      // Clean up current room without auto-search
      await this.matchmakingHandler.handleLeaveChat(socket, { 
        roomId: data?.roomId,
        reason: 'manual_disconnect'
      });

      socket.emit('disconnectConfirmed', {
        disconnectedBy: socket.id,
        timestamp: Date.now()
      });

      logger.info(`✅ Disconnect only handled successfully for ${socket.id}`);

    } catch (error) {
      logger.error(`❌ Error handling disconnect only for ${socket.id}:`, error);
      socket.emit('error', { message: 'Failed to disconnect' });
    }
  }

  private setupStatusEventHandlers(socket: Socket): void {
    socket.on('updateStatus', async (payload: unknown) => {
      await this.userStatusHandler.handleUpdateStatus(socket, payload);
    });
  }

  private setupOnlineUsersEventHandlers(socket: Socket): void {
    socket.on('getOnlineUsersData', async () => {
      await this.userStatusHandler.handleGetOnlineUsersData(socket);
    });

    socket.on('getOnlineUsersList', async () => {
      await this.userStatusHandler.handleGetOnlineUsersList(socket);
    });
  }

  private setupDebugEventHandlers(socket: Socket): void {
    socket.on('getQueueStats', () => {
      const debugInfo = this.matchmakingHandler.debugMatchmaking();
      socket.emit('queueStats', { 
        stats: debugInfo.queueStats, 
        details: debugInfo.queueDetails 
      });
      logger.debug(`📊 Queue stats requested by ${socket.id}`);
    });

    socket.on('getDebugInfo', () => {
      const debugInfo = this.gatherDebugInfo(socket.id);
      socket.emit('debugInfo', debugInfo);
      logger.debug(`🐛 Debug info sent to ${socket.id}`);
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

  private setupHeartbeatHandler(socket: Socket): void {
    socket.on('heartbeat_response', (data: any) => {
      const connectionData = this.connectionManager.getConnectionData(socket.id);
      logger.debug(`💓 Heartbeat response from ${socket.id}:`, {
        latency: Date.now() - (data?.timestamp || Date.now()),
        userAgent: connectionData?.userAgent,
        chatType: data?.chatType || 'unknown'
      });
    });

    socket.on('connection_health', (data: any) => {
      logger.debug(`🏥 Connection health report from ${socket.id}:`, data);
    });

    // Tab identification for video chat
    socket.on('identify_tab', (data: any) => {
      if (data?.tabId) {
        const connectionData = this.connectionManager.getConnectionData(socket.id);
        if (connectionData) {
          (connectionData as any).tabId = data.tabId;
          (connectionData as any).chatType = data.chatType || 'text';
        }
        
        logger.info(`🏷️ Tab identified: ${socket.id} -> ${data.tabId} (${data.chatType || 'text'})`);
        
        socket.emit('tab_identified', { 
          socketId: socket.id, 
          tabId: data.tabId,
          chatType: data.chatType,
          isReconnect: data.isReconnect || false
        });
      }
    });

    // Enhanced connection event
    socket.on('connect', () => {
      logger.info(`🔌 Socket ${socket.id} connected successfully`);
      socket.emit('connected', { 
        socketId: socket.id,
        timestamp: Date.now(),
        serverTime: new Date().toISOString()
      });
    });
  }

  private async handleDisconnection(socket: Socket, reason: string, details?: any): Promise<void> {
    // Handle connection cleanup
    this.connectionManager.handleDisconnection(socket, reason, details);
    
    // Handle user-specific cleanup
    await this.userStatusHandler.handleUserDisconnect(socket.id);
    
    // Call the correct cleanup method
    this.matchmakingHandler.cleanupUser(socket.id);
    
    // Handle typing cleanup
    this.typingManager.clearUserTyping(socket.id);

    logger.debug(`🧹 Complete cleanup for ${socket.id}: ${reason}`);
  }

  private notifyPartnerBeforeDisconnect(socketId: string): void {
    try {
      logger.debug(`🔄 Notifying partner before ${socketId} disconnects`);
    } catch (error) {
      logger.warn(`Failed to notify partner before disconnect for ${socketId}:`, error);
    }
  }

  private recordSocketError(socketId: string, error: any): void {
    logger.error(`Socket error details:`, {
      socketId,
      error: error.message || error,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }

  private gatherDebugInfo(socketId: string) {
    const connectionData = this.connectionManager.getConnectionData(socketId);
    const matchmakingDebug = this.matchmakingHandler.debugMatchmaking();
    
    return {
      socketId: socketId,
      connectionData,
      connectionDuration: this.connectionManager.getConnectionDuration(socketId),
      matchmakingInfo: matchmakingDebug,
      timestamp: new Date().toISOString()
    };
  }

  // Public methods for external access
  getConnectionManager(): ConnectionManager {
    return this.connectionManager;
  }

  getMessageHandler(): MessageHandler {
    return this.messageHandler;
  }

  getMatchmakingHandler(): MatchmakingHandler {
    return this.matchmakingHandler;
  }

  getUserStatusHandler(): UserStatusHandler {
    return this.userStatusHandler;
  }

  getTypingManager(): TypingManager {
    return this.typingManager;
  }
}