// src/components/ProfileCard.tsx
'use client';

import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button-themed';
import { useTheme } from '@/components/theme-provider';
import { supabase } from '@/lib/supabase';
import { sanitizeCSS } from '@/lib/SafeCSS';
import { cn } from '@/lib/utils';

interface ProfileData {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  banner_url?: string;
  bio?: string;
  pronouns?: string;
  status?: 'online' | 'idle' | 'dnd' | 'offline';
  display_name_color?: string;
  display_name_animation?: string;
  profile_card_css?: string;
}

interface ProfileCardProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onScrollToggle: (enabled: boolean) => void;
}

const STATUS_CONFIG = {
  online: { icon: '/icons/online.png', label: 'Online', color: '#43b581' },
  idle: { icon: '/icons/idle.png', label: 'Idle', color: '#faa61a' },
  dnd: { icon: '/icons/dnd.png', label: 'Do Not Disturb', color: '#f04747' },
  offline: { icon: '/icons/offline.png', label: 'Offline', color: '#747f8d' }
} as const;

const DEFAULT_PROFILE_CSS = `
/* Enhanced Profile Card Styles */
.profile-card-container {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 0;
  color: white;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  width: 350px;
  min-height: 500px;
  position: relative;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.profile-card-container:hover {
  transform: translateY(-5px);
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
}

.profile-banner {
  width: 100%;
  height: 140px;
  background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4);
  background-size: 400% 400%;
  animation: gradientShift 8s ease-in-out infinite;
  position: relative;
  overflow: hidden;
}

@keyframes gradientShift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

.profile-banner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-content {
  padding: 24px;
  position: relative;
  margin-top: -50px;
  z-index: 2;
}

.profile-avatar-container {
  position: relative;
  display: inline-block;
  margin-bottom: 16px;
}

.profile-avatar {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  border: 6px solid white;
  object-fit: cover;
  background: #ffffff;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s ease;
}

.profile-avatar:hover {
  transform: scale(1.05);
}

.profile-status {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border: 4px solid white;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  z-index: 3;
}

.profile-display-name {
  font-size: 26px;
  font-weight: 700;
  margin-bottom: 8px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  word-wrap: break-word;
  line-height: 1.2;
}

.profile-username {
  font-size: 16px;
  opacity: 0.9;
  margin-bottom: 8px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.profile-pronouns {
  font-size: 14px;
  opacity: 0.8;
  margin-bottom: 16px;
  font-style: italic;
  background: rgba(255, 255, 255, 0.1);
  padding: 4px 8px;
  border-radius: 12px;
  display: inline-block;
}

.profile-status-text {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 16px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

.profile-bio {
  font-size: 14px;
  line-height: 1.6;
  opacity: 0.95;
  margin-top: 16px;
  word-wrap: break-word;
  background: rgba(255, 255, 255, 0.1);
  padding: 12px;
  border-radius: 8px;
  backdrop-filter: blur(10px);
}

.profile-divider {
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  margin: 20px 0;
}

/* Display name animations */
.display-name-rainbow {
  background: linear-gradient(45deg, #ff0000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff, #ff0080);
  background-size: 400% 400%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: rainbow 3s ease-in-out infinite;
}

@keyframes rainbow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.display-name-gradient {
  background: linear-gradient(45deg, #667eea, #764ba2, #f093fb, #f5576c);
  background-size: 300% 300%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: gradientShift 4s ease-in-out infinite;
}

.display-name-pulse {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.05); }
}

.display-name-glow {
  text-shadow: 0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor;
  animation: glow 2s ease-in-out infinite alternate;
}

@keyframes glow {
  from { text-shadow: 0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor; }
  to { text-shadow: 0 0 20px currentColor, 0 0 30px currentColor, 0 0 40px currentColor; }
}

/* Theme 98 specific styles */
.theme-98 .profile-card-container {
  border: 2px outset #c0c0c0;
  border-radius: 0;
  box-shadow: inset -1px -1px #0a0a0a, inset 1px 1px #dfdfdf, inset -2px -2px grey, inset 2px 2px #fff;
  background: #c0c0c0;
  color: black;
}

.theme-98 .profile-banner {
  border-bottom: 1px solid #808080;
}

.theme-98 .profile-avatar {
  border: 2px inset #c0c0c0;
  box-shadow: inset -1px -1px #0a0a0a, inset 1px 1px #dfdfdf;
}

.theme-98 .profile-status {
  border: 2px outset #c0c0c0;
}

.theme-98 .profile-pronouns {
  background: #dfdfdf;
  border: 1px inset #c0c0c0;
  color: black;
}

.theme-98 .profile-bio {
  background: #dfdfdf;
  border: 1px inset #c0c0c0;
  color: black;
}
`;

