// server/services/MatchmakingEngine.ts - CRITICAL SELF-MATCH PREVENTION FIX
import { logger } from '../utils/logger';
import { User } from '../types/User';

export class MatchmakingEngine {
  private waitingUsers: { [key in 'text' | 'video']: User[] } = {
    text: [],
    video: [],
  };

  // Track user sessions to prevent rapid reconnect self-matching
  private userSessions = new Map<string, {
    connectionHistory: Array<{
      socketId: string;
      disconnectedAt: number;
      authId: string | null;
    }>;
    lastActivity: number;
  }>();

  // ✅ CRITICAL FIX: Multi-layer self-match prevention
  findMatch(currentUser: User): User | null {
    logger.info(`🎯 MATCHMAKING REQUEST: ${currentUser.id} (${currentUser.authId || 'anonymous'}) - ${currentUser.chatType} chat`);
    
    const queue = this.waitingUsers[currentUser.chatType];
    
    // ✅ CRITICAL: Enhanced validation with multiple protection layers
    const candidates = queue.filter(candidate => this.isValidMatchCandidate(currentUser, candidate));
    
    logger.info(`🔍 FILTERING RESULTS: ${candidates.length} valid candidates from ${queue.length} total queue`);
    
    // Enhanced debugging for empty results
    if (candidates.length === 0 && queue.length > 0) {
      logger.warn(`🚨 NO MATCHES - Debugging queue:`);
      queue.forEach((user, index) => {
        const age = Date.now() - (user.connectionStartTime || 0);
        const issues = this.getMatchingIssues(currentUser, user);
        logger.warn(`   Queue[${index}]: ${user.id.substr(0,8)}, auth=${user.authId?.substr(0,8) || 'none'}, age=${age}ms, issues=[${issues.join(', ')}]`);
      });
    }
    
    if (candidates.length === 0) {
      return null;
    }

    // ✅ CRITICAL: Take oldest waiting candidate for fairness
    const selectedPartner = candidates.sort((a, b) => 
      (a.connectionStartTime || 0) - (b.connectionStartTime || 0)
    )[0];
    
    if (selectedPartner) {
      // ✅ CRITICAL: Remove partner from queue BEFORE final validation
      const partnerIndex = queue.findIndex(u => u.id === selectedPartner.id);
      if (partnerIndex !== -1) {
        queue.splice(partnerIndex, 1);
        
        // ✅ FINAL VALIDATION: Absolutely prevent self-matching
        const finalValidation = this.performFinalValidation(currentUser, selectedPartner);
        if (!finalValidation.valid) {
          logger.error(`❌ CRITICAL ERROR: Final validation failed - ${finalValidation.reason}`);
          // Put partner back in queue and return null
          queue.push(selectedPartner);
          return null;
        }
        
        // Track successful match to prevent future self-matching
        this.trackMatchForUser(currentUser);
        this.trackMatchForUser(selectedPartner);
        
        logger.info(`✅ MATCH CREATED: ${currentUser.id} ↔ ${selectedPartner.id} (${currentUser.chatType})`, {
          currentUserWaitTime: Date.now() - (currentUser.connectionStartTime || Date.now()),
          partnerWaitTime: Date.now() - (selectedPartner.connectionStartTime || Date.now()),
          queueSizeAfter: queue.length,
          validationLayers: 'all-passed'
        });
        
        return selectedPartner;
      } else {
        logger.error(`❌ Selected partner ${selectedPartner.id} not found in queue during removal`);
        return null;
      }
    }

    return null;
  }

