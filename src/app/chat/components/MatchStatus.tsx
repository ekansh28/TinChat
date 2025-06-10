
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
    if (isConnected) return 'Disconnect';
    if (isSearching) return 'Stop Search';
    return 'Find Partner';
  };

  const handleButtonClick = () => {
    if (isConnected || isSearching) {
      onDisconnect();
    } else {
      onFindPartner();
    }
  };

  return (
    <div className={cn("flex flex-col items-center space-y-2", className)}>
      <div className="text-center">
        <div className="text-sm font-medium">{getStatusText()}</div>
        {partnerCount > 0 && (
          <div className="text-xs text-gray-500">
            {partnerCount} users online
          </div>
        )}
      </div>
      
      <Button
        onClick={handleButtonClick}
        disabled={disabled}
        variant={isConnected ? "destructive" : "default"}
        size="sm"
      >
        {getButtonText()}
      </Button>
    </div>
  );
};

export default MatchStatus;