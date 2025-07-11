// src/components/ProfileCustomizer/components/ProfileCardPreview.tsx - COMPLETE FINAL VERSION
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ImageEditor } from './ImageEditor';
import type { UserProfile, Badge } from '../types';

interface ProfileCardPreviewProps {
  profile: UserProfile;
  badges: Badge[];
  customCSS: string;
  isPreview?: boolean;
  onAvatarUpload?: (file: File) => void;
  onBannerUpload?: (file: File) => void;
}

function getDefaultAvatar() {
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjNTg2NUY0Ii8+CjxjaXJjbGUgY3g9IjQwIiBjeT0iMzAiIHI9IjE0IiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMjAgNjBDMjAgNTIuMjY4IDI2LjI2OCA0NiAzNCA0NkM0MS43MzIgNDYgNDggNTIuMjY4IDQ4IDYwVjgwSDIwVjYwWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+';
}

// Check if URL is a GIF
const isGifUrl = (url: string): boolean => {
  if (!url) return false;
  const cleanUrl = url.toLowerCase().split('?')[0];
  return cleanUrl.endsWith('.gif') || url.includes('data:image/gif');
};

// Status indicator function with icons
const getStatusIndicator = (status: string): { icon: string; text: string } => {
  switch (status) {
    case 'online': return { icon: 'https://cdn.sekansh21.workers.dev/icons/online.png', text: 'Online' };
    case 'idle': return { icon: 'https://cdn.sekansh21.workers.dev/icons/idle.png', text: 'Idle' };
    case 'dnd': return { icon: 'https://cdn.sekansh21.workers.dev/icons/dnd.png', text: 'Do Not Disturb' };
    case 'offline': return { icon: 'https://cdn.sekansh21.workers.dev/icons/offline.png', text: 'Offline' };
    default: return { icon: 'https://cdn.sekansh21.workers.dev/icons/offline.png', text: 'Unknown' };
  }
};

// Display name styling function
const getDisplayNameStyle = (animation?: string, color?: string, speed?: number): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    marginBottom: '0.25rem',
    color: color || '#000000',
  };

  switch (animation) {
    case 'rainbow':
      return {
        ...baseStyle,
        animation: `rainbow ${speed || 3}s linear infinite`,
      };
    case 'gradient':
      return {
        ...baseStyle,
        background: 'linear-gradient(45deg, #667eea, #764ba2)',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        animation: 'gradient 4s ease-in-out infinite',
      };
    case 'pulse':
      return {
        ...baseStyle,
        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      };
    case 'glow':
      return {
        ...baseStyle,
        animation: 'glow 2s ease-in-out infinite alternate',
      };
    default:
      return baseStyle;
  }
};

