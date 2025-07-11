// src/app/api/friends/send-request/route.ts - Send Friend Request
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
    const { senderAuthId, receiverAuthId, message } = body;

    console.log('📤 Sending friend request:', { 
      from: senderAuthId, 
      to: receiverAuthId,
      hasMessage: !!message 
    });

    if (!senderAuthId || !receiverAuthId) {
      return NextResponse.json({
        success: false,
        message: 'Both senderAuthId and receiverAuthId are required'
      }, { status: 400, headers: corsHeaders });
    }

    if (senderAuthId === receiverAuthId) {
      return NextResponse.json({
        success: false,
        message: 'Cannot send friend request to yourself'
      }, { status: 400, headers: corsHeaders });
    }

    // Verify both users exist
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('clerk_id, username, display_name, avatar_url')
      .in('clerk_id', [senderAuthId, receiverAuthId]);

    if (usersError) {
      throw new Error(`Database error: ${usersError.message}`);
    }

    if (!users || users.length !== 2) {
      return NextResponse.json({
        success: false,
        message: 'One or both users not found'
      }, { status: 404, headers: corsHeaders });
    }

    const sender = users.find(u => u.clerk_id === senderAuthId);
    const receiver = users.find(u => u.clerk_id === receiverAuthId);

    const friendRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      senderAuthId,
      receiverAuthId,
      senderProfile: {
        username: sender?.username,
        displayName: sender?.display_name,
        avatarUrl: sender?.avatar_url
      },
      receiverProfile: {
        username: receiver?.username,
        displayName: receiver?.display_name,
        avatarUrl: receiver?.avatar_url
      },
      message: message?.trim() || null,
      status: 'pending',
      timestamp: new Date().toISOString()
    };

    console.log(`✅ Friend request sent from ${sender?.username} to ${receiver?.username}`);

    return NextResponse.json({
      success: true,
      message: `Friend request sent to ${receiver?.display_name || receiver?.username}`,
      autoAccepted: false,
      request: friendRequest
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