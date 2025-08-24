// app/api/update-username/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // Verify user is authenticated
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { username } = await req.json();

    // Validate input
    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    const trimmedUsername = username.trim().toLowerCase();

    // Validate username format (same as check-username API)
    if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
      return NextResponse.json(
        { error: 'Username must be between 3 and 20 characters' },
        { status: 400 }
      );
    }

    const usernameRegex = /^[a-z0-9_-]+$/;
    if (!usernameRegex.test(trimmedUsername)) {
      return NextResponse.json(
        { error: 'Username can only contain lowercase letters, numbers, underscores, and hyphens' },
        { status: 400 }
      );
    }

    // Check if username is available (double-check)
    const availabilityResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/check-username`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: trimmedUsername }),
    });

    const availabilityResult = await availabilityResponse.json();
    
    if (!availabilityResult.available) {
      return NextResponse.json(
        { error: availabilityResult.reason || 'Username is not available' },
        { status: 400 }
      );
    }

    try {
      // Update username in Clerk
      await clerkClient.users.updateUser(userId, {
        username: trimmedUsername,
      });

      // Also update in Supabase if profile exists
      const { error: supabaseError } = await supabase
        .from('user_profiles')
        .update({ username: trimmedUsername })
        .eq('clerk_id', userId);

      if (supabaseError) {
        console.warn('Failed to update username in Supabase:', supabaseError);
        // Don't fail the request, as Clerk update was successful
      }

      return NextResponse.json({ 
        success: true, 
        username: trimmedUsername 
      });

    } catch (clerkError: any) {
      console.error('Failed to update username in Clerk:', clerkError);
      
      // Handle specific Clerk errors
      if (clerkError.errors && clerkError.errors.length > 0) {
        const errorCode = clerkError.errors[0].code;
        const errorMessage = clerkError.errors[0].message;
        
        switch (errorCode) {
          case 'form_username_invalid_character':
            return NextResponse.json(
              { error: 'Username contains invalid characters' },
              { status: 400 }
            );
          case 'form_username_invalid_length':
            return NextResponse.json(
              { error: 'Username must be between 3 and 20 characters' },
              { status: 400 }
            );
          case 'form_identifier_exists':
            return NextResponse.json(
              { error: 'Username is already taken' },
              { status: 400 }
            );
          default:
            return NextResponse.json(
              { error: errorMessage || 'Failed to update username' },
              { status: 400 }
            );
        }
      }
      
      return NextResponse.json(
        { error: 'Failed to update username' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Update username API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}