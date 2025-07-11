// src/components/ProfilePopup/ProfilePopup.tsx - FIXED TypeScript Errors
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { UserProfile, Badge } from '../ProfileCustomizer/types';

interface ProfilePopupProps {
  isVisible: boolean;
  userId: string | any | null;
  position: { x: number; y: number } | null;
  currentUserAuthId?: string;
}

interface FriendshipStatus {
  status: 'none' | 'friends' | 'pending_sent' | 'pending_received' | 'blocked' | 'blocked_by';
  since?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:3001';

function getDefaultAvatar() {
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjNTg2NUY0Ii8+CjxjaXJjbGUgY3g9IjQwIiBjeT0iMzAiIHI9IjE0IiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMjAgNjBDMjAgNTIuMjY4IDI2LjI2OCA0NiAzNCA0NkM0MS43MzIgNDYgNDggNTIuMjY4IDQ4IDYwVjgwSDIwVjYwWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+';
}

// ✅ Check if URL is a GIF
const isGifUrl = (url: string): boolean => {
  if (!url) return false;
  const cleanUrl = url.toLowerCase().split('?')[0];
  return cleanUrl.endsWith('.gif') || url.includes('data:image/gif');
};

const getStatusIndicator = (status: string, isOnline?: boolean): { color: string; text: string } => {
  if (isOnline !== undefined) {
    return isOnline 
      ? { color: 'bg-green-500', text: 'Online' }
      : { color: 'bg-gray-500', text: 'Offline' };
  }
  
  switch (status) {
    case 'online': return { color: 'bg-green-500', text: 'Online' };
    case 'idle': return { color: 'bg-yellow-500', text: 'Idle' };
    case 'dnd': return { color: 'bg-red-500', text: 'Do Not Disturb' };
    case 'offline': return { color: 'bg-gray-500', text: 'Offline' };
    default: return { color: 'bg-gray-500', text: 'Unknown' };
  }
};

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

export function ProfilePopup({
  isVisible,
  userId,
  position,
  currentUserAuthId
}: ProfilePopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const badgesContainerRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState<{ x: number; y: number } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus>({ status: 'none' });
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Profile data state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [customCSS, setCustomCSS] = useState<string>('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const isOwnProfile = currentUserAuthId && profile?.clerk_id === currentUserAuthId;

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Load profile data from API
  useEffect(() => {
    if (!isMounted || !userId || !isVisible) {
      return;
    }

    const loadProfileData = async () => {
      setProfileLoading(true);
      setProfileError(null);
      
      try {
        console.log('🔍 Loading profile data from API for user:', userId);

        let clerkUserId: string;
        if (typeof userId === 'string') {
          clerkUserId = userId;
        } else if (userId && typeof userId === 'object' && userId.clerk_id) {
          clerkUserId = userId.clerk_id;
        } else if (userId && typeof userId === 'object' && userId.id) {
          clerkUserId = userId.id;
        } else {
          throw new Error('Invalid user ID format');
        }

        const response = await fetch('/api/profile/load', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clerkUserId: clerkUserId
          })
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to load profile');
        }

        const profileData = result.data;

        if (!profileData) {
          const minimalProfile: UserProfile = {
            id: clerkUserId,
            clerk_id: clerkUserId,
            username: clerkUserId,
            display_name: clerkUserId,
            avatar_url: '',
            banner_url: '',
            pronouns: '',
            bio: '',
            status: 'offline',
            display_name_color: '#000000',
            display_name_animation: 'none',
            rainbow_speed: 3,
            badges: [],
            profile_card_css: '',
            created_at: new Date().toISOString(),
            is_online: false,
            last_seen: undefined
          };
          
          setProfile(minimalProfile);
          setBadges([]);
          setCustomCSS('');
          return;
        }

        let processedBadges: Badge[] = [];
        if (profileData.badges) {
          try {
            if (Array.isArray(profileData.badges)) {
              processedBadges = profileData.badges;
            } else if (typeof profileData.badges === 'string') {
              processedBadges = JSON.parse(profileData.badges);
            }

            processedBadges = processedBadges.filter(badge => {
              return badge && 
                typeof badge === 'object' && 
                badge.id && 
                badge.url &&
                typeof badge.id === 'string' &&
                typeof badge.url === 'string';
            });
          } catch (e) {
            console.error('Failed to process badges from API:', e);
            processedBadges = [];
          }
        }

        const profileFromAPI: UserProfile = {
          id: profileData.id,
          clerk_id: profileData.clerk_id,
          username: profileData.username || profileData.clerk_id,
          display_name: profileData.display_name || profileData.username || profileData.clerk_id,
          avatar_url: profileData.avatar_url || '',
          banner_url: profileData.banner_url || '',
          pronouns: profileData.pronouns || '',
          bio: profileData.bio || '',
          status: profileData.status || 'offline',
          display_name_color: profileData.display_name_color || '#000000',
          display_name_animation: profileData.display_name_animation || 'none',
          rainbow_speed: profileData.rainbow_speed || 3,
          badges: processedBadges,
          profile_card_css: profileData.profile_card_css || '',
          created_at: profileData.created_at,
          updated_at: profileData.updated_at,
          is_online: profileData.is_online || false,
          last_seen: profileData.last_seen || undefined
        };
        
        setProfile(profileFromAPI);
        setBadges(processedBadges);
        setCustomCSS(profileFromAPI.profile_card_css || '');
        
      } catch (error) {
        console.error('Failed to load profile data from API:', error);
        
        const userIdStr = typeof userId === 'string' ? userId : (userId as any)?.id || 'unknown';
        const errorProfile: UserProfile = {
          id: userIdStr,
          clerk_id: userIdStr,
          username: userIdStr,
          display_name: userIdStr,
          avatar_url: '',
          banner_url: '',
          pronouns: '',
          bio: '',
          status: 'offline',
          display_name_color: '#ff0000',
          display_name_animation: 'none',
          rainbow_speed: 3,
          badges: [],
          profile_card_css: '',
          created_at: new Date().toISOString(),
          is_online: false,
          last_seen: undefined
        };
        
        setProfile(errorProfile);
        setBadges([]);
        setCustomCSS('');
        setProfileError(error instanceof Error ? error.message : 'Failed to load profile');
      } finally {
        if (isMounted) {
          setProfileLoading(false);
        }
      }
    };

    loadProfileData();
  }, [isMounted, userId, isVisible]);

