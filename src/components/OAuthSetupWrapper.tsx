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
    }
  }, [userLoaded, user, needsUsernameSetup, isLoading, profile]);

  const handleSetupComplete = () => {
    // Refresh the page to reload user data
    window.location.reload();
  };

  if (!userLoaded) {
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