  // ✅ CRITICAL: Comprehensive match validation
  private isValidMatchCandidate(currentUser: User, candidate: User): boolean {
    // Layer 1: Socket ID validation (primary protection)
    if (candidate.id === currentUser.id) {
      logger.debug(`❌ Blocked self-match by socket ID: ${candidate.id}`);
      return false;
    }
    
    // Layer 2: Auth ID validation (secondary protection)
    if (currentUser.authId && candidate.authId && currentUser.authId === candidate.authId) {
      logger.debug(`❌ Blocked self-match by auth ID: ${candidate.authId}`);
      return false;
    }
    
    // Layer 3: Connection time validation (prevent rapid reconnect self-match)
    const currentTime = Date.now();
    const candidateAge = currentTime - (candidate.connectionStartTime || 0);
    const currentUserAge = currentTime - (currentUser.connectionStartTime || 0);
    
    // Both users must be connected for at least 2 seconds
    if (candidateAge < 2000 || currentUserAge < 2000) {
      logger.debug(`❌ Blocked recent connection: candidate=${candidateAge}ms, current=${currentUserAge}ms`);
      return false;
    }
    
    // Layer 4: Prevent matching users with very similar connection times (same session)
    const timeDiff = Math.abs(candidateAge - currentUserAge);
    if (timeDiff < 1000) {
      logger.debug(`❌ Blocked similar connection times: diff=${timeDiff}ms`);
      return false;
    }
    
    // Layer 5: Check for recent reconnection history
    if (this.isRecentReconnection(currentUser, candidate)) {
      logger.debug(`❌ Blocked recent reconnection pattern`);
      return false;
    }
    
    // Layer 6: Device fingerprint check (if available)
    if (this.hasSameDeviceFingerprint(currentUser, candidate)) {
      logger.debug(`❌ Blocked same device fingerprint`);
      return false;
    }
    
    logger.debug(`✅ Valid candidate: ${candidate.id}, age=${candidateAge}ms`);
    return true;
  }

  // ✅ ENHANCED: Check for recent reconnection patterns
  private isRecentReconnection(user1: User, user2: User): boolean {
    const reconnectionWindow = 30000; // 30 seconds
    const now = Date.now();
    
    // Check if either user recently had a connection with similar timing
    const user1History = this.userSessions.get(user1.authId || user1.id)?.connectionHistory || [];
    const user2History = this.userSessions.get(user2.authId || user2.id)?.connectionHistory || [];
    
    // Check if either user recently disconnected and reconnected
    const hasRecentDisconnect = (history: any[]) => {
      return history.some(conn => 
        now - conn.disconnectedAt < reconnectionWindow
      );
    };
    
    return hasRecentDisconnect(user1History) || hasRecentDisconnect(user2History);
  }

  // ✅ ENHANCED: Device fingerprint comparison
  private hasSameDeviceFingerprint(user1: User, user2: User): boolean {
    // In a real implementation, you would check:
    // - Browser fingerprint
    // - Screen resolution
    // - Timezone
    // - Language settings
    // For now, we'll use a simple IP-based check if available
    
    // This would be enhanced with actual device fingerprinting
    return false; // Placeholder - implement based on your fingerprinting strategy
  }

  // ✅ CRITICAL: Final validation before match creation
  private performFinalValidation(user1: User, user2: User): { valid: boolean; reason?: string } {
    // Absolute final checks
    if (user1.id === user2.id) {
      return { valid: false, reason: `Same socket ID: ${user1.id}` };
    }
    
    if (user1.authId && user2.authId && user1.authId === user2.authId) {
      return { valid: false, reason: `Same auth ID: ${user1.authId}` };
    }
    
    // Check if both users are still valid/connected
    if (!user1.id || !user2.id) {
      return { valid: false, reason: 'Invalid user IDs' };
    }
    
    return { valid: true };
  }