export const ProfileCard: React.FC<ProfileCardProps> = ({ 
  userId, 
  isOpen, 
  onClose, 
  onScrollToggle 
}) => {
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const { currentTheme } = useTheme();

  useEffect(() => {
    if (isOpen) {
      onScrollToggle(false); // Disable scroll when modal opens
      fetchProfile();
    } else {
      onScrollToggle(true); // Enable scroll when modal closes
    }

    return () => {
      onScrollToggle(true); // Ensure scroll is enabled on cleanup
    };
  }, [isOpen, userId, onScrollToggle]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose]);

  const fetchProfile = async () => {
    if (!userId) return;
    
    setLoading(true);
    setError(null);

    try {
      console.log('Fetching enhanced profile for userId:', userId);
      
      // Fetch all profile data including new fields
      const { data, error: fetchError } = await supabase
        .from('user_profiles')
        .select(`
          id, 
          username, 
          display_name, 
          avatar_url, 
          banner_url,
          bio, 
          pronouns,
          status,
          display_name_color,
          display_name_animation,
          profile_card_css
        `)
        .eq('id', userId);

      if (fetchError) {
        console.error('Profile fetch error:', fetchError);
        throw fetchError;
      }

      console.log('Enhanced profile query result:', data);

      // Check if we got any results
      if (!data || data.length === 0) {
        console.log('No profile found for user:', userId);
        // Create a basic profile with just the user ID
        setProfileData({
          id: userId,
          username: 'Unknown User',
          display_name: 'Unknown User',
          status: 'offline'
        });
      } else {
        console.log('Enhanced profile data fetched:', data[0]);
        setProfileData(data[0]);
      }
    } catch (err) {
      console.error('Error fetching enhanced profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const getDisplayNameClass = (animation?: string) => {
    switch (animation) {
      case 'rainbow':
        return 'display-name-rainbow';
      case 'gradient':
        return 'display-name-gradient';
      case 'pulse':
        return 'display-name-pulse';
      case 'glow':
        return 'display-name-glow';
      default:
        return '';
    }
  };

  const getStatusConfig = (status?: string) => {
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.offline;
  };

  if (!isOpen) return null;

  const isTheme98 = currentTheme === 'theme-98';

  const renderProfileContent = () => {
    if (loading) {
      return (
        <div className={cn(
          "flex items-center justify-center",
          isTheme98 ? "window-body p-4" : "h-64"
        )}>
          <div className={cn(
            "flex flex-col items-center gap-4",
            isTheme98 ? "" : "text-white"
          )}>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
            <div>Loading profile...</div>
          </div>
        </div>
      );
    }

    if (error || !profileData) {
      return (
        <div className={cn(
          "flex items-center justify-center",
          isTheme98 ? "window-body p-4" : "h-64"
        )}>
          <div className={cn(
            "text-center",
            isTheme98 ? "" : "text-white"
          )}>
            <div className="text-lg mb-2">😔</div>
            <div>{error || 'Profile not found'}</div>
            <Button
              onClick={onClose}
              className="mt-4"
              variant="outline"
              size="sm"
            >
              Close
            </Button>
          </div>
        </div>
      );
    }

    // Combine default CSS with user's custom CSS
    const customCSS = profileData.profile_card_css || '';
    const sanitizedCSS = sanitizeCSS(customCSS);
    const finalCSS = DEFAULT_PROFILE_CSS + '\n' + sanitizedCSS;

    const statusConfig = getStatusConfig(profileData.status);
    const displayNameClass = getDisplayNameClass(profileData.display_name_animation);

    if (isTheme98) {
      return (
        <div className="window max-w-md">
          <div className="title-bar">
            <div className="title-bar-text">Profile - @{profileData.username}</div>
            <div className="title-bar-controls">
              <Button
                onClick={onClose}
                className="title-bar-control"
                aria-label="Close profile"
              >
                <X size={12} />
              </Button>
            </div>
          </div>
          <div className="window-body p-0">
            <style dangerouslySetInnerHTML={{ __html: finalCSS }} />
            <div className={cn("profile-card-container theme-98", isTheme98 && "theme-98")}>
              {/* Banner */}
              <div className="profile-banner">
                {profileData.banner_url ? (
                  <img 
                    src={profileData.banner_url} 
                    alt="Profile Banner"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
                )}
              </div>
              
              {/* Content */}
              <div className="profile-content">
                <div className="profile-avatar-container">
                  {profileData.avatar_url ? (
                    <img 
                      src={profileData.avatar_url} 
                      alt="Profile Avatar"
                      className="profile-avatar"
                    />
                  ) : (
                    <div className="profile-avatar bg-gray-300 flex items-center justify-center">
                      <svg className="w-12 h-12 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                  )}
                  
                  <Image
                    src={statusConfig.icon}
                    alt={statusConfig.label}
                    width={24}
                    height={24}
                    className="profile-status"
                    style={{ backgroundColor: statusConfig.color }}
                  />
                </div>
                
                {profileData.display_name && (
                  <div 
                    className={cn("profile-display-name", displayNameClass)}
                    style={{ 
                      color: profileData.display_name_animation === 'rainbow' || profileData.display_name_animation === 'gradient'
                        ? undefined 
                        : (profileData.display_name_color || '#000000')
                    }}
                  >
                    {profileData.display_name}
                  </div>
                )}
                
                <div className="profile-username">
                  @{profileData.username}
                </div>
                
                {profileData.pronouns && (
                  <div className="profile-pronouns">
                    {profileData.pronouns}
                  </div>
                )}
                
                <div className="profile-status-text">
                  <Image
                    src={statusConfig.icon}
                    alt={statusConfig.label}
                    width={16}
                    height={16}
                  />
                  {statusConfig.label}
                </div>
                
                {profileData.bio && (
                  <>
                    <div className="profile-divider"></div>
                    <div className="profile-bio">
                      {profileData.bio}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: finalCSS }} />
        <div className="profile-card-container">
          {/* Banner */}
          <div className="profile-banner">
            {profileData.banner_url ? (
              <img 
                src={profileData.banner_url} 
                alt="Profile Banner"
              />
            ) : (
              <div className="w-full h-full" />
            )}
          </div>
          
          {/* Content */}
          <div className="profile-content">
            <div className="profile-avatar-container">
              {profileData.avatar_url ? (
                <img 
                  src={profileData.avatar_url} 
                  alt="Profile Avatar"
                  className="profile-avatar"
                />
              ) : (
                <div className="profile-avatar bg-gray-300 flex items-center justify-center">
                  <svg className="w-12 h-12 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              )}
              
              <Image
                src={statusConfig.icon}
                alt={statusConfig.label}
                width={24}
                height={24}
                className="profile-status"
                style={{ backgroundColor: statusConfig.color }}
              />
            </div>
            
            {profileData.display_name && (
              <div 
                className={cn("profile-display-name", displayNameClass)}
                style={{ 
                  color: profileData.display_name_animation === 'rainbow' || profileData.display_name_animation === 'gradient'
                    ? undefined 
                    : (profileData.display_name_color || '#ffffff')
                }}
              >
                {profileData.display_name}
              </div>
            )}
            
            <div className="profile-username">
              @{profileData.username}
            </div>
            
            {profileData.pronouns && (
              <div className="profile-pronouns">
                {profileData.pronouns}
              </div>
            )}
            
            <div className="profile-status-text">
              <Image
                src={statusConfig.icon}
                alt={statusConfig.label}
                width={16}
                height={16}
              />
              {statusConfig.label}
            </div>
            
            {profileData.bio && (
              <>
                <div className="profile-divider"></div>
                <div className="profile-bio">
                  {profileData.bio}
                </div>
              </>
            )}
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm">
      <div 
        ref={modalRef}
        className={cn(
          "relative max-w-md w-full mx-4 transform transition-all duration-300 ease-out",
          isTheme98 ? "" : "bg-transparent",
          isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"
        )}
      >
        {!isTheme98 && (
          <Button
            onClick={onClose}
            className="absolute -top-3 -right-3 z-20 w-10 h-10 p-0 rounded-full bg-gray-800 hover:bg-gray-700 text-white shadow-lg transition-all duration-200 hover:scale-110"
            aria-label="Close profile"
          >
            <X size={20} />
          </Button>
        )}
        
        <div className="transform transition-all duration-300 hover:scale-[1.02]">
          {renderProfileContent()}
        </div>
      </div>
    </div>
  );
};