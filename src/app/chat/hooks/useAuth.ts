// src/app/chat/hooks/useAuth.ts - FIXED FOR CLERK INTEGRATION
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs'; // ✅ FIXED: Use Clerk's useUser hook

interface AuthState {
  authId: string | null;
  username: string | null;
  displayNameColor: string;
  displayName?: string;    // ✅ Add this
  avatarUrl?: string;      // ✅ Add this
  displayNameAnimation: string;
  isLoading: boolean;
}

export const useAuth = () => {
  const { user, isLoaded } = useUser(); // ✅ FIXED: Use Clerk's useUser hook
  const [authState, setAuthState] = useState<AuthState>({
    authId: null,
    username: null,
    displayNameColor: '#0066cc',
    displayNameAnimation: 'none',
    isLoading: true
  });

  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log('[Auth] Clerk auth state:', { user: !!user, isLoaded, userId: user?.id });

        if (isLoaded) {
          if (user) {
            // ✅ FIXED: Use Clerk user data directly first, then try to get from our database
            const clerkId = user.id;
            const clerkUsername = user.username || user.firstName || user.emailAddresses[0]?.emailAddress?.split('@')[0] || 'User';
            
            console.log('[Auth] User authenticated with Clerk:', {
              clerkId,
              clerkUsername,
              hasProfile: !!user.username
            });

            // ✅ Try to get additional profile data from our database
            try {
              const response = await fetch(`/api/profiles/${clerkId}`, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                },
              });

              if (response.ok) {
                const profileData = await response.json();
                if (profileData.success && profileData.data) {
                  const profile = profileData.data;
                  console.log('[Auth] Profile data loaded from database:', profile);
                  
                  const displayUsername = profile.display_name || profile.username || clerkUsername;
                  setAuthState({
                    authId: clerkId,
                    username: displayUsername,
                    displayNameColor: profile.display_name_color || '#0066cc',
                    displayNameAnimation: profile.display_name_animation || 'none',
                    isLoading: false
                  });
                } else {
                  // Profile doesn't exist in our database, use Clerk data
                  console.log('[Auth] No profile in database, using Clerk data');
                  setAuthState({
                    authId: clerkId,
                    username: clerkUsername,
                    displayNameColor: '#0066cc',
                    displayNameAnimation: 'none',
                    isLoading: false
                  });
                }
              } else {
                // API call failed, use Clerk data as fallback
                console.log('[Auth] Profile API failed, using Clerk data as fallback');
                setAuthState({
                  authId: clerkId,
                  username: clerkUsername,
                  displayNameColor: '#0066cc',
                  displayNameAnimation: 'none',
                  isLoading: false
                });
              }
            } catch (profileError) {
              console.warn('[Auth] Error fetching profile, using Clerk data:', profileError);
              setAuthState({
                authId: clerkId,
                username: clerkUsername,
                displayNameColor: '#0066cc',
                displayNameAnimation: 'none',
                isLoading: false
              });
            }
          } else {
            // User not authenticated
            console.log('[Auth] User not authenticated');
            setAuthState({
              authId: null,
              username: null,
              displayNameColor: '#0066cc',
              displayNameAnimation: 'none',
              isLoading: false
            });
          }
        } else {
          // Still loading
          console.log('[Auth] Clerk still loading...');
        }
      } catch (error) {
        console.error('[Auth] Auth initialization error:', error);
        setAuthState({
          authId: null,
          username: null,
          displayNameColor: '#0066cc',
          displayNameAnimation: 'none',
          isLoading: false
        });
      }
    };
    
    initAuth();
  }, [user, isLoaded]); // ✅ FIXED: Depend on Clerk's user and isLoaded

  return authState;
};