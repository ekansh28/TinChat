// src/app/api/profiles/[userId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json({
        success: false,
        message: 'User ID is required'
      }, { status: 400 });
    }

    // Get user profile
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('clerk_id', userId)
      .single();

    if (error || !profile) {
      return NextResponse.json({
        success: false,
        message: 'Profile not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: profile.clerk_id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        bio: profile.bio,
        status: profile.status,
        is_online: profile.is_online,
        last_seen: profile.last_seen,
        profile_complete: profile.profile_complete
      }
    });

  } catch (error: any) {
    console.error('❌ Profile fetch error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to fetch profile'
    }, { status: 500 });
  }
}
