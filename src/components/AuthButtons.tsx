// src/components/AuthButtons.tsx - UPDATED FOR MODAL
'use client';
import { useState, useCallback } from 'react';
import { useUser, useAuth, useClerk } from '@clerk/nextjs';
import { Button } from '@/components/ui/button-themed';
import { cn } from '@/lib/utils';
import AuthModal from './AuthModal';

interface AuthButtonsProps {
  onOpenProfileCustomizer?: () => void;
  isMobile?: boolean;
}

export default function AuthButtons({ onOpenProfileCustomizer, isMobile = false }: AuthButtonsProps) {
  const { user, isLoaded: userLoaded } = useUser();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { signOut } = useClerk();
  
  const [signingOut, setSigningOut] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Handle sign out
  const handleSignOut = async () => {
    if (signingOut) return;
    
    setSigningOut(true);
    try {
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

  // Show loading state while Clerk is initializing
  if (!authLoaded || !userLoaded) {
    return (
      <div className="flex items-center space-x-2">
        <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs text-gray-500">Loading...</span>
      </div>
    );
  }

  // Show authenticated user UI
  if (isSignedIn && user) {
    const displayName = user.fullName || user.username || user.emailAddresses[0]?.emailAddress || 'User';
    
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

        {/* Display Name */}
        <span 
          className="text-xs hidden sm:inline truncate max-w-[100px] sm:max-w-[150px] text-white" 
          title={displayName}
        >
          {displayName}
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
    );
  }

  // Show sign in button for unauthenticated users
  return (
    <>
      <div className="flex items-center space-x-2">
        <Button 
          onClick={() => setShowAuthModal(true)}
          className="text-xs p-1" 
          variant="outline" 
          disabled={signingOut}
        >
          Sign In
        </Button>
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
        onClose={() => setShowAuthModal(false)}
      />
    </>
  );
}