// src/components/AuthButtons.tsx - FIXED WITH PROPER AUTHENTICATION
'use client';
import { useState, useCallback, useEffect } from 'react';
import { useUser, useAuth, useClerk } from '@clerk/nextjs';
import { Button } from '@/components/ui/button-themed';
import { cn } from '@/lib/utils';
import AuthModal from './AuthModal';

interface AuthButtonsProps {
  onOpenProfileCustomizer?: () => void;
  isMobile?: boolean;
}

interface UserProfile {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  profile_complete?: boolean;
}

export default function AuthButtons({ onOpenProfileCustomizer, isMobile = false }: AuthButtonsProps) {
  const { user, isLoaded: userLoaded } = useUser();
  const { isSignedIn, isLoaded: authLoaded, getToken } = useAuth();
  const { signOut } = useClerk();
  
  const [signingOut, setSigningOut] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileExists, setProfileExists] = useState<boolean | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(false);

  // ✅ FIXED: Fetch user profile with authentication token
  const fetchUserProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      // Get authentication token
      const token = await getToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // Add auth token if available
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/profiles/${userId}`, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          return data.data as UserProfile;
        }
      } else if (response.status === 401) {
        console.warn('Authentication required for profile fetch');
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }, [getToken]);

  // ✅ FIXED: Check if user profile exists and fetch it
  const checkAndFetchProfile = useCallback(async () => {
    if (!user?.id || checkingProfile) return;

    setCheckingProfile(true);
    try {
      const profile = await fetchUserProfile(user.id);
      
      if (profile) {
        setUserProfile(profile);
        setProfileExists(true);
      } else {
        setUserProfile(null);
        setProfileExists(false);
      }
    } catch (error) {
      console.error('Error checking user profile:', error);
      setUserProfile(null);
      setProfileExists(false);
    } finally {
      setCheckingProfile(false);
    }
  }, [user?.id, checkingProfile, fetchUserProfile]);

  // ✅ Check profile when user changes
  useEffect(() => {
    if (isSignedIn && user?.id) {
      checkAndFetchProfile();
    } else {
      setUserProfile(null);
      setProfileExists(null);
    }
  }, [isSignedIn, user?.id, checkAndFetchProfile]);

  // ✅ Auto-show modal if user is signed in but has no profile
  useEffect(() => {
    if (isSignedIn && user && profileExists === false && !showAuthModal) {
      setShowAuthModal(true);
    }
  }, [isSignedIn, user, profileExists, showAuthModal]);

  // Handle sign out
  const handleSignOut = async () => {
    if (signingOut) return;
    
    setSigningOut(true);
    try {
      // Clear profile state
      setUserProfile(null);
      setProfileExists(null);
      await signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      setSigningOut(false);
    }
  };

  const handleOpenCustomizer = useCallback(() => {
    if (onOpenProfileCustomizer) {
      onOpenProfileCustomizer();
    }
  }, [onOpenProfileCustomizer]);

  // ✅ Handle modal close with profile recheck
  const handleModalClose = useCallback(() => {
    setShowAuthModal(false);
    // Recheck profile after modal closes
    if (user?.id) {
      setTimeout(() => {
        setProfileExists(null);
        setUserProfile(null);
        checkAndFetchProfile();
      }, 1000);
    }
  }, [user?.id, checkAndFetchProfile]);

  // ✅ Function to get display name with priority: database display_name > database username > Clerk data
  const getDisplayName = useCallback(() => {
    // Priority 1: Database display_name
    if (userProfile?.display_name) {
      return userProfile.display_name;
    }
    
    // Priority 2: Database username
    if (userProfile?.username) {
      return userProfile.username;
    }
    
    // Priority 3: Clerk data as fallback
    if (user?.fullName) {
      return user.fullName;
    }
    
    if (user?.username) {
      return user.username;
    }
    
    if (user?.emailAddresses[0]?.emailAddress) {
      return user.emailAddresses[0].emailAddress.split('@')[0];
    }
    
    return 'User';
  }, [userProfile, user]);

  // Show loading state while Clerk is initializing or checking profile
  if (!authLoaded || !userLoaded || (isSignedIn && checkingProfile)) {
    return (
      <div className="flex items-center space-x-2">
        <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs text-gray-500">Loading...</span>
      </div>
    );
  }

  // ✅ Show authenticated user UI with database username/display name
  if (isSignedIn && user && profileExists && userProfile) {
    const displayName = getDisplayName();
    
    return (
      <div className="flex items-center space-x-2">
        {/* Profile Customizer Button */}
        {onOpenProfileCustomizer && (
          <Button 
            onClick={handleOpenCustomizer}
            variant="outline"
            size={isMobile ? "sm" : "default"}
            disabled={signingOut}
            className={cn(
              "flex items-center gap-1",
              isMobile && "px-2 py-1 text-xs scale-90"
            )}
            title="Customize Profile"
            aria-label="Customize Profile"
          >
            <span className="text-sm">🎨</span>
            {!isMobile && <span>Profile</span>}
          </Button>
        )}

        {/* ✅ Display Name with username from database */}
        <span 
          className="text-xs hidden sm:inline truncate max-w-[100px] sm:max-w-[150px] text-white" 
          title={`${displayName}${userProfile.username ? ` (@${userProfile.username})` : ''}`}
        >
          {displayName}
        </span>

        {/* ✅ Show username badge if different from display name */}
        {userProfile.username && userProfile.display_name && userProfile.username !== userProfile.display_name && (
          <span className="text-xs text-gray-400 hidden md:inline">
            @{userProfile.username}
          </span>
        )}

        <Button 
          onClick={handleSignOut} 
          className="text-xs p-1" 
          variant="outline" 
          disabled={signingOut}
        >
          {signingOut ? 'Signing Out...' : 'Sign Out'}
        </Button>
      </div>
    );
  }

  // Show incomplete profile warning if user is signed in but no profile
  if (isSignedIn && user && profileExists === false) {
    return (
      <div className="flex items-center space-x-2">
        <Button 
          onClick={() => setShowAuthModal(true)}
          className="text-xs p-1 bg-yellow-600 hover:bg-yellow-700" 
          disabled={signingOut}
          title="Complete your profile setup"
        >
          Complete Setup
        </Button>

        <Button 
          onClick={handleSignOut} 
          className="text-xs p-1" 
          variant="outline" 
          disabled={signingOut}
        >
          {signingOut ? 'Signing Out...' : 'Sign Out'}
        </Button>
      </div>
    );
  }

  // Show sign in button for unauthenticated users
  return (
    <>
      <div className="flex items-center space-x-2">
<<<<<<< HEAD
=======
        <Button 
          onClick={() => setShowAuthModal(true)}
          className="text-xs p-1" 
          variant="outline" 
          disabled={signingOut}
        >
          Sign In
        </Button>
>>>>>>> parent of 80cc64c (added icons for signin/up)
        <Button 
          onClick={() => setShowAuthModal(true)}
          className="text-xs p-1" 
          disabled={signingOut}
        >
          Sign Up
        </Button>
      </div>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal}
        onClose={handleModalClose}
      />
    </>
  );
}
