'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button-themed';
import { usePathname, useRouter } from 'next/navigation';
import { Settings } from 'lucide-react';
import { ProfileCustomizer } from '@/components/ProfileCustomizer';

export default function AuthButtons() {
  const [user, setUser] = useState<User | null>(null);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  
  // Use refs to prevent unnecessary re-renders and race conditions
  const initializationRef = useRef(false);
  const mountedRef = useRef(true);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Simplified and more robust auth initialization
  const initializeAuth = useCallback(async () => {
    if (initializationRef.current || !mountedRef.current) {
      console.log("AuthButtons: Skipping initialization - already initialized or unmounted");
      return;
    }

    initializationRef.current = true;
    
    try {
      console.log("AuthButtons: Starting auth initialization...");
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set a safety timeout
      timeoutRef.current = setTimeout(() => {
        if (mountedRef.current && authLoading) {
          console.warn("AuthButtons: Auth loading timeout reached, forcing completion");
          setAuthLoading(false);
        }
      }, 3000);

      // Get current session with error handling
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

      if (currentUser) {
        try {
          // Fetch user profile with timeout
          const profilePromise = supabase
            .from('user_profiles')
            .select('username, display_name')
            .eq('id', currentUser.id)
            .single();

          // Add timeout to profile fetch
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Profile fetch timeout')), 2000);
          });

          const { data: profileData, error: profileError } = await Promise.race([
            profilePromise,
            timeoutPromise
          ]) as any;

          if (!mountedRef.current) return;

          if (profileError && profileError.code !== 'PGRST116') {
            console.error("AuthButtons: Profile fetch error:", profileError);
            setProfileUsername(null);
          } else if (profileData) {
            const displayName = profileData.display_name || profileData.username;
            setProfileUsername(displayName);
            console.log("AuthButtons: Profile loaded:", displayName);
          } else {
            console.log("AuthButtons: No profile found");
            setProfileUsername(null);
          }
        } catch (profileError) {
          console.error("AuthButtons: Profile fetch exception:", profileError);
          if (mountedRef.current) {
            setProfileUsername(null);
          }
        }
      } else {
        setProfileUsername(null);
      }

    } catch (error) {
      console.error("AuthButtons: Initialization error:", error);
      if (mountedRef.current) {
        setUser(null);
        setProfileUsername(null);
      }
    } finally {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (mountedRef.current) {
        setAuthLoading(false);
        console.log("AuthButtons: Auth initialization complete");
      }
    }
  }, [authLoading]);

  // Set up auth listener with better error handling
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

      const isAuthPage = pathname.startsWith('/signin') || pathname.startsWith('/signup');

      if (currentUser) {
        // User signed in - fetch profile with timeout
        try {
          const { data: profileData, error: profileError } = await Promise.race([
            supabase
              .from('user_profiles')
              .select('username, display_name, profile_complete')
              .eq('id', currentUser.id)
              .single(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Profile timeout')), 2000))
          ]) as any;

          if (!mountedRef.current) return;

          if (profileError && profileError.code !== 'PGRST116') {
            console.error("AuthButtons: Profile error in auth change:", profileError);
            setProfileUsername(null);
          } else if (profileData) {
            const displayName = profileData.display_name || profileData.username;
            setProfileUsername(displayName);
            console.log("AuthButtons: Profile updated via auth change:", displayName);

            // Handle navigation for sign-in events
            if (event === 'SIGNED_IN' && isAuthPage) {
              if (profileData.profile_complete) {
                console.log("AuthButtons: Redirecting to home (profile complete)");
                router.push('/');
              } else {
                console.log("AuthButtons: Redirecting to onboarding (profile incomplete)");
                router.push('/onboarding');
              }
            }
          } else if (mountedRef.current) {
            setProfileUsername(null);
            if (event === 'SIGNED_IN' && isAuthPage) {
              console.log("AuthButtons: No profile found, redirecting to onboarding");
              router.push('/onboarding');
            }
          }
        } catch (error) {
          console.error("AuthButtons: Profile fetch error in auth change:", error);
          if (mountedRef.current) setProfileUsername(null);
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

      // Ensure loading state is cleared
      if (mountedRef.current) {
        setAuthLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      authListener.subscription?.unsubscribe();
    };
  }, [router, pathname, initializeAuth]);

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
    if (mountedRef.current) {
      setIsCustomizerOpen(true);
    }
  }, []);

  const handleCloseCustomizer = useCallback(() => {
    if (mountedRef.current) {
      setIsCustomizerOpen(false);
    }
  }, []);

  // Show loading state with shorter timeout
  if (authLoading) {
    return <div className="text-xs animate-pulse text-gray-500">Auth...</div>;
  }

  // Show authenticated user UI
  if (user) {
    const displayName = profileUsername || user.email;
    return (
      <>
        <div className="flex items-center space-x-2">
          <Button 
            onClick={handleOpenCustomizer}
            className="text-xs p-1 w-8 h-8" 
            variant="outline"
            disabled={signingOut}
            title="Customize Profile"
            aria-label="Customize Profile"
          >
            <Settings size={14} />
          </Button>
          <span 
            className="text-xs hidden sm:inline truncate max-w-[100px] sm:max-w-[150px]" 
            title={displayName ?? undefined}
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

        {/* Profile Customizer Modal */}
        <ProfileCustomizer 
          isOpen={isCustomizerOpen} 
          onClose={handleCloseCustomizer} 
        />
      </>
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