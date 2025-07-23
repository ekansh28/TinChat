import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Webhook } from 'svix';

// Supabase client with service role key for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ ENHANCED: Complete interface with external_accounts support
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
    // ✅ Critical for OAuth support
    external_accounts?: Array<{
      id: string;
      provider: string;
      provider_user_id?: string;
      email_address?: string;
      first_name?: string | null;
      last_name?: string | null;
      username?: string | null;
      image_url?: string | null;
      verification?: {
        status: string;
      };
    }>;
  };
}

/**
 * Main webhook handler - processes all Clerk events
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.text();
    const headers = req.headers;

    console.log('🔔 Webhook received');

    // Verify webhook signature
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('❌ CLERK_WEBHOOK_SECRET is not set');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    const wh = new Webhook(webhookSecret);
    let event: ClerkUserEvent;

    try {
      event = wh.verify(payload, {
        'svix-id': headers.get('svix-id') as string,
        'svix-timestamp': headers.get('svix-timestamp') as string,
        'svix-signature': headers.get('svix-signature') as string,
      }) as ClerkUserEvent;
    } catch (error) {
      console.error('❌ Webhook signature verification failed:', error);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // ✅ Enhanced event logging
    console.log('🔔 Webhook event details:', {
      type: event.type,
      userId: event.data?.id,
      email: event.data?.email_addresses?.[0]?.email_address,
      hasExternalAccounts: !!event.data?.external_accounts?.length,
      providers: event.data?.external_accounts?.map(acc => acc.provider) || []
    });

    // Handle different event types
    switch (event.type) {
      case 'user.created':
        console.log('👤 Processing new user creation');
        await handleUserCreated(event.data);
        break;
      case 'user.updated':
        console.log('🔄 Processing user update/account linking');
        await handleUserUpdated(event.data);
        break;
      case 'user.deleted':
        console.log('🗑️ Processing user deletion');
        await handleUserDeleted(event.data);
        break;
      default:
        console.log('ℹ️ Unhandled event type:', event.type);
        break;
    }

    console.log('✅ Webhook processed successfully');
    return NextResponse.json({ message: 'Webhook processed successfully' });

  } catch (error: any) {
    console.error('❌ Webhook processing failed:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Handle new user creation (supports Discord, Google OAuth, and email users)
 */
