// server/managers/modules/EventRouter.ts - FIXED VERSION WITH PROPER EVENT HANDLING
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

    // ✅ FIXED: Handle stop searching event properly
    socket.on('stopSearching', async (payload: unknown) => {
      await this.matchmakingHandler.handleStopSearching(socket, payload);
    });

    // ✅ NEW: Handle restart search event
    socket.on('restartSearch', async (payload: unknown) => {
      await this.handleRestartSearch(socket, payload);
    });

    // ✅ NEW: Handle check search status
    socket.on('checkSearchStatus', async () => {
      await this.handleCheckSearchStatus(socket);
    });
  } 

  // ✅ NEW: Restart search handler
  private async handleRestartSearch(socket: Socket, payload: unknown): Promise<void> {
    try {
      logger.info(`🔄 RESTART SEARCH request from ${socket.id}:`, payload);

      const data = payload as any;
      
      // First stop any existing search
      await this.matchmakingHandler.handleStopSearching(socket, { reason: 'restart' });
      
      // Small delay to ensure cleanup
      setTimeout(async () => {
        // Then start new search
        await this.matchmakingHandler.handleFindPartner(socket, {
          chatType: data?.chatType || 'text',
          interests: data?.interests || [],
          authId: data?.authId,
          reason: 'restart_search'
        });
      }, 100);

      logger.info(`✅ Restart search handled for ${socket.id}`);

    } catch (error) {
      logger.error(`❌ Error handling restart search for ${socket.id}:`, error);
      socket.emit('error', { message: 'Failed to restart search' });
    }
  }

  // ✅ NEW: Check search status handler
  private async handleCheckSearchStatus(socket: Socket): Promise<void> {
    try {
      const roomId = this.matchmakingHandler.getRoomIdForSocket(socket.id);
      
      if (roomId) {
        // User is in a chat room
        socket.emit('statusUpdate', {
          status: 'in_chat',
          message: 'Currently in chat',
          searching: false,
          inChat: true,
          roomId: roomId
        });
      } else {
        // Check if user is in queue (this would need to be added to MatchmakingHandler)
        // For now, assume they're idle
        socket.emit('statusUpdate', {
          status: 'idle',
          message: 'Ready to search',
          searching: false,
          inChat: false
        });
      }

    } catch (error) {
      logger.error(`❌ Error checking search status for ${socket.id}:`, error);
      socket.emit('statusUpdate', {
        status: 'error',
        message: 'Failed to check status',
        searching: false,
        inChat: false
      });
    }
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

    // ✅ ENHANCED: Handle skip partner event with proper state management
    socket.on('skipPartner', async (payload: unknown) => {
      await this.matchmakingHandler.handleSkipPartner(socket, payload);
    });

    // ✅ ENHANCED: Handle disconnect only (no auto-search)
    socket.on('disconnectOnly', async (payload: unknown) => {
      await this.handleDisconnectOnly(socket, payload);
    });

    // ✅ NEW: Handle leave and search again
    socket.on('leaveAndSearch', async (payload: unknown) => {
      await this.handleLeaveAndSearch(socket, payload);
    });
  }

  // ✅ ENHANCED: Disconnect only handler (no auto-search) with proper state management
  private async handleDisconnectOnly(socket: Socket, payload: unknown): Promise<void> {
    try {
      logger.info(`🚪 DISCONNECT ONLY request from ${socket.id}:`, payload);

      const data = payload as any;
      
      // Clean up current room without auto-search
      await this.matchmakingHandler.handleLeaveChat(socket, { 
        roomId: data?.roomId,
        reason: 'manual_disconnect'
      });

      // ✅ Send proper status update
      socket.emit('disconnectConfirmed', {
        disconnectedBy: socket.id,
        newState: 'idle',
        timestamp: Date.now()
      });

      socket.emit('statusUpdate', {
        status: 'idle',
        message: 'Disconnected from chat',
        searching: false,
        inChat: false
      });

      logger.info(`✅ Disconnect only handled successfully for ${socket.id}`);

    } catch (error) {
      logger.error(`❌ Error handling disconnect only for ${socket.id}:`, error);
      socket.emit('error', { message: 'Failed to disconnect' });
    }
  }

  // ✅ NEW: Leave current chat and immediately start searching again
  private async handleLeaveAndSearch(socket: Socket, payload: unknown): Promise<void> {
    try {
      logger.info(`🔄 LEAVE AND SEARCH request from ${socket.id}:`, payload);

      const data = payload as any;
      
      // First leave current chat
      await this.matchmakingHandler.handleLeaveChat(socket, { 
        roomId: data?.roomId,
        reason: 'leave_and_search'
      });

      // Small delay to ensure cleanup
      setTimeout(async () => {
        // Then start new search
        await this.matchmakingHandler.handleFindPartner(socket, {
          chatType: data?.chatType || 'text',
          interests: data?.interests || [],
          authId: data?.authId,
          reason: 'leave_and_search'
        });
      }, 200);

      logger.info(`✅ Leave and search handled for ${socket.id}`);

    } catch (error) {
      logger.error(`❌ Error handling leave and search for ${socket.id}:`, error);
      socket.emit('error', { message: 'Failed to leave and search' });
    }
  }

  private setupStatusEventHandlers(socket: Socket): void {
    socket.on('updateStatus', async (payload: unknown) => {
      await this.userStatusHandler.handleUpdateStatus(socket, payload);
    });

    // ✅ NEW: Handle manual status sync
    socket.on('syncStatus', async () => {
      await this.handleStatusSync(socket);
    });
  }

  // ✅ NEW: Status sync handler to fix UI state issues
  private async handleStatusSync(socket: Socket): Promise<void> {
    try {
      const roomId = this.matchmakingHandler.getRoomIdForSocket(socket.id);
      
      if (roomId) {
        // User is in chat
        const room = this.matchmakingHandler.getRoom(roomId);
        if (room) {
          socket.emit('statusUpdate', {
            status: 'in_chat',
            message: 'Currently in chat',
            searching: false,
            inChat: true,
            roomId: roomId,
            synchronized: true
          });
          
          // Also send partner info if available
          const partnerId = room.users.find(id => id !== socket.id);
          if (partnerId) {
            socket.emit('chatStateSync', {
              roomId: roomId,
              partnerId: partnerId,
              inChat: true
            });
          }
        }
      } else {
        // User is not in chat
        socket.emit('statusUpdate', {
          status: 'idle',
          message: 'Ready to search',
          searching: false,
          inChat: false,
          synchronized: true
        });
      }

    } catch (error) {
      logger.error(`❌ Error syncing status for ${socket.id}:`, error);
      socket.emit('statusUpdate', {
        status: 'error',
        message: 'Failed to sync status',
        searching: false,
        inChat: false,
        synchronized: false
      });
    }
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

    // ✅ NEW: Enhanced debug events
    socket.on('getFullState', () => {
      const fullState = this.gatherFullState(socket.id);
      socket.emit('fullState', fullState);
      logger.debug(`🔍 Full state sent to ${socket.id}`);
    });
  }

  // ✅ NEW: Gather full state for debugging
  private gatherFullState(socketId: string) {
    const connectionData = this.connectionManager.getConnectionData(socketId);
    const matchmakingDebug = this.matchmakingHandler.debugMatchmaking();
    const roomId = this.matchmakingHandler.getRoomIdForSocket(socketId);
    const room = roomId ? this.matchmakingHandler.getRoom(roomId) : null;
    
    return {
      socketId: socketId,
      connectionData,
      connectionDuration: this.connectionManager.getConnectionDuration(socketId),
      matchmakingInfo: matchmakingDebug,
      currentRoom: room ? {
        id: room.id,
        users: room.users,
        chatType: room.chatType,
        createdAt: room.createdAt,
        lastActivity: room.lastActivity
      } : null,
      inChat: !!room,
      timestamp: new Date().toISOString()
    };
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

    // ✅ NEW: Handle manual cleanup request
    socket.on('forceCleanup', async () => {
      await this.handleForceCleanup(socket);
    });
  }

  // ✅ NEW: Force cleanup handler for stuck states
  private async handleForceCleanup(socket: Socket): Promise<void> {
    try {
      logger.info(`🧹 FORCE CLEANUP request from ${socket.id}`);

      // Stop any searching
      await this.matchmakingHandler.handleStopSearching(socket, { reason: 'force_cleanup' });
      
      // Leave any chat
      await this.matchmakingHandler.handleLeaveChat(socket, { reason: 'force_cleanup' });
      
      // Clean up user completely
      this.matchmakingHandler.cleanupUser(socket.id);
      
      // Send reset status
      socket.emit('statusUpdate', {
        status: 'idle',
        message: 'Cleaned up and ready',
        searching: false,
        inChat: false,
        forceCleanup: true
      });

      socket.emit('cleanupComplete', {
        socketId: socket.id,
        timestamp: Date.now(),
        message: 'All states have been reset'
      });

      logger.info(`✅ Force cleanup completed for ${socket.id}`);

    } catch (error) {
      logger.error(`❌ Error in force cleanup for ${socket.id}:`, error);
      socket.emit('error', { message: 'Force cleanup failed' });
    }
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

    // ✅ ENHANCED: Tab identification for video chat with state sync
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
          isReconnect: data.isReconnect || false,
          timestamp: Date.now()
        });

        // ✅ Auto-sync status after tab identification
        setTimeout(() => {
          this.handleStatusSync(socket);
        }, 100);
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

    // ✅ NEW: Ping/pong for connection quality
    socket.on('ping', (data: any) => {
      socket.emit('pong', {
        ...data,
        serverTimestamp: Date.now()
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
      const roomId = this.matchmakingHandler.getRoomIdForSocket(socketId);
      if (roomId) {
        const room = this.matchmakingHandler.getRoom(roomId);
        if (room) {
          const partnerId = room.users.find(id => id !== socketId);
          if (partnerId) {
            const partnerSocket = (this.connectionManager as any).io?.sockets?.sockets?.get(partnerId);
            if (partnerSocket) {
              partnerSocket.emit('partnerDisconnecting', {
                reason: 'Partner is disconnecting',
                timestamp: Date.now()
              });
            }
          }
        }
      }
      logger.debug(`🔄 Notified partner before ${socketId} disconnects`);
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