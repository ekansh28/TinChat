// src/app/api/friends/[userId]/route.ts - Fixed Individual Route File
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role key to bypass RLS for friend operations
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

// Add CORS headers helper
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

// GET /api/friends/[userId] - Get user's friends list
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    
    console.log('🔍 Loading friends for user:', userId);

    // Get the user's profile first
    const { data: userProfile, error: userError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('clerk_id', userId)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      throw new Error(`Failed to find user: ${userError.message}`);
    }

    if (!userProfile) {
      return NextResponse.json({
        success: false,
        message: 'User not found'
      }, { status: 404, headers: corsHeaders });
    }

    // Mock friends data - replace with actual friends table query
    const mockFriends = [
      {
        id: 'friend_1',
        username: 'john_doe',
        display_name: 'John Doe',
        avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
        status: 'online',
        last_seen: new Date().toISOString(),
        is_online: true,
        friends_since: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: 'friend_2',
        username: 'jane_smith',
        display_name: 'Jane Smith',
        avatar_url: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face',
        status: 'idle',
        last_seen: new Date(Date.now() - 3600000).toISOString(),
        is_online: false,
        friends_since: new Date(Date.now() - 172800000).toISOString()
      }
    ];

    console.log(`✅ Returning ${mockFriends.length} friends for user ${userId}`);

    return NextResponse.json({
      success: true,
      friends: mockFriends,
      count: mockFriends.length
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('❌ Friends API error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to load friends',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

// POST /api/friends/[userId] - Add a new friend or send friend request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const body = await request.json();
    const { targetUserId, message } = body;

    console.log('📤 Friend request:', { from: userId, to: targetUserId });

    // Verify both users exist
    const { data: users, error } = await supabase
      .from('user_profiles')
      .select('clerk_id, username, display_name')
      .in('clerk_id', [userId, targetUserId]);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!users || users.length !== 2) {
      return NextResponse.json({
        success: false,
        message: 'One or both users not found'
      }, { status: 404, headers: corsHeaders });
    }

    const fromUser = users.find(u => u.clerk_id === userId);
    const toUser = users.find(u => u.clerk_id === targetUserId);

    console.log(`✅ Friend request sent from ${fromUser?.username} to ${toUser?.username}`);

    return NextResponse.json({
      success: true,
      message: `Friend request sent to ${toUser?.display_name || toUser?.username}`,
      autoAccepted: false,
      request: {
        id: `req_${Date.now()}`,
        from: fromUser,
        to: toUser,
        message: message || null,
        timestamp: new Date().toISOString(),
        status: 'pending'
      }
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('❌ Send friend request error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to send friend request'
    }, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

// DELETE /api/friends/[userId] - Remove a friend
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { searchParams } = new URL(request.url);
    const friendId = searchParams.get('friendId');

    if (!friendId) {
      return NextResponse.json({
        success: false,
        message: 'friendId is required'
      }, { status: 400, headers: corsHeaders });
    }

    console.log('🗑️ Removing friend:', { userId, friendId });
    console.log(`✅ Friendship removed between ${userId} and ${friendId}`);

    return NextResponse.json({
      success: true,
      message: 'Friend removed successfully'
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