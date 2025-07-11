// src/app/api/friends/search/route.ts - Fixed Search Route
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
    const { currentUserAuthId, searchTerm, limit = 20 } = body;

    console.log('🔍 Searching users:', { searchTerm, limit, currentUser: currentUserAuthId });

    if (!searchTerm || searchTerm.length < 2) {
      return NextResponse.json({
        success: true,
        users: [],
        message: 'Search term must be at least 2 characters'
      }, { headers: corsHeaders });
    }

    // Search for users by username or display name
    const { data: users, error } = await supabase
      .from('user_profiles')
      .select('clerk_id, username, display_name, avatar_url, status, is_online')
      .or(`username.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%`)
      .neq('clerk_id', currentUserAuthId)
      .limit(limit);

    if (error) {
      throw new Error(`Search error: ${error.message}`);
    }

    // Transform results for the frontend
    const searchResults = (users || []).map(user => ({
      id: user.clerk_id,
      username: user.username,
      displayName: user.display_name || user.username,
      avatarUrl: user.avatar_url,
      status: user.status || 'offline',
      isOnline: user.is_online || false,
      friendshipStatus: 'none'
    }));

    console.log(`✅ Found ${searchResults.length} users matching "${searchTerm}"`);

    return NextResponse.json({
      success: true,
      users: searchResults,
      count: searchResults.length,
      searchTerm
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('❌ User search error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Search failed',
      users: []
    }, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}