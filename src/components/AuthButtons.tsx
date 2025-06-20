// ===============================================================================
// src/components/AuthButtons.tsx - WITH FAST PROFILE FETCHING
// ===============================================================================

'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button-themed';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { fastProfileFetcher } from '@/lib/fastProfileFetcher';

interface AuthButtonsProps {
  onOpenProfileCustomizer?: () => void;
  isMobile?: boolean;
}

export default function AuthButtons({ onOpenProfileCustomizer, isMobile = false }: AuthButtonsProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  
  const router = useRouter();
  const pathname = usePathname();
  
  const mountedRef = useRef(true);
  const initializationRef = useRef(false);

  // Fast profile fetch with caching
  const fetchUserProfile = useCallback(async (userId: string): Promise<string | null> => {
    if (!userId || !mountedRef.current) return null;

    setProfileLoading(true);
    
    try {
      console.log('AuthButtons: Fast fetching profile for', userId);
      
      const profile = await fastProfileFetcher.fetchMinimalProfile(userId);
      
      if (!mountedRef.current) return null;

      if (profile) {
        const displayName = profile.username || profile.display_name;
        console.log('AuthButtons: Fast profile loaded:', displayName);
        return displayName;
      }

      return null;
    } catch (error: any) {
      console.warn('AuthButtons: Fast profile fetch failed:', error.message);
      return null;
    } finally {
      if (mountedRef.current) {
        setProfileLoading(false);
      }
    }
  }, []);

  // Initialize auth with fast profile loading
  const initializeAuth = useCallback(async () => {
    if (initializationRef.current || !mountedRef.current) {
      console.log("AuthButtons: Skipping initialization - already initialized or unmounted");
      return;
    }

    initializationRef.current = true;
    
    try {
      console.log("AuthButtons: Starting fast auth initialization...");
      
      // Get current session quickly
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (!mountedRef.current) return;

      if (sessionError) {
        console.error("AuthButtons: Session error:", sessionError);
        setUser(null);
        setProfileUsername(null);
        setAuthLoading(false);
        return;
      }

      const currentUser = session?.user ?? null;
      console.log("AuthButtons: Auth check complete. User:", currentUser?.id || 'anonymous');
      
      setUser(currentUser);
      setAuthLoading(false); // Set auth as loaded immediately

      // Fetch profile in background if user exists
      if (currentUser) {
        const displayName = await fetchUserProfile(currentUser.id);
        if (mountedRef.current) {
          setProfileUsername(displayName);
        }
      } else {
        setProfileUsername(null);
      }

    } catch (error) {
      console.error("AuthButtons: Initialization error:", error);
      if (mountedRef.current) {
        setUser(null);
        setProfileUsername(null);
        setAuthLoading(false);
      }
    }
  }, [fetchUserProfile]);

  // Set up auth listener with fast profile fetching
  useEffect(() => {
    mountedRef.current = true;

    // Initialize immediately
    initializeAuth();

    // Set up auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mountedRef.current) return;

      console.log("AuthButtons: Auth state change:", event, "session exists:", !!session);
      
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setAuthLoading(false); // Always clear auth loading

      const isAuthPage = pathname.startsWith('/signin') || pathname.startsWith('/signup');

      if (currentUser) {
        // User signed in - fetch profile quickly
        const displayName = await fetchUserProfile(currentUser.id);
        
        if (!mountedRef.current) return;
        
        setProfileUsername(displayName);

        // Handle navigation for sign-in events
        if (event === 'SIGNED_IN' && isAuthPage) {
          console.log("AuthButtons: Redirecting to home after sign-in");
          router.push('/');
        }
      } else {
        // User signed out
        if (mountedRef.current) {
          setProfileUsername(null);
          setSigningOut(false);
        }
        
        if (event === 'SIGNED_OUT' && !isAuthPage && mountedRef.current) {
          console.log("AuthButtons: User signed out, redirecting to home");
          router.push('/');
        }
      }
    });

    return () => {
      mountedRef.current = false;
      // Cancel any pending profile fetches
      if (user?.id) {
        fastProfileFetcher.cancelRequest(user.id);
      }
      authListener.subscription?.unsubscribe();
    };
  }, [router, pathname, initializeAuth, fetchUserProfile, user?.id]);

  const handleSignOut = async () => {
    if (signingOut || !mountedRef.current) return;
    
    setSigningOut(true);
    console.log("AuthButtons: Starting sign out process");
    
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("AuthButtons: Sign out error:", error.message);
        if (mountedRef.current) setSigningOut(false);
      } else {
        console.log("AuthButtons: Sign out successful");
        if (mountedRef.current) {
          setUser(null);
          setProfileUsername(null);
          router.push('/');
        }
      }
    } catch (error) {
      console.error("AuthButtons: Sign out exception:", error);
      if (mountedRef.current) setSigningOut(false);
    }
  };

  const handleOpenCustomizer = useCallback(() => {
    if (mountedRef.current && onOpenProfileCustomizer) {
      onOpenProfileCustomizer();
    } else {
      console.warn("AuthButtons: No onOpenProfileCustomizer handler provided");
    }
  }, [onOpenProfileCustomizer]);

  // Show minimal loading state
  if (authLoading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs text-gray-500">Auth...</span>
      </div>
    );
  }

  // Show authenticated user UI
  if (user) {
    // Show cached username immediately, or email as fallback
    const displayName = profileUsername || user.email;
    
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

        {/* Display Name with loading indicator */}
        <span 
          className="text-xs hidden sm:inline truncate max-w-[100px] sm:max-w-[150px] text-white flex items-center gap-1" 
          title={displayName ?? undefined}
        >
          {displayName || 'User'}
          {profileLoading && (
            <div className="w-2 h-2 border border-blue-400 border-t-transparent rounded-full animate-spin"></div>
          )}
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

  // Show sign in/up buttons for unauthenticated users
  return (
    <div className="flex items-center space-x-2">
      <Link href="/signin" passHref>
        <Button className="text-xs p-1" variant="outline" disabled={signingOut}>
          Sign In
        </Button>
      </Link>
      <Link href="/signup" passHref>
        <Button className="text-xs p-1" disabled={signingOut}>
          Sign Up
        </Button>
      </Link>
    </div>
  );
}
