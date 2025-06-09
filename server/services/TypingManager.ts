// server/services/TypingManager.ts
import { Server as SocketIOServer, Socket } from 'socket.io';
import { ValidationSchemas } from '../validation/schemas';
import { logger } from '../utils/logger';

interface TypingState {
  userId: string;
  roomId: string;
  startTime: number;
  timeout: NodeJS.Timeout;
}

export class TypingManager {
  private io: SocketIOServer;
  private activeTyping: Map<string, TypingState> = new Map(); // userId -> TypingState
  private roomTyping: Map<string, Set<string>> = new Map(); // roomId -> Set of userIds
  private readonly TYPING_TIMEOUT = 3000; // 3 seconds

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  handleTypingStart(socket: Socket, payload: unknown): void {
    try {
      const { roomId } = ValidationSchemas.RoomIdPayloadSchema.parse(payload);
      
      // Validate that user is in the room (this would need room validation)
      if (!this.isUserInRoom(socket.id, roomId)) {
        logger.warn(`Typing start rejected: User ${socket.id} not in room ${roomId}`);
        return;
      }

      this.startTyping(socket.id, roomId);
    } catch (error: any) {
      logger.warn(`Invalid typing_start payload from ${socket.id}:`, error.message);
    }
  }

  handleTypingStop(socket: Socket, payload: unknown): void {
    try {
      const { roomId } = ValidationSchemas.RoomIdPayloadSchema.parse(payload);
      
      if (!this.isUserInRoom(socket.id, roomId)) {
        logger.warn(`Typing stop rejected: User ${socket.id} not in room ${roomId}`);
        return;
      }

      this.stopTyping(socket.id);
    } catch (error: any) {
      logger.warn(`Invalid typing_stop payload from ${socket.id}:`, error.message);
    }
  }

  private startTyping(userId: string, roomId: string): void {
    // Clear any existing typing state for this user
    this.stopTyping(userId);

    // Set up auto-timeout
    const timeout = setTimeout(() => {
      this.stopTyping(userId);
    }, this.TYPING_TIMEOUT);

    // Create new typing state
    const typingState: TypingState = {
      userId,
      roomId,
      startTime: Date.now(),
      timeout
    };

    this.activeTyping.set(userId, typingState);

    // Add to room typing set
    if (!this.roomTyping.has(roomId)) {
      this.roomTyping.set(roomId, new Set());
    }
    this.roomTyping.get(roomId)!.add(userId);

    // Notify other users in the room
    this.broadcastTypingToRoom(roomId, userId, true);

    logger.debug(`⌨️  ${userId} started typing in room ${roomId}`);
  }

  private stopTyping(userId: string): void {
    const typingState = this.activeTyping.get(userId);
    if (!typingState) return;

    // Clear timeout
    clearTimeout(typingState.timeout);

    // Remove from active typing
    this.activeTyping.delete(userId);

    // Remove from room typing set
    const roomTypingSet = this.roomTyping.get(typingState.roomId);
    if (roomTypingSet) {
      roomTypingSet.delete(userId);
      if (roomTypingSet.size === 0) {
        this.roomTyping.delete(typingState.roomId);
      }
    }

    // Notify other users in the room
    this.broadcastTypingToRoom(typingState.roomId, userId, false);

    const duration = Date.now() - typingState.startTime;
    logger.debug(`⌨️  ${userId} stopped typing in room ${typingState.roomId} (duration: ${duration}ms)`);
  }

  private broadcastTypingToRoom(roomId: string, typingUserId: string, isTyping: boolean): void {
    // Get all sockets in the room
    const room = this.io.sockets.adapter.rooms.get(roomId);
    if (!room) return;

    // Broadcast to all users in room except the typing user
    room.forEach(socketId => {
      if (socketId !== typingUserId) {
        const eventName = isTyping ? 'partner_typing_start' : 'partner_typing_stop';
        this.io.to(socketId).emit(eventName, {
          userId: typingUserId,
          roomId
        });
      }
    });
  }

  clearTyping(roomId: string): void {
    // Get all users typing in this room
    const typingUsers = this.roomTyping.get(roomId);
    if (!typingUsers) return;

    // Stop typing for all users in the room
    const usersToStop = Array.from(typingUsers);
    usersToStop.forEach(userId => {
      this.stopTyping(userId);
    });

    logger.debug(`🧹 Cleared all typing indicators for room ${roomId}`);
  }

  clearUserTyping(userId: string): void {
    this.stopTyping(userId);
  }

  private isUserInRoom(socketId: string, roomId: string): boolean {
    // Check if socket is in the specified room
    const socket = this.io.sockets.sockets.get(socketId);
    if (!socket) return false;
    
    return socket.rooms.has(roomId);
  }

  // Get typing statistics
  getTypingStats() {
    const now = Date.now();
    const activeTypingArray = Array.from(this.activeTyping.values());
    
    const averageTypingDuration = activeTypingArray.length > 0
      ? activeTypingArray.reduce((sum, state) => sum + (now - state.startTime), 0) / activeTypingArray.length
      : 0;

    const roomsWithTyping = this.roomTyping.size;
    const totalTypingUsers = activeTypingArray.length;

    return {
      activeTypingUsers: totalTypingUsers,
      roomsWithTyping,
      averageTypingDuration,
      longestTypingDuration: activeTypingArray.length > 0
        ? Math.max(...activeTypingArray.map(state => now - state.startTime))
        : 0
    };
  }

  // Get detailed typing info for debugging
  getDetailedTypingInfo() {
    const typingByRoom: { [roomId: string]: string[] } = {};
    
    this.roomTyping.forEach((users, roomId) => {
      typingByRoom[roomId] = Array.from(users);
    });

    return {
      activeTyping: Object.fromEntries(
        Array.from(this.activeTyping.entries()).map(([userId, state]) => [
          userId,
          {
            roomId: state.roomId,
            duration: Date.now() - state.startTime
          }
        ])
      ),
      typingByRoom
    };
  }

  // Force cleanup for testing
  forceCleanup(): void {
    // Stop all active typing
    const userIds = Array.from(this.activeTyping.keys());
    userIds.forEach(userId => this.stopTyping(userId));
    
    logger.debug('🧹 Force cleaned all typing indicators');
  }
}