// server/managers/modules/MessageHandler.ts - FIXED WITH PROPER EXPORT
import { Server as SocketIOServer, Socket } from 'socket.io';
import { ProfileManager } from '../profile/ProfileManager';
import { MessageBatcher } from '../../utils/MessageBatcher';
import { RoomManager, Room } from '../../services/RoomManager';
import { ProfileCache } from '../../utils/ProfileCache';
import { PerformanceMonitor } from '../../utils/PerformanceMonitor';
import { logger } from '../../utils/logger';

export interface MessageData {
  senderId: string;
  message: string;
  senderUsername: string;
  senderAuthId: string | null;
  senderDisplayNameColor: string;
  senderDisplayNameAnimation: string;
  senderRainbowSpeed: number;
  timestamp: string;
  roomId: string;
}

// ✅ FIXED: Added export to MessageHandler class
export class MessageHandler {
  private readonly DEFAULT_PROFILE_COLOR = '#667eea';

  constructor(
    private io: SocketIOServer,
    private profileManager: ProfileManager,
    private messageBatcher: MessageBatcher,
    private roomManager: RoomManager,
    private profileCache: ProfileCache,
    private performanceMonitor: PerformanceMonitor,
    private socketToRoom: Map<string, string>
  ) {}

  async handleSendMessage(socket: Socket, payload: unknown): Promise<void> {
    try {
      logger.info(`📨 MESSAGE ATTEMPT from ${socket.id}:`, payload);
      
      const { roomId, message, username, authId } = this.extractMessageData(socket, payload);
      
      if (!this.validateMessage(socket, message)) {
        return;
      }

      const room = this.findAndValidateRoom(socket, roomId);
      if (!room) {
        return;
      }

      const partnerId = this.findAndValidatePartner(socket, room);
      if (!partnerId) {
        return;
      }

      const messageData = await this.prepareMessageData(socket.id, message, authId, room.id);
      
      await this.deliverMessage(socket.id, partnerId, messageData, room);
      
    } catch (error: any) {
      logger.error(`❌ CRITICAL MESSAGE ERROR for ${socket.id}:`, error);
      socket.emit('error', { message: 'Failed to send message .' });
    }
  }

  // ✅ CRITICAL FIX: Enhanced WebRTC signal handling with comprehensive validation
  handleWebRTCSignal(socket: Socket, payload: unknown): void {
    try {
      logger.info(`🎥 WebRTC SIGNAL from ${socket.id}:`, {
        hasPayload: !!payload,
        payloadType: typeof payload,
        hasRoomId: !!(payload as any)?.roomId,
        hasSignalData: !!(payload as any)?.signalData,
        signalType: (payload as any)?.signalData?.type || 'candidate'
      });
      
      // ✅ CRITICAL: Comprehensive payload validation
      if (!payload) {
        logger.error(`❌ WebRTC signal rejected: null payload from ${socket.id}`);
        socket.emit('error', { message: 'WebRTC signal data is required.' });
        return;
      }

      if (typeof payload !== 'object') {
        logger.error(`❌ WebRTC signal rejected: invalid payload type from ${socket.id}:`, typeof payload);
        socket.emit('error', { message: 'WebRTC signal data must be an object.' });
        return;
      }

      const data = payload as any;

      // ✅ Validate roomId
      if (!data.roomId || typeof data.roomId !== 'string') {
        logger.error(`❌ WebRTC signal rejected: missing/invalid roomId from ${socket.id}:`, data.roomId);
        socket.emit('error', { message: 'WebRTC signal requires a valid roomId.' });
        return;
      }

      // ✅ CRITICAL: Validate signalData exists and is not null/undefined
      if (!data.signalData) {
        logger.error(`❌ WebRTC signal rejected: null/undefined signalData from ${socket.id}:`, data);
        socket.emit('error', { message: 'WebRTC signal data is null or undefined.' });
        return;
      }

      if (typeof data.signalData !== 'object') {
        logger.error(`❌ WebRTC signal rejected: invalid signalData type from ${socket.id}:`, typeof data.signalData);
        socket.emit('error', { message: 'WebRTC signalData must be an object.' });
        return;
      }

      // ✅ Validate room exists and user is in it
      const room = this.roomManager.getRoom(data.roomId);
      if (!room || !room.users.includes(socket.id)) {
        logger.warn(`❌ WebRTC signal rejected: User ${socket.id} not in room ${data.roomId}`);
        socket.emit('error', { message: 'You are not in this chat room.' });
        return;
      }

      // ✅ Find partner in room
      const partnerId = room.users.find(id => id !== socket.id);
      if (!partnerId) {
        logger.warn(`❌ WebRTC signal rejected: No partner found in room ${data.roomId} for user ${socket.id}`);
        socket.emit('error', { message: 'No partner found in room.' });
        return;
      }

      // ✅ Check if partner is still connected
      const partnerSocket = this.io.sockets.sockets.get(partnerId);
      if (!partnerSocket || !partnerSocket.connected) {
        logger.warn(`❌ WebRTC signal rejected: Partner ${partnerId} not connected for signal from ${socket.id}`);
        socket.emit('partnerLeft', { reason: 'Partner disconnected' });
        return;
      }

      // ✅ ENHANCED: Log signal details for debugging
      const signalType = data.signalData.type || (data.signalData.candidate ? 'candidate' : 'unknown');
      logger.info(`🎥 WebRTC SIGNAL FORWARDING: ${socket.id} → ${partnerId} (${signalType}) in room ${data.roomId}`);

      // ✅ CRITICAL FIX: Ensure signalData is properly structured before forwarding
      const forwardPayload = {
        signalData: data.signalData,
        roomId: data.roomId,
        fromUser: socket.id
      };

      // ✅ Forward the signal to partner with validation
      try {
        partnerSocket.emit('webrtcSignal', forwardPayload);
        logger.info(`✅ WebRTC signal forwarded successfully: ${socket.id} → ${partnerId}`);
        
        // Update performance metrics
        this.performanceMonitor.recordMessage();
      } catch (emitError) {
        logger.error(`❌ Error emitting WebRTC signal to partner ${partnerId}:`, emitError);
        socket.emit('error', { message: 'Failed to forward WebRTC signal to partner.' });
      }
      
    } catch (error: any) {
      logger.error(`❌ CRITICAL WebRTC SIGNAL ERROR for ${socket.id}:`, error);
      socket.emit('error', { message: 'WebRTC signal processing failed.' });
    }
  }

