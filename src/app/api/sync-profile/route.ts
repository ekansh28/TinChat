// app/api/sync-profile/route.ts - FIXED FOR YOUR SCHEMA
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        'Cache-Control': 'no-cache'
      }
    }
  }
);

// Webhook secret from Clerk dashboard
const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET!;

interface ClerkUserEvent {
  type: 'user.created' | 'user.updated' | 'user.deleted' | 'email.created';
  data: {
    id: string;
    username?: string | null;
    email_addresses?: Array<{
      email_address: string;
      verification?: {
        status: string;
      };
    }>;
    first_name?: string | null;
    last_name?: string | null;
    image_url?: string | null;
    created_at?: number;
    updated_at?: number;
    banned?: boolean;
    locked?: boolean;
    email_address?: string;
    user_id?: string;
  };
}

export async function POST(req: NextRequest) {
  console.log('🔗 Clerk webhook received at /api/sync-profile/');
  console.log('⏰ Timestamp:', new Date().toISOString());

  try {
    // Get headers for webhook verification
    const headersList = await headers();
    const svix_id = headersList.get('svix-id');
    const svix_timestamp = headersList.get('svix-timestamp');
    const svix_signature = headersList.get('svix-signature');

    console.log('📋 Headers received:', {
      svix_id: !!svix_id,
      svix_timestamp: !!svix_timestamp,
      svix_signature: !!svix_signature
    });

    if (!svix_id || !svix_timestamp || !svix_signature) {
      console.error('❌ Missing Svix headers');
      return NextResponse.json(
        { error: 'Missing required headers' },
        { status: 400 }
      );
    }

    // Get the raw body for signature verification
    const body = await req.text();
    console.log('📄 Body received, length:', body.length);

    // Verify the webhook signature
    const wh = new Webhook(WEBHOOK_SECRET);
    let evt: ClerkUserEvent;

    try {
      evt = wh.verify(body, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      }) as ClerkUserEvent;
      
      console.log('✅ Webhook signature verified');
    } catch (err: any) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    console.log(`📋 Processing ${evt.type} event for user ${evt.data.id || evt.data.user_id}`);

    // Handle different event types
    switch (evt.type) {
      case 'user.created':
        await handleUserCreated(evt.data);
        break;
      
      case 'user.updated':
        await handleUserUpdated(evt.data);
        break;
      
      case 'user.deleted':
        await handleUserDeleted(evt.data.id);
        break;
      
      case 'email.created':
        console.log('📧 Email created event - ignoring for now');
        break;
      
      default:
        console.log(`ℹ️ Unhandled event type: ${evt.type}`);
    }

    console.log('✅ Webhook processed successfully');
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('❌ Webhook handler error:', error);
    console.error('❌ Error stack:', error.stack);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

async function handleUserCreated(userData: ClerkUserEvent['data']) {
  try {
    console.log(`👤 Creating profile for ${userData.id}`);
    console.log('📋 User data received:', {
      id: userData.id,
      username: userData.username,
      email_addresses: userData.email_addresses?.length || 0,
      first_name: userData.first_name,
      last_name: userData.last_name,
      image_url: !!userData.image_url
    });

    // Generate display name with fallbacks
    let displayName = '';
    if (userData.first_name && userData.last_name) {
      displayName = `${userData.first_name} ${userData.last_name}`;
    } else if (userData.first_name) {
      displayName = userData.first_name;
    } else if (userData.username) {
      displayName = userData.username;
    } else {
      // Fallback to email prefix if available
      if (userData.email_addresses && userData.email_addresses.length > 0) {
        displayName = userData.email_addresses[0].email_address.split('@')[0];
      } else {
        displayName = 'User'; // Final fallback
      }
    }

    console.log('👤 Display name:', displayName);

    // Generate username if not provided
    let finalUsername = userData.username;
    if (!finalUsername) {
      if (userData.email_addresses && userData.email_addresses.length > 0) {
        finalUsername = generateUsernameFromEmail(userData.email_addresses[0].email_address);
      } else {
        finalUsername = `user_${Math.random().toString(36).substring(2, 8)}`;
      }
      console.log('🔧 Generated username:', finalUsername);
    }

    // Check if profile already exists (prevent duplicates)
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('clerk_id', userData.id)
      .single();

    if (existingProfile) {
      console.log(`ℹ️ Profile already exists for ${userData.id}, skipping creation`);
      return;
    }

    // Insert new user profile - explicitly provide UUID for id
    const { data, error } = await supabase
      .from('user_profiles')
      .insert({
        id: crypto.randomUUID(), // Generate UUID manually
        clerk_id: userData.id,
        username: finalUsername,
        display_name: displayName,
        avatar_url: userData.image_url || null,
        profile_complete: !!userData.username,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_online: true,
        last_seen: new Date().toISOString(),
        blocked_users: [],
        bio: null,
        profile_card_css: null,
        banner_url: null,
        pronouns: null,
        status: 'online',
        display_name_color: '#667eea',
        display_name_animation: 'none',
        rainbow_speed: 3,
        easy_customization_data: {},
        badges: []
      })
      .select('id, username')
      .single();

    if (error) {
      console.error(`❌ Failed to create profile for ${userData.id}:`, error);
      throw error;
    }

    console.log(`✅ Created profile for ${userData.id}:`, {
      internal_id: data.id,
      username: data.username,
      display_name: displayName
    });

  } catch (error: any) {
    console.error(`❌ Error creating user ${userData.id}:`, error);
    throw error;
  }
}

async function handleUserUpdated(userData: ClerkUserEvent['data']) {
  try {
    console.log(`🔄 Updating profile for ${userData.id}`);

    // Generate display name
    let displayName = '';
    if (userData.first_name && userData.last_name) {
      displayName = `${userData.first_name} ${userData.last_name}`;
    } else if (userData.first_name) {
      displayName = userData.first_name;
    } else if (userData.username) {
      displayName = userData.username;
    } else if (userData.email_addresses && userData.email_addresses.length > 0) {
      displayName = userData.email_addresses[0].email_address.split('@')[0];
    }

    // Update existing user profile
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        username: userData.username || undefined,
        display_name: displayName || undefined,
        avatar_url: userData.image_url || undefined,
        profile_complete: !!userData.username,
        updated_at: userData.updated_at ? new Date(userData.updated_at).toISOString() : new Date().toISOString(),
      })
      .eq('clerk_id', userData.id)
      .select('id, username')
      .single();

    if (error) {
      console.error(`❌ Failed to update profile for ${userData.id}:`, error);
      
      // If update fails because user doesn't exist, create them
      if (error.code === 'PGRST116') { // No rows updated
        console.warn(`⚠️ No profile found to update for ${userData.id}, creating new one`);
        await handleUserCreated(userData);
        return;
      }
      
      throw error;
    }

    if (!data) {
      console.warn(`⚠️ No profile found to update for ${userData.id}, creating new one`);
      await handleUserCreated(userData);
      return;
    }

    console.log(`✅ Updated profile for ${userData.id}:`, {
      internal_id: data.id,
      username: data.username
    });

  } catch (error: any) {
    console.error(`❌ Error updating user ${userData.id}:`, error);
    throw error;
  }
}

async function handleUserDeleted(clerkId: string) {
  try {
    console.log(`🗑️ Handling deletion for ${clerkId}`);

    // OPTION A: Hard delete (permanently removes the user)
    // WARNING: This will break references in other tables (messages, etc.)
    const { error } = await supabase
      .from('user_profiles')
      .delete()
      .eq('clerk_id', clerkId);

    if (error) {
      console.error(`❌ Failed to delete user ${clerkId}:`, error);
      throw error;
    }

    console.log(`✅ Permanently deleted user: ${clerkId}`);

  } catch (error: any) {
    console.error(`❌ Error deleting user ${clerkId}:`, error);
    throw error;
  }
}

// Helper function to generate username from email if none provided
function generateUsernameFromEmail(email: string): string {
  const prefix = email.split('@')[0];
  // Clean up the prefix to make it username-friendly
  const cleaned = prefix.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  // Add random suffix to avoid collisions
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${cleaned}${suffix}`;
}

// Environment variable validation
if (!WEBHOOK_SECRET) {
  console.error('❌ CLERK_WEBHOOK_SECRET environment variable is required');
  throw new Error('CLERK_WEBHOOK_SECRET environment variable is required');
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL environment variable is required');
  throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is required');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
}