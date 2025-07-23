// server/routes/profileRoutes.ts - ENHANCED VERSION WITH COMPREHENSIVE ERROR HANDLING

import { IncomingMessage, ServerResponse } from 'http';
import { ProfileManager } from '../managers/profile/ProfileManager';
import { ValidationSchemas } from '../validation/schemas';
import { logger } from '../utils/logger';
import { URL } from 'url';

// Global ProfileManager instance (will be set from server/index.ts)
let globalProfileManager: ProfileManager | null = null;

export const setProfileManager = (profileManager: ProfileManager) => {
  globalProfileManager = profileManager;
  logger.info('✅ ProfileManager set for API routes');
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

// ✅ ENHANCED: Cache for profile responses (short-term caching)
const responseCache = new Map<string, { response: ApiResponse; timestamp: number }>();
const RESPONSE_CACHE_TTL = 5000; // 5 seconds cache for API responses

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

// Helper function to parse request body with timeout
const parseRequestBody = (req: IncomingMessage): Promise<any> => {
  return new Promise((resolve, reject) => {
    let body = '';
    let timeout: NodeJS.Timeout;

    // ✅ Add timeout for request body parsing
    timeout = setTimeout(() => {
      reject(new Error('Request body parsing timeout'));
    }, 10000); // 10 second timeout

    req.on('data', chunk => {
      body += chunk.toString();
      // ✅ Limit body size to prevent memory issues
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

// Helper function to set CORS headers for API routes
const setApiCorsHeaders = (res: ServerResponse, requestOrigin?: string): void => {
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
  const matches = url.match(/\/api\/profiles\/([^\/\?]+)/);
  return matches ? decodeURIComponent(matches[1]) : null;
};

// Validate userId format
const isValidUserId = (userId: string): boolean => {
  return !!(userId && userId.trim().length > 0 && userId.length <= 200);
};

// ✅ NEW: Get cached response if available and not expired
const getCachedResponse = (cacheKey: string): ApiResponse | null => {
  const cached = responseCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < RESPONSE_CACHE_TTL) {
    return { ...cached.response, cached: true };
  }
  if (cached) {
    responseCache.delete(cacheKey); // Remove expired cache
  }
  return null;
};

// ✅ NEW: Cache response for short term
const cacheResponse = (cacheKey: string, response: ApiResponse): void => {
  responseCache.set(cacheKey, {
    response: { ...response, cached: false },
    timestamp: Date.now()
  });

  // Cleanup old cache entries
  if (responseCache.size > 100) {
    const oldestKeys = Array.from(responseCache.keys()).slice(0, 20);
    oldestKeys.forEach(key => responseCache.delete(key));
  }
};

export const handleProfileRoutes = async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
  const url = req.url || '';
  const method = req.method || 'GET';
  const requestOrigin = req.headers.origin;
  const startTime = Date.now();

  // Set CORS headers for all profile API requests
  setApiCorsHeaders(res, requestOrigin);

  // Handle preflight OPTIONS requests
  if (method === 'OPTIONS') {
    sendJsonResponse(res, 200, createResponse(true, null, undefined, 'CORS preflight successful'));
    return true;
  }

  // Check if this is a profile API route
  if (!url.startsWith('/api/profiles')) {
    return false; // Not a profile route
  }

  // Check if ProfileManager is available
  if (!globalProfileManager) {
    logger.error('❌ ProfileManager not initialized for API routes');
    sendJsonResponse(res, 503, createResponse(false, null, 'Profile service unavailable', 'ProfileManager not initialized'));
    return true;
  }

  try {
    // Route: GET /api/profiles/health
    if (url === '/api/profiles/health' && method === 'GET') {
      await handleHealthCheck(res, startTime);
      return true;
    }

    // Route: GET /api/profiles/stats
    if (url === '/api/profiles/stats' && method === 'GET') {
      await handleProfileStats(res, startTime);
      return true;
    }

    // Extract userId for individual profile operations
    const userId = extractUserId(url);
    if (!userId) {
      sendJsonResponse(res, 400, createResponse(false, null, 'Invalid user ID in URL', 'User ID is required'));
      return true;
    }

    if (!isValidUserId(userId)) {
      sendJsonResponse(res, 400, createResponse(false, null, 'Invalid user ID format', 'User ID must be non-empty and under 200 characters'));
      return true;
    }

    // Route handlers based on method
    switch (method) {
      case 'GET':
        await handleGetProfile(userId, req, res, startTime);
        break;
      case 'POST':
        await handleCreateProfile(userId, req, res, startTime);
        break;
      case 'PUT':
        await handleUpdateProfile(userId, req, res, startTime);
        break;
      case 'DELETE':
        await handleDeleteProfile(userId, req, res, startTime);
        break;
      default:
        sendJsonResponse(res, 405, createResponse(false, null, 'Method not allowed', `${method} not supported for profile routes`));
        break;
    }

    return true;
  } catch (error) {
    const fetchTime = Date.now() - startTime;
    logger.error('❌ Profile API route error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Internal server error', false, fetchTime));
    return true;
  }
};

// ✅ ENHANCED: GET /api/profiles/:userId with caching and better error handling
const handleGetProfile = async (userId: string, req: IncomingMessage, res: ServerResponse, startTime: number): Promise<void> => {
  try {
    logger.debug(`📡 GET profile request for user: ${userId}`);

    // ✅ Check cache first
    const cacheKey = `profile:${userId}`;
    const cachedResponse = getCachedResponse(cacheKey);
    if (cachedResponse) {
      const fetchTime = Date.now() - startTime;
      logger.debug(`✅ Profile cache hit for user: ${userId} (${fetchTime}ms)`);
      sendJsonResponse(res, 200, { ...cachedResponse, fetchTime });
      return;
    }

    const profile = await globalProfileManager!.fetchUserProfile(userId);
    const fetchTime = Date.now() - startTime;

    if (!profile) {
      logger.debug(`❌ Profile not found for user: ${userId}`);
      const response = createResponse(false, null, 'Profile not found', `No profile exists for user ${userId}`, false, fetchTime);
      sendJsonResponse(res, 404, response);
      return;
    }

    logger.debug(`✅ Profile found for user: ${userId} (${fetchTime}ms)`);
    
    // ✅ ENHANCED: Clean sensitive data before sending
    const cleanProfile = cleanProfileForResponse(profile);
    const response = createResponse(true, cleanProfile, undefined, 'Profile retrieved successfully', false, fetchTime);
    
    // Cache successful responses
    cacheResponse(cacheKey, response);
    
    sendJsonResponse(res, 200, response);

  } catch (error) {
    const fetchTime = Date.now() - startTime;
    logger.error(`❌ Error fetching profile for ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch profile';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Profile fetch failed', false, fetchTime));
  }
};

// ✅ NEW: Clean profile data before sending to client
const cleanProfileForResponse = (profile: any) => {
  const cleaned = { ...profile };
  
  // Remove or truncate large fields for API responses
  if (cleaned.profile_card_css && cleaned.profile_card_css.length > 10000) {
    cleaned.profile_card_css = cleaned.profile_card_css.substring(0, 10000) + '...';
  }
  
  // Convert base64 images to placeholder URLs for large images
  if (cleaned.avatar_url && cleaned.avatar_url.startsWith('data:') && cleaned.avatar_url.length > 50000) {
    cleaned.avatar_url_large = true; // Flag to indicate large image
    cleaned.avatar_url = ''; // Remove large base64 data
  }
  
  if (cleaned.banner_url && cleaned.banner_url.startsWith('data:') && cleaned.banner_url.length > 50000) {
    cleaned.banner_url_large = true; // Flag to indicate large image
    cleaned.banner_url = ''; // Remove large base64 data
  }
  
  return cleaned;
};

// POST /api/profiles/:userId
const handleCreateProfile = async (userId: string, req: IncomingMessage, res: ServerResponse, startTime: number): Promise<void> => {
  try {
    logger.debug(`📡 POST profile request for user: ${userId}`);

    const body = await parseRequestBody(req);
    const fetchTime = Date.now() - startTime;
    
    if (!body.username) {
      sendJsonResponse(res, 400, createResponse(false, null, 'Username is required', 'Username must be provided to create a profile', false, fetchTime));
      return;
    }

    // Validate username length and format
    if (body.username.length < 3 || body.username.length > 20) {
      sendJsonResponse(res, 400, createResponse(false, null, 'Invalid username length', 'Username must be 3-20 characters', false, fetchTime));
      return;
    }

    // Check if profile already exists
    const existingProfile = await globalProfileManager!.fetchUserProfile(userId);
    if (existingProfile) {
      logger.debug(`❌ Profile already exists for user: ${userId}`);
      const finalFetchTime = Date.now() - startTime;
      sendJsonResponse(res, 409, createResponse(false, null, 'Profile already exists', `Profile for user ${userId} already exists`, false, finalFetchTime));
      return;
    }

    const success = await globalProfileManager!.createUserProfile(userId, body.username, body.displayName);

    if (success) {
      // Fetch the created profile to return it
      const newProfile = await globalProfileManager!.fetchUserProfile(userId);
      const finalFetchTime = Date.now() - startTime;
      
      logger.info(`✅ Profile created for user: ${userId} with username: ${body.username} (${finalFetchTime}ms)`);
      
      // Invalidate cache for this user
      responseCache.delete(`profile:${userId}`);
      
      const cleanProfile = newProfile ? cleanProfileForResponse(newProfile) : null;
      sendJsonResponse(res, 201, createResponse(true, cleanProfile, undefined, 'Profile created successfully', false, finalFetchTime));
    } else {
      const finalFetchTime = Date.now() - startTime;
      logger.error(`❌ Failed to create profile for user: ${userId}`);
      sendJsonResponse(res, 500, createResponse(false, null, 'Profile creation failed', 'Failed to create profile in database', false, finalFetchTime));
    }

  } catch (error) {
    const fetchTime = Date.now() - startTime;
    logger.error(`❌ Error creating profile for ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create profile';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Profile creation failed', false, fetchTime));
  }
};

// ✅ ENHANCED: PUT /api/profiles/:userId with better validation and caching
const handleUpdateProfile = async (userId: string, req: IncomingMessage, res: ServerResponse, startTime: number): Promise<void> => {
  try {
    logger.debug(`📡 PUT profile request for user: ${userId}`);

    const body = await parseRequestBody(req);
    
    if (!body || Object.keys(body).length === 0) {
      const fetchTime = Date.now() - startTime;
      sendJsonResponse(res, 400, createResponse(false, null, 'Update data is required', 'Request body must contain fields to update', false, fetchTime));
      return;
    }

    // Check if profile exists
    const existingProfile = await globalProfileManager!.fetchUserProfile(userId);
    if (!existingProfile) {
      const fetchTime = Date.now() - startTime;
      logger.debug(`❌ Profile not found for update: ${userId}`);
      sendJsonResponse(res, 404, createResponse(false, null, 'Profile not found', `No profile exists for user ${userId}`, false, fetchTime));
      return;
    }

    // Validate update data (basic validation)
    const allowedFields = [
      'username', 'display_name', 'avatar_url', 'banner_url', 'pronouns', 'bio',
      'status', 'display_name_color', 'display_name_animation', 'rainbow_speed',
      'badges', 'profile_complete', 'profile_card_css', 'easy_customization_data'
    ];

    const filteredUpdates: any = {};
    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = value;
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      const fetchTime = Date.now() - startTime;
      sendJsonResponse(res, 400, createResponse(false, null, 'No valid fields to update', `Allowed fields: ${allowedFields.join(', ')}`, false, fetchTime));
      return;
    }

    // ✅ ENHANCED: Validate field sizes to prevent oversized profiles
    if (filteredUpdates.profile_card_css && filteredUpdates.profile_card_css.length > 20000) {
      const fetchTime = Date.now() - startTime;
      sendJsonResponse(res, 400, createResponse(false, null, 'Profile CSS too large', 'Profile CSS must be under 20KB', false, fetchTime));
      return;
    }

    if (filteredUpdates.bio && filteredUpdates.bio.length > 1000) {
      const fetchTime = Date.now() - startTime;
      sendJsonResponse(res, 400, createResponse(false, null, 'Bio too long', 'Bio must be under 1000 characters', false, fetchTime));
      return;
    }

    // Check for base64 image size limits
    if (filteredUpdates.avatar_url && filteredUpdates.avatar_url.startsWith('data:') && filteredUpdates.avatar_url.length > 100000) {
      const fetchTime = Date.now() - startTime;
      sendJsonResponse(res, 400, createResponse(false, null, 'Avatar image too large', 'Avatar must be under 100KB when base64 encoded', false, fetchTime));
      return;
    }

    if (filteredUpdates.banner_url && filteredUpdates.banner_url.startsWith('data:') && filteredUpdates.banner_url.length > 100000) {
      const fetchTime = Date.now() - startTime;
      sendJsonResponse(res, 400, createResponse(false, null, 'Banner image too large', 'Banner must be under 100KB when base64 encoded', false, fetchTime));
      return;
    }

    const success = await globalProfileManager!.updateUserProfile(userId, filteredUpdates);

    if (success) {
      // Fetch updated profile to return it
      const updatedProfile = await globalProfileManager!.fetchUserProfile(userId);
      const finalFetchTime = Date.now() - startTime;
      
      logger.info(`✅ Profile updated for user: ${userId} (${finalFetchTime}ms)`);
      
      // Invalidate cache for this user
      responseCache.delete(`profile:${userId}`);
      
      const cleanProfile = updatedProfile ? cleanProfileForResponse(updatedProfile) : null;
      sendJsonResponse(res, 200, createResponse(true, cleanProfile, undefined, 'Profile updated successfully', false, finalFetchTime));
    } else {
      const finalFetchTime = Date.now() - startTime;
      logger.error(`❌ Failed to update profile for user: ${userId}`);
      sendJsonResponse(res, 500, createResponse(false, null, 'Profile update failed', 'Failed to update profile in database', false, finalFetchTime));
    }

  } catch (error) {
    const fetchTime = Date.now() - startTime;
    logger.error(`❌ Error updating profile for ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update profile';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Profile update failed', false, fetchTime));
  }
};

// DELETE /api/profiles/:userId
const handleDeleteProfile = async (userId: string, req: IncomingMessage, res: ServerResponse, startTime: number): Promise<void> => {
  try {
    logger.debug(`📡 DELETE profile request for user: ${userId}`);

    // Check if profile exists
    const existingProfile = await globalProfileManager!.fetchUserProfile(userId);
    if (!existingProfile) {
      const fetchTime = Date.now() - startTime;
      logger.debug(`❌ Profile not found for deletion: ${userId}`);
      sendJsonResponse(res, 404, createResponse(false, null, 'Profile not found', `No profile exists for user ${userId}`, false, fetchTime));
      return;
    }

    const success = await globalProfileManager!.deleteUserProfile(userId);

    if (success) {
      const fetchTime = Date.now() - startTime;
      logger.info(`✅ Profile deleted for user: ${userId} (${fetchTime}ms)`);
      
      // Invalidate cache for this user
      responseCache.delete(`profile:${userId}`);
      
      sendJsonResponse(res, 200, createResponse(true, null, undefined, 'Profile deleted successfully', false, fetchTime));
    } else {
      const fetchTime = Date.now() - startTime;
      logger.error(`❌ Failed to delete profile for user: ${userId}`);
      sendJsonResponse(res, 500, createResponse(false, null, 'Profile deletion failed', 'Failed to delete profile from database', false, fetchTime));
    }

  } catch (error) {
    const fetchTime = Date.now() - startTime;
    logger.error(`❌ Error deleting profile for ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete profile';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Profile deletion failed', false, fetchTime));
  }
};

