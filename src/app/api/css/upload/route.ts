// src/app/api/css/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { uploadFileToR2, generateUniqueFileName, validateFileType, validateFileSize } from '@/lib/r2-storage';
import { createClient } from '@supabase/supabase-js';

// Use service role key to bypass RLS
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

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders }
      );
    }

    const contentType = request.headers.get('content-type');
    
    // Handle database save request
    if (contentType?.includes('application/json')) {
      const body = await request.json();
      const { action, title, fileType, cssUrl, previewUrls, tags } = body;
      
      if (action === 'save_to_db') {
        console.log('💾 Saving CSS file to database...');
        
        // Get user profile for display name
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('username, display_name')
          .eq('clerk_id', userId)
          .single();

        // Insert CSS file record using service role key
        const { error: insertError } = await supabase
          .from('css_files')
          .insert({
            title: title.trim(),
            author_id: userId,
            author_username: profile?.username || 'unknown',
            author_display_name: profile?.display_name || 'User',
            file_type: fileType,
            file_url: cssUrl,
            preview_image_urls: previewUrls && previewUrls.length > 0 ? previewUrls : null, // Array of URLs
            tags: tags && tags.length > 0 ? tags : null
          });

        if (insertError) {
          console.error('Database insert error:', insertError);
          throw insertError;
        }

        console.log('✅ CSS file saved to database successfully');
        return NextResponse.json({
          success: true,
          message: 'CSS file saved successfully'
        }, { headers: corsHeaders });
      }
    }

    // Handle file upload (existing code)
    console.log('🔄 Upload API called');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string;
    const requestUserId = formData.get('userId') as string;

    console.log('📋 Form data:', {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      folder,
      requestUserId
    });

    // Verify user ID matches
    if (userId !== requestUserId) {
      console.log('❌ User ID mismatch');
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 403, headers: corsHeaders }
      );
    }

    if (!file) {
      console.log('❌ No file provided');
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate file type based on folder
    let allowedTypes: string[];
    let maxSizeInMB: number;
    
    if (folder === 'css-files') {
      allowedTypes = ['css'];
      maxSizeInMB = 0.69; // 690KB limit for CSS files
    } else if (folder === 'css-previews') {
      allowedTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'ogg', 'avi', 'mov', 'quicktime'];
      maxSizeInMB = 10; // 10MB for preview files (changed from 50MB)
    } else {
      console.log('❌ Invalid folder:', folder);
      return NextResponse.json(
        { error: 'Invalid folder' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    console.log('🔍 File extension:', fileExtension);
    
    if (!fileExtension || !allowedTypes.includes(fileExtension)) {
      console.log('❌ Invalid file type');
      const fileTypeMessage = folder === 'css-files' 
        ? 'CSS files only' 
        : 'Images (JPEG, PNG, GIF, WebP) or Videos (MP4, WebM, OGG, AVI, MOV)';
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${fileTypeMessage}` },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate file size
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      console.log('❌ File too large');
      const sizeMessage = folder === 'css-files' ? '690KB' : '10MB';
      return NextResponse.json(
        { error: `File size must be less than ${sizeMessage}` },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check if R2 credentials are available
    console.log('🔑 Checking R2 credentials...');
    console.log('R2_ACCESS_KEY_ID:', process.env.R2_ACCESS_KEY_ID ? '✅ Set' : '❌ Missing');
    console.log('R2_SECRET_ACCESS_KEY:', process.env.R2_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Missing');

    if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
      console.log('❌ Missing R2 credentials');
      return NextResponse.json(
        { error: 'Server configuration error: Missing R2 credentials' },
        { status: 500, headers: corsHeaders }
      );
    }

    // Generate unique filename
    const uniqueFileName = generateUniqueFileName(file.name, userId);
    console.log('📝 Generated filename:', uniqueFileName);
    
    // Convert file to buffer
    let fileBuffer;
    try {
      fileBuffer = Buffer.from(await file.arrayBuffer());
      console.log('✅ File converted to buffer, size:', fileBuffer.length);
    } catch (bufferError) {
      console.error('❌ Buffer conversion error:', bufferError);
      return NextResponse.json(
        { error: 'Failed to process file' },
        { status: 500, headers: corsHeaders }
      );
    }
    
    // Upload to R2
    console.log('☁️ Attempting R2 upload...');
    let fileUrl;
    try {
      fileUrl = await uploadFileToR2(
        fileBuffer,
        uniqueFileName,
        file.type,
        folder
      );
      console.log('✅ R2 upload successful:', fileUrl);
    } catch (r2Error: unknown) {
      console.error('❌ R2 upload error:', r2Error);
      const errorMessage = r2Error instanceof Error ? r2Error.message : 'Unknown upload error';
      return NextResponse.json(
        { error: `Upload failed: ${errorMessage}` },
        { status: 500, headers: corsHeaders }
      );
    }

    console.log('🎉 Upload completed successfully');
    return NextResponse.json({
      success: true,
      fileUrl,
      fileName: uniqueFileName,
      originalName: file.name,
      size: file.size,
      type: file.type
    }, { headers: corsHeaders });

  } catch (error: unknown) {
    console.error('❌ Unexpected upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : 'No stack trace available';
    console.error('❌ Error stack:', errorStack);
    return NextResponse.json(
      { error: `Unexpected error: ${errorMessage}` },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Optional: GET endpoint to check upload status
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders }
      );
    }

    return NextResponse.json({
      message: 'Upload API is working',
      userId,
      limits: {
        cssFiles: '690KB max',
        previewFiles: '10MB max, 3 files max', // Updated
        supportedTypes: {
          css: ['css'],
          media: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'ogg', 'avi', 'mov']
        }
      }
    }, { headers: corsHeaders });

  } catch (error: unknown) {
    console.error('Upload API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}