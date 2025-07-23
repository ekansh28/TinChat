// src/app/api/friends//api/friends/request/send route.ts - Send Friend Request
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

    // ... validation code ...

    // ✅ ADD DEBUGGING: Get database user IDs
    console.log('🔍 Looking up users in database...');
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id, clerk_id, username, display_name, avatar_url')
      .in('clerk_id', [senderAuthId, receiverAuthId]);

    console.log('📊 User lookup result:', {
      users: users?.length,
      error: usersError?.message,
      foundUsers: users?.map(u => ({ clerk_id: u.clerk_id, username: u.username }))
    });

    if (usersError || !users || users.length !== 2) {
      console.error('❌ User lookup failed:', usersError);
      return NextResponse.json({
        success: false,
        message: 'Users not found in database'
      }, { status: 404, headers: corsHeaders });
    }

    const sender = users.find(u => u.clerk_id === senderAuthId);
    const receiver = users.find(u => u.clerk_id === receiverAuthId);

    console.log('👥 User mapping:', {
      sender: sender ? { id: sender.id, username: sender.username } : 'NOT FOUND',
      receiver: receiver ? { id: receiver.id, username: receiver.username } : 'NOT FOUND'
    });

    // ✅ ADD DEBUGGING: Check for existing request
    console.log('🔍 Checking for existing requests...');
    const { data: existingRequest, error: checkError } = await supabase
      .from('friend_requests')
      .select('id, status')
      .eq('sender_id', sender!.id)
      .eq('receiver_id', receiver!.id)
      .eq('status', 'pending')
      .maybeSingle(); // Use maybeSingle instead of single to avoid errors

    console.log('🔄 Existing request check:', {
      found: !!existingRequest,
      error: checkError?.message,
      requestId: existingRequest?.id
    });

    if (existingRequest) {
      return NextResponse.json({
        success: false,
        message: 'Friend request already exists'
      }, { status: 409, headers: corsHeaders });
    }

    // ✅ ADD DEBUGGING: Actually save to database
    console.log('💾 Inserting friend request to database...');
    console.log('📝 Insert data:', {
      sender_id: sender!.id,
      receiver_id: receiver!.id,
      message: message?.trim() || null,
      status: 'pending'
    });

    const { data: insertedRequest, error: insertError } = await supabase
      .from('friend_requests')
      .insert({
        sender_id: sender!.id,
        receiver_id: receiver!.id,
        message: message?.trim() || null,
        status: 'pending'
      })
      .select()
      .single();

    console.log('💾 Database insert result:', {
      success: !!insertedRequest,
      error: insertError?.message,
      insertedId: insertedRequest?.id,
      fullError: insertError // Full error details
    });

    if (insertError) {
      console.error('❌ Failed to save friend request:', insertError);
      return NextResponse.json({
        success: false,
        message: `Failed to save friend request: ${insertError.message}`
      }, { status: 500, headers: corsHeaders });
    }

    console.log(`✅ Friend request saved to database: ${sender?.username} → ${receiver?.username}`);

    return NextResponse.json({
      success: true,
      message: `Friend request sent to ${receiver?.display_name || receiver?.username}`,
      request: {
        id: insertedRequest.id,
        sender: sender!.username,
        receiver: receiver!.username,
        timestamp: insertedRequest.created_at
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
