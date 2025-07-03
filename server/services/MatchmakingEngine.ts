// server/services/MatchmakingEngine.ts - FIXED VERSION WITH PROPER ASYNC OPERATIONS

import { logger } from '../utils/logger';
import { User } from '../types/User';
import { RedisService } from './RedisService';

export class MatchmakingEngine {
  private waitingUsers: { [key in 'text' | 'video']: User[] } = {
    text: [],
    video: [],
  };

  private redisService: RedisService | null;
  private readonly REDIS_QUEUE_PREFIX = 'queue';
  private readonly REDIS_MATCH_HISTORY_PREFIX = 'match_history';
  private readonly REDIS_USER_PREFERENCES_PREFIX = 'user_prefs';
  
  // Enhanced session tracking with Redis persistence
  private userSessions = new Map<string, {
    connectionHistory: Array<{
      socketId: string;
      disconnectedAt: number;
      authId: string | null;
    }>;
    lastActivity: number;
  }>();

  // ✅ FIXED: Track ongoing async operations to prevent race conditions
  private ongoingOperations = new Map<string, Promise<any>>();

  constructor(redisService: RedisService | null = null) {
    this.redisService = redisService;
    
    if (this.redisService) {
      logger.info('🎯 MatchmakingEngine initialized with Redis persistence');
      this.initializeRedisQueues();
    } else {
      logger.info('🎯 MatchmakingEngine initialized with memory-only queues');
    }
  }

  /**
   * Initialize Redis queues by loading any existing queue data
   */
  private async initializeRedisQueues(): Promise<void> {
    if (!this.redisService) return;
    
    try {
      // Load existing queues from Redis on startup
      const textQueueLength = await this.redisService.getQueueLength('text');
      const videoQueueLength = await this.redisService.getQueueLength('video');
      
      logger.info(`📋 Loaded Redis queues: text=${textQueueLength}, video=${videoQueueLength}`);
      
      // Optionally restore in-memory queues from Redis for hybrid approach
      await this.syncQueuesFromRedis();
    } catch (error) {
      logger.error('Failed to initialize Redis queues:', error);
    }
  }

  /**
   * Sync in-memory queues with Redis state (hybrid approach)
   */
  private async syncQueuesFromRedis(): Promise<void> {
    if (!this.redisService) return;
    
    try {
      for (const chatType of ['text', 'video'] as const) {
        // Get all users from Redis queue
        const redisQueue = await this.getAllFromRedisQueue(chatType);
        
        // Update in-memory queue with valid users
        this.waitingUsers[chatType] = redisQueue.filter(user => 
          this.isUserStillValid(user)
        );
        
        logger.debug(`🔄 Synced ${this.waitingUsers[chatType].length} users for ${chatType} queue`);
      }
    } catch (error) {
      logger.error('Failed to sync queues from Redis:', error);
    }
  }

    // ===== CRITICAL FIX 5: Enhanced Queue Removal =====
  // Add this method to handle queue removal issues
  
  private async safeRemoveFromQueues(socketId: string): Promise<boolean> {
    try {
      let totalRemoved = 0;
      
      // Remove from memory queues with detailed logging
      for (const type of ['text', 'video'] as const) {
        const originalLength = this.waitingUsers[type].length;
        
        this.waitingUsers[type] = this.waitingUsers[type].filter(u => {
          if (u.id === socketId) {
            totalRemoved++;
            logger.debug(`🗑️ Removed ${socketId} from ${type} memory queue`);
            return false;
          }
          return true;
        });
        
        const removed = originalLength - this.waitingUsers[type].length;
        if (removed > 0) {
          logger.debug(`✅ Removed ${removed} entries for ${socketId} from ${type} queue`);
        }
      }
      
      // Remove from Redis queues with timeout
      if (this.redisService) {
        try {
          await Promise.race([
            Promise.all([
              this.redisService.removeFromQueue('text', socketId),
              this.redisService.removeFromQueue('video', socketId)
            ]),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Redis removal timeout')), 2000))
          ]);
          
          logger.debug(`📋 Removed ${socketId} from Redis queues`);
        } catch (error) {
          logger.warn(`Redis queue removal failed for ${socketId} (non-critical):`, error instanceof Error ? error.message : error);
          // Don't fail the operation
        }
      }
      
      return totalRemoved > 0;
    } catch (error) {
      logger.error(`Failed to remove ${socketId} from queues:`, error);
      return false;
    }
  }
  
