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

    // Get user profile from Supabase
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('clerk_id', userId)
      .single();

    if (error || !profile) {
      // Profile doesn't exist - create it with basic info
      console.log(`Creating new profile for user: ${userId}`);
      
      const { data: newProfile, error: createError } = await supabase
        .from('user_profiles')
        .insert({
          clerk_id: userId,
          username: userId.replace('user_', ''), // Basic username from ID
          profile_complete: false,
          is_online: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('Failed to create profile:', createError);
        return NextResponse.json({
          success: false,
          message: 'Profile not found and could not be created'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        profile: {
          id: newProfile.clerk_id,
          username: newProfile.username,
          display_name: newProfile.display_name,
          avatar_url: newProfile.avatar_url,
          bio: newProfile.bio,
          status: newProfile.status,
          is_online: newProfile.is_online,
          last_seen: newProfile.last_seen,
          profile_complete: newProfile.profile_complete
        }
      });
    }

    // Profile exists - return it
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
