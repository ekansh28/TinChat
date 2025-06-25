// src/app/chat/components/ChatWindow.tsx - FIXED TO REMOVE SEARCHING MESSAGE

import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import MessageRow from './MessageRow';
import PartnerTypingIndicator from './PartnerTypingIndicator';
import InputArea from './InputArea';

interface ChatWindowProps {
  messages: any[];
  onSendMessage: (msg: string) => void;
  inputValue: string;
  onInputChange: (val: string) => void;
  isPartnerTyping: boolean;
  partnerStatus: string;
  partnerInfo?: {
    username: string;
    displayName?: string;
    avatar: string;
    displayNameColor?: string;
    displayNameAnimation?: string;
    rainbowSpeed?: number;
    authId?: string;
  };
  ownInfo: {
    username: string;
    authId: string | null;
    displayNameColor: string;
    displayNameAnimation: string;
  };
  isConnected: boolean;
  isPartnerConnected: boolean;
  theme: string;
  onUsernameClick: (authId: string, clickPosition: { x: number; y: number }) => void;
  isMobile: boolean;
  isScrollEnabled: boolean;
  onFindOrDisconnect: () => void;
  findOrDisconnectDisabled: boolean;
  findOrDisconnectText: string;
}

const INPUT_AREA_HEIGHT = 60; // px
const INPUT_AREA_HEIGHT_MOBILE = 70; // px

