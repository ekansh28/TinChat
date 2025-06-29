// server/routes/profileRoutes.ts - ENHANCED WITH XATA AND CLERK INTEGRATION
import { IncomingMessage, ServerResponse } from 'http';
import { ProfileManager } from '../managers/profile/ProfileManager';
import { verifyOptionalClerkToken, verifyClerkToken, getClerkUserProfile } from '../middleware/clerkAuth';
import { getXataClient } from '../config/xata';
import { logger } from '../utils/logger';
import { URL } from 'url';
import { 
  UserProfile, 
  UserStatus, 
  AuthResult, 
  AuthInfo, 
  CleanedProfile,
  ApiResponse,
  UserSearchResult
} from '../types/User';

// Global ProfileManager instance (will be set from server/index.ts)
let globalProfileManager: ProfileManager | null = null;

export const setProfileManager = (profileManager: ProfileManager) => {
  globalProfileManager = profileManager;
  logger.info('✅ ProfileManager set for API routes');
};

// Cache for profile responses (short-term caching)
const responseCache = new Map<string, { response: ApiResponse; timestamp: number }>();
const RESPONSE_CACHE_TTL = 5000; // 5 seconds cache for API responses

// Helper function to create standardized API responses
const createResponse = <T>(
  success: boolean, 
  data?: T, 
  error?: string, 
  message?: string,
  cached = false,
  fetchTime?: number,
  authenticated = false,
  source?: 'xata' | 'supabase' | 'cache',
  authInfo?: AuthInfo
): ApiResponse<T> => ({
  success,
  data,
  error,
  message,
  timestamp: new Date().toISOString(),
  cached,
  fetchTime,
  authenticated,
  source,
  auth: authInfo
});

