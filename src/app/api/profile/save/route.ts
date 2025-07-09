// src/app/api/profile/save/route.ts - FIXED BADGES STORAGE
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

export async function POST(req: NextRequest) {
  console.log('API: Profile save request received');
  
  try {
    // Verify user is authenticated with Clerk
    const { userId } = await auth();
    console.log('API: Clerk auth result:', { userId });
    
    if (!userId) {
      console.log('API: Unauthorized - no userId from Clerk');
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' }, 
        { status: 401, headers: corsHeaders }
      );
    }

    let profileData;
    try {
      profileData = await req.json();
      console.log('API: Received profile data:', profileData);
    } catch (parseError) {
      console.error('API: Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid request body - must be valid JSON' }, 
        { status: 400, headers: corsHeaders }
      );
    }

    // Server-side validation
    if (!profileData.username?.trim()) {
      return NextResponse.json(
        { error: 'Username is required' }, 
        { status: 400, headers: corsHeaders }
      );
    }

    if (profileData.username.trim().length < 3) {
      return NextResponse.json(
        { error: 'Username must be at least 3 characters' }, 
        { status: 400, headers: corsHeaders }
      );
    }

    if (profileData.username.trim().length > 20) {
      return NextResponse.json(
        { error: 'Username must be less than 20 characters' }, 
        { status: 400, headers: corsHeaders }
      );
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(profileData.username.trim())) {
      return NextResponse.json(
        { error: 'Username can only contain letters, numbers, underscores, and dashes' }, 
        { status: 400, headers: corsHeaders }
      );
    }

    // ✅ FIXED: Validate badges and store as proper JSONB
    let parsedBadges = [];
    if (profileData.badges) {
      try {
        parsedBadges = typeof profileData.badges === 'string' 
          ? JSON.parse(profileData.badges) 
          : profileData.badges;
        
        if (!Array.isArray(parsedBadges)) {
          parsedBadges = [];
        }
        
        if (parsedBadges.length > 10) {
          return NextResponse.json(
            { error: 'Maximum 10 badges allowed' }, 
            { status: 400, headers: corsHeaders }
          );
        }

        // Validate each badge
        parsedBadges = parsedBadges.filter(badge => {
          return badge && 
            typeof badge === 'object' && 
            badge.id && 
            badge.url &&
            typeof badge.id === 'string' &&
            typeof badge.url === 'string';
        });

        console.log('API: Processed badges:', parsedBadges);
      } catch (e) {
        console.warn('API: Invalid badges data, using empty array:', e);
        parsedBadges = [];
      }
    }

    console.log('API: Checking if profile exists for user:', userId);

    // First, check if profile already exists
    const { data: existingProfile, error: checkError } = await supabase
      .from('user_profiles')
      .select('id, clerk_id')
      .eq('clerk_id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('API: Error checking existing profile:', checkError);
      return NextResponse.json(
        { error: `Database error: ${checkError.message}` }, 
        { status: 500, headers: corsHeaders }
      );
    }

    // Prepare the profile data
    const profileUpdateData = {
      clerk_id: userId,
      username: profileData.username.trim(),
      display_name: profileData.display_name?.trim() || null,
      avatar_url: profileData.avatar_url?.trim() || null,
      banner_url: profileData.banner_url?.trim() || null,
      pronouns: profileData.pronouns?.trim() || null,
      bio: profileData.bio?.trim() || null,
      status: profileData.status || 'online',
      display_name_color: profileData.display_name_color || '#000000',
      display_name_animation: profileData.display_name_animation || 'none',
      rainbow_speed: Math.max(1, Math.min(10, profileData.rainbow_speed || 3)),
      profile_card_css: profileData.profile_card_css?.trim() || null,
      // ✅ FIXED: Store badges as JSONB array, not stringified JSON
      badges: parsedBadges.length > 0 ? parsedBadges : null,
      profile_complete: true,
      updated_at: new Date().toISOString()
    };

    console.log('API: Profile data to save:', {
      ...profileUpdateData,
      badges: parsedBadges,
      badgesLength: parsedBadges.length,
      badgesType: typeof parsedBadges
    });

    let result;

    if (existingProfile) {
      // Profile exists - UPDATE it
      console.log('API: Updating existing profile with ID:', existingProfile.id);
      
      const { data, error } = await supabase
        .from('user_profiles')
        .update(profileUpdateData)
        .eq('id', existingProfile.id)
        .select()
        .single();

      if (error) {
        console.error('API: Supabase update error:', error);
        return NextResponse.json(
          { error: `Database error: ${error.message}` }, 
          { status: 500, headers: corsHeaders }
        );
      }

      result = data;
      console.log('API: Profile updated successfully');
    } else {
      // Profile doesn't exist - INSERT new one
      console.log('API: Creating new profile for user:', userId);
      
      // For INSERT, we don't include 'id' if it's auto-generated
      const insertData = {
        ...profileUpdateData,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('user_profiles')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('API: Supabase insert error:', error);
        return NextResponse.json(
          { error: `Database error: ${error.message}` }, 
          { status: 500, headers: corsHeaders }
        );
      }

      result = data;
      console.log('API: Profile created successfully');
    }

    console.log('API: Operation completed successfully for user:', userId);
    
    return NextResponse.json({ 
      success: true, 
      data: result,
      message: 'Profile saved successfully'
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('API: Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message }, 
      { status: 500, headers: corsHeaders }
    );
  }
}

// GET endpoint for loading profiles (unchanged)
export async function GET(req: NextRequest) {
  console.log('API: Profile load request received');
  
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401, headers: corsHeaders }
      );
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('clerk_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('API: Load error:', error);
      return NextResponse.json(
        { error: error.message }, 
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json({ 
      success: true, 
      data: data || null 
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('API: Load error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500, headers: corsHeaders }
    );
  }
}