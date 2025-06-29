// src/app/auth/callback/page.tsx - FIXED OAuth Callback Handler for Xata
'use client';
import { useEffect, useState } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

export default function AuthCallback() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'creating' | 'error' | 'complete'>('checking');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (!isLoaded) return;

    if (user) {
      // Check if user profile exists in Xata database
      checkAndCreateProfile();
    } else {
      // Redirect to home if no user
      router.push('/');
    }
  }, [isLoaded, user, router]);

  const checkAndCreateProfile = async () => {
    if (!user) return;

    try {
      setStatus('checking');
      
      // Get authentication token from Clerk
      const token = await getToken();
      
      if (!token) {
        setErrorMessage('Failed to get authentication token');
        setStatus('error');
        setTimeout(() => router.push('/'), 3000);
        return;
      }

      // Check if profile exists in Xata/Supabase
      const checkResponse = await fetch(`/api/profiles/${user.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (checkResponse.ok) {
        const checkData = await checkResponse.json();
        
        if (checkData.success && checkData.data) {
          // Profile exists, sync with latest Clerk data
          await syncProfileWithClerk(token);
          setStatus('complete');
          setTimeout(() => router.push('/'), 1500);
          return;
        }
      }

      // Profile doesn't exist, create it
      await createProfileForOAuthUser(token);

    } catch (error) {
      console.error('Error in OAuth callback:', error);
      setErrorMessage('An unexpected error occurred');
      setStatus('error');
      setTimeout(() => router.push('/'), 3000);
    }
  };

  const createProfileForOAuthUser = async (token: string) => {
    if (!user) return;

    try {
      setStatus('creating');

      // Generate username with fallbacks
      const baseUsername = user.username || 
                          user.emailAddresses[0]?.emailAddress?.split('@')[0] || 
                          `user${Date.now().toString().slice(-6)}`;
      
      // Clean username (remove special characters, ensure length)
      const cleanUsername = baseUsername
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 20)
        .padEnd(3, '0');

      const displayName = user.fullName || 
                         user.firstName || 
                         user.lastName ||
                         cleanUsername;

      const profileData = {
        username: cleanUsername,
        display_name: displayName,
        avatar_url: user.imageUrl || '',
        banner_url: '',
        pronouns: '',
        bio: '',
        profile_complete: true,
        status: 'online' as const,
        is_online: true,
        last_seen: new Date().toISOString(),
        display_name_color: '#667eea',
        display_name_animation: 'none',
        rainbow_speed: 3,
        badges: [],
        blocked_users: [],
        profile_card_css: '',
        easy_customization_data: {}
      };

      console.log('Creating profile for OAuth user:', {
        userId: user.id,
        username: cleanUsername,
        displayName
      });

      const createResponse = await fetch(`/api/profiles/${user.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(profileData),
      });

      const createData = await createResponse.json();

      if (createResponse.ok && createData.success) {
        console.log('✅ Profile created successfully for OAuth user');
        setStatus('complete');
        setTimeout(() => router.push('/'), 1500);
      } else {
        console.error('❌ Failed to create profile:', createData);
        
        // If username is taken, try with a unique suffix
        if (createData.error?.includes('Username') || createData.error?.includes('taken') || createData.error?.includes('unique')) {
          await retryWithUniqueUsername(token, profileData);
        } else {
          throw new Error(createData.message || 'Failed to create profile');
        }
      }

    } catch (error) {
      console.error('Error creating profile:', error);
      setErrorMessage('Failed to create user profile');
      setStatus('error');
      setTimeout(() => router.push('/'), 3000);
    }
  };

  const retryWithUniqueUsername = async (token: string, originalData: any) => {
    if (!user) return;

    try {
      const uniqueUsername = `${originalData.username}_${Date.now().toString().slice(-4)}`;
      const retryData = { ...originalData, username: uniqueUsername };
      
      console.log('Retrying with unique username:', uniqueUsername);

      const retryResponse = await fetch(`/api/profiles/${user.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(retryData),
      });
      
      const retryResult = await retryResponse.json();

      if (retryResponse.ok && retryResult.success) {
        console.log('✅ Profile created with unique username');
        setStatus('complete');
        setTimeout(() => router.push('/'), 1500);
      } else {
        throw new Error(retryResult.message || 'Failed to create profile with unique username');
      }

    } catch (error) {
      console.error('Error creating profile with unique username:', error);
      setErrorMessage('Failed to create user profile');
      setStatus('error');
      setTimeout(() => router.push('/'), 3000);
    }
  };

  const syncProfileWithClerk = async (token: string) => {
    if (!user) return;

    try {
      console.log('Syncing existing profile with Clerk data');

      const syncResponse = await fetch('/api/profiles/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (syncResponse.ok) {
        console.log('✅ Profile synced with Clerk data');
      } else {
        console.warn('⚠️ Profile sync failed, but continuing...');
      }

    } catch (error) {
      console.warn('Profile sync error (non-critical):', error);
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'checking':
        return 'Checking your profile...';
      case 'creating':
        return 'Creating your profile...';
      case 'complete':
        return 'Authentication complete!';
      case 'error':
        return errorMessage || 'An error occurred';
      default:
        return 'Processing...';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'complete':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        {status === 'complete' ? (
          <div className="text-green-500 text-6xl mb-4">✓</div>
        ) : status === 'error' ? (
          <div className="text-red-500 text-6xl mb-4">✗</div>
        ) : (
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        )}
        
        <h1 className="text-2xl font-bold mb-2">
          {status === 'complete' ? 'Welcome!' : 'Setting up your account...'}
        </h1>
        
        <p className={`${getStatusColor()} mb-4`}>
          {getStatusMessage()}
        </p>
        
        {user && (
          <div className="text-sm text-gray-500 mb-4">
            <p>Hello, {user.firstName || user.username || 'there'}!</p>
            {status === 'creating' && (
              <p className="mt-2">We're setting up your profile in our database...</p>
            )}
            {status === 'complete' && (
              <p className="mt-2">Redirecting you to the app...</p>
            )}
            {status === 'error' && (
              <p className="mt-2">Don't worry, you can still use the app. Redirecting...</p>
            )}
          </div>
        )}
        
        {status === 'error' && (
          <div className="text-xs text-gray-400 mt-4 p-2 bg-gray-100 rounded">
            If this problem persists, please contact support.
          </div>
        )}
      </div>
    </div>
  );
}