// Helper function to parse request body with timeout
const parseRequestBody = (req: IncomingMessage): Promise<any> => {
  return new Promise((resolve, reject) => {
    let body = '';
    let timeout: NodeJS.Timeout;

    timeout = setTimeout(() => {
      reject(new Error('Request body parsing timeout'));
    }, 10000); // 10 second timeout

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

// Validate userId format (Clerk user IDs typically start with user_)
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
    responseCache.delete(cacheKey); // Remove expired cache
  }
  return null;
};

// Cache response for short term
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

// Helper to get auth info for response
const getAuthInfo = async (userId: string): Promise<AuthInfo> => {
  try {
    const clerkUser = await getClerkUserProfile(userId);
    if (clerkUser) {
      return {
        userId: clerkUser.id,
        username: clerkUser.username,
        email: clerkUser.emailAddresses[0]?.emailAddress
      };
    }
  } catch (error) {
    logger.debug(`Could not fetch auth info for ${userId}:`, error);
  }
  return { userId };
};

// ✅ NEW: Clean profile data based on whether user is viewing their own profile
const cleanProfileForResponse = (profile: UserProfile | UserSearchResult, isOwnProfile: boolean): CleanedProfile => {
  const cleaned: CleanedProfile = { ...profile };
  
  // Remove sensitive data if not own profile
  if (!isOwnProfile) {
    delete cleaned.easy_customization_data;
    delete cleaned.blocked_users;
    // Truncate bio for public view
    if (cleaned.bio && cleaned.bio.length > 200) {
      cleaned.bio = cleaned.bio.substring(0, 200) + '...';
    }
  }
  
  // Remove or truncate large fields for API responses
  if (cleaned.profile_card_css && cleaned.profile_card_css.length > 10000) {
    cleaned.profile_card_css = cleaned.profile_card_css.substring(0, 10000) + '...';
  }
  
  // Convert base64 images to placeholder URLs for large images
  if (cleaned.avatar_url && cleaned.avatar_url.startsWith('data:') && cleaned.avatar_url.length > 50000) {
    cleaned.avatar_url_large = true;
    cleaned.avatar_url = '';
  }
  
  if (cleaned.banner_url && cleaned.banner_url.startsWith('data:') && cleaned.banner_url.length > 50000) {
    cleaned.banner_url_large = true;
    cleaned.banner_url = '';
  }
  
  return cleaned;
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

  try {
    // ✅ Verify authentication for all requests
    const authResult: AuthResult = await verifyOptionalClerkToken(req);
    const authInfo: AuthInfo | undefined = authResult.userId ? await getAuthInfo(authResult.userId) : undefined;
    
    // Route: GET /api/profiles/health
    if (url === '/api/profiles/health' && method === 'GET') {
      await handleHealthCheck(res, startTime, authResult.isAuthenticated, authInfo);
      return true;
    }

    // Route: GET /api/profiles/stats
    if (url === '/api/profiles/stats' && method === 'GET') {
      await handleProfileStats(res, startTime, authResult.isAuthenticated, authInfo);
      return true;
    }

    // Route: POST /api/profiles/search
    if (url === '/api/profiles/search' && method === 'POST') {
      await handleSearchProfiles(req, res, startTime, authResult, authInfo);
      return true;
    }

    // Route: POST /api/profiles/sync
    if (url === '/api/profiles/sync' && method === 'POST') {
      await handleSyncProfile(req, res, startTime, authResult, authInfo);
      return true;
    }

    // Extract userId for individual profile operations
    const userId = extractUserId(url);
    if (!userId) {
      sendJsonResponse(res, 400, createResponse(false, null, 'Invalid user ID in URL', 'User ID is required', false, Date.now() - startTime, authResult.isAuthenticated, undefined, authInfo));
      return true;
    }

    if (!isValidUserId(userId)) {
      sendJsonResponse(res, 400, createResponse(false, null, 'Invalid user ID format', 'User ID must be non-empty and under 200 characters', false, Date.now() - startTime, authResult.isAuthenticated, undefined, authInfo));
      return true;
    }

    // ✅ Check if user is accessing their own profile or if they're authenticated
    const isOwnProfile = authResult.userId === userId;
    const canModify = isOwnProfile; // Only allow modifications to own profile

    // Route handlers based on method
    switch (method) {
      case 'GET':
        await handleGetProfile(userId, req, res, startTime, authResult, authInfo);
        break;
      case 'POST':
        if (!canModify) {
          sendJsonResponse(res, 403, createResponse(false, null, 'Forbidden', 'You can only create your own profile', false, Date.now() - startTime, authResult.isAuthenticated, undefined, authInfo));
          return true;
        }
        await handleCreateProfile(userId, req, res, startTime, authResult, authInfo);
        break;
      case 'PUT':
        if (!canModify) {
          sendJsonResponse(res, 403, createResponse(false, null, 'Forbidden', 'You can only update your own profile', false, Date.now() - startTime, authResult.isAuthenticated, undefined, authInfo));
          return true;
        }
        await handleUpdateProfile(userId, req, res, startTime, authResult, authInfo);
        break;
      case 'DELETE':
        if (!canModify) {
          sendJsonResponse(res, 403, createResponse(false, null, 'Forbidden', 'You can only delete your own profile', false, Date.now() - startTime, authResult.isAuthenticated, undefined, authInfo));
          return true;
        }
        await handleDeleteProfile(userId, req, res, startTime, authResult, authInfo);
        break;
      default:
        sendJsonResponse(res, 405, createResponse(false, null, 'Method not allowed', `${method} not supported for profile routes`, false, Date.now() - startTime, authResult.isAuthenticated, undefined, authInfo));
        break;
    }

    return true;
  } catch (error) {
    const fetchTime = Date.now() - startTime;
    logger.error('❌ Profile API route error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Internal server error', false, fetchTime, false));
    return true;
  }
};

