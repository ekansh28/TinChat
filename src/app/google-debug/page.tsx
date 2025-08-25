'use client';

import { useSignUp, useSignIn, useAuth, useUser } from '@clerk/nextjs';
import { useState, useEffect } from 'react';

export default function GoogleDebug() {
  const { signUp, setActive: signUpSetActive, isLoaded: signUpLoaded } = useSignUp();
  const { signIn, setActive: signInSetActive, isLoaded: signInLoaded } = useSignIn();
  const { getToken } = useAuth();
  const { user, isSignedIn } = useUser();
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    setLogs(prev => [...prev, logMessage]);
  };

  useEffect(() => {
    addLog('Page loaded - checking initial state');
    addLog(`User signed in: ${isSignedIn}`);
    addLog(`Clerk loaded: signUp=${signUpLoaded}, signIn=${signInLoaded}`);
    
    // Check URL parameters on load
    const urlParams = new URLSearchParams(window.location.search);
    const hasClerkParams = Array.from(urlParams.keys()).some(key => key.startsWith('__clerk'));
    
    if (hasClerkParams) {
      addLog(`Found Clerk URL parameters: ${Array.from(urlParams.keys()).join(', ')}`);
    }
    
    if (window.location.hash) {
      addLog(`URL hash present: ${window.location.hash}`);
    }
  }, [isSignedIn, signUpLoaded, signInLoaded]);

  const testGoogleOAuth = async () => {
    setLoading(true);
    addLog('🟢 Starting Google OAuth test...');
    
    try {
      addLog(`Clerk state: signUpLoaded=${signUpLoaded}, signInLoaded=${signInLoaded}`);
      addLog(`Current URL: ${window.location.href}`);
      addLog(`Redirect URL will be: ${window.location.origin}/google-debug`);
      
      if (!signUpLoaded || !signUp) {
        addLog('❌ SignUp not loaded or available');
        setLoading(false);
        return;
      }

      addLog('📤 Calling signUp.authenticateWithRedirect for Google...');
      
      await signUp.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: `${window.location.origin}/google-debug`,
        redirectUrlComplete: `${window.location.origin}/google-debug`,
      });
      
      addLog('✅ Redirect initiated successfully');
      
    } catch (error: any) {
      addLog(`❌ OAuth error: ${error.message}`);
      if (error.errors) {
        error.errors.forEach((err: any, index: number) => {
          addLog(`❌ Error ${index + 1}: ${err.code} - ${err.message}`);
        });
      }
      setLoading(false);
    }
  };

  const testDiscordOAuth = async () => {
    setLoading(true);
    addLog('🟣 Starting Discord OAuth test (for comparison)...');
    
    try {
      addLog(`Redirect URL will be: ${window.location.origin}/google-debug`);
      
      if (!signUpLoaded || !signUp) {
        addLog('❌ SignUp not loaded or available');
        setLoading(false);
        return;
      }

      addLog('📤 Calling signUp.authenticateWithRedirect for Discord...');
      
      await signUp.authenticateWithRedirect({
        strategy: 'oauth_discord',
        redirectUrl: `${window.location.origin}/google-debug`,
        redirectUrlComplete: `${window.location.origin}/google-debug`,
      });
      
      addLog('✅ Discord redirect initiated successfully');
      
    } catch (error: any) {
      addLog(`❌ Discord OAuth error: ${error.message}`);
      if (error.errors) {
        error.errors.forEach((err: any, index: number) => {
          addLog(`❌ Discord Error ${index + 1}: ${err.code} - ${err.message}`);
        });
      }
      setLoading(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Google OAuth Debug</h1>
      
      {/* Current Status */}
      <div className="mb-6 p-4 border rounded bg-blue-50">
        <h2 className="font-semibold mb-2">Current Status</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p><strong>Signed In:</strong> {isSignedIn ? '✅ Yes' : '❌ No'}</p>
            <p><strong>User ID:</strong> {user?.id || 'None'}</p>
            <p><strong>Username:</strong> {user?.username || 'None'}</p>
            <p><strong>Email:</strong> {user?.emailAddresses?.[0]?.emailAddress || 'None'}</p>
          </div>
          <div>
            <p><strong>External Accounts:</strong> {user?.externalAccounts?.length || 0}</p>
            {user?.externalAccounts?.map((acc, index) => (
              <p key={index} className="text-sm ml-4">• {acc.provider}: {acc.emailAddress}</p>
            ))}
            <p><strong>Clerk Loaded:</strong> {signUpLoaded && signInLoaded ? '✅ Yes' : '❌ No'}</p>
          </div>
        </div>
      </div>

      {/* Test Buttons */}
      <div className="mb-6 space-x-4">
        <button
          onClick={testGoogleOAuth}
          disabled={loading}
          className="px-6 py-3 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
        >
          {loading ? 'Loading...' : '🟢 Test Google OAuth'}
        </button>
        
        <button
          onClick={testDiscordOAuth}
          disabled={loading}
          className="px-6 py-3 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
        >
          {loading ? 'Loading...' : '🟣 Test Discord OAuth (Working)'}
        </button>
        
        <button
          onClick={clearLogs}
          className="px-6 py-3 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Clear Logs
        </button>
      </div>

      {/* Configuration Checklist */}
      <div className="mb-6 p-4 border rounded bg-yellow-50">
        <h2 className="font-semibold mb-2">⚠️ Google OAuth Configuration Checklist</h2>
        <div className="text-sm space-y-2">
          <p><strong>1. Google Cloud Console:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>OAuth 2.0 Client ID created</li>
            <li>Authorized redirect URIs include: <code>https://your-clerk-domain.clerk.accounts.dev/v1/oauth_callback</code></li>
            <li>Authorized JavaScript origins include: <code>http://localhost:9002</code></li>
          </ul>
          
          <p><strong>2. Clerk Dashboard:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Google OAuth provider enabled</li>
            <li>Client ID and Client Secret configured</li>
            <li>Scopes: email, profile (minimum)</li>
          </ul>
        </div>
      </div>

      {/* Debug Logs */}
      <div className="p-4 border rounded">
        <h2 className="font-semibold mb-2">Debug Logs</h2>
        <div className="bg-black text-green-400 p-4 rounded font-mono text-sm h-96 overflow-y-auto">
          {logs.length === 0 ? (
            <p>No logs yet. Click a test button to start debugging.</p>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="mb-1">{log}</div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}