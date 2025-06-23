// server/routes/friendsRoutes.ts - FRIENDS API WITH REDIS CACHING
import { IncomingMessage, ServerResponse } from 'http';
import { ProfileManager } from '../managers/profile/ProfileManager';
import { logger } from '../utils/logger';
import { URL } from 'url';

// Global ProfileManager instance (will be set from server/index.ts)
let globalProfileManager: ProfileManager | null = null;

export const setFriendsProfileManager = (profileManager: ProfileManager) => {
  globalProfileManager = profileManager;
  logger.info('✅ ProfileManager set for Friends API routes');
};

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  cached?: boolean;
  fetchTime?: number;
}

// Cache for API responses (5 seconds cache)
const responseCache = new Map<string, { response: ApiResponse; timestamp: number }>();
const RESPONSE_CACHE_TTL = 5000;

// Helper function to create standardized API responses
const createResponse = <T>(
  success: boolean, 
  data?: T, 
  error?: string, 
  message?: string,
  cached = false,
  fetchTime?: number
): ApiResponse<T> => ({
  success,
  data,
  error,
  message,
  timestamp: new Date().toISOString(),
  cached,
  fetchTime
});

// Helper function to parse request body
const parseRequestBody = (req: IncomingMessage): Promise<any> => {
  return new Promise((resolve, reject) => {
    let body = '';
    let timeout: NodeJS.Timeout;

    timeout = setTimeout(() => {
      reject(new Error('Request body parsing timeout'));
    }, 10000);

    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1024 * 1024) { // 1MB limit
        clearTimeout(timeout);
        reject(new Error('Request body too large'));
        return;
      }
    });

    req.on('end', () => {
      clearTimeout(timeout);
      try {
        if (body.trim()) {
          resolve(JSON.parse(body));
        } else {
          resolve({});
        }
      } catch (error) {
        reject(new Error('Invalid JSON in request body'));
      }
    });

    req.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
};

// Helper function to set CORS headers
const setFriendsApiCorsHeaders = (res: ServerResponse, requestOrigin?: string): void => {
  const allowedOrigins = [
    "https://studio--chitchatconnect-aqa0w.us-central1.hosted.app",
    "https://delightful-pond-0cb3e0010.6.azurestaticapps.net",
    "https://tinchat.online",
    "https://www.tinchat.online",
    "http://localhost:9002",
    "http://localhost:3000",
    "http://localhost:3001"
  ];

  if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push(
      "http://localhost:8080",
      "http://localhost:8000",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:9002"
    );
  }

  let originToAllow = '*';
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    originToAllow = requestOrigin;
  }

  res.setHeader('Access-Control-Allow-Origin', originToAllow);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
};

// Helper function to send JSON response
const sendJsonResponse = (res: ServerResponse, statusCode: number, data: ApiResponse): void => {
  res.writeHead(statusCode);
  res.end(JSON.stringify(data, null, 2));
};

// Extract userId from URL path
const extractUserId = (url: string): string | null => {
  const matches = url.match(/\/api\/friends\/([^\/\?]+)/);
  return matches ? decodeURIComponent(matches[1]) : null;
};

// Validate userId format
const isValidUserId = (userId: string): boolean => {
  return !!(userId && userId.trim().length > 0 && userId.length <= 200);
};

// Get cached response if available and not expired
const getCachedResponse = (cacheKey: string): ApiResponse | null => {
  const cached = responseCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < RESPONSE_CACHE_TTL) {
    return { ...cached.response, cached: true };
  }
  if (cached) {
    responseCache.delete(cacheKey);
  }
  return null;
};

// Cache response for short term
const cacheResponse = (cacheKey: string, response: ApiResponse): void => {
  responseCache.set(cacheKey, {
    response: { ...response, cached: false },
    timestamp: Date.now()
  });

  if (responseCache.size > 100) {
    const oldestKeys = Array.from(responseCache.keys()).slice(0, 20);
    oldestKeys.forEach(key => responseCache.delete(key));
  }
};

