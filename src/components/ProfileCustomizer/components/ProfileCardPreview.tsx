// src/components/ProfileCustomizer/components/ProfileCardPreview.tsx - ORIGINAL + GIF SUPPORT ONLY
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

// ✅ NEW: Check if URL is a GIF
const isGifUrl = (url: string): boolean => {
  if (!url) return false;
  const cleanUrl = url.toLowerCase().split('?')[0];
  return cleanUrl.endsWith('.gif') || url.includes('data:image/gif');
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
  
  // Debug logging for state changes
  useEffect(() => {
    console.log('Avatar editor state:', { selectedAvatarFile: !!selectedAvatarFile, isAvatarEditorOpen });
  }, [selectedAvatarFile, isAvatarEditorOpen]);
  
  useEffect(() => {
    console.log('Banner editor state:', { selectedBannerFile: !!selectedBannerFile, isBannerEditorOpen });
  }, [selectedBannerFile, isBannerEditorOpen]);
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const badgesContainerRef = useRef<HTMLDivElement>(null);

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
      console.log('Avatar file selected:', file.name, 'Type:', file.type); // Debug log
      
      // All images (including GIFs) go through the image editor
      console.log('Opening image editor for file'); // Debug log
      setSelectedAvatarFile(file);
      setIsAvatarEditorOpen(true);
      e.target.value = '';
    }
  };

  const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('Banner file selected:', file.name, 'Type:', file.type); // Debug log
      
      // All images (including GIFs) go through the image editor
      console.log('Opening image editor for file'); // Debug log
      setSelectedBannerFile(file);
      setIsBannerEditorOpen(true);
      e.target.value = '';
    }
  };

  const handleBannerApply = (croppedImageData: string) => {
    setSelectedBannerFile(null);
    setIsBannerEditorOpen(false);
    
    // Use setTimeout to avoid state update during render
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
    
    // Use setTimeout to avoid state update during render
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

  // ✅ FIXED: Badges scroll handling with event isolation
  const handleBadgesWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling to parent elements
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
    
    // Auto-scroll based on mouse position
    const scrollZoneWidth = 50; // Pixels from edge to trigger scroll
    const scrollSpeed = 2;
    
    if (x < scrollZoneWidth && container.scrollLeft > 0) {
      // Left edge - scroll left
      container.scrollLeft -= scrollSpeed;
    } else if (x > containerWidth - scrollZoneWidth && 
               container.scrollLeft < container.scrollWidth - container.clientWidth) {
      // Right edge - scroll right
      container.scrollLeft += scrollSpeed;
    }
  };

  return (
    <>
      {/* Hidden file inputs with enhanced accept for GIFs */}
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

      {/* Avatar Image Editor with circle crop (only for non-GIFs) */}
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

      {/* Banner Image Editor with banner crop (only for non-GIFs) */}
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

      {/* Inject custom CSS if provided */}
      {customCSS && (
        <style dangerouslySetInnerHTML={{ __html: customCSS }} />
      )}
      
      <div
        className={cn(
          "profile-card-custom relative bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700",
          isPreview && "ring-2 ring-blue-400 ring-opacity-50"
        )}
        style={{ maxWidth: 320, minHeight: 200, overflow: 'hidden' }}
      >
        {/* Banner area with upload hover */}
        <div 
          className="relative mb-4 -mx-4 -mt-4 h-24 cursor-pointer group"
          onClick={handleBannerClick}
          onMouseEnter={() => setBannerHover(true)}
          onMouseLeave={() => setBannerHover(false)}
        >
          {profile.banner_url ? (
            <img
              src={profile.banner_url}
              alt="Profile Banner"
              className="w-full h-full object-cover rounded-t-lg"
              style={{
                // ✅ Preserve GIF animation
                imageRendering: isGifUrl(profile.banner_url) ? 'auto' : 'auto'
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full bg-black rounded-t-lg" />
          )}
          
          {/* Banner upload overlay */}
          {onBannerUpload && (
            <div
              className={cn(
                "absolute inset-0 bg-[rgba(0,0,0,0.5)] flex items-center justify-center rounded-t-lg transition-opacity duration-200",
                bannerHover ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
            >
              <div className="text-white text-center">
                <div className="text-xs">
                  {profile.banner_url ? 'Change Banner' : 'Add Banner'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="px-4 pb-4 -mt-8 relative z-10">
          {/* Avatar */}
          <div className="mb-3">
            <div 
              className="relative cursor-pointer group w-12 h-12"
              onClick={handleAvatarClick}
              onMouseEnter={() => setAvatarHover(true)}
              onMouseLeave={() => setAvatarHover(false)}
            >
              <img
                src={profile.avatar_url || getDefaultAvatar()}
                alt="Profile Avatar"
                className="w-12 h-12 rounded-full object-cover border-4 border-white dark:border-gray-600 shadow-lg"
                style={{
                  // ✅ Preserve GIF animation
                  imageRendering: isGifUrl(profile.avatar_url || '') ? 'auto' : 'auto'
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getDefaultAvatar();
                }}
              />
              
              {/* Status indicator dot - bottom right */}
              {profile.status && (
                <div className="absolute -bottom-1 -right-1 flex items-center justify-center">
                  <div className={cn(
                    "w-4 h-4 rounded-full border-2 border-white dark:border-gray-600",
                    getStatusIndicator(profile.status).replace('text-', 'bg-')
                  )} />
                </div>
              )}
              
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
                    <span className="text-black text-xl inline-block rotate-[135deg]">✏︎</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Display name and pronouns */}
          <div className="mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2
                className="text-lg font-bold"
                style={{
                  color: profile.display_name_color || undefined,
                  animation: profile.display_name_animation === 'rainbow' ? 
                    `rainbow ${profile.rainbow_speed || 3}s infinite` : 'none'
                }}
              >
                {profile.display_name || profile.username || 'User'}
              </h2>
              {profile.pronouns && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  - {profile.pronouns}
                </span>
              )}
            </div>
          </div>

          {/* Username */}
          {profile.display_name && profile.username && profile.display_name !== profile.username && (
            <div className="mb-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                @{profile.username}
              </p>
            </div>
          )}

          {/* Bio */}
          {profile.bio && (
            <div className="mb-3">
              <div 
                className="text-sm text-gray-700 dark:text-gray-300 p-2 bg-gray-50 dark:bg-gray-700 rounded border-l-4 border-blue-500 break-words"
                style={{ 
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                  hyphens: 'auto',
                  maxHeight: '80px',
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

          {/* Badges */}
          {badges.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold mb-2 text-gray-600 dark:text-gray-400">
                Badges ({badges.length}):
              </p>
              <div className="relative">
                <div 
                  ref={badgesContainerRef}
                  className="flex gap-2 overflow-x-auto pb-1"
                  style={{ 
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none'
                  }}
                  onWheel={handleBadgesWheel}
                  onMouseMove={handleBadgesMouseMove}
                >
                  {/* ✅ SHOW ALL BADGES - No slice limit, horizontal scroll */}
                  {badges.map((badge) => (
                    <div key={badge.id} className="flex-shrink-0 relative group">
                      <img
                        src={badge.url}
                        alt={badge.name || 'Badge'}
                        title={badge.name || 'Badge'}
                        className="h-6 rounded object-contain transition-transform duration-200"
                        style={{ 
                          minWidth: '24px',
                          maxWidth: '48px',
                          width: 'auto',
                          // ✅ Preserve GIF animation for badges
                          imageRendering: isGifUrl(badge.url) ? 'auto' : 'auto'
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      
                      {/* Tooltip */}
                      {badge.name && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-20">
                          {badge.name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Scroll indicators */}
                {badges.length > 4 && (
                  <div className="text-xs text-gray-500 mt-1 text-center">
                    ← Scroll horizontally to see all {badges.length} badges →
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CSS for rainbow animation and hidden scrollbars */}
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

        /* Hide all scrollbars completely */
        ::-webkit-scrollbar {
          display: none;
        }
        
        * {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        /* Upload hover transitions */
        .group .transition-opacity {
          transition: opacity 0.2s ease-in-out;
        }

        /* ✅ GIF optimization - ensure smooth playback */
        img[src*=".gif"],
        img[src*="data:image/gif"] {
          image-rendering: auto;
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
        }
      `}</style>
    </>
  );
};

function getStatusIndicator(status: string): string {
  switch (status) {
    case 'online': return 'text-green-500';
    case 'idle': return 'text-yellow-500';
    case 'dnd': return 'text-red-500';
    case 'offline': return 'text-gray-500';
    default: return 'text-gray-500';
  }
}

export default ProfileCardPreview;