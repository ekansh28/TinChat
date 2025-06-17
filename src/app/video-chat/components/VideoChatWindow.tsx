// src/app/video-chat/components/VideoChatWindow.tsx
import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import MessageRow from '../../chat/components/MessageRow';
import PartnerTypingIndicator from '../../chat/components/PartnerTypingIndicator';
import VideoInputArea from './VideoInputArea';

interface VideoChatWindowProps {
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
  onFindOrDisconnect: () => void;
  findOrDisconnectDisabled: boolean;
  findOrDisconnectText: string;
}

const INPUT_AREA_HEIGHT = 60; // px
const INPUT_AREA_HEIGHT_MOBILE = 70; // px

const VideoChatWindow: React.FC<VideoChatWindowProps> = ({
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
  onFindOrDisconnect,
  findOrDisconnectDisabled,
  findOrDisconnectText,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const currentInputAreaHeight = isMobile ? INPUT_AREA_HEIGHT_MOBILE : INPUT_AREA_HEIGHT;

  // Check if Windows 7 theme is active
  const [isWindows7Theme, setIsWindows7Theme] = React.useState(false);
  
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

  // Auto-scroll effect for new messages
  const scrollToBottom = useCallback((force = false) => {
    if (!messagesContainerRef.current) return;
    
    const container = messagesContainerRef.current;
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
    
    if (force || isAtBottom) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }, []);

  useEffect(() => { 
    scrollToBottom();
  }, [messages, isPartnerTyping, scrollToBottom]);

  const inputAndSendDisabled = useMemo(() => 
    !isConnected || !isPartnerConnected, 
    [isConnected, isPartnerConnected]
  );

  // Apply glass classes effect for Windows 7
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

  // Render content
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
          Connecting to video chat server...
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
          Waiting for video chat partner...
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
    
    // Typing indicator at the end
    if (isPartnerTyping) {
      content.push(
        <PartnerTypingIndicator 
          key="typing-indicator"
          isTyping={isPartnerTyping} 
          partnerName={partnerInfo?.displayName || partnerInfo?.username || 'Stranger'}
          theme={theme}
          partnerInfo={partnerInfo}
          isMobile={isMobile}
        />
      );
    }
    
    return content;
  };

  return (
    <div 
      className={cn(
        'window-body window-body-content flex flex-col',
        isWindows7Theme ? 'glass-body-padding has-space' : 'p-0.5',
        isMobile && 'p-1'
      )} 
      style={{ 
        position: 'relative',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden'
      }}
    >
      {/* Messages area */}
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
          height: `calc(100% - ${currentInputAreaHeight}px)`,
          minHeight: 0,
          maxHeight: `calc(100% - ${currentInputAreaHeight}px)`,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {renderContent()}
        
        {/* Scroll anchor */}
        <div 
          ref={messagesEndRef} 
          style={{ 
            height: '1px',
            flexShrink: 0
          }} 
        />
      </div>
      
      {/* Input area */}
      <div 
        className="flex-shrink-0 w-full"
        style={{ 
          height: `${currentInputAreaHeight}px`,
          minHeight: `${currentInputAreaHeight}px`,
          maxHeight: `${currentInputAreaHeight}px`
        }}
      >
        <VideoInputArea
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

export default VideoChatWindow;