// ✅ ENHANCED: GET /api/profiles/:userId with Xata integration and Clerk auth
const handleGetProfile = async (
  userId: string, 
  req: IncomingMessage, 
  res: ServerResponse, 
  startTime: number,
  authResult: AuthResult,
  authInfo?: AuthInfo
): Promise<void> => {
  try {
    logger.debug(`📡 GET profile request for user: ${userId} (authenticated: ${authResult.isAuthenticated})`);

    // Check cache first
    const cacheKey = `profile:${userId}`;
    const cachedResponse = getCachedResponse(cacheKey);
    if (cachedResponse) {
      const fetchTime = Date.now() - startTime;
      logger.debug(`✅ Profile cache hit for user: ${userId} (${fetchTime}ms)`);
      sendJsonResponse(res, 200, { ...cachedResponse, fetchTime, authenticated: authResult.isAuthenticated, auth: authInfo });
      return;
    }

    // ✅ NEW: Try Xata first, fallback to ProfileManager (Supabase)
    const xataClient = getXataClient();
    let profile: UserProfile | null = null;
    let source: 'xata' | 'supabase' | 'cache' = 'xata';

    if (xataClient) {
      try {
        profile = await xataClient.getUserProfile(userId);
        source = 'xata';
        logger.debug(`📊 Profile fetched from Xata for user: ${userId}`);
      } catch (error) {
        logger.warn(`⚠️ Xata fetch failed for ${userId}, trying ProfileManager:`, error);
      }
    }

    // Fallback to ProfileManager (Supabase) if Xata fails or no profile found
    if (!profile && globalProfileManager) {
      try {
        profile = await globalProfileManager.fetchUserProfile(userId);
        source = 'supabase';
        logger.debug(`📊 Profile fetched from ProfileManager (Supabase) for user: ${userId}`);
      } catch (error) {
        logger.warn(`⚠️ ProfileManager fetch failed for ${userId}:`, error);
      }
    }

    const fetchTime = Date.now() - startTime;

    if (!profile) {
      logger.debug(`❌ Profile not found for user: ${userId}`);
      const response = createResponse(false, null, 'Profile not found', `No profile exists for user ${userId}`, false, fetchTime, authResult.isAuthenticated, source, authInfo);
      sendJsonResponse(res, 404, response);
      return;
    }

    logger.debug(`✅ Profile found for user: ${userId} from ${source} (${fetchTime}ms)`);
    
    // Clean sensitive data before sending
    const cleanProfile = cleanProfileForResponse(profile, authResult.userId === userId);
    const response = createResponse(true, { ...cleanProfile, source }, undefined, 'Profile retrieved successfully', false, fetchTime, authResult.isAuthenticated, source, authInfo);
    
    // Cache successful responses
    cacheResponse(cacheKey, response);
    
    sendJsonResponse(res, 200, response);

  } catch (error) {
    const fetchTime = Date.now() - startTime;
    logger.error(`❌ Error fetching profile for ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch profile';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Profile fetch failed', false, fetchTime, authResult.isAuthenticated, undefined, authInfo));
  }
};

// ✅ ENHANCED: POST /api/profiles/:userId with Xata integration and Clerk authentication
const handleCreateProfile = async (
  userId: string, 
  req: IncomingMessage, 
  res: ServerResponse, 
  startTime: number,
  authResult: AuthResult,
  authInfo?: AuthInfo
): Promise<void> => {
  try {
    logger.debug(`📡 POST profile request for user: ${userId} (authenticated: ${authResult.isAuthenticated})`);

    if (!authResult.isAuthenticated || authResult.userId !== userId) {
      const fetchTime = Date.now() - startTime;
      sendJsonResponse(res, 401, createResponse(false, null, 'Unauthorized', 'Authentication required to create profile', false, fetchTime, authResult.isAuthenticated, undefined, authInfo));
      return;
    }

    const body = await parseRequestBody(req);
    
    // ✅ NEW: If no username provided, try to get it from Clerk
    let username = body.username;
    let displayName = body.display_name;
    
    if (!username) {
      try {
        const clerkUser = await getClerkUserProfile(userId);
        if (clerkUser) {
          username = clerkUser.username || `user_${userId.slice(-8)}`;
          displayName = displayName || clerkUser.firstName || clerkUser.username;
          logger.debug(`📋 Using Clerk data for profile creation: username=${username}, displayName=${displayName}`);
        }
      } catch (error) {
        logger.debug('Could not fetch Clerk user data:', error);
      }
    }
    
    if (!username) {
      const fetchTime = Date.now() - startTime;
      sendJsonResponse(res, 400, createResponse(false, null, 'Username is required', 'Username must be provided to create a profile', false, fetchTime, authResult.isAuthenticated, undefined, authInfo));
      return;
    }

    // Validate username length and format
    if (username.length < 3 || username.length > 20) {
      const fetchTime = Date.now() - startTime;
      sendJsonResponse(res, 400, createResponse(false, null, 'Invalid username length', 'Username must be 3-20 characters', false, fetchTime, authResult.isAuthenticated, undefined, authInfo));
      return;
    }

    // ✅ NEW: Try to create profile in Xata first
    const xataClient = getXataClient();
    let success = false;
    let source: 'xata' | 'supabase' = 'xata';
    let newProfile: UserProfile | null = null;

    if (xataClient) {
      try {
        // Check if profile already exists in Xata
        const existingProfile = await xataClient.getUserProfile(userId);
        if (existingProfile) {
          const fetchTime = Date.now() - startTime;
          logger.debug(`❌ Profile already exists in Xata for user: ${userId}`);
          sendJsonResponse(res, 409, createResponse(false, null, 'Profile already exists', `Profile for user ${userId} already exists`, false, fetchTime, authResult.isAuthenticated, 'xata', authInfo));
          return;
        }

        // Create profile in Xata with enhanced data from Clerk
        const profileData: Partial<UserProfile> = {
          username,
          display_name: displayName || username,
          avatar_url: body.avatar_url || '',
          banner_url: body.banner_url || '',
          pronouns: body.pronouns || '',
          bio: body.bio || '',
          status: (body.status as UserStatus) || 'online',
          is_online: body.is_online !== undefined ? body.is_online : true,
          last_seen: new Date().toISOString(),
          profile_complete: body.profile_complete !== undefined ? body.profile_complete : true,
          display_name_color: body.display_name_color || '#667eea',
          display_name_animation: body.display_name_animation || 'none',
          rainbow_speed: body.rainbow_speed || 3,
          badges: body.badges || [],
          blocked_users: body.blocked_users || [],
          profile_card_css: body.profile_card_css || '',
          easy_customization_data: body.easy_customization_data || {}
        };

        newProfile = await xataClient.createUserProfile(userId, profileData);
        success = true;
        source = 'xata';
        logger.info(`✅ Profile created in Xata for user: ${userId} with username: ${username}`);

      } catch (error: any) {
        logger.warn(`⚠️ Xata profile creation failed for ${userId}, trying ProfileManager:`, error);
        
        // Check for username conflict in error message
        if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
          const fetchTime = Date.now() - startTime;
          sendJsonResponse(res, 409, createResponse(false, null, 'Username taken', 'This username is already taken', false, fetchTime, authResult.isAuthenticated, 'xata', authInfo));
          return;
        }
      }
    }

    // Fallback to ProfileManager (Supabase) if Xata fails
    if (!success && globalProfileManager) {
      try {
        success = await globalProfileManager.createUserProfile(userId, username, displayName);
        source = 'supabase';
        
        if (success) {
          newProfile = await globalProfileManager.fetchUserProfile(userId);
          logger.info(`✅ Profile created in ProfileManager for user: ${userId} with username: ${username}`);
        }
      } catch (error) {
        logger.error(`❌ ProfileManager profile creation failed for ${userId}:`, error);
      }
    }

    const finalFetchTime = Date.now() - startTime;

    if (success && newProfile) {
      // Invalidate cache for this user
      responseCache.delete(`profile:${userId}`);
      
      const cleanProfile = cleanProfileForResponse(newProfile, true);
      sendJsonResponse(res, 201, createResponse(true, { ...cleanProfile, source }, undefined, 'Profile created successfully', false, finalFetchTime, authResult.isAuthenticated, source, authInfo));
    } else {
      logger.error(`❌ Failed to create profile for user: ${userId} in both Xata and ProfileManager`);
      sendJsonResponse(res, 500, createResponse(false, null, 'Profile creation failed', 'Failed to create profile in database', false, finalFetchTime, authResult.isAuthenticated, source, authInfo));
    }

  } catch (error) {
    const fetchTime = Date.now() - startTime;
    logger.error(`❌ Error creating profile for ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create profile';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Profile creation failed', false, fetchTime, authResult.isAuthenticated, undefined, authInfo));
  }
};

