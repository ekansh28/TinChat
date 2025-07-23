// src/components/OAuthSetupWrapper.tsx
'use client';

import React from 'react';
import { useUser } from '@clerk/nextjs';
import { useOAuthSetup } from '@/hooks/useOAuthSetup';
import OAuthUsernameSetup from '@/components/OAuthUsernameSetup';

interface OAuthSetupWrapperProps {
  children: React.ReactNode;
}

export default function OAuthSetupWrapper({ children }: OAuthSetupWrapperProps) {
  const { user, isLoaded: userLoaded } = useUser();
  const { needsUsernameSetup, isLoading, profile } = useOAuthSetup();

  // Debug logging
  React.useEffect(() => {
    if (userLoaded) {
      console.log('🔍 OAuthSetupWrapper Debug:', {
        userLoaded,
        hasUser: !!user,
        userId: user?.id,
        externalAccounts: user?.externalAccounts?.map(acc => ({
          provider: acc.provider,
          id: acc.id
        })),
        needsUsernameSetup,
        isLoading,
        profile: profile ? {
          id: profile.id,
          username: profile.username,
          profile_complete: profile.profile_complete
        } : null
      });
    }
  }, [userLoaded, user, needsUsernameSetup, isLoading, profile]);

  const handleSetupComplete = () => {
    console.log('✅ OAuth setup completed, refreshing page...');
    // Refresh the page to reload user data
    window.location.reload();
  };

  if (!userLoaded) {
    console.log('⏳ User not loaded yet...');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    console.log('⏳ OAuth setup check in progress...');
    // Show a simple loading state while checking
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Setting up your account...</p>
        </div>
      </div>
    );
  }

  console.log('🎯 OAuthSetupWrapper final state:', { needsUsernameSetup });

  return (
    <>
      {children}
      <OAuthUsernameSetup 
        isOpen={needsUsernameSetup}
        onComplete={handleSetupComplete}
      />
    </>
  );
}