  /**
   * Enhanced find match with Redis-backed user preferences and history
   */
  async findMatch(currentUser: User): Promise<User | null> {
    logger.info(`🎯 ENHANCED MATCHMAKING: ${currentUser.id} (${currentUser.authId || 'anonymous'}) - ${currentUser.chatType} chat`);
    
    try {
      // Load user preferences from Redis if available
      const userPrefs = await this.loadUserPreferences(currentUser);
      
      // Get match history to avoid repeated matches
      const matchHistory = await this.getMatchHistory(currentUser);
      
      // Get candidates from both memory and Redis
      const candidates = await this.getCandidatesWithPreferences(currentUser, userPrefs, matchHistory);
      
      logger.info(`🔍 ENHANCED FILTERING: ${candidates.length} candidates after preference filtering`);
      
      if (candidates.length === 0) {
        return null;
      }

      // Smart candidate selection based on preferences and history
      const selectedPartner = this.selectBestCandidate(currentUser, candidates, userPrefs);
      
      if (selectedPartner) {
        // ✅ FIXED: Ensure async removal operations are properly awaited
        await this.removeUserFromAllQueues(selectedPartner.id);
        
        // Record the match in history (async but don't wait)
        this.recordMatch(currentUser, selectedPartner).catch(err =>
          logger.debug('Failed to record match history:', err)
        );
        
        // Update user preferences based on successful match (async but don't wait)
        this.updateUserPreferences(currentUser, selectedPartner).catch(err =>
          logger.debug('Failed to update preferences:', err)
        );
        
        logger.info(`✅ ENHANCED MATCH: ${currentUser.id} ↔ ${selectedPartner.id} (${currentUser.chatType})`, {
          matchScore: this.calculateMatchScore(currentUser, selectedPartner, userPrefs),
          preferenceFactors: this.getPreferenceFactors(currentUser, selectedPartner, userPrefs)
        });
        
        return selectedPartner;
      }

      return null;
    } catch (error) {
      logger.error(`❌ Error in findMatch for ${currentUser.id}:`, error);
      return null;
    }
  }

  /**
   * Enhanced queue management with Redis persistence
   */
  async addToWaitingList(user: User): Promise<void> {
  if (!user.id || !user.chatType) {
    logger.error(`❌ Invalid user data for addToWaitingList:`, {
      id: user.id,
      chatType: user.chatType,
      authId: user.authId
    });
    return;
  }

  try {
    // ✅ FIXED: Use safe removal method
    const removed = await this.safeRemoveFromQueues(user.id);
    if (!removed) {
      logger.debug(`No existing entries found for ${user.id} (this is normal for new users)`);
    }
    
    // Rest of your existing logic...
    if (!user.connectionStartTime) {
      user.connectionStartTime = Date.now();
    }
    
    // Add to memory queue
    this.waitingUsers[user.chatType].push(user);
    
    // Add to Redis queue
    if (this.redisService) {
      try {
        const addSuccess = await this.redisService.addToQueue(user.chatType, user);
        if (addSuccess) {
          logger.debug(`📋 Added user ${user.id} to Redis ${user.chatType} queue`);
        } else {
          logger.warn(`⚠️ Failed to add user ${user.id} to Redis queue, continuing with memory-only`);
        }
      } catch (error) {
        logger.error(`Failed to add user to Redis queue:`, error);
        // Continue without Redis - graceful degradation
      }
    }
    
    logger.info(`➕ ENHANCED QUEUED: ${user.id} (${user.authId || 'anonymous'}) to ${user.chatType} queue. Memory: ${this.waitingUsers[user.chatType].length}`);
  } catch (error) {
    logger.error(`❌ Error in addToWaitingList for ${user.id}:`, error);
  }
}

  /**
   * ✅ FIXED: Remove user from all queues (memory + Redis) - now properly async
   */
  async removeUserFromAllQueues(socketId: string): Promise<void> {
    // ✅ FIXED: Check if operation is already in progress to prevent race conditions
    const operationKey = `remove_${socketId}`;
    if (this.ongoingOperations.has(operationKey)) {
      logger.debug(`⏳ Removal operation already in progress for ${socketId}, waiting...`);
      try {
        await this.ongoingOperations.get(operationKey);
        return;
      } catch (error) {
        logger.warn(`Previous removal operation failed for ${socketId}:`, error);
      }
    }

    // Start new removal operation
    const removalPromise = this.performRemovalOperation(socketId);
    this.ongoingOperations.set(operationKey, removalPromise);

    try {
      await removalPromise;
    } finally {
      this.ongoingOperations.delete(operationKey);
    }
  }

