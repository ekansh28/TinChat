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
  // NEW: Add these props to get the most recent partner data
  recentPartnerData?: {
    senderUsername?: string;
    senderDisplayNameColor?: string;
    senderDisplayNameAnimation?: string;
    senderRainbowSpeed?: number;
  };
  className?: string;
}

const PartnerTypingIndicator: React.FC<PartnerTypingIndicatorProps> = ({ 
  isTyping, 
  partnerName = 'Partner',
  theme,
  partnerInfo,
  recentPartnerData, // NEW
  className 
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

  // FIXED: Prioritize recent message data over cached partner info
  const displayName = recentPartnerData?.senderUsername || 
                     partnerInfo?.displayName || 
                     partnerInfo?.username || 
                     partnerName;
  
  const displayNameColor = recentPartnerData?.senderDisplayNameColor || 
                          partnerInfo?.displayNameColor || 
                          '#ff6b6b'; // Better fallback color (more visible than #ff0000)
  
  const displayNameAnimation = recentPartnerData?.senderDisplayNameAnimation || 
                              partnerInfo?.displayNameAnimation || 
                              'none';
  
  const rainbowSpeed = recentPartnerData?.senderRainbowSpeed || 
                      partnerInfo?.rainbowSpeed || 
                      3;

  const displayNameClass = getDisplayNameClass(displayNameAnimation);

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