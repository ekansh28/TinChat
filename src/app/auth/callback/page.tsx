// src/app/auth/callback/page.tsx - OAuth Callback Handler for Xata
'use client';
import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

export default function AuthCallback() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

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
      // Check if profile exists in Xata
      const checkResponse = await fetch(`/api/profiles/${user.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (checkResponse.ok) {
        const checkData = await checkResponse.json();
        
        if (checkData.success && checkData.data) {
          // Profile exists in Xata, redirect to home
          router.push('/');
          return;
        }
      }

      // Profile doesn't exist in Xata, create it automatically for OAuth users
      const username = user.username || 
                     user.emailAddresses[0]?.emailAddress?.split('@')[0] || 
                     `user_${Date.now()}`;
      
      const displayName = user.fullName || 
                         user.firstName || 
                         username;

      const profileData = {
        username,
        display_name: displayName,
        avatar_url: user.imageUrl || '',
        banner_url: '',
        pronouns: '',
        bio: '',
        profile_complete: true,
        status: 'online',
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

      const createResponse = await fetch(`/api/profiles/${user.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      });

      if (createResponse.ok) {
        console.log('Profile created successfully for OAuth user in Xata');
      } else {
        const errorData = await createResponse.json();
        console.error('Failed to create profile for OAuth user:', errorData);
        
        // If username is taken, try with a unique suffix
        if (errorData.error === 'Username taken') {
          const uniqueUsername = `${username}_${Date.now().toString().slice(-4)}`;
          const retryData = { ...profileData, username: uniqueUsername };
          
          const retryResponse = await fetch(`/api/profiles/${user.id}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(retryData),
          });
          
          if (retryResponse.ok) {
            console.log('Profile created with unique username for OAuth user');
          } else {
            console.error('Failed to create profile even with unique username');
          }
        }
      }

      // Redirect to home regardless of profile creation success/failure
      router.push('/');

    } catch (error) {
      console.error('Error in OAuth callback:', error);
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing authentication...</p>
        <p className="text-sm text-gray-500 mt-2">Setting up your profile in the database...</p>
      </div>
    </div>
  );
}

// src/app/auth/complete/page.tsx - OAuth Completion Handler
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthComplete() {
  const router = useRouter();

  useEffect(() => {
    // Simple redirect after OAuth completion
    const timer = setTimeout(() => {
      router.push('/');
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-green-500 text-6xl mb-4">✓</div>
        <h1 className="text-2xl font-bold mb-2">Authentication Complete!</h1>
        <p className="text-gray-600">Your profile has been set up in the database.</p>
        <p className="text-sm text-gray-500 mt-2">Redirecting you to the app...</p>
      </div>
    </div>
  );
}