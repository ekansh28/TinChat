// ===== src/components/ProfileCard.tsx =====
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface ProfileCardProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onScrollToggle: (enabled: boolean) => void;
  clickPosition: { x: number; y: number } | null;
}

interface UserProfile {
  username: string;
  display_name?: string;
  avatar_url?: string;
  banner_url?: string;
  pronouns?: string;
  status?: 'online' | 'idle' | 'dnd' | 'offline';
  display_name_color?: string;
  display_name_animation?: string;
  badges?: any[];
  bio?: string;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  userId,
  isOpen,
  onClose,
  onScrollToggle,
  clickPosition
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !userId) return;

    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) {
          setError('Profile not found');
          return;
        }

        setProfile(data);
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [isOpen, userId]);

  useEffect(() => {
    onScrollToggle(!isOpen);
    return () => onScrollToggle(true);
  }, [isOpen, onScrollToggle]);

  if (!isOpen) return null;

  const cardStyle: React.CSSProperties = {
    position: 'fixed',
    top: clickPosition ? clickPosition.y : '50%',
    left: clickPosition ? clickPosition.x : '50%',
    transform: clickPosition ? 'translateX(-50%)' : 'translate(-50%, -50%)',
    zIndex: 1000,
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Profile Card */}
      <div 
        className="window bg-white dark:bg-gray-800 p-4 rounded shadow-lg max-w-sm w-80 z-50"
        style={cardStyle}
      >
        <div className="title-bar mb-3">
          <div className="title-bar-text">User Profile</div>
          <button 
            className="title-bar-controls"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="window-body">
          {loading && (
            <div className="text-center py-4">
              <p>Loading profile...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-4 text-red-500">
              <p>{error}</p>
            </div>
          )}

          {profile && (
            <div className="space-y-3">
              {/* Avatar */}
              {profile.avatar_url && (
                <div className="text-center">
                  <img 
                    src={profile.avatar_url} 
                    alt="Avatar" 
                    className="w-16 h-16 rounded-full mx-auto"
                  />
                </div>
              )}

              {/* Name */}
              <div className="text-center">
                <h3 
                  className={cn(
                    "font-bold text-lg",
                    profile.display_name_animation === 'rainbow' && 'animate-pulse'
                  )}
                  style={{ 
                    color: profile.display_name_color || '#000000' 
                  }}
                >
                  {profile.display_name || profile.username}
                </h3>
                {profile.pronouns && (
                  <p className="text-sm text-gray-500">({profile.pronouns})</p>
                )}
              </div>

              {/* Status */}
              {profile.status && (
                <div className="flex items-center justify-center gap-2">
                  <div 
                    className={cn(
                      "w-3 h-3 rounded-full",
                      profile.status === 'online' && 'bg-green-500',
                      profile.status === 'idle' && 'bg-yellow-500',
                      profile.status === 'dnd' && 'bg-red-500',
                      profile.status === 'offline' && 'bg-gray-500'
                    )}
                  />
                  <span className="text-sm capitalize">{profile.status}</span>
                </div>
              )}

              {/* Bio */}
              {profile.bio && (
                <div>
                  <h4 className="font-semibold text-sm">About</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {profile.bio}
                  </p>
                </div>
              )}

              {/* Badges */}
              {profile.badges && profile.badges.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Badges</h4>
                  <div className="flex flex-wrap gap-1">
                    {profile.badges.map((badge, index) => (
                      <img 
                        key={index}
                        src={badge.url || badge.icon}
                        alt={badge.name || 'Badge'}
                        title={badge.name}
                        className="w-6 h-6 rounded"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};