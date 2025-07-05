// app/api/profile/save/route.ts
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

export async function POST(req: NextRequest) {
  try {
    // Verify user is authenticated with Clerk
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' }, 
        { status: 401 }
      );
    }

    const profileData = await req.json();
    console.log('API: Saving profile for user:', userId);

    // Server-side validation
    if (!profileData.username?.trim()) {
      return NextResponse.json(
        { error: 'Username is required' }, 
        { status: 400 }
      );
    }

    if (profileData.username.trim().length < 3) {
      return NextResponse.json(
        { error: 'Username must be at least 3 characters' }, 
        { status: 400 }
      );
    }

    if (profileData.username.trim().length > 20) {
      return NextResponse.json(
        { error: 'Username must be less than 20 characters' }, 
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(profileData.username.trim())) {
      return NextResponse.json(
        { error: 'Username can only contain letters, numbers, underscores, and dashes' }, 
        { status: 400 }
      );
    }

    // Validate badges
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
            { status: 400 }
          );
        }
      } catch (e) {
        console.warn('Invalid badges data, using empty array');
        parsedBadges = [];
      }
    }

    // Prepare the profile data
    const upsertData = {
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
      badges: parsedBadges.length > 0 ? JSON.stringify(parsedBadges) : null,
      profile_complete: true,
      updated_at: new Date().toISOString()
    };

    console.log('API: Upserting profile data for:', userId);

    // Use upsert to handle both insert and update
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert(upsertData, {
        onConflict: 'clerk_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      console.error('API: Supabase error:', error);
      return NextResponse.json(
        { error: `Database error: ${error.message}` }, 
        { status: 500 }
      );
    }

    console.log('API: Profile saved successfully for:', userId);
    
    return NextResponse.json({ 
      success: true, 
      data,
      message: 'Profile saved successfully'
    });

  } catch (error: any) {
    console.error('API: Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

// Also create a GET endpoint for loading profiles
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
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
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      data: data || null 
    });

  } catch (error: any) {
    console.error('API: Load error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}