// ✅ ENHANCED: GET /api/profiles/health with comprehensive diagnostics
const handleHealthCheck = async (res: ServerResponse, startTime: number): Promise<void> => {
  try {
    const healthStatus = await globalProfileManager!.testConnection();
    const fetchTime = Date.now() - startTime;
    
    const status = {
      profileService: 'available',
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
    sendJsonResponse(res, httpStatus, createResponse(healthStatus.overall, status, undefined, 'Health check completed', false, fetchTime));
    
  } catch (error) {
    const fetchTime = Date.now() - startTime;
    logger.error('❌ Profile health check error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Health check failed';
    sendJsonResponse(res, 503, createResponse(false, null, errorMessage, 'Health check failed', false, fetchTime));
  }
};

// ✅ ENHANCED: GET /api/profiles/stats with detailed metrics
const handleProfileStats = async (res: ServerResponse, startTime: number): Promise<void> => {
  try {
    const stats = globalProfileManager!.getProfileStats();
    const fetchTime = Date.now() - startTime;
    
    const enhancedStats = {
      ...stats,
      api: {
        responseCache: {
          size: responseCache.size,
          maxSize: 100,
          ttl: RESPONSE_CACHE_TTL,
          hitRate: calculateCacheHitRate()
        },
        performance: {
          averageResponseTime: getAverageResponseTime(),
          totalRequests: getTotalRequests()
        }
      }
    };
    
    sendJsonResponse(res, 200, createResponse(true, enhancedStats, undefined, 'Profile statistics retrieved', false, fetchTime));
    
  } catch (error) {
    const fetchTime = Date.now() - startTime;
    logger.error('❌ Profile stats error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get stats';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Stats retrieval failed', false, fetchTime));
  }
};

// ✅ NEW: Performance tracking variables
let totalRequests = 0;
let responseTimes: number[] = [];
let cacheHits = 0;
let cacheMisses = 0;

// Update these counters in the response functions
const trackRequest = (responseTime: number, wasCached: boolean) => {
  totalRequests++;
  responseTimes.push(responseTime);
  
  if (wasCached) {
    cacheHits++;
  } else {
    cacheMisses++;
  }
  
  // Keep only last 1000 response times for memory efficiency
  if (responseTimes.length > 1000) {
    responseTimes = responseTimes.slice(-500);
  }
};

const calculateCacheHitRate = (): number => {
  const total = cacheHits + cacheMisses;
  return total > 0 ? (cacheHits / total) * 100 : 0;
};

const getAverageResponseTime = (): number => {
  if (responseTimes.length === 0) return 0;
  return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
};

const getTotalRequests = (): number => totalRequests;

// ✅ NEW: Cleanup function for response cache
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
    logger.debug(`🧹 Cleaned ${keysToDelete.length} expired response cache entries`);
  }
}, 30000); // Clean every 30 seconds

// Utility functions for external use
export const getProfileManagerInstance = (): ProfileManager | null => {
  return globalProfileManager;
};

export const isProfileManagerReady = (): boolean => {
  return globalProfileManager !== null;
};

// ✅ NEW: Get API statistics
export const getApiStats = () => {
  return {
    totalRequests: getTotalRequests(),
    averageResponseTime: getAverageResponseTime(),
    cacheHitRate: calculateCacheHitRate(),
    cacheSize: responseCache.size,
    responseTimes: responseTimes.slice(-10) // Last 10 response times
  };
};

// ✅ NEW: Clear caches (useful for debugging)
export const clearApiCaches = () => {
  responseCache.clear();
  responseTimes = [];
  totalRequests = 0;
  cacheHits = 0;
  cacheMisses = 0;
  logger.info('🧹 Cleared all API caches and statistics');
};