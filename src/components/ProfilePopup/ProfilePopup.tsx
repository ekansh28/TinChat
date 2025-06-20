// src/components/ProfilePopup/ProfilePopup.tsx - ENHANCED DISCORD-STYLE
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { UserProfile, Badge } from '../ProfileCustomizer/types';

interface ProfilePopupProps {
  isVisible: boolean;
  profile: UserProfile | null;
  badges: Badge[];
  customCSS: string;
  position: { x: number; y: number } | null;
}

function getDefaultAvatar() {
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjNTg2NUY0Ii8+CjxjaXJjbGUgY3g9IjQwIiBjeT0iMzAiIHI9IjE0IiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMjAgNjBDMjAgNTIuMjY4IDI2LjI2OCA0NiAzNCA0NkM0MS43MzIgNDYgNDggNTIuMjY4IDQ4IDYwVjgwSDIwVjYwWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+';
}

const getStatusIndicator = (status: string): { color: string; text: string } => {
  switch (status) {
    case 'online': return { color: 'bg-green-500', text: 'Online' };
    case 'idle': return { color: 'bg-yellow-500', text: 'Idle' };
    case 'dnd': return { color: 'bg-red-500', text: 'Do Not Disturb' };
    case 'offline': return { color: 'bg-gray-500', text: 'Offline' };
    default: return { color: 'bg-gray-500', text: 'Unknown' };
  }
};

const getDisplayNameClass = (animation?: string): string => {
  switch (animation) {
    case 'rainbow': return 'animate-rainbow';
    case 'gradient': return 'animate-gradient';
    case 'pulse': return 'animate-pulse';
    case 'glow': return 'animate-glow';
    default: return '';
  }
};

