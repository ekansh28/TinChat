// src/app/chat/components/MatchStatus.tsx
import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button-themed';

interface MatchStatusProps {
  isSearching: boolean;
  isConnected: boolean;
  partnerCount?: number;
  onFindPartner: () => void;
  onDisconnect: () => void;
  disabled?: boolean;
  className?: string;
}

const MatchStatus: React.FC<MatchStatusProps> = ({
  isSearching,
  isConnected,
  partnerCount = 0,
  onFindPartner,
  onDisconnect,
  disabled = false,
  className
}) => {
  const getStatusText = () => {
    if (isConnected) return 'Connected to partner';
    if (isSearching) return 'Searching for partner...';
    return 'Ready to chat';
  };

  const getButtonText = () => {
    if (isConnected) return 'Skip';
    if (isSearching) return 'Stop';
    return 'Find';
  };

  const handleButtonClick = () => {
    if (isConnected || isSearching) {
      onDisconnect();
    } else {
      onFindPartner();
    }
  };

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <div className="text-xs">
        <div className="font-bold">{getStatusText()}</div>
        {partnerCount > 0 && (
          <div className="text-gray-500">{partnerCount} online</div>
        )}
      </div>
      
      <Button
        onClick={handleButtonClick}
        disabled={disabled}
        size="sm"
        variant={isConnected ? "destructive" : "primary"}
        className="text-xs px-2 py-1"
      >
        {getButtonText()}
      </Button>
    </div>
  );
};

export default MatchStatus;