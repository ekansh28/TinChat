
// ===== 1. Fixed Clerk Middleware (src/middleware.ts) =====
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Define routes that require authentication
const isProtectedRoute = createRouteMatcher([
  '/api/profiles/(.*)',
  '/api/friends/(.*)',
  '/dashboard(.*)',
  '/profile(.*)',
  '/settings(.*)'
]);

// Define public routes that should always be accessible
const isPublicRoute = createRouteMatcher([
  '/',
  '/auth/callback',
  '/auth/complete',
  '/health',
  '/metrics',
  '/status',
  '/debug(.*)',
  '/api/health(.*)',
  '/api/profiles/health',
  '/api/profiles/stats'
]);

export default clerkMiddleware((auth, req) => {
  // Allow public routes
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Protect specific routes
  if (isProtectedRoute(req)) {
    auth().protect();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
