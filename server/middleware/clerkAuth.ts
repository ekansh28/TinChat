// server/middleware/clerkAuth.ts - NEW FILE
import { verifyToken } from '@clerk/backend';
import { IncomingMessage } from 'http';
import { logger } from '../utils/logger';

export async function verifyClerkToken(req: IncomingMessage): Promise<{ userId: string | null; error?: string }> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { userId: null, error: 'No token provided' };
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token, {
      jwtKey: process.env.CLERK_SECRET_KEY,
      issuer: `https://enhanced-duck-11.clerk.accounts.dev`,
    });

    return { userId: payload.sub };
  } catch (error) {
    logger.error('Clerk token verification failed:', error);
    return { userId: null, error: 'Invalid token' };
  }
}