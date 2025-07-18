// src/components/ProfileCustomizer/components/LoadingComponents.tsx
import React from 'react';
import { cn } from '@/lib/utils';
import SimpleSpriteAnimator from '@/components/SpriteAnimator';

// 98.css themed loading spinner
export const LoadingSpinner98: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={cn("animate-spin border-2 border-gray-600 border-t-transparent", sizeClasses[size])} 
         style={{ borderStyle: 'inset' }} />
  );
};

// 98.css styled loading state
export const LoadingState98: React.FC<{ 
  message: string; 
  progress?: number; 
  onCancel?: () => void;
}> = ({ message, progress, onCancel }) => (
  <div className="window-body">
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <SimpleSpriteAnimator
        src="https://cdn.tinchat.online/animations/downloadsprite.png"
        frameCount={24}
        progress={progress ?? 0}
        columns={1}
        rows={24}
        frameWidth={272}
        frameHeight={60}
      />

      <div className="text-center space-y-2">
        <h3 className="text-lg font-bold flex items-center gap-2">
          Loading Profile
        </h3>
        <p className="text-gray-700">{message}</p>
        {progress !== undefined && (
          <div className="w-64">
            <div className="progress-indicator">
              <div className="progress-indicator-bar transition-all duration-300" 
               style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      {onCancel && (
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  </div>
);