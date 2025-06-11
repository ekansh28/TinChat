// src/components/home/OnlineUsersWindow.tsx
import React from 'react';
import { cn } from '@/lib/utils';
import '@/styles/onlineUsers.css';

interface OnlineUsersWindowProps {
  onlineUsers: string[]; // Array of usernames
  isMobile: boolean;
}

export default function OnlineUsersWindow({ onlineUsers, isMobile }: OnlineUsersWindowProps) {
  // Don't show on mobile to avoid cluttering
  if (isMobile) return null;

  return (
    <div 
      className={cn(
        "fixed top-1/2 left-4 transform -translate-y-1/2 z-10",
        "w-[250px] h-[200px]",
        "bg-black bg-opacity-60",
        "border border-white border-opacity-100",
        "rounded-lg",
        "flex flex-col",
        "pixelated-border" // We'll add this custom class
      )}
      style={{
        imageRendering: 'pixelated',
        // Pixelated border effect using box-shadow
        boxShadow: `
          0 0 0 1px white,
          1px 1px 0 1px white,
          -1px -1px 0 1px white,
          1px -1px 0 1px white,
          -1px 1px 0 1px white
        `
      }}
    >
      {/* Header */}
      <div className="flex-shrink-0 text-center py-3 border-b border-white border-opacity-30">
        <h3 
          className="text-green-600 font-bold text-sm tracking-wide"
          style={{ 
            textShadow: '1px 1px 0 rgba(0,0,0,0.8)',
            fontFamily: 'monospace'
          }}
        >
          ONLINE NOW
        </h3>
      </div>

      {/* Users Grid */}
      <div className="flex-1 p-3 overflow-y-auto">
        {onlineUsers.length > 0 ? (
          <div className="grid grid-cols-3 gap-1 text-xs">
            {onlineUsers.map((username, index) => (
              <div
                key={`${username}-${index}`}
                className={cn(
                  "text-red-500 font-medium truncate text-center",
                  "hover:text-red-400 transition-colors cursor-default",
                  "p-1 rounded-sm hover:bg-white hover:bg-opacity-10"
                )}
                style={{ 
                  textShadow: '1px 1px 0 rgba(0,0,0,0.8)',
                  fontFamily: 'monospace'
                }}
                title={username} // Show full username on hover
              >
                {username}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p 
              className="text-gray-400 text-xs text-center"
              style={{ 
                textShadow: '1px 1px 0 rgba(0,0,0,0.8)',
                fontFamily: 'monospace'
              }}
            >
              No users online
            </p>
          </div>
        )}
      </div>

      {/* Bottom spacing */}
      <div className="flex-shrink-0 h-2"></div>
    </div>
  );
}