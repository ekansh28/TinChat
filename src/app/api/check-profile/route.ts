// app/api/check-profile/route.ts
// 📁 Create this file at: app/api/check-profile/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    console.log('🔍 Checking profile existence for user:', userId);

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { exists: false, reason: 'User ID is required' },
        { status: 400 }
      );
    }

    // Check if profile exists in Supabase
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('id, username, profile_complete')
      .eq('clerk_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Profile check error:', error);
      return NextResponse.json(
        { exists: false, reason: 'Database error' },
        { status: 500 }
      );
    }

    if (profile) {
      console.log('✅ Profile found:', {
        id: profile.id,
        username: profile.username,
        profile_complete: profile.profile_complete
      });
      
      return NextResponse.json({
        exists: true,
        profile: {
          id: profile.id,
          username: profile.username,
          profile_complete: profile.profile_complete
        }
      });
    } else {
      console.log('❌ Profile not found for user:', userId);
      return NextResponse.json({
        exists: false,
        reason: 'Profile not yet created'
      });
    }

  } catch (error) {
    console.error('Profile check API error:', error);
    return NextResponse.json(
      { exists: false, reason: 'Internal server error' },
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