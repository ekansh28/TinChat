// server/services/TypingManager.ts
import { Server as SocketIOServer, Socket } from 'socket.io';
import { ValidationSchemas } from '../validation/schemas';
import { logger } from '../utils/logger';


export class TypingManager {
  private io: SocketIOServer;
  private activeTyping: Map<string, NodeJS.Timeout> = new Map();

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  handleTypingStart(socket: Socket, payload: unknown): void {
    try {
      const { roomId } = ValidationSchemas.RoomIdPayloadSchema.parse(payload);
      this.startTyping(socket.id, roomId);
    } catch (error: any) {
      logger.warn(`Invalid typing_start payload from ${socket.id}:`, error.message);
    }
  }

  handleTypingStop(socket: Socket, payload: unknown): void {
    try {
      const { roomId } = ValidationSchemas.RoomIdPayloadSchema.parse(payload);
      this.stopTyping(socket.id);
    } catch (error: any) {
      logger.warn(`Invalid typing_stop payload from ${socket.id}:`, error.message);
    }
  }

  private startTyping(userId: string, roomId: string): void {
    this.stopTyping(userId);

    const timeout = setTimeout(() => {
      this.stopTyping(userId);
    }, 3000);

    this.activeTyping.set(userId, timeout);
    this.broadcastTypingToRoom(roomId, userId, true);
  }

  private stopTyping(userId: string): void {
    const timeout = this.activeTyping.get(userId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeTyping.delete(userId);
    }
  }

  private broadcastTypingToRoom(roomId: string, typingUserId: string, isTyping: boolean): void {
    const room = this.io.sockets.adapter.rooms.get(roomId);
    if (!room) return;

    room.forEach(socketId => {
      if (socketId !== typingUserId) {
        const eventName = isTyping ? 'partner_typing_start' : 'partner_typing_stop';
        this.io.to(socketId).emit(eventName);
      }
    });
  }

  clearTyping(roomId: string): void {
    // Clear typing for all users in room
  }

  clearUserTyping(userId: string): void {
    this.stopTyping(userId);
  }
}