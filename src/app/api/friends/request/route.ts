// src/app/api/friends/request/route.ts
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

    // Get user's database ID
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

    // Get received requests
    const { data: receivedRequests, error: receivedError } = await supabase
      .from('friend_requests')
      .select(`
        id,
        message,
        created_at,
        sender:user_profiles!friend_requests_sender_id_fkey (
          id,
          clerk_id,
          username,
          display_name,
          avatar_url,
          is_online
        )
      `)
      .eq('receiver_id', userProfile.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    // Get sent requests
    const { data: sentRequests, error: sentError } = await supabase
      .from('friend_requests')
      .select(`
        id,
        message,
        created_at,
        receiver:user_profiles!friend_requests_receiver_id_fkey (
          id,
          clerk_id,
          username,
          display_name,
          avatar_url,
          is_online
        )
      `)
      .eq('sender_id', userProfile.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    return NextResponse.json({
      success: true,
      requests: {
        received: receivedRequests || [],
        sent: sentRequests || []
      }
    }); // ✅ FIXED: Added missing closing brace

  } catch (error: any) {
    console.error('❌ Friend requests error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to load requests'
    }, { status: 500 });
  } // ✅ FIXED: Added missing closing brace
} // ✅ FIXED: Added missing closing brace for GET function
