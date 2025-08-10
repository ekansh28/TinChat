// src/components/AuthButtons.tsx

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useUser, useClerk } from '@clerk/nextjs';
import { Button } from '@/components/ui/button-themed';
import AuthModal from './AuthModal';
// The ProfileCustomizer is no longer imported or rendered here.

// Define the interface for the component's props.
interface AuthButtonsProps {
  onOpenProfileCustomizer: () => void;
  isMobile: boolean;
}

// Update the component to accept and use the new props.
const AuthButtons = ({ onOpenProfileCustomizer, isMobile }: AuthButtonsProps) => {
  const { user, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [profileExists, setProfileExists] = useState<boolean | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

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
      console.error("Failed to check profile:", error);
      setProfileExists(null); // Set to null on error to allow retry
    } finally {
      setLoading(false);
    }
  }, [profileExists, loading]);

  useEffect(() => {
    if (isSignedIn && user?.id && !checkProfileCalled.current) {
      checkProfile(user.id);
      checkProfileCalled.current = true;
    }
  }, [isSignedIn, user?.id, checkProfile]);

  const handleModalClose = useCallback(() => {
    setShowAuthModal(false);
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
      checkProfileCalled.current = false;
    } catch (error) {
      console.error("Sign out failed", error);
    } finally {
      setSigningOut(false);
    }
  };

  if (loading && isSignedIn) {
    return <span>Loading...</span>;
  }

  // Show "Complete Setup" if user is signed in but has no profile.
  if (isSignedIn && user && profileExists === false) {
    return (
      <>
        <Button
          onClick={onOpenProfileCustomizer} // Call the parent's function to open the customizer
          className="text-xs p-1 bg-yellow-600 hover:bg-yellow-700"
          disabled={signingOut}
          title="Complete your profile setup"
        >
          Complete Setup
        </Button>
        <Button onClick={handleSignOut} className="text-xs p-1" disabled={signingOut}>
          {signingOut ? 'Signing Out...' : 'Sign Out'}
        </Button>
        {/* The ProfileCustomizer modal is no longer rendered from here */}
      </>
    );
  }

  // Show user info and "Edit Profile" if user is signed in and has a profile.
  if (isSignedIn && user && profileExists === true && userProfile) {
    return (
      <div className="flex items-center space-x-2">
        <Button
          onClick={onOpenProfileCustomizer} // Call the parent's function to open the customizer
          title="Edit Profile"
        >
          Edit Profile
        </Button>
        <span className="text-sm">
          {userProfile.display_name || user.username}
        </span>
        <Button onClick={handleSignOut} className="text-xs p-1" disabled={signingOut}>
          {signingOut ? 'Signing Out...' : 'Sign Out'}
        </Button>
        {/* The ProfileCustomizer modal is no longer rendered from here */}
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
