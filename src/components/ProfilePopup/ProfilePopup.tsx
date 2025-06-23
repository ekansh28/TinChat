// src/components/ProfilePopup/ProfilePopup.tsx - WITH ADD FRIEND AND BLOCK USER
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { UserProfile, Badge } from '../ProfileCustomizer/types';

interface ProfilePopupProps {
  isVisible: boolean;
  profile: UserProfile | null;
  badges: Badge[];
  customCSS: string;
  position: { x: number; y: number } | null;
  currentUserAuthId?: string; // For friendship operations
}

interface FriendshipStatus {
  status: 'none' | 'friends' | 'pending_sent' | 'pending_received' | 'blocked' | 'blocked_by';
  since?: string;
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
  position,
  currentUserAuthId
}: ProfilePopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState<{ x: number; y: number } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus>({ status: 'none' });
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ✅ Check if this is the current user's own profile
  const isOwnProfile = currentUserAuthId && profile?.id === currentUserAuthId;

  // ✅ Ensure component is mounted before state updates
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // ✅ Load friendship status when profile changes
  useEffect(() => {
    if (!isMounted || !profile?.id || !currentUserAuthId || isOwnProfile) {
      return;
    }

    const loadFriendshipStatus = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/friends/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user1AuthId: currentUserAuthId,
            user2AuthId: profile.id
          })
        });

        const data = await response.json();
        if (data.success && isMounted) {
          setFriendshipStatus(data.status);
        }
      } catch (error) {
        console.error('Failed to load friendship status:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadFriendshipStatus();
  }, [isMounted, profile?.id, currentUserAuthId, isOwnProfile]);

  // ✅ Calculate position only after mounting
  useEffect(() => {
    if (!isMounted || !isVisible || !position) {
      if (isMounted) {
        setAdjustedPosition(null);
      }
      return;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    const popupWidth = 300;
    const popupHeight = 450; // Increased for new buttons
    
    let { x, y } = position;
    
    if (x + popupWidth > viewportWidth) {
      x = Math.max(20, viewportWidth - popupWidth - 20);
    }
    if (x < 20) {
      x = 20;
    }
    
    if (y + popupHeight > viewportHeight) {
      y = Math.max(20, position.y - popupHeight - 10);
    }
    if (y < 20) {
      y = 20;
    }
    
    if (isMounted) {
      setAdjustedPosition({ x, y });
    }
  }, [isMounted, isVisible, position]);

  // ✅ Handle animation only after mounting
  useEffect(() => {
    if (!isMounted) return;
    
    if (isVisible) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        if (isMounted) {
          setIsAnimating(false);
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isMounted, isVisible]);

  // ✅ Close context menu when clicking outside
  useEffect(() => {
    if (!showContextMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.context-menu') && !target.closest('.context-menu-trigger')) {
        setShowContextMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showContextMenu]);

  // ✅ Friend action handlers
  const handleSendFriendRequest = useCallback(async () => {
    if (!profile?.id || !currentUserAuthId) return;

    setActionLoading('add_friend');
    try {
      const response = await fetch('/api/friends/send-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderAuthId: currentUserAuthId,
          receiverAuthId: profile.id
        })
      });

      const data = await response.json();
      if (data.success) {
        setFriendshipStatus({ 
          status: data.autoAccepted ? 'friends' : 'pending_sent' 
        });
        
        // Show success message
        console.log('Friend request sent successfully');
      } else {
        console.error('Failed to send friend request:', data.message);
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
    } finally {
      setActionLoading(null);
    }
  }, [profile?.id, currentUserAuthId]);

  const handleRemoveFriend = useCallback(async () => {
    if (!profile?.id || !currentUserAuthId) return;

    setActionLoading('remove_friend');
    try {
      const response = await fetch('/api/friends/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user1AuthId: currentUserAuthId,
          user2AuthId: profile.id
        })
      });

      const data = await response.json();
      if (data.success) {
        setFriendshipStatus({ status: 'none' });
        console.log('Friend removed successfully');
      } else {
        console.error('Failed to remove friend:', data.message);
      }
    } catch (error) {
      console.error('Error removing friend:', error);
    } finally {
      setActionLoading(null);
    }
  }, [profile?.id, currentUserAuthId]);

  const handleBlockUser = useCallback(async () => {
    if (!profile?.id || !currentUserAuthId) return;

    setActionLoading('block_user');
    setShowContextMenu(false);
    
    try {
      const response = await fetch('/api/friends/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockerAuthId: currentUserAuthId,
          blockedAuthId: profile.id
        })
      });

      const data = await response.json();
      if (data.success) {
        setFriendshipStatus({ status: 'blocked' });
        console.log('User blocked successfully');
      } else {
        console.error('Failed to block user:', data.message);
      }
    } catch (error) {
      console.error('Error blocking user:', error);
    } finally {
      setActionLoading(null);
    }
  }, [profile?.id, currentUserAuthId]);

  const handleUnblockUser = useCallback(async () => {
    if (!profile?.id || !currentUserAuthId) return;

    setActionLoading('unblock_user');
    try {
      const response = await fetch('/api/friends/unblock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockerAuthId: currentUserAuthId,
          blockedAuthId: profile.id
        })
      });

      const data = await response.json();
      if (data.success) {
        setFriendshipStatus({ status: 'none' });
        console.log('User unblocked successfully');
      } else {
        console.error('Failed to unblock user:', data.message);
      }
    } catch (error) {
      console.error('Error unblocking user:', error);
    } finally {
      setActionLoading(null);
    }
  }, [profile?.id, currentUserAuthId]);

  // ✅ Get button text and action based on friendship status
  const getFriendButtonConfig = () => {
    if (isLoading) return { text: 'Loading...', action: null, disabled: true };

    switch (friendshipStatus.status) {
      case 'friends':
        return { 
          text: '✓ Friends', 
          action: handleRemoveFriend, 
          disabled: false,
          variant: 'success'
        };
      case 'pending_sent':
        return { 
          text: 'Request Sent', 
          action: null, 
          disabled: true,
          variant: 'pending'
        };
      case 'pending_received':
        return { 
          text: 'Accept Request', 
          action: () => {}, // TODO: Implement accept request
          disabled: false,
          variant: 'primary'
        };
      case 'blocked':
        return { 
          text: 'Unblock User', 
          action: handleUnblockUser, 
          disabled: false,
          variant: 'danger'
        };
      case 'blocked_by':
        return { 
          text: 'Blocked by User', 
          action: null, 
          disabled: true,
          variant: 'disabled'
        };
      default:
        return { 
          text: '+ Add Friend', 
          action: handleSendFriendRequest, 
          disabled: false,
          variant: 'primary'
        };
    }
  };

  if (!isMounted || !isVisible || !profile || !adjustedPosition) {
    return null;
  }

  const statusInfo = getStatusIndicator(profile.status || 'offline');
  const buttonConfig = getFriendButtonConfig();

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
            
            <div className="absolute inset-0 bg-black bg-opacity-20" />

            {/* ✅ Context Menu Button (Top Right) */}
            {!isOwnProfile && (
              <div className="absolute top-2 right-2">
                <button
                  onClick={() => setShowContextMenu(!showContextMenu)}
                  className="context-menu-trigger w-8 h-8 rounded-full bg-black bg-opacity-30 hover:bg-opacity-50 flex items-center justify-center text-white transition-all duration-200"
                  title="More options"
                >
                  <span className="text-lg font-bold leading-none">⋯</span>
                </button>

                {/* Context Menu */}
                {showContextMenu && (
                  <div className="context-menu absolute top-10 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[120px] z-10">
                    <button
                      onClick={handleBlockUser}
                      disabled={actionLoading === 'block_user'}
                      className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 dark:hover:bg-opacity-20 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading === 'block_user' ? 'Blocking...' : '🚫 Block User'}
                    </button>
                  </div>
                )}
              </div>
            )}
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

            {/* ✅ Action Buttons Section (only for other users) */}
            {!isOwnProfile && (
              <div className="mb-3 space-y-2">
                {/* Add Friend / Friend Status Button */}
                <button
                  onClick={buttonConfig.action || undefined}
                  disabled={buttonConfig.disabled || actionLoading === 'add_friend' || actionLoading === 'remove_friend'}
                  className={cn(
                    "w-full py-2 px-4 rounded-lg font-medium text-sm transition-all duration-200",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    {
                      'bg-blue-500 hover:bg-blue-600 text-white': buttonConfig.variant === 'primary',
                      'bg-green-500 hover:bg-green-600 text-white': buttonConfig.variant === 'success',
                      'bg-yellow-500 hover:bg-yellow-600 text-white': buttonConfig.variant === 'pending',
                      'bg-red-500 hover:bg-red-600 text-white': buttonConfig.variant === 'danger',
                      'bg-gray-300 text-gray-500 cursor-not-allowed': buttonConfig.variant === 'disabled',
                    }
                  )}
                >
                  {(actionLoading === 'add_friend' || actionLoading === 'remove_friend') ? 
                    'Loading...' : buttonConfig.text}
                </button>

                {/* Message Button (placeholder for future implementation) */}
                <button
                  className="w-full py-2 px-4 rounded-lg font-medium text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
                  disabled
                >
                  💬 Send Message
                </button>
              </div>
            )}

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
                  {badges.slice(0, 8).map((badge) => (
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

        /* Mobile responsive adjustments */
        @media (max-width: 768px) {
          .profile-popup-custom {
            width: calc(100vw - 40px) !important;
            max-width: 280px !important;
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