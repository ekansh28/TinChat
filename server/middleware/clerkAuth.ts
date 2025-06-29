// server/middleware/clerkAuth.ts - ENHANCED CLERK AUTHENTICATION MIDDLEWARE
import { verifyToken, createClerkClient } from '@clerk/backend';
import { IncomingMessage } from 'http';
import { logger } from '../utils/logger';
import { LRUCache } from '../utils/LRUCache';

// User information from Clerk
export interface ClerkUser {
  id: string;
  emailAddresses: Array<{
    emailAddress: string;
    verification?: {
      status: string;
    };
  }>;
  username?: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  createdAt: number;
  updatedAt: number;
  lastSignInAt?: number;
  banned?: boolean;
  locked?: boolean;
}

export interface AuthResult {
  userId: string | null;
  isAuthenticated: boolean;
  user?: ClerkUser;
  error?: string;
  cached?: boolean;
}

// Cache for verified tokens to reduce API calls
const tokenCache = new LRUCache<{ userId: string; user?: ClerkUser }>(1000);
const TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes - for reference only, LRUCache handles TTL internally

// Initialize Clerk client
let clerkClient: any = null;

export function initializeClerk(): boolean {
  try {
    const secretKey = process.env.CLERK_SECRET_KEY;
    const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    
    if (!secretKey) {
      logger.error('❌ Missing Clerk environment variables:', {
        hasSecretKey: !!secretKey,
        hasPublishableKey: !!publishableKey
      });
      logger.info('📋 Required environment variables:');
      logger.info('   - CLERK_SECRET_KEY');
      logger.info('   - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
      return false;
    }

    clerkClient = createClerkClient({ secretKey });
    logger.info('✅ Clerk client initialized successfully');
    logger.info(`🔑 Secret key configured: ${secretKey.substring(0, 20)}...`);
    
    return true;
  } catch (error) {
    logger.error('❌ Failed to initialize Clerk client:', error);
    return false;
  }
}

/**
 * Extract token from various sources in the request
 */
function extractToken(req: IncomingMessage): string | null {
  // 1. Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // 2. Cookie (if using cookie-based auth)
  const cookies = req.headers.cookie;
  if (cookies) {
    const sessionCookie = cookies
      .split(';')
      .find(c => c.trim().startsWith('__session='));
    
    if (sessionCookie) {
      return sessionCookie.split('=')[1];
    }

    // Check for Clerk's default session cookie
    const clerkSessionCookie = cookies
      .split(';')
      .find(c => c.trim().startsWith('__clerk_session='));
    
    if (clerkSessionCookie) {
      return clerkSessionCookie.split('=')[1];
    }
  }

  // 3. Query parameter (for WebSocket connections)
  if (req.url) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    if (token) {
      return token;
    }
  }

  return null;
}

/**
 * Verify Clerk token and return user information
 */
export async function verifyClerkToken(req: IncomingMessage): Promise<AuthResult> {
  try {
    const token = extractToken(req);
    
    if (!token) {
      return { 
        userId: null, 
        isAuthenticated: false, 
        error: 'No authentication token provided' 
      };
    }

    // Check cache first
    const cacheKey = `token:${token.substring(0, 20)}`;
    const cached = tokenCache.get(cacheKey);
    if (cached) {
      logger.debug('✅ Clerk token cache hit');
      return {
        userId: cached.userId,
        isAuthenticated: true,
        user: cached.user,
        cached: true
      };
    }

    // Verify token with Clerk using the correct API
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    if (!payload || !payload.sub) {
      return { 
        userId: null, 
        isAuthenticated: false, 
        error: 'Invalid token payload' 
      };
    }

    const userId = payload.sub;

    // Get user details from Clerk if client is available
    let user: ClerkUser | undefined;
    if (clerkClient) {
      try {
        const clerkUser = await clerkClient.users.getUser(userId);
        user = {
          id: clerkUser.id,
          emailAddresses: clerkUser.emailAddresses.map((email: any) => ({
            emailAddress: email.emailAddress,
            verification: email.verification
          })),
          username: clerkUser.username,
          firstName: clerkUser.firstName,
          lastName: clerkUser.lastName,
          imageUrl: clerkUser.imageUrl,
          createdAt: clerkUser.createdAt,
          updatedAt: clerkUser.updatedAt,
          lastSignInAt: clerkUser.lastSignInAt,
          banned: clerkUser.banned,
          locked: clerkUser.locked
        };
      } catch (userError) {
        logger.warn(`Failed to fetch user details for ${userId}:`, userError);
      }
    }

    // Cache the result (LRUCache set method takes key, value)
    tokenCache.set(cacheKey, { userId, user });

    logger.debug(`✅ Clerk token verified for user: ${userId}`);
    
    return {
      userId,
      isAuthenticated: true,
      user,
      cached: false
    };

  } catch (error: any) {
    logger.warn('Clerk token verification failed:', {
      error: error.message,
      code: error.code,
      status: error.status
    });
    
    return { 
      userId: null, 
      isAuthenticated: false, 
      error: 'Token verification failed: ' + error.message 
    };
  }
}

