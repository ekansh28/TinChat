// src/components/ProfileCustomizer/components/ProfileCardPreview.tsx - FIXED LAYOUT VERSION
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
    case 'online': return { icon: 'https://cdn.tinchat.online/icons/online.png', text: 'Online' };
    case 'idle': return { icon: 'https://cdn.tinchat.online/icons/idle.png', text: 'Idle' };
    case 'dnd': return { icon: 'https://cdn.tinchat.online/icons/dnd.png', text: 'Do Not Disturb' };
    case 'offline': return { icon: 'https://cdn.tinchat.online/icons/offline.png', text: 'Offline' };
    default: return { icon: 'https://cdn.tinchat.online/icons/offline.png', text: 'Unknown' };
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
        style={{ 
          width: 300, 
          minHeight: 200
        }}
      >
        {/* Banner area - Top of card */}
        <div 
          className="profile-popup-banner profile-banner relative overflow-hidden"
          style={{ 
            width: '100%', 
            height: 140,
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '8px',
            cursor: onBannerUpload ? 'pointer' : 'default'
          }}
          onClick={handleBannerClick}
          onMouseEnter={() => setBannerHover(true)}
          onMouseLeave={() => setBannerHover(false)}
        >
          {profile.banner_url ? (
            <img
              src={profile.banner_url}
              alt="Profile Banner"
              className="profile-popup-banner-image"
              style={{
                width: '100%',
                height: '140px',
                objectFit: 'cover',
                imageRendering: isGifUrl(profile.banner_url) ? 'auto' : 'auto'
              }}
              onError={handleBannerError}
            />
          ) : (
            <div 
              className="profile-popup-banner-placeholder"
              style={{ 
                width: '100%', 
                height: '140px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              }}
            />
          )}
          
          {/* Banner upload overlay */}
          {onBannerUpload && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: bannerHover ? 1 : 0,
                transition: 'opacity 0.2s',
                pointerEvents: bannerHover ? 'auto' : 'none'
              }}
            >
              <div style={{ textAlign: 'center', color: 'white' }}>
                <div style={{ fontSize: '14px' }}>
                  {profile.banner_url ? 'Change Banner' : 'Add Banner'}
                </div>
                <div style={{ fontSize: '12px', color: '#d1d5db', marginTop: '4px' }}>
                  300×140 recommended
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main content - Below banner with overlap */}
        <div style={{ padding: '16px', paddingTop: '0', marginTop: '-32px', position: 'relative', zIndex: 10 }}>
          {/* Avatar */}
          <div style={{ marginBottom: '12px' }} className="profile-avatar-container">
            <div style={{ position: 'relative', width: '80px', height: '80px' }}>
              <img
                src={profile.avatar_url || getDefaultAvatar()}
                alt="Profile Avatar"
                className="profile-avatar"
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  border: '3px solid #1f2937',
                  objectFit: 'cover',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  cursor: onAvatarUpload ? 'pointer' : 'default',
                  imageRendering: isGifUrl(profile.avatar_url || '') ? 'auto' : 'auto'
                }}
                onError={handleAvatarError}
                onClick={handleAvatarClick}
                onMouseEnter={() => setAvatarHover(true)}
                onMouseLeave={() => setAvatarHover(false)}
              />
              
              {/* Status indicator */}
              <div style={{ 
                position: 'absolute', 
                bottom: '-4px', 
                right: '-4px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }} className="profile-status-container">
                <img
                  src={getStatusIndicator(profile.status || 'offline').icon}
                  alt={getStatusIndicator(profile.status || 'offline').text}
                  className="profile-status-icon"
                  style={{ width: '16px', height: '16px' }}
                  title={getStatusIndicator(profile.status || 'offline').text}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://cdn.tinchat.online/icons/offline.png';
                  }}
                />
              </div>
              
              {/* Avatar upload overlay */}
              {onAvatarUpload && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: avatarHover ? 1 : 0,
                    transition: 'opacity 0.2s',
                    pointerEvents: 'none'
                  }}
                >
                  <div style={{ color: 'white', fontSize: '12px' }}>
                    <span style={{ fontSize: '20px', display: 'inline-block', transform: 'rotate(135deg)' }}>✏︎</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Display name and pronouns */}
          <div style={{ marginBottom: '8px' }} className="profile-name-container">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2
                className="profile-display-name"
                style={getDisplayNameStyle(profile.display_name_animation, profile.display_name_color, profile.rainbow_speed)}
              >
                {profile.display_name || profile.username || profile.id || 'Unknown User'}
              </h2>
              {profile.pronouns && (
                <span style={{ fontSize: '14px', color: '#000000' }} className="profile-pronouns">
                  - {profile.pronouns}
                </span>
              )}
            </div>
          </div>

          {/* Username */}
          {profile.display_name && 
           profile.username && 
           profile.display_name !== profile.username && (
            <div style={{ marginBottom: '12px' }} className="profile-username-container">
              <p style={{ fontSize: '14px', color: '#000000' }} className="profile-username">
                @{profile.username}
              </p>
            </div>
          )}
          
          {(!profile.display_name && profile.username) && (
            <div style={{ marginBottom: '12px' }} className="profile-username-container">
              <p style={{ fontSize: '14px', color: '#000000' }} className="profile-username">
                @{profile.username}
              </p>
            </div>
          )}

          {/* Divider */}
          <div style={{ 
            width: '100%', 
            height: '1px', 
            backgroundColor: '#1f2937', 
            marginBottom: '12px' 
          }} className="profile-divider" />

          {/* Bio Section */}
          {profile.bio && profile.bio.trim() && (
            <div style={{ marginBottom: '12px' }} className="profile-bio-container">
              <div 
                className="profile-bio"
                style={{ 
                  fontSize: '14px',
                  color: '#ffffff',
                  lineHeight: '1.4',
                  padding: '12px',
                  backgroundColor: '#1f2937',
                  borderRadius: '8px',
                  borderLeft: '4px solid #3b82f6',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                  hyphens: 'auto',
                  maxHeight: '100px',
                  overflowY: 'auto',
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
            <div style={{ marginBottom: '12px', display: 'block' }} className="profile-badges-container">
              <h3 style={{ 
                fontSize: '14px', 
                fontWeight: '600', 
                color: '#000000', 
                marginBottom: '8px',
                display: 'block',
                width: '100%'
              }} className="profile-badges-title">
                Badges
              </h3>
              <div style={{ position: 'relative', display: 'block', width: '100%' }}>
                <div 
                  ref={badgesContainerRef}
                  className="profile-badges-list"
                  style={{ 
                    display: 'flex',
                    gap: '8px',
                    overflowX: 'auto',
                    paddingBottom: '4px',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    width: '100%'
                  }}
                  onWheel={handleBadgesWheel}
                  onMouseMove={handleBadgesMouseMove}
                >
                  {badges.map((badge) => (
                    <div
                      key={badge.id}
                      className="profile-badge-item"
                      style={{ 
                        position: 'relative',
                        flexShrink: 0,
                        cursor: 'pointer'
                      }}
                      title={badge.name || 'Badge'}
                    >
                      <img
                        src={badge.url}
                        alt={badge.name || 'Badge'}
                        className="profile-badge-image"
                        style={{ 
                          height: '32px',
                          minWidth: '32px',
                          maxWidth: '64px',
                          width: 'auto',
                          borderRadius: '4px',
                          objectFit: 'cover',
                          transition: 'transform 0.2s',
                          imageRendering: isGifUrl(badge.url) ? 'auto' : 'auto'
                        }}
                        onError={handleBadgeError}
                      />
                      
                      {/* Tooltip */}
                      {badge.name && (
                        <div 
                          className="profile-badge-tooltip"
                          style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            marginBottom: '8px',
                            padding: '4px 8px',
                            backgroundColor: '#000000',
                            color: '#ffffff',
                            fontSize: '10px',
                            borderRadius: '4px',
                            opacity: 0,
                            transition: 'opacity 0.2s',
                            whiteSpace: 'nowrap',
                            zIndex: 20,
                            pointerEvents: 'none'
                          }}
                        >
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
          <div style={{ 
            fontSize: '10px', 
            color: '#000000', 
            borderTop: '1px solid #1f2937', 
            paddingTop: '12px', 
            marginTop: '12px' 
          }} className="profile-footer">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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

        /* Hide all scrollbars completely */
        ::-webkit-scrollbar {
          display: none;
        }
        
        * {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        /* Badge tooltip hover effect */
        .profile-badge-item:hover .profile-badge-tooltip {
          opacity: 1 !important;
        }

        /* GIF optimization */
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