// ✅ ENHANCED: PUT /api/profiles/:userId with Xata integration
const handleUpdateProfile = async (
  userId: string, 
  req: IncomingMessage, 
  res: ServerResponse, 
  startTime: number,
  authResult: AuthResult,
  authInfo?: AuthInfo
): Promise<void> => {
  try {
    logger.debug(`📡 PUT profile request for user: ${userId}`);

    if (!authResult.isAuthenticated || authResult.userId !== userId) {
      const fetchTime = Date.now() - startTime;
      sendJsonResponse(res, 401, createResponse(false, null, 'Unauthorized', 'Authentication required to update profile', false, fetchTime, authResult.isAuthenticated, undefined, authInfo));
      return;
    }

    const body = await parseRequestBody(req);
    
    // ✅ Try Xata first, fallback to ProfileManager
    const xataClient = getXataClient();
    let updatedProfile: UserProfile | null = null;
    let source: 'xata' | 'supabase' = 'xata';

    if (xataClient) {
      try {
        updatedProfile = await xataClient.updateUserProfile(userId, body);
        source = 'xata';
        logger.debug(`📊 Profile updated in Xata for user: ${userId}`);
      } catch (error) {
        logger.warn(`⚠️ Xata update failed for ${userId}, trying ProfileManager:`, error);
      }
    }

    // Fallback to ProfileManager if Xata fails
    if (!updatedProfile && globalProfileManager) {
      try {
        const success = await globalProfileManager.updateUserProfile(userId, body);
        if (success) {
          updatedProfile = await globalProfileManager.fetchUserProfile(userId);
          source = 'supabase';
          logger.debug(`📊 Profile updated in ProfileManager for user: ${userId}`);
        }
      } catch (error) {
        logger.error(`❌ ProfileManager update failed for ${userId}:`, error);
      }
    }

    const fetchTime = Date.now() - startTime;

    if (updatedProfile) {
      // Invalidate cache
      responseCache.delete(`profile:${userId}`);
      
      const cleanProfile = cleanProfileForResponse(updatedProfile, true);
      sendJsonResponse(res, 200, createResponse(true, { ...cleanProfile, source }, undefined, 'Profile updated successfully', false, fetchTime, authResult.isAuthenticated, source, authInfo));
    } else {
      sendJsonResponse(res, 500, createResponse(false, null, 'Profile update failed', 'Failed to update profile in database', false, fetchTime, authResult.isAuthenticated, source, authInfo));
    }

  } catch (error) {
    const fetchTime = Date.now() - startTime;
    logger.error(`❌ Error updating profile for ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update profile';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Profile update failed', false, fetchTime, authResult.isAuthenticated, undefined, authInfo));
  }
};

// ✅ ENHANCED: DELETE /api/profiles/:userId with Xata integration
const handleDeleteProfile = async (
  userId: string, 
  req: IncomingMessage, 
  res: ServerResponse, 
  startTime: number,
  authResult: AuthResult,
  authInfo?: AuthInfo
): Promise<void> => {
  try {
    logger.debug(`📡 DELETE profile request for user: ${userId}`);

    if (!authResult.isAuthenticated || authResult.userId !== userId) {
      const fetchTime = Date.now() - startTime;
      sendJsonResponse(res, 401, createResponse(false, null, 'Unauthorized', 'Authentication required to delete profile', false, fetchTime, authResult.isAuthenticated, undefined, authInfo));
      return;
    }

    // ✅ Try Xata first, fallback to ProfileManager
    const xataClient = getXataClient();
    let success = false;
    let source: 'xata' | 'supabase' = 'xata';

    if (xataClient) {
      try {
        success = await xataClient.deleteUserProfile(userId);
        source = 'xata';
        logger.info(`✅ Profile deleted from Xata for user: ${userId}`);
      } catch (error) {
        logger.warn(`⚠️ Xata delete failed for ${userId}, trying ProfileManager:`, error);
      }
    }

    // Fallback to ProfileManager if Xata fails
    if (!success && globalProfileManager) {
      try {
        success = await globalProfileManager.deleteUserProfile(userId);
        source = 'supabase';
        logger.info(`✅ Profile deleted from ProfileManager for user: ${userId}`);
      } catch (error) {
        logger.error(`❌ ProfileManager delete failed for ${userId}:`, error);
      }
    }

    const fetchTime = Date.now() - startTime;

    if (success) {
      // Invalidate cache
      responseCache.delete(`profile:${userId}`);
      
      sendJsonResponse(res, 200, createResponse(true, { deleted: true, source }, undefined, 'Profile deleted successfully', false, fetchTime, authResult.isAuthenticated, source, authInfo));
    } else {
      sendJsonResponse(res, 500, createResponse(false, null, 'Profile deletion failed', 'Failed to delete profile from database', false, fetchTime, authResult.isAuthenticated, source, authInfo));
    }

  } catch (error) {
    const fetchTime = Date.now() - startTime;
    logger.error(`❌ Error deleting profile for ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete profile';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Profile deletion failed', false, fetchTime, authResult.isAuthenticated, undefined, authInfo));
  }
};