export const handleFriendsRoutes = async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
  const url = req.url || '';
  const method = req.method || 'GET';
  const requestOrigin = req.headers.origin;
  const startTime = Date.now();

  // Set CORS headers for all friends API requests
  setFriendsApiCorsHeaders(res, requestOrigin);

  // Handle preflight OPTIONS requests
  if (method === 'OPTIONS') {
    sendJsonResponse(res, 200, createResponse(true, null, undefined, 'CORS preflight successful'));
    return true;
  }

  // Check if this is a friends API route
  if (!url.startsWith('/api/friends')) {
    return false;
  }

  // Check if ProfileManager is available
  if (!globalProfileManager) {
    logger.error('❌ ProfileManager not initialized for Friends API routes');
    sendJsonResponse(res, 503, createResponse(false, null, 'Friends service unavailable', 'ProfileManager not initialized'));
    return true;
  }

  try {
    // Route: GET /api/friends/health
    if (url === '/api/friends/health' && method === 'GET') {
      await handleFriendsHealthCheck(res, startTime);
      return true;
    }

    // Route: POST /api/friends/batch-status - Get online status for multiple users
    if (url === '/api/friends/batch-status' && method === 'POST') {
      await handleBatchStatusCheck(req, res, startTime);
      return true;
    }

    // Extract userId for individual friend operations
    const userId = extractUserId(url);
    if (!userId) {
      sendJsonResponse(res, 400, createResponse(false, null, 'Invalid user ID in URL', 'User ID is required'));
      return true;
    }

    if (!isValidUserId(userId)) {
      sendJsonResponse(res, 400, createResponse(false, null, 'Invalid user ID format', 'User ID must be non-empty and under 200 characters'));
      return true;
    }

    // Route handlers based on method and URL patterns
    switch (method) {
      case 'GET':
        if (url.endsWith('/friends')) {
          // GET /api/friends/{userId}/friends - Get user's friends list
          await handleGetFriendsList(userId, req, res, startTime);
        } else if (url.includes('/status/')) {
          // GET /api/friends/{userId}/status/{friendId} - Get friendship status
          const friendId = url.split('/status/')[1];
          await handleGetFriendshipStatus(userId, friendId, res, startTime);
        } else if (url.endsWith('/online')) {
          // GET /api/friends/{userId}/online - Get online friends count
          await handleGetOnlineFriendsCount(userId, res, startTime);
        } else {
          // GET /api/friends/{userId} - Get user's friends list (alternative endpoint)
          await handleGetFriendsList(userId, req, res, startTime);
        }
        break;
      case 'POST':
        if (url.includes('/request/')) {
          // POST /api/friends/{userId}/request/{friendId} - Send friend request
          const friendId = url.split('/request/')[1];
          await handleSendFriendRequest(userId, friendId, req, res, startTime);
        }
        break;
      case 'PUT':
        if (url.includes('/accept/')) {
          // PUT /api/friends/{userId}/accept/{requestId} - Accept friend request
          const requestId = url.split('/accept/')[1];
          await handleAcceptFriendRequest(userId, requestId, res, startTime);
        }
        break;
      case 'DELETE':
        if (url.includes('/remove/')) {
          // DELETE /api/friends/{userId}/remove/{friendId} - Remove friend
          const friendId = url.split('/remove/')[1];
          await handleRemoveFriend(userId, friendId, res, startTime);
        } else if (url.includes('/decline/')) {
          // DELETE /api/friends/{userId}/decline/{requestId} - Decline friend request
          const requestId = url.split('/decline/')[1];
          await handleDeclineFriendRequest(userId, requestId, res, startTime);
        }
        break;
      default:
        sendJsonResponse(res, 405, createResponse(false, null, 'Method not allowed', `${method} not supported for friends routes`));
        break;
    }

    return true;
  } catch (error) {
    const fetchTime = Date.now() - startTime;
    logger.error('❌ Friends API route error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Internal server error', false, fetchTime));
    return true;
  }
};

