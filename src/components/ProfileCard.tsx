// ===== src/components/ProfileCard.tsx =====
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { getDefaultProfileCSS } from '@/lib/SafeCSS';

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
  profile_card_css?: string;
  rainbow_speed?: number;
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
          .select(`
            username,
            display_name,
            avatar_url,
            banner_url,
            pronouns,
            status,
            display_name_color,
            display_name_animation,
            badges,
            bio,
            profile_card_css,
            rainbow_speed
          `)
          .eq('id', userId)
          .single();

        if (error) {
          setError('Profile not found');
          return;
        }

        // Parse badges if they exist
        if (data.badges && typeof data.badges === 'string') {
          try {
            data.badges = JSON.parse(data.badges);
          } catch (e) {
            console.error('Failed to parse badges:', e);
            data.badges = [];
          }
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

  // Generate CSS for animations
  const generateAnimationCSS = (animation: string, speed: number = 3) => {
    if (animation === 'rainbow') {
      return `
        .display-name-rainbow {
          background: linear-gradient(45deg, #ff0000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff, #ff0080);
          background-size: 400% 400%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: rainbow ${speed}s ease-in-out infinite;
        }
        @keyframes rainbow {
          0% { background-position: 0% 50%; }
          25% { background-position: 100% 0%; }
          50% { background-position: 100% 100%; }
          75% { background-position: 0% 100%; }
          100% { background-position: 0% 50%; }
        }
      `;
    }
    if (animation === 'gradient') {
      return `
        .display-name-gradient {
          background: linear-gradient(45deg, #667eea, #764ba2, #f093fb, #f5576c);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: gradientShift 6s ease-in-out infinite;
        }
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `;
    }
    if (animation === 'pulse') {
      return `
        .display-name-pulse {
          animation: textPulse 2s ease-in-out infinite;
        }
        @keyframes textPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
      `;
    }
    if (animation === 'glow') {
      return `
        .display-name-glow {
          text-shadow: 0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor;
          animation: textGlow 3s ease-in-out infinite alternate;
        }
        @keyframes textGlow {
          from { text-shadow: 0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor; }
          to { text-shadow: 0 0 20px currentColor, 0 0 30px currentColor, 0 0 40px currentColor; }
        }
      `;
    }
    return '';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return '#43b883';
      case 'idle': return '#faa61a';
      case 'dnd': return '#f04747';
      case 'offline': return '#747f8d';
      default: return '#747f8d';
    }
  };

  const customCSS = profile?.profile_card_css || getDefaultProfileCSS();
  const animationCSS = profile?.display_name_animation ? 
    generateAnimationCSS(profile.display_name_animation, profile.rainbow_speed) : '';

  return (
    <>
      {/* Inject custom CSS */}
      <style dangerouslySetInnerHTML={{ __html: customCSS + animationCSS }} />
      
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Profile Card */}
      <div 
        className="profile-card-container window bg-white dark:bg-gray-800 p-4 rounded shadow-lg max-w-sm w-80 z-50"
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
            <div className="profile-content space-y-3">
              {/* Banner */}
              {profile.banner_url && (
                <div className="profile-banner relative overflow-hidden w-full h-24 -mx-4 -mt-4 mb-4">
                  <img 
                    src={profile.banner_url} 
                    alt="Profile banner" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* Avatar */}
              {profile.avatar_url && (
                <div className="profile-avatar-container text-center relative">
                  <img 
                    src={profile.avatar_url} 
                    alt="Avatar" 
                    className="profile-avatar w-16 h-16 rounded-full mx-auto border-4 border-white dark:border-gray-800"
                  />
                  
                  {/* Status Indicator */}
                  {profile.status && (
                    <div 
                      className="profile-status absolute bottom-0 right-1/2 transform translate-x-8 translate-y-1 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800"
                      style={{ backgroundColor: getStatusColor(profile.status) }}
                      title={profile.status}
                    />
                  )}
                </div>
              )}

              {/* Display Name */}
              {profile.display_name && (
                <div className="text-center">
                  <h3 
                    className={cn(
                      "profile-display-name font-bold text-lg",
                      profile.display_name_animation === 'rainbow' && 'display-name-rainbow',
                      profile.display_name_animation === 'gradient' && 'display-name-gradient',
                      profile.display_name_animation === 'pulse' && 'display-name-pulse',
                      profile.display_name_animation === 'glow' && 'display-name-glow'
                    )}
                    style={{ 
                      color: profile.display_name_animation === 'none' || !profile.display_name_animation 
                        ? profile.display_name_color || '#000000' 
                        : undefined 
                    }}
                  >
                    {profile.display_name}
                  </h3>
                </div>
              )}

              {/* Username */}
              <div className="text-center">
                <div className="profile-username text-sm text-gray-500 dark:text-gray-400">
                  @{profile.username}
                </div>
              </div>

              {/* Pronouns */}
              {profile.pronouns && (
                <div className="text-center">
                  <p className="profile-pronouns text-sm text-gray-500 dark:text-gray-400">
                    ({profile.pronouns})
                  </p>
                </div>
              )}

              {/* Status Text */}
              {profile.status && (
                <div className="profile-status-text flex items-center justify-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getStatusColor(profile.status) }}
                  />
                  <span className="text-sm capitalize text-gray-600 dark:text-gray-300">
                    {profile.status}
                  </span>
                </div>
              )}

              {/* Divider */}
              {profile.bio && (
                <div className="profile-divider h-px bg-gray-200 dark:bg-gray-600 my-3" />
              )}

              {/* Bio */}
              {profile.bio && (
                <div>
                  <h4 className="font-semibold text-sm mb-1">About</h4>
                  <p className="profile-bio text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    {profile.bio}
                  </p>
                </div>
              )}

              {/* Badges */}
              {profile.badges && profile.badges.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Badges</h4>
                  <div className="profile-badges flex flex-wrap gap-1">
                    {profile.badges.map((badge, index) => (
                      <div key={badge.id || index} className="profile-badge">
                        <img 
                          src={badge.url || badge.icon}
                          alt={badge.name || 'Badge'}
                          title={badge.name}
                          className="w-6 h-6 rounded object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      </div>
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