  /**
   * ✅ NEW: Actual removal operation implementation
   */
  private async performRemovalOperation(socketId: string): Promise<void> {
    let totalRemoved = 0;
    let removedUser: User | null = null;
    
    try {
      // Remove from memory queues
      for (const type of ['text', 'video'] as const) {
        const originalLength = this.waitingUsers[type].length;
        
        this.waitingUsers[type] = this.waitingUsers[type].filter(u => {
          if (u.id === socketId) {
            totalRemoved++;
            removedUser = u;
            return false;
          }
          return true;
        });
        
        const removed = originalLength - this.waitingUsers[type].length;
        if (removed > 1) {
          logger.warn(`⚠️ Removed ${removed} duplicate entries for ${socketId} from ${type} memory queue`);
        }
      }
      
      // ✅ FIXED: Remove from Redis queues with proper async handling
      if (this.redisService) {
        try {
          const removalPromises = [
            this.redisService.removeFromQueue('text', socketId),
            this.redisService.removeFromQueue('video', socketId)
          ];
          
          const results = await Promise.allSettled(removalPromises);
          
          let redisRemovalSuccess = false;
          results.forEach((result, index) => {
            const queueType = index === 0 ? 'text' : 'video';
            if (result.status === 'fulfilled' && result.value) {
              redisRemovalSuccess = true;
              logger.debug(`📋 Removed ${socketId} from Redis ${queueType} queue`);
            } else if (result.status === 'rejected') {
              logger.warn(`Failed to remove ${socketId} from Redis ${queueType} queue:`, result.reason);
            }
          });
          
          if (!redisRemovalSuccess && totalRemoved === 0) {
            logger.debug(`No entries found for ${socketId} in any queue`);
          }
        } catch (error) {
          logger.error(`Failed to remove user from Redis queues:`, error);
        }
      }
      
      if (totalRemoved > 0) {
        logger.debug(`🧹 Enhanced removal: ${totalRemoved} total entries for ${socketId}`);
        
        if (removedUser) {
          this.trackUserDisconnection(removedUser);
        }
      }
    } catch (error) {
      logger.error(`❌ Error in removal operation for ${socketId}:`, error);
      throw error;
    }
  }

  /**
   * ✅ FIXED: Legacy method now properly calls async version
   */
  removeFromWaitingLists(socketId: string): void {
    // ✅ FIXED: Call async version and handle promise properly
    this.removeUserFromAllQueues(socketId).catch(error => {
      logger.error(`Error in removeFromWaitingLists for ${socketId}:`, error);
    });
  }

