// src/app/chat/hooks/useAuth.ts - UPDATED FOR SUPABASE AUTH
import { useState, useEffect } from 'react';
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react';
import type { Database } from '@/lib/supabase';

interface AuthState {
  authId: string | null;
  username: string | null;
  displayNameColor: string;
  displayName?: string;
  avatarUrl?: string;
  displayNameAnimation: string;
  isLoading: boolean;
  userProfile?: Database['public']['Tables']['user_profiles']['Row'] | null;
}

export const useAuth = () => {
  const user = useUser();
  const supabase = useSupabaseClient<Database>();
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
        console.log('[Auth] Supabase auth state:', { user: !!user, userId: user?.id });

        if (user) {
          const authId = user.id;
          const userEmail = user.email;
          const defaultUsername = userEmail?.split('@')[0] || 'User';

          console.log('[Auth] User authenticated with Supabase:', {
            authId,
            userEmail,
            defaultUsername
          });

          // Try to get profile data from our database
          try {
            const { data: profile, error } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('auth_id', authId)
              .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
              console.error('[Auth] Error fetching profile:', error);
            }

            if (profile) {
              console.log('[Auth] Profile data loaded from database:', profile);

              const displayUsername = profile.display_name || profile.username || defaultUsername;
              setAuthState({
                authId,
                username: displayUsername,
                displayName: profile.display_name,
                avatarUrl: profile.avatar_url,
                displayNameColor: profile.display_name_color || '#0066cc',
                displayNameAnimation: profile.display_name_animation || 'none',
                isLoading: false,
                userProfile: profile
              });
            } else {
              // Profile doesn't exist in our database, create one
              console.log('[Auth] No profile in database, creating new profile');

              const newProfile = {
                auth_id: authId,
                username: defaultUsername,
                display_name: defaultUsername,
                avatar_url: user.user_metadata?.avatar_url || null,
                profile_complete: false,
                display_name_color: '#0066cc',
                display_name_animation: 'none',
                status: 'offline'
              };

              const { data: createdProfile, error: createError } = await supabase
                .from('user_profiles')
                .insert([newProfile])
                .select()
                .single();

              if (createError) {
                console.error('[Auth] Error creating profile:', createError);
                // Use default state if profile creation fails
                setAuthState({
                  authId,
                  username: defaultUsername,
                  displayNameColor: '#0066cc',
                  displayNameAnimation: 'none',
                  isLoading: false
                });
              } else {
                console.log('[Auth] New profile created:', createdProfile);
                setAuthState({
                  authId,
                  username: defaultUsername,
                  displayName: defaultUsername,
                  avatarUrl: createdProfile.avatar_url,
                  displayNameColor: '#0066cc',
                  displayNameAnimation: 'none',
                  isLoading: false,
                  userProfile: createdProfile
                });
              }
            }
          } catch (profileError) {
            console.warn('[Auth] Error fetching/creating profile:', profileError);
            setAuthState({
              authId,
              username: defaultUsername,
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
  }, [user, supabase]);

  return authState;
};