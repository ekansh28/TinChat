// src/app/api/friends/remove/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userAuthId, friendAuthId } = body;

    console.log('🗑️ Removing friendship:', {
      user: userAuthId,
      friend: friendAuthId
    });

    if (!userAuthId || !friendAuthId) {
      return NextResponse.json({
        success: false,
        message: 'Both userAuthId and friendAuthId are required'
      }, { status: 400, headers: corsHeaders });
    }

    if (userAuthId === friendAuthId) {
      return NextResponse.json({
        success: false,
        message: 'Cannot remove yourself as a friend'
      }, { status: 400, headers: corsHeaders });
    }

    // Get database user IDs
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id, clerk_id, username, display_name')
      .in('clerk_id', [userAuthId, friendAuthId]);

    if (usersError || !users || users.length !== 2) {
      return NextResponse.json({
        success: false,
        message: 'Users not found in database'
      }, { status: 404, headers: corsHeaders });
    }

    const user = users.find(u => u.clerk_id === userAuthId);
    const friend = users.find(u => u.clerk_id === friendAuthId);

    if (!user || !friend) {
      return NextResponse.json({
        success: false,
        message: 'Unable to find user profiles'
      }, { status: 404, headers: corsHeaders });
    }

    // Delete both directions of the friendship
    const { error: deleteFriendshipError } = await supabase
      .from('friendships')
      .delete()
      .or(`and(user_id.eq.${user.id},friend_id.eq.${friend.id}),and(user_id.eq.${friend.id},friend_id.eq.${user.id})`);

    if (deleteFriendshipError) {
      console.error('Failed to delete friendship:', deleteFriendshipError);
      throw new Error(`Failed to remove friendship: ${deleteFriendshipError.message}`);
    }

    console.log(`✅ Friendship removed: ${user.username} ↔ ${friend.username}`);

    return NextResponse.json({
      success: true,
      message: `${friend.display_name || friend.username} has been removed from your friends`,
      removedFriend: {
        id: friend.clerk_id,
        username: friend.username,
        displayName: friend.display_name
      }
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('❌ Remove friend error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to remove friend'
    }, {
      status: 500,
      headers: corsHeaders
    });
  }
}
