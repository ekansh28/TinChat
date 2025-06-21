// server/routes/profileRoutes.ts - Profile API endpoints for frontend integration
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
}

// Helper function to create standardized API responses
const createResponse = <T>(success: boolean, data?: T, error?: string, message?: string): ApiResponse<T> => ({
  success,
  data,
  error,
  message,
  timestamp: new Date().toISOString()
});

// Helper function to parse request body
const parseRequestBody = (req: IncomingMessage): Promise<any> => {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
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
    req.on('error', reject);
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

export const handleProfileRoutes = async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
  const url = req.url || '';
  const method = req.method || 'GET';
  const requestOrigin = req.headers.origin;

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
      await handleHealthCheck(res);
      return true;
    }

    // Route: GET /api/profiles/stats
    if (url === '/api/profiles/stats' && method === 'GET') {
      await handleProfileStats(res);
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
        await handleGetProfile(userId, req, res);
        break;
      case 'POST':
        await handleCreateProfile(userId, req, res);
        break;
      case 'PUT':
        await handleUpdateProfile(userId, req, res);
        break;
      case 'DELETE':
        await handleDeleteProfile(userId, req, res);
        break;
      default:
        sendJsonResponse(res, 405, createResponse(false, null, 'Method not allowed', `${method} not supported for profile routes`));
        break;
    }

    return true;
  } catch (error) {
    logger.error('❌ Profile API route error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Internal server error'));
    return true;
  }
};

// GET /api/profiles/:userId
const handleGetProfile = async (userId: string, req: IncomingMessage, res: ServerResponse): Promise<void> => {
  try {
    logger.debug(`📡 GET profile request for user: ${userId}`);

    const profile = await globalProfileManager!.fetchUserProfile(userId);

    if (!profile) {
      logger.debug(`❌ Profile not found for user: ${userId}`);
      sendJsonResponse(res, 404, createResponse(false, null, 'Profile not found', `No profile exists for user ${userId}`));
      return;
    }

    logger.debug(`✅ Profile found for user: ${userId}`);
    sendJsonResponse(res, 200, createResponse(true, profile, undefined, 'Profile retrieved successfully'));

  } catch (error) {
    logger.error(`❌ Error fetching profile for ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch profile';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Profile fetch failed'));
  }
};

// POST /api/profiles/:userId
const handleCreateProfile = async (userId: string, req: IncomingMessage, res: ServerResponse): Promise<void> => {
  try {
    logger.debug(`📡 POST profile request for user: ${userId}`);

    const body = await parseRequestBody(req);
    
    if (!body.username) {
      sendJsonResponse(res, 400, createResponse(false, null, 'Username is required', 'Username must be provided to create a profile'));
      return;
    }

    // Validate username length and format
    if (body.username.length < 3 || body.username.length > 20) {
      sendJsonResponse(res, 400, createResponse(false, null, 'Invalid username length', 'Username must be 3-20 characters'));
      return;
    }

    // Check if profile already exists
    const existingProfile = await globalProfileManager!.fetchUserProfile(userId);
    if (existingProfile) {
      logger.debug(`❌ Profile already exists for user: ${userId}`);
      sendJsonResponse(res, 409, createResponse(false, null, 'Profile already exists', `Profile for user ${userId} already exists`));
      return;
    }

    const success = await globalProfileManager!.createUserProfile(userId, body.username, body.displayName);

    if (success) {
      // Fetch the created profile to return it
      const newProfile = await globalProfileManager!.fetchUserProfile(userId);
      logger.info(`✅ Profile created for user: ${userId} with username: ${body.username}`);
      sendJsonResponse(res, 201, createResponse(true, newProfile, undefined, 'Profile created successfully'));
    } else {
      logger.error(`❌ Failed to create profile for user: ${userId}`);
      sendJsonResponse(res, 500, createResponse(false, null, 'Profile creation failed', 'Failed to create profile in database'));
    }

  } catch (error) {
    logger.error(`❌ Error creating profile for ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create profile';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Profile creation failed'));
  }
};

