// src/components/AuthButtons.tsx

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Button } from '@/components/ui/button-themed';
import AuthModal from './AuthModal';
import type { Database } from '@/lib/supabase';
// The ProfileCustomizer is no longer imported or rendered here.

// Define the interface for the component's props.
interface AuthButtonsProps {
  onOpenProfileCustomizer: () => void;
  isMobile: boolean;
}

// Update the component to accept and use the new props.
const AuthButtons = ({ onOpenProfileCustomizer, isMobile }: AuthButtonsProps) => {
  const user = useUser();
  const supabase = useSupabaseClient<Database>();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [profileExists, setProfileExists] = useState<boolean | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsUsernameSetup, setNeedsUsernameSetup] = useState(false);
  const [hasCheckedOAuthRedirect, setHasCheckedOAuthRedirect] = useState(false);

  const checkProfileCalled = useRef(false);

  // This function checks if a user profile exists in your database.
  const checkProfile = useCallback(async (userId: string) => {
    if (profileExists !== null || loading) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/profile/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setProfileExists(true);
        setUserProfile(data);
      } else if (response.status === 404) {
        setProfileExists(false);
        setUserProfile(null);
      }
    } catch (error) {
      setProfileExists(null); // Set to null on error to allow retry
    } finally {
      setLoading(false);
    }
  }, [profileExists, loading]);

  // Check if OAuth user needs username setup
  const checkOAuthUsernameSetup = useCallback(() => {
    if (!user || !isSignedIn) {
      return;
    }
    
    
    // Check if user signed in via OAuth and doesn't have a username
    const hasUsername = user.username && user.username.trim().length > 0;
    const isOAuthUser = user.externalAccounts && user.externalAccounts.length > 0;
    
    
    if (isOAuthUser && !hasUsername) {
      setNeedsUsernameSetup(true);
      setShowAuthModal(true);
    } else {
    }
  }, [user, isSignedIn]);

  // Check URL parameters for OAuth redirect
  const checkOAuthRedirect = useCallback(() => {
    if (hasCheckedOAuthRedirect) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const hasOAuthParams = urlParams.has('__clerk_redirect_url') || 
                          urlParams.has('__clerk_handshake_token') ||
                          urlParams.has('__clerk_status') ||
                          window.location.hash.includes('access_token') ||
                          window.location.search.includes('oauth');
    
    
    if (hasOAuthParams) {
      setHasCheckedOAuthRedirect(true);
      // Small delay to allow Clerk to process the OAuth result
      setTimeout(() => {
        checkOAuthUsernameSetup();
      }, 1500);
    }
  }, [hasCheckedOAuthRedirect, checkOAuthUsernameSetup]);

  useEffect(() => {
    
    if (isSignedIn && user?.id && !checkProfileCalled.current) {
      checkProfile(user.id);
      checkProfileCalled.current = true;
      // Also check if OAuth user needs username setup
      checkOAuthUsernameSetup();
    }
  }, [isSignedIn, user?.id, checkProfile, checkOAuthUsernameSetup]);

  // Check for OAuth redirect parameters on mount and when URL changes
  useEffect(() => {
    checkOAuthRedirect();
    
    // Also check after a delay in case Clerk is still processing
    const timeoutId = setTimeout(() => {
      if (isSignedIn && user && !hasCheckedOAuthRedirect) {
        checkOAuthUsernameSetup();
      }
    }, 3000);
    
    return () => clearTimeout(timeoutId);
  }, [checkOAuthRedirect, isSignedIn, user, hasCheckedOAuthRedirect, checkOAuthUsernameSetup]);

  // Additional effect to check for OAuth username setup on user data changes
  useEffect(() => {
    if (isSignedIn && user) {
      checkOAuthUsernameSetup();
    }
  }, [isSignedIn, user, checkOAuthUsernameSetup]);

  const handleModalClose = useCallback(() => {
    setShowAuthModal(false);
    setNeedsUsernameSetup(false);
    // Clear OAuth redirect parameters from URL
    const url = new URL(window.location.href);
    const paramsToRemove = ['__clerk_redirect_url', '__clerk_handshake_token', '__clerk_status'];
    paramsToRemove.forEach(param => url.searchParams.delete(param));
    
    // Clean the URL without a full page reload
    if (url.search !== window.location.search || url.hash !== window.location.hash) {
      window.history.replaceState({}, document.title, url.pathname + url.search);
    }
    
    // After closing the auth modal, re-check the profile if the user just signed in.
    if (user?.id) {
      checkProfile(user.id);
    }
  }, [user?.id, checkProfile]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      // Reset state after signing out
      setProfileExists(null);
      setUserProfile(null);
      setNeedsUsernameSetup(false);
      setHasCheckedOAuthRedirect(false);
      checkProfileCalled.current = false;
      
      // Clear any OAuth redirect detection
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
    } finally {
      setSigningOut(false);
    }
  };

  if (loading && isSignedIn) {
    return <span>Loading...</span>;
  }

  // Show AuthModal if OAuth user needs username setup
  if (isSignedIn && user && needsUsernameSetup) {
    return (
      <div className="flex items-center space-x-2">
        <Button
          onClick={() => setShowAuthModal(true)}
          className="text-xs p-1"
          disabled={signingOut}
          title="Complete your username setup"
          variant="outline"
        >
          ⚙️ Username
        </Button>
        <span className="text-sm font-medium">
          {user.primaryEmailAddress?.emailAddress || 'User'}
        </span>
        <Button 
          onClick={handleSignOut} 
          className="text-xs p-1" 
          disabled={signingOut}
          variant="outline"
        >
          {signingOut ? 'Signing Out...' : 'Sign Out'}
        </Button>
        {showAuthModal && typeof window !== 'undefined' && createPortal(
          <AuthModal 
            isOpen={showAuthModal}
            onClose={handleModalClose}
          />,
          document.body
        )}
      </div>
    );
  }

  // Show "Complete Setup" if user is signed in but has no profile.
  if (isSignedIn && user && profileExists === false && !needsUsernameSetup) {
    return (
      <div className="flex items-center space-x-2">
        <Button
          onClick={onOpenProfileCustomizer}
          className="text-xs p-1"
          disabled={signingOut}
          title="Complete your profile setup"
          variant="outline"
        >
          ⚙️ Setup
        </Button>
        <span className="text-sm font-medium">
          {user.username}
        </span>
        <Button onClick={handleSignOut} className="text-xs p-1" disabled={signingOut} variant="outline">
          {signingOut ? 'Signing Out...' : 'Sign Out'}
        </Button>
      </div>
    );
  }

  // Show user info and profile customizer if user is signed in and has a profile.
  if (isSignedIn && user && profileExists === true && userProfile) {
    return (
      <div className="flex items-center space-x-2">
        <Button
          onClick={onOpenProfileCustomizer}
          className="text-xs p-1"
          title="Profile Settings"
          variant="outline"
        >
          ⚙️
        </Button>
        <span className="text-sm font-medium">
          {userProfile.display_name || user.username}
        </span>
        <Button 
          onClick={handleSignOut} 
          className="text-xs p-1" 
          disabled={signingOut}
          variant="outline"
        >
          {signingOut ? 'Signing Out...' : 'Sign Out'}
        </Button>
      </div>
    );
  }

  // Default: Show "Sign In" button if not signed in.
  return (
    <>
      <Button
        onClick={() => setShowAuthModal(true)}
        className="text-xs p-1"
        variant="outline"
      >
        Sign In
      </Button>
      {showAuthModal && typeof window !== 'undefined' && createPortal(
        <AuthModal 
          isOpen={showAuthModal}
          onClose={handleModalClose}
        />,
        document.body
      )}
    </>
  );
};

export default AuthButtons;
