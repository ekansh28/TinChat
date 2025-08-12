// src/app/debug-oauth/page.tsx
'use client';

import { useUser, useAuth } from '@clerk/nextjs';
import { useState } from 'react';
window.location.href = '/';

export default function DebugOAuthPage() {
  const { user, isLoaded: userLoaded, isSignedIn } = useUser();
  const { isLoaded: authLoaded, userId, sessionId, getToken } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const checkProfile = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/profile/load');
      const result = await response.json();
      
      console.log('Profile API result:', result);
      setProfileData(result);
    } catch (err: any) {
      console.error('Profile check error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const triggerWebhook = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Try to manually trigger profile creation
      const response = await fetch('/api/profile/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: `testuser_${Date.now()}`,
          display_name: user.fullName || user.firstName || 'Test User',
          avatar_url: user.imageUrl || '',
          profile_complete: false
        })
      });

      const result = await response.json();
      console.log('Manual profile creation result:', result);
      setProfileData(result);
    } catch (err: any) {
      console.error('Manual profile creation error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const forceSignOut = async () => {
      try {
    // By checking 'typeof window', we ensure this code only runs on the client
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  } catch (err) {
    console.error('Sign out error:', err);
  }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">OAuth Debug Page</h1>
      
      <div className="space-y-6">
        {/* Loading States */}
        <div className="bg-blue-100 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">Loading States</h2>
          <div className="space-y-1 text-sm">
            <div><strong>User Loaded:</strong> {userLoaded ? 'Yes' : 'No'}</div>
            <div><strong>Auth Loaded:</strong> {authLoaded ? 'Yes' : 'No'}</div>
            <div><strong>Is Signed In:</strong> {isSignedIn ? 'Yes' : 'No'}</div>
            <div><strong>Has User Object:</strong> {user ? 'Yes' : 'No'}</div>
            <div><strong>Session ID:</strong> {sessionId || 'None'}</div>
            <div><strong>User ID from Auth:</strong> {userId || 'None'}</div>
          </div>
        </div>

        {/* User Info */}
        {user ? (
          <div className="bg-gray-100 p-4 rounded">
            <h2 className="text-lg font-semibold mb-2">Clerk User Info</h2>
            <pre className="text-sm whitespace-pre-wrap">
              {JSON.stringify({
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                fullName: user.fullName,
                emailAddresses: user.emailAddresses.map(e => e.emailAddress),
                imageUrl: user.imageUrl,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                externalAccounts: user.externalAccounts?.map(acc => ({
                  provider: acc.provider,
                  emailAddress: acc.emailAddress,
               
                }))
              }, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="bg-red-100 p-4 rounded">
            <h2 className="text-lg font-semibold mb-2">No User Detected</h2>
            <p className="text-sm mb-4">
              This could mean:
            </p>
            <ul className="text-sm space-y-1 ml-4">
              <li>• You're not signed in</li>
              <li>• The OAuth flow didn't complete</li>
              <li>• There's a session issue</li>
              <li>• Clerk isn't configured properly</li>
            </ul>
            
            <div className="mt-4">
              <button
                onClick={() => window.location.href = '/'}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mr-2"
              >
                Go to Home Page
              </button>
              <button
                onClick={forceSignOut}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                Clear Session & Reset
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-x-4">
          <button
            onClick={checkProfile}
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Check Profile'}
          </button>
          
          {user && (
            <button
              onClick={triggerWebhook}
              disabled={loading}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Create Profile Manually'}
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Profile Data */}
        {profileData && (
          <div className="bg-gray-100 p-4 rounded">
            <h2 className="text-lg font-semibold mb-2">Profile Data</h2>
            <pre className="text-sm whitespace-pre-wrap">
              {JSON.stringify(profileData, null, 2)}
            </pre>
          </div>
        )}

        {/* OAuth Analysis */}
        {user && (
          <div className="bg-yellow-100 p-4 rounded">
            <h2 className="text-lg font-semibold mb-2">OAuth Analysis</h2>
            <div className="space-y-2 text-sm">
              <div>
                <strong>Is OAuth User:</strong> {
                  user.externalAccounts?.some(acc => 
                    acc.provider === 'google' || acc.provider === 'discord'
                  ) ? 'Yes' : 'No'
                }
              </div>
              <div>
                <strong>External Accounts:</strong> {
                  user.externalAccounts?.length || 0
                }
              </div>
              <div>
                <strong>Providers:</strong> {
                  user.externalAccounts?.map(acc => acc.provider).join(', ') || 'None'
                }
              </div>
            </div>
          </div>
        )}

        {/* Browser Info */}
        <div className="bg-gray-50 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">Browser Info</h2>
          <div className="space-y-1 text-sm">
            <div><strong>Current URL:</strong> {window.location.href}</div>
            <div><strong>Local Storage Items:</strong> {Object.keys(localStorage).length}</div>
            <div><strong>Session Storage Items:</strong> {Object.keys(sessionStorage).length}</div>
            <div><strong>Cookies:</strong> {document.cookie ? 'Present' : 'None'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}