// GET /api/friends/{userId}/friends or /api/friends/{userId}
const handleGetFriendsList = async (userId: string, req: IncomingMessage, res: ServerResponse, startTime: number): Promise<void> => {
  try {
    logger.debug(`📡 GET friends list request for user: ${userId}`);

    // Check cache first
    const cacheKey = `friends_list:${userId}`;
    const cachedResponse = getCachedResponse(cacheKey);
    if (cachedResponse) {
      const fetchTime = Date.now() - startTime;
      logger.debug(`✅ Friends list cache hit for user: ${userId} (${fetchTime}ms)`);
      sendJsonResponse(res, 200, { ...cachedResponse, fetchTime });
      return;
    }

    // Get friends list using FriendsModule (with Redis caching)
    const friends = await globalProfileManager!.fetchUserFriends(userId);
    const fetchTime = Date.now() - startTime;

    if (!friends) {
      logger.debug(`❌ No friends found for user: ${userId}`);
      const response = createResponse(false, null, 'Failed to fetch friends', `Could not retrieve friends for user ${userId}`, false, fetchTime);
      sendJsonResponse(res, 404, response);
      return;
    }

    logger.debug(`✅ Friends list found for user: ${userId} (${friends.length} friends, ${fetchTime}ms)`);
    
    // Transform friends data for frontend compatibility
    const transformedFriends = friends.map(friend => ({
      id: friend.id,
      username: friend.username,
      display_name: friend.display_name || friend.username,
      avatar_url: friend.avatar_url,
      status: friend.status,
      last_seen: friend.last_seen,
      is_online: friend.is_online,
      friends_since: friend.friends_since,
      // TODO: Add last message from chat cache when implemented
      lastMessage: undefined
    }));

    const response = createResponse(true, { friends: transformedFriends, count: transformedFriends.length }, undefined, 'Friends retrieved successfully', false, fetchTime);
    
    // Cache successful responses
    cacheResponse(cacheKey, response);
    
    sendJsonResponse(res, 200, response);

  } catch (error) {
    const fetchTime = Date.now() - startTime;
    logger.error(`❌ Error fetching friends list for ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch friends list';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Friends list fetch failed', false, fetchTime));
  }
};

// POST /api/friends/batch-status - Get online status for multiple users
const handleBatchStatusCheck = async (req: IncomingMessage, res: ServerResponse, startTime: number): Promise<void> => {
  try {
    logger.debug(`📡 POST batch status check request`);

    const body = await parseRequestBody(req);
    const { userIds, requesterId } = body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      const fetchTime = Date.now() - startTime;
      sendJsonResponse(res, 400, createResponse(false, null, 'userIds array is required', 'Provide an array of user IDs to check status', false, fetchTime));
      return;
    }

    if (userIds.length > 100) {
      const fetchTime = Date.now() - startTime;
      sendJsonResponse(res, 400, createResponse(false, null, 'Too many user IDs', 'Maximum 100 user IDs allowed per request', false, fetchTime));
      return;
    }

    // Use StatusModule to get batch online status (with Redis caching)
    const statusMap = await globalProfileManager!.batchGetOnlineStatus(userIds);
    const fetchTime = Date.now() - startTime;

    // Transform status data for frontend
    const transformedStatuses: Record<string, { isOnline: boolean; lastSeen: string }> = {};
    
    for (const [userId, isOnline] of Object.entries(statusMap)) {
      // Get additional status info if needed
      const statusInfo = await globalProfileManager!.getOnlineStatus(userId);
      transformedStatuses[userId] = {
        isOnline: isOnline,
        lastSeen: statusInfo.lastSeen || new Date().toISOString()
      };
    }

    logger.debug(`✅ Batch status check completed for ${userIds.length} users (${fetchTime}ms)`);
    
    const response = createResponse(true, { 
      statuses: transformedStatuses,
      count: userIds.length,
      requesterId: requesterId
    }, undefined, 'Batch status check completed', false, fetchTime);
    
    sendJsonResponse(res, 200, response);

  } catch (error) {
    const fetchTime = Date.now() - startTime;
    logger.error(`❌ Error in batch status check:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to check batch status';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Batch status check failed', false, fetchTime));
  }
};

// GET /api/friends/{userId}/status/{friendId} - Get friendship status
const handleGetFriendshipStatus = async (userId: string, friendId: string, res: ServerResponse, startTime: number): Promise<void> => {
  try {
    logger.debug(`📡 GET friendship status: ${userId} <-> ${friendId}`);

    if (!isValidUserId(friendId)) {
      const fetchTime = Date.now() - startTime;
      sendJsonResponse(res, 400, createResponse(false, null, 'Invalid friend ID format', 'Friend ID must be valid', false, fetchTime));
      return;
    }

    // Get friendship status using FriendsModule
    const friendshipStatus = await globalProfileManager!.getFriendshipStatus(userId, friendId);
    const fetchTime = Date.now() - startTime;

    logger.debug(`✅ Friendship status retrieved: ${userId} <-> ${friendId} (${fetchTime}ms)`);
    
    const response = createResponse(true, friendshipStatus, undefined, 'Friendship status retrieved successfully', false, fetchTime);
    sendJsonResponse(res, 200, response);

  } catch (error) {
    const fetchTime = Date.now() - startTime;
    logger.error(`❌ Error getting friendship status ${userId} <-> ${friendId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get friendship status';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Friendship status check failed', false, fetchTime));
  }
};

// GET /api/friends/{userId}/online - Get online friends count
const handleGetOnlineFriendsCount = async (userId: string, res: ServerResponse, startTime: number): Promise<void> => {
  try {
    logger.debug(`📡 GET online friends count for user: ${userId}`);

    // Get online friends count using FriendsModule (with Redis caching)
    const onlineCount = await globalProfileManager!.getOnlineFriendsCount(userId);
    const fetchTime = Date.now() - startTime;

    logger.debug(`✅ Online friends count retrieved for ${userId}: ${onlineCount} (${fetchTime}ms)`);
    
    const response = createResponse(true, { 
      onlineCount,
      userId
    }, undefined, 'Online friends count retrieved successfully', false, fetchTime);
    
    sendJsonResponse(res, 200, response);

  } catch (error) {
    const fetchTime = Date.now() - startTime;
    logger.error(`❌ Error getting online friends count for ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get online friends count';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Online friends count check failed', false, fetchTime));
  }
};