  // ✅ ENHANCED: Track user sessions for better prevention
  private trackMatchForUser(user: User): void {
    const userId = user.authId || user.id;
    
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, {
        connectionHistory: [],
        lastActivity: Date.now()
      });
    }
    
    const session = this.userSessions.get(userId)!;
    session.lastActivity = Date.now();
    
    // Keep history size manageable
    if (session.connectionHistory.length > 10) {
      session.connectionHistory = session.connectionHistory.slice(-5);
    }
  }

  // ✅ ENHANCED: Get detailed matching issues for debugging
  private getMatchingIssues(currentUser: User, candidate: User): string[] {
    const issues: string[] = [];
    
    if (candidate.id === currentUser.id) {
      issues.push('same-socket-id');
    }
    
    if (currentUser.authId && candidate.authId && currentUser.authId === candidate.authId) {
      issues.push('same-auth-id');
    }
    
    const currentTime = Date.now();
    const candidateAge = currentTime - (candidate.connectionStartTime || 0);
    const currentUserAge = currentTime - (currentUser.connectionStartTime || 0);
    
    if (candidateAge < 2000) {
      issues.push('candidate-too-recent');
    }
    
    if (currentUserAge < 2000) {
      issues.push('current-user-too-recent');
    }
    
    const timeDiff = Math.abs(candidateAge - currentUserAge);
    if (timeDiff < 1000) {
      issues.push('similar-connection-times');
    }
    
    if (this.isRecentReconnection(currentUser, candidate)) {
      issues.push('recent-reconnection');
    }
    
    return issues;
  }

  // ✅ ENHANCED: Better queue management with comprehensive deduplication
  addToWaitingList(user: User): void {
    // Step 1: Remove user from ALL queues first (prevent duplicates)
    this.removeFromWaitingLists(user.id);
    
    // Step 2: Validate user data
    if (!user.id || !user.chatType) {
      logger.error(`❌ Invalid user data for addToWaitingList:`, {
        id: user.id,
        chatType: user.chatType,
        authId: user.authId
      });
      return;
    }
    
    // Step 3: Check for auth ID duplicates across ALL queues
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
    
    // Step 4: Set connection start time if not provided
    if (!user.connectionStartTime) {
      user.connectionStartTime = Date.now();
    }
    
    // Step 5: Prevent queue overflow
    const currentQueueSize = this.waitingUsers[user.chatType].length;
    if (currentQueueSize > 50) {
      logger.warn(`⚠️ Queue size limit reached for ${user.chatType}, removing oldest user`);
      const removedUser = this.waitingUsers[user.chatType].shift();
      if (removedUser) {
        this.trackUserDisconnection(removedUser);
      }
    }
    
    // Step 6: Add user to queue
    this.waitingUsers[user.chatType].push(user);
    
    logger.info(`➕ QUEUED: ${user.id} (${user.authId || 'anonymous'}) to ${user.chatType} queue. Queue size: ${this.waitingUsers[user.chatType].length}`);
  }

  // ✅ ENHANCED: Track user disconnections for better session management
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
    
    // Keep history manageable
    if (session.connectionHistory.length > 10) {
      session.connectionHistory = session.connectionHistory.slice(-5);
    }
  }

  // ✅ ENHANCED: Comprehensive removal with logging
  removeFromWaitingLists(socketId: string): void {
    let totalRemoved = 0;
    let removedUser: User | null = null;
    
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
        logger.warn(`⚠️ Removed ${removed} duplicate entries for ${socketId} from ${type} queue`);
      }
    });
    
    if (totalRemoved > 0) {
      logger.debug(`🧹 Removed ${totalRemoved} total entries for ${socketId}`);
      
      // Track disconnection for session management
      if (removedUser) {
        this.trackUserDisconnection(removedUser);
      }
    }
  }

  // ✅ ENHANCED: Better statistics with more detail
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

  // ✅ ENHANCED: Stale user cleanup with connection validation
  cleanupStaleUsers(isConnectedCheck: (socketId: string) => boolean): void {
    let totalRemoved = 0;
    const now = Date.now();
    const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes
    
    (['text', 'video'] as const).forEach(type => {
      const originalLength = this.waitingUsers[type].length;
      
      this.waitingUsers[type] = this.waitingUsers[type].filter(user => {
        // Check if socket is still connected
        const isConnected = isConnectedCheck(user.id);
        const waitTime = now - (user.connectionStartTime || now);
        const isStale = waitTime > STALE_THRESHOLD;
        
        if (!isConnected) {
          logger.debug(`🧹 Removing disconnected user: ${user.id} from ${type} queue`);
          this.trackUserDisconnection(user);
          return false;
        }
        
        if (isStale) {
          logger.warn(`⏰ Removing stale user: ${user.id} (waited ${Math.round(waitTime / 1000)}s) from ${type} queue`);
          this.trackUserDisconnection(user);
          return false;
        }
        
        return true;
      });
      
      const removedCount = originalLength - this.waitingUsers[type].length;
      totalRemoved += removedCount;
    });
    
    if (totalRemoved > 0) {
      logger.info(`🧹 Cleanup completed: ${totalRemoved} stale users removed`);
    }
    
    // Clean up old session data
    this.cleanupOldSessions();
  }

  // ✅ ENHANCED: Clean up old session data
  private cleanupOldSessions(): void {
    const now = Date.now();
    const SESSION_CLEANUP_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [userId, session] of this.userSessions.entries()) {
      if (now - session.lastActivity > SESSION_CLEANUP_THRESHOLD) {
        this.userSessions.delete(userId);
      } else {
        // Clean up old connection history
        session.connectionHistory = session.connectionHistory.filter(
          conn => now - conn.disconnectedAt < 60 * 60 * 1000 // Keep 1 hour of history
        );
      }
    }
  }

  // ✅ Get detailed queue information for debugging
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

  // ✅ Force match for debugging with enhanced validation
  forceMatch(chatType: 'text' | 'video'): { user1: User; user2: User } | null {
    const queue = this.waitingUsers[chatType];
    
    if (queue.length >= 2) {
      // Find two different users (prevent self-matching even in force mode)
      const sortedQueue = [...queue].sort((a, b) => 
        (a.connectionStartTime || 0) - (b.connectionStartTime || 0)
      );
      
      let user1: User | null = null;
      let user2: User | null = null;
      
      for (let i = 0; i < sortedQueue.length; i++) {
        for (let j = i + 1; j < sortedQueue.length; j++) {
          const candidateUser1 = sortedQueue[i];
          const candidateUser2 = sortedQueue[j];
          
          // Ensure they are different users with comprehensive validation
          const validation = this.performFinalValidation(candidateUser1, candidateUser2);
          if (validation.valid) {
            user1 = candidateUser1;
            user2 = candidateUser2;
            break;
          }
        }
        if (user1 && user2) break;
      }
      
      if (user1 && user2) {
        // Remove both users from queue
        this.removeFromWaitingLists(user1.id);
        this.removeFromWaitingLists(user2.id);
        
        logger.warn(`🔧 FORCE MATCH: ${user1.id} ↔ ${user2.id} (${chatType})`);
        return { user1, user2 };
      }
    }
    
    logger.warn(`🔧 Force match failed: insufficient valid users in ${chatType} queue (${queue.length} total)`);
    return null;
  }

  // ✅ Queue health check
  getQueueHealth(): {
    healthy: boolean;
    issues: string[];
    metrics: {
      totalUsers: number;
      oldestWaitTime: number;
      duplicateUsers: number;
      staleUsers: number;
      sessionTracking: number;
    };
  } {
    const issues: string[] = [];
    const now = Date.now();
    
    let totalUsers = 0;
    let oldestWaitTime = 0;
    let duplicateUsers = 0;
    let staleUsers = 0;
    
    (['text', 'video'] as const).forEach(type => {
      const queue = this.waitingUsers[type];
      totalUsers += queue.length;
      
      // Check for duplicates
      const seenIds = new Set<string>();
      const seenAuthIds = new Set<string>();
      
      queue.forEach(user => {
        // Check socket ID duplicates
        if (seenIds.has(user.id)) {
          duplicateUsers++;
          issues.push(`Duplicate socket ID ${user.id} in ${type} queue`);
        }
        seenIds.add(user.id);
        
        // Check auth ID duplicates
        if (user.authId && seenAuthIds.has(user.authId)) {
          duplicateUsers++;
          issues.push(`Duplicate auth ID ${user.authId} in ${type} queue`);
        }
        if (user.authId) seenAuthIds.add(user.authId);
        
        // Check wait times
        const waitTime = now - (user.connectionStartTime || now);
        oldestWaitTime = Math.max(oldestWaitTime, waitTime);
        
        if (waitTime > 5 * 60 * 1000) { // 5 minutes
          staleUsers++;
          if (waitTime > 10 * 60 * 1000) { // 10 minutes - critical
            issues.push(`User ${user.id} waiting ${Math.round(waitTime / 1000)}s in ${type} queue`);
          }
        }
      });
      
      if (queue.length > 15) {
        issues.push(`High queue size: ${queue.length} users in ${type} queue`);
      }
    });
    
    return {
      healthy: issues.length === 0,
      issues,
      metrics: {
        totalUsers,
        oldestWaitTime: Math.round(oldestWaitTime / 1000),
        duplicateUsers,
        staleUsers,
        sessionTracking: this.userSessions.size
      }
    };
  }

  // ✅ Clear all queues (emergency)
  clearAllQueues(): { cleared: number } {
    const totalCleared = this.waitingUsers.text.length + this.waitingUsers.video.length;
    
    // Track disconnections for all users
    [...this.waitingUsers.text, ...this.waitingUsers.video].forEach(user => {
      this.trackUserDisconnection(user);
    });
    
    this.waitingUsers.text = [];
    this.waitingUsers.video = [];
    
    logger.warn(`🧹 EMERGENCY: Cleared all queues - ${totalCleared} users removed`);
    return { cleared: totalCleared };
  }
}