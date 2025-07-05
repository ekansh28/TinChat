// src/app/api/profile/load/route.ts - NEW ENDPOINT FOR LOADING ANY USER'S PROFILE
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

// Use service role key to bypass RLS
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

export async function GET(req: NextRequest) {
  console.log('API: Profile load request received');
  
  try {
    // Verify requester is authenticated with Clerk
    const { userId: requesterId } = await auth();
    
    if (!requesterId) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401, headers: corsHeaders }
      );
    }

    // Get the target user ID from query parameters
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('userId');
    
    if (!targetUserId) {
      return NextResponse.json(
        { error: 'userId parameter is required' }, 
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('API: Loading profile for user:', targetUserId);

    // Query the database for the target user's profile
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('clerk_id', targetUserId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('API: Load error:', error);
      return NextResponse.json(
        { error: error.message }, 
        { status: 500, headers: corsHeaders }
      );
    }

    if (!data) {
      console.log('API: No profile found for user:', targetUserId);
      return NextResponse.json(
        { 
          success: false, 
          message: 'Profile not found',
          data: null 
        }, 
        { headers: corsHeaders }
      );
    }

    console.log('API: Profile loaded successfully for user:', targetUserId);

    // Return the profile data (excluding sensitive fields if needed)
    const profileData = {
      ...data,
      // Remove sensitive fields that shouldn't be public
      clerk_id: data.clerk_id, // Keep this for identification
      // You might want to hide certain fields based on privacy settings
    };

    return NextResponse.json({ 
      success: true, 
      data: profileData 
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('API: Load error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500, headers: corsHeaders }
    );
  }
}