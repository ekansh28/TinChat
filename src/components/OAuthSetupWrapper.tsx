// src/components/OAuthSetupWrapper.tsx
'use client';

import React from 'react';
import { useOAuthSetup } from '@/hooks/useOAuthSetup';
import OAuthUsernameSetup from '@/components/OAuthUsernameSetup';

interface OAuthSetupWrapperProps {
  children: React.ReactNode;
}

export default function OAuthSetupWrapper({ children }: OAuthSetupWrapperProps) {
  const { needsUsernameSetup, isLoading } = useOAuthSetup();

  const handleSetupComplete = () => {
    // Refresh the page to reload user data
    window.location.reload();
  };

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