const ProfileCardPreview: React.FC<ProfileCardPreviewProps> = ({ 
  profile, 
  badges, 
  customCSS, 
  isPreview = false,
  onAvatarUpload,
  onBannerUpload
}) => {
  const [avatarHover, setAvatarHover] = useState(false);
  const [bannerHover, setBannerHover] = useState(false);
  const [isAvatarEditorOpen, setIsAvatarEditorOpen] = useState(false);
  const [isBannerEditorOpen, setIsBannerEditorOpen] = useState(false);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [selectedBannerFile, setSelectedBannerFile] = useState<File | null>(null);
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const badgesContainerRef = useRef<HTMLDivElement>(null);

  // Event handlers
  const handleAvatarClick = () => {
    if (onAvatarUpload) {
      avatarInputRef.current?.click();
    }
  };

  const handleBannerClick = () => {
    if (onBannerUpload) {
      bannerInputRef.current?.click();
    }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedAvatarFile(file);
      setIsAvatarEditorOpen(true);
      e.target.value = '';
    }
  };

  const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedBannerFile(file);
      setIsBannerEditorOpen(true);
      e.target.value = '';
    }
  };

  const handleBannerApply = (croppedImageData: string) => {
    setSelectedBannerFile(null);
    setIsBannerEditorOpen(false);
    
    setTimeout(() => {
      if (onBannerUpload) {
        const updateEvent = new CustomEvent('profileUpdate', {
          detail: { type: 'banner', data: croppedImageData }
        });
        window.dispatchEvent(updateEvent);
      }
    }, 0);
  };

  const handleAvatarApply = (croppedImageData: string) => {
    setSelectedAvatarFile(null);
    setIsAvatarEditorOpen(false);
    
    setTimeout(() => {
      if (onAvatarUpload) {
        const updateEvent = new CustomEvent('profileUpdate', {
          detail: { type: 'avatar', data: croppedImageData }
        });
        window.dispatchEvent(updateEvent);
      }
    }, 0);
  };

  const handleAvatarEditorClose = () => {
    setIsAvatarEditorOpen(false);
    setSelectedAvatarFile(null);
  };

  const handleBannerEditorClose = () => {
    setIsBannerEditorOpen(false);
    setSelectedBannerFile(null);
  };

  // Image error handlers
  const handleAvatarError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    target.src = getDefaultAvatar();
  };

  const handleBannerError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    target.style.display = 'none';
  };

  const handleBadgeError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    target.style.display = 'none';
  };

  // Badges scroll handling
  const handleBadgesWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (badgesContainerRef.current) {
      badgesContainerRef.current.scrollLeft += e.deltaY;
    }
  };

  const handleBadgesMouseMove = (e: React.MouseEvent) => {
    if (!badgesContainerRef.current) return;
    
    const container = badgesContainerRef.current;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const containerWidth = rect.width;
    
    const scrollZoneWidth = 50;
    const scrollSpeed = 2;
    
    if (x < scrollZoneWidth && container.scrollLeft > 0) {
      container.scrollLeft -= scrollSpeed;
    } else if (x > containerWidth - scrollZoneWidth && 
               container.scrollLeft < container.scrollWidth - container.clientWidth) {
      container.scrollLeft += scrollSpeed;
    }
  };

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*,.gif"
        onChange={handleAvatarFileChange}
        style={{ display: 'none' }}
      />
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/*,.gif"
        onChange={handleBannerFileChange}
        style={{ display: 'none' }}
      />

      {/* Image Editors */}
      {selectedAvatarFile && (
        <ImageEditor
          isOpen={isAvatarEditorOpen}
          onClose={handleAvatarEditorClose}
          onApply={handleAvatarApply}
          imageFile={selectedAvatarFile}
          title="Edit Profile Picture"
          cropType="circle"
        />
      )}

      {selectedBannerFile && (
        <ImageEditor
          isOpen={isBannerEditorOpen}
          onClose={handleBannerEditorClose}
          onApply={handleBannerApply}
          imageFile={selectedBannerFile}
          title="Edit Banner Image"
          cropType="banner"
        />
      )}

      {/* Inject custom CSS */}
      {customCSS && (
        <style dangerouslySetInnerHTML={{ __html: customCSS }} />
      )}
      
      <div
        className={cn(
          "profile-card-custom relative bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden",
          isPreview && "ring-2 ring-blue-400 ring-opacity-50"
        )}
        style={{ width: 300, minHeight: 200, overflow: 'hidden' }}
      >
        {/* Banner area - Top of card */}
        <div 
          className="profile-popup-banner profile-banner relative overflow-hidden rounded-t-lg"
          style={{ width: '100%', height: 140 }}
          onClick={handleBannerClick}
          onMouseEnter={() => setBannerHover(true)}
          onMouseLeave={() => setBannerHover(false)}
        >
          {profile.banner_url ? (
            <img
              src={profile.banner_url}
              alt="Profile Banner"
              className="profile-popup-banner-image w-full h-full object-cover"
              style={{
                width: '100%',
                height: '140px',
                imageRendering: isGifUrl(profile.banner_url) ? 'auto' : 'auto'
              }}
              onError={handleBannerError}
            />
          ) : (
            <div 
              className="profile-popup-banner-placeholder w-full h-full bg-gradient-to-r from-blue-400 to-purple-500" 
              style={{ width: '100%', height: '140px' }}
            />
          )}
          
          {/* Banner upload overlay */}
          {onBannerUpload && (
            <div
              className={cn(
                "absolute inset-0 bg-[rgba(0,0,0,0.5)] flex items-center justify-center transition-opacity duration-200",
                bannerHover ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
            >
              <div className="text-white text-center">
                <div className="text-sm">
                  {profile.banner_url ? 'Change Banner' : 'Add Banner'}
                </div>
                <div className="text-xs text-gray-300 mt-1">
                  300×140 recommended
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main content - Below banner with overlap */}
        <div className="px-4 pb-4 -mt-8 relative z-10">
          {/* Avatar */}
          <div className="mb-3 profile-avatar-container">
            <div className="relative w-20 h-20">
              <img
                src={profile.avatar_url || getDefaultAvatar()}
                alt="Profile Avatar"
                className="w-20 h-20 rounded-full border border-gray-800 object-cover shadow-lg profile-avatar cursor-pointer"
                style={{
                  imageRendering: isGifUrl(profile.avatar_url || '') ? 'auto' : 'auto'
                }}
                onError={handleAvatarError}
                onClick={handleAvatarClick}
                onMouseEnter={() => setAvatarHover(true)}
                onMouseLeave={() => setAvatarHover(false)}
              />
              
              {/* Status indicator */}
              <div className="absolute -bottom-1 -right-1 flex items-center justify-center profile-status-container">
                <img
                  src={getStatusIndicator(profile.status || 'offline').icon}
                  alt={getStatusIndicator(profile.status || 'offline').text}
                  className="w-4 h-4 profile-status-icon"
                  title={getStatusIndicator(profile.status || 'offline').text}
                  onError={(e) => {
                    // Fallback to default offline icon if status icon fails to load
                    (e.target as HTMLImageElement).src = 'https://cdn.sekansh21.workers.dev/icons/offline.png';
                  }}
                />
              </div>
              
              {/* Avatar upload overlay */}
              {onAvatarUpload && (
                <div
                  className={cn(
                    "absolute inset-0 flex items-center justify-center rounded-full transition-opacity duration-200",
                    avatarHover ? "opacity-100" : "opacity-0 pointer-events-none"
                  )}
                  style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
                >
                  <div className="text-white text-xs">
                    <span className="text-white text-xl inline-block rotate-[135deg]">✏︎</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Display name and pronouns */}
          <div className="mb-2 profile-name-container">
            <div className="flex items-center gap-2 flex-wrap">
              <h2
                className="profile-display-name"
                style={getDisplayNameStyle(profile.display_name_animation, profile.display_name_color, profile.rainbow_speed)}
              >
                {profile.display_name || profile.username || profile.id || 'Unknown User'}
              </h2>
              {profile.pronouns && (
                <span className="text-sm text-black profile-pronouns">
                  - {profile.pronouns}
                </span>
              )}
            </div>
          </div>

          {/* Username */}
          {profile.display_name && 
           profile.username && 
           profile.display_name !== profile.username && (
            <div className="mb-3 profile-username-container">
              <p className="text-sm text-black profile-username">
                @{profile.username}
              </p>
            </div>
          )}
          
          {(!profile.display_name && profile.username) && (
            <div className="mb-3 profile-username-container">
              <p className="text-sm text-black profile-username">
                @{profile.username}
              </p>
            </div>
          )}

          {/* Action Buttons Section - Only in ProfilePopup, removed from ProfileCardPreview */}

          {/* Divider */}
          <div className="w-full h-px bg-gray-800 mb-3 profile-divider" />

          {/* Bio Section */}
          {profile.bio && profile.bio.trim() && (
            <div className="mb-3 profile-bio-container">
              <div 
                className="text-sm text-white leading-relaxed p-3 bg-gray-800 rounded-lg border-l-4 border-blue-500 break-words profile-bio"
                style={{ 
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                  hyphens: 'auto',
                  maxHeight: '100px',
                  overflowY: 'auto',
                  lineHeight: '1.4',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
                }}
              >
                {profile.bio}
              </div>
            </div>
          )}

          {/* Badges Section */}
          {badges.length > 0 && (
            <div className="mb-3 profile-badges-container">
              <h3 className="text-sm font-semibold text-black mb-2 profile-badges-title">
                Badges ({badges.length})
              </h3>
              <div className="relative">
                <div 
                  ref={badgesContainerRef}
                  className="flex gap-2 overflow-x-auto pb-1 profile-badges-list"
                  style={{ 
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none'
                  }}
                  onWheel={handleBadgesWheel}
                  onMouseMove={handleBadgesMouseMove}
                >
                  {badges.map((badge) => (
                    <div
                      key={badge.id}
                      className="relative group flex-shrink-0 profile-badge-item"
                      title={badge.name || 'Badge'}
                    >
                      <img
                        src={badge.url}
                        alt={badge.name || 'Badge'}
                        className="h-8 rounded object-cover transition-transform duration-200 profile-badge-image"
                        style={{ 
                          minWidth: '32px',
                          maxWidth: '64px',
                          width: 'auto',
                          imageRendering: isGifUrl(badge.url) ? 'auto' : 'auto'
                        }}
                        onError={handleBadgeError}
                      />
                      
                      {/* Tooltip */}
                      {badge.name && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-20 profile-badge-tooltip">
                          {badge.name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Profile Info Footer */}
          <div className="text-xs text-black border-t border-gray-800 pt-3 mt-3 profile-footer">
            <div className="flex items-center justify-between">
              <span className="profile-footer-label">User Profile</span>
              {profile.created_at && (
                <span title="Profile created" className="profile-footer-date">
                  Joined {new Date(profile.created_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CSS Animations and Styles */}
      <style jsx>{`
        @keyframes rainbow {
          0% { color: #ff0000; }
          16.66% { color: #ff8000; }
          33.33% { color: #ffff00; }
          50% { color: #00ff00; }
          66.66% { color: #0080ff; }
          83.33% { color: #8000ff; }
          100% { color: #ff0000; }
        }

        @keyframes gradient {
          0%, 100% { 
            background: linear-gradient(45deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          50% { 
            background: linear-gradient(45deg, #f093fb, #f5576c);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
          }
        }

        @keyframes glow {
          0%, 100% { 
            text-shadow: 0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor;
          }
          50% { 
            text-shadow: 0 0 20px currentColor, 0 0 30px currentColor, 0 0 40px currentColor;
          }
        }

        /* ✅ BANNER CUSTOMIZATION CLASSES - Users can override these in their CSS */
        
        /* Default banner styling - can be overridden by user CSS */
        .profile-popup-banner {
          /* Users can customize with CSS like:
           * height: 200px; 
           * background: linear-gradient(...);
           */
        }
        
        .profile-popup-banner-image {
          /* Default banner image styling - fully customizable */
          object-fit: cover; /* Can be changed to: contain, fill, scale-down, none */
          object-position: center; /* Can be: top, bottom, left, right, center */
          /* Users can add:
           * filter: blur(2px) brightness(0.8);
           * transform: scale(1.1);
           * transition: transform 0.3s ease;
           */
        }
        
        .profile-popup-banner-placeholder {
          /* Default placeholder when no banner - fully customizable */
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          /* Users can override with:
           * background: url('pattern.png') repeat;
           * background: radial-gradient(circle, #ff6b9d, #c44569);
           * background-size: cover;
           * background-position: center;
           */
        }

        /* Hide all scrollbars completely */
        ::-webkit-scrollbar {
          display: none;
        }
        
        * {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        /* GIF optimization - ensure smooth playback */
        img[src*=".gif"],
        img[src*="data:image/gif"] {
          image-rendering: auto;
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
        }

        /* Mobile responsive adjustments */
        @media (max-width: 768px) {
          .profile-card-custom {
            width: calc(100vw - 40px) !important;
            max-width: 300px !important;
          }
          
          /* Adjust banner height on mobile */
          .profile-popup-banner {
            height: 120px !important;
          }
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          .profile-card-custom * {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </>
  );
};

export default ProfileCardPreview;