// server/services/MatchmakingEngine.ts
import { User } from '../managers/SocketManager';
import { logger } from '../utils/logger';

interface QueueStats {
  text: number;
  video: number;
  totalWaitTime: number;
  averageWaitTime: number;
}

export class MatchmakingEngine {
  private waitingUsers: { [key in 'text' | 'video']: User[] } = {
    text: [],
    video: [],
  };
  
  private matchHistory: Array<{ timestamp: number; user1: string; user2: string; interests: string[] }> = [];
  private userJoinTimes: Map<string, number> = new Map();

  findMatch(currentUser: User): User | null {
    logger.debug(`🎯 Match search started for ${currentUser.id} (${currentUser.chatType})`);
    
    const queue = this.waitingUsers[currentUser.chatType];
    const candidates = queue.filter(p => p.id !== currentUser.id);
    
    if (candidates.length === 0) {
      logger.debug(`No candidates available for ${currentUser.id}`);
      return null;
    }

    let selectedPartner: User | null = null;

    // Phase 1: Interest-based matching
    if (currentUser.interests.length > 0) {
      selectedPartner = this.findInterestBasedMatch(currentUser, candidates);
      if (selectedPartner) {
        logger.info(`🎯 Interest-based match: ${currentUser.id} ↔ ${selectedPartner.id}`);
      }
    }

    // Phase 2: Smart random matching with anti-repetition
    if (!selectedPartner) {
      selectedPartner = this.findSmartRandomMatch(currentUser, candidates);
      if (selectedPartner) {
        logger.info(`🎯 Smart random match: ${currentUser.id} ↔ ${selectedPartner.id}`);
      }
    }

    if (selectedPartner) {
      // Remove selected partner from queue
      const index = queue.findIndex(u => u.id === selectedPartner!.id);
      if (index !== -1) {
        queue.splice(index, 1);
        
        // Record match for analytics
        this.recordMatch(currentUser, selectedPartner);
        
        // Track wait times
        const waitTime = Date.now() - (this.userJoinTimes.get(selectedPartner.id) || Date.now());
        logger.debug(`⏱️  Wait time for ${selectedPartner.id}: ${waitTime}ms`);
        
        return selectedPartner;
      }
    }

    logger.debug(`No match found for ${currentUser.id}`);
    return null;
  }

