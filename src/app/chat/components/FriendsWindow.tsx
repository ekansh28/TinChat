// src/app/chat/components/FriendsWindow.tsx - ENHANCED WITH REDIS BACKEND INTEGRATION
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface Friend {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  last_seen: string;
  is_online: boolean;
  friends_since?: string;
  lastMessage?: {
    text: string;
    timestamp: Date;
    isFromSelf: boolean;
  };
}

interface FriendsWindowProps {
  onOpenChat: (friend: Friend) => void;
  onClose: () => void;
  theme: 'win98' | 'win7' | 'winxp';
  currentUserId?: string; // For fetching user's friends
}

const FriendsWindow: React.FC<FriendsWindowProps> = ({
  onOpenChat,
  onClose,
  theme,
  currentUserId
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Slide up animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  // Fetch friends from backend using Redis-cached data
  const fetchFriends = useCallback(async () => {
    if (!currentUserId) {
      setError('No user ID provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Call the backend API that uses ProfileManager's FriendsModule
      const response = await fetch(`/api/friends/${currentUserId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch friends: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Transform backend friend data to match component interface
        const transformedFriends: Friend[] = data.friends.map((friend: any) => ({
          id: friend.id,
          username: friend.username,
          display_name: friend.display_name || friend.username,
          avatar_url: friend.avatar_url,
          status: friend.status || 'offline',
          last_seen: friend.last_seen,
          is_online: friend.is_online || false,
          friends_since: friend.friends_since,
          // TODO: Integrate with chat history for last message
          lastMessage: undefined
        }));

        setFriends(transformedFriends);
        setLastUpdated(new Date());
        console.log(`✅ Loaded ${transformedFriends.length} friends from Redis cache`);
      } else {
        throw new Error(data.message || 'Failed to fetch friends');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('❌ Failed to fetch friends:', errorMessage);
      setError(errorMessage);
      setFriends([]);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  // Fetch online status updates for friends
  const updateOnlineStatus = useCallback(async () => {
    if (!currentUserId || friends.length === 0) return;

    try {
      const friendIds = friends.map(f => f.id);
      
      // Call batch online status API that uses Redis StatusModule
      const response = await fetch('/api/friends/batch-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userIds: friendIds,
          requesterId: currentUserId
        }),
      });

      if (response.ok) {
        const statusData = await response.json();
        
        if (statusData.success) {
          // Update friends with latest online status from Redis
          setFriends(prevFriends => 
            prevFriends.map(friend => ({
              ...friend,
              is_online: statusData.statuses[friend.id]?.isOnline || false,
              last_seen: statusData.statuses[friend.id]?.lastSeen || friend.last_seen,
              status: statusData.statuses[friend.id]?.isOnline ? 'online' : 'offline'
            }))
          );
          
          console.log('🔄 Updated friend online statuses from Redis');
        }
      }
    } catch (err) {
      console.warn('⚠️ Failed to update online status:', err);
      // Don't show error to user for status updates
    }
  }, [currentUserId, friends]);

  // Initial load and periodic refresh
  useEffect(() => {
    fetchFriends();

    // Set up periodic refresh every 30 seconds for online status
    refreshIntervalRef.current = setInterval(() => {
      updateOnlineStatus();
    }, 30000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [fetchFriends, updateOnlineStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  // Sort friends by online status first, then by most recent activity
  const sortedFriends = React.useMemo(() => {
    return [...friends].sort((a, b) => {
      // First: Online friends first
      if (a.is_online !== b.is_online) {
        return a.is_online ? -1 : 1;
      }
      
      // Second: Sort by last message timestamp if available
      const aTime = a.lastMessage?.timestamp?.getTime() || 0;
      const bTime = b.lastMessage?.timestamp?.getTime() || 0;
      
      if (aTime !== bTime) {
        return bTime - aTime; // Most recent first
      }
      
      // Third: Sort by last seen for offline friends
      if (!a.is_online && !b.is_online) {
        const aLastSeen = new Date(a.last_seen).getTime();
        const bLastSeen = new Date(b.last_seen).getTime();
        return bLastSeen - aLastSeen; // Most recently seen first
      }
      
      // Finally: Sort alphabetically by display name
      const aName = a.display_name || a.username;
      const bName = b.display_name || b.username;
      return aName.localeCompare(bName);
    });
  }, [friends]);

  // Get online and offline counts
  const onlineFriends = friends.filter(f => f.is_online);
  const offlineFriends = friends.filter(f => !f.is_online);

  // Format relative time for last seen
  const formatLastSeen = (lastSeenStr: string): string => {
    try {
      const lastSeen = new Date(lastSeenStr);
      const now = new Date();
      const diff = now.getTime() - lastSeen.getTime();
      
      const minutes = Math.floor(diff / (1000 * 60));
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days < 7) return `${days}d ago`;
      
      return lastSeen.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  // Handle friend click
  const handleFriendClick = (friend: Friend) => {
    console.log(`💬 Opening chat with ${friend.display_name || friend.username}`);
    onOpenChat(friend);
  };

  // Handle close button
  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  // Handle refresh button
  const handleRefresh = () => {
    fetchFriends();
  };

  // Get window styles based on theme
  const getWindowStyles = () => {
    const baseStyles = {
      position: 'fixed' as const,
      bottom: isVisible ? '40px' : '-400px',
      right: '20px',
      width: '300px',
      height: '420px',
      zIndex: 6000,
      transition: 'bottom 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    };

    switch (theme) {
      case 'win7':
        return {
          ...baseStyles,
          background: 'rgba(240, 240, 240, 0.98)',
          border: '1px solid #999',
          borderRadius: '8px',
          backdropFilter: 'blur(10px)',
          bottom: isVisible ? '45px' : '-400px',
        };
      case 'winxp':
        return {
          ...baseStyles,
          background: '#ece9d8',
          border: '1px solid #0054e3',
          borderRadius: '8px 8px 0 0',
          bottom: isVisible ? '35px' : '-400px',
        };
      default: // win98
        return {
          ...baseStyles,
          background: '#c0c0c0',
          border: '3px outset #c0c0c0',
          bottom: isVisible ? '37px' : '-400px',
        };
    }
  };

  // Get title bar styles
  const getTitleBarStyles = () => {
    switch (theme) {
      case 'win7':
        return {
          height: '32px',
          background: 'linear-gradient(to bottom, #f0f0f0, #e0e0e0)',
          borderBottom: '1px solid #ccc',
          borderTopLeftRadius: '6px',
          borderTopRightRadius: '6px',
          color: '#333',
        };
      case 'winxp':
        return {
          height: '28px',
          background: 'linear-gradient(to bottom, #0054e3, #0040b3)',
          color: '#fff',
          borderTopLeftRadius: '6px',
          borderTopRightRadius: '6px',
        };
      default: // win98
        return {
          height: '26px',
          background: '#c0c0c0',
          color: '#000',
        };
    }
  };

  // Get body styles
  const getBodyStyles = () => {
    switch (theme) {
      case 'win7':
        return {
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(5px)',
          color: '#333',
          borderBottomLeftRadius: '6px',
          borderBottomRightRadius: '6px',
        };
      case 'winxp':
        return {
          background: '#ece9d8',
          color: '#000',
        };
      default: // win98
        return {
          background: '#c0c0c0',
          color: '#000',
        };
    }
  };

  // Get status indicator color
  const getStatusColor = (status: string, isOnline: boolean) => {
    if (!isOnline) return '#9E9E9E';
    
    switch (status) {
      case 'online': return '#4CAF50';
      case 'idle': return '#FFC107';
      case 'dnd': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  // Get status text
  const getStatusText = (status: string, isOnline: boolean) => {
    if (!isOnline) return 'Offline';
    
    switch (status) {
      case 'online': return 'Online';
      case 'idle': return 'Away';
      case 'dnd': return 'Busy';
      default: return 'Offline';
    }
  };

  return (
    <div 
      ref={windowRef}
      className={cn(
        "window friends-window",
        theme === 'win7' && "glass active",
        theme === 'winxp' && "xp-window"
      )}
      style={getWindowStyles()}
    >
      {/* Title Bar */}
      <div 
        className={cn(
          "title-bar",
          theme === 'win7' && "glass-title-bar",
          theme === 'winxp' && "xp-title-bar"
        )}
        style={{
          ...getTitleBarStyles(),
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          flexShrink: 0,
        }}
      >
        <div className="title-bar-text" style={{ 
          flexGrow: 1,
          fontSize: '12px',
          fontWeight: theme === 'winxp' ? 'bold' : 'normal',
          fontFamily: theme === 'winxp' ? 'Tahoma, sans-serif' : undefined,
        }}>
          Friends ({onlineFriends.length}/{friends.length})
        </div>
        
        <div className="title-bar-controls" style={{ display: 'flex', gap: '4px' }}>
          {/* Refresh Button */}
          <button 
            onClick={handleRefresh}
            disabled={loading}
            style={{
              width: '20px',
              height: '20px',
              border: theme === 'win98' ? '1px outset #c0c0c0' : '1px solid #999',
              background: theme === 'win98' ? '#c0c0c0' : '#f0f0f0',
              color: theme === 'win98' ? '#000' : '#333',
              fontSize: '10px',
              cursor: loading ? 'not-allowed' : 'pointer',
              borderRadius: theme === 'win98' ? '0' : '3px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: loading ? 0.6 : 1,
            }}
            title="Refresh friends list"
          >
            ↻
          </button>
          
          {/* Close Button */}
          <button 
            onClick={handleClose}
            style={{
              width: '20px',
              height: '20px',
              border: theme === 'win98' ? '1px outset #c0c0c0' : '1px solid #999',
              background: theme === 'win98' ? '#c0c0c0' : '#ff6b6b',
              color: theme === 'win98' ? '#000' : '#fff',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              borderRadius: theme === 'win98' ? '0' : '3px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Window Body */}
      <div 
        className={cn(
          "window-body friends-body",
          theme === 'win7' && "glass-body",
          theme === 'winxp' && "xp-body"
        )}
        style={{
          ...getBodyStyles(),
          height: 'calc(100% - 32px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Status Header */}
        <div style={{ 
          padding: '10px',
          borderBottom: theme === 'win98' ? '1px inset #c0c0c0' : '1px solid #ddd',
          flexShrink: 0,
        }}>
          <div style={{ 
            fontSize: '11px',
            color: theme === 'win7' ? '#666' : theme === 'winxp' ? '#333' : '#000',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>
              {loading ? 'Loading friends...' : 'Click a friend to start chatting'}
            </span>
            {lastUpdated && (
              <span style={{ fontSize: '9px', opacity: 0.7 }}>
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
          
          {error && (
            <div style={{
              fontSize: '10px',
              color: '#d32f2f',
              marginTop: '4px',
              padding: '4px',
              background: 'rgba(255, 0, 0, 0.1)',
              borderRadius: theme === 'win98' ? '0' : '3px',
            }}>
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Friends List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px',
        }}>
          {loading ? (
            <div style={{
              textAlign: 'center',
              padding: '30px 20px',
              color: theme === 'win7' ? '#666' : theme === 'winxp' ? '#333' : '#000',
              fontSize: '11px',
            }}>
              <div>🔄 Loading friends from cache...</div>
            </div>
          ) : error ? (
            <div style={{
              textAlign: 'center',
              padding: '30px 20px',
              color: '#d32f2f',
              fontSize: '11px',
            }}>
              <div>❌ Failed to load friends</div>
              <button 
                onClick={handleRefresh}
                style={{
                  marginTop: '10px',
                  padding: '4px 8px',
                  border: theme === 'win98' ? '1px outset #c0c0c0' : '1px solid #999',
                  background: theme === 'win98' ? '#c0c0c0' : '#f0f0f0',
                  cursor: 'pointer',
                  fontSize: '10px',
                }}
              >
                Try Again
              </button>
            </div>
          ) : sortedFriends.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '30px 20px',
              color: theme === 'win7' ? '#666' : theme === 'winxp' ? '#333' : '#000',
              fontSize: '11px',
              lineHeight: '1.4',
            }}>
              <div style={{ marginBottom: '8px' }}>👥</div>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                No friends to display
              </div>
              <div>
                Make sure to add friends to see them here!
              </div>
            </div>
          ) : (
            <div className="friends-list">
              {sortedFriends.map((friend) => (
                <div
                  key={friend.id}
                  onClick={() => handleFriendClick(friend)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 10px',
                    marginBottom: '2px',
                    cursor: 'pointer',
                    borderRadius: theme === 'win98' ? '0' : '4px',
                    transition: 'background 0.2s ease',
                    background: 'transparent',
                    border: theme === 'win98' ? '1px solid transparent' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (theme === 'win98') {
                      e.currentTarget.style.background = '#dfdfdf';
                      e.currentTarget.style.border = '1px inset #c0c0c0';
                    } else if (theme === 'win7') {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.6)';
                    } else {
                      e.currentTarget.style.background = '#d4d0c8';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    if (theme === 'win98') {
                      e.currentTarget.style.border = '1px solid transparent';
                    }
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    position: 'relative',
                    marginRight: '10px',
                    flexShrink: 0,
                  }}>
                    <img
                      src={friend.avatar_url || '/default-avatar.png'}
                      alt={friend.display_name || friend.username}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        border: theme === 'win98' ? '1px inset #c0c0c0' : '1px solid #ccc',
                        objectFit: 'cover',
                      }}
                      onError={(e) => {
                        // Create fallback avatar with initials
                        const canvas = document.createElement('canvas');
                        canvas.width = 36;
                        canvas.height = 36;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                          ctx.fillStyle = getStatusColor(friend.status, friend.is_online);
                          ctx.fillRect(0, 0, 36, 36);
                          ctx.fillStyle = 'white';
                          ctx.font = 'bold 14px Arial';
                          ctx.textAlign = 'center';
                          ctx.fillText(
                            (friend.display_name || friend.username).charAt(0).toUpperCase(),
                            18,
                            24
                          );
                          (e.target as HTMLImageElement).src = canvas.toDataURL();
                        }
                      }}
                    />
                    
                    {/* Status indicator */}
                    <div style={{
                      position: 'absolute',
                      bottom: '-2px',
                      right: '-2px',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: getStatusColor(friend.status, friend.is_online),
                      border: '2px solid ' + (theme === 'win98' ? '#c0c0c0' : theme === 'win7' ? '#fff' : '#ece9d8'),
                      boxSizing: 'border-box',
                    }} />
                  </div>

                  {/* Friend Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: theme === 'win7' ? '#333' : '#000',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {friend.display_name || friend.username}
                    </div>
                    
                    <div style={{
                      fontSize: '10px',
                      color: theme === 'win7' ? '#666' : '#666',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginTop: '2px',
                    }}>
                      {getStatusText(friend.status, friend.is_online)}
                      {!friend.is_online && (
                        <span> • {formatLastSeen(friend.last_seen)}</span>
                      )}
                    </div>
                    
                    {friend.lastMessage && (
                      <div style={{
                        fontSize: '10px',
                        color: theme === 'win7' ? '#888' : '#666',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginTop: '2px',
                        fontStyle: 'italic',
                      }}>
                        {friend.lastMessage.isFromSelf ? 'You: ' : `${friend.display_name || friend.username}: `}
                        {friend.lastMessage.text}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Custom scrollbar styles */}
      <style jsx>{`
        .friends-body::-webkit-scrollbar {
          width: 12px;
        }
        
        .friends-body::-webkit-scrollbar-track {
          background: ${theme === 'win98' ? '#c0c0c0' : theme === 'win7' ? '#f0f0f0' : '#ece9d8'};
        }
        
        .friends-body::-webkit-scrollbar-thumb {
          background: ${theme === 'win98' ? '#808080' : theme === 'win7' ? '#ccc' : '#0054e3'};
          border: ${theme === 'win98' ? '1px outset #808080' : '1px solid #999'};
          border-radius: ${theme === 'win98' ? '0' : '6px'};
        }
        
        .friends-body::-webkit-scrollbar-thumb:hover {
          background: ${theme === 'win98' ? '#606060' : theme === 'win7' ? '#bbb' : '#0040b3'};
        }
      `}</style>
    </div>
  );
};

export default FriendsWindow;