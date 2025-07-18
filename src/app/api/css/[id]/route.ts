// src/app/api/css/[id]/vote/route.ts - Voting API
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

// POST - Vote on CSS file
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const { id } = await params;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await request.json();
    const { voteType } = body;

    if (!voteType || !['like', 'dislike'].includes(voteType)) {
      return NextResponse.json(
        { error: 'Invalid vote type' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check if CSS file exists
    const { data: cssFile, error: cssError } = await supabase
      .from('css_files')
      .select('id')
      .eq('id', id)
      .single();

    if (cssError || !cssFile) {
      return NextResponse.json(
        { error: 'CSS file not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Check if user already voted
    const { data: existingVote, error: voteError } = await supabase
      .from('css_file_likes')
      .select('like_type')
      .eq('file_id', id)
      .eq('user_id', userId)
      .single();

    if (voteError && voteError.code !== 'PGRST116') {
      throw voteError;
    }

    if (existingVote) {
      if (existingVote.like_type === voteType) {
        // Remove vote if clicking same button
        const { error: deleteError } = await supabase
          .from('css_file_likes')
          .delete()
          .eq('file_id', id)
          .eq('user_id', userId);

        if (deleteError) throw deleteError;

        return NextResponse.json({
          success: true,
          action: 'removed',
          voteType: null
        }, { headers: corsHeaders });
      } else {
        // Update vote type
        const { error: updateError } = await supabase
          .from('css_file_likes')
          .update({ like_type: voteType })
          .eq('file_id', id)
          .eq('user_id', userId);

        if (updateError) throw updateError;

        return NextResponse.json({
          success: true,
          action: 'updated',
          voteType
        }, { headers: corsHeaders });
      }
    } else {
      // Create new vote
      const { error: insertError } = await supabase
        .from('css_file_likes')
        .insert({
          file_id: id,
          user_id: userId,
          like_type: voteType
        });

      if (insertError) throw insertError;

      return NextResponse.json({
        success: true,
        action: 'created',
        voteType
      }, { headers: corsHeaders });
    }

  } catch (error) {
    console.error('Vote error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// GET - Get user's vote for CSS file
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const { id } = await params;
    
    if (!userId) {
      return NextResponse.json({
        success: true,
        vote: null
      }, { headers: corsHeaders });
    }

    const { data: vote, error } = await supabase
      .from('css_file_likes')
      .select('like_type')
      .eq('file_id', id)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return NextResponse.json({
      success: true,
      vote: vote?.like_type || null
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Get vote error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// src/app/api/css/[id]/comments/route.ts - Comments API
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

// GET - Fetch comments for CSS file
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const { data, error } = await supabase
      .from('css_file_comments')
      .select('*')
      .eq('file_id', id)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching comments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch comments' },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Comments fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST - Add comment to CSS file
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const { id } = await params;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await request.json();
    const { commentText } = body;

    if (!commentText || !commentText.trim()) {
      return NextResponse.json(
        { error: 'Comment text is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (commentText.trim().length > 500) {
      return NextResponse.json(
        { error: 'Comment must be less than 500 characters' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check if CSS file exists
    const { data: cssFile, error: cssError } = await supabase
      .from('css_files')
      .select('id')
      .eq('id', id)
      .single();

    if (cssError || !cssFile) {
      return NextResponse.json(
        { error: 'CSS file not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Get user profile for display name
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('username, display_name')
      .eq('clerk_id', userId)
      .single();

    // Insert comment
    const { data, error } = await supabase
      .from('css_file_comments')
      .insert({
        file_id: id,
        user_id: userId,
        username: profile?.username || 'unknown',
        display_name: profile?.display_name || 'User',
        comment_text: commentText.trim()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating comment:', error);
      return NextResponse.json(
        { error: 'Failed to create comment' },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json({
      success: true,
      data
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Comment creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// src/app/api/css/[id]/comments/[commentId]/route.ts - Individual comment operations
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

// PUT - Update comment (author only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { userId } = await auth();
    const { commentId } = await params;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await request.json();
    const { commentText } = body;

    if (!commentText || !commentText.trim()) {
      return NextResponse.json(
        { error: 'Comment text is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (commentText.trim().length > 500) {
      return NextResponse.json(
        { error: 'Comment must be less than 500 characters' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check if user owns this comment
    const { data: comment, error: fetchError } = await supabase
      .from('css_file_comments')
      .select('user_id')
      .eq('id', commentId)
      .single();

    if (fetchError || !comment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    if (comment.user_id !== userId) {
      return NextResponse.json(
        { error: 'Not authorized to delete this comment' },
        { status: 403, headers: corsHeaders }
      );
    }

    // Delete comment
    const { error } = await supabase
      .from('css_file_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      console.error('Error deleting comment:', error);
      return NextResponse.json(
        { error: 'Failed to delete comment' },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Comment deleted successfully'
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Comment delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}Response.json(
        { error: 'Not authorized to edit this comment' },
        { status: 403, headers: corsHeaders }
      );
    }

    // Update comment
    const { data, error } = await supabase
      .from('css_file_comments')
      .update({
        comment_text: commentText.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', commentId)
      .select()
      .single();

    if (error) {
      console.error('Error updating comment:', error);
      return NextResponse.json(
        { error: 'Failed to update comment' },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json({
      success: true,
      data
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Comment update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// DELETE - Delete comment (author only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { userId } = await auth();
    const { commentId } = await params;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders }
      );
    }

    // Check if user owns this comment
    const { data: comment, error: fetchError } = await supabase
      .from('css_file_comments')
      .select('user_id')
      .eq('id', commentId)
      .single();

    if (fetchError || !comment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    if (comment.user_id !== userId) {
      return Next