// src/app/chat/components/MatchStatus.tsx
import React from 'react';
import { cn } from '@/lib/utils';

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
    <div className={cn("window-body", className)} style={{ padding: '8px' }}>
      <div className="field-row" style={{ marginBottom: '8px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '2px' }}>
            {getStatusText()}
          </div>
          {partnerCount > 0 && (
            <div style={{ fontSize: '10px', color: '#666' }}>
              {partnerCount} users online
            </div>
          )}
        </div>
      </div>
      
      <div className="field-row" style={{ textAlign: 'center' }}>
        <button
          onClick={handleButtonClick}
          disabled={disabled}
          style={{ 
            minWidth: '80px',
            fontSize: '11px'
          }}
        >
          {getButtonText()}
        </button>
      </div>
    </div>
  );
};

export default MatchStatus;