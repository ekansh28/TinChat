// src/app/api/css/route.ts - Main CSS files API
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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

// GET - Fetch CSS files with filtering and sorting
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const tags = searchParams.get('tags')?.split(',').filter(Boolean);
    const fileType = searchParams.get('type') as 'profile' | 'chat_theme' | 'all' | null;
    const sortBy = searchParams.get('sort') || 'date';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('css_files')
      .select('*');

    // Apply filters
    if (fileType && fileType !== 'all' && fileType !== null) {
      query = query.eq('file_type', fileType);
    }

    if (search) {
      query = query.or(
        `title.ilike.%${search}%,author_username.ilike.%${search}%,author_display_name.ilike.%${search}%`
      );
    }

    if (tags && tags.length > 0) {
      query = query.overlaps('tags', tags);
    }

    // Apply sorting
    switch (sortBy) {
      case 'date':
        query = query.order('created_at', { ascending: false });
        break;
      case 'popularity':
        query = query.order('likes_count', { ascending: false });
        break;
      case 'rating':
        query = query.order('likes_count', { ascending: false })
                   .order('dislikes_count', { ascending: true });
        break;
      case 'downloads':
        query = query.order('download_count', { ascending: false });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching CSS files:', error);
      return NextResponse.json(
        { error: 'Failed to fetch CSS files' },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json({
      data: data || [],
      count,
      hasMore: (data?.length || 0) === limit
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('CSS API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST - Upload new CSS file
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await request.json();
    const { title, fileType, fileUrl, previewImageUrl, tags } = body;

    // Validate required fields
    if (!title || !fileType || !fileUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get user profile for display name
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('username, display_name')
      .eq('clerk_id', userId)
      .single();

    // Insert CSS file record
    const { data, error } = await supabase
      .from('css_files')
      .insert({
        title: title.trim(),
        author_id: userId,
        author_username: profile?.username || 'unknown',
        author_display_name: profile?.display_name || 'User',
        file_type: fileType,
        file_url: fileUrl,
        preview_image_url: previewImageUrl,
        tags: tags || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating CSS file:', error);
      return NextResponse.json(
        { error: 'Failed to create CSS file' },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json({
      success: true,
      data
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('CSS upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}