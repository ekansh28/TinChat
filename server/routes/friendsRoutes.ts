// server/routes/friendsRoutes.ts - COMPLETE FRIENDS API ROUTES
import { IncomingMessage, ServerResponse } from 'http';
import { ProfileManager } from '../managers/profile/ProfileManager';
import { logger } from '../utils/logger';
import { URL } from 'url';

let profileManager: ProfileManager | null = null;

export function setFriendsProfileManager(manager: ProfileManager): void {
  profileManager = manager;
  logger.info('📡 Friends API routes configured with ProfileManager');
}

// Helper function to parse JSON body
async function parseRequestBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Helper function to send JSON response
function sendJSON(res: ServerResponse, statusCode: number, data: any): void {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
  });
  res.end(JSON.stringify(data));
}

// Helper function to send error response
function sendError(res: ServerResponse, statusCode: number, message: string, details?: any): void {
  logger.error(`Friends API Error ${statusCode}: ${message}`, details);
  sendJSON(res, statusCode, {
    success: false,
    message,
    ...(details && { details })
  });
}

export async function handleFriendsRoutes(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (!req.url?.startsWith('/api/friends')) {
    return false;
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const method = req.method;

    logger.debug(`📡 Friends API: ${method} ${pathname}`);

    // Health check endpoint
    if (pathname === '/api/friends/health') {
      if (method === 'GET') {
        return await handleHealthCheck(req, res);
      }
    }

    // Get user's friends list
    if (pathname.match(/^\/api\/friends\/([^\/]+)$/)) {
      if (method === 'GET') {
        return await handleGetFriends(req, res, pathname);
      }
    }

    // Batch get online status
    if (pathname === '/api/friends/batch-status') {
      if (method === 'POST') {
        return await handleBatchStatus(req, res);
      }
    }

    // Get last messages for friends
    if (pathname === '/api/friends/last-messages') {
      if (method === 'POST') {
        return await handleLastMessages(req, res);
      }
    }

    // Send friend request
    if (pathname === '/api/friends/send-request') {
      if (method === 'POST') {
        return await handleSendFriendRequest(req, res);
      }
    }

    // Accept friend request
    if (pathname === '/api/friends/accept-request') {
      if (method === 'POST') {
        return await handleAcceptFriendRequest(req, res);
      }
    }

    // Decline friend request
    if (pathname === '/api/friends/decline-request') {
      if (method === 'POST') {
        return await handleDeclineFriendRequest(req, res);
      }
    }

    // Remove friend
    if (pathname === '/api/friends/remove') {
      if (method === 'POST') {
        return await handleRemoveFriend(req, res);
      }
    }

    // Get pending friend requests
    if (pathname.match(/^\/api\/friends\/([^\/]+)\/requests$/)) {
      if (method === 'GET') {
        return await handleGetFriendRequests(req, res, pathname);
      }
    }

    // Get friendship status between two users
    if (pathname === '/api/friends/status') {
      if (method === 'POST') {
        return await handleGetFriendshipStatus(req, res);
      }
    }

    // Search users to add as friends
    if (pathname === '/api/friends/search') {
      if (method === 'POST') {
        return await handleSearchUsers(req, res);
      }
    }

    // Get friend statistics
    if (pathname.match(/^\/api\/friends\/([^\/]+)\/stats$/)) {
      if (method === 'GET') {
        return await handleGetFriendStats(req, res, pathname);
      }
    }

    // Route not found
    sendError(res, 404, 'Friends API endpoint not found');
    return true;

  } catch (error) {
    logger.error('❌ Friends API handler error:', error);
    sendError(res, 500, 'Internal server error', { error: error instanceof Error ? error.message : 'Unknown error' });
    return true;
  }
}

// ==================== ROUTE HANDLERS ====================

