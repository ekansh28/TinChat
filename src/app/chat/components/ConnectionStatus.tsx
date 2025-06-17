
// src/app/chat/components/ConnectionStatus.tsx
import React from 'react';
import { cn } from '@/lib/utils';

interface ConnectionStatusProps {
  isConnected: boolean;
  isConnecting: boolean;
  isDevelopment: boolean;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ 
  isConnected, 
  isConnecting, 
  isDevelopment 
}) => (
  <div className="flex items-center gap-2">
    <div className={cn(
      "w-2 h-2 rounded-full",
      isConnected ? "bg-green-500" : 
      isConnecting ? "bg-yellow-500 animate-pulse" : "bg-red-500"
    )} />
    {isDevelopment && (
      <span className="text-xs">
        {isConnected ? 'Connected' : 
         isConnecting ? 'Connecting...' : 'Disconnected'}
      </span>
    )}
  </div>
);