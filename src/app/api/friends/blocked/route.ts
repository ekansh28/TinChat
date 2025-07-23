// src/app/api/friends/blocked/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ✅ Import the new BlockedUser interface
import { BlockedUser, BlockedUsersApiResponse } from '../../../../types/friends';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({
        success: false,
        message: 'userId is required'
      }, { status: 400 });
    }

    // Get user's database ID and blocked_users array
    const { data: userProfile, error: userError } = await supabase
      .from('user_profiles')
      .select('id, blocked_users')
      .eq('clerk_id', userId)
      .single();

    if (userError || !userProfile) {
      return NextResponse.json({
        success: false,
        message: 'User not found'
      }, { status: 404 });
    }

    const blockedUserIds = userProfile.blocked_users || [];
    let blockedUsers: BlockedUser[] = []; // ✅ Using BlockedUser[] instead of Friend[]

    if (blockedUserIds.length > 0) {
      const { data: blockedProfiles, error: blockedError } = await supabase
        .from('user_profiles')
        .select('id, clerk_id, username, display_name, avatar_url')
        .in('id', blockedUserIds);

      if (blockedError) {
        console.error('Error fetching blocked users:', blockedError);
      } else {
        // ✅ Map to BlockedUser interface - only requires basic fields
        blockedUsers = (blockedProfiles || []).map(user => ({
          id: user.clerk_id,
          username: user.username,
          display_name: user.display_name,
          avatar_url: user.avatar_url
        }));
      }
    }

    // ✅ Return properly typed response
    const response: BlockedUsersApiResponse = {
      success: true,
      blocked: blockedUsers
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ Blocked users error:', error);
    
    const errorResponse: BlockedUsersApiResponse = {
      success: false,
      blocked: []
    };

    return NextResponse.json(errorResponse, { 
      status: 500 
    });
  }
}
