// server/middleware/clerkAuth.ts - FIXED CLERK AUTHENTICATION
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
const TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
 * ✅ FIXED: Use correct verifyToken API (no issuer property needed)
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

    if (!clerkClient) {
      throw new Error('Clerk client not initialized');
    }

    // ✅ Method 1: Try session-based verification first (most reliable)
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        const sessionId = payload.sid;
        
        if (sessionId) {
          const session = await clerkClient.sessions.getSession(sessionId);
          
          if (session && session.status === 'active') {
            const userId = session.userId;
            
            // Get user details
            let user: ClerkUser | undefined;
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

            // Cache the result
            tokenCache.set(cacheKey, { userId, user });

            logger.debug(`✅ Clerk session verified for user: ${userId}`);
            
            return {
              userId,
              isAuthenticated: true,
              user,
              cached: false
            };
          }
        }
      }
    } catch (sessionError) {
      logger.debug('Session verification failed, trying token verification:', sessionError);
    }

    // ✅ Method 2: Use verifyToken with only required parameters
    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!,
      });

      if (!payload || !payload.sub) {
        return { 
          userId: null, 
          isAuthenticated: false, 
          error: 'Invalid token payload' 
        };
      }

      const userId = payload.sub;

      // Get user details
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

      // Cache the result
      tokenCache.set(cacheKey, { userId, user });

      logger.debug(`✅ Clerk token verified for user: ${userId}`);
      
      return {
        userId,
        isAuthenticated: true,
        user,
        cached: false
      };

    } catch (tokenError) {
      logger.warn('Token verification also failed:', tokenError);
      throw tokenError;
    }

  } catch (error: any) {
    logger.warn('Clerk token verification failed:', {
      error: error.message,
      code: error.code,
      status: error.status,
      type: error.name
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
 * ✅ ENHANCED: Get user profile with better error handling
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
 * ✅ NEW: Check if username exists in Clerk
 */
export async function checkClerkUsernameAvailability(username: string): Promise<{
  available: boolean;
  reason?: string;
}> {
  if (!clerkClient) {
    return { available: false, reason: 'Clerk client not available' };
  }

  try {
    // Try to get users with this username
    const userList = await clerkClient.users.getUserList({
      username: [username.toLowerCase()]
    });

    const isAvailable = !userList || userList.length === 0;

    return {
      available: isAvailable,
      reason: isAvailable ? undefined : 'Username is already taken'
    };
  } catch (error: any) {
    logger.error(`Failed to check username availability for ${username}:`, error);
    
    // If the API call fails, we can't determine availability
    return { 
      available: false, 
      reason: 'Unable to check username availability' 
    };
  }
}

/**
 * ✅ ENHANCED: Health check with better error handling
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
    
    // Test with a simple API call
    await clerkClient.users.getUserList({ limit: 1 });
    
    const latency = Date.now() - startTime;
    
    return {
      connected: true,
      latency
    };
  } catch (error: any) {
    return {
      connected: false,
      error: error.message || 'Unknown error'
    };
  }
}

/**
 * ✅ ENHANCED: Extract user information for Socket.IO connections
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
        host: socket.request.headers.host || 'localhost'
      },
      url: socket.request.url || '/'
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

// ✅ FIXED: Initialize Clerk with environment validation
if (process.env.CLERK_SECRET_KEY) {
  const initialized = initializeClerk();
  if (!initialized) {
    logger.error('❌ Failed to initialize Clerk - check environment variables');
  }
} else {
  logger.warn('⚠️ CLERK_SECRET_KEY not found - Clerk authentication disabled');
}