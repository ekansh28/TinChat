// src/app/chat/components/FriendsWindow.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface Friend {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  isOnline: boolean;
  lastMessage?: {
    text: string;
    timestamp: Date;
    isFromSelf: boolean;
  };
}

interface FriendsWindowProps {
  friends: Friend[];
  onOpenChat: (friend: Friend) => void;
  onClose: () => void;
  theme: 'win98' | 'win7' | 'winxp';
}

const FriendsWindow: React.FC<FriendsWindowProps> = ({
  friends,
  onOpenChat,
  onClose,
  theme
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const windowRef = useRef<HTMLDivElement>(null);

  // Slide up animation
  useEffect(() => {
    // Small delay to trigger the slide animation
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  // Sort friends by most recent message first, then by online status
  const sortedFriends = React.useMemo(() => {
    return [...friends].sort((a, b) => {
      // First sort by last message timestamp (most recent first)
      const aTime = a.lastMessage?.timestamp?.getTime() || 0;
      const bTime = b.lastMessage?.timestamp?.getTime() || 0;
      
      if (aTime !== bTime) {
        return bTime - aTime; // Most recent first
      }
      
      // If same timestamp (or both have no messages), sort by online status
      if (a.isOnline !== b.isOnline) {
        return a.isOnline ? -1 : 1; // Online friends first
      }
      
      // Finally sort alphabetically by display name
      return a.displayName.localeCompare(b.displayName);
    });
  }, [friends]);

  // Format relative time
  const formatLastSeen = (timestamp: Date): string => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return timestamp.toLocaleDateString();
  };

  // Handle friend click
  const handleFriendClick = (friend: Friend) => {
    onOpenChat(friend);
  };

  // Handle close button
  const handleClose = () => {
    setIsVisible(false);
    // Wait for animation to complete before calling onClose
    setTimeout(() => {
      onClose();
    }, 200);
  };

  // Get window styles based on theme
  const getWindowStyles = () => {
    const baseStyles = {
      position: 'fixed' as const,
      bottom: isVisible ? '40px' : '-400px', // Slide from bottom
      right: '20px',
      width: '280px',
      height: '380px',
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
          bottom: isVisible ? '45px' : '-400px', // Adjusted for Win7 taskbar height
        };
      case 'winxp':
        return {
          ...baseStyles,
          background: '#ece9d8',
          border: '1px solid #0054e3',
          borderRadius: '8px 8px 0 0',
          bottom: isVisible ? '35px' : '-400px', // Adjusted for XP taskbar height
        };
      default: // win98
        return {
          ...baseStyles,
          background: '#c0c0c0',
          border: '3px outset #c0c0c0',
          bottom: isVisible ? '37px' : '-400px', // Adjusted for Win98 taskbar height
        };
    }
  };

  // Get title bar styles
  const getTitleBarStyles = () => {
    switch (theme) {
      case 'win7':
        return {
          height: '28px',
          background: 'linear-gradient(to bottom, #f0f0f0, #e0e0e0)',
          borderBottom: '1px solid #ccc',
          borderTopLeftRadius: '6px',
          borderTopRightRadius: '6px',
          color: '#333',
        };
      case 'winxp':
        return {
          height: '26px',
          background: 'linear-gradient(to bottom, #0054e3, #0040b3)',
          color: '#fff',
          borderTopLeftRadius: '6px',
          borderTopRightRadius: '6px',
        };
      default: // win98
        return {
          height: '24px',
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
          padding: '0 8px',
          flexShrink: 0,
        }}
      >
        <div className="title-bar-text" style={{ 
          flexGrow: 1,
          fontSize: '12px',
          fontWeight: theme === 'winxp' ? 'bold' : 'normal',
          fontFamily: theme === 'winxp' ? 'Tahoma, sans-serif' : undefined,
        }}>
          Friends ({sortedFriends.length})
        </div>
        
        <div className="title-bar-controls">
          <button 
            onClick={handleClose}
            style={{
              width: '18px',
              height: '18px',
              border: theme === 'win98' ? '1px outset #c0c0c0' : '1px solid #999',
              background: theme === 'win98' ? '#c0c0c0' : '#ff6b6b',
              color: theme === 'win98' ? '#000' : '#fff',
              fontSize: '10px',
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
          height: 'calc(100% - 28px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ 
          padding: '8px',
          borderBottom: theme === 'win98' ? '1px inset #c0c0c0' : '1px solid #ddd',
          flexShrink: 0,
        }}>
          <div style={{ 
            fontSize: '11px',
            color: theme === 'win7' ? '#666' : theme === 'winxp' ? '#333' : '#000',
          }}>
            Click a friend to start chatting
          </div>
        </div>

        {/* Friends List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px',
        }}>
          {sortedFriends.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '20px',
              color: theme === 'win7' ? '#666' : theme === 'winxp' ? '#333' : '#000',
              fontSize: '11px',
            }}>
              No friends online
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
                    padding: '6px 8px',
                    marginBottom: '2px',
                    cursor: 'pointer',
                    borderRadius: theme === 'win98' ? '0' : '4px',
                    transition: 'background 0.2s ease',
                    background: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (theme === 'win98') {
                      e.currentTarget.style.background = '#dfdfdf';
                    } else if (theme === 'win7') {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.6)';
                    } else {
                      e.currentTarget.style.background = '#d4d0c8';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    position: 'relative',
                    marginRight: '8px',
                    flexShrink: 0,
                  }}>
                    <img
                      src={friend.avatar || '/default-avatar.png'}
                      alt={friend.displayName}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        border: theme === 'win98' ? '1px inset #c0c0c0' : '1px solid #ccc',
                        objectFit: 'cover',
                      }}
                      onError={(e) => {
                        // Fallback to initials
                        const canvas = document.createElement('canvas');
                        canvas.width = 32;
                        canvas.height = 32;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                          ctx.fillStyle = friend.isOnline ? '#4CAF50' : '#9E9E9E';
                          ctx.fillRect(0, 0, 32, 32);
                          ctx.fillStyle = 'white';
                          ctx.font = '12px Arial';
                          ctx.textAlign = 'center';
                          ctx.fillText(
                            friend.displayName.charAt(0).toUpperCase(),
                            16,
                            20
                          );
                          (e.target as HTMLImageElement).src = canvas.toDataURL();
                        }
                      }}
                    />
                    
                    {/* Online status indicator */}
                    <div style={{
                      position: 'absolute',
                      bottom: '-2px',
                      right: '-2px',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: friend.isOnline ? '#4CAF50' : '#9E9E9E',
                      border: '2px solid ' + (theme === 'win98' ? '#c0c0c0' : theme === 'win7' ? '#fff' : '#ece9d8'),
                    }} />
                  </div>

                  {/* Friend Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: theme === 'win7' ? '#333' : theme === 'winxp' ? '#000' : '#000',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {friend.displayName}
                    </div>
                    
                    <div style={{
                      fontSize: '10px',
                      color: theme === 'win7' ? '#666' : theme === 'winxp' ? '#666' : '#666',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginTop: '2px',
                    }}>
                      {friend.isOnline ? 'Online' : 'Offline'}
                      {friend.lastMessage && (
                        <span> • {formatLastSeen(friend.lastMessage.timestamp)}</span>
                      )}
                    </div>
                    
                    {friend.lastMessage && (
                      <div style={{
                        fontSize: '10px',
                        color: theme === 'win7' ? '#888' : theme === 'winxp' ? '#666' : '#666',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginTop: '2px',
                        fontStyle: 'italic',
                      }}>
                        {friend.lastMessage.isFromSelf ? 'You: ' : `${friend.displayName}: `}
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