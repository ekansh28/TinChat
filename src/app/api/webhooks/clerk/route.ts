// src/app/api/webhooks/clerk/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { Webhook } from 'svix';
import { createClient } from '@supabase/supabase-js';

// Replace with your actual Clerk webhook secret
const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

if (!WEBHOOK_SECRET) {
  throw new Error('Please add CLERK_WEBHOOK_SECRET to your environment variables');
}

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  console.log('🎣 Webhook received at:', new Date().toISOString());
  
  const body = await request.text();
  const headerPayload = await headers();
  
  console.log('🎣 Webhook headers:', {
    'svix-id': headerPayload.get('svix-id'),
    'svix-timestamp': headerPayload.get('svix-timestamp'),
    'content-type': headerPayload.get('content-type'),
    'user-agent': headerPayload.get('user-agent'),
  });
  
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error('❌ Missing svix headers');
    return new NextResponse('Error occurred -- no svix headers', {
      status: 400,
    });
  }

  // Type guard to ensure WEBHOOK_SECRET is defined
  if (!WEBHOOK_SECRET) {
    console.error('CLERK_WEBHOOK_SECRET is not defined');
    return new NextResponse('Webhook configuration error', {
      status: 500,
    });
  }

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: any;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    });
  } catch (err) {
    console.error('❌ Error verifying webhook:', err);
    console.error('❌ Webhook body preview:', body.substring(0, 200));
    return new NextResponse('Error occurred', {
      status: 400,
    });
  }

  const { id } = evt.data;
  const eventType = evt.type;

  console.log(`🔔 Webhook received: ${eventType} for user: ${id}`);
  console.log('🔔 Event data preview:', {
    id: evt.data.id,
    email: evt.data.email_addresses?.[0]?.email_address,
    username: evt.data.username,
    externalAccounts: evt.data.external_accounts?.length || 0
  });

  try {
    if (eventType === 'user.created') {
      await handleUserCreated(evt.data);
    } else if (eventType === 'user.updated') {
      await handleUserUpdated(evt.data);
    } else if (eventType === 'user.deleted') {
      await handleUserDeleted(evt.data);
    } else {
      console.log(`ℹ️ Unhandled webhook event type: ${eventType}`);
    }

    return NextResponse.json({ message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('❌ Webhook processing error:', {
      error: error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      eventType: eventType,
      userId: id
    });
    return new NextResponse('Webhook processing failed', { status: 500 });
  }
}

async function handleUserCreated(userData: any) {
  console.log('👤 Processing user.created webhook:', {
    id: userData.id,
    email: userData.email_addresses?.[0]?.email_address,
    externalAccounts: userData.external_accounts?.map((acc: any) => ({
      provider: acc.provider,
      email: acc.email_address
    }))
  });

  // Determine if this is an OAuth user
  const isOAuthUser = userData.external_accounts && userData.external_accounts.length > 0;
  const oauthProvider = userData.external_accounts?.[0]?.provider || null;

  // Generate username based on OAuth provider or email
  let username = generateUsername(userData);
  console.log('🏷️ Generated username:', { original: username, provider: oauthProvider });
  
  // Check if generated username is available, make unique if needed
  username = await ensureUniqueUsername(username);
  console.log('🏷️ Final unique username:', username);

  // Prepare profile data
  const profileData = {
    clerk_id: userData.id,
    email: userData.email_addresses?.[0]?.email_address,
    username: username,
    display_name: username,
    oauth_provider: oauthProvider,
    profile_complete: !isOAuthUser, // OAuth users need to complete setup
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  console.log('💾 Creating profile with data:', profileData);

  // Check if profile already exists
  const { data: existingProfile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('clerk_id', userData.id)
    .single();

  if (existingProfile) {
    console.log('✅ Profile already exists, skipping creation');
    return;
  }

  // Insert profile into Supabase database
  console.log('💾 Attempting to insert profile into database...');
  const { data, error } = await supabase
    .from('user_profiles')
    .insert([profileData])
    .select()
    .single();

  if (error) {
    console.error('❌ Database insert error:', {
      error: error,
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      profileData: profileData
    });
    
    // Check if it's a unique constraint violation (username already exists)
    if (error.code === '23505') { // PostgreSQL unique violation
      console.error('📝 Unique constraint violation - username might already exist');
      // Try with a different username
      const fallbackUsername = `${profileData.username}_${Date.now().toString().slice(-6)}`;
      console.log(`🔄 Retrying with fallback username: ${fallbackUsername}`);
      
      const retryData = { ...profileData, username: fallbackUsername };
      const { data: retryResult, error: retryError } = await supabase
        .from('user_profiles')
        .insert([retryData])
        .select()
        .single();
        
      if (retryError) {
        console.error('❌ Retry also failed:', retryError);
        throw new Error(`Failed to create profile even with fallback: ${retryError.message}`);
      }
      
      console.log('✅ Profile created successfully with fallback username:', retryResult);
      return;
    }
    
    throw new Error(`Failed to create profile: ${error.message}`);
  }

  console.log('✅ Profile created successfully:', data);
}

async function handleUserUpdated(userData: any) {
  console.log('🔄 Processing user.updated webhook:', {
    id: userData.id,
    email: userData.email_addresses?.[0]?.email_address
  });

  // Update profile data
  const updateData = {
    email: userData.email_addresses?.[0]?.email_address,
    updated_at: new Date().toISOString()
  };

  // Update profile in Supabase database
  const { data, error } = await supabase
    .from('user_profiles')
    .update(updateData)
    .eq('clerk_id', userData.id)
    .select()
    .single();

  if (error) {
    console.error('❌ Database update error:', error);
    throw new Error(`Failed to update profile: ${error.message}`);
  }

  console.log('✅ Profile updated successfully:', data);
}

async function handleUserDeleted(userData: any) {
  console.log('🗑️ Processing user.deleted webhook:', {
    id: userData.id,
    email: userData.email_addresses?.[0]?.email_address
  });

  try {
    // Start a transaction to ensure all related data is deleted
    await deleteUserFromSupabase(userData.id);
    console.log('✅ User and related data deleted successfully from Supabase');
  } catch (error) {
    console.error('❌ Failed to delete user from Supabase:', error);
    throw error;
  }
}

async function deleteUserFromSupabase(clerkId: string) {
  console.log(`🧹 Starting cleanup for user: ${clerkId}`);
  
  // Get user profile to check what needs to be cleaned up
  const { data: userProfile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('clerk_id', clerkId)
    .single();

  if (profileError && profileError.code !== 'PGRST116') {
    console.error('❌ Error fetching user profile for deletion:', profileError);
    throw new Error(`Failed to fetch user profile: ${profileError.message}`);
  }

  if (!userProfile) {
    console.log('ℹ️ No user profile found in Supabase, nothing to delete');
    return;
  }

  console.log(`📋 Found user profile to delete: ${userProfile.username} (${userProfile.email})`);

  // Delete related data first (to avoid foreign key constraints)
  const cleanupOperations = [
    // Delete user messages/posts if you have them
    deleteUserMessages(clerkId),
    // Delete user connections/relationships if you have them  
    deleteUserConnections(clerkId),
    // Delete user settings/preferences if you have them
    deleteUserSettings(clerkId),
    // Add other related data cleanup as needed
  ];

  // Execute all cleanup operations
  await Promise.allSettled(cleanupOperations);

  // Finally, delete the user profile
  const { error: deleteError } = await supabase
    .from('user_profiles')
    .delete()
    .eq('clerk_id', clerkId);

  if (deleteError) {
    console.error('❌ Failed to delete user profile:', deleteError);
    throw new Error(`Failed to delete user profile: ${deleteError.message}`);
  }

  console.log(`✅ Successfully deleted user profile for: ${clerkId}`);
}

// Helper function to delete user messages/posts
async function deleteUserMessages(clerkId: string) {
  try {
    // Adjust table name based on your schema
    const { error } = await supabase
      .from('messages') // or 'posts', 'chats', etc.
      .delete()
      .eq('user_id', clerkId);

    if (error && error.code !== '42P01') { // Ignore "relation does not exist" error
      console.warn('⚠️ Error deleting user messages:', error.message);
    } else {
      console.log('🗑️ User messages deleted');
    }
  } catch (error) {
    console.warn('⚠️ Failed to delete user messages:', error);
  }
}

// Helper function to delete user connections
async function deleteUserConnections(clerkId: string) {
  try {
    // Delete as both sender and receiver
    const operations = [
      supabase
        .from('user_connections') // or 'friendships', 'follows', etc.
        .delete()
        .eq('user_id', clerkId),
      supabase
        .from('user_connections')
        .delete()
        .eq('connected_user_id', clerkId)
    ];

    await Promise.allSettled(operations);
    console.log('🗑️ User connections deleted');
  } catch (error) {
    console.warn('⚠️ Failed to delete user connections:', error);
  }
}

// Helper function to delete user settings
async function deleteUserSettings(clerkId: string) {
  try {
    const { error } = await supabase
      .from('user_settings') // or 'preferences', etc.
      .delete()
      .eq('user_id', clerkId);

    if (error && error.code !== '42P01') { // Ignore "relation does not exist" error
      console.warn('⚠️ Error deleting user settings:', error.message);
    } else {
      console.log('🗑️ User settings deleted');
    }
  } catch (error) {
    console.warn('⚠️ Failed to delete user settings:', error);
  }
}

function generateUsername(userData: any): string {
  try {
    // Priority 1: Discord username
    const discordAccount = userData.external_accounts?.find((acc: any) => acc.provider === 'discord');
    if (discordAccount?.username) {
      return sanitizeUsername(discordAccount.username);
    }

    // Priority 2: Google email prefix
    const googleAccount = userData.external_accounts?.find((acc: any) => acc.provider === 'google');
    if (googleAccount?.email_address) {
      const emailPrefix = googleAccount.email_address.split('@')[0];
      return sanitizeUsername(emailPrefix);
    }

    // Priority 3: Primary email prefix
    const primaryEmail = userData.email_addresses?.[0]?.email_address;
    if (primaryEmail) {
      const emailPrefix = primaryEmail.split('@')[0];
      return sanitizeUsername(emailPrefix);
    }

    // Priority 4: Clerk username if available
    if (userData.username) {
      return sanitizeUsername(userData.username);
    }

    // Fallback: Generate from user ID
    return `user_${userData.id.slice(-8)}`;
  } catch (error) {
    console.error('Error generating username:', error);
    return `user_${userData.id.slice(-8)}`;
  }
}

// Helper function to ensure username is unique
async function ensureUniqueUsername(baseUsername: string): Promise<string> {
  let username = baseUsername;
  let attempt = 0;
  
  while (attempt < 10) { // Max 10 attempts to avoid infinite loop
    // Check if username exists
    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('username')
      .ilike('username', username)
      .limit(1)
      .maybeSingle();
    
    if (!existingUser) {
      console.log(`✅ Username "${username}" is available (attempt ${attempt + 1})`);
      return username;
    }
    
    // Username exists, try with number suffix
    attempt++;
    username = `${baseUsername}${attempt}`;
    console.log(`⚠️ Username conflict, trying: "${username}"`);
  }
  
  // Fallback with timestamp
  const fallback = `${baseUsername}_${Date.now().toString().slice(-6)}`;
  console.log(`🆘 Using fallback username: "${fallback}"`);
  return fallback;
}

function sanitizeUsername(input: string): string {
  const sanitized = input
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 15) || 'user'; // Shorter to allow for number suffixes
    
  console.log(`🧼 Sanitized username: "${input}" -> "${sanitized}"`);
  return sanitized;
}