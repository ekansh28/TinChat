import React, { useRef, useEffect, useCallback, useMemo } from 'react';
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
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const currentInputAreaHeight = isMobile ? INPUT_AREA_HEIGHT_MOBILE : INPUT_AREA_HEIGHT;
  const messagesContainerComputedHeight = useMemo(() => 
    `calc(100% - ${currentInputAreaHeight}px)`, 
    [currentInputAreaHeight]
  );

  // Improved scroll to bottom function
  const scrollToBottom = useCallback((force = false) => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
      
      if (force || isAtBottom) {
        // Use requestAnimationFrame to ensure DOM has updated
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    }
  }, []);

  // Auto-scroll effect for new messages
  useEffect(() => { 
    scrollToBottom();
  }, [messages, isPartnerTyping, scrollToBottom]);

  const inputAndSendDisabled = useMemo(() => 
    !isConnected || !isPartnerConnected, 
    [isConnected, isPartnerConnected]
  );

  return (
    <div className={cn(
      'window-body window-body-content flex-grow flex flex-col',
      theme === 'theme-7' ? 'glass-body-padding' : 'p-0.5',
      isMobile && 'p-1'
    )}>
      <div 
        ref={messagesContainerRef}
        className={cn(
          "flex-grow overflow-y-auto overscroll-contain",
          theme === 'theme-7' 
            ? 'border p-2 bg-white bg-opacity-20 dark:bg-gray-700 dark:bg-opacity-20' 
            : 'sunken-panel tree-view p-1',
          isMobile && 'p-2'
        )} 
        style={{ 
          height: messagesContainerComputedHeight, 
          overflowY: isScrollEnabled ? 'auto' : 'hidden',
          WebkitOverflowScrolling: 'touch' // Smooth scrolling on iOS
        }}
      >
        <div>
          {!isConnected && messages.length === 0 && (
            <div className="text-center text-xs italic p-4 text-gray-500 dark:text-gray-400">
              Connecting to chat server...
            </div>
          )}
          
          {isConnected && messages.length === 0 && !isPartnerConnected && (
            <div className="text-center text-xs italic p-4 text-gray-500 dark:text-gray-400">
              Waiting for partner...
            </div>
          )}
          
          {messages.map((msg, index) => (
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
          ))}
          
          {isPartnerTyping && (
            <PartnerTypingIndicator 
              isTyping={isPartnerTyping} 
              partnerName={partnerInfo?.displayName || partnerInfo?.username || 'Stranger'}
              theme={theme}
              partnerInfo={partnerInfo}
            />
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      <InputArea
        value={inputValue}
        onChange={onInputChange}
        onSend={onSendMessage}
        disabled={inputAndSendDisabled}
        theme={theme}
        isMobile={isMobile}
        onScrollToBottom={() => scrollToBottom(true)}
      />
    </div>
  );
};

export default ChatWindow;