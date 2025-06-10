// src/app/chat/components/PartnerTypingIndicator.tsx
import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface PartnerTypingIndicatorProps {
  isTyping: boolean;
  partnerName?: string;
  className?: string;
}

const PartnerTypingIndicator: React.FC<PartnerTypingIndicatorProps> = ({ 
  isTyping, 
  partnerName = 'Partner',
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

  return (
    <div className={cn(
      "text-xs italic text-gray-500 dark:text-gray-400 px-2 py-1",
      className
    )}>
      {partnerName} is typing{dots}
    </div>
  );
};

export default PartnerTypingIndicator;
