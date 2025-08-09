import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useUser, useClerk } from '@clerk/nextjs';
import { Button } from '@/components/ui/button-themed';
import AuthModal from './AuthModal';
import ProfileCustomizer from './ProfileCustomizer'; // Added import

const AuthButtons = () => {
  const { user, isSignedIn } = useUser();
  const { signOut } = useClerk();
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileCustomizer, setShowProfileCustomizer] = useState(false); // Added state
  const [signingOut, setSigningOut] = useState(false);
  const [profileExists, setProfileExists] = useState<boolean | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const lastCheckedUserId = useRef<string | null>(null);
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if user profile exists
  const checkProfile = useCallback(async (userId: string) => {
    if (lastCheckedUserId.current === userId && profileExists !== null) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/profiles/${userId}`);
      
      // Check if the response is ok and content-type is JSON
      if (!response.ok) {
        console.error(`API request failed with status: ${response.status}`);
        setProfileExists(false);
        return;
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('API response is not JSON:', contentType);
        setProfileExists(false);
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        setProfileExists(true);
        setUserProfile(data.profile);
      } else {
        setProfileExists(false);
      }
      lastCheckedUserId.current = userId;
    } catch (error) {
      console.error('Error checking profile:', error);
      setProfileExists(false);
    } finally {
      setLoading(false);
    }
  }, [profileExists]);

  // Check profile when user changes
  useEffect(() => {
    if (isSignedIn && user?.id) {
      // Clear any existing timeout
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
      
      // Check immediately, then set up periodic checks
      checkProfile(user.id);
      
      checkTimeoutRef.current = setTimeout(() => {
        if (user?.id) {
          checkProfile(user.id);
        }
      }, 1000);
    } else {
      // Reset state when user signs out
      setProfileExists(null);
      setUserProfile(null);
      lastCheckedUserId.current = null;
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
        checkTimeoutRef.current = null;
      }
    }

    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, [isSignedIn, user?.id, checkProfile]);

  // Handle modal close with delayed profile recheck
  const handleModalClose = useCallback(() => {
    setShowAuthModal(false);
    setShowProfileCustomizer(false); // Added this line
    // Reset profile check state and recheck after a delay
    if (user?.id) {
      lastCheckedUserId.current = null;
      setProfileExists(null);
      setUserProfile(null);
      // Wait a bit for webhook to process, then recheck
      setTimeout(() => {
        if (user?.id) {
          checkProfile(user.id);
        }
      }, 2000);
    }
  }, [user?.id, checkProfile]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setSigningOut(false);
    }
  };

  // Show loading state while checking profile
  if (isSignedIn && user && loading && profileExists === null) {
    return (
      <Button className="text-xs p-1" disabled>
        Checking...
      </Button>
    );
  }

  // Show setup completion prompt if user exists but no profile
  if (isSignedIn && user && profileExists === false) {
    return (
      <>
        <Button
          onClick={() => setShowProfileCustomizer(true)} // Changed from setShowAuthModal
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

        {/* ProfileCustomizer Modal rendered via portal */}
        {showProfileCustomizer && typeof window !== 'undefined' && createPortal(
          <ProfileCustomizer 
            isOpen={showProfileCustomizer}
            onClose={() => setShowProfileCustomizer(false)}
          />,
          document.body
        )}
      </>
    );
  }

  // Show user profile info and sign out if user is signed in and has profile
  if (isSignedIn && user && profileExists === true && userProfile) {
    return (
      <>
        <div className="flex items-center gap-2">
          <img 
            src="https://cdn.tinchat.online/icons/paint.png" 
            alt="Edit Profile"
            className="w-6 h-6 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setShowProfileCustomizer(true)}
            title="Edit Profile"
          />
          <span className="text-xs text-gray-300">
            {userProfile.display_name || userProfile.displayName || user.username || user.emailAddresses[0]?.emailAddress}
          </span>
          <Button
            onClick={handleSignOut}
            className="text-xs p-1"
            variant="outline"
            disabled={signingOut}
          >
            {signingOut ? 'Signing Out...' : 'Sign Out'}
          </Button>
        </div>

        {/* ProfileCustomizer Modal rendered via portal */}
        {showProfileCustomizer && typeof window !== 'undefined' && createPortal(
          <ProfileCustomizer 
            isOpen={showProfileCustomizer}
            onClose={() => setShowProfileCustomizer(false)}
          />,
          document.body
        )}
      </>
    );
  }

  // Show sign in button if user is not signed in
  return (
    <>
      <Button
        onClick={() => setShowAuthModal(true)}
        className="text-xs p-1"
        variant="outline"
      >
        Sign In
      </Button>

      {/* AuthModal rendered via portal */}
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