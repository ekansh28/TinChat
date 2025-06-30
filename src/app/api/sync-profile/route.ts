// app/api/sync-profile/route.ts
// 📁 Create this file at: app/api/sync-profile/route.ts
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role key for bypassing RLS
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Webhook secret from Clerk dashboard
const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET!;

interface ClerkUserEvent {
  type: 'user.created' | 'user.updated' | 'user.deleted';
  data: {
    id: string; // Clerk user ID (e.g., user_abc123)
    username: string | null;
    email_addresses: Array<{
      email_address: string;
      verification?: {
        status: string;
      };
    }>;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    created_at: number;
    updated_at: number;
    banned: boolean;
    locked: boolean;
  };
}

export async function POST(req: NextRequest) {
  try {
    console.log('🔗 Clerk webhook received');

    // Get headers for webhook verification
    const headersList = await headers();
    const svix_id = headersList.get('svix-id');
    const svix_timestamp = headersList.get('svix-timestamp');
    const svix_signature = headersList.get('svix-signature');

    if (!svix_id || !svix_timestamp || !svix_signature) {
      console.error('❌ Missing Svix headers');
      return NextResponse.json(
        { error: 'Missing required headers' },
        { status: 400 }
      );
    }

    // Get the raw body for signature verification
    const body = await req.text();

    // Verify the webhook signature
    const wh = new Webhook(WEBHOOK_SECRET);
    let evt: ClerkUserEvent;

    try {
      evt = wh.verify(body, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      }) as ClerkUserEvent;
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    console.log(`📋 Processing ${evt.type} event for user ${evt.data.id}`);

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
      
      default:
        console.log(`ℹ️ Unhandled event type: ${evt.type}`);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('❌ Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleUserCreated(userData: ClerkUserEvent['data']) {
  try {
    console.log(`👤 Creating profile for ${userData.id}`);

    // Extract primary email
    const primaryEmail = userData.email_addresses.find(
      email => email.verification?.status === 'verified'
    )?.email_address || userData.email_addresses[0]?.email_address;

    if (!primaryEmail) {
      console.error(`❌ No email found for user ${userData.id}`);
      return;
    }

    // Generate display name
    let displayName = '';
    if (userData.first_name && userData.last_name) {
      displayName = `${userData.first_name} ${userData.last_name}`;
    } else if (userData.first_name) {
      displayName = userData.first_name;
    } else if (userData.username) {
      displayName = userData.username;
    } else {
      displayName = primaryEmail.split('@')[0]; // Fallback to email prefix
    }

    // Insert new user profile
    const { data, error } = await supabase
      .from('user_profiles')
      .insert({
        clerk_id: userData.id,
        username: userData.username || generateUsernameFromEmail(primaryEmail),
        email: primaryEmail,
        display_name: displayName,
        avatar_url: userData.image_url,
        status: 'online',
        is_online: true,
        profile_complete: !!userData.username, // Profile is complete if username exists
        created_at: new Date(userData.created_at).toISOString(),
        updated_at: new Date(userData.updated_at).toISOString(),
        last_seen: new Date().toISOString(),
        // Default values for new users
        display_name_color: '#667eea',
        display_name_animation: 'none',
        rainbow_speed: 3,
        badges: [],
        blocked_users: []
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

  } catch (error) {
    console.error(`❌ Error creating user ${userData.id}:`, error);
    throw error;
  }
}

async function handleUserUpdated(userData: ClerkUserEvent['data']) {
  try {
    console.log(`🔄 Updating profile for ${userData.id}`);

    // Extract primary email
    const primaryEmail = userData.email_addresses.find(
      email => email.verification?.status === 'verified'
    )?.email_address || userData.email_addresses[0]?.email_address;

    // Generate display name
    let displayName = '';
    if (userData.first_name && userData.last_name) {
      displayName = `${userData.first_name} ${userData.last_name}`;
    } else if (userData.first_name) {
      displayName = userData.first_name;
    } else if (userData.username) {
      displayName = userData.username;
    } else if (primaryEmail) {
      displayName = primaryEmail.split('@')[0];
    }

    // Update existing user profile
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        username: userData.username,
        email: primaryEmail,
        display_name: displayName || undefined,
        avatar_url: userData.image_url,
        profile_complete: !!userData.username,
        updated_at: new Date(userData.updated_at).toISOString(),
      })
      .eq('clerk_id', userData.id)
      .select('id, username')
      .single();

    if (error) {
      console.error(`❌ Failed to update profile for ${userData.id}:`, error);
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

  } catch (error) {
    console.error(`❌ Error updating user ${userData.id}:`, error);
    throw error;
  }
}

async function handleUserDeleted(clerkId: string) {
  try {
    console.log(`🗑️ Handling deletion for ${clerkId}`);

    // You might want to soft delete instead of hard delete
    // to preserve referential integrity for messages, etc.
    const { error } = await supabase
      .from('user_profiles')
      .update({
        status: 'deleted',
        is_online: false,
        email: null, // Clear PII
        deleted_at: new Date().toISOString()
      })
      .eq('clerk_id', clerkId);

    if (error) {
      console.error(`❌ Failed to mark user as deleted ${clerkId}:`, error);
      throw error;
    }

    console.log(`✅ Marked user as deleted: ${clerkId}`);

  } catch (error) {
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

// Ensure environment variables are set
if (!WEBHOOK_SECRET) {
  throw new Error('CLERK_WEBHOOK_SECRET environment variable is required');
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is required');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
}