// src/app/api/friends/request/accept/route.ts
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
    const { requestId, accepterAuthId } = body;

    console.log('✅ Accepting friend request:', {
      requestId,
      accepter: accepterAuthId
    });

    if (!requestId || !accepterAuthId) {
      return NextResponse.json({
        success: false,
        message: 'Request ID and accepter auth ID are required'
      }, { status: 400, headers: corsHeaders });
    }

    // Get the accepter's database profile
    const { data: accepterProfile, error: accepterError } = await supabase
      .from('user_profiles')
      .select('id, clerk_id, username, display_name')
      .eq('clerk_id', accepterAuthId)
      .single();

    if (accepterError || !accepterProfile) {
      return NextResponse.json({
        success: false,
        message: 'Accepter profile not found'
      }, { status: 404, headers: corsHeaders });
    }

    // Get the friend request with sender details
    const { data: friendRequest, error: requestError } = await supabase
      .from('friend_requests')
      .select(`
        id,
        sender_id,
        receiver_id,
        status,
        sender:user_profiles!friend_requests_sender_id_fkey (
          id,
          clerk_id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('id', requestId)
      .eq('receiver_id', accepterProfile.id)
      .eq('status', 'pending')
      .single();

    if (requestError || !friendRequest) {
      console.error('Friend request not found:', requestError);
      return NextResponse.json({
        success: false,
        message: 'Friend request not found or already processed'
      }, { status: 404, headers: corsHeaders });
    }

    // Check if friendship already exists
    const { data: existingFriendship, error: friendshipCheckError } = await supabase
      .from('friendships')
      .select('id')
      .or(`and(user_id.eq.${friendRequest.sender_id},friend_id.eq.${accepterProfile.id}),and(user_id.eq.${accepterProfile.id},friend_id.eq.${friendRequest.sender_id})`)
      .eq('status', 'accepted')
      .maybeSingle();

    if (existingFriendship) {
      return NextResponse.json({
        success: false,
        message: 'Users are already friends'
      }, { status: 409, headers: corsHeaders });
    }

    // ✅ UPDATED: Create friendship entries for both users
    const { error: friendshipError } = await supabase
      .from('friendships')
      .insert([
        {
          user_id: friendRequest.sender_id,
          friend_id: accepterProfile.id,
          status: 'accepted',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          user_id: accepterProfile.id,
          friend_id: friendRequest.sender_id,
          status: 'accepted',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);

    if (friendshipError) {
      console.error('Failed to create friendship:', friendshipError);
      throw new Error(`Failed to create friendship: ${friendshipError.message}`);
    }

    // ✅ NEW: Delete the accepted friend request after successful friendship creation
    const { error: deleteRequestError } = await supabase
      .from('friend_requests')
      .delete()
      .eq('id', requestId);

    if (deleteRequestError) {
      console.warn('Failed to delete accepted friend request:', deleteRequestError);
      // Don't fail the entire operation if cleanup fails
    } else {
      console.log(`🗑️ Cleaned up accepted friend request: ${requestId}`);
    }

    const senderInfo = friendRequest.sender as any;
    
    console.log(`✅ Friend request accepted: ${senderInfo?.username} ↔ ${accepterProfile.username}`);

    return NextResponse.json({
      success: true,
      message: `You are now friends with ${senderInfo?.display_name || senderInfo?.username}!`,
      friendship: {
        requestId: friendRequest.id,
        friend: {
          id: senderInfo?.clerk_id,
          username: senderInfo?.username,
          displayName: senderInfo?.display_name,
          avatarUrl: senderInfo?.avatar_url
        },
        timestamp: new Date().toISOString(),
        cleaned: !deleteRequestError // Indicates if request was successfully deleted
      }
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('❌ Accept friend request error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to accept friend request'
    }, {
      status: 500,
      headers: corsHeaders
    });
  }
}