async function handleHealthCheck(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  try {
    logger.info('🔍 Friends API: Running health check...');
    
    if (!profileManager) {
      logger.warn('⚠️ Friends API: ProfileManager not initialized');
      sendJSON(res, 200, {
        success: false,
        message: 'ProfileManager not initialized',
        status: 'degraded',
        timestamp: new Date().toISOString()
      });
      return true;
    }

    // ✅ SIMPLIFIED: Basic health check with timeout
    let health;
    try {
      logger.debug('🔍 Friends API: Testing ProfileManager connection...');
      
      // ✅ Add timeout to prevent hanging
      const healthPromise = profileManager.testConnection();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Health check timeout')), 10000)
      );
      
      health = await Promise.race([healthPromise, timeoutPromise]) as any;
      
      logger.info('✅ Friends API: ProfileManager health check completed', {
        database: health.database,
        redis: health.redis,
        overall: health.overall,
        errors: health.errors?.length || 0
      });
      
    } catch (error: any) {
      logger.error('❌ Friends API: Health check failed:', {
        message: error.message,
        name: error.name
      });
      
      // Return degraded status instead of failing completely
      sendJSON(res, 200, {
        success: false,
        message: 'Health check failed',
        status: 'degraded',
        error: error.message,
        details: {
          database: false,
          redis: false,
          healthCheckFailed: true
        },
        timestamp: new Date().toISOString()
      });
      return true;
    }
    
    // ✅ Return health status based on results
    const httpStatus = health.overall ? 200 : 503;
    const status = health.overall ? 'healthy' : 'degraded';
    
    sendJSON(res, httpStatus, {
      success: health.overall,
      message: health.overall ? 'Friends API healthy' : 'Friends API degraded',
      status: status,
      details: {
        database: health.database,
        redis: health.redis,
        errors: health.errors || [],
        performance: {
          dbLatency: health.dbLatency,
          redisLatency: health.redisLatency,
          cachePerformance: health.cachePerformance
        }
      },
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error: any) {
    logger.error('❌ Friends API: Health check exception:', error);
    
    // ✅ Always return a response, never fail completely
    sendJSON(res, 500, {
      success: false,
      message: 'Health check failed with exception',
      status: 'down',
      error: error.message,
      timestamp: new Date().toISOString()
    });
    return true;
  }
}

async function handleGetFriends(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
  try {
    if (!profileManager) {
      sendError(res, 503, 'ProfileManager not available');
      return true;
    }

    const authId = pathname.split('/')[3];
    if (!authId) {
      sendError(res, 400, 'User ID is required');
      return true;
    }

    logger.debug(`👥 Fetching friends for user: ${authId}`);

    const friends = await profileManager.fetchUserFriends(authId);
    
    sendJSON(res, 200, {
      success: true,
      friends,
      count: friends.length,
      cached: true, // Indicates data came from Redis cache
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    sendError(res, 500, 'Failed to fetch friends', { error: error instanceof Error ? error.message : 'Unknown error' });
    return true;
  }
}

async function handleBatchStatus(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  try {
    if (!profileManager) {
      sendError(res, 503, 'ProfileManager not available');
      return true;
    }

    const body = await parseRequestBody(req);
    const { userIds, requesterId } = body;

    if (!Array.isArray(userIds) || !requesterId) {
      sendError(res, 400, 'userIds array and requesterId are required');
      return true;
    }

    if (userIds.length > 100) {
      sendError(res, 400, 'Too many user IDs (max 100)');
      return true;
    }

    logger.debug(`📊 Batch status check for ${userIds.length} users by ${requesterId}`);

    const statuses = await profileManager.batchGetOnlineStatus(userIds);
    
    // Convert boolean status to more detailed status objects
    const detailedStatuses: Record<string, { isOnline: boolean; lastSeen?: string }> = {};
    
    for (const [userId, isOnline] of Object.entries(statuses)) {
      try {
        const statusDetails = await profileManager.getOnlineStatus(userId);
        detailedStatuses[userId] = {
          isOnline,
          lastSeen: statusDetails.lastSeen
        };
      } catch (error) {
        detailedStatuses[userId] = { isOnline };
      }
    }

    sendJSON(res, 200, {
      success: true,
      statuses: detailedStatuses,
      count: Object.keys(detailedStatuses).length,
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    sendError(res, 500, 'Failed to get batch status', { error: error instanceof Error ? error.message : 'Unknown error' });
    return true;
  }
}

async function handleLastMessages(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  try {
    if (!profileManager) {
      sendError(res, 503, 'ProfileManager not available');
      return true;
    }

    const body = await parseRequestBody(req);
    const { userId, friendIds } = body;

    if (!userId || !Array.isArray(friendIds)) {
      sendError(res, 400, 'userId and friendIds array are required');
      return true;
    }

    if (friendIds.length > 50) {
      sendError(res, 400, 'Too many friend IDs (max 50)');
      return true;
    }

    logger.debug(`💬 Fetching last messages for ${friendIds.length} friends of ${userId}`);

    // This would need to be implemented in a chat service
    // For now, we'll return empty data structure
    const lastMessages: Record<string, any> = {};
    const unreadCounts: Record<string, number> = {};

    // TODO: Integrate with FriendsChatService or Redis chat cache
    // const chatService = getFriendsChatService();
    // if (chatService) {
    //   const results = await chatService.getLastMessages(userId, friendIds);
    //   lastMessages = results.lastMessages;
    //   unreadCounts = await chatService.getUnreadCounts(userId);
    // }

    sendJSON(res, 200, {
      success: true,
      lastMessages,
      unreadCounts,
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    sendError(res, 500, 'Failed to get last messages', { error: error instanceof Error ? error.message : 'Unknown error' });
    return true;
  }
}

async function handleSendFriendRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  try {
    if (!profileManager) {
      sendError(res, 503, 'ProfileManager not available');
      return true;
    }

    const body = await parseRequestBody(req);
    const { senderAuthId, receiverAuthId, message } = body;

    if (!senderAuthId || !receiverAuthId) {
      sendError(res, 400, 'senderAuthId and receiverAuthId are required');
      return true;
    }

    if (senderAuthId === receiverAuthId) {
      sendError(res, 400, 'Cannot send friend request to yourself');
      return true;
    }

    logger.debug(`👥 Sending friend request: ${senderAuthId} -> ${receiverAuthId}`);

    const result = await profileManager.sendFriendRequest(senderAuthId, receiverAuthId, message);
    
    sendJSON(res, 200, {
      success: result.success,
      message: result.message,
      autoAccepted: result.autoAccepted,
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    sendError(res, 500, 'Failed to send friend request', { error: error instanceof Error ? error.message : 'Unknown error' });
    return true;
  }
}

async function handleAcceptFriendRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  try {
    if (!profileManager) {
      sendError(res, 503, 'ProfileManager not available');
      return true;
    }

    const body = await parseRequestBody(req);
    const { requestId, acceptingUserId } = body;

    if (!requestId || !acceptingUserId) {
      sendError(res, 400, 'requestId and acceptingUserId are required');
      return true;
    }

    logger.debug(`✅ Accepting friend request: ${requestId} by ${acceptingUserId}`);

    const result = await profileManager.acceptFriendRequest(requestId, acceptingUserId);
    
    sendJSON(res, 200, {
      success: result.success,
      message: result.message,
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    sendError(res, 500, 'Failed to accept friend request', { error: error instanceof Error ? error.message : 'Unknown error' });
    return true;
  }
}

async function handleDeclineFriendRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  try {
    if (!profileManager) {
      sendError(res, 503, 'ProfileManager not available');
      return true;
    }

    const body = await parseRequestBody(req);
    const { requestId, decliningUserId } = body;

    if (!requestId || !decliningUserId) {
      sendError(res, 400, 'requestId and decliningUserId are required');
      return true;
    }

    logger.debug(`❌ Declining friend request: ${requestId} by ${decliningUserId}`);

    const result = await profileManager.declineFriendRequest(requestId, decliningUserId);
    
    sendJSON(res, 200, {
      success: result.success,
      message: result.message,
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    sendError(res, 500, 'Failed to decline friend request', { error: error instanceof Error ? error.message : 'Unknown error' });
    return true;
  }
}

async function handleRemoveFriend(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  try {
    if (!profileManager) {
      sendError(res, 503, 'ProfileManager not available');
      return true;
    }

    const body = await parseRequestBody(req);
    const { user1AuthId, user2AuthId } = body;

    if (!user1AuthId || !user2AuthId) {
      sendError(res, 400, 'user1AuthId and user2AuthId are required');
      return true;
    }

    if (user1AuthId === user2AuthId) {
      sendError(res, 400, 'Cannot remove yourself as friend');
      return true;
    }

    logger.debug(`💔 Removing friendship: ${user1AuthId} <-> ${user2AuthId}`);

    const result = await profileManager.removeFriend(user1AuthId, user2AuthId);
    
    sendJSON(res, 200, {
      success: result.success,
      message: result.message,
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    sendError(res, 500, 'Failed to remove friend', { error: error instanceof Error ? error.message : 'Unknown error' });
    return true;
  }
}

async function handleGetFriendRequests(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
  try {
    if (!profileManager) {
      sendError(res, 503, 'ProfileManager not available');
      return true;
    }

    const authId = pathname.split('/')[3];
    if (!authId) {
      sendError(res, 400, 'User ID is required');
      return true;
    }

    const url = new URL(pathname, `http://localhost`);
    const type = url.searchParams.get('type') as 'received' | 'sent' || 'received';

    if (!['received', 'sent'].includes(type)) {
      sendError(res, 400, 'Invalid type parameter (must be "received" or "sent")');
      return true;
    }

    logger.debug(`📥 Fetching ${type} friend requests for user: ${authId}`);

    const requests = await profileManager.fetchPendingFriendRequests(authId, type);
    
    sendJSON(res, 200, {
      success: true,
      requests,
      type,
      count: requests.length,
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    sendError(res, 500, 'Failed to fetch friend requests', { error: error instanceof Error ? error.message : 'Unknown error' });
    return true;
  }
}

async function handleGetFriendshipStatus(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  try {
    if (!profileManager) {
      sendError(res, 503, 'ProfileManager not available');
      return true;
    }

    const body = await parseRequestBody(req);
    const { user1AuthId, user2AuthId } = body;

    if (!user1AuthId || !user2AuthId) {
      sendError(res, 400, 'user1AuthId and user2AuthId are required');
      return true;
    }

    logger.debug(`🔍 Checking friendship status: ${user1AuthId} <-> ${user2AuthId}`);

    const status = await profileManager.getFriendshipStatus(user1AuthId, user2AuthId);
    
    sendJSON(res, 200, {
      success: true,
      status,
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    sendError(res, 500, 'Failed to get friendship status', { error: error instanceof Error ? error.message : 'Unknown error' });
    return true;
  }
}

async function handleSearchUsers(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  try {
    if (!profileManager) {
      sendError(res, 503, 'ProfileManager not available');
      return true;
    }

    const body = await parseRequestBody(req);
    const { currentUserAuthId, searchTerm, limit = 20 } = body;

    if (!currentUserAuthId || !searchTerm?.trim()) {
      sendError(res, 400, 'currentUserAuthId and searchTerm are required');
      return true;
    }

    if (searchTerm.length < 2) {
      sendError(res, 400, 'Search term must be at least 2 characters');
      return true;
    }

    if (limit > 50) {
      sendError(res, 400, 'Limit cannot exceed 50');
      return true;
    }

    logger.debug(`🔍 Searching users for: "${searchTerm}" by ${currentUserAuthId}`);

    const users = await profileManager.searchUsersToAddAsFriends(currentUserAuthId, searchTerm, limit);
    
    sendJSON(res, 200, {
      success: true,
      users,
      searchTerm,
      count: users.length,
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    sendError(res, 500, 'Failed to search users', { error: error instanceof Error ? error.message : 'Unknown error' });
    return true;
  }
}

async function handleGetFriendStats(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
  try {
    if (!profileManager) {
      sendError(res, 503, 'ProfileManager not available');
      return true;
    }

    const authId = pathname.split('/')[3];
    if (!authId) {
      sendError(res, 400, 'User ID is required');
      return true;
    }

    logger.debug(`📊 Fetching friend stats for user: ${authId}`);

    const stats = await profileManager.getFriendStats(authId);
    const onlineFriendsCount = await profileManager.getOnlineFriendsCount(authId);
    
    sendJSON(res, 200, {
      success: true,
      stats: {
        ...stats,
        onlineFriendsCount
      },
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    sendError(res, 500, 'Failed to fetch friend stats', { error: error instanceof Error ? error.message : 'Unknown error' });
    return true;
  }
}