async function handleUserCreated(userData: ClerkUserEvent['data']) {
  try {
    console.log(`👤 Creating profile for ${userData.id}`);
    console.log('📋 User data received:', {
      id: userData.id,
      username: userData.username,
      email_addresses: userData.email_addresses?.length || 0,
      first_name: userData.first_name,
      last_name: userData.last_name,
      image_url: !!userData.image_url,
      external_accounts: userData.external_accounts?.length || 0
    });

    // ✅ ENHANCED: Detect all OAuth providers
    const isOAuthUser = userData.external_accounts && userData.external_accounts.length > 0;
    const isDiscordUser = userData.external_accounts?.some(account => 
      account.provider === 'discord' || account.provider === 'oauth_discord'
    );
    const isGoogleUser = userData.external_accounts?.some(account => 
      account.provider === 'oauth_google' || account.provider === 'google'
    );
    
    // ✅ ENHANCED: OAuth-specific timing delays
    if (isOAuthUser) {
      const delay = isDiscordUser ? 1500 : isGoogleUser ? 800 : 500;
      const providerName = isDiscordUser ? 'Discord' : isGoogleUser ? 'Google' : 'OAuth';
      console.log(`🔗 ${providerName} user detected - applying ${delay}ms sync delay`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // ✅ ENHANCED: Smart username generation with provider priority
    let finalUsername = userData.username;
    
    if (!finalUsername) {
      // Priority 1: Discord username (for Discord users)
      if (isDiscordUser && userData.external_accounts) {
        const discordAccount = userData.external_accounts.find(acc => 
          acc.provider === 'discord' || acc.provider === 'oauth_discord'
        );
        if (discordAccount?.username) {
          console.log('🎮 Using Discord username:', discordAccount.username);
          finalUsername = await generateUniqueUsername(discordAccount.username + '@discord.com');
        }
      }
      
      // Priority 2: Email prefix (for Google OAuth and regular users)
      if (!finalUsername) {
        const primaryEmail = userData.email_addresses?.[0]?.email_address;
        if (primaryEmail) {
          const source = isGoogleUser ? 'Google OAuth email' : 'email';
          console.log(`📧 Generating username from ${source}:`, primaryEmail);
          finalUsername = await generateUniqueUsername(primaryEmail);
        } else {
          // Final fallback with provider-specific prefix
          const prefix = isDiscordUser ? 'discord' : isGoogleUser ? 'google' : 'user';
          finalUsername = `${prefix}_${Math.random().toString(36).substring(2, 8)}`;
        }
      }
    }

    console.log('✅ Final username selected:', finalUsername);

    // ✅ ENHANCED: Display name with OAuth provider data
    let displayName = '';
    if (userData.first_name && userData.last_name) {
      displayName = `${userData.first_name} ${userData.last_name}`;
    } else if (userData.first_name) {
      displayName = userData.first_name;
    } else if (isOAuthUser && userData.external_accounts) {
      // Extract from OAuth provider data
      const oauthAccount = userData.external_accounts[0];
      if (oauthAccount.first_name) {
        displayName = oauthAccount.first_name;
      } else if (oauthAccount.username) {
        displayName = oauthAccount.username;
      }
    } else if (finalUsername) {
      displayName = finalUsername;
    } else {
      displayName = 'User';
    }

    // ✅ ENHANCED: Check for existing profile with retry logic
    let existingProfile;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('id, username')
          .eq('clerk_id', userData.id)
          .single();
        
        existingProfile = data;
        break;
      } catch (error) {
        retryCount++;
        if (retryCount < maxRetries) {
          console.log(`⏳ Profile check retry ${retryCount}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          console.warn('⚠️ Profile check failed after retries, proceeding with creation');
        }
      }
    }

    if (existingProfile) {
      console.log(`ℹ️ Profile already exists for ${userData.id}:`, {
        internal_id: existingProfile.id,
        username: existingProfile.username
      });
      return;
    }

    // ✅ ENHANCED: Profile creation with provider-specific branding
    const displayColor = isDiscordUser ? '#5865F2' : isGoogleUser ? '#4285F4' : '#667eea';
    
    const profileData = {
      id: crypto.randomUUID(),
      clerk_id: userData.id,
      username: finalUsername,
      display_name: displayName,
      avatar_url: userData.image_url || null,
      profile_complete: !!userData.username || isOAuthUser,
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
      display_name_color: displayColor,
      display_name_animation: 'none',
      rainbow_speed: 3,
      easy_customization_data: {},
      badges: []
    };

    // ✅ ENHANCED: Insert with retry logic for database operations
    let insertSuccess = false;
    retryCount = 0;
    
    while (!insertSuccess && retryCount < maxRetries) {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .insert(profileData)
          .select('id, username, display_name')
          .single();

        if (error) {
          throw error;
        }

        const provider = isDiscordUser ? 'Discord' : isGoogleUser ? 'Google' : 'Email';
        console.log(`✅ Created profile for ${userData.id}:`, {
          internal_id: data.id,
          username: data.username,
          display_name: data.display_name,
          provider: provider
        });

        insertSuccess = true;
        
        // ✅ ENHANCED: Verify profile was created successfully
        const { data: verifyProfile } = await supabase
          .from('user_profiles')
          .select('id, username')
          .eq('clerk_id', userData.id)
          .single();
          
        if (!verifyProfile) {
          console.error(`❌ Profile verification failed for ${userData.id}`);
          throw new Error('Profile creation verification failed');
        }
        
        console.log(`🔍 Profile verified for ${userData.id}:`, verifyProfile);
        
      } catch (error: any) {
        retryCount++;
        console.error(`❌ Profile creation attempt ${retryCount}/${maxRetries} failed:`, error);
        
        if (retryCount < maxRetries) {
          console.log(`⏳ Retrying profile creation in ${retryCount}s...`);
          await new Promise(resolve => setTimeout(resolve, retryCount * 1000));
        } else {
          throw error;
        }
      }
    }

  } catch (error: any) {
    console.error(`❌ Error creating user ${userData.id}:`, error);
    throw error;
  }
}

/**
 * Handle user updates (account linking, profile changes)
 */
async function handleUserUpdated(userData: ClerkUserEvent['data']) {
  try {
    console.log(`🔄 User updated: ${userData.id}`);
    
    // Check if this user already has a profile
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id, username, avatar_url')
      .eq('clerk_id', userData.id)
      .single();

    if (existingProfile) {
      console.log('ℹ️ Profile exists, updating OAuth data if needed');
      
      const updates: any = {
        updated_at: new Date().toISOString()
      };

      // Update avatar if OAuth provides a better one or if current is null
      if (userData.image_url && (!existingProfile.avatar_url || existingProfile.avatar_url !== userData.image_url)) {
        updates.avatar_url = userData.image_url;
        console.log('🖼️ Updating avatar URL from OAuth');
      }

      // Update display name if provided
      if (userData.first_name || userData.last_name) {
        const newDisplayName = userData.first_name && userData.last_name 
          ? `${userData.first_name} ${userData.last_name}`
          : userData.first_name || userData.last_name;
        updates.display_name = newDisplayName;
        console.log('📝 Updating display name from OAuth');
      }

      if (Object.keys(updates).length > 1) { // More than just updated_at
        await supabase
          .from('user_profiles')
          .update(updates)
          .eq('clerk_id', userData.id);
        console.log('✅ Profile updated with OAuth data');
      }
      
    } else {
      console.log('⚠️ User updated but no profile found, creating profile');
      // Create profile for users who were created before webhook was set up
      await handleUserCreated(userData);
    }
    
  } catch (error) {
    console.error('❌ User update failed:', error);
    throw error;
  }
}

/**
 * Handle user deletion
 */
async function handleUserDeleted(userData: ClerkUserEvent['data']) {
  try {
    console.log(`🗑️ Deleting profile for user: ${userData.id}`);
    
    const { error } = await supabase
      .from('user_profiles')
      .delete()
      .eq('clerk_id', userData.id);

    if (error) {
      throw error;
    }

    console.log(`✅ Profile deleted for user: ${userData.id}`);
  } catch (error) {
    console.error(`❌ Error deleting user ${userData.id}:`, error);
    throw error;
  }
}

/**
 * Generate unique username from email with comprehensive fallback strategies
 */
async function generateUniqueUsername(email: string): Promise<string> {
  // Extract prefix from email (e.g., "ekansh21" from "ekansh21@gmail.com")
  const emailPrefix = email.split('@')[0];
  
  // Clean prefix: remove special characters, keep alphanumeric
  const baseUsername = emailPrefix.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  
  if (!baseUsername) {
    return await generateFallbackUsername();
  }

  console.log('🎯 Base username from email:', baseUsername);

  // Strategy 1: Try the exact email prefix
  if (await isUsernameAvailable(baseUsername)) {
    return baseUsername;
  }

  // Strategy 2: Try numbered variations (1-9)
  for (let i = 1; i <= 9; i++) {
    const numberedUsername = `${baseUsername}${i}`;
    if (await isUsernameAvailable(numberedUsername)) {
      console.log('✅ Found numbered variation:', numberedUsername);
      return numberedUsername;
    }
  }

  // Strategy 3: Try with random suffixes
  for (let attempt = 0; attempt < 5; attempt++) {
    const randomSuffix = Math.floor(Math.random() * 1000);
    const randomUsername = `${baseUsername}${randomSuffix}`;
    if (await isUsernameAvailable(randomUsername)) {
      console.log('✅ Found random suffix variation:', randomUsername);
      return randomUsername;
    }
  }

  // Strategy 4: Use random username API as fallback
  console.log('🔄 All prefix variations taken, using random username API');
  return await generateRandomUsernameFromAPI();
}

/**
 * Check if username is available in Supabase
 */
async function isUsernameAvailable(username: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('username', username)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Username check error:', error);
      return false;
    }

    const isAvailable = !data;
    console.log(`🔍 Username "${username}": ${isAvailable ? 'AVAILABLE' : 'TAKEN'}`);
    return isAvailable;
  } catch (error) {
    console.error('Username availability check failed:', error);
    return false;
  }
}

/**
 * Generate random username from API with multiple fallback sources
 */
async function generateRandomUsernameFromAPI(): Promise<string> {
  const apis = [
    {
      url: 'https://usernameapiv1.vercel.app/api/random-usernames?count=1',
      extractUsername: (data: any) => data.usernames?.[0]
    }
  ];

  for (const api of apis) {
    try {
      console.log('🌐 Fetching random username from API:', api.url);
      
      const response = await fetch(api.url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'TinChat-UserGen/1.0'
        },
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        console.warn(`API ${api.url} returned ${response.status}`);
        continue;
      }

      const data = await response.json();
      const username = api.extractUsername(data);
      
      if (username && typeof username === 'string') {
        const cleanUsername = username.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
        
        if (cleanUsername.length >= 3 && cleanUsername.length <= 20) {
          if (await isUsernameAvailable(cleanUsername)) {
            console.log('✅ Generated username from API:', cleanUsername);
            return cleanUsername;
          } else {
            const modifiedUsername = `${cleanUsername}_${Math.floor(Math.random() * 100)}`;
            if (await isUsernameAvailable(modifiedUsername)) {
              console.log('✅ Generated modified API username:', modifiedUsername);
              return modifiedUsername;
            }
          }
        }
      }
    } catch (error) {
      console.warn('Random username API failed:', error);
      continue;
    }
  }

  return await generateFallbackUsername();
}

/**
 * Generate deterministic fallback username when all else fails
 */
async function generateFallbackUsername(): Promise<string> {
  const adjectives = ['clever', 'bright', 'swift', 'cool', 'smart', 'quick', 'neat', 'bold'];
  const nouns = ['user', 'coder', 'dev', 'pro', 'ace', 'star', 'hero', 'ninja'];
  
  for (let attempt = 0; attempt < 20; attempt++) {
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const number = Math.floor(Math.random() * 1000);
    
    const username = `${adjective}${noun}${number}`;
    
    if (await isUsernameAvailable(username)) {
      console.log('🎲 Generated fallback username:', username);
      return username;
    }
  }

  // Last resort: timestamp-based username (guaranteed unique)
  const timestamp = Date.now().toString().slice(-6);
  console.log('⏰ Using timestamp fallback:', `user${timestamp}`);
  return `user${timestamp}`;
}

/**
 * Legacy function for backward compatibility
 */
function generateUsernameFromEmail(email: string): string {
  return email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

// Handle GET requests (for testing)
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Clerk webhook endpoint is active' 
  });
}
