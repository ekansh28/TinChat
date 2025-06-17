import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { getDisplayNameClass } from '../utils/ChatHelpers';

interface PartnerTypingIndicatorProps {
  isTyping: boolean;
  partnerName?: string;
  theme: string;
  partnerInfo?: {
    username: string;
    displayName?: string;
    displayNameColor?: string;
    displayNameAnimation?: string;
    rainbowSpeed?: number;
  };
  recentPartnerData?: {
    senderUsername?: string;
    senderDisplayNameColor?: string;
    senderDisplayNameAnimation?: string;
    senderRainbowSpeed?: number;
  } | null;
  className?: string;
  isMobile?: boolean; // ✅ NEW: Mobile detection
}

const PartnerTypingIndicator: React.FC<PartnerTypingIndicatorProps> = ({ 
  isTyping, 
  partnerName = 'Partner',
  theme,
  partnerInfo,
  recentPartnerData,
  className,
  isMobile = false // ✅ NEW: Default to desktop
}) => {
  const [dots, setDots] = useState('.');

  useEffect(() => {
    if (!isTyping) {
      setDots('.');
      return;
    }

    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '.' : prev + '.');
    }, 500);

    return () => clearInterval(interval);
  }, [isTyping]);

  if (!isTyping) return null;

  // Safe handling of potentially null recentPartnerData
  const displayName = recentPartnerData?.senderUsername || 
                     partnerInfo?.displayName || 
                     partnerInfo?.username || 
                     partnerName;
  
  const displayNameColor = recentPartnerData?.senderDisplayNameColor || 
                          partnerInfo?.displayNameColor || 
                          '#ff6b6b';
  
  const displayNameAnimation = recentPartnerData?.senderDisplayNameAnimation || 
                              partnerInfo?.displayNameAnimation || 
                              'none';
  
  const rainbowSpeed = recentPartnerData?.senderRainbowSpeed || 
                      partnerInfo?.rainbowSpeed || 
                      3;

  const displayNameClass = getDisplayNameClass(displayNameAnimation);

  // ✅ MOBILE vs DESKTOP: Different layouts
  if (isMobile) {
    // ✅ MOBILE: Bubble style typing indicator
    return (
      <div className={cn(
        "w-full flex justify-start mb-1",
        className
      )}>
        <div className={cn(
          "message-bubble message-bubble-partner max-w-[80%] px-3 py-2 rounded-2xl rounded-bl-md mr-[20%]",
          "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100",
          "flex items-center gap-2",
          // Theme-specific styles
          theme === 'theme-98' && "bg-silver border border-gray-600 text-black",
          theme === 'theme-7' && "backdrop-blur-sm",
          "mobile-typing-indicator"
        )}>
          {/* Partner name */}
          <span 
            className={cn(
              "text-xs font-medium",
              displayNameClass
            )}
            style={{ 
              color: displayNameAnimation === 'rainbow' || displayNameAnimation === 'gradient'
                ? undefined 
                : displayNameColor,
              animationDuration: displayNameAnimation === 'rainbow' ? `${rainbowSpeed}s` : undefined
            }}
          >
            {displayName}
          </span>
          
          {/* Typing animation */}
          <div className="flex items-center gap-1">
            <span className="text-xs opacity-75">is typing</span>
            <div className="flex gap-0.5">
              <div className="w-1 h-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
              <div className="w-1 h-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
              <div className="w-1 h-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ✅ DESKTOP: Traditional typing indicator
  return (
    <div className={cn(
      "text-xs italic text-left pl-1 py-0.5 flex items-center gap-2",
      theme === 'theme-7' ? 'theme-7-text-shadow text-gray-100' : 'text-gray-500 dark:text-gray-400',
      className
    )}>
      <span 
        className={cn(displayNameClass)}
        style={{ 
          color: displayNameAnimation === 'rainbow' || displayNameAnimation === 'gradient'
            ? undefined 
            : displayNameColor,
          animationDuration: displayNameAnimation === 'rainbow' ? `${rainbowSpeed}s` : undefined
        }}
      >
        {displayName}
      </span>
      is typing{dots}
    </div>
  );
};

export default PartnerTypingIndicator;