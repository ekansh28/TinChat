// server/routes/friendsRoutes.ts - COMPLETELY FIXED FRIENDS API ROUTES
import { IncomingMessage, ServerResponse } from 'http';
import { ProfileManager } from '../managers/profile/ProfileManager';
import { logger } from '../utils/logger';
import { URL } from 'url';

let profileManager: ProfileManager | null = null;

export function setFriendsProfileManager(manager: ProfileManager): void {
  profileManager = manager;
  logger.info('📡 Friends API routes configured with ProfileManager');
}

// ============ HELPER FUNCTIONS ============

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

function sendJSON(res: ServerResponse, statusCode: number, data: any): void {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

function sendError(res: ServerResponse, statusCode: number, message: string, details?: any): void {
  logger.error(`Friends API Error ${statusCode}: ${message}`, details);
  sendJSON(res, statusCode, {
    success: false,
    error: {
      message,
      code: getErrorCode(statusCode),
      details: details || undefined
    },
    timestamp: new Date().toISOString()
  });
}

function getErrorCode(statusCode: number): string {
  switch (statusCode) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 429: return 'RATE_LIMITED';
    case 500: return 'INTERNAL_ERROR';
    default: return 'UNKNOWN_ERROR';
  }
}
function validateAuthId(authId: string): boolean {
  return !!(authId && typeof authId === 'string' && authId.trim().length > 0);
}


function validatePagination(limit?: number, offset?: number): { limit: number; offset: number } {
  const validLimit = Math.min(Math.max(limit || 20, 1), 100);
  const validOffset = Math.max(offset || 0, 0);
  return { limit: validLimit, offset: validOffset };
}

// ============ MAIN ROUTE HANDLER ============