// PUT /api/profiles/:userId
const handleUpdateProfile = async (userId: string, req: IncomingMessage, res: ServerResponse): Promise<void> => {
  try {
    logger.debug(`📡 PUT profile request for user: ${userId}`);

    const body = await parseRequestBody(req);
    
    if (!body || Object.keys(body).length === 0) {
      sendJsonResponse(res, 400, createResponse(false, null, 'Update data is required', 'Request body must contain fields to update'));
      return;
    }

    // Check if profile exists
    const existingProfile = await globalProfileManager!.fetchUserProfile(userId);
    if (!existingProfile) {
      logger.debug(`❌ Profile not found for update: ${userId}`);
      sendJsonResponse(res, 404, createResponse(false, null, 'Profile not found', `No profile exists for user ${userId}`));
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
      sendJsonResponse(res, 400, createResponse(false, null, 'No valid fields to update', `Allowed fields: ${allowedFields.join(', ')}`));
      return;
    }

    const success = await globalProfileManager!.updateUserProfile(userId, filteredUpdates);

    if (success) {
      // Fetch updated profile to return it
      const updatedProfile = await globalProfileManager!.fetchUserProfile(userId);
      logger.info(`✅ Profile updated for user: ${userId}`);
      sendJsonResponse(res, 200, createResponse(true, updatedProfile, undefined, 'Profile updated successfully'));
    } else {
      logger.error(`❌ Failed to update profile for user: ${userId}`);
      sendJsonResponse(res, 500, createResponse(false, null, 'Profile update failed', 'Failed to update profile in database'));
    }

  } catch (error) {
    logger.error(`❌ Error updating profile for ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update profile';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Profile update failed'));
  }
};

// DELETE /api/profiles/:userId
const handleDeleteProfile = async (userId: string, req: IncomingMessage, res: ServerResponse): Promise<void> => {
  try {
    logger.debug(`📡 DELETE profile request for user: ${userId}`);

    // Check if profile exists
    const existingProfile = await globalProfileManager!.fetchUserProfile(userId);
    if (!existingProfile) {
      logger.debug(`❌ Profile not found for deletion: ${userId}`);
      sendJsonResponse(res, 404, createResponse(false, null, 'Profile not found', `No profile exists for user ${userId}`));
      return;
    }

    const success = await globalProfileManager!.deleteUserProfile(userId);

    if (success) {
      logger.info(`✅ Profile deleted for user: ${userId}`);
      sendJsonResponse(res, 200, createResponse(true, null, undefined, 'Profile deleted successfully'));
    } else {
      logger.error(`❌ Failed to delete profile for user: ${userId}`);
      sendJsonResponse(res, 500, createResponse(false, null, 'Profile deletion failed', 'Failed to delete profile from database'));
    }

  } catch (error) {
    logger.error(`❌ Error deleting profile for ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete profile';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Profile deletion failed'));
  }
};

// GET /api/profiles/health
const handleHealthCheck = async (res: ServerResponse): Promise<void> => {
  try {
    const healthStatus = await globalProfileManager!.testConnection();
    
    const status = {
      profileService: 'available',
      database: healthStatus.database ? 'connected' : 'disconnected',
      redis: healthStatus.redis ? 'connected' : 'not_configured',
      overall: healthStatus.overall ? 'healthy' : 'degraded',
      errors: healthStatus.errors || [],
      timestamp: new Date().toISOString()
    };

    const httpStatus = healthStatus.overall ? 200 : 503;
    sendJsonResponse(res, httpStatus, createResponse(healthStatus.overall, status, undefined, 'Health check completed'));
    
  } catch (error) {
    logger.error('❌ Profile health check error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Health check failed';
    sendJsonResponse(res, 503, createResponse(false, null, errorMessage, 'Health check failed'));
  }
};

// GET /api/profiles/stats
const handleProfileStats = async (res: ServerResponse): Promise<void> => {
  try {
    const stats = globalProfileManager!.getProfileStats();
    sendJsonResponse(res, 200, createResponse(true, stats, undefined, 'Profile statistics retrieved'));
    
  } catch (error) {
    logger.error('❌ Profile stats error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get stats';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Stats retrieval failed'));
  }
};

// Utility functions for external use
export const getProfileManagerInstance = (): ProfileManager | null => {
  return globalProfileManager;
};

export const isProfileManagerReady = (): boolean => {
  return globalProfileManager !== null;
};