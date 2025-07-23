// src/app/api/friends/accept-request/route.ts - Accept Friend Request
import { NextRequest, NextResponse } from 'next/server';

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
    const { requestId, acceptingUserId } = body;

    console.log('✅ Accepting friend request:', { requestId, acceptingUserId });

    if (!requestId || !acceptingUserId) {
      return NextResponse.json({
        success: false,
        message: 'requestId and acceptingUserId are required'
      }, { status: 400, headers: corsHeaders });
    }

    // In a real implementation, you would:
    // 1. Find the friend request by ID
    // 2. Verify the accepting user is the receiver
    // 3. Update request status to 'accepted'
    // 4. Create friendship records for both users
    // 5. Send notifications
    // 6. Delete the request record

    console.log(`✅ Friend request ${requestId} accepted by ${acceptingUserId}`);

    return NextResponse.json({
      success: true,
      message: 'Friend request accepted successfully'
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