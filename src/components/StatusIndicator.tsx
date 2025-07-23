// src/components/StatusIndicator.tsx
'use client';

import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface StatusIndicatorProps {
  status: 'online' | 'idle' | 'dnd' | 'offline';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const STATUS_CONFIG = {
  online: {
    icon: '/icons/online.png',
    label: 'Online',
    color: '#43b581'
  },
  idle: {
    icon: '/icons/idle.png',
    label: 'Away',
    color: '#faa61a'
  },
  dnd: {
    icon: '/icons/dnd.png',
    label: 'Do Not Disturb',
    color: '#f04747'
  },
  offline: {
    icon: '/icons/offline.png',
    label: 'Offline',
    color: '#747f8d'
  }
};

const SIZE_CONFIG = {
  sm: { icon: 12, container: 'w-3 h-3' },
  md: { icon: 16, container: 'w-4 h-4' },
  lg: { icon: 20, container: 'w-5 h-5' }
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  size = 'md',
  showLabel = false,
  className
}) => {
  const config = STATUS_CONFIG[status];
  const sizeConfig = SIZE_CONFIG[size];

  if (showLabel) {
    return (
      <div className={cn("flex items-center space-x-1", className)}>
        <div 
          className={cn("rounded-full flex items-center justify-center", sizeConfig.container)}
          style={{ backgroundColor: config.color }}
        >
          <Image
            src={config.icon}
            alt={config.label}
            width={sizeConfig.icon}
            height={sizeConfig.icon}
            className="object-contain"
          />
        </div>
        <span className="text-xs text-gray-600 dark:text-gray-300">
          {config.label}
        </span>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "rounded-full flex items-center justify-center",
        sizeConfig.container,
        className
      )}
      style={{ backgroundColor: config.color }}
      title={config.label}
    >
      <Image
        src={config.icon}
        alt={config.label}
        width={sizeConfig.icon}
        height={sizeConfig.icon}
        className="object-contain"
      />
    </div>
  );
};

// Hook for managing user status
export const useUserStatus = () => {
  const [status, setStatus] = React.useState<'online' | 'idle' | 'dnd' | 'offline'>('online');
  
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setStatus('idle');
      } else {
        setStatus('online');
      }
    };

    const handleBeforeUnload = () => {
      setStatus('offline');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return { status, setStatus };
};