// POST /api/friends/{userId}/request/{friendId} - Send friend request
const handleSendFriendRequest = async (userId: string, friendId: string, req: IncomingMessage, res: ServerResponse, startTime: number): Promise<void> => {
  try {
    logger.debug(`📡 POST friend request: ${userId} -> ${friendId}`);

    const body = await parseRequestBody(req);
    const { message } = body;

    if (!isValidUserId(friendId)) {
      const fetchTime = Date.now() - startTime;
      sendJsonResponse(res, 400, createResponse(false, null, 'Invalid friend ID format', 'Friend ID must be valid', false, fetchTime));
      return;
    }

    // Send friend request using FriendsModule
    const result = await globalProfileManager!.sendFriendRequest(userId, friendId, message);
    const fetchTime = Date.now() - startTime;

    if (result.success) {
      logger.info(`✅ Friend request sent: ${userId} -> ${friendId} (${fetchTime}ms)`);
      
      // Invalidate friends cache for both users
      responseCache.delete(`friends_list:${userId}`);
      responseCache.delete(`friends_list:${friendId}`);
      
      const response = createResponse(true, result, undefined, result.message, false, fetchTime);
      sendJsonResponse(res, result.autoAccepted ? 200 : 201, response);
    } else {
      logger.warn(`❌ Friend request failed: ${userId} -> ${friendId}: ${result.message}`);
      const response = createResponse(false, null, result.message, 'Friend request failed', false, fetchTime);
      sendJsonResponse(res, 400, response);
    }

  } catch (error) {
    const fetchTime = Date.now() - startTime;
    logger.error(`❌ Error sending friend request ${userId} -> ${friendId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to send friend request';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Friend request failed', false, fetchTime));
  }
};

// PUT /api/friends/{userId}/accept/{requestId} - Accept friend request
const handleAcceptFriendRequest = async (userId: string, requestId: string, res: ServerResponse, startTime: number): Promise<void> => {
  try {
    logger.debug(`📡 PUT accept friend request: ${userId} accepting ${requestId}`);

    // Accept friend request using FriendsModule
    const result = await globalProfileManager!.acceptFriendRequest(requestId, userId);
    const fetchTime = Date.now() - startTime;

    if (result.success) {
      logger.info(`✅ Friend request accepted: ${userId} accepted ${requestId} (${fetchTime}ms)`);
      
      // Invalidate friends cache (we don't know the other user ID here, so just clear requestor's cache)
      responseCache.delete(`friends_list:${userId}`);
      
      const response = createResponse(true, result, undefined, result.message, false, fetchTime);
      sendJsonResponse(res, 200, response);
    } else {
      logger.warn(`❌ Friend request accept failed: ${userId} accepting ${requestId}: ${result.message}`);
      const response = createResponse(false, null, result.message, 'Failed to accept friend request', false, fetchTime);
      sendJsonResponse(res, 400, response);
    }

  } catch (error) {
    const fetchTime = Date.now() - startTime;
    logger.error(`❌ Error accepting friend request ${userId} accepting ${requestId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to accept friend request';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Friend request accept failed', false, fetchTime));
  }
};

