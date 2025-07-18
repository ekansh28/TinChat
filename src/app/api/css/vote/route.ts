// src/app/api/css/vote/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { fileId, voteType, currentVote } = await request.json();

    if (currentVote) {
      if (currentVote === voteType) {
        // Remove vote
        await supabase
          .from('css_file_likes')
          .delete()
          .eq('file_id', fileId)
          .eq('user_id', userId);
        
        return NextResponse.json({ userVote: null });
      } else {
        // Change vote
        await supabase
          .from('css_file_likes')
          .update({ like_type: voteType })
          .eq('file_id', fileId)
          .eq('user_id', userId);
        
        return NextResponse.json({ userVote: { like_type: voteType } });
      }
    } else {
      // Create new vote
      await supabase
        .from('css_file_likes')
        .insert({
          file_id: fileId,
          user_id: userId,
          like_type: voteType
        });
      
      return NextResponse.json({ userVote: { like_type: voteType } });
    }
  } catch (error) {
    console.error('Vote error:', error);
    return NextResponse.json({ error: 'Failed to submit vote' }, { status: 500 });
  }
}