export function ProfilePopup({
  isVisible,
  profile,
  badges,
  customCSS,
  position
}: ProfilePopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState<{ x: number; y: number } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Calculate optimal position to keep popup in viewport
  useEffect(() => {
    if (!isVisible || !position || !popupRef.current) return;

    const popup = popupRef.current;
    const rect = popup.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let { x, y } = position;
    
    // Adjust horizontal position
    if (x + 320 > viewportWidth) { // 320px is popup width
      x = viewportWidth - 320 - 20; // 20px margin
    }
    if (x < 20) {
      x = 20;
    }
    
    // Adjust vertical position
    if (y + 400 > viewportHeight) { // Approximate popup height
      y = position.y - 400 - 10; // Show above click point
    }
    if (y < 20) {
      y = 20;
    }
    
    setAdjustedPosition({ x, y });
  }, [isVisible, position]);

  // Handle animation
  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!isVisible || !profile || !adjustedPosition) return null;

  const statusInfo = getStatusIndicator(profile.status || 'offline');

  return (
    <>
      {/* Inject custom CSS if provided */}
      {customCSS && (
        <style dangerouslySetInnerHTML={{ __html: customCSS }} />
      )}
      
      <div 
        ref={popupRef}
        className={cn(
          "fixed z-[1050] profile-popup-custom",
          isAnimating && "animate-popup-enter"
        )}
        style={{
          top: `${adjustedPosition.y}px`,
          left: `${adjustedPosition.x}px`,
          width: '300px',
          maxWidth: '90vw'
        }}
      >
        <div className={cn(
          "profile-card-custom relative bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden",
          "transform transition-all duration-200 ease-out"
        )}>
          {/* Banner Section */}
          <div className="relative h-20 bg-gradient-to-r from-blue-400 to-purple-500 overflow-hidden">
            {profile.banner_url ? (
              <img
                src={profile.banner_url}
                alt="Profile Banner"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-blue-400 to-purple-500" />
            )}
            
            {/* Overlay for better text readability */}
            <div className="absolute inset-0 bg-black bg-opacity-20" />
          </div>

          {/* Main Content */}
          <div className="px-4 pb-4 -mt-8 relative z-10">
            {/* Avatar */}
            <div className="flex items-end justify-between mb-3">
              <div className="relative">
                <img
                  src={profile.avatar_url || getDefaultAvatar()}
                  alt="Profile Avatar"
                  className="w-16 h-16 rounded-full border-4 border-white dark:border-gray-800 object-cover shadow-lg"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = getDefaultAvatar();
                  }}
                />
                
                {/* Status indicator */}
                <div className="absolute -bottom-1 -right-1 flex items-center justify-center">
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 border-white dark:border-gray-800",
                    statusInfo.color
                  )} />
                </div>
              </div>
            </div>

            {/* User Info */}
            <div className="mb-3">
              {/* Display Name */}
              <h2
                className={cn(
                  "text-xl font-bold mb-1",
                  getDisplayNameClass(profile.display_name_animation)
                )}
                style={{
                  color: profile.display_name_color || undefined,
                  animationDuration: profile.display_name_animation === 'rainbow' ? 
                    `${profile.rainbow_speed || 3}s` : undefined
                }}
              >
                {profile.display_name || profile.username || 'Unknown User'}
              </h2>
              
              {/* Username (if different from display name) */}
              {profile.display_name && 
               profile.username && 
               profile.display_name !== profile.username && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  @{profile.username}
                </p>
              )}

              {/* Pronouns */}
              {profile.pronouns && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {profile.pronouns}
                </p>
              )}

              {/* Status */}
              <div className="flex items-center gap-2 text-sm">
                <div className={cn("w-3 h-3 rounded-full", statusInfo.color)} />
                <span className="text-gray-700 dark:text-gray-300 capitalize">
                  {statusInfo.text}
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-gray-200 dark:bg-gray-600 mb-3" />

            {/* Bio Section */}
            {profile.bio && (
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  About Me
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-4 border-blue-500">
                  {profile.bio}
                </p>
              </div>
            )}

            {/* Badges Section */}
            {badges.length > 0 && (
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  Badges ({badges.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {badges.slice(0, 8).map((badge) => ( // Limit to 8 badges for popup
                    <div
                      key={badge.id}
                      className="relative group"
                      title={badge.name || 'Badge'}
                    >
                      <img
                        src={badge.url}
                        alt={badge.name || 'Badge'}
                        className="w-8 h-8 rounded object-cover border border-gray-200 dark:border-gray-600 hover:scale-110 transition-transform duration-200"
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
                  
                  {badges.length > 8 && (
                    <div className="w-8 h-8 rounded border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-600 flex items-center justify-center">
                      <span className="text-xs text-gray-600 dark:text-gray-400 font-semibold">
                        +{badges.length - 8}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Profile Info Footer */}
            <div className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-600 pt-3 mt-3">
              <div className="flex items-center justify-between">
                <span>User Profile</span>
                {profile.updated_at && (
                  <span title="Last updated">
                    Updated {new Date(profile.updated_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Close button (top right) */}
          <button
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black bg-opacity-50 hover:bg-opacity-70 text-white text-xs flex items-center justify-center transition-all duration-200 z-20"
            onClick={() => {
              // The parent component should handle closing
              const event = new CustomEvent('closeProfilePopup');
              window.dispatchEvent(event);
            }}
            title="Close profile"
          >
            ×
          </button>
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

        @keyframes popup-enter {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(-8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .animate-rainbow {
          animation: rainbow 3s linear infinite;
        }

        .animate-gradient {
          animation: gradient 4s ease-in-out infinite;
        }

        .animate-glow {
          animation: glow 2s ease-in-out infinite alternate;
        }

        .animate-popup-enter {
          animation: popup-enter 200ms ease-out;
        }

        /* Custom scrollbar for content areas */
        .profile-card-custom ::-webkit-scrollbar {
          width: 4px;
        }

        .profile-card-custom ::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 2px;
        }

        .profile-card-custom ::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 2px;
        }

        .profile-card-custom ::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.5);
        }

        /* Ensure custom CSS is applied */
        .profile-card-custom {
          /* Default styles that can be overridden by custom CSS */
        }

        /* Mobile responsive adjustments */
        @media (max-width: 768px) {
          .profile-popup-custom {
            width: calc(100vw - 40px) !important;
            max-width: 280px !important;
          }
        }

        /* High contrast mode support */
        @media (prefers-contrast: high) {
          .profile-card-custom {
            border-width: 2px;
          }
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          .animate-rainbow,
          .animate-gradient,
          .animate-glow,
          .animate-popup-enter {
            animation: none;
          }
          
          .profile-card-custom * {
            transition: none;
          }
        }
      `}</style>
    </>
  );
}