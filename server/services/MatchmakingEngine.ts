// server/services/MatchmakingEngine.ts - ENHANCED WITH SMART REDIS INTEGRATION

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

  /**
   * Enhanced find match with Redis-backed user preferences and history
   */
  async findMatch(currentUser: User): Promise<User | null> {
    logger.info(`🎯 ENHANCED MATCHMAKING: ${currentUser.id} (${currentUser.authId || 'anonymous'}) - ${currentUser.chatType} chat`);
    
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
      // Remove from both memory and Redis
      await this.removeUserFromQueues(selectedPartner.id);
      
      // Record the match in history
      await this.recordMatch(currentUser, selectedPartner);
      
      // Update user preferences based on successful match
      await this.updateUserPreferences(currentUser, selectedPartner);
      
      logger.info(`✅ ENHANCED MATCH: ${currentUser.id} ↔ ${selectedPartner.id} (${currentUser.chatType})`, {
        matchScore: this.calculateMatchScore(currentUser, selectedPartner, userPrefs),
        preferenceFactors: this.getPreferenceFactors(currentUser, selectedPartner, userPrefs)
      });
      
      return selectedPartner;
    }

    return null;
  }

  /**
   * Load user preferences from Redis with fallback to defaults
   */
  private async loadUserPreferences(user: User): Promise<any> {
    if (!this.redisService || !user.authId) {
      return this.getDefaultPreferences();
    }
    
    try {
      const key = `${this.REDIS_USER_PREFERENCES_PREFIX}:${user.authId}`;
      const redisInstance = this.redisService.getRedisInstance();
      const cached = await redisInstance.get(key);
      
      if (cached) {
        const prefs = JSON.parse(cached);
        logger.debug(`🎛️ Loaded preferences for ${user.authId}`);
        return { ...this.getDefaultPreferences(), ...prefs };
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
      avoidRecentMatches: true,
      recentMatchWindow: 30 * 60 * 1000, // 30 minutes
      preferAuthenticatedUsers: false,
      interestMatchWeight: 0.3,
      activityLevelPreference: 'any', // 'low', 'medium', 'high', 'any'
      maxWaitTimePreference: 5 * 60 * 1000, // 5 minutes
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
      const redisInstance = this.redisService.getRedisInstance();
      const history = await redisInstance.lrange(key, 0, 9); // Last 10 matches
      
      return history.map(entry => {
        try {
          const match = JSON.parse(entry);
          return match.partnerId;
        } catch {
          return '';
        }
      }).filter(Boolean);
    } catch (error) {
      logger.error(`Failed to get match history for ${user.authId}:`, error);
      return [];
    }
  }

  /**
   * Get candidates with enhanced filtering based on preferences
   */
  private async getCandidatesWithPreferences(
    currentUser: User, 
    userPrefs: any, 
    matchHistory: string[]
  ): Promise<User[]> {
    // Get candidates from memory queue
    const memoryQueue = this.waitingUsers[currentUser.chatType];
    
    // Get candidates from Redis queue if available
    let redisCandidates: User[] = [];
    if (this.redisService) {
      redisCandidates = await this.getAllFromRedisQueue(currentUser.chatType);
    }
    
    // Combine and deduplicate candidates
    const allCandidates = this.deduplicateCandidates([...memoryQueue, ...redisCandidates]);
    
    // Apply enhanced filtering
    return allCandidates.filter(candidate => {
      // Basic validation (from original code)
      if (!this.isValidMatchCandidate(currentUser, candidate)) {
        return false;
      }
      
      // Avoid recent matches if preference is set
      if (userPrefs.avoidRecentMatches && matchHistory.includes(candidate.authId || candidate.id)) {
        logger.debug(`❌ Avoiding recent match: ${candidate.id}`);
        return false;
      }
      
      // Preference for authenticated users
      if (userPrefs.preferAuthenticatedUsers && !candidate.authId) {
        logger.debug(`❌ Preferring authenticated users: ${candidate.id} is anonymous`);
        return false;
      }
      
      // Check wait time preference
      const candidateWaitTime = Date.now() - (candidate.connectionStartTime || Date.now());
      if (candidateWaitTime > userPrefs.maxWaitTimePreference) {
        logger.debug(`❌ Candidate waited too long: ${candidateWaitTime}ms > ${userPrefs.maxWaitTimePreference}ms`);
        return false;
      }
      
      return true;
    });
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
   * Enhanced queue management with Redis persistence
   */
  async addToWaitingList(user: User): Promise<void> {
    // Add to memory queue (existing logic)
    this.removeFromWaitingLists(user.id);
    
    if (!user.id || !user.chatType) {
      logger.error(`❌ Invalid user data for addToWaitingList:`, {
        id: user.id,
        chatType: user.chatType,
        authId: user.authId
      });
      return;
    }
    
    // Deduplication and validation (existing logic)
    if (user.authId) {
      (['text', 'video'] as const).forEach(type => {
        const existingUserIndex = this.waitingUsers[type].findIndex(u => 
          u.authId === user.authId
        );
        if (existingUserIndex !== -1) {
          const existingUser = this.waitingUsers[type][existingUserIndex];
          logger.warn(`🔄 Removing duplicate auth user: ${existingUser?.id} with authId ${user.authId} from ${type} queue`);
          this.waitingUsers[type].splice(existingUserIndex, 1);
        }
      });
    }
    
    if (!user.connectionStartTime) {
      user.connectionStartTime = Date.now();
    }
    
    // Add to memory queue
    this.waitingUsers[user.chatType].push(user);
    
    // Add to Redis queue for persistence
    if (this.redisService) {
      try {
        await this.redisService.addToQueue(user.chatType, user);
        logger.debug(`📋 Added user ${user.id} to Redis ${user.chatType} queue`);
      } catch (error) {
        logger.error(`Failed to add user to Redis queue:`, error);
        // Continue without Redis - graceful degradation
      }
    }
    
    logger.info(`➕ ENHANCED QUEUED: ${user.id} (${user.authId || 'anonymous'}) to ${user.chatType} queue. Memory: ${this.waitingUsers[user.chatType].length}`);
  }

  /**
   * Remove user from all queues (memory + Redis)
   */
  async removeUserFromQueues(socketId: string): Promise<void> {
    let totalRemoved = 0;
    let removedUser: User | null = null;
    
    // Remove from memory queues
    (['text', 'video'] as const).forEach(type => {
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
    });
    
    // Remove from Redis queues
    if (this.redisService) {
      try {
        await Promise.all([
          this.redisService.removeFromQueue('text', socketId),
          this.redisService.removeFromQueue('video', socketId)
        ]);
        logger.debug(`📋 Removed ${socketId} from Redis queues`);
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
      
      const redisInstance = this.redisService.getRedisInstance();
      
      // Record in both users' history
      if (user1.authId) {
        const key1 = `${this.REDIS_MATCH_HISTORY_PREFIX}:${user1.authId}`;
        await redisInstance.lpush(key1, JSON.stringify({
          ...matchData,
          partnerId: user2.authId || user2.id,
          partnerName: user2.displayName || user2.username
        }));
        await redisInstance.ltrim(key1, 0, 19); // Keep last 20 matches
        await redisInstance.expire(key1, 30 * 24 * 60 * 60); // 30 days
      }
      
      if (user2.authId) {
        const key2 = `${this.REDIS_MATCH_HISTORY_PREFIX}:${user2.authId}`;
        await redisInstance.lpush(key2, JSON.stringify({
          ...matchData,
          partnerId: user1.authId || user1.id,
          partnerName: user1.displayName || user1.username
        }));
        await redisInstance.ltrim(key2, 0, 19); // Keep last 20 matches
        await redisInstance.expire(key2, 30 * 24 * 60 * 60); // 30 days
      }
      
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
      const redisInstance = this.redisService.getRedisInstance();
      await redisInstance.setex(key, 7 * 24 * 60 * 60, JSON.stringify(updatedPrefs)); // 7 days
      
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
      const redisInstance = this.redisService.getRedisInstance();
      const queueKey = `queue:${chatType}`;
      const items = await redisInstance.lrange(queueKey, 0, -1);
      
      return items.map(item => {
        try {
          return JSON.parse(item) as User;
        } catch {
          return null;
        }
      }).filter((user): user is User => user !== null);
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
        const redisInstance = this.redisService.getRedisInstance();
        const [textLength, videoLength] = await Promise.all([
          redisInstance.llen('queue:text'),
          redisInstance.llen('queue:video')
        ]);
        
        redisCleared = textLength + videoLength;
        
        await Promise.all([
          redisInstance.del('queue:text'),
          redisInstance.del('queue:video')
        ]);
        
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
    // [Keep the existing validation logic from your original code]
    if (candidate.id === currentUser.id) {
      logger.debug(`❌ Blocked self-match by socket ID: ${candidate.id}`);
      return false;
    }
    
    if (currentUser.authId && candidate.authId && currentUser.authId === candidate.authId) {
      logger.debug(`❌ Blocked self-match by auth ID: ${candidate.authId}`);
      return false;
    }
    
    const currentTime = Date.now();
    const candidateAge = currentTime - (candidate.connectionStartTime || 0);
    const currentUserAge = currentTime - (currentUser.connectionStartTime || 0);
    
    const minConnectionTime = (currentUser.authId || candidate.authId) ? 2000 : 1000;
    
    if (candidateAge < minConnectionTime) {
      logger.debug(`❌ Blocked recent candidate connection: ${candidateAge}ms < ${minConnectionTime}ms`);
      return false;
    }
    
    if (currentUserAge < minConnectionTime) {
      logger.debug(`❌ Blocked recent current user connection: ${currentUserAge}ms < ${minConnectionTime}ms`);
      return false;
    }
    
    const timeDiff = Math.abs(candidateAge - currentUserAge);
    const maxTimeDiff = (currentUser.authId || candidate.authId) ? 1000 : 500;
    
    if (timeDiff < maxTimeDiff) {
      logger.debug(`❌ Blocked similar connection times: diff=${timeDiff}ms < ${maxTimeDiff}ms`);
      return false;
    }
    
    return true;
  }

  private trackUserDisconnection(user: User): void {
    // [Keep existing tracking logic]
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

  // Keep all other existing methods (getQueueStats, cleanupStaleUsers, etc.)
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

  removeFromWaitingLists(socketId: string): void {
    // For backward compatibility - calls the async version
    this.removeUserFromQueues(socketId).catch(error => {
      logger.error(`Error in removeFromWaitingLists for ${socketId}:`, error);
    });
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
        this.removeUserFromQueues(user1.id);
        this.removeUserFromQueues(user2.id);
        
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

  cleanupStaleUsers(isConnectedCheck: (socketId: string) => boolean): void {
    let totalRemoved = 0;
    const now = Date.now();
    const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes
    
    (['text', 'video'] as const).forEach(type => {
      const originalLength = this.waitingUsers[type].length;
      
      this.waitingUsers[type] = this.waitingUsers[type].filter(user => {
        const isConnected = isConnectedCheck(user.id);
        const waitTime = now - (user.connectionStartTime || now);
        const isStale = waitTime > STALE_THRESHOLD;
        
        if (!isConnected) {
          logger.debug(`🧹 Removing disconnected user: ${user.id} from ${type} queue`);
          this.trackUserDisconnection(user);
          
          // Also remove from Redis if available
          if (this.redisService) {
            this.redisService.removeFromQueue(type, user.id).catch(err =>
              logger.debug(`Failed to remove ${user.id} from Redis:`, err)
            );
          }
          return false;
        }
        
        if (isStale) {
          logger.warn(`⏰ Removing stale user: ${user.id} (waited ${Math.round(waitTime / 1000)}s) from ${type} queue`);
          this.trackUserDisconnection(user);
          
          // Also remove from Redis if available
          if (this.redisService) {
            this.redisService.removeFromQueue(type, user.id).catch(err =>
              logger.debug(`Failed to remove stale ${user.id} from Redis:`, err)
            );
          }
          return false;
        }
        
        return true;
      });
      
      const removedCount = originalLength - this.waitingUsers[type].length;
      totalRemoved += removedCount;
    });
    
    if (totalRemoved > 0) {
      logger.info(`🧹 Enhanced cleanup completed: ${totalRemoved} stale users removed from memory and Redis`);
    }
  }
}