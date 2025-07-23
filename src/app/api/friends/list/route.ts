// src/app/api/friends/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    // Get user's database ID from clerk_id
    const { data: userProfile, error: userError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('clerk_id', userId)
      .single();

    if (userError || !userProfile) {
      return NextResponse.json({
        success: false,
        message: 'User not found'
      }, { status: 404 });
    }

    // Get friends list
    const { data: friendships, error: friendsError } = await supabase
      .from('friendships')
      .select(`
        friend_id,
        created_at,
        friend:user_profiles!friendships_friend_id_fkey (
          id,
          clerk_id,
          username,
          display_name,
          avatar_url,
          status,
          last_seen,
          is_online
        )
      `)
      .eq('user_id', userProfile.id)
      .eq('status', 'accepted');

    if (friendsError) {
      throw new Error(`Failed to fetch friends: ${friendsError.message}`);
    }

    const friends = (friendships || [])
      .filter(friendship => friendship.friend)
      .map(friendship => {
        const friend = friendship.friend as any;
        return {
          id: friend.clerk_id,
          username: friend.username,
          display_name: friend.display_name,
          avatar_url: friend.avatar_url,
          status: friend.status || 'offline',
          last_seen: friend.last_seen,
          is_online: friend.is_online || false,
          friends_since: friendship.created_at
        };
      });

    return NextResponse.json({
      success: true,
      friends,
      count: friends.length
    });

  } catch (error: any) {
    console.error('❌ Friends list error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to load friends'
    }, { status: 500 });
  }
}