/**
 * Enhanced verification with optional authentication
 */
export async function verifyOptionalClerkToken(req: IncomingMessage): Promise<AuthResult> {
  const result = await verifyClerkToken(req);
  
  // For optional auth, we don't treat missing tokens as errors
  if (result.error === 'No authentication token provided') {
    return {
      userId: null,
      isAuthenticated: false,
      error: undefined // Clear the error for optional auth
    };
  }
  
  return result;
}

/**
 * Middleware for routes that require authentication
 */
export async function requireAuth(req: IncomingMessage): Promise<AuthResult> {
  const result = await verifyClerkToken(req);
  
  if (!result.isAuthenticated) {
    logger.warn('Authentication required but not provided or invalid');
  }
  
  return result;
}

/**
 * Check if a user has specific permissions or roles
 */
export async function checkUserPermissions(userId: string, requiredPermissions: string[]): Promise<boolean> {
  if (!clerkClient) {
    logger.warn('Clerk client not available for permission check');
    return false;
  }

  try {
    // Get user's organization memberships and roles
    const user = await clerkClient.users.getUser(userId);
    const organizationMemberships = await clerkClient.users.getOrganizationMembershipList({ userId });

    // Check if user has required permissions
    // This is a simplified example - adjust based on your permission model
    for (const membership of organizationMemberships) {
      const role = membership.role;
      if (role === 'admin' || role === 'moderator') {
        return true; // Admins and moderators have all permissions
      }
    }

    // Check specific permissions
    // You would implement your own permission logic here
    return false;
  } catch (error) {
    logger.error(`Failed to check permissions for user ${userId}:`, error);
    return false;
  }
}

/**
 * Get user profile information from Clerk
 */
export async function getClerkUserProfile(userId: string): Promise<ClerkUser | null> {
  if (!clerkClient) {
    logger.warn('Clerk client not available for user profile fetch');
    return null;
  }

  try {
    // Check cache first
    const cacheKey = `user:${userId}`;
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.user) {
      return cached.user;
    }

    const clerkUser = await clerkClient.users.getUser(userId);
    const user: ClerkUser = {
      id: clerkUser.id,
      emailAddresses: clerkUser.emailAddresses.map((email: any) => ({
        emailAddress: email.emailAddress,
        verification: email.verification
      })),
      username: clerkUser.username,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      imageUrl: clerkUser.imageUrl,
      createdAt: clerkUser.createdAt,
      updatedAt: clerkUser.updatedAt,
      lastSignInAt: clerkUser.lastSignInAt,
      banned: clerkUser.banned,
      locked: clerkUser.locked
    };

    // Cache the user profile
    tokenCache.set(cacheKey, { userId, user });

    return user;
  } catch (error) {
    logger.error(`Failed to fetch Clerk user profile for ${userId}:`, error);
    return null;
  }
}

/**
 * Batch get user profiles for multiple users
 */
