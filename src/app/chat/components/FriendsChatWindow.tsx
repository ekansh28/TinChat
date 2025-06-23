// src/app/chat/components/FriendsChatWindow.tsx - COMPLETELY FIXED VERSION
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
// ✅ FIXED: Import unified types and helper functions
import { Friend } from '../../../types/friends';
import { ExtendedChatMessage, isMessageFromSelf } from '../../../types/friendsExtended';

interface ChatWindowProps {
  friend: Friend;
  messages: ExtendedChatMessage[];
  onSendMessage: (friendId: string, message: string) => void;
  onClose: () => void;
  position: number; // 0 = rightmost, 1 = second from right, etc.
  theme: 'win98' | 'win7' | 'winxp';
}

const FriendsChatWindow: React.FC<ChatWindowProps> = ({
  friend,
  messages,
  onSendMessage,
  onClose,
  position,
  theme
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ✅ FIXED: Slide up animation with proper cleanup
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
      // Focus input after animation
      const focusTimer = setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
      
      return () => clearTimeout(focusTimer);
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  // ✅ FIXED: Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // ✅ FIXED: Handle message input with proper typing state management
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCurrentMessage(value);
    
    // Show typing indicator
    if (value.trim() && !isTyping) {
      setIsTyping(true);
      // TODO: Emit typing start event
      console.log('[ChatWindow] Started typing to', friend.id);
    } else if (!value.trim() && isTyping) {
      setIsTyping(false);
      // TODO: Emit typing stop event
      console.log('[ChatWindow] Stopped typing to', friend.id);
    }
  };

  // ✅ FIXED: Handle send message with proper validation
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const message = currentMessage.trim();
    
    if (message && message.length > 0) {
      onSendMessage(friend.id, message);
      setCurrentMessage('');
      setIsTyping(false);
      
      // TODO: Emit typing stop event
      console.log('[ChatWindow] Sent message to', friend.id, ':', message);
    }
  };

  // ✅ FIXED: Handle close with animation
  const handleClose = () => {
    setIsVisible(false);
    // Wait for animation before calling onClose
    setTimeout(() => {
      onClose();
    }, 200);
  };

  // ✅ FIXED: Handle key press with proper event types
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // ✅ FIXED: Get window position with proper calculations
  const getWindowPosition = () => {
    const windowWidth = 280;
    const rightOffset = 20;
    const friendsWindowWidth = 280;
    const spacing = 10;
    
    // Calculate position: Friends window + spacing + (position * (window width + spacing))
    const leftOffset = rightOffset + friendsWindowWidth + spacing + (position * (windowWidth + spacing));
    
    return {
      right: `${leftOffset}px`
    };
  };

  // ✅ FIXED: Get window styles based on theme with proper typing
  const getWindowStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      position: 'fixed',
      bottom: isVisible ? '40px' : '-400px',
      ...getWindowPosition(),
      width: '280px',
      height: '380px',
      zIndex: 6000 - position, // Lower z-index for windows further left
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

  // ✅ FIXED: Get title bar styles with proper typing
  const getTitleBarStyles = (): React.CSSProperties => {
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

  // ✅ FIXED: Get body styles with proper typing
  const getBodyStyles = (): React.CSSProperties => {
    switch (theme) {
      case 'win7':
        return {
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(5px)',
          color: '#333',
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

  // ✅ FIXED: Format message timestamp with proper error handling
  const formatTime = (timestamp: number): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.warn('Error formatting timestamp:', error);
      return '';
    }
  };

  // ✅ FIXED: Get display name with fallback
  const getDisplayName = () => {
    return friend.display_name || friend.username;
  };

  return (
    <div 
      ref={windowRef}
      className={cn(
        "window chat-window",
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
        {/* Friend avatar and name */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flexGrow: 1,
          minWidth: 0,
        }}>
          <img
            src={friend.avatar_url || '/default-avatar.png'}
            alt={getDisplayName()}
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              marginRight: '6px',
              border: '1px solid #999',
              objectFit: 'cover',
            }}
            onError={(e) => {
              // Fallback to initials
              const canvas = document.createElement('canvas');
              canvas.width = 16;
              canvas.height = 16;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.fillStyle = friend.is_online ? '#4CAF50' : '#9E9E9E';
                ctx.fillRect(0, 0, 16, 16);
                ctx.fillStyle = 'white';
                ctx.font = '8px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(
                  getDisplayName().charAt(0).toUpperCase(),
                  8,
                  10
                );
                (e.target as HTMLImageElement).src = canvas.toDataURL();
              }
            }}
          />
          
          <div className="title-bar-text" style={{ 
            fontSize: '12px',
            fontWeight: theme === 'winxp' ? 'bold' : 'normal',
            fontFamily: theme === 'winxp' ? 'Tahoma, sans-serif' : undefined,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {getDisplayName()}
            {friend.is_online && (
              <span style={{
                fontSize: '10px',
                opacity: 0.8,
                marginLeft: '4px',
              }}>
                • Online
              </span>
            )}
          </div>
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
          "window-body chat-body",
          theme === 'win7' && "glass-body",
          theme === 'winxp' && "xp-body"
        )}
        style={{
          ...getBodyStyles(),
          height: 'calc(100% - 28px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Messages Area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          {messages.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '20px',
              color: theme === 'win7' ? '#666' : theme === 'winxp' ? '#333' : '#666',
              fontSize: '11px',
              fontStyle: 'italic',
            }}>
              Start a conversation with {getDisplayName()}
            </div>
          ) : (
            messages.map((message) => {
              // ✅ FIXED: Determine if message is from self using helper function
              const isFromSelf = message.isFromSelf ?? isMessageFromSelf(message, 'current-user');
              
              return (
                <div
                  key={message.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isFromSelf ? 'flex-end' : 'flex-start',
                    marginBottom: '8px',
                  }}
                >
                  {/* Message bubble */}
                  <div style={{
                    maxWidth: '70%',
                    padding: '6px 10px',
                    borderRadius: theme === 'win98' ? '0' : '12px',
                    background: isFromSelf 
                      ? (theme === 'win98' ? '#dfdfdf' : theme === 'win7' ? '#0078d4' : '#0054e3')
                      : (theme === 'win98' ? '#ffffff' : theme === 'win7' ? '#f0f0f0' : '#ffffff'),
                    color: isFromSelf 
                      ? (theme === 'win98' ? '#000' : '#fff')
                      : '#000',
                    border: theme === 'win98' 
                      ? (isFromSelf ? '1px outset #dfdfdf' : '1px inset #ffffff')
                      : '1px solid #ddd',
                    wordWrap: 'break-word',
                    fontSize: '11px',
                    lineHeight: '1.4',
                  }}>
                    {/* Message sender (only for received messages) */}
                    {!isFromSelf && (
                      <div style={{
                        fontSize: '9px',
                        fontWeight: 'bold',
                        color: theme === 'win7' ? '#666' : theme === 'winxp' ? '#0054e3' : '#666',
                        marginBottom: '2px',
                      }}>
                        {getDisplayName()}
                      </div>
                    )}
                    
                    {/* Message text */}
                    <div>{message.message}</div>
                  </div>
                  
                  {/* Timestamp */}
                  <div style={{
                    fontSize: '9px',
                    color: theme === 'win7' ? '#888' : theme === 'winxp' ? '#666' : '#666',
                    marginTop: '2px',
                    marginLeft: isFromSelf ? '0' : '10px',
                    marginRight: isFromSelf ? '10px' : '0',
                  }}>
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              );
            })
          )}
          
          {/* Typing indicator */}
          {isTyping && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 10px',
              fontSize: '10px',
              color: theme === 'win7' ? '#666' : theme === 'winxp' ? '#333' : '#666',
              fontStyle: 'italic',
            }}>
              You are typing...
            </div>
          )}
          
          {/* Auto-scroll anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{
          borderTop: theme === 'win98' ? '1px inset #c0c0c0' : '1px solid #ddd',
          padding: '8px',
          flexShrink: 0,
          background: theme === 'win98' ? '#c0c0c0' : 'transparent',
        }}>
          <form onSubmit={handleSendMessage} style={{
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
          }}>
            <input
              ref={inputRef}
              type="text"
              value={currentMessage}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              style={{
                flex: 1,
                padding: '4px 6px',
                fontSize: '11px',
                border: theme === 'win98' ? '1px inset #c0c0c0' : '1px solid #ccc',
                borderRadius: theme === 'win98' ? '0' : '4px',
                background: theme === 'win98' ? '#ffffff' : '#fff',
                color: '#000',
                outline: 'none',
              }}
              disabled={!friend.is_online}
            />
            
            <button
              type="submit"
              disabled={!currentMessage.trim() || !friend.is_online}
              style={{
                padding: '4px 8px',
                fontSize: '10px',
                border: theme === 'win98' ? '1px outset #c0c0c0' : '1px solid #999',
                borderRadius: theme === 'win98' ? '0' : '4px',
                background: theme === 'win98' ? '#c0c0c0' : theme === 'win7' ? '#0078d4' : '#0054e3',
                color: theme === 'win98' ? '#000' : '#fff',
                cursor: (!currentMessage.trim() || !friend.is_online) ? 'not-allowed' : 'pointer',
                opacity: (!currentMessage.trim() || !friend.is_online) ? 0.5 : 1,
                fontWeight: 'bold',
              }}
            >
              Send
            </button>
          </form>
          
          {!friend.is_online && (
            <div style={{
              fontSize: '9px',
              color: theme === 'win7' ? '#999' : theme === 'winxp' ? '#666' : '#666',
              textAlign: 'center',
              marginTop: '4px',
              fontStyle: 'italic',
            }}>
              {getDisplayName()} is offline
            </div>
          )}
        </div>
      </div>

      {/* Custom scrollbar styles */}
      <style jsx>{`
        .chat-body > div:first-child::-webkit-scrollbar {
          width: 8px;
        }
        
        .chat-body > div:first-child::-webkit-scrollbar-track {
          background: ${theme === 'win98' ? '#c0c0c0' : theme === 'win7' ? '#f0f0f0' : '#ece9d8'};
        }
        
        .chat-body > div:first-child::-webkit-scrollbar-thumb {
          background: ${theme === 'win98' ? '#808080' : theme === 'win7' ? '#ccc' : '#0054e3'};
          border-radius: ${theme === 'win98' ? '0' : '4px'};
          border: ${theme === 'win98' ? '1px outset #808080' : '1px solid #999'};
        }
        
        .chat-body > div:first-child::-webkit-scrollbar-thumb:hover {
          background: ${theme === 'win98' ? '#606060' : theme === 'win7' ? '#bbb' : '#0040b3'};
        }
      `}</style>
    </div>
  );
};

export default FriendsChatWindow;