// ✅ NEW: POST /api/profiles/search - Search profiles with authentication
const handleSearchProfiles = async (
  req: IncomingMessage, 
  res: ServerResponse, 
  startTime: number,
  authResult: AuthResult,
  authInfo?: AuthInfo
): Promise<void> => {
  try {
    const body = await parseRequestBody(req);
    const { query, limit = 20 } = body;

    if (!query || query.trim().length < 2) {
      const fetchTime = Date.now() - startTime;
      sendJsonResponse(res, 400, createResponse(false, null, 'Invalid search query', 'Search query must be at least 2 characters', false, fetchTime, authResult.isAuthenticated, undefined, authInfo));
      return;
    }

    if (limit > 50) {
      const fetchTime = Date.now() - startTime;
      sendJsonResponse(res, 400, createResponse(false, null, 'Limit too high', 'Search limit cannot exceed 50', false, fetchTime, authResult.isAuthenticated, undefined, authInfo));
      return;
    }

    // ✅ Try Xata first, fallback to ProfileManager
    const xataClient = getXataClient();
    let results: (UserProfile | UserSearchResult)[] = [];
    let source: 'xata' | 'supabase' = 'xata';

    if (xataClient) {
      try {
        results = await xataClient.searchUserProfiles(query, limit);
        source = 'xata';
        logger.debug(`🔍 Search performed in Xata: "${query}" returned ${results.length} results`);
      } catch (error) {
        logger.warn(`⚠️ Xata search failed, trying ProfileManager:`, error);
      }
    }

    // Fallback to ProfileManager if Xata fails
    if (results.length === 0 && globalProfileManager) {
      try {
        const profileResults: UserProfile[] = await globalProfileManager.searchProfiles(query, limit);
        results = profileResults;
        source = 'supabase';
        logger.debug(`🔍 Search performed in ProfileManager: "${query}" returned ${results.length} results`);
      } catch (error) {
        logger.error(`❌ ProfileManager search failed:`, error);
      }
    }

    const fetchTime = Date.now() - startTime;

    // Clean results for public view
    const cleanResults = results.map(profile => cleanProfileForResponse(profile, false));

    sendJsonResponse(res, 200, createResponse(true, { 
      profiles: cleanResults, 
      count: cleanResults.length, 
      query, 
      source 
    }, undefined, 'Search completed successfully', false, fetchTime, authResult.isAuthenticated, source, authInfo));

  } catch (error) {
    const fetchTime = Date.now() - startTime;
    logger.error(`❌ Error in profile search:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Search failed';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Profile search failed', false, fetchTime, authResult.isAuthenticated, undefined, authInfo));
  }
};

// ✅ NEW: POST /api/profiles/sync - Sync profile with Clerk data
const handleSyncProfile = async (
  req: IncomingMessage, 
  res: ServerResponse, 
  startTime: number,
  authResult: AuthResult,
  authInfo?: AuthInfo
): Promise<void> => {
  try {
    if (!authResult.isAuthenticated || !authResult.userId) {
      const fetchTime = Date.now() - startTime;
      sendJsonResponse(res, 401, createResponse(false, null, 'Unauthorized', 'Authentication required to sync profile', false, fetchTime, authResult.isAuthenticated, undefined, authInfo));
      return;
    }

    const userId = authResult.userId;

    // Get latest Clerk user data
    const clerkUser = await getClerkUserProfile(userId);
    if (!clerkUser) {
      const fetchTime = Date.now() - startTime;
      sendJsonResponse(res, 404, createResponse(false, null, 'Clerk user not found', 'Could not fetch user data from Clerk', false, fetchTime, authResult.isAuthenticated, undefined, authInfo));
      return;
    }

    // Prepare sync data
    const syncData = {
      username: clerkUser.username || `user_${userId.slice(-8)}`,
      display_name: clerkUser.firstName || clerkUser.username,
      avatar_url: clerkUser.imageUrl || '',
      last_seen: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // ✅ Try to update in Xata first, fallback to ProfileManager
    const xataClient = getXataClient();
    let updatedProfile: UserProfile | null = null;
    let source: 'xata' | 'supabase' = 'xata';

    if (xataClient) {
      try {
        updatedProfile = await xataClient.updateUserProfile(userId, syncData);
        source = 'xata';
        logger.debug(`📊 Profile synced with Clerk in Xata for user: ${userId}`);
      } catch (error) {
        logger.warn(`⚠️ Xata sync failed for ${userId}, trying ProfileManager:`, error);
      }
    }

    // Fallback to ProfileManager if Xata fails
    if (!updatedProfile && globalProfileManager) {
      try {
        const success = await globalProfileManager.updateUserProfile(userId, syncData);
        if (success) {
          updatedProfile = await globalProfileManager.fetchUserProfile(userId);
          source = 'supabase';
          logger.debug(`📊 Profile synced with Clerk in ProfileManager for user: ${userId}`);
        }
      } catch (error) {
        logger.error(`❌ ProfileManager sync failed for ${userId}:`, error);
      }
    }

    const fetchTime = Date.now() - startTime;

    if (updatedProfile) {
      // Invalidate cache
      responseCache.delete(`profile:${userId}`);
      
      const cleanProfile = cleanProfileForResponse(updatedProfile, true);
      sendJsonResponse(res, 200, createResponse(true, { 
        profile: cleanProfile, 
        synced: true, 
        source,
        clerkData: {
          username: clerkUser.username,
          firstName: clerkUser.firstName,
          imageUrl: clerkUser.imageUrl
        }
      }, undefined, 'Profile synced with Clerk successfully', false, fetchTime, authResult.isAuthenticated, source, authInfo));
    } else {
      sendJsonResponse(res, 500, createResponse(false, null, 'Profile sync failed', 'Failed to sync profile with Clerk data', false, fetchTime, authResult.isAuthenticated, source, authInfo));
    }

  } catch (error) {
    const fetchTime = Date.now() - startTime;
    logger.error(`❌ Error syncing profile with Clerk:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Profile sync failed';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Profile sync with Clerk failed', false, fetchTime, authResult.isAuthenticated, undefined, authInfo));
  }
};

