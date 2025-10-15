// src/components/AuthButtonsSupabase.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Button } from '@/components/ui/button-themed';
import AuthModal from './AuthModal';
import type { Database } from '@/lib/supabase';

interface AuthButtonsProps {
  onOpenProfileCustomizer: () => void;
  isMobile: boolean;
}

const AuthButtons = ({ onOpenProfileCustomizer, isMobile }: AuthButtonsProps) => {
  const user = useUser();
  const supabase = useSupabaseClient<Database>();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [profileExists, setProfileExists] = useState<boolean | null>(null);
  const [userProfile, setUserProfile] = useState<Database['public']['Tables']['user_profiles']['Row'] | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignedIn = !!user;

  // Check if a user profile exists in the database
  const checkProfile = useCallback(async (userId: string) => {
    if (profileExists !== null || loading) return;
    setLoading(true);

    try {
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('auth_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching profile:', error);
        setProfileExists(false);
      } else if (profile) {
        setProfileExists(true);
        setUserProfile(profile);
      } else {
        setProfileExists(false);
        setUserProfile(null);
      }
    } catch (error) {
      console.error('Error checking profile:', error);
      setProfileExists(false);
    } finally {
      setLoading(false);
    }
  }, [profileExists, loading, supabase]);

  useEffect(() => {
    if (isSignedIn && user?.id) {
      checkProfile(user.id);
    } else {
      setProfileExists(null);
      setUserProfile(null);
    }
  }, [isSignedIn, user?.id, checkProfile]);

  const handleModalClose = useCallback(() => {
    setShowAuthModal(false);

    // After closing the auth modal, re-check the profile if the user just signed in
    if (user?.id) {
      setProfileExists(null); // Reset to trigger re-check
      checkProfile(user.id);
    }
  }, [user?.id, checkProfile]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      // Reset state after signing out
      setProfileExists(null);
      setUserProfile(null);
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setSigningOut(false);
    }
  };

  if (loading && isSignedIn) {
    return <span>Loading...</span>;
  }

  // Show "Complete Setup" if user is signed in but has no profile
  if (isSignedIn && user && profileExists === false) {
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
          {user.email?.split('@')[0] || 'User'}
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

  // Show user info and profile customizer if user is signed in and has a profile
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
          {userProfile.display_name || userProfile.username || user.email?.split('@')[0]}
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

  // Default: Show "Sign In" button if not signed in
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