// src/app/chat/hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface AuthState {
  authId: string | null;
  username: string | null;
  displayNameColor: string;
  displayNameAnimation: string;
  isLoading: boolean;
}

export const useAuth = () => {
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
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: profile, error } = await supabase
            .from('user_profiles')
            .select('username, display_name, display_name_color, display_name_animation')
            .eq('id', user.id)
            .single();
            
          if (!error && profile) {
            const displayUsername = profile.display_name || profile.username;
            setAuthState({
              authId: user.id,
              username: displayUsername,
              displayNameColor: profile.display_name_color || '#0066cc',
              displayNameAnimation: profile.display_name_animation || 'none',
              isLoading: false
            });
          } else {
            setAuthState(prev => ({
              ...prev,
              authId: user.id,
              isLoading: false
            }));
          }
        } else {
          setAuthState(prev => ({
            ...prev,
            isLoading: false
          }));
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setAuthState(prev => ({
          ...prev,
          isLoading: false
        }));
      }
    };
    
    initAuth();
  }, []);

  return authState;
};