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
  className?: string;
}

const PartnerTypingIndicator: React.FC<PartnerTypingIndicatorProps> = ({ 
  isTyping, 
  partnerName = 'Partner',
  theme,
  partnerInfo,
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

  const displayName = partnerInfo?.displayName || partnerInfo?.username || partnerName;
  const displayNameClass = getDisplayNameClass(partnerInfo?.displayNameAnimation);

  return (
    <div className={cn(
      "text-xs italic text-left pl-1 py-0.5 flex items-center gap-2",
      theme === 'theme-7' ? 'theme-7-text-shadow text-gray-100' : 'text-gray-500 dark:text-gray-400',
      className
    )}>
      <span 
        className={cn(displayNameClass)}
        style={{ 
          color: partnerInfo?.displayNameAnimation === 'rainbow' || partnerInfo?.displayNameAnimation === 'gradient'
            ? undefined 
            : (partnerInfo?.displayNameColor || '#999999'),
          animationDuration: partnerInfo?.displayNameAnimation === 'rainbow' ? `${partnerInfo?.rainbowSpeed || 3}s` : undefined
        }}
      >
        {displayName}
      </span>
      is typing{dots}
    </div>
  );
};

export default PartnerTypingIndicator;