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

