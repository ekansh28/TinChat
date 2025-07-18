// src/app/api/css/download/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { fileId } = await request.json();

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    // Call the stored procedure to increment download count
    const { data: newDownloadCount, error } = await supabase.rpc('increment_download_count', {
      file_id: fileId,
    });

    if (error) {
      console.error('Error incrementing download count:', error);
      // Optionally still return success: false
      return NextResponse.json({ error: 'Failed to increment download count' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      newDownloadCount, // The updated value
    });

  } catch (error) {
    console.error('Download API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
