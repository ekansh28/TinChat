// src/app/api/friends/decline-request/route.ts - Decline Friend Request
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
    const { requestId, decliningUserId } = body;

    console.log('❌ Declining friend request:', { requestId, decliningUserId });

    if (!requestId || !decliningUserId) {
      return NextResponse.json({
        success: false,
        message: 'requestId and decliningUserId are required'
      }, { status: 400, headers: corsHeaders });
    }

    // In a real implementation, you would:
    // 1. Find the friend request by ID
    // 2. Verify the declining user is the receiver
    // 3. Delete the request record
    // 4. Optionally notify the sender

    console.log(`❌ Friend request ${requestId} declined by ${decliningUserId}`);

    return NextResponse.json({
      success: true,
      message: 'Friend request declined'
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('❌ Decline friend request error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to decline friend request'
    }, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}