'use client';

import { useSignUp, useSignIn, useAuth, useUser } from '@clerk/nextjs';
import { useState } from 'react';

export default function OAuthTest() {
  const { signUp, setActive: signUpSetActive, isLoaded: signUpLoaded } = useSignUp();
  const { signIn, setActive: signInSetActive, isLoaded: signInLoaded } = useSignIn();
  const { getToken } = useAuth();
  const { user, isSignedIn } = useUser();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');

  const testOAuth = async (provider: 'oauth_google' | 'oauth_discord') => {
    setLoading(true);
    setStatus('Starting OAuth flow...');
    
    try {
      
      if (signUpLoaded && signUp) {
        setStatus(`Initiating ${provider} with sign-up...`);
        await signUp.authenticateWithRedirect({
          strategy: provider,
          redirectUrl: window.location.origin + '/oauth-test',
          redirectUrlComplete: window.location.origin + '/oauth-test',
        });
      } else if (signInLoaded && signIn) {
        setStatus(`Initiating ${provider} with sign-in...`);
        await signIn.authenticateWithRedirect({
          strategy: provider,
          redirectUrl: window.location.origin + '/oauth-test',
          redirectUrlComplete: window.location.origin + '/oauth-test',
        });
      } else {
        setStatus('Error: Clerk not loaded');
      }
    } catch (error: any) {
      setStatus(`Error: ${error.message || 'OAuth failed'}`);
      setLoading(false);
    }
  };

  const checkClerkStatus = async () => {
    try {
      const token = await getToken();
      setStatus(`Token: ${token ? 'Available' : 'None'}`);
    } catch (error) {
      setStatus(`Token error: ${error}`);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">OAuth Test Page</h1>
      
      {/* Current Status */}
      <div className="mb-6 p-4 border rounded bg-gray-50">
        <h2 className="font-semibold mb-2">Current Status</h2>
        <p><strong>Signed In:</strong> {isSignedIn ? 'Yes' : 'No'}</p>
        <p><strong>User ID:</strong> {user?.id || 'None'}</p>
        <p><strong>Username:</strong> {user?.username || 'None'}</p>
        <p><strong>Email:</strong> {user?.emailAddresses?.[0]?.emailAddress || 'None'}</p>
        <p><strong>External Accounts:</strong> {user?.externalAccounts?.length || 0}</p>
        <p><strong>Status:</strong> {status}</p>
      </div>

      {/* Test Buttons */}
      <div className="space-y-4 mb-6">
        <button
          onClick={() => testOAuth('oauth_google')}
          disabled={loading}
          className="w-full p-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Test Google OAuth'}
        </button>
        
        <button
          onClick={() => testOAuth('oauth_discord')}
          disabled={loading}
          className="w-full p-3 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Test Discord OAuth'}
        </button>
        
        <button
          onClick={checkClerkStatus}
          className="w-full p-3 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Check Token Status
        </button>
      </div>

      {/* Debug Info */}
      <div className="p-4 border rounded bg-gray-50">
        <h2 className="font-semibold mb-2">Debug Info</h2>
        <p><strong>Sign Up Loaded:</strong> {signUpLoaded ? 'Yes' : 'No'}</p>
        <p><strong>Sign In Loaded:</strong> {signInLoaded ? 'Yes' : 'No'}</p>
        <p><strong>URL:</strong> {typeof window !== 'undefined' ? window.location.href : 'N/A'}</p>
        <p><strong>Origin:</strong> {typeof window !== 'undefined' ? window.location.origin : 'N/A'}</p>
        
        {/* Show URL params if any */}
        {typeof window !== 'undefined' && window.location.search && (
          <div className="mt-2">
            <strong>URL Parameters:</strong>
            <pre className="text-xs bg-white p-2 rounded mt-1">
              {window.location.search}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}