  private findInterestBasedMatch(currentUser: User, candidates: User[]): User | null {
    // Score-based matching for better compatibility
    const scoredCandidates = candidates
      .map(candidate => ({
        user: candidate,
        score: this.calculateInterestCompatibility(currentUser.interests, candidate.interests)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scoredCandidates.length > 0) {
      // Add some randomization among top scored candidates
      const topCandidates = scoredCandidates.filter(item => 
        item.score >= scoredCandidates[0].score * 0.8
      );
      
      const randomIndex = Math.floor(Math.random() * topCandidates.length);
      return topCandidates[randomIndex].user;
    }

    return null;
  }

  private findSmartRandomMatch(currentUser: User, candidates: User[]): User | null {
    // Filter out recently matched users to prevent immediate re-matching
    const recentMatches = this.getRecentMatches(currentUser.id, 10); // Last 10 matches
    const freshCandidates = candidates.filter(candidate => 
      !recentMatches.some(match => 
        match.user1 === candidate.id || match.user2 === candidate.id
      )
    );

    const finalCandidates = freshCandidates.length > 0 ? freshCandidates : candidates;
    
    if (finalCandidates.length === 0) return null;

    // Weighted random selection based on wait time (longer wait = higher priority)
    const now = Date.now();
    const weightedCandidates = finalCandidates.map(candidate => {
      const waitTime = now - (this.userJoinTimes.get(candidate.id) || now);
      const weight = Math.max(1, Math.floor(waitTime / 5000)); // 5 second intervals
      return { user: candidate, weight };
    });

    const totalWeight = weightedCandidates.reduce((sum, item) => sum + item.weight, 0);
    let randomValue = Math.random() * totalWeight;

    for (const item of weightedCandidates) {
      randomValue -= item.weight;
      if (randomValue <= 0) {
        return item.user;
      }
    }

    // Fallback to first candidate
    return finalCandidates[0];
  }

  private calculateInterestCompatibility(interests1: string[], interests2: string[]): number {
    if (interests1.length === 0 || interests2.length === 0) return 0;

    const commonInterests = interests1.filter(interest => 
      interests2.includes(interest)
    );

    // Score based on common interests and total interests
    const commonCount = commonInterests.length;
    const totalUnique = new Set([...interests1, ...interests2]).size;
    
    // Jaccard similarity coefficient with bonus for multiple matches
    const jaccardSimilarity = commonCount / totalUnique;
    const bonusMultiplier = 1 + (commonCount - 1) * 0.5; // Bonus for multiple common interests
    
    return jaccardSimilarity * bonusMultiplier;
  }

  addToWaitingList(user: User): void {
    // Remove from any existing queue first
    this.removeFromWaitingLists(user.id);
    
    this.waitingUsers[user.chatType].push(user);
    this.userJoinTimes.set(user.id, Date.now());
    
    logger.debug(`➕ Added ${user.id} to ${user.chatType} queue (size: ${this.waitingUsers[user.chatType].length})`);
  }

  removeFromWaitingLists(socketId: string): void {
    (['text', 'video'] as const).forEach(type => {
      const index = this.waitingUsers[type].findIndex(u => u.id === socketId);
      if (index !== -1) {
        this.waitingUsers[type].splice(index, 1);
        this.userJoinTimes.delete(socketId);
        logger.debug(`➖ Removed ${socketId} from ${type} queue`);
      }
    });
  }

  private recordMatch(user1: User, user2: User): void {
    const commonInterests = user1.interests.filter(interest => 
      user2.interests.includes(interest)
    );

    this.matchHistory.push({
      timestamp: Date.now(),
      user1: user1.id,
      user2: user2.id,
      interests: commonInterests
    });

    // Keep only last 1000 matches to prevent memory bloat
    if (this.matchHistory.length > 1000) {
      this.matchHistory = this.matchHistory.slice(-500);
    }
  }

  private getRecentMatches(userId: string, limit: number = 10): Array<{ user1: string; user2: string; interests: string[] }> {
    const cutoffTime = Date.now() - (30 * 60 * 1000); // Last 30 minutes
    
    return this.matchHistory
      .filter(match => 
        match.timestamp > cutoffTime && 
        (match.user1 === userId || match.user2 === userId)
      )
      .slice(-limit);
  }

  getQueueStats(): QueueStats {
    const textQueue = this.waitingUsers.text;
    const videoQueue = this.waitingUsers.video;
    const now = Date.now();

    let totalWaitTime = 0;
    let userCount = 0;

    [textQueue, videoQueue].forEach(queue => {
      queue.forEach(user => {
        const waitTime = now - (this.userJoinTimes.get(user.id) || now);
        totalWaitTime += waitTime;
        userCount++;
      });
    });

    return {
      text: textQueue.length,
      video: videoQueue.length,
      totalWaitTime,
      averageWaitTime: userCount > 0 ? totalWaitTime / userCount : 0
    };
  }

  cleanupStaleUsers(isConnectedCheck: (socketId: string) => boolean): void {
    (['text', 'video'] as const).forEach(type => {
      const originalLength = this.waitingUsers[type].length;
      this.waitingUsers[type] = this.waitingUsers[type].filter(user => {
        const isConnected = isConnectedCheck(user.id);
        if (!isConnected) {
          this.userJoinTimes.delete(user.id);
        }
        return isConnected;
      });
      
      const removedCount = originalLength - this.waitingUsers[type].length;
      if (removedCount > 0) {
        logger.debug(`🧹 Cleaned up ${removedCount} stale users from ${type} queue`);
      }
    });
  }

  getMatchAnalytics() {
    const recentMatches = this.matchHistory.filter(match => 
      match.timestamp > Date.now() - (24 * 60 * 60 * 1000) // Last 24 hours
    );

    const interestBasedMatches = recentMatches.filter(match => match.interests.length > 0);
    const averageCommonInterests = recentMatches.length > 0 
      ? recentMatches.reduce((sum, match) => sum + match.interests.length, 0) / recentMatches.length 
      : 0;

    return {
      totalMatches24h: recentMatches.length,
      interestBasedMatches: interestBasedMatches.length,
      interestBasedPercentage: recentMatches.length > 0 
        ? (interestBasedMatches.length / recentMatches.length) * 100 
        : 0,
      averageCommonInterests,
      currentQueues: this.getQueueStats()
    };
  }
}