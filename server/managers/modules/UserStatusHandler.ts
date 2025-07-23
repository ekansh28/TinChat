// server/managers/modules/UserStatusHandler.ts
import { Server as SocketIOServer, Socket } from 'socket.io';
import { ProfileManager } from '../profile/ProfileManager';
import { RoomManager } from '../../services/RoomManager';
import { ProfileCache } from '../../utils/ProfileCache';
import { ValidationSchemas } from '../../validation/schemas';
import { UserStatus } from '../../types/User';
import { logger } from '../../utils/logger';

export class UserStatusHandler {
  constructor(
    private io: SocketIOServer,
    private profileManager: ProfileManager,
    private roomManager: RoomManager,
    private profileCache: ProfileCache,
    private socketToAuthId: Map<string, string>
  ) {}

  async handleUpdateStatus(socket: Socket, payload: unknown): Promise<void> {
    try {
      const { status } = ValidationSchemas.UpdateStatusPayloadSchema.parse(payload);
      const authId = this.socketToAuthId.get(socket.id);
      
      if (authId) {
        const success = await this.profileManager.updateUserStatus(authId, status);
        if (success) {
          this.profileCache.invalidate(authId);
          this.broadcastStatusToPartner(socket.id, status);
          socket.emit('statusUpdated', { status });
          logger.debug(`📊 Status updated: ${authId} → ${status}`);
        } else {
          socket.emit('error', { message: 'Failed to update status .' });
        }
      } else {
        socket.emit('error', { message: 'Authentication required to update status.' });
      }
    } catch (error: any) {
      logger.warn(`❌ Invalid updateStatus payload from ${socket.id}:`, error.message);
      socket.emit('error', { message: 'Invalid payload for updateStatus.' });
    }
  }

  private broadcastStatusToPartner(socketId: string, status: string): void {
    const room = this.roomManager.getRoomByUserId(socketId);
    if (room) {
      const partnerId = room.users.find(id => id !== socketId);
      if (partnerId) {
        this.io.to(partnerId).emit('partnerStatusChanged', { status });
      }
    }
  }

  async handleGetOnlineUsersData(socket: Socket): Promise<void> {
    try {
      const onlineData = await this.getOnlineUsersData();
      socket.emit('onlineUsersData', onlineData);
      logger.debug(`📋 Sent complete online data to ${socket.id}`);
    } catch (error) {
      logger.error('Failed to get online users data:', error);
      socket.emit('onlineUsersData', {
        connectedUsers: [],
        queueStats: { textQueue: 0, videoQueue: 0 },
        activeChats: 0,
        totalOnline: 0
      });
    }
  }

  async handleGetOnlineUsersList(socket: Socket): Promise<void> {
    try {
      const onlineData = await this.getOnlineUsersData();
      socket.emit('onlineUsersList', onlineData.connectedUsers);
      logger.debug(`📋 Sent online users list to ${socket.id}: ${onlineData.connectedUsers.length} users`);
    } catch (error) {
      logger.error('Failed to get online users list:', error);
      socket.emit('onlineUsersList', []);
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

    // Note: This should be injected from the MatchmakingHandler
    // For now, return placeholder values
    return {
      connectedUsers,
      queueStats: { textQueue: 0, videoQueue: 0 },
      activeChats: 0,
      totalOnline: this.io.sockets.sockets.size
    };
  }

  // Bulk status updates for performance
  async bulkUpdateUserStatus(userStatusUpdates: Array<{ authId: string; status: UserStatus }>): Promise<void> {
    const authIds = userStatusUpdates.map(update => update.authId);
    
    try {
      // Batch update in ProfileManager
      for (const update of userStatusUpdates) {
        await this.profileManager.updateUserStatus(update.authId, update.status);
        this.profileCache.invalidate(update.authId);
      }
      
      logger.info(`✅ Bulk updated ${userStatusUpdates.length} user statuses`);
    } catch (error) {
      logger.error('Failed to bulk update user statuses:', error);
    }
  }

  // Set users offline on disconnect
  async handleUserDisconnect(socketId: string): Promise<void> {
    const authId = this.socketToAuthId.get(socketId);
    if (authId) {
      try {
        await this.profileManager.updateUserStatus(authId, 'offline');
        this.profileCache.invalidate(authId);
        logger.debug(`📊 Set user offline: ${authId}`);
      } catch (error) {
        logger.error(`Failed to set user offline for ${authId}:`, error);
      }
    }
  }

  getStats() {
    return {
      authenticatedUsers: this.socketToAuthId.size,
      cacheStats: this.profileCache.getStats()
    };
  }
}