// DELETE /api/friends/{userId}/decline/{requestId} - Decline friend request
const handleDeclineFriendRequest = async (userId: string, requestId: string, res: ServerResponse, startTime: number): Promise<void> => {
  try {
    logger.debug(`📡 DELETE decline friend request: ${userId} declining ${requestId}`);

    // Decline friend request using FriendsModule
    const result = await globalProfileManager!.declineFriendRequest(requestId, userId);
    const fetchTime = Date.now() - startTime;

    if (result.success) {
      logger.info(`✅ Friend request declined: ${userId} declined ${requestId} (${fetchTime}ms)`);
      
      const response = createResponse(true, result, undefined, result.message, false, fetchTime);
      sendJsonResponse(res, 200, response);
    } else {
      logger.warn(`❌ Friend request decline failed: ${userId} declining ${requestId}: ${result.message}`);
      const response = createResponse(false, null, result.message, 'Failed to decline friend request', false, fetchTime);
      sendJsonResponse(res, 400, response);
    }

  } catch (error) {
    const fetchTime = Date.now() - startTime;
    logger.error(`❌ Error declining friend request ${userId} declining ${requestId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to decline friend request';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Friend request decline failed', false, fetchTime));
  }
};

// DELETE /api/friends/{userId}/remove/{friendId} - Remove friend
const handleRemoveFriend = async (userId: string, friendId: string, res: ServerResponse, startTime: number): Promise<void> => {
  try {
    logger.debug(`📡 DELETE remove friend: ${userId} removing ${friendId}`);

    if (!isValidUserId(friendId)) {
      const fetchTime = Date.now() - startTime;
      sendJsonResponse(res, 400, createResponse(false, null, 'Invalid friend ID format', 'Friend ID must be valid', false, fetchTime));
      return;
    }

    // Remove friend using FriendsModule
    const result = await globalProfileManager!.removeFriend(userId, friendId);
    const fetchTime = Date.now() - startTime;

    if (result.success) {
      logger.info(`✅ Friend removed: ${userId} removed ${friendId} (${fetchTime}ms)`);
      
      // Invalidate friends cache for both users
      responseCache.delete(`friends_list:${userId}`);
      responseCache.delete(`friends_list:${friendId}`);
      
      const response = createResponse(true, result, undefined, result.message, false, fetchTime);
      sendJsonResponse(res, 200, response);
    } else {
      logger.warn(`❌ Friend removal failed: ${userId} removing ${friendId}: ${result.message}`);
      const response = createResponse(false, null, result.message, 'Failed to remove friend', false, fetchTime);
      sendJsonResponse(res, 400, response);
    }

  } catch (error) {
    const fetchTime = Date.now() - startTime;
    logger.error(`❌ Error removing friend ${userId} removing ${friendId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to remove friend';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Friend removal failed', false, fetchTime));
  }
};

// GET /api/friends/health
const handleFriendsHealthCheck = async (res: ServerResponse, startTime: number): Promise<void> => {
  try {
    const healthStatus = await globalProfileManager!.testConnection();
    const fetchTime = Date.now() - startTime;
    
    const status = {
      friendsService: 'available',
      database: healthStatus.database ? 'connected' : 'disconnected',
      redis: healthStatus.redis ? 'connected' : 'not_configured',
      overall: healthStatus.overall ? 'healthy' : 'degraded',
      errors: healthStatus.errors || [],
      performance: {
        dbLatency: healthStatus.dbLatency,
        redisLatency: healthStatus.redisLatency,
        cachePerformance: healthStatus.cachePerformance
      },
      cache: {
        responseCache: {
          size: responseCache.size,
          ttl: RESPONSE_CACHE_TTL
        }
      },
      timestamp: new Date().toISOString()
    };

    const httpStatus = healthStatus.overall ? 200 : 503;
    sendJsonResponse(res, httpStatus, createResponse(healthStatus.overall, status, undefined, 'Friends health check completed', false, fetchTime));
    
  } catch (error) {
    const fetchTime = Date.now() - startTime;
    logger.error('❌ Friends health check error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Health check failed';
    sendJsonResponse(res, 503, createResponse(false, null, errorMessage, 'Friends health check failed', false, fetchTime));
  }
};

// Cleanup function for response cache
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  for (const [key, cached] of responseCache.entries()) {
    if ((now - cached.timestamp) > RESPONSE_CACHE_TTL) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => responseCache.delete(key));
  
  if (keysToDelete.length > 0) {
    logger.debug(`🧹 Cleaned ${keysToDelete.length} expired friends API cache entries`);
  }
}, 30000);

// Utility functions for external use
export const getFriendsProfileManagerInstance = (): ProfileManager | null => {
  return globalProfileManager;
};

export const isFriendsManagerReady = (): boolean => {
  return globalProfileManager !== null;
};