  /**
   * Enhanced cleanup with better async handling
   */
  async cleanupStaleUsers(isConnectedCheck: (socketId: string) => boolean): Promise<void> {
    try {
      let totalRemoved = 0;
      const now = Date.now();
      const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes
      
      // ✅ FIXED: Collect all stale/disconnected users first
      const usersToRemove: { socketId: string; reason: string }[] = [];
      
      for (const type of ['text', 'video'] as const) {
        for (const user of this.waitingUsers[type]) {
          const isConnected = isConnectedCheck(user.id);
          const waitTime = now - (user.connectionStartTime || now);
          const isStale = waitTime > STALE_THRESHOLD;
          
          if (!isConnected) {
            usersToRemove.push({ socketId: user.id, reason: 'disconnected' });
          } else if (isStale) {
            usersToRemove.push({ socketId: user.id, reason: `stale (${Math.round(waitTime / 1000)}s)` });
          }
        }
      }
      
      // ✅ FIXED: Remove users with proper async handling and rate limiting
      if (usersToRemove.length > 0) {
        logger.info(`🧹 Starting cleanup of ${usersToRemove.length} stale/disconnected users`);
        
        // Process removals in batches to avoid overwhelming the system
        const batchSize = 10;
        for (let i = 0; i < usersToRemove.length; i += batchSize) {
          const batch = usersToRemove.slice(i, i + batchSize);
          
          const removalPromises = batch.map(async ({ socketId, reason }) => {
            try {
              await this.removeUserFromAllQueues(socketId);
              logger.debug(`🧹 Removed ${reason} user: ${socketId}`);
              return true;
            } catch (error) {
              logger.warn(`Failed to remove ${socketId} (${reason}):`, error);
              return false;
            }
          });
          
          const results = await Promise.allSettled(removalPromises);
          const successCount = results.filter(r => 
            r.status === 'fulfilled' && r.value === true
          ).length;
          
          totalRemoved += successCount;
          
          // Small delay between batches to avoid overwhelming Redis
          if (i + batchSize < usersToRemove.length) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
        
        logger.info(`🧹 Enhanced cleanup completed: ${totalRemoved}/${usersToRemove.length} users removed successfully`);
      }
    } catch (error) {
      logger.error('❌ Error during enhanced cleanup:', error);
    }
  }

  // ✅ ENHANCED: All Redis operations now have proper error handling
  
  /**
   * Load user preferences from Redis with fallback to defaults
   */
  private async loadUserPreferences(user: User): Promise<any> {
    if (!this.redisService || !user.authId) {
      return this.getDefaultPreferences();
    }
    
    try {
      const key = `${this.REDIS_USER_PREFERENCES_PREFIX}:${user.authId}`;
      const cached = await this.redisService.get<any>(key);
      
      if (cached) {
        logger.debug(`🎛️ Loaded preferences for ${user.authId}`);
        return { ...this.getDefaultPreferences(), ...cached };
      }
      
      return this.getDefaultPreferences();
    } catch (error) {
      logger.error(`Failed to load preferences for ${user.authId}:`, error);
      return this.getDefaultPreferences();
    }
  }

private getDefaultPreferences(): any {
  return {
    preferredLanguages: [],
    avoidRecentMatches: false, // ✅ FIXED: Disable to allow more matches during testing
    recentMatchWindow: 30 * 60 * 1000, // 30 minutes
    preferAuthenticatedUsers: false, // ✅ FIXED: Allow mixed auth/anonymous matching
    interestMatchWeight: 0.1, // ✅ FIXED: Reduced weight for broader matching
    activityLevelPreference: 'any',
    maxWaitTimePreference: 15 * 60 * 1000, // ✅ FIXED: Increased to 15 minutes
  };
}

  /**
   * Get match history to avoid repeated matches
   */
  private async getMatchHistory(user: User): Promise<string[]> {
    if (!this.redisService || !user.authId) {
      return [];
    }
    
    try {
      const key = `${this.REDIS_MATCH_HISTORY_PREFIX}:${user.authId}`;
      const cached = await this.redisService.get<string[]>(key);
      
      if (Array.isArray(cached)) {
        return cached.slice(0, 10); // Last 10 matches
      }
      
      return [];
    } catch (error) {
      logger.error(`Failed to get match history for ${user.authId}:`, error);
      return [];
    }
  }

  /**
   * Get candidates with enhanced filtering based on preferences
   */
  // ===== CRITICAL FIX 2: Enhanced Matchmaking Logic =====
// Replace your getCandidatesWithPreferences method with this enhanced version

private async getCandidatesWithPreferences(
  currentUser: User, 
  userPrefs: any, 
  matchHistory: string[]
): Promise<User[]> {
  try {
    // Get candidates from memory queue
    const memoryQueue = this.waitingUsers[currentUser.chatType];
    
    // Get candidates from Redis queue if available
    let redisCandidates: User[] = [];
    if (this.redisService) {
      try {
        redisCandidates = await this.getAllFromRedisQueue(currentUser.chatType);
      } catch (error) {
        logger.warn('Failed to get Redis candidates, using memory only:', error);
      }
    }
    
    // Combine and deduplicate candidates
    const allCandidates = this.deduplicateCandidates([...memoryQueue, ...redisCandidates]);
    
    logger.debug(`🔍 Raw candidates found: ${allCandidates.length} (memory: ${memoryQueue.length}, redis: ${redisCandidates.length})`);
    
    // ✅ FIXED: Enhanced filtering with detailed logging
    const validCandidates = allCandidates.filter(candidate => {
      // ✅ FIXED: Skip self-matching
      if (candidate.id === currentUser.id) {
        logger.debug(`❌ Skipped self-match: ${candidate.id}`);
        return false;
      }
      
      // ✅ FIXED: Skip same auth ID
      if (currentUser.authId && candidate.authId && currentUser.authId === candidate.authId) {
        logger.debug(`❌ Skipped same auth ID: ${candidate.authId}`);
        return false;
      }
      
      // Basic validation
      if (!this.isValidMatchCandidate(currentUser, candidate)) {
        logger.debug(`❌ Failed basic validation: ${candidate.id}`);
        return false;
      }
      
      // ✅ FIXED: More lenient recent match checking
      if (userPrefs.avoidRecentMatches && matchHistory.includes(candidate.authId || candidate.id)) {
        logger.debug(`❌ Avoiding recent match: ${candidate.id}`);
        return false;
      }
      
      // ✅ FIXED: More flexible auth user preference
      if (userPrefs.preferAuthenticatedUsers && !candidate.authId && currentUser.authId) {
        logger.debug(`❌ Preferring authenticated users: ${candidate.id} is anonymous, current user is authenticated`);
        return false;
      }
      
      // ✅ FIXED: More lenient wait time checking
      const candidateWaitTime = Date.now() - (candidate.connectionStartTime || Date.now());
      const maxWaitTime = userPrefs.maxWaitTimePreference || (10 * 60 * 1000); // Default 10 minutes
      if (candidateWaitTime > maxWaitTime) {
        logger.debug(`❌ Candidate waited too long: ${candidateWaitTime}ms > ${maxWaitTime}ms`);
        return false;
      }
      
      logger.debug(`✅ Valid candidate: ${candidate.id} (authId: ${candidate.authId || 'anonymous'})`);
      return true;
    });
    
    logger.info(`🔍 Filtering results: ${allCandidates.length} total → ${validCandidates.length} valid candidates`);
    
    return validCandidates;
  } catch (error) {
    logger.error('Error getting candidates with preferences:', error);
    // Fallback to basic memory queue filtering
    const memoryQueue = this.waitingUsers[currentUser.chatType];
    const basicCandidates = memoryQueue.filter(candidate => 
      candidate.id !== currentUser.id && 
      !(currentUser.authId && candidate.authId && currentUser.authId === candidate.authId)
    );
    
    logger.warn(`🔄 Using fallback candidates: ${basicCandidates.length} from memory`);
    return basicCandidates;
  }
}
  /**
   * Deduplicate candidates from memory and Redis
   */
  private deduplicateCandidates(candidates: User[]): User[] {
    const seen = new Set<string>();
    return candidates.filter(candidate => {
      const id = candidate.id;
      if (seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    });
  }

  /**
   * Select best candidate using smart scoring algorithm
   */
  private selectBestCandidate(currentUser: User, candidates: User[], userPrefs: any): User | null {
    if (candidates.length === 0) return null;
    
    // Score each candidate
    const scoredCandidates = candidates.map(candidate => ({
      user: candidate,
      score: this.calculateMatchScore(currentUser, candidate, userPrefs)
    }));
    
    // Sort by score (highest first) and then by wait time (longest first for fairness)
    scoredCandidates.sort((a, b) => {
      if (Math.abs(a.score - b.score) < 0.1) {
        // If scores are very close, prioritize by wait time
        const aWaitTime = Date.now() - (a.user.connectionStartTime || 0);
        const bWaitTime = Date.now() - (b.user.connectionStartTime || 0);
        return bWaitTime - aWaitTime; // Longer wait time first
      }
      return b.score - a.score; // Higher score first
    });
    
    const bestMatch = scoredCandidates[0];
    logger.debug(`🎯 Best match selected: ${bestMatch.user.id} (score: ${bestMatch.score.toFixed(2)})`);
    
    return bestMatch.user;
  }

  /**
   * Calculate match score based on various factors
   */
  private calculateMatchScore(user1: User, user2: User, userPrefs: any): number {
    let score = 0;
    
    // Interest overlap score (0-1)
    const interestScore = this.calculateInterestScore(user1.interests || [], user2.interests || []);
    score += interestScore * userPrefs.interestMatchWeight;
    
    // Authentication status bonus
    if (user1.authId && user2.authId) {
      score += 0.2; // Bonus for both being authenticated
    }
    
    // Wait time fairness (longer wait = higher priority)
    const user2WaitTime = Date.now() - (user2.connectionStartTime || Date.now());
    const waitTimeFactor = Math.min(user2WaitTime / (5 * 60 * 1000), 1); // Normalize to 5 minutes
    score += waitTimeFactor * 0.3;
    
    // Profile completeness bonus
    const profileScore = this.calculateProfileScore(user2);
    score += profileScore * 0.2;
    
    // Random factor for variety (small influence)
    score += Math.random() * 0.1;
    
    return Math.min(score, 1); // Cap at 1.0
  }

  private calculateInterestScore(interests1: string[], interests2: string[]): number {
    if (interests1.length === 0 && interests2.length === 0) return 0.5; // Neutral
    if (interests1.length === 0 || interests2.length === 0) return 0.3; // Slight penalty
    
    const set1 = new Set(interests1.map(i => i.toLowerCase()));
    const set2 = new Set(interests2.map(i => i.toLowerCase()));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size; // Jaccard similarity
  }

  private calculateProfileScore(user: User): number {
    let score = 0;
    
    if (user.displayName) score += 0.2;
    if (user.avatarUrl) score += 0.2;
    if (user.pronouns) score += 0.1;
    if (user.badges && user.badges.length > 0) score += 0.2;
    if (user.authId) score += 0.3; // Authentication is important
    
    return Math.min(score, 1);
  }

  private getPreferenceFactors(user1: User, user2: User, userPrefs: any): any {
    return {
      interestOverlap: this.calculateInterestScore(user1.interests || [], user2.interests || []),
      bothAuthenticated: !!(user1.authId && user2.authId),
      profileCompleteness: this.calculateProfileScore(user2),
      waitTime: Date.now() - (user2.connectionStartTime || Date.now())
    };
  }

  /**
   * Record successful match in Redis for history tracking
   */
  private async recordMatch(user1: User, user2: User): Promise<void> {
    if (!this.redisService) return;
    
    try {
      const matchData = {
        timestamp: Date.now(),
        user1Id: user1.id,
        user2Id: user2.id,
        user1AuthId: user1.authId,
        user2AuthId: user2.authId,
        chatType: user1.chatType,
        matchScore: this.calculateMatchScore(user1, user2, this.getDefaultPreferences())
      };
      
      // Record in both users' history
      const promises: Promise<any>[] = [];
      
      if (user1.authId) {
        const key1 = `${this.REDIS_MATCH_HISTORY_PREFIX}:${user1.authId}`;
        const historyEntry = {
          ...matchData,
          partnerId: user2.authId || user2.id,
          partnerName: user2.displayName || user2.username
        };
        
        promises.push(
          this.redisService.set(key1, JSON.stringify(historyEntry), 30 * 24 * 60 * 60) // 30 days
        );
      }
      
      if (user2.authId) {
        const key2 = `${this.REDIS_MATCH_HISTORY_PREFIX}:${user2.authId}`;
        const historyEntry = {
          ...matchData,
          partnerId: user1.authId || user1.id,
          partnerName: user1.displayName || user1.username
        };
        
        promises.push(
          this.redisService.set(key2, JSON.stringify(historyEntry), 30 * 24 * 60 * 60) // 30 days
        );
      }
      
      await Promise.allSettled(promises);
      logger.debug(`📝 Recorded match history for ${user1.id} ↔ ${user2.id}`);
    } catch (error) {
      logger.error('Failed to record match history:', error);
    }
  }

  /**
   * Update user preferences based on successful matches
   */
  private async updateUserPreferences(user: User, partner: User): Promise<void> {
    if (!this.redisService || !user.authId) return;
    
    try {
      const currentPrefs = await this.loadUserPreferences(user);
      
      // Update preferences based on successful match
      const updatedPrefs = {
        ...currentPrefs,
        lastSuccessfulMatch: Date.now(),
        // Add partner's interests to preferred interests with low weight
        preferredInterests: this.mergePreferredInterests(
          currentPrefs.preferredInterests || [], 
          partner.interests || []
        )
      };
      
      const key = `${this.REDIS_USER_PREFERENCES_PREFIX}:${user.authId}`;
      await this.redisService.set(key, updatedPrefs, 7 * 24 * 60 * 60); // 7 days
      
      logger.debug(`🎛️ Updated preferences for ${user.authId} based on successful match`);
    } catch (error) {
      logger.error(`Failed to update preferences for ${user.authId}:`, error);
    }
  }

  private mergePreferredInterests(current: string[], newInterests: string[]): string[] {
    const merged = [...current];
    newInterests.forEach(interest => {
      if (!merged.includes(interest)) {
        merged.push(interest);
      }
    });
    return merged.slice(0, 10); // Limit to 10 preferred interests
  }

  /**
   * Get all users from Redis queue (helper method)
   */
  private async getAllFromRedisQueue(chatType: 'text' | 'video'): Promise<User[]> {
    if (!this.redisService) return [];
    
    try {
      return await this.redisService.getAllFromQueue(chatType);
    } catch (error) {
      logger.error(`Failed to get all users from Redis ${chatType} queue:`, error);
      return [];
    }
  }

  /**
   * Check if user is still valid (not stale)
   */
  private isUserStillValid(user: User): boolean {
    const now = Date.now();
    const maxAge = 15 * 60 * 1000; // 15 minutes
    const userAge = now - (user.connectionStartTime || 0);
    
    return userAge < maxAge;
  }

  /**
   * Enhanced queue statistics with Redis data
   */
  async getEnhancedQueueStats() {
    const memoryStats = this.getQueueStats();
    
    if (!this.redisService) {
      return {
        ...memoryStats,
        redisEnabled: false,
        source: 'memory-only'
      };
    }
    
    try {
      const [textRedisLength, videoRedisLength] = await Promise.all([
        this.redisService.getQueueLength('text'),
        this.redisService.getQueueLength('video')
      ]);
      
      return {
        ...memoryStats,
        redisEnabled: true,
        redisQueues: {
          text: textRedisLength,
          video: videoRedisLength,
          total: textRedisLength + videoRedisLength
        },
        synchronization: {
          memoryVsRedis: {
            text: this.waitingUsers.text.length - textRedisLength,
            video: this.waitingUsers.video.length - videoRedisLength
          }
        },
        source: 'hybrid-memory-redis'
      };
    } catch (error) {
      logger.error('Failed to get Redis queue stats:', error);
      return {
        ...memoryStats,
        redisEnabled: false,
        redisError: error instanceof Error ? error.message : 'Unknown error',
        source: 'memory-fallback'
      };
    }
  }

  /**
   * Check if Redis is being used
   */
  isUsingRedis(): boolean {
    return this.redisService?.isRedisConnected() || false;
  }

  /**
   * Switch between Redis and memory-only mode
   */
  async switchMode(useRedis: boolean): Promise<boolean> {
    if (useRedis && this.redisService) {
      try {
        await this.syncQueuesFromRedis();
        logger.info('✅ Switched to Redis-backed matchmaking');
        return true;
      } catch (error) {
        logger.error('❌ Failed to switch to Redis mode:', error);
        return false;
      }
    } else if (!useRedis) {
      logger.info('✅ Switched to memory-only matchmaking');
      return true;
    }
    
    return false;
  }

  /**
   * Get queue health including Redis status
   */
  async getQueueHealth(): Promise<{
    healthy: boolean;
    issues: string[];
    redis: { connected: boolean; mode: string };
    performance: any;
  }> {
    const issues: string[] = [];
    const memoryQueueSize = this.waitingUsers.text.length + this.waitingUsers.video.length;
    
    // Check memory queue health
    if (memoryQueueSize > 100) {
      issues.push(`High memory queue size: ${memoryQueueSize}`);
    }
    
    // Check Redis health
    let redisStatus = { connected: false, mode: 'unavailable' };
    let performanceStats = null;
    
    if (this.redisService) {
      try {
        const connected = await this.redisService.testConnection();
        redisStatus = {
          connected,
          mode: connected ? 'redis-primary' : 'memory-fallback'
        };
        
        if (!connected) {
          issues.push('Redis connection failed - running in memory-only mode');
        }
        
        // Get performance stats
        performanceStats = await this.redisService.getRedisStats();
      } catch (error) {
        issues.push(`Redis health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return {
      healthy: issues.length === 0,
      issues,
      redis: redisStatus,
      performance: performanceStats
    };
  }

  /**
   * Clear all queues with Redis support
   */
  async clearAllQueues(): Promise<{ cleared: number }> {
    const memoryCleared = this.waitingUsers.text.length + this.waitingUsers.video.length;
    
    // Clear memory queues
    [...this.waitingUsers.text, ...this.waitingUsers.video].forEach(user => {
      this.trackUserDisconnection(user);
    });
    
    this.waitingUsers.text = [];
    this.waitingUsers.video = [];
    
    // Clear Redis queues
    let redisCleared = 0;
    if (this.redisService) {
      try {
        const result = await this.redisService.clearAllQueues();
        redisCleared = result.cleared;
        
        logger.info(`📋 Cleared Redis queues: ${redisCleared} users`);
      } catch (error) {
        logger.error('Failed to clear Redis queues:', error);
      }
    }
    
    const totalCleared = Math.max(memoryCleared, redisCleared);
    logger.warn(`🧹 EMERGENCY CLEAR: ${totalCleared} users removed from all queues`);
    
    return { cleared: totalCleared };
  }

  // Keep all the existing methods from the original implementation
private isValidMatchCandidate(currentUser: User, candidate: User): boolean {
  // ✅ FIXED: Basic ID check
  if (candidate.id === currentUser.id) {
    logger.debug(`❌ Blocked self-match by socket ID: ${candidate.id}`);
    return false;
  }
  
  // ✅ FIXED: Auth ID check
  if (currentUser.authId && candidate.authId && currentUser.authId === candidate.authId) {
    logger.debug(`❌ Blocked self-match by auth ID: ${candidate.authId}`);
    return false;
  }
  
  const currentTime = Date.now();
  const candidateAge = currentTime - (candidate.connectionStartTime || 0);
  const currentUserAge = currentTime - (currentUser.connectionStartTime || 0);
  
  // ✅ FIXED: More lenient connection time requirements
  const minConnectionTime = 500; // Reduced from 1000/2000ms
  
  if (candidateAge < minConnectionTime) {
    logger.debug(`❌ Blocked recent candidate connection: ${candidateAge}ms < ${minConnectionTime}ms`);
    return false;
  }
  
  if (currentUserAge < minConnectionTime) {
    logger.debug(`❌ Blocked recent current user connection: ${currentUserAge}ms < ${minConnectionTime}ms`);
    return false;
  }
  
  // ✅ FIXED: More lenient time difference check
  const timeDiff = Math.abs(candidateAge - currentUserAge);
  const maxTimeDiff = 2000; // Increased tolerance
  
  if (timeDiff < 100) { // Reduced from 500/1000ms - only block very rapid successive connections
    logger.debug(`❌ Blocked similar connection times: diff=${timeDiff}ms < 100ms`);
    return false;
  }
  
  return true;
}

  private trackUserDisconnection(user: User): void {
    const userId = user.authId || user.id;
    
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, {
        connectionHistory: [],
        lastActivity: Date.now()
      });
    }
    
    const session = this.userSessions.get(userId)!;
    session.connectionHistory.push({
      socketId: user.id,
      disconnectedAt: Date.now(),
      authId: user.authId
    });
    
    if (session.connectionHistory.length > 10) {
      session.connectionHistory = session.connectionHistory.slice(-5);
    }
  }

  // Keep all other existing methods (getQueueStats, forceMatch, etc.)
  getQueueStats() {
    const textQueue = this.waitingUsers.text;
    const videoQueue = this.waitingUsers.video;
    
    const now = Date.now();
    const textWaitTimes = textQueue.map(u => now - (u.connectionStartTime || now));
    const videoWaitTimes = videoQueue.map(u => now - (u.connectionStartTime || now));
    
    const avgTextWait = textWaitTimes.length > 0 
      ? textWaitTimes.reduce((a, b) => a + b, 0) / textWaitTimes.length 
      : 0;
    
    const avgVideoWait = videoWaitTimes.length > 0 
      ? videoWaitTimes.reduce((a, b) => a + b, 0) / videoWaitTimes.length 
      : 0;

    const oldestTextWait = textWaitTimes.length > 0 ? Math.max(...textWaitTimes) : 0;
    const oldestVideoWait = videoWaitTimes.length > 0 ? Math.max(...videoWaitTimes) : 0;

    return {
      text: textQueue.length,
      video: videoQueue.length,
      totalWaiting: textQueue.length + videoQueue.length,
      averageWaitTime: Math.round((avgTextWait + avgVideoWait) / 2 / 1000),
      textWaitTime: Math.round(avgTextWait / 1000),
      videoWaitTime: Math.round(avgVideoWait / 1000),
      oldestTextWait: Math.round(oldestTextWait / 1000),
      oldestVideoWait: Math.round(oldestVideoWait / 1000),
      authUsers: {
        text: textQueue.filter(u => u.authId).length,
        video: videoQueue.filter(u => u.authId).length
      },
      anonymousUsers: {
        text: textQueue.filter(u => !u.authId).length,
        video: videoQueue.filter(u => !u.authId).length
      }
    };
  }

  getQueueDetails() {
    const now = Date.now();
    
    return {
      text: this.waitingUsers.text.map(u => ({
        id: u.id,
        authId: u.authId,
        interests: u.interests,
        waitTime: now - (u.connectionStartTime || now),
        connectionStartTime: u.connectionStartTime,
        status: u.status,
        hasProfile: !!(u.displayName || u.avatarUrl)
      })),
      video: this.waitingUsers.video.map(u => ({
        id: u.id,
        authId: u.authId,
        interests: u.interests,
        waitTime: now - (u.connectionStartTime || now),
        connectionStartTime: u.connectionStartTime,
        status: u.status,
        hasProfile: !!(u.displayName || u.avatarUrl)
      }))
    };
  }

  forceMatch(chatType: 'text' | 'video'): { user1: User; user2: User } | null {
    const queue = this.waitingUsers[chatType];
    
    if (queue.length >= 2) {
      const sortedQueue = [...queue].sort((a, b) => 
        (a.connectionStartTime || 0) - (b.connectionStartTime || 0)
      );
      
      let user1: User | null = null;
      let user2: User | null = null;
      
      for (let i = 0; i < sortedQueue.length; i++) {
        for (let j = i + 1; j < sortedQueue.length; j++) {
          const candidateUser1 = sortedQueue[i];
          const candidateUser2 = sortedQueue[j];
          
          if (this.performFinalValidation(candidateUser1, candidateUser2).valid) {
            user1 = candidateUser1;
            user2 = candidateUser2;
            break;
          }
        }
        if (user1 && user2) break;
      }
      
      if (user1 && user2) {
        // Use async removal but don't wait for it in this synchronous method
        this.removeUserFromAllQueues(user1.id).catch(err => 
          logger.error('Failed to remove user1 in force match:', err)
        );
        this.removeUserFromAllQueues(user2.id).catch(err => 
          logger.error('Failed to remove user2 in force match:', err)
        );
        
        logger.warn(`🔧 FORCE MATCH: ${user1.id} ↔ ${user2.id} (${chatType})`);
        return { user1, user2 };
      }
    }
    
    logger.warn(`🔧 Force match failed: insufficient valid users in ${chatType} queue`);
    return null;
  }

  private performFinalValidation(user1: User, user2: User): { valid: boolean; reason?: string } {
    if (user1.id === user2.id) {
      return { valid: false, reason: `Same socket ID: ${user1.id}` };
    }
    
    if (user1.authId && user2.authId && user1.authId === user2.authId) {
      return { valid: false, reason: `Same auth ID: ${user1.authId}` };
    }
    
    if (!user1.id || !user2.id) {
      return { valid: false, reason: 'Invalid user IDs' };
    }
    
    return { valid: true };
  }
}