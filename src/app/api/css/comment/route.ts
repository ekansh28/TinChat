// src/app/api/css/comment/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
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

export async function POST(request: NextRequest) {
 try {
   const { userId } = await auth();
   
   if (!userId) {
     return NextResponse.json({ error: 'Authentication required' }, { status: 401, headers: corsHeaders });
   }

   const { fileId, commentText } = await request.json();

   // Get user info from Clerk
   const client = await clerkClient();
   const user = await client.users.getUser(userId);
   
   console.log('💬 Adding comment with user info:', {
     userId,
     username: user.username,
     displayName: user.fullName,
     imageUrl: user.imageUrl
   });

   // Get user profile from Supabase (if exists)
   const { data: profile } = await supabase
     .from('user_profiles')
     .select('username, display_name')
     .eq('clerk_id', userId)
     .single();

   const commentData = {
     file_id: fileId,
     user_id: userId,
     username: profile?.username || user.username || 'user',
     display_name: profile?.display_name || user.fullName || user.username || 'User',
     profile_image_url: user.imageUrl,
     comment_text: commentText
   };

   console.log('💾 Inserting comment data:', commentData);

   const { data, error } = await supabase
     .from('css_file_comments')
     .insert(commentData)
     .select()
     .single();

   if (error) {
     console.error('❌ Database error:', error);
     throw error;
   }

   console.log('✅ Comment inserted successfully:', data);

   return NextResponse.json({ 
     success: true, 
     comment: data 
   }, { headers: corsHeaders });
 } catch (error) {
   console.error('Comment error:', error);
   return NextResponse.json({ error: 'Failed to submit comment' }, { status: 500, headers: corsHeaders });
 }
}

export async function DELETE(request: NextRequest) {
 try {
   const { userId } = await auth();
   
   if (!userId) {
     return NextResponse.json({ error: 'Authentication required' }, { status: 401, headers: corsHeaders });
   }

   const { commentId } = await request.json();

   console.log('🗑️ Deleting comment:', { commentId, userId });

   // First, get the comment to check permissions
   const { data: comment, error: fetchError } = await supabase
     .from('css_file_comments')
     .select('user_id, file_id')
     .eq('id', commentId)
     .single();

   if (fetchError || !comment) {
     console.error('❌ Comment not found:', fetchError);
     return NextResponse.json({ error: 'Comment not found' }, { status: 404, headers: corsHeaders });
   }

   // Check if user can delete this comment
   let canDelete = false;

   // User can delete their own comment
   if (comment.user_id === userId) {
     canDelete = true;
   } else {
     // Or if they're the author of the CSS file
     const { data: cssFile } = await supabase
       .from('css_files')
       .select('author_id')
       .eq('id', comment.file_id)
       .single();

     if (cssFile && cssFile.author_id === userId) {
       canDelete = true;
     }
   }

   if (!canDelete) {
     console.error('❌ User not authorized to delete comment');
     return NextResponse.json({ error: 'Not authorized to delete this comment' }, { status: 403, headers: corsHeaders });
   }

   // Delete the comment
   const { error: deleteError } = await supabase
     .from('css_file_comments')
     .delete()
     .eq('id', commentId);

   if (deleteError) {
     console.error('❌ Error deleting comment:', deleteError);
     throw deleteError;
   }

   console.log('✅ Comment deleted successfully');

   return NextResponse.json({ 
     success: true, 
     message: 'Comment deleted successfully' 
   }, { headers: corsHeaders });
 } catch (error) {
   console.error('Delete comment error:', error);
   return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500, headers: corsHeaders });
 }
}