// ✅ ENHANCED: Health check with Xata and Clerk status
const handleHealthCheck = async (
  res: ServerResponse, 
  startTime: number,
  isAuthenticated: boolean,
  authInfo?: AuthInfo
): Promise<void> => {
  try {
    const xataClient = getXataClient();
    let xataHealthy = false;
    let profileManagerHealthy = false;
    let clerkHealthy = false;

    // Test Xata connection
    if (xataClient) {
      try {
        xataHealthy = await xataClient.testConnection();
      } catch (error) {
        logger.warn('⚠️ Xata health check failed:', error);
      }
    }

    // Test ProfileManager connection
    if (globalProfileManager) {
      try {
        const healthStatus = await globalProfileManager.testConnection();
        profileManagerHealthy = healthStatus.overall;
      } catch (error) {
        logger.warn('⚠️ ProfileManager health check failed:', error);
      }
    }

    // Test Clerk connection
    try {
      const { testClerkConnection } = await import('../middleware/clerkAuth');
      const clerkStatus = await testClerkConnection();
      clerkHealthy = clerkStatus.connected;
    } catch (error) {
      logger.warn('⚠️ Clerk health check failed:', error);
    }

    const fetchTime = Date.now() - startTime;
    const overall = xataHealthy || profileManagerHealthy;
    
    const status = {
      profileService: 'available',
      databases: {
        xata: xataClient ? (xataHealthy ? 'connected' : 'failed') : 'not_configured',
        supabase: globalProfileManager ? (profileManagerHealthy ? 'connected' : 'failed') : 'not_configured',
        primary: xataHealthy ? 'xata' : (profileManagerHealthy ? 'supabase' : 'none')
      },
      authentication: {
        clerk: clerkHealthy ? 'connected' : 'failed',
        currentlyAuthenticated: isAuthenticated,
        authInfo: isAuthenticated ? authInfo : undefined
      },
      overall: overall && clerkHealthy ? 'healthy' : 'degraded',
      cache: {
        responseCache: {
          size: responseCache.size,
          ttl: RESPONSE_CACHE_TTL
        }
      },
      timestamp: new Date().toISOString()
    };

    const httpStatus = (overall && clerkHealthy) ? 200 : 503;
    sendJsonResponse(res, httpStatus, createResponse(overall && clerkHealthy, status, undefined, 'Health check completed', false, fetchTime, isAuthenticated, undefined, authInfo));
    
  } catch (error) {
    const fetchTime = Date.now() - startTime;
    logger.error('❌ Profile health check error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Health check failed';
    sendJsonResponse(res, 503, createResponse(false, null, errorMessage, 'Health check failed', false, fetchTime, isAuthenticated, undefined, authInfo));
  }
};

// ✅ ENHANCED: Stats with Xata, Clerk and comprehensive information
const handleProfileStats = async (
  res: ServerResponse, 
  startTime: number,
  isAuthenticated: boolean,
  authInfo?: AuthInfo
): Promise<void> => {
  try {
    const stats = globalProfileManager?.getProfileStats() || {};
    const fetchTime = Date.now() - startTime;
    
    // Get database stats
    let xataStats = null;
    const xataClient = getXataClient();
    if (xataClient) {
      try {
        xataStats = await xataClient.getDatabaseStats();
      } catch (error) {
        logger.debug('Could not fetch Xata stats:', error);
      }
    }

    // Get auth stats
    let authStats = null;
    try {
      const { getAuthStats } = await import('../middleware/clerkAuth');
      authStats = getAuthStats();
    } catch (error) {
      logger.debug('Could not fetch auth stats:', error);
    }
    
    const enhancedStats = {
      ...stats,
      databases: {
        xata: xataStats,
        supabase: !!globalProfileManager
      },
      authentication: {
        enabled: true,
        currentlyAuthenticated: isAuthenticated,
        authInfo: isAuthenticated ? authInfo : undefined,
        stats: authStats
      },
      api: {
        responseCache: {
          size: responseCache.size,
          maxSize: 100,
          ttl: RESPONSE_CACHE_TTL,
        }
      }
    };
    
    sendJsonResponse(res, 200, createResponse(true, enhancedStats, undefined, 'Profile statistics retrieved', false, fetchTime, isAuthenticated, undefined, authInfo));
    
  } catch (error) {
    const fetchTime = Date.now() - startTime;
    logger.error('❌ Profile stats error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get stats';
    sendJsonResponse(res, 500, createResponse(false, null, errorMessage, 'Stats retrieval failed', false, fetchTime, isAuthenticated, undefined, authInfo));
  }
};

// Utility functions
export const getProfileManagerInstance = (): ProfileManager | null => {
  return globalProfileManager;
};

export const isProfileManagerReady = (): boolean => {
  return globalProfileManager !== null;
};

export const getApiStats = () => {
  return {
    totalRequests: 0,
    cacheSize: responseCache.size,
    authenticated: true,
    xataEnabled: !!getXataClient(),
    profileManagerEnabled: !!globalProfileManager
  };
};

export const clearApiCaches = () => {
  responseCache.clear();
  logger.info('🧹 Cleared all API caches');
};