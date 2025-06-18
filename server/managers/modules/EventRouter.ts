// server/managers/modules/EventRouter.ts - FIXED WebRTC SIGNAL HANDLING
import { Socket } from 'socket.io';
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

    // ✅ CRITICAL FIX: Enhanced WebRTC signal handling with comprehensive logging
    socket.on('webrtcSignal', (payload: unknown) => {
      logger.info(`🎥 Main component handleWebRTCSignal called with data:`, {
        socketId: socket.id,
        hasPayload: !!payload,
        payloadType: typeof payload,
        payloadKeys: payload && typeof payload === 'object' ? Object.keys(payload) : [],
        roomId: (payload as any)?.roomId,
        signalDataExists: !!(payload as any)?.signalData,
        signalDataType: typeof (payload as any)?.signalData,
        signalType: (payload as any)?.signalData?.type || 'candidate'
      });

      // ✅ CRITICAL: Early validation and error logging
      if (!payload) {
        logger.error(`❌ WebRTC signal data is null or undefined from ${socket.id}`);
        socket.emit('error', { message: 'WebRTC signal data is required' });
        return;
      }

      if (typeof payload !== 'object') {
        logger.error(`❌ WebRTC signal data is not an object from ${socket.id}:`, typeof payload);
        socket.emit('error', { message: 'WebRTC signal data must be an object' });
        return;
      }

      const data = payload as any;
      
      if (!data.signalData) {
        logger.error(`❌ WebRTC signal missing signalData from ${socket.id}:`, data);
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
      logger.debug(`📊 Queue stats requested by ${socket.id}:`, debugInfo.queueStats);
    });

    socket.on('getDebugInfo', () => {
      const debugInfo = this.gatherDebugInfo(socket.id);
      socket.emit('debugInfo', debugInfo);
      logger.debug(`🐛 Debug info sent to ${socket.id}:`, debugInfo);
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

    // ✅ NEW: Tab identification for video chat
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
  }

  private async handleDisconnection(socket: Socket, reason: string, details?: any): Promise<void> {
    // Handle connection cleanup
    this.connectionManager.handleDisconnection(socket, reason, details);
    
    // Handle user-specific cleanup
    await this.userStatusHandler.handleUserDisconnect(socket.id);
    
    // Handle matchmaking cleanup
    this.matchmakingHandler.cleanupUser(socket.id);
    
    // Handle typing cleanup
    this.typingManager.clearUserTyping(socket.id);

    logger.debug(`🧹 Complete cleanup for ${socket.id}: ${reason}`);
  }

  private notifyPartnerBeforeDisconnect(socketId: string): void {
    try {
      logger.debug(`🔄 Notifying partner before ${socketId} disconnects`);
      
      // The actual partner notification will be handled during cleanup
      // This is just a placeholder for the disconnect warning
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