const ChatWindow: React.FC<ChatWindowProps> = ({
  messages = [],
  onSendMessage,
  inputValue,
  onInputChange,
  isPartnerTyping,
  partnerStatus,
  partnerInfo,
  ownInfo,
  isConnected,
  isPartnerConnected,
  theme,
  onUsernameClick,
  isMobile,
  isScrollEnabled,
  onFindOrDisconnect,
  findOrDisconnectDisabled,
  findOrDisconnectText,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // Track the most recent partner message data for typing indicator
  const [recentPartnerData, setRecentPartnerData] = useState<{
    senderUsername?: string;
    senderDisplayNameColor?: string;
    senderDisplayNameAnimation?: string;
    senderRainbowSpeed?: number;
  } | null>(null);

  const currentInputAreaHeight = isMobile ? INPUT_AREA_HEIGHT_MOBILE : INPUT_AREA_HEIGHT;

  // ✅ SAFE MESSAGES: Ensure messages is always an array
  const safeMessages = useMemo(() => {
    if (!Array.isArray(messages)) {
      console.warn('ChatWindow: messages prop is not an array, defaulting to empty array');
      return [];
    }
    return messages;
  }, [messages]);

  // Update recent partner data when messages change
  useEffect(() => {
    const partnerMessages = safeMessages.filter(msg => msg.sender === 'partner');
    if (partnerMessages.length > 0) {
      const latestPartnerMessage = partnerMessages[partnerMessages.length - 1];
      if (latestPartnerMessage.senderUsername || latestPartnerMessage.senderDisplayNameColor) {
        setRecentPartnerData({
          senderUsername: latestPartnerMessage.senderUsername,
          senderDisplayNameColor: latestPartnerMessage.senderDisplayNameColor,
          senderDisplayNameAnimation: latestPartnerMessage.senderDisplayNameAnimation,
          senderRainbowSpeed: latestPartnerMessage.senderRainbowSpeed
        });
      }
    }
  }, [safeMessages]);

  // Check if pink theme is active
  const isPinkThemeActive = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const themeLink = document.getElementById('dynamic-win98-theme-style') as HTMLLinkElement;
    return themeLink && themeLink.href.includes('pink-theme.css');
  }, []);

  // Check if Windows 7 theme is active
  const [isWindows7Theme, setIsWindows7Theme] = useState(false);
  
  const checkWindows7Theme = useCallback(() => {
    if (typeof window === 'undefined') return false;
    
    const win7Link = document.getElementById('win7-css-link') as HTMLLinkElement;
    const hasWin7CSS = win7Link && win7Link.href.includes('7.css');
    
    const win7SubThemeLink = document.querySelector('link[href*="/win7themes/"]') as HTMLLinkElement;
    const hasWin7SubTheme = win7SubThemeLink !== null;
    
    return hasWin7CSS || hasWin7SubTheme;
  }, []);
  
  useEffect(() => {
    const updateThemeState = () => {
      const newWin7State = checkWindows7Theme();
      setIsWindows7Theme(newWin7State);
    };
    
    updateThemeState();
    
    const headObserver = new MutationObserver((mutations) => {
      const linkMutation = mutations.some(mutation => 
        Array.from(mutation.addedNodes).some(node => 
          node.nodeName === 'LINK' || (node as Element)?.id === 'win7-css-link'
        ) ||
        Array.from(mutation.removedNodes).some(node => 
          node.nodeName === 'LINK' || (node as Element)?.id === 'win7-css-link'
        )
      );
      
      if (linkMutation) {
        updateThemeState();
      }
    });
    
    headObserver.observe(document.head, {
      childList: true,
      subtree: true
    });
    
    return () => {
      headObserver.disconnect();
    };
  }, [checkWindows7Theme]);

  // ✅ MOBILE vs DESKTOP SCROLLING: Different behaviors based on layout
  const scrollToBottom = useCallback((force = false) => {
    if (!messagesContainerRef.current) return;
    
    const container = messagesContainerRef.current;
    
    if (isMobile) {
      // MOBILE: Always scroll to bottom to show newest messages (bottom-anchored layout)
      if (force) {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      } else {
        // Auto-scroll on mobile for new messages when near bottom
        const isNearBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
        if (isNearBottom) {
          requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight;
          });
        }
      }
    } else {
      // DESKTOP: Traditional chat behavior (top-anchored)
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
      if (force || isAtBottom) {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    }
  }, [isMobile]);

  // Auto-scroll effect for new messages
  useEffect(() => { 
    scrollToBottom();
  }, [safeMessages, isPartnerTyping, scrollToBottom]);

  const inputAndSendDisabled = useMemo(() => 
    !isConnected || !isPartnerConnected, 
    [isConnected, isPartnerConnected]
  );

  // Biscuit Frame Component
  const BiscuitFrame: React.FC = () => (
    <div className="biscuit-frame-overlay">
      <div className="frame-edge frame-top"></div>
      <div className="frame-edge frame-bottom"></div>
      <div className="frame-edge frame-left"></div>
      <div className="frame-edge frame-right"></div>
      <div className="frame-edge frame-corner frame-top-left"></div>
      <div className="frame-edge frame-corner frame-top-right"></div>
      <div className="frame-edge frame-corner frame-bottom-left"></div>
      <div className="frame-edge frame-corner frame-bottom-right"></div>
    </div>
  );

  // Apply glass classes effect
  useEffect(() => {
    if (isWindows7Theme) {
      const windowElements = document.querySelectorAll('.window, .window-body, .title-bar, .input-area, form');
      windowElements.forEach(element => {
        if (!element.classList.contains('glass')) {
          element.classList.add('glass');
        }
        if (!element.classList.contains('active')) {
          element.classList.add('active');
        }
      });
      
      const chatContainer = document.querySelector('.window-body-content');
      if (chatContainer) {
        chatContainer.classList.add('glass-window-body', 'glass', 'active');
      }
    } else {
      const glassElements = document.querySelectorAll('.glass');
      glassElements.forEach(element => {
        element.classList.remove('glass');
        element.classList.remove('active');
      });
    }
  }, [isWindows7Theme]);

  // ✅ MOBILE: Force input area visibility
  useEffect(() => {
    if (isMobile) {
      const inputArea = document.querySelector('.input-area');
      if (inputArea) {
        const element = inputArea as HTMLElement;
        element.style.display = 'block';
        element.style.visibility = 'visible';
        element.style.opacity = '1';
        element.style.position = 'relative';
        element.style.zIndex = '10';
        element.style.flexShrink = '0';
        console.log('[ChatWindow] Mobile: Force input area visibility');
      }
    }
  }, [isMobile]);

  // ✅ CONTENT RENDERING: Same for mobile and desktop, with proper ordering for mobile
  const renderContent = () => {
    const content = [];
    
    // ✅ FIXED: REMOVED ALL "Searching" and "Waiting" MESSAGES
    // Empty state messages - ONLY show connection status
    if (!isConnected && safeMessages.length === 0) {
      content.push(
        <div key="connecting" className={cn(
          "text-center text-xs italic p-4",
          isWindows7Theme 
            ? 'text-gray-100 theme-7-text-shadow' 
            : 'text-gray-500 dark:text-gray-400'
        )}>
          Connecting to chat server...
        </div>
      );
    }
    // ✅ REMOVED: No more "Waiting for partner..." or "Searching..." messages
    
    // ✅ MESSAGES: Same layout for mobile and desktop - traditional format
    safeMessages.forEach((msg, index) => {
      if (msg && typeof msg === 'object') {
        content.push(
          <MessageRow 
            key={msg.id || `msg-${index}`} 
            message={msg} 
            theme={theme} 
            previousMessageSender={index > 0 ? safeMessages[index-1]?.sender : undefined} 
            ownInfo={ownInfo}
            partnerInfo={partnerInfo}
            onUsernameClick={onUsernameClick}
            isMobile={false} // ✅ UNIFIED LAYOUT: Always use desktop-style message format
          />
        );
      }
    });
    
    // ✅ TYPING INDICATOR: Always render at the end (after all messages)
    if (isPartnerTyping) {
      content.push(
        <div 
          key="typing-indicator"
          className={cn(
            "typing-indicator-container",
            isMobile && "mobile-typing-indicator-container"
          )}
        >
          <PartnerTypingIndicator 
            isTyping={isPartnerTyping} 
            partnerName={partnerInfo?.displayName || partnerInfo?.username || 'Stranger'}
            theme={theme}
            partnerInfo={partnerInfo}
            recentPartnerData={recentPartnerData || undefined}
            isMobile={false} // ✅ UNIFIED LAYOUT: Always use desktop-style indicator
            className={cn(
              isMobile && "mobile-typing-indicator"
            )}
          />
        </div>
      );
    }
    
    return content;
  };

  return (
    <div 
      className={cn(
        'window-body window-body-content flex flex-col',
        isWindows7Theme ? 'glass-body-padding has-space' : 'p-0.5',
        isMobile && 'p-1',
        isPinkThemeActive && theme === 'theme-98' && 'relative'
      )} 
      style={{ 
        position: 'relative',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden'
      }}
    >
      
      {/* Render biscuit frame if pink theme is active and Windows 98 */}
      {isPinkThemeActive && theme === 'theme-98' && <BiscuitFrame />}
      
      {/* ✅ MOBILE vs DESKTOP: Different flex behaviors for message positioning */}
      <div 
        ref={messagesContainerRef}
        className={cn(
          "flex-1 overflow-y-auto overscroll-contain",
          isWindows7Theme 
            ? 'border p-2 bg-white bg-opacity-20 dark:bg-gray-700 dark:bg-opacity-20' 
            : 'sunken-panel tree-view p-1',
          isMobile && 'p-2'
        )} 
        style={{ 
          flex: '1 1 0%',
          minHeight: 0,
          overflowY: isScrollEnabled ? 'auto' : 'hidden',
          WebkitOverflowScrolling: 'touch',
          
          display: 'flex',
          flexDirection: 'column',
          
          // ✅ MOBILE: Bottom-anchored (messages stick to bottom)
          // ✅ DESKTOP: Top-anchored (traditional)
          justifyContent: isMobile ? 'flex-end' : 'flex-start',
        }}
      >
        {/* ✅ MOBILE: Add spacer to push content to bottom when there are few messages */}
        {isMobile && safeMessages.length > 0 && (
          <div className="flex-1 min-h-0" style={{ minHeight: '20px' }} />
        )}
        
        {/* Messages and content */}
        <div className={cn(
          isMobile ? 'flex flex-col w-full' : 'w-full'
        )}>
          {renderContent()}
        </div>
        
        {/* Scroll anchor at the bottom */}
        <div 
          ref={messagesEndRef} 
          style={{ 
            height: '1px',
            flexShrink: 0
          }} 
        />
      </div>
      
      {/* ✅ FIXED: Input area with explicit mobile visibility */}
      <div 
        className={cn(
          "flex-shrink-0 w-full",
          isMobile && "mobile-input-container"
        )}
        style={{ 
          height: `${currentInputAreaHeight}px`,
          minHeight: `${currentInputAreaHeight}px`,
          maxHeight: `${currentInputAreaHeight}px`,
          position: 'relative',
          ...(isMobile && {
            zIndex: 10,
            display: 'block',
            visibility: 'visible',
            opacity: 1,
            backgroundColor: 'inherit',
            borderTop: '1px solid rgba(0,0,0,0.1)',
            flexShrink: 0
          })
        }}
      >
        <InputArea
          value={inputValue}
          onChange={onInputChange}
          onSend={onSendMessage}
          disabled={inputAndSendDisabled}
          theme={theme}
          isMobile={isMobile}
          onScrollToBottom={() => scrollToBottom(true)}
          onFindOrDisconnect={onFindOrDisconnect}
          findOrDisconnectDisabled={findOrDisconnectDisabled}
          findOrDisconnectText={findOrDisconnectText}
        />
      </div>
    </div>
  );
};

export default ChatWindow;