// src/app/oauth-callback/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';

export default function OAuthCallback() {
  const { user, isLoaded } = useUser();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const handleOAuthComplete = async () => {
      // Wait for Clerk to load and process the OAuth callback
      if (!isLoaded) return;

      try {
        console.log('🔗 OAuth callback - user loaded:', !!user);
        
        if (user) {
          console.log('✅ OAuth authentication successful');
          
          // Give webhook time to process user creation
          setTimeout(() => {
            // Redirect to home - OAuthSetupWrapper will handle username setup if needed
            window.location.href = '/';
          }, 1500);
        } else {
          console.log('❌ No user found after OAuth callback');
          setTimeout(() => {
            window.location.href = '/?oauth_error=true';
          }, 2000);
        }
      } catch (error) {
        console.error('❌ OAuth callback processing error:', error);
        setTimeout(() => {
          window.location.href = '/?oauth_error=true';
        }, 2000);
      } finally {
        setProcessing(false);
      }
    };

    handleOAuthComplete();
  }, [isLoaded, user]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        {processing ? (
          <>
            <p className="text-gray-600">Completing OAuth authentication...</p>
            <p className="text-sm text-gray-500 mt-2">Please wait while we set up your account.</p>
          </>
        ) : (
          <>
            <p className="text-gray-600">Redirecting...</p>
            <p className="text-sm text-gray-500 mt-2">Taking you to your dashboard.</p>
          </>
        )}
      </div>
    </div>
  );
}