// server/services/RoomManager.ts
import { logger } from '../utils/logger';

export interface Room {
  id: string;
  users: string[]; // Socket IDs
  chatType: 'text' | 'video';
  createdAt: number;
  lastActivity: number;
  metadata?: {
    commonInterests?: string[];
    userProfiles?: { [socketId: string]: any };
  };
}

interface RoomStats {
  totalRooms: number;
  textRooms: number;
  videoRooms: number;
  averageRoomAge: number;
  activeRooms: number;
}

export class RoomManager {
  private rooms: { [roomId: string]: Room } = {};
  private userToRoom: { [socketId: string]: string } = {}; // Quick lookup for user's current room
  private readonly ROOM_TIMEOUT = 30 * 60 * 1000; // 30 minutes of inactivity

  constructor() {
    this.startPeriodicCleanup();
  }

  createRoom(roomId: string, users: string[], chatType: 'text' | 'video', metadata?: any): Room {
    const room: Room = {
      id: roomId,
      users: [...users],
      chatType,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      metadata
    };

    this.rooms[roomId] = room;
    
    // Update user-to-room mapping
    users.forEach(socketId => {
      this.userToRoom[socketId] = roomId;
    });

    logger.info(`🏠 Room created: ${roomId} (${chatType}) with users: [${users.join(', ')}]`);
    return room;
  }

  getRoom(roomId: string): Room | null {
    const room = this.rooms[roomId];
    if (room) {
      room.lastActivity = Date.now(); // Update activity timestamp
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

    // Clear user-to-room mappings
    room.users.forEach(socketId => {
      delete this.userToRoom[socketId];
    });

    delete this.rooms[roomId];
    logger.info(`🗑️  Room deleted: ${roomId}`);
    return true;
  }

  addUserToRoom(roomId: string, socketId: string): boolean {
    const room = this.rooms[roomId];
    if (!room) return false;

    if (!room.users.includes(socketId)) {
      room.users.push(socketId);
      this.userToRoom[socketId] = roomId;
      room.lastActivity = Date.now();
      
      logger.debug(`👤 User ${socketId} added to room ${roomId}`);
      return true;
    }
    return false;
  }

  removeUserFromRoom(roomId: string, socketId: string): boolean {
    const room = this.rooms[roomId];
    if (!room) return false;

    const userIndex = room.users.indexOf(socketId);
    if (userIndex !== -1) {
      room.users.splice(userIndex, 1);
      delete this.userToRoom[socketId];
      room.lastActivity = Date.now();
      
      logger.debug(`👤 User ${socketId} removed from room ${roomId}`);
      
      // Delete room if empty or only one user left
      if (room.users.length <= 1) {
        this.deleteRoom(roomId);
        return true;
      }
      
      return true;
    }
    return false;
  }

  cleanupUserRooms(socketId: string, onPartnerLeft?: (partnerId: string) => void): void {
    const roomId = this.userToRoom[socketId];
    if (!roomId) return;

    const room = this.rooms[roomId];
    if (!room) return;

    // Notify partner if exists
    const partnerId = room.users.find(id => id !== socketId);
    if (partnerId && onPartnerLeft) {
      onPartnerLeft(partnerId);
    }

    // Remove the room
    this.deleteRoom(roomId);
    
    logger.debug(`🧹 Cleaned up rooms for user ${socketId}`);
  }

  updateRoomMetadata(roomId: string, metadata: any): boolean {
    const room = this.rooms[roomId];
    if (!room) return false;

    room.metadata = { ...room.metadata, ...metadata };
    room.lastActivity = Date.now();
    return true;
  }

  getRoomUsers(roomId: string): string[] {
    const room = this.rooms[roomId];
    return room ? [...room.users] : [];
  }

  isUserInRoom(socketId: string, roomId?: string): boolean {
    if (roomId) {
      const room = this.rooms[roomId];
      return room ? room.users.includes(socketId) : false;
    }
    return socketId in this.userToRoom;
  }

  getRoomsForUser(socketId: string): Room[] {
    return Object.values(this.rooms).filter(room => 
      room.users.includes(socketId)
    );
  }

  getStats(): RoomStats {
    const rooms = Object.values(this.rooms);
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);

    const textRooms = rooms.filter(room => room.chatType === 'text').length;
    const videoRooms = rooms.filter(room => room.chatType === 'video').length;
    const activeRooms = rooms.filter(room => room.lastActivity > fiveMinutesAgo).length;

    const totalAge = rooms.reduce((sum, room) => sum + (now - room.createdAt), 0);
    const averageRoomAge = rooms.length > 0 ? totalAge / rooms.length : 0;

    return {
      totalRooms: rooms.length,
      textRooms,
      videoRooms,
      averageRoomAge,
      activeRooms
    };
  }

  private startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanupInactiveRooms();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private cleanupInactiveRooms(): void {
    const now = Date.now();
    const roomsToDelete: string[] = [];

    Object.entries(this.rooms).forEach(([roomId, room]) => {
      const inactiveTime = now - room.lastActivity;
      
      if (inactiveTime > this.ROOM_TIMEOUT) {
        roomsToDelete.push(roomId);
      }
    });

    roomsToDelete.forEach(roomId => {
      logger.info(`🧹 Cleaning up inactive room: ${roomId}`);
      this.deleteRoom(roomId);
    });

    if (roomsToDelete.length > 0) {
      logger.info(`🧹 Cleaned up ${roomsToDelete.length} inactive rooms`);
    }
  }

  // Advanced room analytics
  getRoomAnalytics() {
    const rooms = Object.values(this.rooms);
    const now = Date.now();

    const roomAges = rooms.map(room => now - room.createdAt);
    const roomActivities = rooms.map(room => now - room.lastActivity);

    const averageRoomDuration = roomAges.length > 0 
      ? roomAges.reduce((sum, age) => sum + age, 0) / roomAges.length 
      : 0;

    const averageInactivity = roomActivities.length > 0
      ? roomActivities.reduce((sum, activity) => sum + activity, 0) / roomActivities.length
      : 0;

    const roomsByType = rooms.reduce((acc, room) => {
      acc[room.chatType] = (acc[room.chatType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const roomsWithCommonInterests = rooms.filter(room => 
      room.metadata?.commonInterests && room.metadata.commonInterests.length > 0
    ).length;

    return {
      totalRooms: rooms.length,
      averageRoomDuration,
      averageInactivity,
      roomsByType,
      roomsWithCommonInterests,
      interestBasedPercentage: rooms.length > 0 
        ? (roomsWithCommonInterests / rooms.length) * 100 
        : 0
    };
  }

  // Get room history for debugging
  getAllRooms(): Room[] {
    return Object.values(this.rooms);
  }

  // Force cleanup for testing
  forceCleanup(): number {
    const roomCount = Object.keys(this.rooms).length;
    this.cleanupInactiveRooms();
    return roomCount - Object.keys(this.rooms).length;
  }
}