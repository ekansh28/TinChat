// src/components/ProfileCard.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface Badge {
  id: string;
  url: string;
  name?: string;
}

interface UserProfile {
  id: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  banner_url?: string;
  pronouns?: string;
  bio?: string;
  status?: 'online' | 'idle' | 'dnd' | 'offline';
  display_name_color?: string;
  display_name_animation?: string;
  rainbow_speed?: number;
  badges?: Badge[];
  created_at?: string;
}

interface ProfileCardProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({ userId, isOpen, onClose }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);

    const fetchWithTimeout = (promise: Promise<any>, timeoutMs = 5000) => {
      return Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Profile timeout')), timeoutMs)
        ),
      ]);
    };

    try {
      const result: any = await fetchWithTimeout(
        (async () =>
          await supabase
            .from('user_profiles')
            .select(`
              id,
              username,
              display_name,
              avatar_url,
              banner_url,
              pronouns,
              bio,
              status,
              display_name_color,
              display_name_animation,
              rainbow_speed,
              badges,
              created_at
            `)
            .eq('id', userId)
            .single()
        )(),
        5000
      );


      const { data, error } = result;
      if (error) throw error;

      let parsedBadges: Badge[] = [];
      if (data.badges) {
        try {
          parsedBadges = typeof data.badges === 'string' ? JSON.parse(data.badges) : data.badges;
        } catch {
          parsedBadges = [];
        }
      }

      setProfile({ ...data, badges: parsedBadges });
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen && userId) fetchProfile();
  }, [isOpen, userId, fetchProfile]);

  if (!isOpen) return null;

  return (
    <div className="window profile-card">
      <div className="title-bar">
        <div className="title-bar-text">User Profile</div>
        <div className="title-bar-controls">
          <button aria-label="Close" onClick={onClose}></button>
        </div>
      </div>
      <div className="window-body">
        {loading && (
          <div className="text-center">
            <progress style={{ width: '100%' }}></progress>
            <p className="mt-2">Fetching profile...</p>
            <button className="button" disabled>
              Loading...
            </button>
          </div>
        )}

        {error && !loading && (
          <div className="text-center">
            <p className="text-error">{error}</p>
            <button className="button" onClick={fetchProfile}>
              Retry
            </button>
            <button className="button ml-2" onClick={onClose}>
              Close
            </button>
          </div>
        )}

        {profile && !loading && !error && (
          <div className="profile-content">
            <h2>{profile.display_name || profile.username}</h2>
            {profile.bio && <p className="mt-1">{profile.bio}</p>}
          </div>
        )}
      </div>
    </div>
  );
};
