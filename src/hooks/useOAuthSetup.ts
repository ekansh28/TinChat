// src/hooks/useOAuthSetup.ts
'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

interface OAuthSetupState {
  needsUsernameSetup: boolean;
  isLoading: boolean;
  profile: any | null;
}

export function useOAuthSetup(): OAuthSetupState {
  const { user, isLoaded: userLoaded } = useUser();
  const [needsUsernameSetup, setNeedsUsernameSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!userLoaded || !user) {
      setIsLoading(false);
      return;
    }

    const checkOAuthSetup = async () => {
      try {
        console.log('🔍 Checking OAuth setup for user:', user.id);

        // Check if user has a complete profile
        const response = await fetch('/api/profile/load', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error('Failed to load profile:', response.status);
          setIsLoading(false);
          return;
        }

        const result = await response.json();
        console.log('📋 Profile check result:', result);

        if (result.success && result.data) {
          setProfile(result.data);
          
          // Check if this is an OAuth user who needs username setup
          // OAuth users will have external accounts but no password verification
          const hasExternalAccounts = user.externalAccounts && user.externalAccounts.length > 0;
          const hasOAuthProvider = user.externalAccounts?.some(acc => 
            acc.provider === 'google' || acc.provider === 'discord'
          );
          const isOAuthUser = hasExternalAccounts && hasOAuthProvider;

          console.log('🔗 OAuth user check:', {
            isOAuthUser,
            hasExternalAccounts,
            hasOAuthProvider,
            externalAccounts: user.externalAccounts?.map(acc => acc.provider),
            profileComplete: result.data.profile_complete,
            hasCustomUsername: result.data.username !== user.id && !result.data.username?.includes('user_')
          });

          // User needs username setup if:
          // 1. They're an OAuth user (no password)
          // 2. AND they don't have a custom username (still using auto-generated one)
          // 3. AND their profile isn't marked as complete
          if (isOAuthUser && (
            !result.data.profile_complete || 
            result.data.username === user.id ||
            result.data.username?.startsWith('user_') ||
            result.data.username?.includes(user.id.slice(-6)) // Auto-generated from webhook
          )) {
            console.log('🎯 OAuth user needs username setup');
            setNeedsUsernameSetup(true);
          } else {
            console.log('✅ OAuth user setup is complete');
            setNeedsUsernameSetup(false);
          }
        } else {
          // No profile found - might be a new OAuth user
          // Check if they came from OAuth
          const hasExternalAccounts = user.externalAccounts && user.externalAccounts.length > 0;
          const hasOAuthProvider = user.externalAccounts?.some(acc => 
            acc.provider === 'google' || acc.provider === 'discord'
          );
          const isOAuthUser = hasExternalAccounts && hasOAuthProvider;

          if (isOAuthUser) {
            console.log('🎯 New OAuth user needs username setup');
            setNeedsUsernameSetup(true);
          }
        }

      } catch (error) {
        console.error('❌ OAuth setup check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Small delay to let webhook processing complete for new users
    const timeoutId = setTimeout(checkOAuthSetup, 1000);
    return () => clearTimeout(timeoutId);
  }, [user, userLoaded]);

  return {
    needsUsernameSetup,
    isLoading,
    profile
  };
}