export async function handleFriendsRoutes(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (!req.url?.startsWith('/api/friends')) {
    return false;
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    sendJSON(res, 200, { success: true });
    return true;
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const method = req.method;

    logger.debug(`📡 Friends API: ${method} ${pathname}`);

    // ============ HEALTH CHECK ============
    if (pathname === '/api/friends/health') {
      if (method === 'GET') {
        return await handleHealthCheck(req, res);
      }
    }

    // ============ FRIENDS LIST ============
    // GET /api/friends/{authId} - Get user's friends list
    if (pathname.match(/^\/api\/friends\/([^\/]+)$/)) {
      if (method === 'GET') {
        return await handleGetFriends(req, res, pathname);
      }
    }

    // ============ FRIEND REQUESTS ============
    // GET /api/friends/{authId}/requests - Get pending friend requests
    if (pathname.match(/^\/api\/friends\/([^\/]+)\/requests$/)) {
      if (method === 'GET') {
        return await handleGetFriendRequests(req, res, pathname, url);
      }
    }

    // POST /api/friends/request/send - Send friend request
    if (pathname === '/api/friends/request/send') {
      if (method === 'POST') {
        return await handleSendFriendRequest(req, res);
      }
    }

    // POST /api/friends/accept-request - Accept friend request
    if (pathname === '/api/friends/accept-request') {
      if (method === 'POST') {
        return await handleAcceptFriendRequest(req, res);
      }
    }

    // POST /api/friends/decline-request - Decline friend request
    if (pathname === '/api/friends/decline-request') {
      if (method === 'POST') {
        return await handleDeclineFriendRequest(req, res);
      }
    }

    // ============ FRIENDSHIP MANAGEMENT ============
    // POST /api/friends/remove - Remove friend
    if (pathname === '/api/friends/remove') {
      if (method === 'POST') {
        return await handleRemoveFriend(req, res);
      }
    }

    // POST /api/friends/status - Get friendship status
    if (pathname === '/api/friends/status') {
      if (method === 'POST') {
        return await handleGetFriendshipStatus(req, res);
      }
    }

    // ============ SEARCH AND DISCOVERY ============
    // POST /api/friends/search - Search users to add as friends
    if (pathname === '/api/friends/search') {
      if (method === 'POST') {
        return await handleSearchUsers(req, res);
      }
    }

    // GET /api/friends/{authId}/suggestions - Get friend suggestions
    if (pathname.match(/^\/api\/friends\/([^\/]+)\/suggestions$/)) {
      if (method === 'GET') {
        return await handleGetFriendSuggestions(req, res, pathname, url);
      }
    }

    // ============ STATISTICS ============
    // GET /api/friends/{authId}/stats - Get friend statistics
    if (pathname.match(/^\/api\/friends\/([^\/]+)\/stats$/)) {
      if (method === 'GET') {
        return await handleGetFriendStats(req, res, pathname);
      }
    }

    // ============ BLOCKING ============
    // POST /api/friends/block - Block user
    if (pathname === '/api/friends/block') {
      if (method === 'POST') {
        return await handleBlockUser(req, res);
      }
    }

    // POST /api/friends/unblock - Unblock user
    if (pathname === '/api/friends/unblock') {
      if (method === 'POST') {
        return await handleUnblockUser(req, res);
      }
    }

    // GET /api/friends/{authId}/blocked - Get blocked users
    if (pathname.match(/^\/api\/friends\/([^\/]+)\/blocked$/)) {
      if (method === 'GET') {
        return await handleGetBlockedUsers(req, res, pathname);
      }
    }

    // ============ MUTUAL FRIENDS ============
    // POST /api/friends/mutual - Get mutual friends
    if (pathname === '/api/friends/mutual') {
      if (method === 'POST') {
        return await handleGetMutualFriends(req, res);
      }
    }

    // ============ BATCH OPERATIONS ============
    // POST /api/friends/batch-status - Get batch online status
    if (pathname === '/api/friends/batch-status') {
      if (method === 'POST') {
        return await handleBatchStatus(req, res);
      }
    }

    // ============ ADMIN/DEBUG ENDPOINTS ============
    // GET /api/friends/admin/stats - Get module statistics (admin only)
    if (pathname === '/api/friends/admin/stats') {
      if (method === 'GET') {
        return await handleGetModuleStats(req, res);
      }
    }

    // POST /api/friends/admin/cleanup - Run cleanup operations (admin only)
    if (pathname === '/api/friends/admin/cleanup') {
      if (method === 'POST') {
        return await handleRunCleanup(req, res);
      }
    }

    // Route not found
    sendError(res, 404, 'Friends API endpoint not found', { 
      path: pathname, 
      method 
    });
    return true;

  } catch (error) {
    logger.error('❌ Friends API handler error:', error);
    sendError(res, 500, 'Internal server error', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return true;
  }
}

// ============ ROUTE HANDLERS ============

async function handleHealthCheck(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  try {
    logger.info('🔍 Friends API: Running health check...');
    
    if (!profileManager) {
      sendJSON(res, 503, {
        success: false,
        message: 'ProfileManager not initialized',
        status: 'down',
        timestamp: new Date().toISOString()
      });
      return true;
    }

    // Test connection with timeout
    const healthPromise = profileManager.testConnection();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Health check timeout')), 10000)
    );
    
    const health = await Promise.race([healthPromise, timeoutPromise]) as any;
    
    const httpStatus = health.overall ? 200 : 503;
    const status = health.overall ? 'healthy' : 'degraded';
    
    sendJSON(res, httpStatus, {
      success: health.overall,
      message: health.overall ? 'Friends API healthy' : 'Friends API degraded',
      status,
      details: {
        database: health.database,
        redis: health.redis,
        errors: health.errors || [],
        performance: {
          dbLatency: health.dbLatency,
          redisLatency: health.redisLatency
        }
      },
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error: any) {
    logger.error('❌ Friends API: Health check exception:', error);
    
    sendJSON(res, 500, {
      success: false,
      message: 'Health check failed',
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
    if (!validateAuthId(authId)) {
      sendError(res, 400, 'Valid user ID is required');
      return true;
    }

    const url = new URL(req.url!, `http://${req.headers.host}`);
    const { limit, offset } = validatePagination(
      parseInt(url.searchParams.get('limit') || '20'),
      parseInt(url.searchParams.get('offset') || '0')
    );

    logger.debug(`👥 Fetching friends for user: ${authId} (limit: ${limit}, offset: ${offset})`);

    const friends = await profileManager.fetchUserFriends(authId);
    
    // Apply pagination
    const paginatedFriends = friends.slice(offset, offset + limit);
    const hasMore = offset + limit < friends.length;

    sendJSON(res, 200, {
      success: true,
      data: {
        friends: paginatedFriends,
        total_count: friends.length,
        returned_count: paginatedFriends.length,
        has_more: hasMore,
        pagination: {
          limit,
          offset,
          next_offset: hasMore ? offset + limit : null
        }
      },
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    sendError(res, 500, 'Failed to fetch friends', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return true;
  }
}

async function handleGetFriendRequests(req: IncomingMessage, res: ServerResponse, pathname: string, url: URL): Promise<boolean> {
  try {
    if (!profileManager) {
      sendError(res, 503, 'ProfileManager not available');
      return true;
    }

    const authId = pathname.split('/')[3];
    if (!validateAuthId(authId)) {
      sendError(res, 400, 'Valid user ID is required');
      return true;
    }

    const type = url.searchParams.get('type') as 'received' | 'sent' || 'received';
    if (!['received', 'sent'].includes(type)) {
      sendError(res, 400, 'Type parameter must be "received" or "sent"');
      return true;
    }

    logger.debug(`📥 Fetching ${type} friend requests for user: ${authId}`);

    const requests = await profileManager.fetchPendingFriendRequests(authId, type);
    
    sendJSON(res, 200, {
      success: true,
      data: {
        requests,
        type,
        count: requests.length
      },
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    sendError(res, 500, 'Failed to fetch friend requests', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
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

    if (!validateAuthId(senderAuthId) || !validateAuthId(receiverAuthId)) {
      sendError(res, 400, 'Valid senderAuthId and receiverAuthId are required');
      return true;
    }

    if (senderAuthId === receiverAuthId) {
      sendError(res, 400, 'Cannot send friend request to yourself');
      return true;
    }

    if (message && message.length > 500) {
      sendError(res, 400, 'Message too long (max 500 characters)');
      return true;
    }

    logger.debug(`👥 Sending friend request: ${senderAuthId} -> ${receiverAuthId}`);

    const result = await profileManager.sendFriendRequest(senderAuthId, receiverAuthId, message);
    
    sendJSON(res, 200, {
      success: result.success,
      data: {
        message: result.message,
        auto_accepted: result.autoAccepted || false
      },
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    sendError(res, 500, 'Failed to send friend request', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
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

    if (!requestId || !validateAuthId(acceptingUserId)) {
      sendError(res, 400, 'Valid requestId and acceptingUserId are required');
      return true;
    }

    logger.debug(`✅ Accepting friend request: ${requestId} by ${acceptingUserId}`);

    const result = await profileManager.acceptFriendRequest(requestId, acceptingUserId);
    
    sendJSON(res, 200, {
      success: result.success,
      data: {
        message: result.message
      },
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    sendError(res, 500, 'Failed to accept friend request', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
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

    if (!requestId || !validateAuthId(decliningUserId)) {
      sendError(res, 400, 'Valid requestId and decliningUserId are required');
      return true;
    }

    logger.debug(`❌ Declining friend request: ${requestId} by ${decliningUserId}`);

    const result = await profileManager.declineFriendRequest(requestId, decliningUserId);
    
    sendJSON(res, 200, {
      success: result.success,
      data: {
        message: result.message
      },
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    sendError(res, 500, 'Failed to decline friend request', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
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

    if (!validateAuthId(user1AuthId) || !validateAuthId(user2AuthId)) {
      sendError(res, 400, 'Valid user1AuthId and user2AuthId are required');
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
      data: {
        message: result.message
      },
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    sendError(res, 500, 'Failed to remove friend', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
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

    if (!validateAuthId(user1AuthId) || !validateAuthId(user2AuthId)) {
      sendError(res, 400, 'Valid user1AuthId and user2AuthId are required');
      return true;
    }

    logger.debug(`🔍 Checking friendship status: ${user1AuthId} <-> ${user2AuthId}`);

    const status = await profileManager.getFriendshipStatus(user1AuthId, user2AuthId);
    
    sendJSON(res, 200, {
      success: true,
      data: {
        status
      },
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    sendError(res, 500, 'Failed to get friendship status', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
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

    if (!validateAuthId(currentUserAuthId) || !searchTerm?.trim()) {
      sendError(res, 400, 'Valid currentUserAuthId and searchTerm are required');
      return true;
    }

    if (searchTerm.length < 2) {
      sendError(res, 400, 'Search term must be at least 2 characters');
      return true;
    }

    const validatedLimit = Math.min(Math.max(limit, 1), 50);

    logger.debug(`🔍 Searching users for: "${searchTerm}" by ${currentUserAuthId}`);

    const users = await profileManager.searchUsersToAddAsFriends(currentUserAuthId, searchTerm, validatedLimit);
    
    sendJSON(res, 200, {
      success: true,
      data: {
        users,
        search_term: searchTerm,
        count: users.length
      },
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    sendError(res, 500, 'Failed to search users', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return true;
  }
}

async function handleGetFriendSuggestions(req: IncomingMessage, res: ServerResponse, pathname: string, url: URL): Promise<boolean> {
  try {
    if (!profileManager) {
      sendError(res, 503, 'ProfileManager not available');
      return true;
    }

    const authId = pathname.split('/')[3];
    if (!validateAuthId(authId)) {
      sendError(res, 400, 'Valid user ID is required');
      return true;
    }

    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '10'), 1), 20);

    logger.debug(`💡 Getting friend suggestions for user: ${authId}`);

    // This would need to be implemented in ProfileManager
    const suggestions = await profileManager.getSuggestedFriends?.(authId, limit) || [];
    
    sendJSON(res, 200, {
      success: true,
      data: {
        suggestions,
        count: suggestions.length,
        algorithm_version: '1.0'
      },
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    sendError(res, 500, 'Failed to get friend suggestions', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
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
    if (!validateAuthId(authId)) {
      sendError(res, 400, 'Valid user ID is required');
      return true;
    }

    logger.debug(`📊 Fetching friend stats for user: ${authId}`);

    const [stats, onlineFriendsCount] = await Promise.all([
      profileManager.getFriendStats(authId),
      profileManager.getOnlineFriendsCount(authId)
    ]);
    
    sendJSON(res, 200, {
      success: true,
      data: {
        stats: {
          ...stats,
          onlineFriendsCount
        }
      },
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    sendError(res, 500, 'Failed to fetch friend stats', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return true;
  }
}

async function handleBlockUser(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  try {
    if (!profileManager) {
      sendError(res, 503, 'ProfileManager not available');
      return true;
    }

    const body = await parseRequestBody(req);
    const { blockerAuthId, blockedAuthId } = body;

    if (!validateAuthId(blockerAuthId) || !validateAuthId(blockedAuthId)) {
      sendError(res, 400, 'Valid blockerAuthId and blockedAuthId are required');
      return true;
    }

    if (blockerAuthId === blockedAuthId) {
      sendError(res, 400, 'Cannot block yourself');
      return true;
    }

    logger.debug(`🚫 Blocking user: ${blockedAuthId} by ${blockerAuthId}`);

    const result = await profileManager.blockUser?.(blockerAuthId, blockedAuthId) || 
      { success: false, message: 'Block functionality not implemented' };
    
    sendJSON(res, 200, {
      success: result.success,
      data: {
        message: result.message
      },
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    sendError(res, 500, 'Failed to block user', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return true;
  }
}

async function handleUnblockUser(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  try {
    if (!profileManager) {
      sendError(res, 503, 'ProfileManager not available');
      return true;
    }

    const body = await parseRequestBody(req);
    const { blockerAuthId, blockedAuthId } = body;

    if (!validateAuthId(blockerAuthId) || !validateAuthId(blockedAuthId)) {
      sendError(res, 400, 'Valid blockerAuthId and blockedAuthId are required');
      return true;
    }

    logger.debug(`✅ Unblocking user: ${blockedAuthId} by ${blockerAuthId}`);

    const result = await profileManager.unblockUser?.(blockerAuthId, blockedAuthId) || 
      { success: false, message: 'Unblock functionality not implemented' };
    
    sendJSON(res, 200, {
      success: result.success,
      data: {
        message: result.message
      },
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    sendError(res, 500, 'Failed to unblock user', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return true;
  }
}

async function handleGetBlockedUsers(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
  try {
    if (!profileManager) {
      sendError(res, 503, 'ProfileManager not available');
      return true;
    }

    const authId = pathname.split('/')[3];
    if (!validateAuthId(authId)) {
      sendError(res, 400, 'Valid user ID is required');
      return true;
    }

    logger.debug(`🚫 Fetching blocked users for: ${authId}`);

    const blockedUsers = await profileManager.getBlockedUsers?.(authId) || [];
    
    sendJSON(res, 200, {
      success: true,
      data: {
        blocked_users: blockedUsers,
        count: blockedUsers.length
      },
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    sendError(res, 500, 'Failed to fetch blocked users', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return true;
  }
}

async function handleGetMutualFriends(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  try {
    if (!profileManager) {
      sendError(res, 503, 'ProfileManager not available');
      return true;
    }

    const body = await parseRequestBody(req);
    const { user1AuthId, user2AuthId } = body;

    if (!validateAuthId(user1AuthId) || !validateAuthId(user2AuthId)) {
      sendError(res, 400, 'Valid user1AuthId and user2AuthId are required');
      return true;
    }

    if (user1AuthId === user2AuthId) {
      sendError(res, 400, 'Cannot get mutual friends with yourself');
      return true;
    }

    logger.debug(`👥 Getting mutual friends: ${user1AuthId} <-> ${user2AuthId}`);

    const mutualFriends = await profileManager.getMutualFriends?.(user1AuthId, user2AuthId) || [];
    
    sendJSON(res, 200, {
      success: true,
      data: {
        mutual_friends: mutualFriends,
        count: mutualFriends.length,
        user1_id: user1AuthId,
        user2_id: user2AuthId
      },
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    sendError(res, 500, 'Failed to get mutual friends', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
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

    if (!Array.isArray(userIds) || !validateAuthId(requesterId)) {
      sendError(res, 400, 'Valid userIds array and requesterId are required');
      return true;
    }

    if (userIds.length > 100) {
      sendError(res, 400, 'Too many user IDs (max 100)');
      return true;
    }

    logger.debug(`📊 Batch status check for ${userIds.length} users by ${requesterId}`);

    const statuses = await profileManager.batchGetOnlineStatus?.(userIds) || {};
    
    // Convert to detailed status objects
    const detailedStatuses: Record<string, { isOnline: boolean; lastSeen?: string }> = {};
    
    for (const [userId, isOnline] of Object.entries(statuses)) {
      try {
        const statusDetails = await profileManager.getOnlineStatus?.(userId);
        detailedStatuses[userId] = {
          isOnline: Boolean(isOnline),
          lastSeen: statusDetails?.lastSeen
        };
      } catch (error) {
        detailedStatuses[userId] = { isOnline: Boolean(isOnline) };
      }
    }

    sendJSON(res, 200, {
      success: true,
      data: {
        statuses: detailedStatuses,
        count: Object.keys(detailedStatuses).length
      },
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    sendError(res, 500, 'Failed to get batch status', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return true;
  }
}

async function handleGetModuleStats(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  try {
    if (!profileManager) {
      sendError(res, 503, 'ProfileManager not available');
      return true;
    }

    // Basic admin check - in real implementation, you'd verify admin privileges
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      sendError(res, 401, 'Admin authorization required');
      return true;
    }

    logger.debug(`📊 Getting friends module statistics`);

    const stats = await profileManager.getFriendsModuleStats?.() || {
      totalFriendships: 0,
      pendingRequests: 0,
      cacheHitRate: 0,
      performance: {
        avgQueryTime: 0,
        cacheEnabled: false
      }
    };
    
    sendJSON(res, 200, {
      success: true,
      data: {
        module_stats: stats
      },
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    sendError(res, 500, 'Failed to get module stats', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return true;
  }
}

async function handleRunCleanup(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  try {
    if (!profileManager) {
      sendError(res, 503, 'ProfileManager not available');
      return true;
    }

    // Basic admin check
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      sendError(res, 401, 'Admin authorization required');
      return true;
    }

 const body = await parseRequestBody(req);
const { operation = 'expired_requests', olderThanDays = 30 } = body;

logger.debug(`🧹 Running cleanup operation: ${operation}`);

// ✅ FIXED: Define proper type that includes optional issues
let result: { 
  cleaned: number; 
  message: string; 
  issues?: string[] 
} = { cleaned: 0, message: 'Cleanup completed' };

switch (operation) {
  case 'expired_requests':
    const cleaned = await profileManager.cleanupExpiredRequests?.(olderThanDays) || 0;
    result = { cleaned, message: `Cleaned ${cleaned} expired requests` };
    break;
  
  case 'integrity_check':
    const integrity = await profileManager.validateFriendshipsIntegrity?.() || { issues: [], fixed: 0 };
    result = { 
      cleaned: integrity.fixed, 
      message: `Fixed ${integrity.fixed} issues, found ${integrity.issues.length} total issues`,
      issues: integrity.issues
    };
    break;
  
  default:
    sendError(res, 400, 'Invalid cleanup operation');
    return true;
}

    
    sendJSON(res, 200, {
      success: true,
      data: {
        operation,
        result
      },
      timestamp: new Date().toISOString()
    });

    return true;
  } catch (error) {
    sendError(res, 500, 'Failed to run cleanup', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return true;
  }
}

// ============ RATE LIMITING ============

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(identifier: string, maxRequests: number = 60, windowMs: number = 60000): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);
  
  if (!record || now > record.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (record.count >= maxRequests) {
    return false;
  }
  
  record.count++;
  return true;
}

// ============ MIDDLEWARE WRAPPER ============

export async function handleFriendsRoutesWithMiddleware(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  // Rate limiting
  const clientIP = req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIP, 100, 60000)) { // 100 requests per minute
    sendError(res, 429, 'Rate limit exceeded');
    return true;
  }

  // Add request ID for tracing
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  logger.debug(`📡 Friends API Request ${requestId}: ${req.method} ${req.url}`);

  try {
    return await handleFriendsRoutes(req, res);
  } catch (error) {
    logger.error(`❌ Friends API Request ${requestId} failed:`, error);
    sendError(res, 500, 'Internal server error');
    return true;
  }
}