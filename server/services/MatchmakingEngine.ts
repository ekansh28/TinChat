// ===== server/services/MatchmakingEngine.ts =====
import { logger } from '../utils/logger';

export interface User {
  id: string;
  interests: string[];
  chatType: 'text' | 'video';
  authId: string | null;
  username?: string;
  displayName?: string;
  status?: string;
  displayNameColor?: string;
  displayNameAnimation?: string;
  rainbowSpeed?: number;
  badges?: any[];
}

export class MatchmakingEngine {
  private waitingUsers: { [key in 'text' | 'video']: User[] } = {
    text: [],
    video: [],
  };

  findMatch(currentUser: User): User | null {
    logger.debug(`🎯 Match search started for ${currentUser.id} (${currentUser.chatType})`);
    
    const queue = this.waitingUsers[currentUser.chatType];
    const candidates = queue.filter(p => p.id !== currentUser.id);
    
    if (candidates.length === 0) {
      logger.debug(`No candidates available for ${currentUser.id}`);
      return null;
    }

    // Simple matching - try interest-based first, then random
    let selectedPartner = this.findInterestBasedMatch(currentUser, candidates);
    if (!selectedPartner) {
      selectedPartner = candidates[Math.floor(Math.random() * candidates.length)];
    }

    if (selectedPartner) {
      const index = queue.findIndex(u => u.id === selectedPartner!.id);
      if (index !== -1) {
        queue.splice(index, 1);
        logger.info(`🎯 Match found: ${currentUser.id} ↔ ${selectedPartner.id}`);
        return selectedPartner;
      }
    }

    return null;
  }

  private findInterestBasedMatch(currentUser: User, candidates: User[]): User | null {
    if (currentUser.interests.length === 0) return null;

    for (const candidate of candidates) {
      const hasCommonInterest = candidate.interests.some(interest => 
        currentUser.interests.includes(interest)
      );
      if (hasCommonInterest) {
        return candidate;
      }
    }
    return null;
  }

  addToWaitingList(user: User): void {
    this.removeFromWaitingLists(user.id);
    this.waitingUsers[user.chatType].push(user);
    logger.debug(`➕ Added ${user.id} to ${user.chatType} queue`);
  }

  removeFromWaitingLists(socketId: string): void {
    (['text', 'video'] as const).forEach(type => {
      const index = this.waitingUsers[type].findIndex(u => u.id === socketId);
      if (index !== -1) {
        this.waitingUsers[type].splice(index, 1);
        logger.debug(`➖ Removed ${socketId} from ${type} queue`);
      }
    });
  }

  getQueueStats() {
    return {
      text: this.waitingUsers.text.length,
      video: this.waitingUsers.video.length,
      totalWaitTime: 0,
      averageWaitTime: 0
    };
  }

  cleanupStaleUsers(isConnectedCheck: (socketId: string) => boolean): void {
    (['text', 'video'] as const).forEach(type => {
      const originalLength = this.waitingUsers[type].length;
      this.waitingUsers[type] = this.waitingUsers[type].filter(user => 
        isConnectedCheck(user.id)
      );
      
      const removedCount = originalLength - this.waitingUsers[type].length;
      if (removedCount > 0) {
        logger.debug(`🧹 Cleaned up ${removedCount} stale users from ${type} queue`);
      }
    });
  }
}