export async function getClerkUserProfiles(userIds: string[]): Promise<Record<string, ClerkUser | null>> {
  if (!clerkClient || userIds.length === 0) {
    return {};
  }

  const results: Record<string, ClerkUser | null> = {};
  const uncachedIds: string[] = [];

  // Check cache first
  for (const userId of userIds) {
    const cacheKey = `user:${userId}`;
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.user) {
      results[userId] = cached.user;
    } else {
      uncachedIds.push(userId);
    }
  }

  // Fetch uncached users
  if (uncachedIds.length > 0) {
    try {
      // Clerk doesn't have a batch get users API, so we fetch individually
      const promises = uncachedIds.map(async (userId) => {
        try {
          const user = await getClerkUserProfile(userId);
          return { userId, user };
        } catch (error) {
          logger.warn(`Failed to fetch user ${userId}:`, error);
          return { userId, user: null };
        }
      });

      const fetchResults = await Promise.allSettled(promises);
      fetchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results[result.value.userId] = result.value.user;
        }
      });

    } catch (error) {
      logger.error('Batch user profile fetch failed:', error);
    }
  }

  return results;
}

/**
 * Validate that a user account is in good standing
 */
export async function validateUserAccount(userId: string): Promise<{
  valid: boolean;
  reason?: string;
}> {
  try {
    const user = await getClerkUserProfile(userId);
    
    if (!user) {
      return { valid: false, reason: 'User not found' };
    }

    if (user.banned) {
      return { valid: false, reason: 'User account is banned' };
    }

    if (user.locked) {
      return { valid: false, reason: 'User account is locked' };
    }

    // Check if user has verified email
    const hasVerifiedEmail = user.emailAddresses.some(
      email => email.verification?.status === 'verified'
    );

    if (!hasVerifiedEmail) {
      return { valid: false, reason: 'Email not verified' };
    }

    return { valid: true };
  } catch (error) {
    logger.error(`Failed to validate user account ${userId}:`, error);
    return { valid: false, reason: 'Validation failed' };
  }
}

/**
 * Create or update user metadata in Clerk
 */
export async function updateClerkUserMetadata(userId: string, metadata: Record<string, any>): Promise<boolean> {
  if (!clerkClient) {
    logger.warn('Clerk client not available for metadata update');
    return false;
  }

  try {
    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: metadata
    });

    // Invalidate cache for this user
    const cacheKey = `user:${userId}`;
    tokenCache.delete(cacheKey);

    logger.info(`✅ Updated metadata for user ${userId}`);
    return true;
  } catch (error) {
    logger.error(`Failed to update metadata for user ${userId}:`, error);
    return false;
  }
}

/**
 * Get authentication statistics
 */
export function getAuthStats(): {
  cacheSize: number;
  cacheTTL: number;
  clerkClientAvailable: boolean;
  tokenCacheHitRate: number;
} {
  return {
    cacheSize: tokenCache.size(),
    cacheTTL: TOKEN_CACHE_TTL,
    clerkClientAvailable: !!clerkClient,
    tokenCacheHitRate: tokenCache.getHitRate()
  };
}

/**
 * Clear authentication caches
 */
export function clearAuthCaches(): void {
  tokenCache.clear();
  logger.info('🧹 Cleared authentication caches');
}

/**
 * Health check for Clerk service
 */
export async function testClerkConnection(): Promise<{
  connected: boolean;
  latency?: number;
  error?: string;
}> {
  if (!clerkClient) {
    return {
      connected: false,
      error: 'Clerk client not initialized'
    };
  }

  try {
    const startTime = Date.now();
    
    // Test by getting the current organization (this is a lightweight call)
    await clerkClient.organizations.getOrganizationList();
    
    const latency = Date.now() - startTime;
    
    return {
      connected: true,
      latency
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Extract user information for Socket.IO connections
 */
export async function authenticateSocketConnection(socket: any): Promise<AuthResult> {
  try {
    // Extract token from handshake
    const token = socket.handshake.auth?.token || 
                 socket.handshake.query?.token ||
                 socket.request.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return {
        userId: null,
        isAuthenticated: false,
        error: 'No token provided for socket connection'
      };
    }

    // Create a mock request object for token verification
    const mockRequest = {
      headers: {
        authorization: `Bearer ${token}`,
        host: socket.request.headers.host
      },
      url: socket.request.url
    } as IncomingMessage;

    return await verifyClerkToken(mockRequest);
  } catch (error) {
    logger.error('Socket authentication failed:', error);
    return {
      userId: null,
      isAuthenticated: false,
      error: 'Socket authentication failed'
    };
  }
}

// Initialize Clerk on module load
if (process.env.CLERK_SECRET_KEY) {
  initializeClerk();
}