  private extractMessageData(socket: Socket, payload: unknown) {
    let roomId: string;
    let message: string;
    let username: string | undefined;
    let authId: string | null;

    if (typeof payload === 'object' && payload !== null) {
      const data = payload as any;
      roomId = data.roomId || this.socketToRoom.get(socket.id) || '';
      message = data.message || '';
      username = data.username;
      authId = data.authId || null;
    } else {
      throw new Error('Invalid message payload');
    }

    return { roomId, message, username, authId };
  }

  private validateMessage(socket: Socket, message: string): boolean {
    if (!message || message.trim().length === 0) {
      logger.warn(`❌ Empty message from ${socket.id}`);
      return false;
    }

    if (message.trim().length > 2000) {
      logger.warn(`❌ Message too long from ${socket.id}`);
      socket.emit('error', { message: 'Message too long (max 2000 characters).' });
      return false;
    }

    return true;
  }

  private findAndValidateRoom(socket: Socket, roomId: string): Room | null {
    let room: Room | null = null;
    
    // Try to find room by provided roomId first
    if (roomId) {
      room = this.roomManager.getRoom(roomId);
    }
    
    // If no room found, try to find by userId
    if (!room) {
      room = this.roomManager.getRoomByUserId(socket.id);
      if (room) {
        // Update the mapping if we found the room by userId
        this.socketToRoom.set(socket.id, room.id);
      }
    }

    // Validate that user is actually in the room
    if (!room || !room.users.includes(socket.id)) {
      logger.warn(`❌ Message rejected: User ${socket.id} not in valid room. Room: ${roomId}`);
      socket.emit('error', { message: 'You are not in a chat room.' });
      return null;
    }

    return room;
  }

  private findAndValidatePartner(socket: Socket, room: Room): string | null {
    const partnerId = room.users.find((id: string) => id !== socket.id);
    if (!partnerId) {
      logger.warn(`❌ No partner found in room ${room.id} for user ${socket.id}`);
      return null;
    }

    const partnerSocket = this.io.sockets.sockets.get(partnerId);
    if (!partnerSocket || !partnerSocket.connected) {
      logger.warn(`❌ Partner ${partnerId} not connected for message from ${socket.id}`);
      socket.emit('partnerLeft', { reason: 'Partner disconnected' });
      return null;
    }

    return partnerId;
  }

  private async prepareMessageData(
    socketId: string, 
    message: string, 
    authId: string | null, 
    roomId: string
  ): Promise<MessageData> {
    let senderUsername = 'Stranger';
    let senderDisplayNameColor = this.DEFAULT_PROFILE_COLOR;
    let senderDisplayNameAnimation = 'none';
    let senderRainbowSpeed = 3;
    
    if (authId) {
      const profile = await this.profileCache.getProfile(
        authId, 
        (id) => this.profileManager.fetchUserProfile(id)
      );
      
      if (profile) {
        senderUsername = profile.display_name || profile.username || 'Stranger';
        senderDisplayNameColor = profile.display_name_color || this.DEFAULT_PROFILE_COLOR;
        senderDisplayNameAnimation = profile.display_name_animation || 'none';
        senderRainbowSpeed = profile.rainbow_speed || 3;
      }
    }
    
    return { 
      senderId: socketId, 
      message: message.trim(), 
      senderUsername,
      senderAuthId: authId || null,
      senderDisplayNameColor,
      senderDisplayNameAnimation,
      senderRainbowSpeed,
      timestamp: new Date().toISOString(),
      roomId
    };
  }

  private async deliverMessage(
    senderId: string, 
    partnerId: string, 
    messageData: MessageData, 
    room: Room
  ): Promise<void> {
    logger.info(`📤 DELIVERING MESSAGE: ${senderId} → ${partnerId} in room ${room.id}`);
    
    // Use message batcher for reliable delivery
    this.messageBatcher.queueMessage(partnerId, 'receiveMessage', messageData, 'high');
    
    // Update room activity
    room.lastActivity = Date.now();
    
    this.performanceMonitor.recordMessage();
    logger.info(`✅ MESSAGE QUEUED: ${senderId} → ${partnerId}`);
  }

  async cleanupRoom(roomId: string): Promise<void> {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return;

    // Notify all users in room that partner left
    room.users.forEach((userId: string) => {
      const socket = this.io.sockets.sockets.get(userId);
      if (socket) {
        socket.emit('partnerLeft', {
          reason: 'Partner disconnected',
          timestamp: new Date().toISOString(),
        });
        socket.leave(roomId);
      }
      
      // Clean up socket to room mapping
      this.socketToRoom.delete(userId);
    });

    // Delete the room
    this.roomManager.deleteRoom(roomId);
    
    logger.info(`🧹 Room ${roomId} cleaned up by MessageHandler`);
  }

  getStats() {
    return {
      messagesProcessed: this.performanceMonitor.getStats().totalMessages,
      batcherStats: this.messageBatcher.getStats(),
      roomMappings: this.socketToRoom.size
    };
  }
}