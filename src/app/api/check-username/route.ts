// app/api/check-username/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';

// Initialize Clerk client for direct username checking
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!
});

// Initialize Supabase client for synced usernames
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Comprehensive list of reserved usernames and routes
const RESERVED_USERNAMES = [
  // System reserved
  'admin', 'api', 'www', 'mail', 'ftp', 'localhost', 'root', 
  'administrator', 'mod', 'moderator', 'support', 'help',
  'system', 'bot', 'null', 'undefined', 'test', 'dev', 'development',
  
  // Common app routes
  'settings', 'profile', 'messages', 'notifications', 'discover',
  'search', 'auth', 'login', 'register', 'signin', 'signup',
  'account', 'dashboard', 'home', 'explore', 'feed', 'create',
  'edit', 'delete', 'post', 'posts', 'new', 'popular', 'trending',
  
  // Your app-specific routes
  'tinchat', 'tinchatapp', 'tin', 'chat', 'community', 'friends',
  'connections', 'network', 'discover', 'directory', 'helpcenter',
  
  // Common terms
  'about', 'privacy', 'terms', 'contact', 'faq', 'pricing',
  'blog', 'news', 'press', 'media', 'jobs', 'careers',
  
  // File extensions
  'css', 'js', 'json', 'xml', 'php', 'html', 'htm',
  
  // Special characters
  '404', '500', '200', '301', '302'
];

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();

    // Validate input
    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { available: false, reason: 'Username is required' },
        { status: 400 }
      );
    }

    const trimmedUsername = username.trim().toLowerCase();

    // Length validation
    if (trimmedUsername.length < 3) {
      return NextResponse.json({
        available: false,
        reason: 'Username must be at least 3 characters'
      });
    }

    if (trimmedUsername.length > 20) {
      return NextResponse.json({
        available: false,
        reason: 'Username must be 20 characters or less'
      });
    }

    // Character validation
    const usernameRegex = /^[a-z0-9_-]+$/;
    if (!usernameRegex.test(trimmedUsername)) {
      return NextResponse.json({
        available: false,
        reason: 'Username can only contain lowercase letters, numbers, underscores, and hyphens'
      });
    }

    // Check against reserved usernames
    if (RESERVED_USERNAMES.includes(trimmedUsername)) {
      return NextResponse.json({
        available: false,
        reason: 'This username is reserved'
      });
    }

    // Check for sequential characters or numbers (basic spam prevention)
    const sequentialRegex = /(123|234|345|456|567|678|789|012|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk)/;
    if (sequentialRegex.test(trimmedUsername)) {
      return NextResponse.json({
        available: false,
        reason: 'Username contains sequential patterns that are not allowed'
      });
    }

    // Check for repeated characters
    const repeatedRegex = /(.)\1{2,}/;
    if (repeatedRegex.test(trimmedUsername)) {
      return NextResponse.json({
        available: false,
        reason: 'Username contains too many repeated characters'
      });
    }

    // Check Clerk first
    try {
      const clerkUsers = await clerkClient.users.getUserList({
        username: [trimmedUsername],
        limit: 1
      });

      if (clerkUsers?.data?.length > 0) {
        return NextResponse.json({
          available: false,
          reason: 'Username is already taken'
        });
      }
    } catch (clerkError) {
      console.error('Clerk username check failed:', clerkError);
      // Continue to Supabase check even if Clerk fails
    }

    // Check Supabase as fallback
    const { data: supabaseUser, error } = await supabase
      .from('user_profiles')
      .select('username, clerk_id')
      .ilike('username', trimmedUsername)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Supabase check error:', error);
      return NextResponse.json({
        available: true,
        reason: 'Unable to verify availability, will check during signup'
      });
    }

    if (supabaseUser) {
      return NextResponse.json({
        available: false,
        reason: 'Username is already taken'
      });
    }

    // If all checks pass
    return NextResponse.json({
      available: true,
      suggestedUsername: trimmedUsername // Return normalized version
    });

  } catch (error) {
    console.error('Username check API error:', error);
    return NextResponse.json(
      { 
        available: true, 
        reason: 'Check failed, will validate during signup' 
      },
      { status: 200 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}