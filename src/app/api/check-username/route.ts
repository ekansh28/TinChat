// app/api/check-username/route.ts
// 📁 Create this file at: app/api/check-username/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';

// Initialize Clerk client for direct username checking
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!
});

// Fallback to Supabase for synced usernames
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();

    console.log('🔍 Checking username availability:', username);

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { available: false, reason: 'Username is required' },
        { status: 400 }
      );
    }

    const trimmedUsername = username.trim().toLowerCase();

    // Basic validation
    if (trimmedUsername.length < 3) {
      return NextResponse.json({
        available: false,
        reason: 'Username must be at least 3 characters'
      });
    }

    if (trimmedUsername.length > 30) {
      return NextResponse.json({
        available: false,
        reason: 'Username must be 30 characters or less'
      });
    }

    // Check allowed characters
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(trimmedUsername)) {
      return NextResponse.json({
        available: false,
        reason: 'Username can only contain letters, numbers, underscores, and hyphens'
      });
    }

    // Reserved usernames
    const reservedUsernames = [
      'admin', 'api', 'www', 'mail', 'ftp', 'localhost', 'root', 
      'administrator', 'mod', 'moderator', 'support', 'help',
      'tinchat', 'system', 'bot', 'null', 'undefined', 'test'
    ];

    if (reservedUsernames.includes(trimmedUsername)) {
      return NextResponse.json({
        available: false,
        reason: 'This username is reserved'
      });
    }

    // ✅ ENHANCED: Check both Clerk and Supabase
    try {
      // Method 1: Check Clerk directly (most accurate)
      console.log('🔍 Checking Clerk for username:', trimmedUsername);
      
      const clerkUsers = await clerkClient.users.getUserList({
        username: [trimmedUsername],
        limit: 1
      });

      if (clerkUsers && clerkUsers.data && clerkUsers.data.length > 0) {
        console.log('❌ Username found in Clerk:', trimmedUsername);
        return NextResponse.json({
          available: false,
          reason: 'Username is already taken'
        });
      }

      console.log('✅ Username not found in Clerk, checking Supabase...');

      // Method 2: Check Supabase as fallback (for webhook synced data)
      const { data: supabaseUser, error } = await supabase
        .from('user_profiles')
        .select('username')
        .ilike('username', trimmedUsername)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('Supabase check failed:', error);
        // If Supabase fails but Clerk succeeded, username is likely available
      } else if (supabaseUser) {
        console.log('❌ Username found in Supabase:', trimmedUsername);
        return NextResponse.json({
          available: false,
          reason: 'Username is already taken'
        });
      }

      console.log('✅ Username available:', trimmedUsername);
      return NextResponse.json({
        available: true
      });

    } catch (checkError: any) {
      console.error('Username availability check failed:', checkError);
      
      // If both checks fail, be conservative and allow signup
      // Clerk will do final validation during account creation
      return NextResponse.json({
        available: true,
        reason: 'Unable to verify availability, will check during signup'
      });
    }

  } catch (error) {
    console.error('Username check API error:', error);
    return NextResponse.json(
      { available: true, reason: 'Check failed, will validate during signup' },
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