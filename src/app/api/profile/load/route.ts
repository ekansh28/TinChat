// src/app/api/profile/load/route.ts - SIMPLIFIED FOR CLERK AUTH (FIXED)
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

// ✅ GET method for loading current user's profile (like ProfileCustomizer)
export async function GET(req: NextRequest) {
  console.log('API: Profile load GET request received');
  
  try {
    // Use Clerk's auth() function - this should work with cookies
    const { userId: requesterId } = await auth();
    
    if (!requesterId) {
      console.log('API: No authenticated user found');
      return NextResponse.json(
        { 
          success: false,
          error: 'Authentication required' 
        }, 
        { status: 401, headers: corsHeaders }
      );
    }

    console.log('API: Loading profile for current user:', requesterId);

    // Query the database for the current user's profile
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('clerk_id', requesterId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No profile found - this is normal for new users
        console.log('API: No profile found for current user:', requesterId);
        return NextResponse.json(
          { 
            success: true, 
            data: null,
            message: 'No profile found' 
          }, 
          { headers: corsHeaders }
        );
      }
      
      console.error('API: Database error:', error);
      return NextResponse.json(
        { 
          success: false,
          error: 'Database error: ' + error.message 
        }, 
        { status: 500, headers: corsHeaders }
      );
    }

    console.log('API: Profile loaded successfully for current user:', requesterId);
    return NextResponse.json({ 
      success: true, 
      data 
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('API: GET error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Server error: ' + error.message 
      }, 
      { status: 500, headers: corsHeaders }
    );
  }
}

// ✅ POST method for loading any user's profile (for ProfilePopup)
export async function POST(req: NextRequest) {
  console.log('API: Profile load POST request received');
  
  try {
    // Try to get authenticated user, but don't require it for basic profile viewing
    const { userId: requesterId } = await auth();
    
    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('API: Failed to parse request body:', parseError);
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid JSON in request body' 
        }, 
        { status: 400, headers: corsHeaders }
      );
    }

    const { clerkUserId } = body;
    
    if (!clerkUserId) {
      console.log('API: Missing clerkUserId in request body');
      return NextResponse.json(
        { 
          success: false,
          error: 'clerkUserId is required in request body' 
        }, 
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('API: Loading profile for user:', clerkUserId, requesterId ? `requested by: ${requesterId}` : '(no auth)');

    // Query the database for the target user's profile
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('clerk_id', clerkUserId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No profile found - create a minimal response for users without profiles
        console.log('API: No profile found for user:', clerkUserId);
        
        const minimalProfile = {
          id: null,
          clerk_id: clerkUserId, // ✅ Now included in the interface
          username: clerkUserId, // Use Clerk ID as fallback
          display_name: 'User',
          avatar_url: '',
          banner_url: '',
          pronouns: '',
          bio: '',
          status: 'offline',
          display_name_color: '#000000',
          display_name_animation: 'none',
          rainbow_speed: 3,
          profile_complete: false,
          badges: [],
          profile_card_css: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        return NextResponse.json(
          { 
            success: true, 
            data: minimalProfile,
            message: 'Created minimal profile for user without database entry' 
          }, 
          { headers: corsHeaders }
        );
      }
      
      console.error('API: Database error:', error);
      return NextResponse.json(
        { 
          success: false,
          error: 'Database error: ' + error.message 
        }, 
        { status: 500, headers: corsHeaders }
      );
    }

    console.log('API: Profile loaded successfully for user:', clerkUserId);

    // Return the profile data
    return NextResponse.json({ 
      success: true, 
      data 
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('API: POST error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Server error: ' + error.message 
      }, 
      { status: 500, headers: corsHeaders }
    );
  }
}