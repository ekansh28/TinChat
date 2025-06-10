// ===== server/services/RoomManager.ts =====
import { logger } from '../utils/logger';

export interface Room {
  id: string;
  users: string[];
  chatType: 'text' | 'video';
  createdAt: number;
  lastActivity: number;
}

export class RoomManager {
  private rooms: { [roomId: string]: Room } = {};
  private userToRoom: { [socketId: string]: string } = {};

  createRoom(roomId: string, users: string[], chatType: 'text' | 'video'): Room {
    const room: Room = {
      id: roomId,
      users: [...users],
      chatType,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    this.rooms[roomId] = room;
    users.forEach(socketId => {
      this.userToRoom[socketId] = roomId;
    });

    logger.info(`🏠 Room created: ${roomId} (${chatType}) with users: [${users.join(', ')}]`);
    return room;
  }

  getRoom(roomId: string): Room | null {
    const room = this.rooms[roomId];
    if (room) {
      room.lastActivity = Date.now();
      return room;
    }
    return null;
  }

  getRoomByUserId(socketId: string): Room | null {
    const roomId = this.userToRoom[socketId];
    return roomId ? this.getRoom(roomId) : null;
  }

  deleteRoom(roomId: string): boolean {
    const room = this.rooms[roomId];
    if (!room) return false;

    room.users.forEach(socketId => {
      delete this.userToRoom[socketId];
    });

    delete this.rooms[roomId];
    logger.info(`🗑️ Room deleted: ${roomId}`);
    return true;
  }

  cleanupUserRooms(socketId: string, onPartnerLeft?: (partnerId: string) => void): void {
    const roomId = this.userToRoom[socketId];
    if (!roomId) return;

    const room = this.rooms[roomId];
    if (!room) return;

    const partnerId = room.users.find(id => id !== socketId);
    if (partnerId && onPartnerLeft) {
      onPartnerLeft(partnerId);
    }

    this.deleteRoom(roomId);
    logger.debug(`🧹 Cleaned up rooms for user ${socketId}`);
  }

  getStats() {
    const rooms = Object.values(this.rooms);
    return {
      totalRooms: rooms.length,
      textRooms: rooms.filter(r => r.chatType === 'text').length,
      videoRooms: rooms.filter(r => r.chatType === 'video').length,
      activeRooms: rooms.length
    };
  }
}