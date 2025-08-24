'use client';

import { useUser, useAuth } from '@clerk/nextjs';
import { useState, useEffect } from 'react';

export default function DebugPage() {
  const { user, isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const checkProfile = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/profile/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setProfileData(data);
      } else {
        setProfileData({ error: `Status: ${response.status}` });
      }
    } catch (error) {
      setProfileData({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      checkProfile();
    }
  }, [user?.id]);

  if (!isLoaded) {
    return <div className="p-8">Loading Clerk...</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Debug Page</h1>
      
      {/* Clerk User Info */}
      <div className="mb-8 p-4 border rounded">
        <h2 className="text-xl font-semibold mb-4">Clerk User Info</h2>
        <div className="space-y-2">
          <p><strong>Is Signed In:</strong> {isSignedIn ? 'Yes' : 'No'}</p>
          <p><strong>Is Loaded:</strong> {isLoaded ? 'Yes' : 'No'}</p>
          {user && (
            <>
              <p><strong>User ID:</strong> {user.id}</p>
              <p><strong>Username:</strong> {user.username || 'None'}</p>
              <p><strong>Email:</strong> {user.emailAddresses?.[0]?.emailAddress || 'None'}</p>
              <p><strong>First Name:</strong> {user.firstName || 'None'}</p>
              <p><strong>Last Name:</strong> {user.lastName || 'None'}</p>
              <p><strong>Created At:</strong> {user.createdAt ? new Date(user.createdAt).toLocaleString() : 'None'}</p>
              <p><strong>External Accounts:</strong> {user.externalAccounts?.length || 0}</p>
              {user.externalAccounts && user.externalAccounts.length > 0 && (
                <div className="ml-4">
                  {user.externalAccounts.map((account, index) => (
                    <div key={index} className="text-sm">
                      • {account.provider}: {account.emailAddress}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Profile Data */}
      <div className="mb-8 p-4 border rounded">
        <h2 className="text-xl font-semibold mb-4">Supabase Profile</h2>
        <button 
          onClick={checkProfile} 
          disabled={loading}
          className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Checking...' : 'Check Profile'}
        </button>
        
        {profileData && (
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(profileData, null, 2)}
          </pre>
        )}
      </div>

      {/* URL Info */}
      <div className="mb-8 p-4 border rounded">
        <h2 className="text-xl font-semibold mb-4">URL Info</h2>
        <div className="space-y-2">
          <p><strong>Current URL:</strong> {typeof window !== 'undefined' ? window.location.href : 'N/A'}</p>
          <p><strong>Origin:</strong> {typeof window !== 'undefined' ? window.location.origin : 'N/A'}</p>
          <p><strong>Pathname:</strong> {typeof window !== 'undefined' ? window.location.pathname : 'N/A'}</p>
          <p><strong>Search:</strong> {typeof window !== 'undefined' ? window.location.search : 'N/A'}</p>
          <p><strong>Hash:</strong> {typeof window !== 'undefined' ? window.location.hash : 'N/A'}</p>
        </div>
      </div>

      {/* Test Webhook */}
      <div className="p-4 border rounded">
        <h2 className="text-xl font-semibold mb-4">Webhook Test</h2>
        <button 
          onClick={async () => {
            try {
              const response = await fetch('/api/test-webhook');
              const data = await response.json();
              alert(JSON.stringify(data, null, 2));
            } catch (error) {
              alert('Webhook test failed: ' + error);
            }
          }}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Test Webhook Endpoint
        </button>
      </div>
    </div>
  );
}