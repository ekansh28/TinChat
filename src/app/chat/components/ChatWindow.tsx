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
  messages,
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

  // Update recent partner data when messages change
  useEffect(() => {
    // Find the most recent partner message to get latest styling data
    const partnerMessages = messages.filter(msg => msg.sender === 'partner');
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
  }, [messages]);

  // Check if pink theme is active by looking for the CSS file in the DOM
  const isPinkThemeActive = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const themeLink = document.getElementById('dynamic-win98-theme-style') as HTMLLinkElement;
    return themeLink && themeLink.href.includes('pink-theme.css');
  }, []);

  // Check if Windows 7 theme is active by looking at the actual DOM state like TopBar does
  const [isWindows7Theme, setIsWindows7Theme] = useState(false);
  
  // Function to check Windows 7 theme state (same logic as TopBar)
  const checkWindows7Theme = useCallback(() => {
    if (typeof window === 'undefined') return false;
    
    // Check if Windows 7 CSS is loaded (same ID as TopBar uses)
    const win7Link = document.getElementById('win7-css-link') as HTMLLinkElement;
    const hasWin7CSS = win7Link && win7Link.href.includes('7.css');
    
    // Check for Windows 7 sub-theme CSS links (from /win7themes/ folder)
    const win7SubThemeLink = document.querySelector('link[href*="/win7themes/"]') as HTMLLinkElement;
    const hasWin7SubTheme = win7SubThemeLink !== null;
    
    // A window is in Windows 7 mode if it has the Win7 CSS loaded OR Win7 subthemes
    return hasWin7CSS || hasWin7SubTheme;
  }, []);
  
  // FIXED: Update Windows 7 theme state with observers - corrected syntax
  useEffect(() => {
    const updateThemeState = () => {
      const newWin7State = checkWindows7Theme();
      setIsWindows7Theme(newWin7State);
      console.log("ChatWindow: Windows 7 theme detected:", newWin7State);
    };
    
    // Check initially
    updateThemeState();
    
    // Watch for changes to the head element (when CSS links are added/removed)
    const headObserver = new MutationObserver((mutations) => {
      // Check if any mutations involve link elements
      const linkMutation = mutations.some(mutation => 
        Array.from(mutation.addedNodes).some(node => 
          node.nodeName === 'LINK' || (node as Element)?.id === 'win7-css-link'
        ) ||
        Array.from(mutation.removedNodes).some(node => 
          node.nodeName === 'LINK' || (node as Element)?.id === 'win7-css-link'
        )
      ); // FIXED: Added missing closing parenthesis
      
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

  // IMPROVED: Scroll to bottom function with mobile-specific behavior
  const scrollToBottom = useCallback((force = false) => {
    if (!messagesContainerRef.current) return;
    
    const container = messagesContainerRef.current;
    
    if (isMobile) {
      // MOBILE: Bottom-to-top messaging - scroll to show newest messages at bottom
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
      if (force || isAtBottom) {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    } else {
      // DESKTOP: Traditional chat behavior - can be different if needed
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
  }, [messages, isPartnerTyping, scrollToBottom]);

  const inputAndSendDisabled = useMemo(() => 
    !isConnected || !isPartnerConnected, 
    [isConnected, isPartnerConnected]
  );

  // Biscuit Frame Component with proper slicing (for Windows 98 pink theme only)
  const BiscuitFrame: React.FC = () => (
    <div className="biscuit-frame-overlay">
      {/* Edges - these will repeat the appropriate slices */}
      <div className="frame-edge frame-top"></div>
      <div className="frame-edge frame-bottom"></div>
      <div className="frame-edge frame-left"></div>
      <div className="frame-edge frame-right"></div>
      {/* Corners - these show only the corner portions */}
      <div className="frame-edge frame-corner frame-top-left"></div>
      <div className="frame-edge frame-corner frame-top-right"></div>
      <div className="frame-edge frame-corner frame-bottom-left"></div>
      <div className="frame-edge frame-corner frame-bottom-right"></div>
    </div>
  );

  // Function to add glass active classes to parent window
  useEffect(() => {
    if (isWindows7Theme) {
      // Find ALL window-related elements and add glass active classes
      const windowElements = document.querySelectorAll('.window, .window-body, .title-bar, .input-area, form');
      windowElements.forEach(element => {
        if (!element.classList.contains('glass')) {
          element.classList.add('glass');
        }
        if (!element.classList.contains('active')) {
          element.classList.add('active');
        }
      });
      
      console.log("ChatWindow: Added glass active classes to all window elements");
      
      // Also ensure the main chat container gets proper glass styling
      const chatContainer = document.querySelector('.window-body-content');
      if (chatContainer) {
        chatContainer.classList.add('glass-window-body', 'glass', 'active');
        console.log("ChatWindow: Added glass active classes to chat container");
      }
    } else {
      // Remove glass classes when not Windows 7 theme
      const glassElements = document.querySelectorAll('.glass');
      glassElements.forEach(element => {
        element.classList.remove('glass');
        element.classList.remove('active');
      });
      console.log("ChatWindow: Removed glass active classes from all elements");
    }
  }, [isWindows7Theme]);

  // FIXED: Prepare messages and typing indicator with mobile-specific ordering
  const renderContent = () => {
    const content = [];
    
    // Empty state messages
    if (!isConnected && messages.length === 0) {
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
    } else if (isConnected && messages.length === 0 && !isPartnerConnected) {
      content.push(
        <div key="waiting" className={cn(
          "text-center text-xs italic p-4",
          isWindows7Theme 
            ? 'text-gray-100 theme-7-text-shadow' 
            : 'text-gray-500 dark:text-gray-400'
        )}>
          Waiting for partner...
        </div>
      );
    }
    
    // Messages in chronological order (oldest to newest)
    messages.forEach((msg, index) => {
      content.push(
        <MessageRow 
          key={msg.id || index} 
          message={msg} 
          theme={theme} 
          previousMessageSender={index > 0 ? messages[index-1]?.sender : undefined} 
          ownInfo={ownInfo}
          partnerInfo={partnerInfo}
          onUsernameClick={onUsernameClick}
          isMobile={isMobile}
        />
      );
    });
    
    // Typing indicator at the end (newest position)
    if (isPartnerTyping) {
      content.push(
        <PartnerTypingIndicator 
          key="typing-indicator"
          isTyping={isPartnerTyping} 
          partnerName={partnerInfo?.displayName || partnerInfo?.username || 'Stranger'}
          theme={theme}
          partnerInfo={partnerInfo}
          recentPartnerData={recentPartnerData}
        />
      );
    }
    
    // Return content in proper order
    return content;
  };

  return (
    <div 
      className={cn(
        'window-body window-body-content flex flex-col',
        isWindows7Theme ? 'glass-body-padding has-space' : 'p-0.5',
        isMobile && 'p-1',
        // Add biscuit-frame class when pink theme is active (Windows 98 only)
        isPinkThemeActive && theme === 'theme-98' && 'relative'
      )} 
      style={{ 
        position: 'relative',
        height: '100%',
        minHeight: 0, // Important for flex children
        overflow: 'hidden' // Prevent container from growing
      }}
    >
      
      {/* Render biscuit frame if pink theme is active and Windows 98 */}
      {isPinkThemeActive && theme === 'theme-98' && <BiscuitFrame />}
      
      {/* MOBILE vs DESKTOP: Different message container layouts */}
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
          // Use calc to ensure proper height that accounts for input area
          height: `calc(100% - ${currentInputAreaHeight}px)`,
          minHeight: 0, // Allow shrinking
          maxHeight: `calc(100% - ${currentInputAreaHeight}px)`, // Prevent growing beyond container
          overflowY: isScrollEnabled ? 'auto' : 'hidden',
          WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
          // MOBILE: Use normal flex direction for bottom-to-top messaging
          // DESKTOP: Can use different layout if needed
          display: 'flex',
          flexDirection: 'column', // Normal order for both - messages appear chronologically
          justifyContent: isMobile ? 'flex-start' : 'flex-start' // Start from top
        }}
      >
        {/* Messages in chronological order - this gives us the correct flow:
            User: Hi
            Stranger: Hello 
            (newest messages at bottom, auto-scroll to show them) */}
        {renderContent()}
        
        {/* Scroll anchor at the bottom */}
        <div 
          ref={messagesEndRef} 
          style={{ 
            height: '1px',
            flexShrink: 0
          }} 
        />
      </div>
      
      {/* FIXED: Input area with proper positioning */}
      <div 
        className="flex-shrink-0 w-full"
        style={{ 
          height: `${currentInputAreaHeight}px`,
          minHeight: `${currentInputAreaHeight}px`,
          maxHeight: `${currentInputAreaHeight}px`
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