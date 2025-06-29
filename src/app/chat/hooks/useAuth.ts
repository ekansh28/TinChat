// src/app/chat/hooks/useAuth.ts - UPDATED FOR CLERK + XATA
import { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';

interface AuthState {
  authId: string | null;
  username: string | null;
  displayName: string | null;
  displayNameColor: string;
  displayNameAnimation: string;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface UserProfile {
  username: string;
  display_name?: string;
  display_name_color?: string;
  display_name_animation?: string;
}

export const useAuthForChat = () => {
  const { user, isLoaded: userLoaded } = useUser();
  const { isSignedIn, getToken } = useAuth();
  
  const [authState, setAuthState] = useState<AuthState>({
    authId: null,
    username: null,
    displayName: null,
    displayNameColor: '#0066cc',
    displayNameAnimation: 'none',
    isLoading: true,
    isAuthenticated: false
  });

  useEffect(() => {
    const initAuth = async () => {
      if (!userLoaded) return;

      try {
        if (isSignedIn && user) {
          // Fetch user profile from your API
          const token = await getToken();
          const headers: HeadersInit = {
            'Content-Type': 'application/json',
          };

          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          const response = await fetch(`/api/profiles/${user.id}`, {
            method: 'GET',
            headers,
          });

          if (response.ok) {
            const data = await response.json();
            
            if (data.success && data.data) {
              const profile: UserProfile = data.data;
              const displayName = profile.display_name || profile.username;
              
              setAuthState({
                authId: user.id,
                username: profile.username,
                displayName,
                displayNameColor: profile.display_name_color || '#0066cc',
                displayNameAnimation: profile.display_name_animation || 'none',
                isLoading: false,
                isAuthenticated: true
              });
            } else {
              // User exists but no profile in database
              setAuthState({
                authId: user.id,
                username: user.username || user.emailAddresses[0]?.emailAddress?.split('@')[0] || null,
                displayName: user.fullName || user.firstName || user.username || null,
                displayNameColor: '#0066cc',
                displayNameAnimation: 'none',
                isLoading: false,
                isAuthenticated: true
              });
            }
          } else {
            // API call failed, use Clerk data as fallback
            setAuthState({
              authId: user.id,
              username: user.username || user.emailAddresses[0]?.emailAddress?.split('@')[0] || null,
              displayName: user.fullName || user.firstName || user.username || null,
              displayNameColor: '#0066cc',
              displayNameAnimation: 'none',
              isLoading: false,
              isAuthenticated: true
            });
          }
        } else {
          // Not signed in
          setAuthState({
            authId: null,
            username: null,
            displayName: null,
            displayNameColor: '#0066cc',
            displayNameAnimation: 'none',
            isLoading: false,
            isAuthenticated: false
          });
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        
        // Fallback to Clerk data if available
        if (isSignedIn && user) {
          setAuthState({
            authId: user.id,
            username: user.username || user.emailAddresses[0]?.emailAddress?.split('@')[0] || null,
            displayName: user.fullName || user.firstName || user.username || null,
            displayNameColor: '#0066cc',
            displayNameAnimation: 'none',
            isLoading: false,
            isAuthenticated: true
          });
        } else {
          setAuthState({
            authId: null,
            username: null,
            displayName: null,
            displayNameColor: '#0066cc',
            displayNameAnimation: 'none',
            isLoading: false,
            isAuthenticated: false
          });
        }
      }
    };
    
    initAuth();
  }, [userLoaded, isSignedIn, user, getToken]);

  return authState;
};