  // Load friendship status
  useEffect(() => {
    if (!isMounted || !profile?.clerk_id || !currentUserAuthId || isOwnProfile) {
      return;
    }

    const loadFriendshipStatus = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/friends/status`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            user1AuthId: currentUserAuthId,
            user2AuthId: profile.clerk_id
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

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
  }, [isMounted, profile?.clerk_id, currentUserAuthId, isOwnProfile]);

  // Position calculation - Updated for smaller popup
  useEffect(() => {
    if (!isMounted || !isVisible || !position) {
      setAdjustedPosition(null);
      return;
    }

    const POPUP_WIDTH = 300;
    const POPUP_HEIGHT = 400;
    const OFFSET = 10;
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let x = typeof position.x === 'number' && !isNaN(position.x) ? position.x : 100;
    let y = typeof position.y === 'number' && !isNaN(position.y) ? position.y : 100;
    
    x += OFFSET;
    y += OFFSET;
    
    const MARGIN = 20;
    
    if (x + POPUP_WIDTH > viewportWidth - MARGIN) {
      x = Math.max(MARGIN, x - POPUP_WIDTH - OFFSET * 2);
    }
    
    if (y + POPUP_HEIGHT > viewportHeight - MARGIN) {
      y = Math.max(MARGIN, y - POPUP_HEIGHT - OFFSET * 2);
    }
    
    if (x < MARGIN) {
      x = MARGIN;
    }
    
    if (y < MARGIN) {
      y = MARGIN;
    }
    
    const finalX = Math.max(0, Math.min(x, viewportWidth - POPUP_WIDTH));
    const finalY = Math.max(0, Math.min(y, viewportHeight - POPUP_HEIGHT));
    
    if (isNaN(finalX) || isNaN(finalY)) {
      setAdjustedPosition({ x: 100, y: 100 });
      return;
    }
    
    setAdjustedPosition({ x: finalX, y: finalY });
  }, [isMounted, isVisible, position]);

  // Handle animation
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

  // Close context menu when clicking outside
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

  // Friend action handlers
  const handleSendFriendRequest = useCallback(async () => {
    if (!profile?.clerk_id || !currentUserAuthId) return;

    setActionLoading('add_friend');
    try {
      const response = await fetch(`${API_BASE_URL}/api/friends/send-request`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          senderAuthId: currentUserAuthId,
          receiverAuthId: profile.clerk_id
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setFriendshipStatus({ 
          status: data.autoAccepted ? 'friends' : 'pending_sent' 
        });
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
    } finally {
      setActionLoading(null);
    }
  }, [profile?.clerk_id, currentUserAuthId]);

  const handleRemoveFriend = useCallback(async () => {
    if (!profile?.clerk_id || !currentUserAuthId) return;

    setActionLoading('remove_friend');
    try {
      const response = await fetch(`${API_BASE_URL}/api/friends/remove`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          user1AuthId: currentUserAuthId,
          user2AuthId: profile.clerk_id
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        setFriendshipStatus({ status: 'none' });
      }
    } catch (error) {
      console.error('Error removing friend:', error);
    } finally {
      setActionLoading(null);
    }
  }, [profile?.clerk_id, currentUserAuthId]);

  const handleBlockUser = useCallback(async () => {
    if (!profile?.clerk_id || !currentUserAuthId) return;

    setActionLoading('block_user');
    setShowContextMenu(false);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/friends/block`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          blockerAuthId: currentUserAuthId,
          blockedAuthId: profile.clerk_id
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        setFriendshipStatus({ status: 'blocked' });
      }
    } catch (error) {
      console.error('Error blocking user:', error);
    } finally {
      setActionLoading(null);
    }
  }, [profile?.clerk_id, currentUserAuthId]);

  const handleUnblockUser = useCallback(async () => {
    if (!profile?.clerk_id || !currentUserAuthId) return;

    setActionLoading('unblock_user');
    try {
      const response = await fetch(`${API_BASE_URL}/api/friends/unblock`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          blockerAuthId: currentUserAuthId,
          blockedAuthId: profile.clerk_id
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        setFriendshipStatus({ status: 'none' });
      }
    } catch (error) {
      console.error('Error unblocking user:', error);
    } finally {
      setActionLoading(null);
    }
  }, [profile?.clerk_id, currentUserAuthId]);

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

  // Get button text and action based on friendship status
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
          action: () => {}, 
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
          text: '', 
          action: handleSendFriendRequest, 
          disabled: false,
          variant: 'primary'
        };
    }
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

  if (!isMounted || !isVisible || !profile || !adjustedPosition) {
    return null;
  }

  const statusInfo = getStatusIndicator(profile.status || 'offline', profile.is_online);
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
          maxWidth: '95vw',
          minHeight: '350px'
        }}
      >
        <div className={cn(
          "profile-card-custom relative bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden",
          "transform transition-all duration-200 ease-out"
        )}>
          {/* Main Content - Above banner */}
          <div className="px-4 pt-4 pb-4 relative z-10">
            {/* Avatar */}
            <div className="mb-3">
              <div className="relative w-16 h-16">
                <img
                  src={profile.avatar_url || getDefaultAvatar()}
                  alt="Profile Avatar"
                  className="w-16 h-16 rounded-full border-4 border-white dark:border-gray-800 object-cover shadow-lg"
                  style={{
                    imageRendering: isGifUrl(profile.avatar_url || '') ? 'auto' : 'auto'
                  }}
                  onError={handleAvatarError}
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

            {/* Display name and pronouns */}
            <div className="mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 style={getDisplayNameStyle(profile.display_name_animation, profile.display_name_color, profile.rainbow_speed)}>
                  {profile.display_name || profile.username || profile.id || 'Unknown User'}
                </h2>
                {profile.pronouns && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    - {profile.pronouns}
                  </span>
                )}
              </div>
            </div>

            {/* Username */}
            {profile.display_name && 
             profile.username && 
             profile.display_name !== profile.username && (
              <div className="mb-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  @{profile.username}
                </p>
              </div>
            )}
            
            {(!profile.display_name && profile.username) && (
              <div className="mb-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  @{profile.username}
                </p>
              </div>
            )}

            {/* Action Buttons Section */}
            {!isOwnProfile && (
              <div className="mb-3 space-y-2">
                <button
                  onClick={buttonConfig.action || undefined}
                  disabled={buttonConfig.disabled || actionLoading === 'add_friend' || actionLoading === 'remove_friend'}
                  className={cn(
                    "transition-all duration-200 flex items-center justify-center",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    {
                      'w-10 h-10 rounded-lg bg-blue-500 hover:bg-blue-600 text-white': buttonConfig.variant === 'primary',
                      'w-full py-2 px-4 rounded-lg font-medium text-sm bg-green-500 hover:bg-green-600 text-white': buttonConfig.variant === 'success',
                      'w-full py-2 px-4 rounded-lg font-medium text-sm bg-yellow-500 hover:bg-yellow-600 text-white': buttonConfig.variant === 'pending',
                      'w-full py-2 px-4 rounded-lg font-medium text-sm bg-red-500 hover:bg-red-600 text-white': buttonConfig.variant === 'danger',
                      'w-full py-2 px-4 rounded-lg font-medium text-sm bg-gray-300 text-gray-500 cursor-not-allowed': buttonConfig.variant === 'disabled',
                    }
                  )}
                  title={buttonConfig.variant === 'primary' ? 'Add Friend' : undefined}
                >
                  {(actionLoading === 'add_friend' || actionLoading === 'remove_friend') ? (
                    buttonConfig.variant === 'primary' ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      'Loading...'
                    )
                  ) : buttonConfig.variant === 'primary' ? (
                    <img 
                      src="https://cdn.sekansh21.workers.dev/icons/addfriend.svg" 
                      alt="Add Friend" 
                      className="w-5 h-5"
                    />
                  ) : (
                    buttonConfig.text
                  )}
                </button>

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
            {profile.bio && profile.bio.trim() && (
              <div className="mb-3">
                <div 
                  className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-4 border-blue-500 break-words"
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
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  Badges ({badges.length})
                </h3>
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
                    {badges.map((badge) => (
                      <div
                        key={badge.id}
                        className="relative group flex-shrink-0"
                        title={badge.name || 'Badge'}
                      >
                        <img
                          src={badge.url}
                          alt={badge.name || 'Badge'}
                          className="h-8 rounded object-cover transition-transform duration-200"
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

            {/* Profile Info Footer */}
            <div className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-600 pt-3 mt-3">
              <div className="flex items-center justify-between">
                <span>User Profile</span>
                {profile.created_at && (
                  <span title="Profile created">
                    Joined {new Date(profile.created_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Banner Section - Bottom */}
          <div className="relative overflow-hidden">
            {profile.banner_url ? (
              <img
                src={profile.banner_url}
                alt="Profile Banner"
                className="w-full h-full object-cover"
                style={{
                  width: '100%',
                  height: '140px',
                  imageRendering: isGifUrl(profile.banner_url) ? 'auto' : 'auto'
                }}
                onError={handleBannerError}
              />
            ) : (
              <div 
                className="w-full bg-gradient-to-r from-blue-400 to-purple-500" 
                style={{ width: '100%', height: '140px' }}
              />
            )}
            
            <div className="absolute inset-0 bg-black bg-opacity-20" />

            {/* Context Menu Button */}
            {!isOwnProfile && (
              <div className="absolute top-2 right-2">
                <button
                  onClick={() => setShowContextMenu(!showContextMenu)}
                  className="context-menu-trigger w-6 h-6 flex items-center justify-center text-white hover:text-gray-300 transition-colors duration-200 bg-black bg-opacity-30 hover:bg-opacity-10 rounded"
                  title="More options"
                >
                  <span className="text-sm font-bold leading-none">⋯</span>
                </button>

                {/* Context Menu */}
                {showContextMenu && (
                  <div className="context-menu absolute top-8 right-0 bg-black bg-opacity-10 backdrop-blur-sm rounded-lg shadow-lg border border-black border-opacity-20 py-1 min-w-[120px] z-10">
                    <button
                      onClick={handleBlockUser}
                      disabled={actionLoading === 'block_user'}
                      className="w-full px-3 py-2 text-left text-sm text-white hover:bg-black hover:bg-opacity-20 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading === 'block_user' ? 'Blocking...' : '🚫 Block User'}
                    </button>
                  </div>
                )}
              </div>
            )}
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

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .animate-popup-enter {
          animation: popup-enter 200ms ease-out;
        }

        .animate-spin {
          animation: spin 1s linear infinite;
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
          .profile-popup-custom {
            width: calc(100vw - 40px) !important;
            max-width: 300px !important;
          }
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          .animate-popup-enter,
          .animate-spin {
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